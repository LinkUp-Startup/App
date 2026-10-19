using LinkUp.Api.Dtos;

namespace LinkUp.Api.Services;

/// <summary>
/// Placeholder so the app can talk to the API end to end.
/// Replaced by venue filtering + AI generation (issues #57, #64-#71).
/// </summary>
public sealed class StubPlanService : IPlanService
{
    public Task<IReadOnlyList<PlanDto>> GeneratePlansAsync(
        NightPreferencesDto preferences, CancellationToken cancellationToken)
    {
        var venue = new VenueDto(
            "stub-1", "Sample Venue", Activity.Dinner, "Carrer Major, Lleida", 41.6176, 0.6200, 2);

        var plan = new PlanDto(
            "stub-plan-1",
            "Sample night",
            "Stub plan until the real generator is implemented.",
            [new PlanItemDto(venue, preferences.StartTime, preferences.EndTime, 15m, 0.5)],
            15m,
            0.5);

        return Task.FromResult<IReadOnlyList<PlanDto>>([plan]);
    }
}
