using LinkUp.Api.Data;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace LinkUp.Api.Services;

public sealed class FriendService(AppDbContext db, TimeProvider clock) : IFriendService
{
    public async Task<IReadOnlyList<UserSearchResultDto>> SearchUsersAsync(
        Guid userId, string query, CancellationToken cancellationToken)
    {
        var text = query.Trim();
        if (text.Length < FriendLimits.SearchMinLength) return [];

        var pattern = $"%{EscapeLike(text)}%";
        var users = await db.Users.AsNoTracking()
            .Where(u => u.Id != userId && EF.Functions.ILike(u.DisplayName, pattern, "\\"))
            .OrderBy(u => u.DisplayName).ThenBy(u => u.Id)
            .Take(FriendLimits.MaxSearchResults)
            .Select(u => new { u.Id, u.DisplayName }) // never the email
            .ToListAsync(cancellationToken);

        var ids = users.Select(u => u.Id).ToList();
        var relations = (await db.Friendships.AsNoTracking()
                .Where(f => (f.UserAId == userId && ids.Contains(f.UserBId)) || (f.UserBId == userId && ids.Contains(f.UserAId)))
                .ToListAsync(cancellationToken))
            .ToDictionary(f => OtherUser(f, userId), f => RelationFor(f, userId));

        return users
            .Select(u => new UserSearchResultDto(u.Id, u.DisplayName, relations.GetValueOrDefault(u.Id, FriendRelation.None)))
            .ToList();
    }

    public async Task<FriendsResponse> ListAsync(Guid userId, CancellationToken cancellationToken)
    {
        var rows = await db.Friendships.AsNoTracking()
            .Where(f => (f.UserAId == userId || f.UserBId == userId) && f.Status != FriendshipStatus.Declined)
            .ToListAsync(cancellationToken);
        var otherIds = rows.Select(f => OtherUser(f, userId)).ToList();
        var names = await db.Users.AsNoTracking()
            .Where(u => otherIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName, cancellationToken);

        var friends = rows
            .Where(f => f.Status == FriendshipStatus.Accepted)
            .Select(f => new FriendDto(OtherUser(f, userId), names[OtherUser(f, userId)], f.RespondedAt!.Value))
            .OrderBy(f => f.DisplayName, StringComparer.OrdinalIgnoreCase)
            .ToList();
        var pending = rows.Where(f => f.Status == FriendshipStatus.Pending).ToList();

        return new FriendsResponse(
            friends,
            Requests(pending.Where(f => f.RequestedById != userId)),
            Requests(pending.Where(f => f.RequestedById == userId)));

        List<FriendRequestDto> Requests(IEnumerable<Friendship> requests) => requests
            .OrderByDescending(f => f.CreatedAt)
            .Select(f => new FriendRequestDto(OtherUser(f, userId), names[OtherUser(f, userId)], f.CreatedAt))
            .ToList();
    }

    public async Task<FriendActionResult> SendRequestAsync(
        Guid userId, Guid otherUserId, CancellationToken cancellationToken)
    {
        if (userId == otherUserId) return FriendActionResult.CannotBefriendYourself;
        // A token can outlive its account; saving would then break the foreign key
        if (!await db.Users.AnyAsync(u => u.Id == userId, cancellationToken)) return FriendActionResult.UnknownAccount;
        if (!await db.Users.AnyAsync(u => u.Id == otherUserId, cancellationToken)) return FriendActionResult.UserNotFound;

        var existing = await FindPairAsync(userId, otherUserId, cancellationToken);
        switch (existing)
        {
            case null:
                db.Friendships.Add(Friendship.Request(userId, otherUserId));
                break;
            case { Status: FriendshipStatus.Accepted }:
                return FriendActionResult.AlreadyFriends;
            case { Status: FriendshipStatus.Pending } when existing.RequestedById == userId:
                return FriendActionResult.Done; // Already sent: sending again is harmless
            case { Status: FriendshipStatus.Pending }:
                return FriendActionResult.RequestAlreadyReceived;
            default:
                // Declined earlier: the pair's row becomes a new request from this user
                existing.RequestedById = userId;
                existing.Status = FriendshipStatus.Pending;
                existing.RespondedAt = null;
                existing.CreatedAt = clock.GetUtcNow();
                break;
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return FriendActionResult.ChangedConcurrently;
        }
        return FriendActionResult.Done;
    }

    public Task<FriendActionResult> AcceptAsync(Guid userId, Guid otherUserId, CancellationToken cancellationToken) =>
        RespondAsync(userId, otherUserId, accept: true, cancellationToken);

    public Task<FriendActionResult> DeclineAsync(Guid userId, Guid otherUserId, CancellationToken cancellationToken) =>
        RespondAsync(userId, otherUserId, accept: false, cancellationToken);

    public async Task RemoveAsync(Guid userId, Guid otherUserId, CancellationToken cancellationToken)
    {
        var (userA, userB) = Friendship.OrderPair(userId, otherUserId);
        await db.Friendships
            .Where(f => f.UserAId == userA && f.UserBId == userB)
            .Where(f => f.Status == FriendshipStatus.Accepted
                || (f.Status == FriendshipStatus.Pending && f.RequestedById == userId))
            .ExecuteDeleteAsync(cancellationToken);
    }

    private async Task<FriendActionResult> RespondAsync(
        Guid userId, Guid otherUserId, bool accept, CancellationToken cancellationToken)
    {
        var request = await FindPairAsync(userId, otherUserId, cancellationToken);
        if (request is not { Status: FriendshipStatus.Pending }) return FriendActionResult.NoPendingRequest;

        // Only the person who received the request can answer it, never the sender
        if (request.RequestedById == userId) return FriendActionResult.NotTheReceiver;

        var now = clock.GetUtcNow();
        if (accept) request.Accept(now);
        else request.Decline(now);

        await db.SaveChangesAsync(cancellationToken);
        return FriendActionResult.Done;
    }

    private Task<Friendship?> FindPairAsync(Guid userId, Guid otherUserId, CancellationToken cancellationToken)
    {
        var (userA, userB) = Friendship.OrderPair(userId, otherUserId);
        return db.Friendships.SingleOrDefaultAsync(f => f.UserAId == userA && f.UserBId == userB, cancellationToken);
    }

    private static Guid OtherUser(Friendship friendship, Guid userId) =>
        friendship.UserAId == userId ? friendship.UserBId : friendship.UserAId;

    private static FriendRelation RelationFor(Friendship friendship, Guid userId) => friendship.Status switch
    {
        FriendshipStatus.Accepted => FriendRelation.Friends,
        FriendshipStatus.Pending when friendship.RequestedById == userId => FriendRelation.RequestSent,
        FriendshipStatus.Pending => FriendRelation.RequestReceived,
        _ => FriendRelation.None, // Declined requests are not shown to either side
    };

    // In ILIKE, % and _ are wildcards; escape them so they match literally
    private static string EscapeLike(string text) =>
        text.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
}