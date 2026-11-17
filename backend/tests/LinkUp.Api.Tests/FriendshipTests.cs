using LinkUp.Api.Data.Entities;

namespace LinkUp.Api.Tests;

public sealed class FriendshipTests
{
    private static readonly Guid Ann = Guid.NewGuid();
    private static readonly Guid Bob = Guid.NewGuid();
    private static readonly DateTimeOffset Now = new(2026, 11, 4, 18, 0, 0, TimeSpan.FromHours(1));

    [Fact]
    public void Both_directions_give_the_same_stored_pair()
    {
        var annToBob = Friendship.Request(Ann, Bob);
        var bobToAnn = Friendship.Request(Bob, Ann);

        Assert.Equal((annToBob.UserAId, annToBob.UserBId), (bobToAnn.UserAId, bobToAnn.UserBId));
        Assert.Equal(Friendship.OrderPair(Ann, Bob), Friendship.OrderPair(Bob, Ann));
    }

    [Fact]
    public void New_request_is_pending_and_remembers_who_sent_it()
    {
        var request = Friendship.Request(Ann, Bob);

        Assert.Equal(FriendshipStatus.Pending, request.Status);
        Assert.Equal(Ann, request.RequestedById);
        Assert.Equal(Bob, request.AddresseeId);
        Assert.Null(request.RespondedAt);
    }

    [Fact]
    public void Cannot_request_yourself() =>
        Assert.Throws<ArgumentException>(() => Friendship.Request(Ann, Ann));

    [Fact]
    public void Accepting_and_declining_record_the_response()
    {
        var accepted = Friendship.Request(Ann, Bob);
        accepted.Accept(Now);
        var declined = Friendship.Request(Ann, Bob);
        declined.Decline(Now);

        Assert.Equal((FriendshipStatus.Accepted, Now), (accepted.Status, accepted.RespondedAt));
        Assert.Equal((FriendshipStatus.Declined, Now), (declined.Status, declined.RespondedAt));
    }

    [Fact]
    public void An_answered_request_cannot_be_answered_again()
    {
        var request = Friendship.Request(Ann, Bob);
        request.Decline(Now);

        Assert.Throws<InvalidOperationException>(() => request.Accept(Now));
    }
}