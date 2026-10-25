using LinkUp.Api.Data;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace LinkUp.Api.Services;

public sealed class VenueFilteringService(AppDbContext db) : IVenueFilteringService
{
    public Task<IReadOnlyList<Venue>> FilterAsync(
        NightPreferencesDto preferences, CancellationToken cancellationToken) =>
        FilterCoreAsync(preferences, null, cancellationToken);

    public Task<IReadOnlyList<Venue>> FilterAsync(
        NightPreferencesDto preferences, double startLatitude, double startLongitude,
        CancellationToken cancellationToken) =>
        FilterCoreAsync(preferences, (startLatitude, startLongitude), cancellationToken);

    private async Task<IReadOnlyList<Venue>> FilterCoreAsync(
        NightPreferencesDto preferences, (double Latitude, double Longitude)? startPoint,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(preferences);

        // OR across selections. Empty/missing selections cannot match a category.
        // Only the small preference-derived category set is materialized, never venue data.
        var categories = preferences.Activities?
            .SelectMany(CategoriesFor)
            .Distinct()
            .ToArray() ?? [];

        // The form requires a transport choice; unknown enum values do not establish availability.
        var hasTransport = preferences.Transport?.Any(mode => Enum.IsDefined(mode)) == true;

        var query = db.Venues.AsNoTracking()
            .Where(v => v.IsActive && hasTransport)
            .OpenDuring(preferences.StartTime, preferences.EndTime)
            .Where(v => categories.Contains(v.Category))
            .WithinBudget(preferences.BudgetPerPerson);

        if (startPoint is { } origin)
            query = query.WithinDistance(origin.Latitude, origin.Longitude, preferences.MaxDistanceKm);

        // Existing callers have no origin until #53 supplies one; never substitute a default.
        // See docs/venue-filtering.md for location and capacity limitations.
        return await query
            .Include(v => v.OpeningHours)
            .OrderBy(v => v.Id)
            .AsSingleQuery()
            .ToListAsync(cancellationToken);
    }

    // Map only capabilities established by the category, without inferring events from tags/notes.
    // Compound categories can support more than one activity; unknown values never add matches.
    internal static VenueCategory[] CategoriesFor(Activity activity) => activity switch
    {
        Activity.Dinner => [VenueCategory.Restaurant, VenueCategory.BarRestaurant],
        Activity.Drinks =>
        [
            VenueCategory.Bar, VenueCategory.Pub, VenueCategory.BarRestaurant,
            VenueCategory.Cafe, VenueCategory.BakeryCafe,
        ],
        Activity.Club => [VenueCategory.Nightclub],
        // There is no category establishing support for Concert, Cinema, Games or Outdoor yet.
        _ => [],
    };
}
