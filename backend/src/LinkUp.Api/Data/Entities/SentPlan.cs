namespace LinkUp.Api.Data.Entities;

// A plan one user sent to a friend (#207). The friend gets their own copy of the plan, so it stays as it was
// even when the sender changes or deletes theirs.
public sealed class SentPlan
{
    public Guid Id { get; set; }

    // Who sent it. Null once that account is gone; the friend keeps the plan.
    public Guid? SenderId { get; set; }

    public Guid RecipientId { get; set; }

    public DateTimeOffset SentAt { get; set; }

    // The copy, owned by this row: deleting the row deletes the copy.
    public Plan Plan { get; set; } = null!;
}
