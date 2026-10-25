using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;

namespace LinkUp.Api.Services;

public interface IVenueFilteringService
{
    /// <summary>
    /// Returns candidate venues using the currently supported filters.
    /// Preference-specific conditions are added in issues #58–#60.
    /// </summary>
    Task<IReadOnlyList<Venue>> FilterAsync(
        NightPreferencesDto preferences, CancellationToken cancellationToken);
}
