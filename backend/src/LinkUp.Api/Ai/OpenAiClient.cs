using System.Diagnostics;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using LinkUp.Api.Options;
using Microsoft.Extensions.Options;

namespace LinkUp.Api.Ai;

/// <summary>
/// OpenAI Responses API with Structured Outputs. Timeouts and retries come from the resilience handler
/// registered in <see cref="AiServiceCollectionExtensions"/>. Logs tokens, latency and estimated cost per
/// request (issue #68); never the prompt or the key.
/// </summary>
public sealed class OpenAiClient(HttpClient http, IOptions<AiOptions> options, ILogger<OpenAiClient> logger)
    : IAiClient
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public async Task<AiJsonResponse> CompleteJsonAsync(AiJsonRequest request, CancellationToken cancellationToken)
    {
        var settings = options.Value;
        var body = new ResponsesRequest(
            settings.Model,
            request.Instructions,
            request.Input,
            new Reasoning(settings.ReasoningEffort),
            settings.MaxOutputTokens,
            Store: false,
            new TextOptions(new TextFormat("json_schema", request.SchemaName, request.Schema, Strict: true)));

        var started = Stopwatch.GetTimestamp();
        HttpResponseMessage response;
        try
        {
            response = await http.PostAsJsonAsync("responses", body, Json, cancellationToken);
        }
        catch (Exception ex) when (ex is HttpRequestException or TimeoutException or Polly.ExecutionRejectedException
                                       || (ex is OperationCanceledException && !cancellationToken.IsCancellationRequested))
        {
            logger.LogError(ex, "AI request to {Model} failed after {ElapsedMs} ms.",
                settings.Model, Stopwatch.GetElapsedTime(started).TotalMilliseconds);
            throw new AiException("The AI service could not be reached.", ex);
        }

        using (response)
        {
            var latency = Stopwatch.GetElapsedTime(started);
            var requestId = response.Headers.TryGetValues("x-request-id", out var ids) ? ids.FirstOrDefault() : null;

            if (!response.IsSuccessStatusCode)
            {
                var error = await ReadErrorMessageAsync(response, cancellationToken);
                logger.LogError("AI request to {Model} failed with {StatusCode} in {ElapsedMs} ms (request {RequestId}): {Error}",
                    settings.Model, (int)response.StatusCode, latency.TotalMilliseconds, requestId, error);
                throw new AiException($"The AI service returned {(int)response.StatusCode}.");
            }

            ResponsesResult? result;
            try
            {
                result = await response.Content.ReadFromJsonAsync<ResponsesResult>(Json, cancellationToken);
            }
            catch (JsonException ex)
            {
                logger.LogError(ex, "AI response from {Model} could not be read (request {RequestId}).", settings.Model, requestId);
                throw new AiException("The AI service returned an unreadable response.", ex);
            }

            var usage = new AiUsage(
                result?.Usage?.InputTokens ?? 0,
                result?.Usage?.OutputTokens ?? 0,
                result?.Usage?.OutputTokensDetails?.ReasoningTokens ?? 0,
                latency);
            var cost = (usage.InputTokens * settings.InputPricePerMillionTokens
                        + usage.OutputTokens * settings.OutputPricePerMillionTokens) / 1_000_000m;
            if (logger.IsEnabled(LogLevel.Information))
                logger.LogInformation(
                    "AI {Model} {Status} in {ElapsedMs:F0} ms: {InputTokens} input + {OutputTokens} output tokens ({ReasoningTokens} reasoning), ~${Cost:F5} (request {RequestId})",
                    result?.Model ?? settings.Model, result?.Status, latency.TotalMilliseconds,
                    usage.InputTokens, usage.OutputTokens, usage.ReasoningTokens, cost, requestId);

            if (result?.Status == "incomplete")
            {
                // Truncated output is never valid JSON, so don't try to parse it.
                var reason = result.IncompleteDetails?.Reason ?? "unknown";
                logger.LogWarning("AI output from {Model} was incomplete: {Reason} (request {RequestId}).", settings.Model, reason, requestId);
                throw new AiException($"The AI response was incomplete ({reason}).");
            }

            var content = result?.Output?
                .Where(item => item.Type == "message")
                .SelectMany(item => item.Content ?? [])
                .ToList() ?? [];

            if (content.FirstOrDefault(part => part.Type == "refusal") is { } refusal)
            {
                logger.LogWarning("AI {Model} refused (request {RequestId}): {Refusal}", settings.Model, requestId, refusal.Refusal);
                throw new AiException("The AI refused the request.");
            }

            var text = string.Concat(content.Where(part => part.Type == "output_text").Select(part => part.Text));
            if (text.Length == 0)
            {
                logger.LogError("AI response from {Model} had no output text (request {RequestId}).", settings.Model, requestId);
                throw new AiException("The AI response was empty.");
            }

            return new AiJsonResponse(text, usage);
        }
    }

    private static async Task<string> ReadErrorMessageAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        try
        {
            var error = await response.Content.ReadFromJsonAsync<ErrorResult>(Json, cancellationToken);
            return error?.Error?.Message ?? "(no message)";
        }
        catch (JsonException)
        {
            return "(no JSON error body)";
        }
    }

    private sealed record ResponsesRequest(
        string Model, string Instructions, string Input, Reasoning Reasoning, int MaxOutputTokens, bool Store,
        TextOptions Text);

    private sealed record Reasoning(string Effort);

    private sealed record TextOptions(TextFormat Format);

    private sealed record TextFormat(string Type, string Name, JsonElement Schema, bool Strict);

    private sealed record ResponsesResult(
        string? Model, string? Status, IncompleteDetails? IncompleteDetails, List<OutputItem>? Output, Usage? Usage);

    private sealed record IncompleteDetails(string? Reason);

    private sealed record OutputItem(string? Type, List<ContentPart>? Content);

    private sealed record ContentPart(string? Type, string? Text, string? Refusal);

    private sealed record Usage(int InputTokens, int OutputTokens, OutputTokensDetails? OutputTokensDetails);

    private sealed record OutputTokensDetails(int ReasoningTokens);

    private sealed record ErrorResult(ErrorDetails? Error);

    private sealed record ErrorDetails(string? Message);
}
