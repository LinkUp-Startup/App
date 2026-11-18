using LinkUp.Api.Dtos;

namespace LinkUp.Api.Services;

/// <summary>
/// Groups of friends who plan together. Only members can see a group: for everyone else it does not exist, so
/// every method treats "not a member" the same as "no such group".
/// </summary>
public interface IGroupService
{
    Task<IReadOnlyList<GroupSummaryDto>> ListAsync(Guid userId, CancellationToken cancellationToken);

    Task<CreateGroupResult> CreateAsync(Guid userId, CreateGroupRequest request, CancellationToken cancellationToken);

    /// <summary>The group with its members, or null when the user is not a member.</summary>
    Task<GroupDto?> GetAsync(Guid userId, Guid groupId, CancellationToken cancellationToken);

    /// <summary>Adds one of the user's friends to the group. Adding a member again does nothing.</summary>
    Task<GroupActionResult> AddMemberAsync(Guid userId, Guid groupId, Guid friendId, CancellationToken cancellationToken);

    /// <summary>
    /// Leaves the group (memberId is the user) or, for the owner, removes another member. When the owner leaves,
    /// the longest-standing member becomes the owner; when the last member leaves, the group is deleted.
    /// </summary>
    Task<GroupActionResult> RemoveMemberAsync(Guid userId, Guid groupId, Guid memberId, CancellationToken cancellationToken);
}

public abstract record CreateGroupResult
{
    public sealed record Created(GroupDto Group) : CreateGroupResult;

    /// <summary>The token is valid but its account has been deleted.</summary>
    public sealed record UnknownAccount : CreateGroupResult;

    /// <summary>Some of the members are not the creator's friends.</summary>
    public sealed record NotFriends(IReadOnlyList<Guid> UserIds) : CreateGroupResult;

    public sealed record LimitReached(int Limit) : CreateGroupResult;
}

public enum GroupActionResult
{
    Done,
    // Not a member: the group does not exist for this user
    GroupNotFound,
    // Only friends of the member adding them can be added
    NotAFriend,
    GroupFull,
    // Only the owner can remove other members
    NotTheOwner,
}
