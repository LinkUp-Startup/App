using System.Net;
using System.Text;
using System.Text.Json;
using LinkUp.Api.Ai;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace LinkUp.Api.Tests;

public sealed class OpenAiClientTests
{
    private static readonly JsonElement Schema = JsonDocument.Parse("""
        {"type":"object","properties":{"ok":{"type":"boolean"}},"required":["ok"],"additionalProperties":false}
        """).RootElement;

    private static readonly AiJsonRequest Request = new("Be helpful.", "{\"venues\":[]}", "test_schema", Schema);

    private const string Completed = """
        {
          "model": "gpt-6-luna",
          "status": "completed",
          "output": [
            {"type": "reasoning", "summary": []},
            {"type": "message", "content": [{"type": "output_text", "text": "{\"ok\":true}"}]}
          ],
          "usage": {"input_tokens": 3000, "output_tokens": 800, "output_tokens_details": {"reasoning_tokens": 200}}
        }
        """;

    private sealed class Harness : IDisposable
    {
        private readonly ServiceProvider _provider;

        public Harness(params Func<HttpRequestMessage, Task<HttpResponseMessage>>[] responses)
        {
            Handler = new FakeHandler(responses);
            var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Ai:ApiKey"] = "sk-test",
                ["Ai:RetryDelaySeconds"] = "0",
                ["Ai:AttemptTimeoutSeconds"] = "1",
                ["Ai:TotalTimeoutSeconds"] = "5",
            }).Build();

            var services = new ServiceCollection();
            services.AddLogging(logging => logging.AddProvider(Logs));
            services.AddAiClient(configuration);
            services.AddHttpClient<IAiClient, OpenAiClient>().ConfigurePrimaryHttpMessageHandler(() => Handler);
            _provider = services.BuildServiceProvider();
        }

        public FakeHandler Handler { get; }
        public AuthApiFactory.CapturedLogs Logs { get; } = new();
        public IAiClient Client => _provider.GetRequiredService<IAiClient>();

        public void Dispose() => _provider.Dispose();
    }

    public sealed class FakeHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>>[] responses) : HttpMessageHandler
    {
        public List<(HttpRequestMessage Request, string Body)> Requests { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var body = request.Content is null ? "" : await request.Content.ReadAsStringAsync(cancellationToken);
            Requests.Add((request, body));
            var next = responses[Math.Min(Requests.Count, responses.Length) - 1];
            return await next(request).WaitAsync(cancellationToken);
        }
    }

    private static Func<HttpRequestMessage, Task<HttpResponseMessage>> Respond(HttpStatusCode status, string json) =>
        _ => Task.FromResult(new HttpResponseMessage(status)
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json"),
            Headers = { { "x-request-id", "req_123" } },
        });

    [Fact]
    public async Task Sends_a_strict_structured_output_request_and_returns_the_json()
    {
        using var harness = new Harness(Respond(HttpStatusCode.OK, Completed));

        var response = await harness.Client.CompleteJsonAsync(Request, CancellationToken.None);

        Assert.Equal("{\"ok\":true}", response.Json);
        Assert.Equal(new AiUsage(3000, 800, 200, response.Usage.Latency), response.Usage);

        var (sent, body) = Assert.Single(harness.Handler.Requests);
        Assert.Equal("https://api.openai.com/v1/responses", sent.RequestUri!.ToString());
        Assert.Equal("Bearer sk-test", sent.Headers.Authorization!.ToString());

        using var json = JsonDocument.Parse(body);
        var root = json.RootElement;
        Assert.Equal("gpt-6-luna", root.GetProperty("model").GetString());
        Assert.Equal("Be helpful.", root.GetProperty("instructions").GetString());
        Assert.Equal("low", root.GetProperty("reasoning").GetProperty("effort").GetString());
        Assert.Equal(4000, root.GetProperty("max_output_tokens").GetInt32());
        Assert.False(root.GetProperty("store").GetBoolean());
        var format = root.GetProperty("text").GetProperty("format");
        Assert.Equal("json_schema", format.GetProperty("type").GetString());
        Assert.Equal("test_schema", format.GetProperty("name").GetString());
        Assert.True(format.GetProperty("strict").GetBoolean());
        // The schema is passed through untouched, not renamed to snake_case.
        Assert.False(format.GetProperty("schema").GetProperty("additionalProperties").GetBoolean());
    }

    [Fact]
    public async Task Logs_tokens_latency_and_estimated_cost_but_not_the_prompt_or_key()
    {
        using var harness = new Harness(Respond(HttpStatusCode.OK, Completed));

        await harness.Client.CompleteJsonAsync(Request, CancellationToken.None);

        // 3000 × $0.10/M + 800 × $0.50/M = $0.0007, the Sprint 0 estimate.
        var line = Assert.Single(harness.Logs.Messages, m => m.StartsWith("AI gpt-6-luna completed"));
        Assert.Contains("3000 input + 800 output tokens (200 reasoning), ~$0.00070 (request req_123)", line);
        Assert.DoesNotContain(harness.Logs.Messages, m => m.Contains("sk-test") || m.Contains("Be helpful."));
    }

    [Fact]
    public async Task Retries_rate_limits_and_server_errors()
    {
        using var harness = new Harness(
            Respond(HttpStatusCode.TooManyRequests, """{"error":{"message":"Rate limit"}}"""),
            Respond(HttpStatusCode.InternalServerError, "oops"),
            Respond(HttpStatusCode.OK, Completed));

        var response = await harness.Client.CompleteJsonAsync(Request, CancellationToken.None);

        Assert.Equal("{\"ok\":true}", response.Json);
        Assert.Equal(3, harness.Handler.Requests.Count);
    }

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized, """{"error":{"message":"Incorrect API key"}}""", "Incorrect API key")]
    [InlineData(HttpStatusCode.BadRequest, "not json", "(no JSON error body)")]
    public async Task Fails_on_an_error_status_and_logs_the_reason(HttpStatusCode status, string body, string logged)
    {
        using var harness = new Harness(Respond(status, body));

        var error = await Assert.ThrowsAsync<AiException>(() => harness.Client.CompleteJsonAsync(Request, CancellationToken.None));

        Assert.Contains(((int)status).ToString(), error.Message);
        Assert.Single(harness.Handler.Requests); // client errors are not retried
        Assert.Contains(harness.Logs.Messages, m => m.Contains($"failed with {(int)status}") && m.Contains(logged));
    }

    [Theory]
    [InlineData("""{"status":"incomplete","incomplete_details":{"reason":"max_output_tokens"},"output":[]}""", "incomplete (max_output_tokens)")]
    [InlineData("""{"status":"completed","output":[{"type":"message","content":[{"type":"refusal","refusal":"No."}]}]}""", "refused")]
    [InlineData("""{"status":"completed","output":[]}""", "empty")]
    [InlineData("""[1, 2""", "unreadable")]
    public async Task Fails_on_output_that_cannot_be_used(string body, string reason)
    {
        using var harness = new Harness(Respond(HttpStatusCode.OK, body));

        var error = await Assert.ThrowsAsync<AiException>(() => harness.Client.CompleteJsonAsync(Request, CancellationToken.None));

        Assert.Contains(reason, error.Message);
    }

    [Fact]
    public async Task Gives_up_when_every_attempt_times_out()
    {
        using var harness = new Harness(async _ =>
        {
            await Task.Delay(TimeSpan.FromSeconds(10));
            return new HttpResponseMessage(HttpStatusCode.OK);
        });

        var error = await Assert.ThrowsAsync<AiException>(() => harness.Client.CompleteJsonAsync(Request, CancellationToken.None));

        Assert.Contains("could not be reached", error.Message);
        Assert.Equal(3, harness.Handler.Requests.Count); // first attempt + 2 retries, 1 s each
    }

    [Fact]
    public async Task Caller_cancellation_is_not_reported_as_an_ai_failure()
    {
        using var harness = new Harness(Respond(HttpStatusCode.OK, Completed));
        using var cancelled = new CancellationTokenSource();
        await cancelled.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => harness.Client.CompleteJsonAsync(Request, cancelled.Token));
    }

    [Fact]
    public void Sends_no_authorization_header_without_a_key()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddAiClient(new ConfigurationBuilder().Build());
        using var provider = services.BuildServiceProvider();

        var options = provider.GetRequiredService<IOptions<LinkUp.Api.Options.AiOptions>>().Value;
        Assert.False(options.IsConfigured);
        var http = provider.GetRequiredService<IHttpClientFactory>().CreateClient(typeof(IAiClient).Name);
        Assert.Null(http.DefaultRequestHeaders.Authorization);
    }

    [Fact]
    public void Rejects_a_total_timeout_that_leaves_no_room_for_one_attempt()
    {
        var services = new ServiceCollection();
        services.AddAiClient(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Ai:AttemptTimeoutSeconds"] = "30",
            ["Ai:TotalTimeoutSeconds"] = "30",
        }).Build());
        using var provider = services.BuildServiceProvider();

        var error = Assert.Throws<OptionsValidationException>(
            () => provider.GetRequiredService<IOptions<LinkUp.Api.Options.AiOptions>>().Value);
        Assert.Contains("TotalTimeoutSeconds", error.Message);
    }
}
