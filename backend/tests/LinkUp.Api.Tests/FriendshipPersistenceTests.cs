using LinkUp.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace LinkUp.Api.Tests;

public sealed class FriendshipPersistenceTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>
{
    private static readonly DateTimeOffset Now = new(2026, 11, 4, 18, 0, 0, TimeSpan.FromHours(1));

    private async Task<Guid> NewUserAsync()
    {
        var user = new User { Email = $"{Guid.NewGuid():N}@example.com", PasswordHash = "hash", DisplayName = "Ann" };
        await factory.WithDbAsync(db =>
        {
            db.Users.Add(user);
            return db.SaveChangesAsync();
        });
        return user.Id;
    }

    private Task<int> SaveAsync(Friendship friendship) => factory.WithDbAsync(db =>
    {
        db.Friendships.Add(friendship);
        return db.SaveChangesAsync();
    });

    // Asserts the database itself rejected the change, not some earlier error
    private static async Task AssertRejectedAsync(string sqlState, Func<Task> action)
    {
        var error = await Assert.ThrowsAnyAsync<Exception>(action);
        var postgres = Assert.IsType<PostgresException>(error as PostgresException ?? error.InnerException);
        Assert.Equal(sqlState, postgres.SqlState);
    }

    [Fact]
    public async Task Request_is_stored_and_can_be_accepted()
    {
        var (ann, bob) = (await NewUserAsync(), await NewUserAsync());
        var request = Friendship.Request(ann, bob);
        await SaveAsync(request);

        await factory.WithDbAsync(async db =>
        {
            var stored = await db.Friendships.SingleAsync(f => f.Id == request.Id);
            stored.Accept(Now);
            return await db.SaveChangesAsync();
        });

        var friendship = await factory.WithDbAsync(db => db.Friendships.AsNoTracking().SingleAsync(f => f.Id == request.Id));
        Assert.Equal(FriendshipStatus.Accepted, friendship.Status);
        Assert.Equal(ann, friendship.RequestedById);
        Assert.NotEqual(default, friendship.CreatedAt);
    }

    [Fact]
    public async Task Only_one_row_per_pair_in_either_direction()
    {
        var (ann, bob) = (await NewUserAsync(), await NewUserAsync());
        await SaveAsync(Friendship.Request(ann, bob));

        await AssertRejectedAsync(PostgresErrorCodes.UniqueViolation, () => SaveAsync(Friendship.Request(ann, bob)));
        await AssertRejectedAsync(PostgresErrorCodes.UniqueViolation, () => SaveAsync(Friendship.Request(bob, ann)));
    }

    [Fact]
    public async Task Pair_order_matches_how_PostgreSQL_orders_ids()
    {
        // If OrderPair disagreed with PostgreSQL, some of these would break the "UserAId < UserBId" check
        for (var i = 0; i < 20; i++)
            await SaveAsync(Friendship.Request(await NewUserAsync(), await NewUserAsync()));
    }

    [Fact]
    public async Task Cannot_befriend_yourself()
    {
        var ann = await NewUserAsync();

        await AssertRejectedAsync(PostgresErrorCodes.CheckViolation, () => SaveAsync(new Friendship
        {
            UserAId = ann,
            UserBId = ann,
            RequestedById = ann,
            Status = FriendshipStatus.Pending,
        }));
    }

    [Fact]
    public async Task Requester_must_be_one_of_the_two_users()
    {
        var (ann, bob, carol) = (await NewUserAsync(), await NewUserAsync(), await NewUserAsync());
        var request = Friendship.Request(ann, bob);
        request.RequestedById = carol;

        await AssertRejectedAsync(PostgresErrorCodes.CheckViolation, () => SaveAsync(request));
    }

    [Fact]
    public async Task Answered_request_needs_a_response_time()
    {
        var (ann, bob) = (await NewUserAsync(), await NewUserAsync());
        var request = Friendship.Request(ann, bob);
        request.Status = FriendshipStatus.Accepted; // without RespondedAt

        await AssertRejectedAsync(PostgresErrorCodes.CheckViolation, () => SaveAsync(request));
    }

    [Fact]
    public async Task Deleting_an_account_deletes_its_friendships()
    {
        var (ann, bob) = (await NewUserAsync(), await NewUserAsync());
        var request = Friendship.Request(ann, bob);
        await SaveAsync(request);

        var stillThere = await factory.WithDbAsync(async db =>
        {
            await db.Users.Where(u => u.Id == bob).ExecuteDeleteAsync();
            return await db.Friendships.AnyAsync(f => f.Id == request.Id);
        });

        Assert.False(stillThere);
    }
}