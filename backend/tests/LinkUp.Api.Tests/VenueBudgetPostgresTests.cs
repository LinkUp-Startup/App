using System.Globalization;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using LinkUp.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace LinkUp.Api.Tests;

// Verify the production provider's decimal expressions against a real database in CI.
public sealed class VenueBudgetPostgresTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>
{
    [Theory]
    [InlineData("0", new[] { 9003, 9004 })]
    [InlineData("11.25", new[] { 9003, 9004 })]
    [InlineData("11.26", new[] { 9001, 9002, 9003, 9004 })]
    [InlineData("19.75", new[] { 9001, 9002, 9003, 9004, 9005 })]
    public async Task Native_numeric_budget_predicate_matches_the_price_model(string amount, int[] expected)
    {
        var budget = decimal.Parse(amount, CultureInfo.InvariantCulture);
        await factory.WithDbAsync(async db =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync();
            db.Venues.AddRange(
                Venue(9001, 10m, 10.01m, 1.25m),
                Venue(9002, null, null, 11.26m),
                Venue(9003, null, null, null),
                Venue(9004, 0m, 0m, 0m),
                Venue(9005, 10.25m, 20.75m, 4.25m));
            await db.SaveChangesAsync();
            db.ChangeTracker.Clear();
            var preferences = new NightPreferencesDto(
                budget, 4, [Activity.Dinner],
                new DateTimeOffset(2026, 10, 30, 20, 0, 0, TimeSpan.Zero),
                new DateTimeOffset(2026, 10, 31, 2, 0, 0, TimeSpan.Zero),
                3, [Transport.Walking]);

            var candidates = await new VenueFilteringService(db).FilterAsync(preferences, CancellationToken.None);

            Assert.Equal(expected, candidates.Where(v => v.Id >= 9001).Select(v => v.Id));
            Assert.All(candidates.Where(v => v.EstimatedSpendPerPerson.HasValue && v.EntranceFee.HasValue),
                v => Assert.True(v.EstimatedSpendPerPerson + v.EntranceFee <= budget));
            return 0;
        });
    }

    private static Venue Venue(int id, decimal? minimum, decimal? maximum, decimal? fee) => new()
    {
        Id = id, Name = $"Budget venue {id}", Address = "Test address",
        Category = VenueCategory.Restaurant, MinSpend = minimum, MaxSpend = maximum, EntranceFee = fee,
        OpeningHours = [new VenueOpeningHours
        {
            Day = DayOfWeek.Friday, Opens = new TimeOnly(18, 0), Closes = new TimeOnly(23, 0),
        }],
    };
}
