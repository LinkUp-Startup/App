namespace LinkUp.Api.Data.Entities;

public static class VenueQueries
{
    // Opening hours in Spanish local time
    public static readonly TimeZoneInfo VenueTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Madrid");

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