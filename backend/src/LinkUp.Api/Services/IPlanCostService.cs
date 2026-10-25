using LinkUp.Api.Data.Entities;

namespace LinkUp.Api.Services;

/// <summary>A complete EUR estimate, or null amounts when one or more items cannot be priced.</summary>
public sealed record PlanCostEstimate(
    decimal? EstimatedCostPerPerson,
    decimal? TotalEstimatedCost,
    int UnpricedItemCount)
{
    public bool IsComplete => UnpricedItemCount == 0;
    public string Currency => "EUR";
}

public interface IPlanCostService
{
    /// <summary>
    /// Sums admission plus the venue consumption estimate for each item, then multiplies by group size.
    /// Venue references must be loaded; missing references/prices make the estimate incomplete.
    /// Does not query, mutate the plan, validate a budget, or use cached plan/item cost fields.
    /// </summary>
    PlanCostEstimate Estimate(Plan plan, int groupSize);
}
