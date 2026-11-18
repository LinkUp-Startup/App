using LinkUp.Api.Data;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace LinkUp.Api.Services;

public sealed class GroupService(AppDbContext db, TimeProvider clock) : IGroupService
{
    public async Task<IReadOnlyList<GroupSummaryDto>> ListAsync(Guid userId, CancellationToken cancellationToken) =>
        await (
                from membership in db.GroupMembers.AsNoTracking()
                where membership.UserId == userId
                join g in db.Groups on membership.GroupId equals g.Id
                orderby g.CreatedAt descending, g.Id
                select new GroupSummaryDto(g.Id, g.Name, g.Members.Count, membership.Role, g.CreatedAt))
            .ToListAsync(cancellationToken);

    public async Task<CreateGroupResult> CreateAsync(
        Guid userId, CreateGroupRequest request, CancellationToken cancellationToken)
    {
        var memberIds = (request.MemberIds ?? []).Where(id => id != userId).Distinct().ToList();

        // A token can outlive its account; saving would then break the foreign key.
        if (!await db.Users.AnyAsync(u => u.Id == userId, cancellationToken)) return new CreateGroupResult.UnknownAccount();

        var friends = await FriendsAmongAsync(userId, memberIds, cancellationToken);
        var notFriends = memberIds.Where(id => !friends.Contains(id)).ToList();
        if (notFriends.Count > 0) return new CreateGroupResult.NotFriends(notFriends);

        // Concurrent creations by the same user run one after the other, so the limit check never races.
        await using var transaction = await LockAsync($"groups-of:{userId}", cancellationToken);
        if (await db.GroupMembers.CountAsync(m => m.UserId == userId, cancellationToken) >= GroupLimits.MaxGroupsPerUser)
            return new CreateGroupResult.LimitReached(GroupLimits.MaxGroupsPerUser);

        var now = clock.GetUtcNow();
        var group = new Group
        {
            Name = request.Name.Trim(),
            CreatedAt = now,
            Members =
            [
                new GroupMember { UserId = userId, Role = GroupRole.Owner, JoinedAt = now },
                .. memberIds.Select(id => new GroupMember { UserId = id, Role = GroupRole.Member, JoinedAt = now }),
            ],
        };
        db.Groups.Add(group);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return new CreateGroupResult.Created((await GetAsync(userId, group.Id, cancellationToken))!);
    }

    public async Task<GroupDto?> GetAsync(Guid userId, Guid groupId, CancellationToken cancellationToken)
    {
        var group = await db.Groups.AsNoTracking()
            .Include(g => g.Members)
            .SingleOrDefaultAsync(g => g.Id == groupId && g.Members.Any(m => m.UserId == userId), cancellationToken);
        if (group is null) return null;

        var ids = group.Members.Select(m => m.UserId).ToList();
        var names = await db.Users.AsNoTracking()
            .Where(u => ids.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName, cancellationToken);
        var members = group.Members
            .OrderBy(m => m.Role == GroupRole.Owner ? 0 : 1)
            .ThenBy(m => m.JoinedAt)
            .ThenBy(m => names[m.UserId], StringComparer.OrdinalIgnoreCase)
            .Select(m => new GroupMemberDto(m.UserId, names[m.UserId], m.Role, m.JoinedAt))
            .ToList();
        var myRole = group.Members.Single(m => m.UserId == userId).Role;
        return new GroupDto(group.Id, group.Name, group.CreatedAt, myRole, members);
    }

    public async Task<GroupActionResult> AddMemberAsync(
        Guid userId, Guid groupId, Guid friendId, CancellationToken cancellationToken)
    {
        // Additions and removals in one group run one after the other, so the size limit never races.
        await using var transaction = await LockAsync($"group:{groupId}", cancellationToken);
        var members = await db.GroupMembers.Where(m => m.GroupId == groupId).ToListAsync(cancellationToken);
        if (members.All(m => m.UserId != userId)) return GroupActionResult.GroupNotFound;
        if (members.Any(m => m.UserId == friendId)) return GroupActionResult.Done; // Adding again is harmless

        if ((await FriendsAmongAsync(userId, [friendId], cancellationToken)).Count == 0)
            return GroupActionResult.NotAFriend;
        if (members.Count >= GroupLimits.MaxMembers) return GroupActionResult.GroupFull;

        db.GroupMembers.Add(new GroupMember
        {
            GroupId = groupId, UserId = friendId, Role = GroupRole.Member, JoinedAt = clock.GetUtcNow(),
        });
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return GroupActionResult.Done;
    }

    public async Task<GroupActionResult> RemoveMemberAsync(
        Guid userId, Guid groupId, Guid memberId, CancellationToken cancellationToken)
    {
        await using var transaction = await LockAsync($"group:{groupId}", cancellationToken);
        var members = await db.GroupMembers.Where(m => m.GroupId == groupId).ToListAsync(cancellationToken);
        if (members.SingleOrDefault(m => m.UserId == userId) is not { } me) return GroupActionResult.GroupNotFound;
        if (memberId != userId && me.Role != GroupRole.Owner) return GroupActionResult.NotTheOwner;
        if (members.SingleOrDefault(m => m.UserId == memberId) is not { } leaving) return GroupActionResult.Done;

        db.GroupMembers.Remove(leaving);
        await db.SaveChangesAsync(cancellationToken);

        var remaining = members.Where(m => m != leaving).OrderBy(m => m.JoinedAt).ThenBy(m => m.UserId).ToList();
        if (remaining.Count == 0)
        {
            // The last member left: nobody can see the group any more.
            await db.Groups.Where(g => g.Id == groupId).ExecuteDeleteAsync(cancellationToken);
        }
        else if (leaving.Role == GroupRole.Owner)
        {
            // Saved separately from the removal, so there is never a moment with two owners.
            remaining[0].Role = GroupRole.Owner;
            await db.SaveChangesAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return GroupActionResult.Done;
    }

    // The ids among userIds that are the user's (accepted) friends
    private async Task<HashSet<Guid>> FriendsAmongAsync(
        Guid userId, IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken)
    {
        if (userIds.Count == 0) return [];
        var rows = await db.Friendships.AsNoTracking()
            .Where(f => f.Status == FriendshipStatus.Accepted)
            .Where(f => (f.UserAId == userId && userIds.Contains(f.UserBId))
                || (f.UserBId == userId && userIds.Contains(f.UserAId)))
            .Select(f => f.UserAId == userId ? f.UserBId : f.UserAId)
            .ToListAsync(cancellationToken);
        return [.. rows];
    }

    // Changes under the same key run one after the other.
    private async Task<IDbContextTransaction> LockAsync(string key, CancellationToken cancellationToken)
    {
        var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({key}, 0))", cancellationToken);
        return transaction;
    }
}
