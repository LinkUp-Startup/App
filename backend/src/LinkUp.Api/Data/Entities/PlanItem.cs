namespace LinkUp.Api.Data.Entities;

// One stop of a plan
public sealed class PlanItem
{
    public int Id { get; set; }
    public Guid PlanId { get; set; }

    // 0-based order of the stop within its plan, unique per plan
    public int Position { get; set; }

    public int VenueId { get; set; }
    public Venue Venue { get; set; } = null!;

    public DateTimeOffset StartTime { get; set; }
    public DateTimeOffset EndTime { get; set; }

    public decimal EstimatedCostPerPerson { get; set; }
    // Distance from the previous stop; 0 for the first one
    public double DistanceKm { get; set; }
}
