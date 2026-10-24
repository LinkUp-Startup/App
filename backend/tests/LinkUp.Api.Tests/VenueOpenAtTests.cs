using System.Globalization;
using LinkUp.Api.Data.Entities;

namespace LinkUp.Api.Tests;

public sealed class VenueOpenAtTests
{
    // Split shift on Monday, closing at midnight; past-midnight slots on Friday and Sunday (wraps to Monday)
    private static readonly Venue Venue = new()
    {
        Id = 1,
        Name = "Test venue",
        Address = "Test address",
        OpeningHours =
        [
            Slot(DayOfWeek.Monday, "13:00", "16:00"),
            Slot(DayOfWeek.Monday, "20:00", "00:00"),
            Slot(DayOfWeek.Friday, "18:00", "03:00"),
            Slot(DayOfWeek.Sunday, "22:00", "02:00"),
        ],
    };

    [Theory]
    [InlineData(DayOfWeek.Monday, "13:00", true)]      // Opening minute is open
    [InlineData(DayOfWeek.Monday, "12:59", false)]
    [InlineData(DayOfWeek.Monday, "16:00", false)]     // Closing minute is closed
    [InlineData(DayOfWeek.Monday, "17:00", false)]     // Gap between lunch and dinner
    [InlineData(DayOfWeek.Monday, "23:59", true)]
    [InlineData(DayOfWeek.Tuesday, "00:00", false)]    // Closes at midnight
    [InlineData(DayOfWeek.Friday, "17:59", false)]
    [InlineData(DayOfWeek.Friday, "23:00", true)]
    [InlineData(DayOfWeek.Saturday, "02:59", true)]    // Friday night continues into Saturday
    [InlineData(DayOfWeek.Saturday, "03:00", false)]
    [InlineData(DayOfWeek.Monday, "01:00", true)]      // Sunday night continues into Monday
    [InlineData(DayOfWeek.Wednesday, "20:00", false)]  // No rows = closed
    public void Open_at_local_day_and_time(DayOfWeek day, string time, bool expected)
    {
        var result = new[] { Venue }.AsQueryable().OpenAt(day, Time(time)).Any();

        Assert.Equal(expected, result);
    }

    [Fact]
    public void Moment_is_converted_to_Lleida_time()
    {
        var moment = new DateTimeOffset(2026, 10, 24, 1, 30, 0, TimeSpan.Zero);

        Assert.False(new[] { Venue }.AsQueryable().OpenAt(moment).Any());
    }

    private static VenueOpeningHours Slot(DayOfWeek day, string opens, string closes) =>
        new() { Day = day, Opens = Time(opens), Closes = Time(closes) };

    private static TimeOnly Time(string value) => TimeOnly.Parse(value, CultureInfo.InvariantCulture);
}