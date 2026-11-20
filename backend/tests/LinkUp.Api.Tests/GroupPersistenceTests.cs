using LinkUp.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace LinkUp.Api.Tests;

/// <summary>The rules the database itself enforces for groups, memberships and group plans (#166, #169).</summary>
public sealed class GroupPersistenceTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>
{
    private async Task<Guid> NewUserAsync()
    {
        var user = new User { Email = $"{Guid.NewGuid():N}@example.com", PasswordHash = "hash", DisplayName = "Ann" };
        await AddAsync(user);
        return user.Id;
    }

    private async Task<Guid> NewGroupAsync(Guid ownerId)
    {
        var group = new Group { Name = "Crew", Members = [new GroupMember { UserId = ownerId, Role = GroupRole.Owner }] };
        await AddAsync(group);
        return group.Id;
    }

    private Task<int> AddAsync(object entity) => factory.WithDbAsync(db =>
    {
        db.Add(entity);
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
    public async Task A_user_can_be_in_several_groups_but_once_per_group()
    {
        var ann = await NewUserAsync();
        var first = await NewGroupAsync(ann);
        await NewGroupAsync(ann);

        Assert.Equal(2, await factory.WithDbAsync(db => db.GroupMembers.CountAsync(m => m.UserId == ann)));
        await AssertRejectedAsync(PostgresErrorCodes.UniqueViolation, () =>
            AddAsync(new GroupMember { GroupId = first, UserId = ann, Role = GroupRole.Member }));
    }

    [Fact]
    public async Task A_group_has_at_most_one_owner()
    {
        var (ann, bob) = (await NewUserAsync(), await NewUserAsync());
        var group = await NewGroupAsync(ann);

        await AssertRejectedAsync(PostgresErrorCodes.UniqueViolation, () =>
            AddAsync(new GroupMember { GroupId = group, UserId = bob, Role = GroupRole.Owner }));
    }

    [Fact]
    public async Task A_group_needs_a_name()
    {
        await AssertRejectedAsync(PostgresErrorCodes.CheckViolation, () => AddAsync(new Group { Name = "  " }));
    }

    [Fact]
    public async Task Roles_and_times_are_stored()
    {
        var ann = await NewUserAsync();
        var group = await NewGroupAsync(ann);

        var member = await factory.WithDbAsync(db => db.GroupMembers.SingleAsync(m => m.GroupId == group));
        var stored = await factory.WithDbAsync(db => db.Groups.SingleAsync(g => g.Id == group));

        Assert.Equal(GroupRole.Owner, member.Role);
        Assert.NotEqual(default, member.JoinedAt); // filled by PostgreSQL
        Assert.NotEqual(default, stored.CreatedAt);
    }

    [Fact]
    public async Task A_plan_belongs_to_an_account_or_a_group_never_both()
    {
        var ann = await NewUserAsync();
        var round = new GroupPlanRound { GroupId = await NewGroupAsync(ann), GroupSize = 1 };
        await AddAsync(round);

        await AssertRejectedAsync(PostgresErrorCodes.CheckViolation, () => AddAsync(new Plan
        {
            Title = "Both", Summary = "", UserId = ann, GroupPlanRoundId = round.Id,
        }));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(21)]
    public async Task A_round_has_a_valid_group_size(int groupSize)
    {
        var group = await NewGroupAsync(await NewUserAsync());

        await AssertRejectedAsync(PostgresErrorCodes.CheckViolation, () =>
            AddAsync(new GroupPlanRound { GroupId = group, GroupSize = groupSize }));
    }

    [Fact]
    public async Task Deleting_an_account_removes_its_memberships_but_keeps_the_group_plans()
    {
        var (ann, bob) = (await NewUserAsync(), await NewUserAsync());
        var group = await NewGroupAsync(ann);
        await AddAsync(new GroupMember { GroupId = group, UserId = bob, Role = GroupRole.Member });
        var round = new GroupPlanRound { GroupId = group, GroupSize = 2, CreatedById = bob };
        await AddAsync(round);

        await factory.WithDbAsync(db => db.Users.Where(u => u.Id == bob).ExecuteDeleteAsync());

        Assert.False(await factory.WithDbAsync(db => db.GroupMembers.AnyAsync(m => m.UserId == bob)));
        var stored = await factory.WithDbAsync(db => db.GroupPlanRounds.SingleAsync(r => r.Id == round.Id));
        Assert.Null(stored.CreatedById);
    }

    [Fact]
    public async Task Deleting_a_group_deletes_its_memberships_and_rounds()
    {
        var ann = await NewUserAsync();
        var group = await NewGroupAsync(ann);
        await AddAsync(new GroupPlanRound { GroupId = group, GroupSize = 1 });

        await factory.WithDbAsync(db => db.Groups.Where(g => g.Id == group).ExecuteDeleteAsync());

        Assert.False(await factory.WithDbAsync(db => db.GroupMembers.AnyAsync(m => m.GroupId == group)));
        Assert.False(await factory.WithDbAsync(db => db.GroupPlanRounds.AnyAsync(r => r.GroupId == group)));
    }
}
