using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using LinkUp.Api.Planning;

namespace LinkUp.Api.Services;

/// <summary>
/// Used when no AI key is configured (local development, tests): one plan per candidate for the first two
/// candidates, each spending the whole night there, so the app works end to end without OpenAI.
/// </summary>
public sealed class StubPlanService(IPlanCostService costs) : IPlanService
{
    public Task<IReadOnlyList<PlanDto>> GeneratePlansAsync(
        NightPreferencesDto preferences, IReadOnlyList<Venue> candidates, CancellationToken cancellationToken)
    {
        IReadOnlyList<PlanDto> plans = candidates.Take(PlanValidator.MinPlans).Select(venue =>
        {
            var prices = PlanPricing.Price(costs, [venue], preferences.GroupSize);
            return new PlanDto(
                $"stub-{venue.Id}",
                $"Night at {venue.Name}",
                "Sample plan: no AI key is configured on the API.",
                [new PlanItemDto(
                    PlanValidator.ToVenueDto(venue, preferences), preferences.StartTime, preferences.EndTime,
                    prices.PerStop[0], 0)],
                prices.Plan.EstimatedCostPerPerson,
                prices.Plan.TotalEstimatedCost,
                0);
        }).ToList();

        return Task.FromResult(plans);
    }
}
