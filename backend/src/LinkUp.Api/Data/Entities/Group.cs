namespace LinkUp.Api.Data.Entities;

// Friends who plan nights together. The creator is the owner.
public sealed class Group
{
    public Guid Id { get; set; }

    public required string Name { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public List<GroupMember> Members { get; set; } = [];
}
