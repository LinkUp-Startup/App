namespace LinkUp.Api.Data.Entities;

// A generated night plan: an ordered list of venues with estimated costs and distances
public sealed class Plan
{
    public Guid Id { get; set; }

    // Owner of a plan saved to the cloud (#88). Null when the plan is not tied to an account
    public Guid? UserId { get; set; }

    // The plan's id as the app knows it (the generated plan's id). Unique per account, not globally, so two
    // accounts can save the same plan, e.g. a shared one.
    public Guid? SourcePlanId { get; set; }

    public required string Title { get; set; }
    public required string Summary { get; set; }

    // Null when the price of any stop is unknown
    public decimal? EstimatedCostPerPerson { get; set; }
    // For the whole group, null like the cost per person
    public decimal? EstimatedTotalCost { get; set; }
    public double TotalDistanceKm { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    // Not ordered by EF: sort by PlanItem.Position when reading
    public List<PlanItem> Items { get; set; } = [];
}
