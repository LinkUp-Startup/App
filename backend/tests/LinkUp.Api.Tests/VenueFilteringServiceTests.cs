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
        await SeedAsync(later, Venue(20, active: false), Venue(10));

        var result = await new VenueFilteringService(_db).FilterAsync(Preferences, CancellationToken.None);

        Assert.Equal(new[] { 10, 30 }, result.Select(v => v.Id));
        Assert.All(result, v => Assert.True(v.IsActive));
        Assert.Empty(result[0].OpeningHours);
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
