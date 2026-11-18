using LinkUp.Api.Data;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using LinkUp.Api.Planning;
using LinkUp.Api.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using static LinkUp.Api.Tests.PlanTestData;

namespace LinkUp.Api.Tests;

public sealed class PlanSwapServiceTests : IAsyncLifetime
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private AppDbContext _db = null!;

    // Lleida; 0.01 degrees of latitude is about 1.1 km.
    private const double Lat = 41.6176, Lon = 0.62;

    public async Task InitializeAsync()
    {
        await _connection.OpenAsync();
        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options);
        await _db.Database.EnsureCreatedAsync();
        _db.Venues.AddRange(
            Priced(Venue(1, VenueCategory.Restaurant, latitude: Lat), 20),                // the dinner in the plan
            Priced(Venue(2, VenueCategory.Bar, latitude: Lat + 0.005), 8),               // drinks in the plan
            Priced(Venue(3, VenueCategory.Restaurant, latitude: Lat + 0.002), 15),       // nearest alternative
            Priced(Venue(4, VenueCategory.BarRestaurant, latitude: Lat - 0.003), 18),    // also dinner, a bit further
            Priced(Venue(5, VenueCategory.Restaurant, latitude: Lat + 0.05), 10),        // far out of the way
            Priced(Venue(6, VenueCategory.Restaurant, latitude: Lat + 0.001), 35),       // dearer than the stop
            Priced(Venue(7, VenueCategory.Restaurant, opens: new(23, 0), closes: new(3, 0)), 10), // closed for dinner
            Inactive(Priced(Venue(8, VenueCategory.Restaurant), 10)),
            Unpriced(Venue(9, VenueCategory.Restaurant)),
            Priced(Venue(10, VenueCategory.Pub, latitude: Lat + 0.001), 5),             // drinks, not dinner
            Priced(Venue(11, VenueCategory.Restaurant, opens: new(20, 30), latitude: Lat + 0.0025), 12)); // opens late
        await _db.SaveChangesAsync();
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    private static Venue Priced(Venue venue, decimal spend)
    {
        venue.MinSpend = venue.MaxSpend = spend;
        venue.Name = $"Place {venue.Id}";
        return venue;
    }

    private static Venue Unpriced(Venue venue)
    {
        venue.EntranceFee = null;
        return venue;
    }

    private static Venue Inactive(Venue venue)
    {
        venue.IsActive = false;
        return venue;
    }

    private static PlanItemDto Item(int id, Activity activity, int startHour, int endHour, double distanceKm, decimal cost) =>
        new(new VenueDto(id.ToString(), $"Place {id}", activity, "Carrer Major, Lleida", Lat, Lon, 2),
            Start.AddHours(startHour - 20), Start.AddHours(endHour - 20).AddMinutes(30), cost, distanceKm);

    // Dinner at place 1 from 20:00 to 21:30, drinks at place 2 from 22:00 to 23:30, for 4 people.
    private static readonly PlanDto Plan = new(
        "plan-1", "Dinner at Place 1, then drinks", "Start at Place 1 and walk to Place 2.",
        [Item(1, Activity.Dinner, 20, 21, 0.4, 20), Item(2, Activity.Drinks, 22, 23, 0.56, 8)],
        28, 112, 0.96);

    private PlanSwapService Service() => new(_db, new PlanCostService());

    private Task<IReadOnlyList<PlanDto>> Options(
        int stopIndex = 0, decimal? budget = null, int? groupSize = null, GeoPointDto? start = null, PlanDto? plan = null) =>
        Service().GetOptionsAsync(new SwapOptionsRequest(plan ?? Plan, stopIndex, budget, groupSize, start), default);

    [Fact]
    public async Task Offers_open_priced_venues_of_the_same_activity_closest_first()
    {
        // Without a start point, "closest" is the way on to the next stop (place 2).
        var options = await Options();

        Assert.Equal(["11", "3", "4"], options.Select(o => o.Items[0].Venue.Id));
    }

    [Fact]
    public async Task Returns_the_whole_plan_with_the_stop_replaced_and_everything_recalculated()
    {
        var option = (await Options()).Single(o => o.Items[0].Venue.Id == "3");

        Assert.Equal("plan-1", option.Id);
        Assert.Equal("Dinner at Place 3, then drinks", option.Title);
        Assert.Equal("Start at Place 3 and walk to Place 2.", option.Summary);
        var (dinner, drinks) = (option.Items[0], option.Items[1]);
        Assert.Equal(("3", "Place 3", Activity.Dinner), (dinner.Venue.Id, dinner.Venue.Name, dinner.Venue.Category));
        Assert.Equal((Plan.Items[0].StartTime, Plan.Items[0].EndTime), (dinner.StartTime, dinner.EndTime));
        Assert.Equal(15m, dinner.EstimatedCostPerPerson);
        // No start point sent: the first leg of a replaced first stop is unknown.
        Assert.Equal(0, dinner.DistanceKm);
        Assert.Equal(Plan.Items[1].StartTime, drinks.StartTime);
        Assert.Equal(0.33, drinks.DistanceKm, 2);
        Assert.Equal((23m, 92m), (option.EstimatedCostPerPerson!.Value, option.EstimatedTotalCost!.Value));
        Assert.Equal(drinks.DistanceKm, option.TotalDistanceKm);
    }

    [Fact]
    public async Task Trims_the_stop_to_the_opening_hours_of_the_new_place()
    {
        var late = (await Options()).Single(o => o.Items[0].Venue.Id == "11").Items[0];

        Assert.Equal(Start.AddMinutes(30), late.StartTime);
        Assert.Equal(Plan.Items[0].EndTime, late.EndTime);
    }

    [Fact]
    public async Task Allows_dearer_places_that_still_fit_the_budget()
    {
        Assert.Contains(await Options(budget: 45), o => o.Items[0].Venue.Id == "6");
        Assert.DoesNotContain(await Options(budget: 40), o => o.Items[0].Venue.Id == "6");
    }

    [Fact]
    public async Task Measures_the_first_leg_from_the_start_point_when_known()
    {
        // From the start, places 3 and 11 are equally far out of the way; the lower id comes first.
        var option = (await Options(start: new GeoPointDto(Lat, Lon)))[0];

        Assert.Equal("3", option.Items[0].Venue.Id);
        Assert.Equal(0.22, option.Items[0].DistanceKm, 2);
    }

    [Fact]
    public async Task Swaps_a_later_stop_and_keeps_the_first_leg_as_it_was()
    {
        var options = await Options(stopIndex: 1);

        var option = Assert.Single(options);
        Assert.Equal(("10", Activity.Drinks), (option.Items[1].Venue.Id, option.Items[1].Venue.Category));
        Assert.Equal(0.4, option.Items[0].DistanceKm);
        Assert.Equal(0.11, option.Items[1].DistanceKm, 2);
    }

    [Fact]
    public async Task Prices_the_group_with_the_size_sent_or_the_one_the_plan_was_priced_for()
    {
        // Place 11 (12) and the drinks (8): 20 per person.
        Assert.Equal(40m, (await Options(groupSize: 2))[0].EstimatedTotalCost);
        Assert.Equal(80m, (await Options())[0].EstimatedTotalCost);
    }

    [Fact]
    public async Task Returns_at_most_five_options()
    {
        _db.Venues.AddRange(Enumerable.Range(20, 6).Select(id => Priced(Venue(id, VenueCategory.Restaurant), 10)));
        await _db.SaveChangesAsync();

        Assert.Equal(PlanSwapService.MaxOptions, (await Options()).Count);
    }

    [Theory]
    [InlineData(2, "StopIndex")]
    public async Task Rejects_a_stop_the_plan_does_not_have(int stopIndex, string field)
    {
        var error = await Assert.ThrowsAsync<InvalidSwapException>(() => Options(stopIndex));
        Assert.Equal(field, error.Field);
    }

    [Theory]
    [InlineData("999")]
    [InlineData("not-a-number")]
    [InlineData("-1")]
    public async Task Rejects_places_that_do_not_exist(string id)
    {
        var plan = Plan with { Items = [Plan.Items[0] with { Venue = Plan.Items[0].Venue with { Id = id } }] };

        var error = await Assert.ThrowsAsync<InvalidSwapException>(() => Options(plan: plan));
        Assert.Equal("Plan", error.Field);
    }

    [Fact]
    public async Task Rejects_plans_without_stops_or_with_too_many()
    {
        await Assert.ThrowsAsync<InvalidSwapException>(() => Options(plan: Plan with { Items = [] }));
        await Assert.ThrowsAsync<InvalidSwapException>(() => Options(plan: Plan with
        {
            Items = Enumerable.Repeat(Plan.Items[0], PlanValidator.MaxStops + 1).ToList(),
        }));
    }

    [Fact]
    public async Task Rejects_a_stop_that_ends_before_it_starts()
    {
        var plan = Plan with { Items = [Plan.Items[0] with { EndTime = Plan.Items[0].StartTime }] };

        await Assert.ThrowsAsync<InvalidSwapException>(() => Options(plan: plan));
    }

    [Theory]
    [InlineData(28, 112, 4)]
    [InlineData(28, 2000, 20)]
    [InlineData(0, 0, 1)]
    public void Works_out_the_group_size_from_the_plan(double perPerson, double total, int expected)
    {
        var plan = Plan with { EstimatedCostPerPerson = (decimal)perPerson, EstimatedTotalCost = (decimal)total };
        Assert.Equal(expected, PlanSwapService.GroupSizeOf(plan));
        Assert.Equal(1, PlanSwapService.GroupSizeOf(Plan with { EstimatedTotalCost = null }));
    }
}
