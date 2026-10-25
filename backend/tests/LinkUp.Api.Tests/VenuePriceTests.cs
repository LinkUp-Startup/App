using System.Globalization;
using LinkUp.Api.Data;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Data.Seed;
using LinkUp.Api.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace LinkUp.Api.Tests;

public sealed class VenuePriceTests : IAsyncLifetime
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private AppDbContext _db = null!;

    public async Task InitializeAsync()
    {
        await _connection.OpenAsync();
        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options);
        await _db.Database.EnsureCreatedAsync();
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    [Theory]
    [InlineData("10.25", "20.75", "15.50")]
    [InlineData("10.00", "10.01", "10.01")]
    [InlineData("5.55", "5.55", "5.55")]
    [InlineData("0", "0", "0")]
    [InlineData(null, null, null)]
    [InlineData("10", null, null)]
    [InlineData(null, "20", null)]
    public void Estimate_is_a_cent_rounded_range_midpoint_or_unknown(
        string? minimum, string? maximum, string? expected)
    {
        var venue = NewVenue(1);
        venue.MinSpend = Money(minimum);
        venue.MaxSpend = Money(maximum);
        venue.EntranceFee = 7.50m;

        Assert.Equal(Money(expected), venue.EstimatedSpendPerPerson);
        Assert.Equal("EUR", venue.Currency);
        // This is consumption only: admission is preserved separately, not added to the estimate.
        Assert.Equal(7.50m, venue.EntranceFee);
    }

    [Theory]
    [InlineData("4.25", "10.25", "20.75", 2, "15.50")]
    [InlineData("0", "0", "0", 1, "0")]
    [InlineData(null, null, null, null, null)]
    [InlineData(null, "10.25", null, null, null)]
    [InlineData(null, null, "20.75", 2, null)]
    public async Task Persistence_and_details_mapping_preserve_prices_and_unknowns(
        string? fee, string? minimum, string? maximum, int? level, string? expected)
    {
        var venue = NewVenue(1);
        venue.EntranceFee = Money(fee);
        venue.MinSpend = Money(minimum);
        venue.MaxSpend = Money(maximum);
        venue.PriceLevel = level;
        venue.EntranceType = fee is null ? EntranceType.Unverified : EntranceType.Paid;
        _db.Venues.Add(venue);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var stored = await _db.Venues.AsNoTracking().SingleAsync();
        Assert.Equal(Money(fee), stored.EntranceFee);
        Assert.Equal(Money(minimum), stored.MinSpend);
        Assert.Equal(Money(maximum), stored.MaxSpend);
        Assert.Equal(level, stored.PriceLevel);
        Assert.Equal(Money(expected), stored.EstimatedSpendPerPerson);

        var dto = await new VenueService(_db).GetByIdAsync(1, CancellationToken.None);
        Assert.NotNull(dto);
        Assert.Equal(stored.EntranceType, dto.EntranceType);
        Assert.Equal(stored.EntranceFee, dto.EntranceFee);
        Assert.Equal(stored.MinSpend, dto.MinSpend);
        Assert.Equal(stored.MaxSpend, dto.MaxSpend);
        Assert.Equal(level, dto.PriceLevel);
        Assert.Equal(Money(expected), dto.EstimatedSpendPerPerson);
        Assert.Equal("EUR", dto.Currency);
        Assert.Equal("Venue 1", dto.Name);
        Assert.True(dto.IsActive);
        Assert.Single(dto.OpeningHours);
        Assert.Empty(_db.ChangeTracker.Entries());
    }

    [Theory]
    [InlineData("-0.01", null, null, null, "CK_Venues_EntranceFee")]
    [InlineData(null, "-0.01", null, null, "CK_Venues_MinSpend")]
    [InlineData(null, null, "-0.01", null, "CK_Venues_MaxSpend")]
    [InlineData(null, "20", "10", null, "CK_Venues_SpendRange")]
    [InlineData(null, null, null, 0, "CK_Venues_PriceLevel")]
    [InlineData(null, null, null, 5, "CK_Venues_PriceLevel")]
    public async Task Database_rejects_invalid_prices_ranges_and_levels(
        string? fee, string? minimum, string? maximum, int? level, string constraint)
    {
        var venue = NewVenue(1);
        venue.EntranceFee = Money(fee);
        venue.MinSpend = Money(minimum);
        venue.MaxSpend = Money(maximum);
        venue.PriceLevel = level;
        _db.Venues.Add(venue);

        var error = await Assert.ThrowsAsync<DbUpdateException>(() => _db.SaveChangesAsync());

        var sqlite = Assert.IsType<SqliteException>(error.InnerException);
        Assert.Equal(19, sqlite.SqliteErrorCode); // SQLITE_CONSTRAINT
        Assert.Contains(constraint, sqlite.Message);
    }

    [Fact]
    public async Task List_mapping_preserves_known_and_unknown_prices_and_existing_venue_details()
    {
        var known = NewVenue(2);
        known.MinSpend = 10m;
        known.MaxSpend = 20m;
        known.PriceLevel = 2;
        _db.Venues.AddRange(known, NewVenue(1));
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var results = await new VenueService(_db).GetAllAsync(CancellationToken.None);

        Assert.Equal(new[] { 1, 2 }, results.Select(v => v.Id));
        Assert.Null(results[0].EstimatedSpendPerPerson);
        Assert.Null(results[0].PriceLevel);
        Assert.Equal(15m, results[1].EstimatedSpendPerPerson);
        Assert.Equal(2, results[1].PriceLevel);
        Assert.All(results, dto =>
        {
            Assert.Equal("EUR", dto.Currency);
            Assert.Equal("Test address", dto.Address);
            Assert.Single(dto.OpeningHours);
        });
    }

    [Fact]
    public void PostgreSQL_model_uses_nullable_decimal_money_and_no_duplicate_estimate_columns()
    {
        using var db = PostgreSQLContext();
        var venue = db.Model.FindEntityType(typeof(Venue))!;
        foreach (var name in new[] { nameof(Venue.EntranceFee), nameof(Venue.MinSpend), nameof(Venue.MaxSpend) })
        {
            var property = venue.FindProperty(name)!;
            Assert.Equal(typeof(decimal?), property.ClrType);
            Assert.True(property.IsNullable);
            Assert.Equal(8, property.GetPrecision());
            Assert.Equal(2, property.GetScale());
            Assert.Equal("numeric(8,2)", property.GetColumnType());
        }
        Assert.True(venue.FindProperty(nameof(Venue.PriceLevel))!.IsNullable);
        Assert.Null(venue.FindProperty(nameof(Venue.EstimatedSpendPerPerson)));
        Assert.Null(venue.FindProperty(nameof(Venue.Currency)));
    }

    [Fact]
    public void PostgreSQL_migration_preserves_existing_values_and_adds_price_validation()
    {
        using var db = PostgreSQLContext();
        var latest = db.Database.GetMigrations().Last();
        Assert.EndsWith("DefineVenuePriceModel", latest);

        var script = db.GetService<IMigrator>().GenerateScript("20261024172225_AddUser", latest);

        Assert.Contains("ALTER COLUMN \"PriceLevel\" DROP NOT NULL", script);
        Assert.Contains("ADD CONSTRAINT \"CK_Venues_MinSpend\"", script);
        Assert.Contains("ADD CONSTRAINT \"CK_Venues_MaxSpend\"", script);
        Assert.DoesNotContain("DROP COLUMN", script);
        Assert.DoesNotContain("UPDATE \"Venues\"", script);
        var rollback = db.GetService<IMigrator>().GenerateScript(latest, "20261024172225_AddUser");
        Assert.Contains("ALTER COLUMN \"PriceLevel\" SET NOT NULL", rollback);
        Assert.DoesNotContain("UPDATE \"Venues\"", rollback);
    }

    [Fact]
    public void Existing_dataset_keeps_its_prices_and_uses_the_new_representation()
    {
        var venues = VenueSeedData.Load();

        Assert.All(venues, venue =>
        {
            Assert.Equal("EUR", venue.Currency);
            Assert.True(venue.MinSpend >= 0m);
            Assert.True(venue.MaxSpend >= venue.MinSpend);
            Assert.NotNull(venue.EstimatedSpendPerPerson);
        });
        var legend = venues.Single(v => v.Name == "Pub Legend");
        Assert.Equal(5.50m, legend.EstimatedSpendPerPerson);
        Assert.Equal(1, legend.PriceLevel);
    }

    [Theory]
    [InlineData("10.00", 1)]
    [InlineData("10.01", 2)]
    [InlineData("20.00", 2)]
    [InlineData("20.01", 3)]
    [InlineData("35.00", 3)]
    [InlineData("35.01", 4)]
    public void Price_levels_preserve_existing_exact_boundaries(string amount, int expected)
    {
        var spend = Money(amount)!.Value;

        Assert.Equal(expected, VenueSeedData.PriceLevelFor(spend, spend));
    }

    private static AppDbContext PostgreSQLContext() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseNpgsql("Host=localhost;Database=unused").Options);

    private static decimal? Money(string? value) => value is null
        ? null : decimal.Parse(value, CultureInfo.InvariantCulture);

    private static Venue NewVenue(int id) => new()
    {
        Id = id,
        Name = $"Venue {id}",
        Address = "Test address",
        OpeningHours = [new VenueOpeningHours
        {
            Day = DayOfWeek.Monday, Opens = new TimeOnly(18, 0), Closes = new TimeOnly(23, 0),
        }],
    };
}
