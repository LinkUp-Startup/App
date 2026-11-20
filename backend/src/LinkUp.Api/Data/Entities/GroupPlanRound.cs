namespace LinkUp.Api.Data.Entities;

// The 2-3 plans generated together for a group in one go. Every member of the group sees them.
public sealed class GroupPlanRound
{
    public Guid Id { get; set; }

    public Guid GroupId { get; set; }

    // The member who generated the plans. Null once that account is gone.
    public Guid? CreatedById { get; set; }

    // The number of members when the plans were generated: the plans' group size
    public int GroupSize { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    // When the owner closed the vote (#174). Null while members can still vote.
    public DateTimeOffset? ClosedAt { get; set; }

    public List<Plan> Plans { get; set; } = [];
}
