using LinkUp.Api.Ai;
using LinkUp.Api.Options;
using LinkUp.Api.Planning;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using static LinkUp.Api.Tests.PlanTestData;

namespace LinkUp.Api.Tests;

public sealed class AiPlanServiceTests
{
    private static readonly AiUsage Usage = new(3000, 800, 0, TimeSpan.FromSeconds(2));

    private static readonly string ValidJson = $$"""
        {"plans":[{"title":"Drinks","summary":"A bar.","stops":[{"venueId":1,"startTime":"{{At(21)}}","endTime":"{{At(23)}}"}]}]}
        """;

    private sealed class FakeAi(params Func<CancellationToken, Task<AiJsonResponse>>[] responses) : IAiClient
    {
        public List<AiJsonRequest> Requests { get; } = [];

        public FakeAi(params Func<AiJsonResponse>[] responses)
            : this(responses.Select(r => (Func<CancellationToken, Task<AiJsonResponse>>)(_ => Task.FromResult(r()))).ToArray())
        {
        }

        public Task<AiJsonResponse> CompleteJsonAsync(AiJsonRequest request, CancellationToken cancellationToken)
        {
            Requests.Add(request);
            return responses[Requests.Count - 1](cancellationToken);
        }
    }

    private static Func<AiJsonResponse> Returns(string json) => () => new AiJsonResponse(json, Usage);

    private static (AiPlanService Service, AuthApiFactory.CapturedLogs Logs) Create(IAiClient ai, double timeoutSeconds = 55)
    {
        var logs = new AuthApiFactory.CapturedLogs();
        var logger = LoggerFactory.Create(builder => builder.AddProvider(logs)).CreateLogger<AiPlanService>();
        var options = Microsoft.Extensions.Options.Options.Create(new AiOptions { TotalTimeoutSeconds = timeoutSeconds });
        var planOptions = Microsoft.Extensions.Options.Options.Create(new PlanGenerationOptions { MaxAiCandidates = 3 });
        return (new AiPlanService(ai, options, planOptions, logger), logs);
    }

    [Fact]
    public async Task Sends_the_versioned_prompt_with_the_candidates_and_returns_validated_plans()
    {
        var ai = new FakeAi(Returns(ValidJson));
        var (service, logs) = Create(ai);

        var plans = await service.GeneratePlansAsync(Preferences(), [Venue(1)], CancellationToken.None);

        Assert.Equal("1", Assert.Single(Assert.Single(plans).Items).Venue.Id);
        var request = Assert.Single(ai.Requests);
        Assert.Equal(PlanPrompt.Instructions, request.Instructions);
        Assert.Equal(PlanSchema.Name, request.SchemaName);
        Assert.Contains("\"id\":1", request.Input);
        Assert.Contains(logs.Messages, m => m.Contains($"({PlanPrompt.Version}) attempt 1/2: 1 of 1 candidates sent, 1 plans from the AI, 1 kept"));
    }

    [Theory]
    [InlineData("{ not json")]
    [InlineData("""{"plans":[{"title":"Made up","summary":"","stops":[{"venueId":42,"startTime":"x","endTime":"y"}]}]}""")]
    public async Task Tries_again_once_when_the_output_is_unusable(string unusable)
    {
        var ai = new FakeAi(Returns(unusable), Returns(ValidJson));
        var (service, logs) = Create(ai);

        var plans = await service.GeneratePlansAsync(Preferences(), [Venue(1)], CancellationToken.None);

        Assert.Single(plans);
        Assert.Equal(2, ai.Requests.Count);
        Assert.Contains(logs.Messages, m => m.Contains("attempt 1/2"));
    }

    [Fact]
    public async Task Gives_up_after_two_unusable_responses()
    {
        var ai = new FakeAi(Returns("[]"), Returns("""{"plans":[]}"""));
        var (service, logs) = Create(ai);

        await Assert.ThrowsAsync<PlanGenerationException>(
            () => service.GeneratePlansAsync(Preferences(), [Venue(1)], CancellationToken.None));
        Assert.Equal(AiPlanService.MaxAttempts, ai.Requests.Count);
        Assert.Contains(logs.Messages, m => m.Contains("not valid plan JSON"));
    }

    [Fact]
    public async Task Logs_what_was_repaired()
    {
        var json = $$"""
            {"plans":[{"title":"T","summary":"S","stops":[
              {"venueId":1,"startTime":"{{At(21)}}","endTime":"{{At(23)}}"},
              {"venueId":42,"startTime":"{{At(23)}}","endTime":"{{At(24)}}"}]}]}
            """;
        var (service, logs) = Create(new FakeAi(Returns(json)));

        await service.GeneratePlansAsync(Preferences(), [Venue(1)], CancellationToken.None);

        Assert.Contains(logs.Messages, m => m.Contains("repaired the AI output: plan 1 stop 2: venue 42 is not a candidate"));
    }

    [Fact]
    public async Task Ai_failures_reach_the_caller()
    {
        var (service, _) = Create(new FakeAi(() => throw new AiException("down")));

        var error = await Assert.ThrowsAsync<AiException>(
            () => service.GeneratePlansAsync(Preferences(), [Venue(1)], CancellationToken.None));
        Assert.Equal("down", error.Message);
    }

    [Fact]
    public async Task Both_attempts_share_one_deadline()
    {
        // The first answer is unusable and slow; the retry hits the shared deadline.
        var ai = new FakeAi(
            async token =>
            {
                await Task.Delay(TimeSpan.FromMilliseconds(150), token);
                return new AiJsonResponse("{}", Usage);
            },
            async token =>
            {
                await Task.Delay(Timeout.InfiniteTimeSpan, token);
                throw new InvalidOperationException("unreachable");
            });
        var (service, logs) = Create(ai, timeoutSeconds: 0.3);

        var error = await Assert.ThrowsAsync<PlanGenerationException>(
            () => service.GeneratePlansAsync(Preferences(), [Venue(1)], CancellationToken.None));

        Assert.Contains("timed out", error.Message);
        Assert.Equal(2, ai.Requests.Count);
        Assert.Contains(logs.Messages, m => m.Contains("timed out after 0.3 s in attempt 2/2"));
    }

    [Fact]
    public async Task Caller_cancellation_is_not_reported_as_a_timeout()
    {
        using var cancelled = new CancellationTokenSource();
        await cancelled.CancelAsync();
        var (service, _) = Create(new FakeAi(token => Task.FromCanceled<AiJsonResponse>(token)));

        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => service.GeneratePlansAsync(Preferences(), [Venue(1)], cancelled.Token));
    }

    private sealed class EchoAi : IAiClient
    {
        public List<int> Sent { get; } = [];

        // Plans the first venue it was sent, then one of the venues it wasn't sent.
        public Task<AiJsonResponse> CompleteJsonAsync(AiJsonRequest request, CancellationToken cancellationToken)
        {
            using var input = System.Text.Json.JsonDocument.Parse(request.Input);
            Sent.AddRange(input.RootElement.GetProperty("venues").EnumerateArray().Select(v => v.GetProperty("id").GetInt32()));
            var unsent = Enumerable.Range(1, 10).First(id => !Sent.Contains(id));
            var json = $$"""
                {"plans":[{"title":"T","summary":"S","stops":[
                  {"venueId":{{Sent[0]}},"startTime":"{{At(21)}}","endTime":"{{At(22)}}"},
                  {"venueId":{{unsent}},"startTime":"{{At(22)}}","endTime":"{{At(23)}}"}]}]}
                """;
            return Task.FromResult(new AiJsonResponse(json, Usage));
        }
    }

    [Fact]
    public async Task Sends_at_most_the_configured_number_of_candidates_and_only_accepts_those()
    {
        var ai = new EchoAi();
        var (service, logs) = Create(ai);
        var filtered = Enumerable.Range(1, 10).Select(id => Venue(id)).ToList();

        var plans = await service.GeneratePlansAsync(Preferences(), filtered, CancellationToken.None);

        Assert.Equal(3, ai.Sent.Count);
        // A filtered venue the AI wasn't shown is still rejected.
        Assert.Equal([ai.Sent[0].ToString()], Assert.Single(plans).Items.Select(i => i.Venue.Id));
        Assert.Contains(logs.Messages, m => m.Contains("3 of 10 candidates sent"));
        Assert.Contains(logs.Messages, m => m.Contains("is not a candidate"));
    }
}
