namespace LinkUp.Api.Data.Entities;

// A user's membership of a group. A user can be in several groups, once per group.
public sealed class GroupMember
{
    public Guid GroupId { get; set; }

    public Guid UserId { get; set; }

    public GroupRole Role { get; set; }

    public DateTimeOffset JoinedAt { get; set; }
}
