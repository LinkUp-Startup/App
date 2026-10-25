using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;

namespace LinkUp.Api.Services;

public interface IVenueFilteringService
{
    /// <summary>
    /// Returns active venues open during availability and matching at least one selected activity.
    /// Missing/empty activities or activities with no mapped categories yield no candidates.
    /// At least one recognized transport option is required. Unknown capacity/accessibility
    /// does not exclude venues; distance filtering requires an origin not yet present in preferences.
    /// Known per-person venue costs must fit BudgetPerPerson; unknown costs are not assumed free.
    /// This overload has no origin and therefore does not apply distance filtering.
    /// </summary>
    Task<IReadOnlyList<Venue>> FilterAsync(
        NightPreferencesDto preferences, CancellationToken cancellationToken);

    /// <summary>
    /// Applies the same filters plus inclusive straight-line MaxDistanceKm from an explicit origin.
    /// Origin acquisition and request wiring depend on #53; invalid coordinates/radii are rejected.
    /// </summary>
    Task<IReadOnlyList<Venue>> FilterAsync(
        NightPreferencesDto preferences, double startLatitude, double startLongitude,
        CancellationToken cancellationToken);
}
