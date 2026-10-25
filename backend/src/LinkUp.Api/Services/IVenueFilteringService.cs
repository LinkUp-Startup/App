using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;

namespace LinkUp.Api.Services;

public interface IVenueFilteringService
{
    /// <summary>
    /// Returns active venues open during availability and matching at least one selected activity.
    /// Missing/empty activities or activities with no mapped categories yield no candidates.
    /// Further preference conditions are added in issue #60.
    /// </summary>
    Task<IReadOnlyList<Venue>> FilterAsync(
        NightPreferencesDto preferences, CancellationToken cancellationToken);
}
