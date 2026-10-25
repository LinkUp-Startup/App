using LinkUp.Api.Planning;
using LinkUp.Api.Services;
using static LinkUp.Api.Tests.PlanTestData;

namespace LinkUp.Api.Tests;

public sealed class StubPlanBudgetTests
{
    [Fact]
    public async Task Stub_skips_unknown_or_over_budget_candidates_and_returns_only_affordable_plans()
    {
        var unknown = Venue(1);
        unknown.EntranceFee = null;
        var expensive = Venue(2);
        expensive.MinSpend = expensive.MaxSpend = 40m;
        var exact = Venue(3);
        exact.MinSpend = exact.MaxSpend = 30m;
        var below = Venue(4);
        below.MinSpend = below.MaxSpend = 15m;
        var service = new StubPlanService(new PlanCostService());

        var plans = await service.GeneratePlansAsync(Preferences(), [unknown, expensive, exact, below, Venue(5)], CancellationToken.None);

        Assert.Equal(["stub-3", "stub-4"], plans.Select(p => p.Id));
        Assert.Equal([30m, 15m], plans.Select(p => p.EstimatedCostPerPerson));
        Assert.All(plans, p => Assert.True(p.EstimatedCostPerPerson * 4 <= 30m * 4));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Stub_never_returns_a_success_when_all_prices_are_unknown_or_over_budget(bool unknown)
    {
        var venue = Venue(1);
        venue.EntranceFee = unknown ? null : 31m;
        var service = new StubPlanService(new PlanCostService());

        await Assert.ThrowsAsync<PlanBudgetException>(() =>
            service.GeneratePlansAsync(Preferences(), [venue], CancellationToken.None));
    }

    [Fact]
    public async Task Stub_free_plan_is_valid_at_zero_budget()
    {
        var plans = await new StubPlanService(new PlanCostService()).GeneratePlansAsync(
            Preferences() with { BudgetPerPerson = 0m }, [Venue(1)], CancellationToken.None);

        Assert.Equal(0m, Assert.Single(plans).EstimatedCostPerPerson);
    }
}
