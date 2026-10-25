using LinkUp.Api.Ai;
using LinkUp.Api.Options;
using LinkUp.Api.Planning;
using LinkUp.Api.Services;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using static LinkUp.Api.Tests.PlanTestData;

namespace LinkUp.Api.Tests;

public sealed class AiPlanServiceTests
{
    private static readonly AiUsage Usage = new(3000, 800, 0, TimeSpan.FromSeconds(2));

    private static readonly Data.Entities.Venue[] Two = [Venue(1), Venue(2)];

    /// <summary>One plan per array of venue ids, with one-hour stops from 21:00.</summary>
    private static string PlansJson(params int[][] plans) => System.Text.Json.JsonSerializer.Serialize(new
    {
        plans = plans.Select(ids => new
        {
            title = "Plan",
            summary = "A night out.",
            stops = ids.Select((id, i) => new { venueId = id, startTime = At(21 + i), endTime = At(22 + i) }),
        }),
    });

    private static readonly string ValidJson = PlansJson([1], [2]);

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

    private static (AiPlanService Service, AuthApiFactory.CapturedLogs Logs) Create(
        IAiClient ai, double timeoutSeconds = 55, int maxCandidates = 3, IPlanCostService? costs = null)
    {
        var logs = new AuthApiFactory.CapturedLogs();
        var logger = LoggerFactory.Create(builder => builder.AddProvider(logs)).CreateLogger<AiPlanService>();
        var options = Microsoft.Extensions.Options.Options.Create(new AiOptions { TotalTimeoutSeconds = timeoutSeconds });
        var planOptions = Microsoft.Extensions.Options.Options.Create(new PlanGenerationOptions { MaxAiCandidates = maxCandidates });
        return (new AiPlanService(ai, options, planOptions, logger, costs ?? new PlanCostService()), logs);
    }

    [Fact]
    public async Task Sends_the_versioned_prompt_with_the_candidates_and_returns_validated_plans()
    {
        var ai = new FakeAi(Returns(ValidJson));
        var (service, logs) = Create(ai);

        var plans = await service.GeneratePlansAsync(Preferences(), Two, CancellationToken.None);

        Assert.Equal(["1", "2"], plans.Select(p => Assert.Single(p.Items).Venue.Id));
        var request = Assert.Single(ai.Requests);
        Assert.Equal(PlanPrompt.Instructions, request.Instructions);
        Assert.Equal(PlanSchema.Name, request.SchemaName);
        Assert.Contains("\"id\":1", request.Input);
        Assert.Contains(logs.Messages, m => m.Contains($"({PlanPrompt.Version}) attempt 1/2: 2 of 2 candidates sent, 2 plans from the AI, 2 kept"));
    }

    [Theory]
    [InlineData("{ not json")]
    [InlineData("""{"plans":[{"title":"Made up","summary":"","stops":[{"venueId":42,"startTime":"x","endTime":"y"}]}]}""")]
    public async Task Tries_again_once_when_the_output_is_unusable(string unusable)
    {
        var ai = new FakeAi(Returns(unusable), Returns(ValidJson));
        var (service, logs) = Create(ai);

        var plans = await service.GeneratePlansAsync(Preferences(), Two, CancellationToken.None);

        Assert.Equal(2, plans.Count);
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
        var (service, logs) = Create(new FakeAi(Returns(PlansJson([1, 42], [2]))));

        await service.GeneratePlansAsync(Preferences(), Two, CancellationToken.None);

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

        // Plans the first venue it was sent followed by one it wasn't sent, and the second venue it was sent.
        public Task<AiJsonResponse> CompleteJsonAsync(AiJsonRequest request, CancellationToken cancellationToken)
        {
            using var input = System.Text.Json.JsonDocument.Parse(request.Input);
            Sent.AddRange(input.RootElement.GetProperty("venues").EnumerateArray().Select(v => v.GetProperty("id").GetInt32()));
            var unsent = Enumerable.Range(1, 10).First(id => !Sent.Contains(id));
            return Task.FromResult(new AiJsonResponse(PlansJson([Sent[0], unsent], [Sent[1]]), Usage));
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
        Assert.Equal([ai.Sent[0].ToString()], plans[0].Items.Select(i => i.Venue.Id));
        Assert.Contains(logs.Messages, m => m.Contains("3 of 10 candidates sent"));
        Assert.Contains(logs.Messages, m => m.Contains("is not a candidate"));
    }

    [Fact]
    public async Task Combines_distinct_plans_from_both_attempts()
    {
        var ai = new FakeAi(Returns(PlansJson([1])), Returns(PlansJson([1], [2])));
        var (service, _) = Create(ai);

        var plans = await service.GeneratePlansAsync(Preferences(), Two, CancellationToken.None);

        Assert.Equal(["1", "2"], plans.Select(p => p.Items[0].Venue.Id));
    }

    [Fact]
    public async Task Keeps_at_most_three_plans_across_attempts()
    {
        var candidates = Enumerable.Range(1, 4).Select(id => Venue(id)).ToList();
        var ai = new FakeAi(Returns(PlansJson([1])), Returns(PlansJson([2], [3], [4])));
        var (service, _) = Create(ai, maxCandidates: 4);

        var plans = await service.GeneratePlansAsync(Preferences(), candidates, CancellationToken.None);

        Assert.Equal(PlanValidator.MaxPlans, plans.Count);
    }

    [Fact]
    public async Task A_reordered_copy_is_not_a_second_plan()
    {
        var sameTwice = Returns(PlansJson([1, 2], [2, 1]));
        var (service, logs) = Create(new FakeAi(sameTwice, sameTwice));

        var error = await Assert.ThrowsAsync<PlanGenerationException>(
            () => service.GeneratePlansAsync(Preferences(), Two, CancellationToken.None));

        Assert.Contains("1 usable plan(s)", error.Message);
        Assert.Contains(logs.Messages, m => m.Contains("gave up with 1 distinct plan(s), 2 needed"));
    }

    private sealed class RecordingCosts : IPlanCostService
    {
        public List<(Data.Entities.Plan Plan, int GroupSize, PlanCostEstimate Estimate)> Calls { get; } = [];
        public PlanCostEstimate Estimate(Data.Entities.Plan plan, int groupSize)
        {
            var estimate = new PlanCostService().Estimate(plan, groupSize);
            Calls.Add((plan, groupSize, estimate));
            return estimate;
        }
    }

    private static Data.Entities.Venue Priced(int id, decimal amount)
    {
        var venue = Venue(id);
        venue.MinSpend = venue.MaxSpend = amount;
        return venue;
    }

    [Fact]
    public async Task Structurally_repaired_plans_are_priced_from_their_final_stops_before_success()
    {
        var json = System.Text.Json.JsonSerializer.Serialize(new
        {
            plans = new[]
            {
                new
                {
                    title = "Repaired", summary = "",
                    stops = new[]
                    {
                        new { venueId = 1, startTime = At(21), endTime = At(22) },
                        new { venueId = 2, startTime = At(27), endTime = At(28) },
                    },
                },
                new
                {
                    title = "Other", summary = "",
                    stops = new[] { new { venueId = 3, startTime = At(21), endTime = At(22) } },
                },
            },
        });
        var costs = new RecordingCosts();
        var ai = new FakeAi(Returns(json));
        var (service, _) = Create(ai, costs: costs);

        var plans = await service.GeneratePlansAsync(Preferences() with { BudgetPerPerson = 10m },
            [Priced(1, 10m), Priced(2, 100m), Priced(3, 10m)], CancellationToken.None);

        Assert.Equal(["1", "3"], plans.Select(p => Assert.Single(p.Items).Venue.Id));
        Assert.All(plans, p => Assert.Equal(10m, p.EstimatedCostPerPerson));
        Assert.Equal([1, 3], costs.Calls.Select(c => Assert.Single(c.Plan.Items).VenueId));
        Assert.Single(ai.Requests);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(3)]
    [InlineData(20)]
    public async Task Exact_per_person_budget_accepts_group_totals_without_double_multiplication(int groupSize)
    {
        var costs = new RecordingCosts();
        var ai = new FakeAi(Returns(PlansJson([1, 2], [3])));
        var (service, _) = Create(ai, costs: costs);
        var preferences = Preferences() with { BudgetPerPerson = 20m, GroupSize = groupSize };

        var plans = await service.GeneratePlansAsync(preferences,
            [Priced(1, 10m), Priced(2, 10m), Priced(3, 20m)], CancellationToken.None);

        Assert.Equal(2, plans.Count);
        Assert.All(plans, p =>
        {
            Assert.Equal(20m, p.EstimatedCostPerPerson);
            Assert.Equal(20m * groupSize, p.EstimatedTotalCost);
            Assert.Equal(p.EstimatedCostPerPerson, p.Items.Sum(i => i.EstimatedCostPerPerson));
            Assert.True(p.EstimatedCostPerPerson * groupSize <= preferences.BudgetPerPerson * groupSize);
        });
        Assert.Equal(["1", "2"], plans[0].Items.Select(i => i.Venue.Id));
        Assert.Equal(Start.AddHours(1), plans[0].Items[0].StartTime);
        Assert.Equal(2, costs.Calls.Count); // One estimator call per complete candidate plan, not per item.
        Assert.All(costs.Calls, c =>
        {
            Assert.Equal(groupSize, c.GroupSize);
            Assert.Equal(20m * groupSize, c.Estimate.TotalEstimatedCost);
            Assert.All(c.Plan.Items, i => Assert.NotNull(i.Venue));
        });
        Assert.Single(ai.Requests);
    }

    [Fact]
    public async Task Over_budget_plans_are_discarded_and_every_regenerated_alternative_is_revalidated()
    {
        var costs = new RecordingCosts();
        var ai = new FakeAi(Returns(PlansJson([1, 2], [1, 3])), Returns(PlansJson([1, 2], [2, 3])));
        var (service, logs) = Create(ai, costs: costs);

        var plans = await service.GeneratePlansAsync(Preferences(),
            [Priced(1, 20m), Priced(2, 20m), Priced(3, 5m)], CancellationToken.None);

        Assert.Equal(2, ai.Requests.Count);
        Assert.Equal(4, costs.Calls.Count);
        Assert.Equal(["1", "3"], plans[0].Items.Select(i => i.Venue.Id));
        Assert.Equal(["2", "3"], plans[1].Items.Select(i => i.Venue.Id));
        Assert.All(plans, p => Assert.Equal(25m, p.EstimatedCostPerPerson));
        Assert.Contains(logs.Messages, m => m.Contains("estimated total EUR 160.00 exceeds group budget EUR 120.00"));
    }

    [Fact]
    public async Task Individually_affordable_venues_can_exceed_the_combined_budget_and_exhaust_regeneration()
    {
        var costs = new RecordingCosts();
        var overBudget = Returns(PlansJson([1, 2, 3]));
        var ai = new FakeAi(overBudget, overBudget);
        var (service, _) = Create(ai, costs: costs);
        // The request model is per person: EUR 33.33 each is EUR 99.99 for three people.
        var preferences = Preferences() with { BudgetPerPerson = 33.33m, GroupSize = 3 };

        var error = await Assert.ThrowsAsync<PlanBudgetException>(() => service.GeneratePlansAsync(preferences,
            [Priced(1, 15m), Priced(2, 20m), Priced(3, 10m)], CancellationToken.None));

        Assert.Equal(AiPlanService.MaxAttempts, ai.Requests.Count);
        Assert.Equal(2, costs.Calls.Count);
        Assert.All(costs.Calls, c => Assert.Equal(135m, c.Estimate.TotalEstimatedCost));
        Assert.Contains("within your budget after 2 attempts", error.Message);
    }

    [Fact]
    public async Task Unknown_prices_do_not_count_as_free_and_a_priced_retry_can_succeed()
    {
        var unknown = Venue(1);
        unknown.EntranceFee = null;
        var ai = new FakeAi(Returns(PlansJson([1], [2])), Returns(PlansJson([2], [3])));
        var (service, logs) = Create(ai);

        var plans = await service.GeneratePlansAsync(Preferences(), [unknown, Venue(2), Venue(3)], CancellationToken.None);

        Assert.Equal(["2", "3"], plans.Select(p => Assert.Single(p.Items).Venue.Id));
        Assert.Equal(2, ai.Requests.Count);
        Assert.Contains(logs.Messages, m => m.Contains("cost is incomplete (1 unpriced item(s))"));
    }

    [Fact]
    public async Task Persistent_unknown_prices_are_not_returned_after_the_last_attempt()
    {
        var unknown = Venue(1);
        unknown.MinSpend = null;
        var response = Returns(PlansJson([1], [2]));
        var ai = new FakeAi(response, response);
        var (service, _) = Create(ai);

        await Assert.ThrowsAsync<PlanBudgetException>(() =>
            service.GeneratePlansAsync(Preferences(), [unknown, Venue(2)], CancellationToken.None));

        Assert.Equal(AiPlanService.MaxAttempts, ai.Requests.Count);
    }

    [Fact]
    public async Task Zero_budget_accepts_only_fully_known_free_plans()
    {
        var ai = new FakeAi(Returns(ValidJson));
        var (service, _) = Create(ai);

        var plans = await service.GeneratePlansAsync(Preferences() with { BudgetPerPerson = 0m },
            [Venue(1), Venue(2)], CancellationToken.None);

        Assert.Equal(2, plans.Count);
        Assert.All(plans, p => Assert.Equal(0m, p.EstimatedCostPerPerson));
        Assert.Single(ai.Requests);
    }

    [Fact]
    public async Task Zero_budget_rejects_positive_prices_on_every_attempt()
    {
        var ai = new FakeAi(Returns(ValidJson), Returns(ValidJson));
        var (service, _) = Create(ai);

        await Assert.ThrowsAsync<PlanBudgetException>(() => service.GeneratePlansAsync(
            Preferences() with { BudgetPerPerson = 0m }, [Priced(1, 0.01m), Priced(2, 0.01m)], CancellationToken.None));

        Assert.Equal(AiPlanService.MaxAttempts, ai.Requests.Count);
    }

    [Theory]
    [InlineData("10.01", true)]
    [InlineData("10.00", false)]
    public async Task Half_cent_venue_rounding_is_verified_at_exact_decimal_budget_boundaries(string budget, bool accepted)
    {
        var first = Priced(1, 10m);
        var second = Priced(2, 10m);
        first.MaxSpend = second.MaxSpend = 10.01m;
        var ai = new FakeAi(Returns(ValidJson), Returns(ValidJson));
        var (service, _) = Create(ai);
        var preferences = Preferences() with
        {
            BudgetPerPerson = decimal.Parse(budget, System.Globalization.CultureInfo.InvariantCulture), GroupSize = 3,
        };

        if (accepted)
        {
            var plans = await service.GeneratePlansAsync(preferences, [first, second], CancellationToken.None);
            Assert.All(plans, p => Assert.Equal(10.01m, p.EstimatedCostPerPerson));
            Assert.Single(ai.Requests);
        }
        else
        {
            await Assert.ThrowsAsync<PlanBudgetException>(() =>
                service.GeneratePlansAsync(preferences, [first, second], CancellationToken.None));
            Assert.Equal(AiPlanService.MaxAttempts, ai.Requests.Count);
        }
    }

    [Theory]
    [InlineData(-1, 4)]
    [InlineData(30, 0)]
    [InlineData(30, -1)]
    public async Task Invalid_budget_or_group_does_not_reach_the_AI(int budget, int groupSize)
    {
        var ai = new FakeAi(Returns(ValidJson));
        var (service, _) = Create(ai);

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() => service.GeneratePlansAsync(
            Preferences() with { BudgetPerPerson = budget, GroupSize = groupSize }, Two, CancellationToken.None));

        Assert.Empty(ai.Requests);
    }

    [Fact]
    public async Task Missing_preferences_do_not_reach_the_AI()
    {
        var ai = new FakeAi(Returns(ValidJson));
        var (service, _) = Create(ai);

        await Assert.ThrowsAsync<ArgumentNullException>(() => service.GeneratePlansAsync(null!, Two, CancellationToken.None));

        Assert.Empty(ai.Requests);
    }
}
