using System.Data.Common;
using LinkUp.Api.Data;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using LinkUp.Api.Geo;
using LinkUp.Api.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace LinkUp.Api.Tests;

public sealed class VenueFilteringCombinationTests : IAsyncLifetime
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly QueryCounter _queries = new();
    private AppDbContext _db = null!;

    public static IEnumerable<object[]> Combinations => VenueFilteringScenarios.Combinations.Select(c => new object[] { c });

    public async Task InitializeAsync()
    {
        await _connection.OpenAsync();
        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection).AddInterceptors(_queries).Options);
        await _db.Database.EnsureCreatedAsync();
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    [Theory]
    [MemberData(nameof(Combinations))]
    public async Task Every_pair_triple_and_all_four_filters_return_exactly_the_intersection(
        FilteringConstraints constraints)
    {
        await SeedAsync();

        var result = await FilterAsync(VenueFilteringScenarios.Preferences(constraints));

        Assert.Equal(VenueFilteringScenarios.ExpectedIds(constraints), result.Select(v => v.Id));
    }

    [Fact]
    public async Task Combined_results_equal_the_intersection_of_independently_filtered_candidate_sets()
    {
        await SeedAsync();
        var baseline = await FilterAsync(VenueFilteringScenarios.Preferences(FilteringConstraints.None));
        Assert.Equal(Enumerable.Range(1, 16), baseline.Select(v => v.Id));
        var intersection = baseline.Select(v => v.Id).ToHashSet();
        foreach (var constraint in VenueFilteringScenarios.IndividualConstraints)
        {
            var individual = await FilterAsync(VenueFilteringScenarios.Preferences(constraint));
            Assert.Equal(VenueFilteringScenarios.ExpectedIds(constraint), individual.Select(v => v.Id));
            intersection.IntersectWith(individual.Select(v => v.Id));
        }

        var combined = await FilterAsync(VenueFilteringScenarios.Preferences(FilteringConstraints.All));

        Assert.Equal(new[] { 1 }, intersection.Order());
        Assert.Equal(intersection.Order(), combined.Select(v => v.Id));
    }

    [Theory]
    [InlineData(FilteringConstraints.Budget)]
    [InlineData(FilteringConstraints.Distance)]
    [InlineData(FilteringConstraints.OpeningHours)]
    [InlineData(FilteringConstraints.Category)]
    public async Task Relaxing_one_preference_keeps_the_other_filters_and_tightening_cannot_add_venues(
        FilteringConstraints relaxed)
    {
        await SeedAsync();
        var strictPreferences = VenueFilteringScenarios.Preferences(FilteringConstraints.All);

        var strict = await FilterAsync(strictPreferences);
        var broader = await FilterAsync(VenueFilteringScenarios.Preferences(FilteringConstraints.All & ~relaxed));
        var strictAgain = await FilterAsync(strictPreferences);

        Assert.Equal(new[] { 1 }, strict.Select(v => v.Id));
        Assert.Equal(new[] { 1, 1 + (int)relaxed }, broader.Select(v => v.Id));
        Assert.Equal(strict.Select(v => v.Id), strictAgain.Select(v => v.Id));
    }

    [Theory]
    [InlineData(1, new[] { Transport.Car }, true)]
    [InlineData(20, new[] { Transport.Walking, Transport.Bike }, true)]
    [InlineData(4, new[] { Transport.Taxi, Transport.Car }, true)]
    [InlineData(4, new[] { (Transport)999, Transport.Bike }, true)]
    [InlineData(20, new Transport[] { }, false)]
    [InlineData(4, null, false)]
    [InlineData(4, new[] { (Transport)999 }, false)]
    public async Task All_primary_filters_remain_active_with_transport_and_unknown_group_capacity(
        int groupSize, Transport[]? transport, bool supported)
    {
        await SeedAsync();
        var preferences = VenueFilteringScenarios.Preferences(FilteringConstraints.All) with
        {
            GroupSize = groupSize,
            Transport = transport!,
        };

        var result = await FilterAsync(preferences);

        Assert.Equal(supported ? new[] { 1 } : Array.Empty<int>(), result.Select(v => v.Id));
    }

    [Fact]
    public async Task Omitting_the_origin_removes_only_the_distance_constraint()
    {
        await SeedAsync();
        var preferences = VenueFilteringScenarios.Preferences(FilteringConstraints.All);

        var withOrigin = await FilterAsync(preferences);
        var withoutOrigin = await FilterAsync(preferences, withOrigin: false);

        Assert.Equal(new[] { 1 }, withOrigin.Select(v => v.Id));
        Assert.Equal(new[] { 1, 3 }, withoutOrigin.Select(v => v.Id));
    }

    [Theory]
    [InlineData("2026-11-06T23:00:00+01:00", "2026-11-07T01:00:00+01:00", 5)]
    [InlineData("2026-11-06T23:30:00+01:00", "2026-11-07T01:30:00+01:00", 5)]
    [InlineData("2026-11-07T02:00:00+01:00", "2026-11-07T03:00:00+01:00", 0)]
    public async Task Overnight_windows_and_exact_budget_distance_boundaries_compose(
        string start, string end, int expectedId)
    {
        await SeedAsync();
        var preferences = VenueFilteringScenarios.Preferences(FilteringConstraints.All) with
        {
            StartTime = DateTimeOffset.Parse(start),
            EndTime = DateTimeOffset.Parse(end),
            MaxDistanceKm = GeoDistance.HaversineKm(VenueFilteringScenarios.StartLatitude,
                VenueFilteringScenarios.StartLongitude, VenueFilteringScenarios.StartLatitude + 0.005,
                VenueFilteringScenarios.StartLongitude),
        };

        var result = await FilterAsync(preferences);

        Assert.Equal(expectedId == 0 ? Array.Empty<int>() : new[] { expectedId }, result.Select(v => v.Id));
    }

    [Fact]
    public async Task Unknown_prices_do_not_disable_distance_hours_or_category_filters()
    {
        var venues = VenueFilteringScenarios.Venues();
        foreach (var venue in venues.Where(v => new[] { 2, 3, 5, 9 }.Contains(v.Id)))
            venue.MinSpend = venue.MaxSpend = venue.EntranceFee = null;
        await SeedAsync(venues);

        var result = await FilterAsync(VenueFilteringScenarios.Preferences(FilteringConstraints.All) with
        {
            BudgetPerPerson = 0m,
        });

        Assert.Equal(new[] { 2 }, result.Select(v => v.Id));
        Assert.Null(result[0].EstimatedSpendPerPerson);
    }

    [Fact]
    public async Task No_candidates_are_returned_when_the_only_full_match_is_inactive()
    {
        var venues = VenueFilteringScenarios.Venues();
        venues.Single(v => v.Id == 1).IsActive = false;
        await SeedAsync(venues);

        var result = await FilterAsync(VenueFilteringScenarios.Preferences(FilteringConstraints.All));

        Assert.Empty(result);
    }

    private async Task SeedAsync(Venue[]? venues = null)
    {
        _db.Venues.AddRange(venues ?? VenueFilteringScenarios.Venues());
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();
    }

    private async Task<IReadOnlyList<Venue>> FilterAsync(NightPreferencesDto preferences, bool withOrigin = true)
    {
        var reads = _queries.Reads;
        IVenueFilteringService service = new VenueFilteringService(_db);
        var result = withOrigin
            ? await service.FilterAsync(preferences, VenueFilteringScenarios.StartLatitude,
                VenueFilteringScenarios.StartLongitude, CancellationToken.None)
            : await service.FilterAsync(preferences, CancellationToken.None);
        Assert.Equal(reads + 1, _queries.Reads);
        Assert.Empty(_db.ChangeTracker.Entries());
        return result;
    }

    private sealed class QueryCounter : DbCommandInterceptor
    {
        public int Reads { get; private set; }
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            Reads++;
            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }
    }
}
