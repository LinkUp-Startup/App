using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using LinkUp.Api.Planning;

namespace LinkUp.Api.Services;

/// <summary>
/// Used when no AI key is configured (local development, tests): one plan with the first candidate for the
/// whole night, so the app works end to end without OpenAI.
/// </summary>
public sealed class StubPlanService : IPlanService
{
    public Task<IReadOnlyList<PlanDto>> GeneratePlansAsync(
        NightPreferencesDto preferences, IReadOnlyList<Venue> candidates, CancellationToken cancellationToken)
    {
        var venue = candidates[0];
        var cost = PlanValidator.EstimateCost(venue);
        var plan = new PlanDto(
            $"stub-{venue.Id}",
            $"Night at {venue.Name}",
            "Sample plan: no AI key is configured on the API.",
            [new PlanItemDto(PlanValidator.ToVenueDto(venue, preferences), preferences.StartTime, preferences.EndTime, cost, 0)],
            cost,
            0);

        return Task.FromResult<IReadOnlyList<PlanDto>>([plan]);
    }
}
