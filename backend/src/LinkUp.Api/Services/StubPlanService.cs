using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using LinkUp.Api.Geo;
using LinkUp.Api.Planning;

namespace LinkUp.Api.Services;

/// <summary>
/// Used when no AI key is configured: up to two fully priced, affordable single-candidate plans,
/// each spending the whole night there, so local development works without OpenAI.
/// </summary>
public sealed class StubPlanService(IPlanCostService costs) : IPlanService
{
    public Task<IReadOnlyList<PlanDto>> GeneratePlansAsync(
        NightPreferencesDto preferences, IReadOnlyList<Venue> candidates, CancellationToken cancellationToken)
    {
        PlanBudgetValidation.ValidatePreferences(preferences);
        var plans = new List<PlanDto>();
        foreach (var venue in candidates)
        {
            if (plans.Count == PlanValidator.MinPlans) break;
            if (!PlanBudgetValidation.TryEstimate([venue], preferences, costs, out var estimate, out _))
                continue;
            var cost = estimate.EstimatedCostPerPerson!.Value;
            var distance = preferences.StartLocation is { } start
                ? Math.Round(GeoDistance.HaversineKm(start.Latitude, start.Longitude, venue.Latitude, venue.Longitude), 2)
                : 0;
            plans.Add(new PlanDto(
                $"stub-{venue.Id}",
                $"Night at {venue.Name}",
                "Sample plan: no AI key is configured on the API.",
                [new PlanItemDto(PlanValidator.ToVenueDto(venue, preferences), preferences.StartTime, preferences.EndTime, cost, distance)],
                cost,
                estimate.TotalEstimatedCost,
                distance));
        }

        if (plans.Count == 0)
            throw new PlanBudgetException(
                "No fully priced plan could be generated within your budget. Try different activities or a higher budget.");

        return Task.FromResult<IReadOnlyList<PlanDto>>(plans);
    }
}
