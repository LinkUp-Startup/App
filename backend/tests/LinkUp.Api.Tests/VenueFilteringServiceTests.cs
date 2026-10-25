using System.Data.Common;
using LinkUp.Api.Data;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using LinkUp.Api.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;

namespace LinkUp.Api.Tests;

public sealed class VenueFilteringServiceTests : IAsyncLifetime
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly QueryCapture _queries = new();
    private AppDbContext _db = null!;

    private static readonly NightPreferencesDto Preferences = new(
        30m, 4, [Activity.Dinner],
        new DateTimeOffset(2026, 10, 24, 18, 0, 0, TimeSpan.Zero),
        new DateTimeOffset(2026, 10, 24, 23, 0, 0, TimeSpan.Zero),
        5, [Transport.Walking]);

    public async Task InitializeAsync()
    {
        await _connection.OpenAsync();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .AddInterceptors(_queries)
            .Options;
        _db = new AppDbContext(options);
        await _db.Database.EnsureCreatedAsync();
        _queries.Commands.Clear();
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    [Fact]
    public async Task Returns_only_active_venues_ordered_by_id_with_opening_hours_in_one_read_only_query()
    {
        var later = Venue(30);
        later.OpeningHours.Add(new VenueOpeningHours
        {
            Day = DayOfWeek.Friday,
            Opens = new TimeOnly(18, 0),
            Closes = new TimeOnly(3, 0),
        });
        later.OpeningHours.Add(new VenueOpeningHours
        {
            Day = DayOfWeek.Saturday,
            Opens = new TimeOnly(19, 0),
            Closes = new TimeOnly(4, 0),
        });
        var earlier = Venue(10);
        earlier.OpeningHours.Add(Slot(DayOfWeek.Saturday, "18:00", "23:00"));
        var inactive = Venue(20, active: false);
        inactive.OpeningHours.Add(Slot(DayOfWeek.Saturday, "18:00", "23:00"));
        await SeedAsync(later, inactive, earlier);

        var result = await new VenueFilteringService(_db).FilterAsync(Preferences, CancellationToken.None);

        Assert.Equal(new[] { 10, 30 }, result.Select(v => v.Id));
        Assert.All(result, v => Assert.True(v.IsActive));
        Assert.Single(result[0].OpeningHours);
        var hours = result[1].OpeningHours.OrderBy(h => h.Day).ToList();
        Assert.Equal(2, hours.Count);
        Assert.Equal(DayOfWeek.Friday, hours[0].Day);
        Assert.Equal(new TimeOnly(18, 0), hours[0].Opens);
        Assert.Equal(new TimeOnly(3, 0), hours[0].Closes);
        Assert.Equal(DayOfWeek.Saturday, hours[1].Day);
        Assert.Equal(new TimeOnly(19, 0), hours[1].Opens);
        Assert.Equal(new TimeOnly(4, 0), hours[1].Closes);
        Assert.Empty(_db.ChangeTracker.Entries());
        var sql = Assert.Single(_queries.Commands);
        Assert.Contains("WHERE", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("IsActive", sql, StringComparison.Ordinal);
        Assert.Contains("EXISTS", sql, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    // Monday daytime: full coverage, closed, opens/closes within availability, exact boundaries.
    [InlineData("2026-10-26T18:00:00+01:00", "2026-10-26T22:00:00+01:00", DayOfWeek.Monday, "17:00", "23:00", true)]
    [InlineData("2026-10-26T18:00:00+01:00", "2026-10-26T22:00:00+01:00", DayOfWeek.Monday, "10:00", "16:00", false)]
    [InlineData("2026-10-26T18:00:00+01:00", "2026-10-26T22:00:00+01:00", DayOfWeek.Monday, "20:00", "23:00", true)]
    [InlineData("2026-10-26T18:00:00+01:00", "2026-10-26T22:00:00+01:00", DayOfWeek.Monday, "17:00", "20:00", true)]
    [InlineData("2026-10-26T18:00:00+01:00", "2026-10-26T22:00:00+01:00", DayOfWeek.Monday, "19:00", "21:00", true)]
    [InlineData("2026-10-26T18:00:00+01:00", "2026-10-26T22:00:00+01:00", DayOfWeek.Monday, "18:00", "22:00", true)]
    [InlineData("2026-10-26T18:00:00+01:00", "2026-10-26T22:00:00+01:00", DayOfWeek.Monday, "10:00", "18:00", false)]
    [InlineData("2026-10-26T18:00:00+01:00", "2026-10-26T22:00:00+01:00", DayOfWeek.Monday, "22:00", "23:00", false)]
    // Overnight and previous-day slots, including Sunday-to-Monday wrapping.
    [InlineData("2026-10-26T23:00:00+01:00", "2026-10-27T01:00:00+01:00", DayOfWeek.Monday, "20:00", "02:00", true)]
    [InlineData("2026-10-27T01:00:00+01:00", "2026-10-27T03:00:00+01:00", DayOfWeek.Monday, "20:00", "02:00", true)]
    [InlineData("2026-10-27T02:00:00+01:00", "2026-10-27T03:00:00+01:00", DayOfWeek.Monday, "20:00", "02:00", false)]
    [InlineData("2026-10-26T18:00:00+01:00", "2026-10-26T20:00:00+01:00", DayOfWeek.Monday, "20:00", "02:00", false)]
    [InlineData("2026-10-26T01:00:00+01:00", "2026-10-26T03:00:00+01:00", DayOfWeek.Sunday, "20:00", "02:00", true)]
    [InlineData("2026-10-26T23:00:00+01:00", "2026-10-27T02:00:00+01:00", DayOfWeek.Tuesday, "01:00", "04:00", true)]
    [InlineData("2026-10-26T23:00:00+01:00", "2026-10-27T02:00:00+01:00", DayOfWeek.Monday, "22:00", "00:00", true)]
    [InlineData("2026-10-27T00:00:00+01:00", "2026-10-27T02:00:00+01:00", DayOfWeek.Monday, "22:00", "00:00", false)]
    // Wrong weekday and equal opening/closing times (a 24-hour slot per the entity convention).
    [InlineData("2026-10-26T18:00:00+01:00", "2026-10-26T22:00:00+01:00", DayOfWeek.Tuesday, "17:00", "23:00", false)]
    [InlineData("2026-10-26T18:00:00+01:00", "2026-10-26T22:00:00+01:00", DayOfWeek.Monday, "00:00", "00:00", true)]
    // UTC and arbitrary input offsets are converted to Madrid, in summer and winter.
    [InlineData("2026-10-24T18:00:00Z", "2026-10-24T19:00:00Z", DayOfWeek.Saturday, "20:00", "21:00", true)]
    [InlineData("2026-10-26T18:00:00Z", "2026-10-26T19:00:00Z", DayOfWeek.Monday, "20:00", "21:00", false)]
    [InlineData("2026-10-26T14:00:00-04:00", "2026-10-26T15:00:00-04:00", DayOfWeek.Monday, "19:00", "20:00", true)]
    // Availability across the autumn daylight-saving change.
    [InlineData("2026-10-25T00:00:00Z", "2026-10-25T03:00:00Z", DayOfWeek.Saturday, "20:00", "03:00", true)]
    [InlineData("2026-10-25T02:45:00+02:00", "2026-10-25T02:15:00+01:00", DayOfWeek.Sunday, "02:00", "02:10", true)]
    [InlineData("2026-10-25T02:45:00+02:00", "2026-10-25T02:15:00+01:00", DayOfWeek.Sunday, "02:20", "02:40", false)]
    [InlineData("2026-10-25T02:00:00+02:00", "2026-10-25T02:00:00+01:00", DayOfWeek.Sunday, "02:15", "02:45", true)]
    // Spring-forward: nonexistent local times must not create a false overlap.
    [InlineData("2026-03-29T00:00:00Z", "2026-03-29T02:00:00Z", DayOfWeek.Sunday, "02:10", "02:50", false)]
    [InlineData("2026-03-29T00:00:00Z", "2026-03-29T02:00:00Z", DayOfWeek.Sunday, "03:10", "03:50", true)]
    public async Task Filters_by_positive_overlap_in_Madrid_time(
        string start, string end, DayOfWeek day, string opens, string closes, bool expected)
    {
        var venue = Venue(1);
        venue.OpeningHours.Add(Slot(day, opens, closes));
        await SeedAsync(venue);
        var preferences = Preferences with
        {
            StartTime = DateTimeOffset.Parse(start),
            EndTime = DateTimeOffset.Parse(end),
        };

        var result = await new VenueFilteringService(_db).FilterAsync(preferences, CancellationToken.None);

        Assert.Equal(expected ? new[] { 1 } : Array.Empty<int>(), result.Select(v => v.Id));
        Assert.Single(_queries.Commands);
    }

    [Fact]
    public async Task Excludes_missing_hours_and_split_shift_gaps_and_uses_the_correct_weekday()
    {
        var split = Venue(1);
        split.OpeningHours.Add(Slot(DayOfWeek.Saturday, "12:00", "16:00"));
        split.OpeningHours.Add(Slot(DayOfWeek.Saturday, "22:00", "23:00"));
        var matching = Venue(2);
        matching.OpeningHours.Add(Slot(DayOfWeek.Friday, "08:00", "10:00"));
        matching.OpeningHours.Add(Slot(DayOfWeek.Saturday, "20:00", "21:00"));
        await SeedAsync(split, matching, Venue(3));

        var result = await new VenueFilteringService(_db).FilterAsync(
            Preferences with { EndTime = Preferences.StartTime.AddHours(2) }, CancellationToken.None);

        Assert.Equal(new[] { 2 }, result.Select(v => v.Id));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task Rejects_non_positive_availability_without_querying(int hours)
    {
        var preferences = Preferences with { EndTime = Preferences.StartTime.AddHours(hours) };

        var error = await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() =>
            new VenueFilteringService(_db).FilterAsync(preferences, CancellationToken.None));

        Assert.Equal("end", error.ParamName);
        Assert.Empty(_queries.Commands);
    }

    private static VenueOpeningHours Slot(DayOfWeek day, string opens, string closes) => new()
    {
        Day = day,
        Opens = TimeOnly.Parse(opens),
        Closes = TimeOnly.Parse(closes),
    };

    [Fact]
    public void Opening_hours_predicate_translates_with_the_production_PostgreSQL_provider()
    {
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=unused").Options);

        var sql = db.Venues.Where(v => v.IsActive)
            .OpenDuring(Preferences.StartTime, Preferences.EndTime)
            .Include(v => v.OpeningHours).AsSingleQuery().ToQueryString();

        Assert.Contains("EXISTS", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Opens", sql, StringComparison.Ordinal);
        Assert.Contains("Closes", sql, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Returns_empty_when_database_is_empty_or_all_venues_are_inactive(bool seedInactive)
    {
        if (seedInactive)
            await SeedAsync(Venue(1, active: false), Venue(2, active: false));

        var result = await new VenueFilteringService(_db).FilterAsync(Preferences, CancellationToken.None);

        Assert.Empty(result);
        Assert.Single(_queries.Commands);
    }

    [Fact]
    public async Task Rejects_null_preferences_without_querying_database()
    {
        var error = await Assert.ThrowsAsync<ArgumentNullException>(() =>
            new VenueFilteringService(_db).FilterAsync(null!, CancellationToken.None));

        Assert.Equal("preferences", error.ParamName);
        Assert.Empty(_queries.Commands);
    }

    [Fact]
    public async Task Honors_cancelled_database_operation()
    {
        await SeedAsync(Venue(1));
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            new VenueFilteringService(_db).FilterAsync(Preferences, cancellation.Token));

        Assert.Empty(_db.ChangeTracker.Entries());
    }

    [Fact]
    public void Registered_service_resolves_with_scoped_lifetime()
    {
        using var factory = new ApiFactory();
        using var firstScope = factory.Services.CreateScope();
        using var secondScope = factory.Services.CreateScope();

        var first = firstScope.ServiceProvider.GetRequiredService<IVenueFilteringService>();

        Assert.IsType<VenueFilteringService>(first);
        Assert.Same(first, firstScope.ServiceProvider.GetRequiredService<IVenueFilteringService>());
        Assert.NotSame(first, secondScope.ServiceProvider.GetRequiredService<IVenueFilteringService>());
    }

    private async Task SeedAsync(params Venue[] venues)
    {
        _db.Venues.AddRange(venues);
        await _db.SaveChangesAsync();
        // Force the service to load persisted data, including navigation properties.
        _db.ChangeTracker.Clear();
        _queries.Commands.Clear();
    }

    private static Venue Venue(int id, bool active = true) => new()
    {
        Id = id,
        Name = $"Venue {id}",
        Address = $"Address {id}",
        PriceLevel = 1,
        IsActive = active,
    };

    private sealed class QueryCapture : DbCommandInterceptor
    {
        public List<string> Commands { get; } = [];

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            Commands.Add(command.CommandText);
            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }
    }
}
