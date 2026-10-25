using System.Data.Common;
using System.Globalization;
using LinkUp.Api.Data;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using LinkUp.Api.Geo;
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
    [InlineData(Activity.Dinner, new[] { VenueCategory.Restaurant, VenueCategory.BarRestaurant })]
    [InlineData(Activity.Drinks, new[]
    {
        VenueCategory.Bar, VenueCategory.Pub, VenueCategory.BarRestaurant,
        VenueCategory.Cafe, VenueCategory.BakeryCafe,
    })]
    [InlineData(Activity.Club, new[] { VenueCategory.Nightclub })]
    [InlineData(Activity.Concert, new VenueCategory[] { })]
    [InlineData(Activity.Cinema, new VenueCategory[] { })]
    [InlineData(Activity.Games, new VenueCategory[] { })]
    [InlineData(Activity.Outdoor, new VenueCategory[] { })]
    [InlineData((Activity)999, new VenueCategory[] { })]
    public async Task Matches_only_categories_supporting_the_selected_activity(
        Activity activity, VenueCategory[] expected)
    {
        var venues = Enum.GetValues<VenueCategory>()
            .Select(category => OpenVenue((int)category + 1, category)).ToArray();
        await SeedAsync(venues);

        var result = await new VenueFilteringService(_db).FilterAsync(
            Preferences with { Activities = [activity] }, CancellationToken.None);

        Assert.Equal(expected.OrderBy(c => c), result.Select(v => v.Category));
        Assert.Single(_queries.Commands);
        Assert.Empty(_db.ChangeTracker.Entries());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Combines_activities_with_OR_and_returns_compound_categories_once(bool duplicates)
    {
        await SeedAsync(
            OpenVenue(1, VenueCategory.Restaurant), OpenVenue(2, VenueCategory.BarRestaurant),
            OpenVenue(3, VenueCategory.Pub), OpenVenue(4, VenueCategory.Nightclub));
        Activity[] activities = duplicates
            ? [Activity.Dinner, Activity.Drinks, Activity.Dinner, Activity.Drinks]
            : [Activity.Dinner, Activity.Drinks];

        var result = await new VenueFilteringService(_db).FilterAsync(
            Preferences with { Activities = activities }, CancellationToken.None);

        Assert.Equal(new[] { 1, 2, 3 }, result.Select(v => v.Id));
        Assert.Single(result, v => v.Category == VenueCategory.BarRestaurant);
        Assert.Single(_queries.Commands);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Empty_or_missing_activities_return_no_candidates(bool missing)
    {
        await SeedAsync(OpenVenue(1, VenueCategory.Restaurant));

        var result = await new VenueFilteringService(_db).FilterAsync(
            Preferences with { Activities = missing ? null! : [] }, CancellationToken.None);

        Assert.Empty(result);
    }

    [Theory]
    [InlineData(Activity.Dinner, VenueCategory.Bar)]
    [InlineData(Activity.Club, VenueCategory.Restaurant)]
    public async Task Returns_no_candidates_when_open_venues_do_not_match_activity(
        Activity activity, VenueCategory category)
    {
        await SeedAsync(OpenVenue(1, category));

        var result = await new VenueFilteringService(_db).FilterAsync(
            Preferences with { Activities = [activity] }, CancellationToken.None);

        Assert.Empty(result);
        Assert.Single(_queries.Commands);
    }

    [Theory]
    [InlineData("999")]
    [InlineData("Unrecognized category")]
    [InlineData("")]
    public async Task Unrecognized_stored_categories_are_filtered_out_before_materialization(string category)
    {
        await SeedAsync(OpenVenue(1, VenueCategory.Restaurant), OpenVenue(2, VenueCategory.Restaurant));
        // Exercise malformed stored text as well as undefined numeric enum values.
        await _db.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE \"Venues\" SET \"Category\" = {category} WHERE \"Id\" = 2");

        var result = await new VenueFilteringService(_db).FilterAsync(Preferences, CancellationToken.None);

        Assert.Equal(new[] { 1 }, result.Select(v => v.Id));
        Assert.Single(_queries.Commands);
    }

    [Fact]
    public async Task Category_matching_combines_with_opening_hours_and_active_status()
    {
        var closed = OpenVenue(3, VenueCategory.Restaurant);
        closed.OpeningHours.Clear();
        closed.OpeningHours.Add(Slot(DayOfWeek.Saturday, "08:00", "10:00"));
        var inactive = OpenVenue(4, VenueCategory.Restaurant);
        inactive.IsActive = false;
        var missingHours = Venue(6);
        await SeedAsync(
            OpenVenue(1, VenueCategory.Restaurant), OpenVenue(2, VenueCategory.Nightclub),
            closed, inactive, OpenVenue(5, VenueCategory.Bar), missingHours,
            OpenVenue(7, VenueCategory.Restaurant));

        var result = await new VenueFilteringService(_db).FilterAsync(
            Preferences with { Activities = [Activity.Dinner, Activity.Club, Activity.Concert] },
            CancellationToken.None);

        Assert.Equal(new[] { 1, 2, 7 }, result.Select(v => v.Id));
        Assert.Single(_queries.Commands);
        Assert.Empty(_db.ChangeTracker.Entries());
    }

    private static Venue OpenVenue(int id, VenueCategory category)
    {
        var venue = Venue(id);
        venue.Category = category;
        venue.OpeningHours.Add(Slot(DayOfWeek.Saturday, "18:00", "23:00"));
        return venue;
    }

    [Fact]
    public async Task Changing_max_distance_changes_candidates_monotonically_from_an_explicit_origin()
    {
        await SeedAsync(LocatedVenue(1, 41.6176, 0.62), LocatedVenue(2, 41.6226, 0.62),
            LocatedVenue(3, 41.6376, 0.62), LocatedVenue(4, 41.6676, 0.62));
        IVenueFilteringService service = new VenueFilteringService(_db);

        var medium = await service.FilterAsync(Preferences with { MaxDistanceKm = 3 },
            41.6176, 0.62, CancellationToken.None);
        var small = await service.FilterAsync(Preferences with { MaxDistanceKm = 1 },
            41.6176, 0.62, CancellationToken.None);
        var large = await service.FilterAsync(Preferences with { MaxDistanceKm = 10 },
            41.6176, 0.62, CancellationToken.None);

        Assert.Equal(new[] { 1, 2, 3 }, medium.Select(v => v.Id));
        Assert.Equal(new[] { 1, 2 }, small.Select(v => v.Id));
        Assert.Equal(new[] { 1, 2, 3, 4 }, large.Select(v => v.Id));
        Assert.Equal(3, _queries.Commands.Count);
        Assert.Empty(_db.ChangeTracker.Entries());
    }

    [Fact]
    public async Task Explicit_origins_change_results_and_missing_origin_preserves_existing_behavior()
    {
        await SeedAsync(LocatedVenue(1, 41.6176, 0.62), LocatedVenue(2, 48.8566, 2.3522));
        var preferences = Preferences with { MaxDistanceKm = 1 };
        IVenueFilteringService service = new VenueFilteringService(_db);

        var lleida = await service.FilterAsync(preferences, 41.6176, 0.62, CancellationToken.None);
        var paris = await service.FilterAsync(preferences, 48.8566, 2.3522, CancellationToken.None);
        var withoutOrigin = await service.FilterAsync(preferences, CancellationToken.None);

        Assert.Equal(new[] { 1 }, lleida.Select(v => v.Id));
        Assert.Equal(new[] { 2 }, paris.Select(v => v.Id));
        Assert.Equal(new[] { 1, 2 }, withoutOrigin.Select(v => v.Id));
        Assert.Equal(3, _queries.Commands.Count);
    }

    [Theory]
    [InlineData(-0.000001, false)]
    [InlineData(0, true)]
    [InlineData(0.000001, true)]
    public async Task Distance_boundary_uses_the_existing_Haversine_helper_and_is_inclusive(
        double adjustment, bool expected)
    {
        const double latitude = 41.6261973;
        const double longitude = 0.6226535;
        await SeedAsync(LocatedVenue(1, 41.6061111, 0.6225));
        var distance = GeoDistance.HaversineKm(latitude, longitude, 41.6061111, 0.6225);

        var result = await new VenueFilteringService(_db).FilterAsync(
            Preferences with { MaxDistanceKm = distance + adjustment }, latitude, longitude, CancellationToken.None);

        Assert.Equal(expected ? new[] { 1 } : Array.Empty<int>(), result.Select(v => v.Id));
        var sql = Assert.Single(_queries.Commands);
        Assert.Contains("asin", sql, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData(41.6176, 0.62)]
    [InlineData(0, 0)]
    public async Task Zero_radius_includes_a_venue_at_the_start_and_zero_coordinates_are_valid(
        double latitude, double longitude)
    {
        await SeedAsync(LocatedVenue(1, latitude, longitude), LocatedVenue(2, latitude + 0.01, longitude));

        var result = await new VenueFilteringService(_db).FilterAsync(
            Preferences with { MaxDistanceKm = 0 }, latitude, longitude, CancellationToken.None);

        Assert.Equal(new[] { 1 }, result.Select(v => v.Id));
        Assert.Single(_queries.Commands);
    }

    [Theory]
    [InlineData(91, 0)]
    [InlineData(-91, 0)]
    [InlineData(double.NaN, 0)]
    [InlineData(double.PositiveInfinity, 0)]
    [InlineData(double.NegativeInfinity, 0)]
    [InlineData(0, 181)]
    [InlineData(0, -181)]
    [InlineData(0, double.NaN)]
    [InlineData(0, double.PositiveInfinity)]
    [InlineData(0, double.NegativeInfinity)]
    public async Task Invalid_start_coordinates_are_rejected_before_querying(double latitude, double longitude)
    {
        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() => new VenueFilteringService(_db)
            .FilterAsync(Preferences, latitude, longitude, CancellationToken.None));

        Assert.Empty(_queries.Commands);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(double.NaN)]
    [InlineData(double.PositiveInfinity)]
    [InlineData(double.NegativeInfinity)]
    public async Task Invalid_max_distance_is_rejected_before_querying(double distance)
    {
        var error = await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() => new VenueFilteringService(_db)
            .FilterAsync(Preferences with { MaxDistanceKm = distance }, 41.6176, 0.62, CancellationToken.None));

        Assert.Equal("maxDistanceKm", error.ParamName);
        Assert.Empty(_queries.Commands);
    }

    [Theory]
    [InlineData(true, 1)]
    [InlineData(true, 0.1)]
    [InlineData(false, 1)]
    public async Task Distance_composes_with_budget_hours_category_active_status_and_transport(
        bool transport, double radius)
    {
        var match = LocatedVenue(1, 41.6226, 0.62);
        match.MinSpend = match.MaxSpend = 5m;
        match.EntranceFee = 0m;
        var expensive = LocatedVenue(2, 41.6226, 0.62);
        expensive.MinSpend = expensive.MaxSpend = 20m;
        var wrongCategory = LocatedVenue(3, 41.6226, 0.62);
        wrongCategory.Category = VenueCategory.Bar;
        var closed = LocatedVenue(4, 41.6226, 0.62);
        closed.OpeningHours.Clear();
        var inactive = LocatedVenue(5, 41.6226, 0.62);
        inactive.IsActive = false;
        var far = LocatedVenue(6, 41.7176, 0.62);
        await SeedAsync(match, expensive, wrongCategory, closed, inactive, far);

        var result = await new VenueFilteringService(_db).FilterAsync(Preferences with
        {
            BudgetPerPerson = 10m, GroupSize = 20, MaxDistanceKm = radius,
            Transport = transport ? [Transport.Car, Transport.Walking] : [],
        }, 41.6176, 0.62, CancellationToken.None);

        Assert.Equal(transport && radius == 1 ? new[] { 1 } : Array.Empty<int>(), result.Select(v => v.Id));
        Assert.Single(_queries.Commands);
    }

    [Fact]
    public async Task Date_line_crossing_uses_great_circle_distance_instead_of_longitude_difference()
    {
        await SeedAsync(LocatedVenue(1, 0, -179.9), LocatedVenue(2, 0, -170));

        var result = await new VenueFilteringService(_db).FilterAsync(
            Preferences with { MaxDistanceKm = 30 }, 0, 179.9, CancellationToken.None);

        Assert.Equal(new[] { 1 }, result.Select(v => v.Id));
    }

    [Fact]
    public void Distance_query_excludes_invalid_venue_coordinates_without_treating_them_as_the_origin()
    {
        var venues = new[]
        {
            LocatedVenue(1, 0, 0), LocatedVenue(2, 91, 0), LocatedVenue(3, 0, 181),
            LocatedVenue(4, double.NaN, 0), LocatedVenue(5, 0, double.NaN),
            LocatedVenue(6, double.PositiveInfinity, 0),
        };

        var result = venues.AsQueryable().WithinDistance(0, 0, 1).ToList();

        Assert.Equal(new[] { 1 }, result.Select(v => v.Id));
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Missing_venue_coordinates_cannot_be_persisted(bool latitude)
    {
        await SeedAsync(LocatedVenue(1, 41.6176, 0.62));
        var sql = latitude
            ? "UPDATE \"Venues\" SET \"Latitude\" = NULL WHERE \"Id\" = 1"
            : "UPDATE \"Venues\" SET \"Longitude\" = NULL WHERE \"Id\" = 1";

        var error = await Assert.ThrowsAsync<SqliteException>(() => _db.Database.ExecuteSqlRawAsync(sql));

        Assert.Equal(19, error.SqliteErrorCode);
        Assert.Contains("NOT NULL", error.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Distance_predicate_translates_with_the_production_PostgreSQL_provider()
    {
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=unused").Options);

        var sql = db.Venues.OpenDuring(Preferences.StartTime, Preferences.EndTime)
            .WithinBudget(30).WithinDistance(41.6176, 0.62, 5).ToQueryString();

        Assert.Contains("asin", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("cos", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("sin", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("EXISTS", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("COALESCE", sql, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("HaversineKm", sql, StringComparison.Ordinal);
    }

    private static Venue LocatedVenue(int id, double latitude, double longitude)
    {
        var venue = OpenVenue(id, VenueCategory.Restaurant);
        venue.Latitude = latitude;
        venue.Longitude = longitude;
        return venue;
    }

    [Theory]
    [InlineData("10.00", "10.00", "0", "11.00", true)]
    [InlineData("10.00", "10.00", "0", "10.00", true)]
    [InlineData("10.00", "10.00", "0", "9.99", false)]
    [InlineData("0", "0", "0", "0", true)]
    [InlineData("0.01", "0.01", "0", "0", false)]
    [InlineData("0", "0", "0.01", "0", false)]
    [InlineData("10.00", "10.01", "0", "10.00", false)]
    [InlineData("10.00", "10.01", "0", "10.01", true)]
    [InlineData("10.00", "10.01", "0", "10.005", false)]
    [InlineData("10.00", "10.00", "0", "9.999", false)]
    [InlineData("10.25", "20.75", "4.25", "19.75", true)]
    [InlineData("10.25", "20.75", "4.25", "19.74", false)]
    [InlineData("0", "0", "10.01", "10.00", false)]
    [InlineData(null, null, null, "0", true)]
    [InlineData("10", null, null, "0", true)]
    [InlineData(null, "20", null, "0", true)]
    [InlineData("10", "10", null, "9.99", false)]
    [InlineData("10", "10", null, "10", true)]
    [InlineData(null, null, "10", "9.99", false)]
    [InlineData(null, null, "10", "10", true)]
    public async Task Budget_filter_compares_known_EUR_components_and_preserves_unknowns(
        string? minimum, string? maximum, string? fee, string budget, bool expected)
    {
        var venue = OpenVenue(1, VenueCategory.Restaurant);
        venue.MinSpend = Money(minimum);
        venue.MaxSpend = Money(maximum);
        venue.EntranceFee = Money(fee);
        await SeedAsync(venue);

        var result = await new VenueFilteringService(_db).FilterAsync(
            Preferences with { BudgetPerPerson = Money(budget)!.Value }, CancellationToken.None);

        Assert.Equal(expected ? new[] { 1 } : Array.Empty<int>(), result.Select(v => v.Id));
        if (expected)
        {
            // A retained unknown price stays null instead of being replaced with a free price.
            Assert.Equal(Money(fee), result[0].EntranceFee);
            Assert.Equal(Money(minimum), result[0].MinSpend);
            Assert.Equal(Money(maximum), result[0].MaxSpend);
        }
        var sql = Assert.Single(_queries.Commands);
        Assert.Contains("MinSpend", sql, StringComparison.Ordinal);
        Assert.Contains("COALESCE", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Empty(_db.ChangeTracker.Entries());
    }

    [Fact]
    public async Task Lowering_budget_only_removes_candidates_and_increasing_it_restores_them()
    {
        var cheap = PricedVenue(1, 5m);
        var medium = PricedVenue(2, 10m);
        var expensive = PricedVenue(3, 20m);
        var unknown = OpenVenue(4, VenueCategory.Restaurant);
        await SeedAsync(cheap, medium, expensive, unknown);
        var service = new VenueFilteringService(_db);

        var high = await service.FilterAsync(Preferences with { BudgetPerPerson = 20m }, CancellationToken.None);
        var low = await service.FilterAsync(Preferences with { BudgetPerPerson = 5m }, CancellationToken.None);
        var middle = await service.FilterAsync(Preferences with { BudgetPerPerson = 10m }, CancellationToken.None);

        Assert.Equal(new[] { 1, 2, 3, 4 }, high.Select(v => v.Id));
        Assert.Equal(new[] { 1, 4 }, low.Select(v => v.Id));
        Assert.Equal(new[] { 1, 2, 4 }, middle.Select(v => v.Id));
        Assert.Equal(3, _queries.Commands.Count);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(4)]
    [InlineData(20)]
    public async Task Per_person_budget_does_not_change_with_group_size(int groupSize)
    {
        await SeedAsync(PricedVenue(1, 10m), PricedVenue(2, 10.01m));

        var result = await new VenueFilteringService(_db).FilterAsync(
            Preferences with { GroupSize = groupSize, BudgetPerPerson = 10m }, CancellationToken.None);

        Assert.Equal(new[] { 1 }, result.Select(v => v.Id));
    }

    [Theory]
    [InlineData(false, true)]
    [InlineData(false, false)]
    [InlineData(true, true)]
    public async Task Budget_combines_with_active_hours_category_and_transport(bool zeroBudget, bool transport)
    {
        var closed = PricedVenue(2, 5m);
        closed.OpeningHours.Clear();
        var wrongCategory = PricedVenue(3, 5m);
        wrongCategory.Category = VenueCategory.Bar;
        var inactive = PricedVenue(4, 5m);
        inactive.IsActive = false;
        await SeedAsync(PricedVenue(1, 5m), closed, wrongCategory, inactive, PricedVenue(5, 15m));

        var result = await new VenueFilteringService(_db).FilterAsync(Preferences with
        {
            BudgetPerPerson = zeroBudget ? 0m : 10m,
            Transport = transport ? [Transport.Walking, Transport.Bike] : [],
        }, CancellationToken.None);

        Assert.Equal(!zeroBudget && transport ? new[] { 1 } : Array.Empty<int>(), result.Select(v => v.Id));
        Assert.Single(_queries.Commands);
    }

    [Fact]
    public async Task Negative_budget_is_rejected_without_querying()
    {
        var error = await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() =>
            new VenueFilteringService(_db).FilterAsync(
                Preferences with { BudgetPerPerson = -0.01m }, CancellationToken.None));

        Assert.Equal("budgetPerPerson", error.ParamName);
        Assert.Empty(_queries.Commands);
    }

    [Fact]
    public void Budget_predicate_translates_with_the_production_PostgreSQL_provider()
    {
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=unused").Options);

        var sql = db.Venues.Where(v => v.IsActive)
            .OpenDuring(Preferences.StartTime, Preferences.EndTime)
            .WithinBudget(10.01m).Include(v => v.OpeningHours).AsSingleQuery().ToQueryString();

        Assert.Contains("EXISTS", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("COALESCE", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("MinSpend", sql, StringComparison.Ordinal);
        Assert.Contains("MaxSpend", sql, StringComparison.Ordinal);
        Assert.Contains("EntranceFee", sql, StringComparison.Ordinal);
        Assert.DoesNotContain("EstimatedSpendPerPerson", sql, StringComparison.Ordinal);
    }

    private static Venue PricedVenue(int id, decimal spend)
    {
        var venue = OpenVenue(id, VenueCategory.Restaurant);
        venue.MinSpend = spend;
        venue.MaxSpend = spend;
        venue.EntranceFee = 0m;
        return venue;
    }

    private static decimal? Money(string? value) => value is null
        ? null : decimal.Parse(value, CultureInfo.InvariantCulture);

    [Theory]
    [InlineData(Transport.Walking)]
    [InlineData(Transport.Bike)]
    [InlineData(Transport.Car)]
    [InlineData(Transport.PublicTransport)]
    [InlineData(Transport.Taxi)]
    public async Task Each_recognized_transport_mode_allows_otherwise_eligible_venues(Transport mode)
    {
        await SeedAsync(OpenVenue(1, VenueCategory.Restaurant));

        var result = await new VenueFilteringService(_db).FilterAsync(
            Preferences with { Transport = [mode] }, CancellationToken.None);

        Assert.Equal(new[] { 1 }, result.Select(v => v.Id));
        Assert.Single(_queries.Commands);
        Assert.Empty(_db.ChangeTracker.Entries());
    }

    [Theory]
    [InlineData(new[] { Transport.Walking, Transport.Bike })]
    [InlineData(new[] { Transport.Car, Transport.PublicTransport, Transport.Taxi })]
    [InlineData(new[] { Transport.Walking, Transport.Walking })]
    [InlineData(new[] { (Transport)999, Transport.Bike })]
    public async Task Transport_combinations_use_any_recognized_mode_without_duplicate_candidates(
        Transport[] modes)
    {
        await SeedAsync(OpenVenue(1, VenueCategory.Restaurant), OpenVenue(2, VenueCategory.Restaurant));

        var result = await new VenueFilteringService(_db).FilterAsync(
            Preferences with { Transport = modes }, CancellationToken.None);

        Assert.Equal(new[] { 1, 2 }, result.Select(v => v.Id));
        Assert.Single(_queries.Commands);
    }

    [Theory]
    [InlineData(new Transport[] { })]
    [InlineData(new[] { (Transport)999 })]
    [InlineData(new[] { (Transport)(-1), (Transport)999 })]
    [InlineData(null)]
    public async Task Missing_empty_or_unknown_transport_returns_no_candidates(Transport[]? modes)
    {
        await SeedAsync(OpenVenue(1, VenueCategory.Restaurant));

        var result = await new VenueFilteringService(_db).FilterAsync(
            Preferences with { Transport = modes! }, CancellationToken.None);

        Assert.Empty(result);
        Assert.Single(_queries.Commands);
    }

    [Theory]
    [InlineData(Transport.Car, 1)]
    [InlineData(Transport.Car, 4)]
    [InlineData(Transport.Car, 20)]
    [InlineData(Transport.Walking, 1)]
    [InlineData(Transport.Walking, 4)]
    [InlineData(Transport.Walking, 20)]
    public async Task Unknown_capacity_does_not_exclude_valid_group_sizes_with_or_without_a_car(
        Transport mode, int groupSize)
    {
        await SeedAsync(OpenVenue(1, VenueCategory.Restaurant), OpenVenue(2, VenueCategory.Restaurant));

        var result = await new VenueFilteringService(_db).FilterAsync(
            Preferences with { Transport = [mode], GroupSize = groupSize }, CancellationToken.None);

        Assert.Equal(new[] { 1, 2 }, result.Select(v => v.Id));
        Assert.Single(_queries.Commands);
    }

    [Theory]
    [InlineData(Transport.Car, 0.5)]
    [InlineData(Transport.Car, 30)]
    [InlineData(Transport.Walking, 0.5)]
    [InlineData(Transport.Walking, 30)]
    public async Task Does_not_invent_a_distance_origin_or_treat_zero_coordinates_as_missing(
        Transport mode, double maximumDistance)
    {
        var lleida = OpenVenue(1, VenueCategory.Restaurant);
        lleida.Latitude = 41.6176;
        lleida.Longitude = 0.62;
        var paris = OpenVenue(2, VenueCategory.Restaurant);
        paris.Latitude = 48.8566;
        paris.Longitude = 2.3522;
        // The current non-nullable model has no missing-location marker or access metadata.
        var zeroCoordinates = OpenVenue(3, VenueCategory.Restaurant);
        await SeedAsync(lleida, paris, zeroCoordinates);

        var result = await new VenueFilteringService(_db).FilterAsync(
            Preferences with { Transport = [mode], MaxDistanceKm = maximumDistance }, CancellationToken.None);

        Assert.Equal(new[] { 1, 2, 3 }, result.Select(v => v.Id));
        Assert.Single(_queries.Commands);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Transport_requirement_combines_with_group_size_opening_hours_and_categories(bool hasTransport)
    {
        var closed = OpenVenue(2, VenueCategory.Restaurant);
        closed.OpeningHours.Clear();
        var inactive = OpenVenue(3, VenueCategory.Restaurant);
        inactive.IsActive = false;
        await SeedAsync(OpenVenue(1, VenueCategory.Restaurant), closed, inactive,
            OpenVenue(4, VenueCategory.Bar));

        var result = await new VenueFilteringService(_db).FilterAsync(
            Preferences with
            {
                Transport = hasTransport ? [Transport.Car, Transport.Walking] : [],
                GroupSize = 20,
            }, CancellationToken.None);

        Assert.Equal(hasTransport ? new[] { 1 } : Array.Empty<int>(), result.Select(v => v.Id));
        Assert.Single(_queries.Commands);
        Assert.Empty(_db.ChangeTracker.Entries());
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
        Category = VenueCategory.Restaurant,
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
