using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;

namespace LinkUp.Api.Services;

public interface IVenueFilteringService
{
    /// <summary>
    /// Returns active venues whose opening hours overlap the requested availability.
    /// Further preference conditions are added in issues #59–#60.
    /// </summary>
    Task<IReadOnlyList<Venue>> FilterAsync(
        NightPreferencesDto preferences, CancellationToken cancellationToken);
}
