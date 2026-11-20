namespace LinkUp.Api.Data.Entities;

// A member's vote for one of the plans of a round (#173). A member has at most one vote per round and can change it
// (the row is updated, not added) until the round is closed.
public sealed class GroupPlanVote
{
    public Guid GroupPlanRoundId { get; set; }

    public Guid UserId { get; set; }

    // The plan voted for. It must be one of the round's plans; the database only checks that the plan exists, so the
    // voting service checks the rest.
    public Guid PlanId { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    // When the vote was last changed. The same as CreatedAt until it is.
    public DateTimeOffset UpdatedAt { get; set; }
}
