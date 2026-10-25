using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;

namespace LinkUp.Api.Tests;

/// <summary>A Friday night in Lleida (CET, +01:00) and venues open on it.</summary>
internal static class PlanTestData
{
    public static readonly DateTimeOffset Start = new(2026, 10, 30, 20, 0, 0, TimeSpan.FromHours(1));
    public static readonly DateTimeOffset End = Start.AddHours(6); // 02:00 on Saturday

    public static NightPreferencesDto Preferences(string? notes = null) => new(
        30, 4, [Activity.Dinner, Activity.Drinks], Start, End, 3, [Transport.Walking], notes);

    public static Venue Venue(
        int id, VenueCategory category = VenueCategory.Bar, TimeOnly? opens = null, TimeOnly? closes = null,
        double latitude = 41.6176, double longitude = 0.6200) => new()
    {
        Id = id,
        Name = $"Venue {id}",
        Address = "Carrer Major, Lleida",
        Category = category,
        Latitude = latitude,
        Longitude = longitude,
        PriceLevel = 2,
        OpeningHours =
        [
            new VenueOpeningHours
            {
                VenueId = id, Day = DayOfWeek.Friday,
                Opens = opens ?? new TimeOnly(18, 0), Closes = closes ?? new TimeOnly(3, 0),
            },
        ],
    };

    /// <summary>A time on the Friday as the AI writes it; hours past 23 fall on Saturday.</summary>
    public static string At(int hour, int minute = 0) =>
        Start.AddHours(hour - 20).AddMinutes(minute).ToString("yyyy-MM-dd'T'HH:mm:sszzz");
}
