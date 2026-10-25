using LinkUp.Api.Data;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace LinkUp.Api.Services;

public sealed class VenueFilteringService(AppDbContext db) : IVenueFilteringService
{
    public async Task<IReadOnlyList<Venue>> FilterAsync(
        NightPreferencesDto preferences, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(preferences);

        var query = db.Venues.AsNoTracking()
            .Where(v => v.IsActive)
            .OpenDuring(preferences.StartTime, preferences.EndTime);

        // Compose further preference conditions here before materializing (#59–#60).
        return await query
            .Include(v => v.OpeningHours)
            .OrderBy(v => v.Id)
            .AsSingleQuery()
            .ToListAsync(cancellationToken);
    }
}
