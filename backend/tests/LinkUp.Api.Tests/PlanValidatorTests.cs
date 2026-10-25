using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using LinkUp.Api.Planning;
using LinkUp.Api.Services;
using static LinkUp.Api.Tests.PlanTestData;

namespace LinkUp.Api.Tests;

public sealed class PlanValidatorTests
{
    // Fresh per test (xUnit creates one instance per test), since some tests set prices.
    private readonly Venue _restaurant = Venue(1, VenueCategory.Restaurant);
    private readonly Venue _bar = Venue(2, latitude: 41.6266); // ~1 km north
    private readonly Venue _pub = Venue(3, VenueCategory.Pub);

    private static AiStop Stop(int venueId, string start, string end) => new(venueId, start, end);

    private static AiPlan Plan(params AiStop[] stops) => new("Tapas and drinks", "Dinner, then a bar.", stops);

    private PlanValidator.Result Validate(params AiPlan[] plans) =>
        PlanValidator.Validate(plans, [_restaurant, _bar, _pub], Preferences(), new PlanCostService());

    [Fact]
    public void Keeps_a_valid_plan_and_adds_prices_and_distances_from_the_database()
    {
        _restaurant.EntranceFee = 0;
        _restaurant.MinSpend = 15;
        _restaurant.MaxSpend = 25;
        _bar.EntranceFee = 5;
        _bar.MinSpend = 4;
        _bar.MaxSpend = 4;

        var result = Validate(Plan(Stop(1, At(20), At(22)), Stop(2, At(22, 15), At(24))));

        Assert.Empty(result.Problems);
        var plan = Assert.Single(result.Plans);
        Assert.Equal("Tapas and drinks", plan.Title);
        Assert.Equal(["1", "2"], plan.Items.Select(i => i.Venue.Id));
        Assert.Equal([Activity.Dinner, Activity.Drinks], plan.Items.Select(i => i.Venue.Category));
        Assert.Equal([20m, 9m], plan.Items.Select(i => i.EstimatedCostPerPerson));
        Assert.Equal(29m, plan.EstimatedCostPerPerson);
        Assert.Equal(116m, plan.EstimatedTotalCost); // a group of 4
        Assert.Equal(0, plan.Items[0].DistanceKm);
        Assert.InRange(plan.Items[1].DistanceKm, 0.9, 1.1);
        Assert.Equal(plan.Items[1].DistanceKm, plan.TotalDistanceKm);
        Assert.Equal(Start.AddHours(2).AddMinutes(15), plan.Items[1].StartTime);
    }

    [Fact]
    public void The_first_leg_starts_at_the_start_location()
    {
        // Known prices, so the budget check keeps the plan.
        foreach (var venue in new[] { _restaurant, _bar })
            (venue.EntranceFee, venue.MinSpend, venue.MaxSpend) = (0, 5, 5);
        // Start ~1 km south of the restaurant; the bar is ~1 km north of the restaurant.
        var preferences = Preferences() with { StartLocation = new(41.6086, 0.6200) };

        var plan = Assert.Single(PlanValidator.Validate(
            [Plan(Stop(1, At(20), At(22)), Stop(2, At(22), At(23)))], [_restaurant, _bar], preferences, new PlanCostService()).Plans);

        Assert.InRange(plan.Items[0].DistanceKm, 0.9, 1.1);
        Assert.InRange(plan.Items[1].DistanceKm, 0.9, 1.1);
        Assert.InRange(plan.TotalDistanceKm, 1.9, 2.1);
    }

    [Fact]
    public void An_unknown_price_is_rejected_because_the_budget_cannot_be_verified()
    {
        _restaurant.EntranceFee = 0;
        _restaurant.MinSpend = 15;
        _restaurant.MaxSpend = 25;
        _bar.EntranceFee = null;

        var result = Validate(Plan(Stop(1, At(20), At(22)), Stop(2, At(22), At(23))));

        Assert.Empty(result.Plans);
        Assert.True(result.HasCostFailures);
        Assert.Contains(result.Problems, problem => problem.Contains("cost is incomplete"));
    }

    [Fact]
    public void Drops_venues_that_are_not_candidates()
    {
        var result = Validate(Plan(Stop(99, At(20), At(22)), Stop(1, At(22), At(23))));

        Assert.Equal(["1"], Assert.Single(result.Plans).Items.Select(i => i.Venue.Id));
        Assert.Contains("plan 1 stop 1: venue 99 is not a candidate", result.Problems);
    }

    [Theory]
    [InlineData("tonight", "23:00")]
    [InlineData("", "")]
    public void Drops_stops_with_unreadable_times(string start, string end)
    {
        var result = Validate(Plan(Stop(1, start, end), Stop(2, At(22), At(23))));

        Assert.Single(Assert.Single(result.Plans).Items);
        Assert.Contains(result.Problems, p => p.StartsWith("plan 1 stop 1: unreadable time"));
    }

    [Fact]
    public void Trims_stops_to_the_window_and_drops_those_outside_it()
    {
        var result = Validate(Plan(
            Stop(1, At(18), At(21)),       // starts before the window: trimmed to 20:00
            Stop(2, At(25), At(27)),       // 01:00-03:00: trimmed to 02:00
            Stop(3, At(27), At(28))));     // 03:00-04:00: after the window

        var plan = Assert.Single(result.Plans);
        Assert.Equal((Start, Start.AddHours(1)), (plan.Items[0].StartTime, plan.Items[0].EndTime));
        Assert.Equal(End, plan.Items[1].EndTime);
        Assert.Contains("plan 1 stop 3: outside the window or ends before it starts", result.Problems);
    }

    [Fact]
    public void Drops_stops_at_a_closed_venue()
    {
        var earlyBar = Venue(4, opens: new(17, 0), closes: new(21, 0));

        var result = PlanValidator.Validate(
            [Plan(Stop(4, At(22), At(23)), Stop(1, At(20), At(21)))], [_restaurant, earlyBar], Preferences(), new PlanCostService());

        Assert.Equal(["1"], Assert.Single(result.Plans).Items.Select(i => i.Venue.Id));
        Assert.Contains("plan 1 stop 1: venue 4 is closed for (most of) that time", result.Problems);
    }

    private static Venue PricedVenue(int id, params VenueOpeningHours[] hours)
    {
        var venue = Venue(id);
        (venue.EntranceFee, venue.MinSpend, venue.MaxSpend) = (0, 5, 5);
        venue.OpeningHours = [.. hours];
        return venue;
    }

    private static VenueOpeningHours Slot(DayOfWeek day, int opens, int closes) =>
        new() { Day = day, Opens = new(opens, 0), Closes = new(closes % 24, 0) };

    private static PlanItemDto OnlyStop(PlanValidator.Result result) =>
        Assert.Single(Assert.Single(result.Plans).Items);

    [Fact]
    public void A_stop_running_past_closing_time_is_trimmed_to_the_opening_hours()
    {
        var bar = PricedVenue(5, Slot(DayOfWeek.Friday, 18, 22)); // closes at 22:00

        var result = PlanValidator.Validate([Plan(Stop(5, At(21), At(24)))], [bar], Preferences(), new PlanCostService());

        var stop = OnlyStop(result);
        Assert.Equal((Start.AddHours(1), Start.AddHours(2)), (stop.StartTime, stop.EndTime)); // 21:00-22:00
        Assert.Contains("plan 1 stop 1: trimmed to venue 5's opening hours", result.Problems);
    }

    [Fact]
    public void A_stop_with_less_than_half_an_hour_inside_the_opening_hours_is_dropped()
    {
        var bar = PricedVenue(5, Slot(DayOfWeek.Friday, 18, 21)); // closes at 21:00
        var result = PlanValidator.Validate(
            [Plan(Stop(5, At(20, 45), At(23)), Stop(1, At(21), At(22)))], [bar, _restaurant], Preferences(), new PlanCostService());

        Assert.Equal(["1"], Assert.Single(result.Plans).Items.Select(i => i.Venue.Id));
    }

    [Fact]
    public void An_overnight_opening_slot_covers_stops_after_midnight()
    {
        var club = PricedVenue(5, Slot(DayOfWeek.Friday, 23, 6)); // Friday 23:00 to Saturday 06:00

        var result = PlanValidator.Validate([Plan(Stop(5, At(24), At(26)))], [club], Preferences(), new PlanCostService());

        var stop = OnlyStop(result); // 00:00-02:00 on Saturday, untouched
        Assert.Equal((Start.AddHours(4), Start.AddHours(6)), (stop.StartTime, stop.EndTime));
        Assert.DoesNotContain(result.Problems, p => p.Contains("trimmed"));
    }

    [Fact]
    public void A_stop_spanning_two_opening_slots_keeps_the_slot_it_overlaps_most()
    {
        // Lunch 13-16 and dinner 20-23: a stop from 15:00 to 22:00 overlaps lunch by 1 h and dinner by 2 h.
        var restaurant = PricedVenue(5, Slot(DayOfWeek.Friday, 13, 16), Slot(DayOfWeek.Friday, 20, 23));
        var preferences = Preferences() with { StartTime = Start.AddHours(-6), EndTime = End };

        var result = PlanValidator.Validate([Plan(Stop(5, At(15), At(22)))], [restaurant], preferences, new PlanCostService());

        var stop = OnlyStop(result);
        Assert.Equal((Start, Start.AddHours(2)), (stop.StartTime, stop.EndTime)); // 20:00-22:00
    }

    [Fact]
    public void Sorts_stops_and_drops_overlaps_and_repeat_visits()
    {
        var result = Validate(Plan(
            Stop(2, At(22), At(23)),
            Stop(1, At(20), At(22)),
            Stop(3, At(21, 30), At(22, 30)), // overlaps dinner
            Stop(1, At(23), At(24))));       // dinner again

        Assert.Equal(["1", "2"], Assert.Single(result.Plans).Items.Select(i => i.Venue.Id));
        Assert.Contains("plan 1: venue 3 overlaps the previous stop", result.Problems);
        Assert.Contains("plan 1: venue 1 visited twice", result.Problems);
    }

    [Fact]
    public void Keeps_at_most_four_stops()
    {
        var candidates = Enumerable.Range(1, 5).Select(id => Venue(id)).ToList();
        var stops = candidates.Select((v, i) => Stop(v.Id, At(20 + i), At(21 + i))).ToArray();

        var result = PlanValidator.Validate([Plan(stops)], candidates, Preferences(), new PlanCostService());

        Assert.Equal(PlanValidator.MaxStops, Assert.Single(result.Plans).Items.Count);
    }

    [Fact]
    public void Drops_empty_and_repeated_plans_and_keeps_at_most_three()
    {
        var result = Validate(
            Plan(Stop(99, At(20), At(21))),
            Plan(Stop(1, At(20), At(21))),
            Plan(Stop(1, At(20, 30), At(21, 30))), // same venues as plan 2
            Plan(Stop(2, At(20), At(21))),
            Plan(Stop(3, At(20), At(21))),
            Plan(Stop(1, At(20), At(21)), Stop(2, At(22), At(23))));

        Assert.Equal(3, result.Plans.Count);
        Assert.Contains("plan 1: dropped, no valid stops", result.Problems);
        Assert.Contains("plan 3: dropped, same venues as an earlier plan", result.Problems);
        Assert.Contains("plan 6: dropped, more than 3 plans", result.Problems);
        Assert.Equal(3, result.Plans.Select(p => p.Id).Distinct().Count());
    }

    [Fact]
    public void Cleans_up_titles_and_summaries()
    {
        var result = Validate(
            new AiPlan(new string('x', 80), null, [Stop(1, At(20), At(21))]),
            new AiPlan("  ", "  Fine.  ", [Stop(2, At(20), At(21))]));

        Assert.Equal(PlanValidator.TitleMaxLength, result.Plans[0].Title.Length);
        Assert.EndsWith("…", result.Plans[0].Title);
        Assert.Equal("", result.Plans[0].Summary);
        Assert.Equal("Night out", result.Plans[1].Title);
        Assert.Equal("Fine.", result.Plans[1].Summary);
    }

    [Fact]
    public void Plans_without_stops_are_dropped()
    {
        var result = Validate(new AiPlan("Empty", "Nothing", null));

        Assert.Empty(result.Plans);
    }
}
