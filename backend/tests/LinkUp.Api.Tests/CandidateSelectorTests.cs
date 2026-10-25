using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using LinkUp.Api.Planning;
using static LinkUp.Api.Tests.PlanTestData;

namespace LinkUp.Api.Tests;

public sealed class CandidateSelectorTests
{
    private static List<Venue> Venues(int firstId, int count, VenueCategory category) =>
        Enumerable.Range(firstId, count).Select(id => Venue(id, category)).ToList();

    [Fact]
    public void Returns_few_candidates_unchanged()
    {
        var candidates = Venues(1, 5, VenueCategory.Bar);

        Assert.Same(candidates, CandidateSelector.Select(candidates, [Activity.Drinks], 5, new Random(1)));
    }

    [Fact]
    public void Splits_the_cap_evenly_across_the_activities()
    {
        // Many more restaurants than bars, like the real dataset.
        var candidates = Venues(1, 30, VenueCategory.Restaurant).Concat(Venues(100, 12, VenueCategory.Bar)).ToList();

        var selected = CandidateSelector.Select(candidates, [Activity.Dinner, Activity.Drinks], 20, new Random(1));

        Assert.Equal(20, selected.Count);
        Assert.Equal(10, selected.Count(v => v.Category == VenueCategory.Restaurant));
        Assert.Equal(10, selected.Count(v => v.Category == VenueCategory.Bar));
        Assert.Equal(selected.OrderBy(v => candidates.IndexOf(v)), selected); // filtered order is kept
    }

    [Fact]
    public void Gives_the_leftover_room_to_activities_with_more_venues()
    {
        var candidates = Venues(1, 30, VenueCategory.Restaurant).Concat(Venues(100, 3, VenueCategory.Nightclub)).ToList();

        var selected = CandidateSelector.Select(candidates, [Activity.Dinner, Activity.Club], 20, new Random(1));

        Assert.Equal(20, selected.Count);
        Assert.Equal(3, selected.Count(v => v.Category == VenueCategory.Nightclub));
    }

    [Fact]
    public void Counts_a_venue_serving_two_activities_once()
    {
        var candidates = Venues(1, 30, VenueCategory.BarRestaurant);

        var selected = CandidateSelector.Select(candidates, [Activity.Dinner, Activity.Drinks], 20, new Random(1));

        Assert.Equal(20, selected.Distinct().Count());
    }

    [Fact]
    public void Picks_different_venues_for_repeated_requests()
    {
        var candidates = Venues(1, 40, VenueCategory.Bar);

        var first = CandidateSelector.Select(candidates, [Activity.Drinks], 10, new Random(1));
        var second = CandidateSelector.Select(candidates, [Activity.Drinks], 10, new Random(2));

        Assert.NotEqual(first.Select(v => v.Id), second.Select(v => v.Id));
    }
}
