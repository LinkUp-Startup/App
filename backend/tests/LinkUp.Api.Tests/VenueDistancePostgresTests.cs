using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using LinkUp.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace LinkUp.Api.Tests;

// Verify the production provider's trigonometric SQL with PostgreSQL supplied by CI.
public sealed class VenueDistancePostgresTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>
{
    [Theory]
    [InlineData(0, new[] { 9001 })]
    [InlineData(1, new[] { 9001, 9002 })]
    [InlineData(3, new[] { 9001, 9002, 9003 })]
    [InlineData(30, new[] { 9001, 9002, 9003, 9005 })]
    public async Task Native_distance_predicate_combines_with_other_filters(double radius, int[] expected)
    {
        await factory.WithDbAsync(async db =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync();
            var expensive = Venue(9004, 41.6226);
            expensive.MinSpend = expensive.MaxSpend = 20m;
            var wrongCategory = Venue(9006, 41.6226);
            wrongCategory.Category = VenueCategory.Bar;
            var inactive = Venue(9007, 41.6226);
            inactive.IsActive = false;
            var closed = Venue(9008, 41.6226);
            closed.OpeningHours.Clear();
            db.Venues.AddRange(Venue(9001, 41.6176), Venue(9002, 41.6226), Venue(9003, 41.6376),
                expensive, Venue(9005, 41.7176), wrongCategory, inactive, closed);
            await db.SaveChangesAsync();
            db.ChangeTracker.Clear();
            var preferences = new NightPreferencesDto(
                10m, 4, [Activity.Dinner],
                new DateTimeOffset(2026, 10, 30, 20, 0, 0, TimeSpan.Zero),
                new DateTimeOffset(2026, 10, 31, 2, 0, 0, TimeSpan.Zero),
                radius, [Transport.Walking]);

            var candidates = await new VenueFilteringService(db).FilterAsync(
                preferences, 41.6176, 0.62, CancellationToken.None);

            Assert.Equal(expected, candidates.Where(v => v.Id >= 9001).Select(v => v.Id));
            return 0;
        });
    }

    private static Venue Venue(int id, double latitude) => new()
    {
        Id = id, Name = $"Distance venue {id}", Address = "Test address",
        Category = VenueCategory.Restaurant, Latitude = latitude, Longitude = 0.62,
        MinSpend = 5m, MaxSpend = 5m, EntranceFee = 0m,
        OpeningHours = [new VenueOpeningHours
        {
            Day = DayOfWeek.Friday, Opens = new TimeOnly(18, 0), Closes = new TimeOnly(23, 0),
        }],
    };
}
