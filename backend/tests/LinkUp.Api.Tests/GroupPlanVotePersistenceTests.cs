using LinkUp.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace LinkUp.Api.Tests;

// Needs PostgreSQL: run `docker compose up -d` first
public sealed class GroupPlanVotePersistenceTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>
{
    private static readonly DateTimeOffset Evening = new(2026, 11, 20, 19, 0, 0, TimeSpan.Zero); // Npgsql only writes UTC

    private sealed record Setup(Guid RoundId, Guid[] PlanIds, Guid[] UserIds);

    // A group of three members with a round of two plans, none of them voted yet
    private async Task<Setup> NewRoundAsync()
    {
        return await factory.WithDbAsync(async db =>
        {
            // Ids are generated when an entity is added, so each step uses what the one before it produced.
            var users = Enumerable.Range(0, 3)
                .Select(i => new User { Email = $"{Guid.NewGuid():N}@example.com", PasswordHash = "hash", DisplayName = $"Member {i}" })
                .ToList();
            db.Users.AddRange(users);

            var group = new Group
            {
                Name = "Friday crew",
                CreatedAt = Evening,
                Members = [.. users.Select((u, i) => new GroupMember
                {
                    UserId = u.Id, Role = i == 0 ? GroupRole.Owner : GroupRole.Member, JoinedAt = Evening,
                })],
            };
            db.Groups.Add(group);

            var round = new GroupPlanRound
            {
                GroupId = group.Id,
                CreatedById = users[0].Id,
                GroupSize = users.Count,
                CreatedAt = Evening,
                Plans =
                [
                    new Plan { Title = "Tapas and drinks", Summary = "Dinner, then a bar.", CreatedAt = Evening },
                    new Plan { Title = "Bowling and burgers", Summary = "Games, then food.", CreatedAt = Evening.AddTicks(10) },
                ],
            };
            db.GroupPlanRounds.Add(round);
            await db.SaveChangesAsync();

            return new Setup(round.Id, [.. round.Plans.Select(p => p.Id)], [.. users.Select(u => u.Id)]);
        });
    }

    private Task<int> VoteAsync(Setup setup, int user, int plan) => factory.WithDbAsync(db =>
    {
        db.GroupPlanVotes.Add(new GroupPlanVote
        {
            GroupPlanRoundId = setup.RoundId, UserId = setup.UserIds[user], PlanId = setup.PlanIds[plan],
        });
        return db.SaveChangesAsync();
    });

    private Task<List<GroupPlanVote>> VotesAsync(Setup setup) => factory.WithDbAsync(db =>
        db.GroupPlanVotes.AsNoTracking().Where(v => v.GroupPlanRoundId == setup.RoundId).ToListAsync());

    // Asserts the database itself rejected the change, not some earlier error
    private static async Task AssertRejectedAsync(string sqlState, Func<Task> action)
    {
        var error = await Assert.ThrowsAnyAsync<Exception>(action);
        var postgres = Assert.IsType<PostgresException>(error as PostgresException ?? error.InnerException);
        Assert.Equal(sqlState, postgres.SqlState);
    }

    [Fact]
    public async Task Votes_are_stored_one_per_member_with_the_times_filled_in()
    {
        var setup = await NewRoundAsync();
        await VoteAsync(setup, user: 0, plan: 0);
        await VoteAsync(setup, user: 1, plan: 0);
        await VoteAsync(setup, user: 2, plan: 1);

        var votes = await VotesAsync(setup);

        Assert.Equal(3, votes.Count);
        Assert.Equal(2, votes.Count(v => v.PlanId == setup.PlanIds[0]));
        Assert.All(votes, v => Assert.NotEqual(default, v.CreatedAt));
        Assert.All(votes, v => Assert.Equal(v.CreatedAt, v.UpdatedAt));
    }

    [Fact]
    public async Task A_member_cannot_vote_twice_in_the_same_round()
    {
        var setup = await NewRoundAsync();
        await VoteAsync(setup, user: 0, plan: 0);

        await AssertRejectedAsync(PostgresErrorCodes.UniqueViolation, () => VoteAsync(setup, user: 0, plan: 1));
    }

    [Fact]
    public async Task A_member_can_change_their_vote()
    {
        var setup = await NewRoundAsync();
        await VoteAsync(setup, user: 0, plan: 0);

        await factory.WithDbAsync(async db =>
        {
            var vote = await db.GroupPlanVotes.SingleAsync(v => v.GroupPlanRoundId == setup.RoundId);
            vote.PlanId = setup.PlanIds[1];
            vote.UpdatedAt = vote.CreatedAt.AddMinutes(5);
            return await db.SaveChangesAsync();
        });

        var vote = Assert.Single(await VotesAsync(setup));
        Assert.Equal(setup.PlanIds[1], vote.PlanId);
        Assert.Equal(vote.CreatedAt.AddMinutes(5), vote.UpdatedAt);
    }

    [Fact]
    public async Task The_same_member_can_vote_in_another_round()
    {
        var first = await NewRoundAsync();
        await VoteAsync(first, user: 0, plan: 0);
        var second = await NewRoundAsync();

        await factory.WithDbAsync(db =>
        {
            db.GroupPlanVotes.Add(new GroupPlanVote
            {
                GroupPlanRoundId = second.RoundId, UserId = first.UserIds[0], PlanId = second.PlanIds[0],
            });
            return db.SaveChangesAsync();
        });

        Assert.Single(await VotesAsync(first));
        Assert.Equal(second.PlanIds[0], Assert.Single(await VotesAsync(second)).PlanId);
    }

    [Fact]
    public async Task A_vote_cannot_be_changed_before_it_was_cast()
    {
        var setup = await NewRoundAsync();
        await VoteAsync(setup, user: 0, plan: 0);

        await AssertRejectedAsync(PostgresErrorCodes.CheckViolation, () => factory.WithDbAsync(async db =>
        {
            var vote = await db.GroupPlanVotes.SingleAsync(v => v.GroupPlanRoundId == setup.RoundId);
            vote.UpdatedAt = vote.CreatedAt.AddMinutes(-1);
            return await db.SaveChangesAsync();
        }));
    }

    [Fact]
    public async Task A_vote_must_reference_an_existing_plan_round_and_member()
    {
        var setup = await NewRoundAsync();

        Task Save(Guid round, Guid user, Guid plan) => factory.WithDbAsync(db =>
        {
            db.GroupPlanVotes.Add(new GroupPlanVote { GroupPlanRoundId = round, UserId = user, PlanId = plan });
            return db.SaveChangesAsync();
        });

        await AssertRejectedAsync(PostgresErrorCodes.ForeignKeyViolation,
            () => Save(setup.RoundId, setup.UserIds[0], Guid.NewGuid()));
        await AssertRejectedAsync(PostgresErrorCodes.ForeignKeyViolation,
            () => Save(Guid.NewGuid(), setup.UserIds[0], setup.PlanIds[0]));
        await AssertRejectedAsync(PostgresErrorCodes.ForeignKeyViolation,
            () => Save(setup.RoundId, Guid.NewGuid(), setup.PlanIds[0]));
    }

    [Fact]
    public async Task A_round_is_open_until_it_is_closed()
    {
        var setup = await NewRoundAsync();
        var closedAt = Evening.AddHours(1);

        Assert.Null(await factory.WithDbAsync(db =>
            db.GroupPlanRounds.Where(r => r.Id == setup.RoundId).Select(r => r.ClosedAt).SingleAsync()));

        await factory.WithDbAsync(db =>
            db.GroupPlanRounds.Where(r => r.Id == setup.RoundId).ExecuteUpdateAsync(s => s.SetProperty(r => r.ClosedAt, closedAt)));

        Assert.Equal(closedAt, await factory.WithDbAsync(db =>
            db.GroupPlanRounds.Where(r => r.Id == setup.RoundId).Select(r => r.ClosedAt).SingleAsync()));
    }

    [Fact]
    public async Task Deleting_an_account_deletes_its_votes_only()
    {
        var setup = await NewRoundAsync();
        await VoteAsync(setup, user: 1, plan: 0);
        await VoteAsync(setup, user: 2, plan: 1);

        await factory.WithDbAsync(db => db.Users.Where(u => u.Id == setup.UserIds[1]).ExecuteDeleteAsync());

        var vote = Assert.Single(await VotesAsync(setup));
        Assert.Equal(setup.UserIds[2], vote.UserId);
    }

    [Fact]
    public async Task Deleting_a_plan_deletes_the_votes_for_it()
    {
        var setup = await NewRoundAsync();
        await VoteAsync(setup, user: 0, plan: 0);
        await VoteAsync(setup, user: 1, plan: 1);

        await factory.WithDbAsync(db => db.Plans.Where(p => p.Id == setup.PlanIds[0]).ExecuteDeleteAsync());

        var vote = Assert.Single(await VotesAsync(setup));
        Assert.Equal(setup.PlanIds[1], vote.PlanId);
    }

    [Fact]
    public async Task Deleting_a_round_deletes_its_votes()
    {
        var setup = await NewRoundAsync();
        await VoteAsync(setup, user: 0, plan: 0);

        await factory.WithDbAsync(db => db.GroupPlanRounds.Where(r => r.Id == setup.RoundId).ExecuteDeleteAsync());

        Assert.Empty(await VotesAsync(setup));
    }
}
