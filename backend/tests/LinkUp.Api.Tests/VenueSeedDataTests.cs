using LinkUp.Api.Data.Entities;
using LinkUp.Api.Data.Seed;

namespace LinkUp.Api.Tests;

public sealed class VenueSeedDataTests
{
    private static readonly IReadOnlyList<Venue> Venues = VenueSeedData.Load();

    [Fact]
    public void Dataset_loads_with_unique_ids()
    {
        Assert.NotEmpty(Venues);
        Assert.Equal(Venues.Count, Venues.Select(v => v.Id).Distinct().Count());
    }

    [Fact]
    public void Every_venue_has_opening_hours() =>
        Assert.All(Venues, v => Assert.NotEmpty(v.OpeningHours));

    [Fact]
    public void Every_venue_has_a_valid_price_level_and_spend_range() =>
        Assert.All(Venues, v =>
        {
            Assert.NotNull(v.PriceLevel);
            Assert.InRange(v.PriceLevel.Value, 1, 4);
            Assert.True(v.MinSpend <= v.MaxSpend);
        });

    [Fact]
    public void Fields_are_mapped()
    {
        var venue = Venues.Single(v => v.Name == "Pub Legend");  // bar, free, €1–10, Daily 18:00–03:00

        Assert.Equal(VenueCategory.Bar, venue.Category);
        Assert.Equal(EntranceType.Free, venue.EntranceType);
        Assert.Equal(1m, venue.MinSpend);
        Assert.Equal(10m, venue.MaxSpend);
        Assert.Equal(1, venue.PriceLevel);
        Assert.Equal(7, venue.OpeningHours.Count);
        Assert.All(venue.OpeningHours, h =>
        {
            Assert.Equal(new TimeOnly(18, 0), h.Opens);
            Assert.Equal(new TimeOnly(3, 0), h.Closes);
        });
    }

    [Theory]
    [InlineData("€10–20", 10, 20)]
    [InlineData("€5", 5, 5)]
    [InlineData("€0", 0, 0)]
    public void Spend_is_parsed(string text, int min, int max)
    {
        var (parsedMin, parsedMax) = VenueSeedData.ParseSpend(text);

        Assert.Equal((decimal)min, parsedMin);
        Assert.Equal((decimal)max, parsedMax);
    }

    [Theory]
    [InlineData(0, 0, 1)]
    [InlineData(1, 10, 1)]
    [InlineData(10, 20, 2)]
    [InlineData(20, 30, 3)]
    [InlineData(40, 80, 4)]
    public void Price_level_follows_the_typical_spend(int min, int max, int expected) =>
        Assert.Equal(expected, VenueSeedData.PriceLevelFor(min, max));

    [Fact]
    public void Split_shifts_and_day_ranges_become_one_row_per_day_and_slot()
    {
        var rows = VenueSeedData.ParseOpeningHours("Mon–Tue 13:00–16:00, 20:00–00:00; Wed closed").ToList();

        Assert.Equal(4, rows.Count);
        Assert.Contains(rows, h => h.Day == DayOfWeek.Tuesday && h.Opens == new TimeOnly(20, 0) && h.Closes == TimeOnly.MinValue);
        Assert.DoesNotContain(rows, h => h.Day == DayOfWeek.Wednesday);
    }

    [Fact]
    public void Day_ranges_can_wrap_around_the_week()
    {
        var rows = VenueSeedData.ParseOpeningHours("Sun–Mon 10:00–12:00").ToList();

        Assert.Equal(new[] { DayOfWeek.Sunday, DayOfWeek.Monday }, rows.Select(h => h.Day));
    }

    [Fact]
    public void Daily_means_every_day() =>
        Assert.Equal(7, VenueSeedData.ParseOpeningHours("Daily 09:00–00:00").Count());

    [Theory]
    [InlineData("Mon 13:00-16:00")]       // hyphen instead of en dash
    [InlineData("Someday 10:00–12:00")]
    [InlineData("Mon 25:00–26:00")]
    public void Unreadable_hours_are_rejected(string text) =>
        Assert.Throws<FormatException>(() => VenueSeedData.ParseOpeningHours(text).ToList());
}
