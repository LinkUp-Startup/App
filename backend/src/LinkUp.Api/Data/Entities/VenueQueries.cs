using System.Linq.Expressions;
using LinkUp.Api.Geo;

namespace LinkUp.Api.Data.Entities;

public static class VenueQueries
{
    // Opening hours in Spanish local time
    public static readonly TimeZoneInfo VenueTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Madrid");

    /// <summary>Venues at most maxDistanceKm great-circle kilometres from the supplied origin.</summary>
    public static IQueryable<Venue> WithinDistance(
        this IQueryable<Venue> venues, double startLatitude, double startLongitude, double maxDistanceKm)
    {
        GeoDistance.ValidateCoordinates(startLatitude, startLongitude);
        if (!double.IsFinite(maxDistanceKm) || maxDistanceKm < 0)
            throw new ArgumentOutOfRangeException(nameof(maxDistanceKm), "Distance must be finite and nonnegative.");

        var venue = Expression.Parameter(typeof(Venue), "v");
        // Capture request values so EF parameterizes them instead of creating a SQL/query-cache
        // entry for every distinct start coordinate.
        Expression<Func<double>> latitudeParameter = () => startLatitude;
        Expression<Func<double>> longitudeParameter = () => startLongitude;
        Expression<Func<double>> radiusParameter = () => maxDistanceKm;
        var distance = Expression.Invoke(GeoDistance.HaversineKmExpression,
            latitudeParameter.Body, longitudeParameter.Body,
            Expression.Property(venue, nameof(Venue.Latitude)),
            Expression.Property(venue, nameof(Venue.Longitude)));
        var inRange = Expression.Lambda<Func<Venue, bool>>(
            Expression.LessThanOrEqual(distance, radiusParameter.Body), venue);

        // Zero coordinates are legitimate. Invalid/out-of-range data must not imply proximity.
        return venues.Where(v => v.Latitude >= -90 && v.Latitude <= 90
                && v.Longitude >= -180 && v.Longitude <= 180)
            .Where(inRange);
    }

    /// <summary>
    /// Excludes venues whose known per-person admission/consumption amounts exceed the available EUR.
    /// Unknown components are retained unless known costs alone already exceed the budget.
    /// </summary>
    public static IQueryable<Venue> WithinBudget(this IQueryable<Venue> venues, decimal budgetPerPerson)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(budgetPerPerson);

        // Prices are stored in cents. For nonnegative amounts, Round(midpoint, 2, AwayFromZero)
        // <= budget is equivalent to midpoint < Floor(budget * 100) / 100 + half a cent.
        // Moving this boundary to a parameter avoids invoking the unmapped getter or a
        // provider-specific rounding function in SQL; all arithmetic remains decimal.
        var exclusiveLimit = decimal.Floor(budgetPerPerson * 100m) / 100m + 0.005m;

        // Coalescing an unknown fee checks a lower bound only; it does not label admission free.
        return venues.Where(v =>
            (v.EntranceFee == null || v.EntranceFee <= budgetPerPerson) &&
            (v.MinSpend == null || v.MaxSpend == null ||
                (v.MinSpend + v.MaxSpend) / 2m + (v.EntranceFee ?? 0m) < exclusiveLimit));
    }

    /// <summary>
    /// Candidates need a positive overlap with availability, not to remain open for the entire night.
    /// Both intervals are half-open: merely touching an opening or closing boundary does not match.
    /// Hours recur weekly in Madrid wall-clock time; Closes &lt;= Opens ends the following day.
    /// </summary>
    public static IQueryable<Venue> OpenDuring(
        this IQueryable<Venue> venues, DateTimeOffset start, DateTimeOffset end)
    {
        if (end <= start)
            throw new ArgumentOutOfRangeException(nameof(end), "Availability must end after it starts.");

        var localStart = TimeZoneInfo.ConvertTime(start, VenueTimeZone);
        var localEnd = TimeZoneInfo.ConvertTime(end, VenueTimeZone);
        var overlaps = OverlapPredicate(localStart.DateTime, localEnd.DateTime);
        // Valid preference windows are at most 12 hours, so they can cross at most one
        // Madrid offset transition. Split there to handle skipped/repeated clock hours.
        if (localStart.Offset != localEnd.Offset)
        {
            var before = start.UtcTicks;
            var after = end.UtcTicks;
            while (after - before > 1)
            {
                var middle = before + (after - before) / 2;
                var offset = VenueTimeZone.GetUtcOffset(new DateTimeOffset(middle, TimeSpan.Zero));
                if (offset == localStart.Offset)
                    before = middle;
                else
                    after = middle;
            }

            var transition = new DateTimeOffset(after, TimeSpan.Zero);
            var first = OverlapPredicate(localStart.DateTime, transition.UtcDateTime + localStart.Offset);
            var second = OverlapPredicate(
                TimeZoneInfo.ConvertTime(transition, VenueTimeZone).DateTime, localEnd.DateTime);
            overlaps = Expression.Lambda<Func<Venue, bool>>(
                Expression.OrElse(first.Body, Expression.Invoke(second, first.Parameters)), first.Parameters);
        }

        return venues.Where(overlaps);
    }

    private static Expression<Func<Venue, bool>> OverlapPredicate(DateTime start, DateTime end)
    {
        var startDate = start.Date;
        var endDate = end.Date;
        var startTime = TimeOnly.FromDateTime(start);
        var endTime = TimeOnly.FromDateTime(end);

        Expression<Func<Venue, bool>> overlaps = v => false;
        if (end <= start)
            return overlaps;
        // Include yesterday's slots, since they may remain open after midnight today.
        for (var date = startDate.AddDays(-1); date <= endDate; date = date.AddDays(1))
        {
            var slotDate = date;
            var day = date.DayOfWeek;
            var nextDate = date.AddDays(1);
            Expression<Func<Venue, bool>> onDay = v => v.OpeningHours.Any(h => h.Day == day &&
                // Same-day slot: its end must follow availability's start.
                ((h.Opens < h.Closes && slotDate >= startDate &&
                    (slotDate > startDate || h.Closes > startTime))
                // Overnight slot: its end belongs to the following date.
                || (h.Closes <= h.Opens &&
                    (nextDate > startDate || (nextDate == startDate && h.Closes > startTime)))) &&
                // Either kind of slot must begin before availability ends.
                (slotDate < endDate || h.Opens < endTime));

            // EF Core expands invocation expressions before translating the combined predicate.
            overlaps = Expression.Lambda<Func<Venue, bool>>(
                Expression.OrElse(overlaps.Body, Expression.Invoke(onDay, overlaps.Parameters)),
                overlaps.Parameters);
        }

        return overlaps;
    }

    // Convertes the open hour to the local time
    public static IQueryable<Venue> OpenAt(this IQueryable<Venue> venues, DateTimeOffset moment)
    {
        var local = TimeZoneInfo.ConvertTime(moment, VenueTimeZone);
        return venues.OpenAt(local.DayOfWeek, TimeOnly.FromTimeSpan(local.TimeOfDay));
    }

    // Venues open on the given local day and time
    public static IQueryable<Venue> OpenAt(this IQueryable<Venue> venues, DayOfWeek day, TimeOnly time)
    {
        var previousDay = (DayOfWeek)(((int)day + 6) % 7);

        return venues.Where(v => v.OpeningHours.Any(h =>
            // Same-day slot (Mon 13:00–16:00 at Mon 14:00)
            (h.Opens < h.Closes && h.Day == day && h.Opens <= time && time < h.Closes)
            // Past-midnight slot & evening part (Fri 18:00–03:00 at Fri 23:00)
            || (h.Closes <= h.Opens && h.Day == day && h.Opens <= time)
            // Past-midnight slot & early-morning part (Fri 18:00–03:00 at Sat 02:00)
            || (h.Closes <= h.Opens && h.Day == previousDay && time < h.Closes)));
    }
}
