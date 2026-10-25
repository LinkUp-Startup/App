using LinkUp.Api.Data.Entities;
using LinkUp.Api.Services;

namespace LinkUp.Api.Planning;

/// <summary>Prices a plan's stops with <see cref="IPlanCostService"/> (#48).</summary>
public static class PlanPricing
{
    /// <param name="PerStop">Cost per person of each stop, in order; null when that venue's price is unknown.</param>
    /// <param name="Plan">The whole plan: per person and for the group, null when any stop is unpriced.</param>
    public sealed record Prices(IReadOnlyList<decimal?> PerStop, PlanCostEstimate Plan);

    public static Prices Price(IPlanCostService costs, IReadOnlyList<Venue> venues, int groupSize) => new(
        venues.Select(venue => costs.Estimate(PlanOf([venue]), 1).EstimatedCostPerPerson).ToList(),
        costs.Estimate(PlanOf(venues), groupSize));

    // The cost service works on plan entities with their venues loaded.
    private static Plan PlanOf(IEnumerable<Venue> venues) => new()
    {
        Title = "",
        Summary = "",
        Items = venues.Select((venue, i) => new PlanItem { Position = i, VenueId = venue.Id, Venue = venue }).ToList(),
    };
}
