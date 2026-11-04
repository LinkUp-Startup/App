namespace LinkUp.Api.Data.Entities;

// A friend request between two users -> accepted -> friendship 
// One row per pair of users
// Whoever sent the request: the pair is stored in a fixed order
public sealed class Friendship
{
    public Guid Id { get; set; }

    // The smaller of the two user ids
    public Guid UserAId { get; set; }

    // The larger of the two user ids
    public Guid UserBId { get; set; }

    // Who sent the request: always UserAId or UserBId
    public Guid RequestedById { get; set; }

    public FriendshipStatus Status { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    // When the request was accepted or declined. Null while pending
    public DateTimeOffset? RespondedAt { get; set; }

    // Who received the request
    public Guid AddresseeId => RequestedById == UserAId ? UserBId : UserAId;

    // A new pending request from one user to another
    public static Friendship Request(Guid fromUserId, Guid toUserId)
    {
        if (fromUserId == toUserId)
            throw new ArgumentException("A user cannot send a friend request to themselves.", nameof(toUserId));

        var (userA, userB) = OrderPair(fromUserId, toUserId);
        return new Friendship
        {
            UserAId = userA,
            UserBId = userB,
            RequestedById = fromUserId,
            Status = FriendshipStatus.Pending,
        };
    }

    // The two ids in the order they are stored. Use it to look a pair up:
    // Compares the ids as text, which is exactly how PostgreSQL orders uuid values
    public static (Guid UserA, Guid UserB) OrderPair(Guid first, Guid second) =>
        string.CompareOrdinal(first.ToString("N"), second.ToString("N")) < 0 ? (first, second) : (second, first);

    public void Accept(DateTimeOffset now) => Respond(FriendshipStatus.Accepted, now);

    public void Decline(DateTimeOffset now) => Respond(FriendshipStatus.Declined, now);

    private void Respond(FriendshipStatus status, DateTimeOffset now)
    {
        if (Status != FriendshipStatus.Pending)
            throw new InvalidOperationException($"Only a pending request can be answered; this one is {Status}.");

        Status = status;
        RespondedAt = now;
    }
}