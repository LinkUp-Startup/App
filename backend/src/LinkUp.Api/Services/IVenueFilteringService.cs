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
    /// </summary>
    Task<IReadOnlyList<Venue>> FilterAsync(
        NightPreferencesDto preferences, CancellationToken cancellationToken);
}
