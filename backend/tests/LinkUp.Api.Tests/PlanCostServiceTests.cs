using System.Globalization;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Services;
using Microsoft.Extensions.DependencyInjection;

namespace LinkUp.Api.Tests;

public sealed class PlanCostServiceTests
{
    private readonly IPlanCostService _service = new PlanCostService();

    [Theory]
    [InlineData(1, "12.50")]
    [InlineData(4, "50.00")]
    [InlineData(20, "250.00")]
    public void Single_venue_cost_is_multiplied_by_group_size_once(int groupSize, string expectedTotal)
    {
        var plan = Plan(Item(PricedVenue(12.50m)));

        var result = _service.Estimate(plan, groupSize);

        AssertComplete(result, 12.50m, decimal.Parse(expectedTotal, CultureInfo.InvariantCulture));
    }

    [Theory]
    [InlineData(1, "42.00")]
    [InlineData(4, "168.00")]
    public void Multiple_venue_example_sums_per_person_before_multiplying(int groupSize, string expectedTotal)
    {
        var plan = Plan(Item(PricedVenue(12.50m)), Item(PricedVenue(20m)), Item(PricedVenue(9.50m)));

        var result = _service.Estimate(plan, groupSize);

        AssertComplete(result, 42m, decimal.Parse(expectedTotal, CultureInfo.InvariantCulture));
    }

    [Fact]
    public void Admission_and_consumption_are_both_counted_once_for_each_item()
    {
        var dinner = PricedVenue(0m);
        dinner.MinSpend = 10m;
        dinner.MaxSpend = 20m;
        dinner.EntranceFee = 1.25m;
        var drinks = PricedVenue(5m);
        drinks.EntranceFee = 2m;

        var result = _service.Estimate(Plan(Item(dinner), Item(drinks)), 3);

        AssertComplete(result, 23.25m, 69.75m);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(4)]
    public void Mixed_free_and_paid_items_preserve_the_paid_cost(int groupSize)
    {
        var plan = Plan(Item(PricedVenue(0m)), Item(PricedVenue(10.25m)), Item(PricedVenue(0m)));

        var result = _service.Estimate(plan, groupSize);

        AssertComplete(result, 10.25m, 10.25m * groupSize);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(4)]
    public void All_free_items_are_a_complete_zero_estimate(int groupSize)
    {
        var result = _service.Estimate(Plan(Item(PricedVenue(0m)), Item(PricedVenue(0m))), groupSize);

        AssertComplete(result, 0m, 0m);
    }

    [Fact]
    public void Empty_plan_is_a_complete_zero_estimate()
    {
        var result = _service.Estimate(Plan(), 4);

        AssertComplete(result, 0m, 0m);
    }

    [Theory]
    [InlineData(null, null, null)]
    [InlineData("10", null, "0")]
    [InlineData(null, "20", "0")]
    [InlineData(null, null, "5")]
    [InlineData("10", "20", null)]
    [InlineData("0", "0", null)]
    public void Unknown_price_components_do_not_produce_a_confirmed_total(
        string? minimum, string? maximum, string? admission)
    {
        var venue = new Venue
        {
            Name = "Unknown price", Address = "Test address", PriceLevel = 1,
            MinSpend = Money(minimum), MaxSpend = Money(maximum), EntranceFee = Money(admission),
            EntranceType = EntranceType.Free, // A label alone must not make missing amounts free.
        };

        var result = _service.Estimate(Plan(Item(venue)), 4);

        AssertIncomplete(result, 1);
    }

    [Fact]
    public void Mixed_known_and_unknown_items_report_unpriced_items_instead_of_a_partial_total()
    {
        var partial = PricedVenue(10m);
        partial.EntranceFee = null;
        var unknown = new Venue { Name = "Unknown", Address = "Test address" };
        var plan = Plan(Item(PricedVenue(12.50m)), Item(partial), Item(unknown));

        var result = _service.Estimate(plan, 4);

        AssertIncomplete(result, 2);
    }

    [Fact]
    public void Unloaded_venue_is_incomplete_even_if_the_item_has_a_cached_cost()
    {
        var item = new PlanItem { VenueId = 42, EstimatedCostPerPerson = 20m };

        var result = _service.Estimate(Plan(item), 4);

        AssertIncomplete(result, 1);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(int.MinValue)]
    public void Non_positive_group_sizes_are_rejected_even_for_an_empty_plan(int groupSize)
    {
        var error = Assert.Throws<ArgumentOutOfRangeException>(() => _service.Estimate(Plan(), groupSize));

        Assert.Equal("groupSize", error.ParamName);
    }

    [Fact]
    public void Decimal_amounts_do_not_acquire_floating_point_error_or_extra_rounding()
    {
        var result = _service.Estimate(Plan(Item(PricedVenue(0.10m)), Item(PricedVenue(0.20m))), 3);

        AssertComplete(result, 0.30m, 0.90m);
    }

    [Fact]
    public void Consumption_midpoints_reuse_the_venue_models_away_from_zero_cent_rounding()
    {
        var venue = PricedVenue(10m);
        venue.MaxSpend = 10.01m; // Midpoint 10.005 rounds to 10.01 per #47.
        venue.EntranceFee = 0.10m;

        var result = _service.Estimate(Plan(Item(venue), Item(venue)), 3);

        AssertComplete(result, 20.22m, 60.66m);
    }

    [Fact]
    public void Repeated_visits_count_each_item_instead_of_deduplicating_venue_ids()
    {
        var venue = PricedVenue(12.50m);
        venue.Id = 7;
        var first = Item(venue);
        var second = Item(venue);
        second.Position = 1;

        var result = _service.Estimate(Plan(first, second), 4);

        AssertComplete(result, 25m, 100m);
    }

    [Fact]
    public void Repeated_unknown_venues_count_unpriced_items_not_distinct_venues()
    {
        var venue = new Venue { Id = 7, Name = "Unknown", Address = "Test address" };
        var first = Item(venue);
        var second = Item(venue);
        second.Position = 1;

        var result = _service.Estimate(Plan(first, second), 4);

        AssertIncomplete(result, 2);
    }

    [Fact]
    public void Estimates_ignore_cached_amounts_and_do_not_mutate_the_plan_or_items()
    {
        var item = Item(PricedVenue(12.50m));
        item.EstimatedCostPerPerson = 99m;
        var plan = Plan(item);
        plan.EstimatedCostPerPerson = 999m;

        var single = _service.Estimate(plan, 1);
        var group = _service.Estimate(plan, 4);

        AssertComplete(single, 12.50m, 12.50m);
        AssertComplete(group, 12.50m, 50m);
        Assert.Equal(99m, item.EstimatedCostPerPerson);
        Assert.Equal(999m, plan.EstimatedCostPerPerson);
        Assert.Equal(12.50m, item.Venue.MinSpend);
        Assert.Same(item, Assert.Single(plan.Items));
    }

    [Theory]
    [InlineData("-0.01", "0", "0")]
    [InlineData("0", "-0.01", null)]
    [InlineData("0", null, "-0.01")]
    [InlineData("0", "20", "10")]
    public void Invalid_in_memory_prices_are_rejected(string fee, string? minimum, string? maximum)
    {
        var venue = PricedVenue(0m);
        venue.EntranceFee = Money(fee);
        venue.MinSpend = Money(minimum);
        venue.MaxSpend = Money(maximum);

        var error = Assert.Throws<ArgumentException>(() => _service.Estimate(Plan(Item(venue)), 4));

        Assert.Equal("plan", error.ParamName);
    }

    [Fact]
    public void Null_plan_is_rejected()
    {
        Assert.Throws<ArgumentNullException>(() => _service.Estimate(null!, 4));
    }

    [Fact]
    public void Null_item_list_is_rejected_instead_of_being_treated_as_an_empty_plan()
    {
        var plan = Plan();
        plan.Items = null!;

        Assert.Throws<ArgumentNullException>(() => _service.Estimate(plan, 4));
    }

    [Fact]
    public void Null_item_is_rejected_instead_of_being_silently_ignored()
    {
        Assert.Throws<ArgumentNullException>(() => _service.Estimate(Plan((PlanItem)null!), 4));
    }

    [Fact]
    public void Stateless_cost_service_is_registered_and_reusable_across_scopes()
    {
        using var factory = new ApiFactory();
        using var firstScope = factory.Services.CreateScope();
        using var secondScope = factory.Services.CreateScope();
        var first = firstScope.ServiceProvider.GetRequiredService<IPlanCostService>();
        var second = secondScope.ServiceProvider.GetRequiredService<IPlanCostService>();

        Assert.IsType<PlanCostService>(first);
        Assert.Same(first, second);
        AssertComplete(first.Estimate(Plan(Item(PricedVenue(12.50m))), 4), 12.50m, 50m);
    }

    private static void AssertComplete(PlanCostEstimate result, decimal perPerson, decimal total)
    {
        Assert.True(result.IsComplete);
        Assert.Equal(0, result.UnpricedItemCount);
        Assert.Equal(perPerson, result.EstimatedCostPerPerson);
        Assert.Equal(total, result.TotalEstimatedCost);
        Assert.Equal("EUR", result.Currency);
    }

    private static void AssertIncomplete(PlanCostEstimate result, int unpricedItems)
    {
        Assert.False(result.IsComplete);
        Assert.Equal(unpricedItems, result.UnpricedItemCount);
        Assert.Null(result.EstimatedCostPerPerson);
        Assert.Null(result.TotalEstimatedCost);
        Assert.Equal("EUR", result.Currency);
    }

    private static Plan Plan(params PlanItem[] items) => new()
    {
        Title = "Test night", Summary = "Cost estimation", Items = [.. items],
    };

    private static PlanItem Item(Venue venue) => new() { VenueId = venue.Id, Venue = venue };

    private static Venue PricedVenue(decimal spend) => new()
    {
        Name = "Priced venue", Address = "Test address", MinSpend = spend, MaxSpend = spend, EntranceFee = 0m,
    };

    private static decimal? Money(string? value) => value is null
        ? null : decimal.Parse(value, CultureInfo.InvariantCulture);
}
