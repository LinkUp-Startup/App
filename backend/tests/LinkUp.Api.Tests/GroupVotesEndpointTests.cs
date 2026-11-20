using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using LinkUp.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace LinkUp.Api.Tests;

public sealed class GroupVotesEndpointTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>
{
    private const string Password = "correct-horse-battery";

    private sealed record Account(HttpClient Client, Guid Id);

    // A group of the given accounts (the first is the owner) with one round of two plans
    private sealed record Round(Guid GroupId, Guid RoundId, Guid PlanA, Guid PlanB, Guid[] DbPlanIds);

    private async Task<Account> NewAccountAsync()
    {
        using var anonymous = factory.CreateClient();
        var response = await anonymous.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"{Guid.NewGuid():N}@example.com", password = Password, displayName = "Voter",
        });
        response.EnsureSuccessStatusCode();

        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", body.RootElement.GetProperty("accessToken").GetString());
        return new Account(client, body.RootElement.GetProperty("user").GetProperty("id").GetGuid());
    }

    private Task<Round> NewRoundAsync(params Account[] members) => factory.WithDbAsync(async db =>
    {
        var now = DateTimeOffset.UtcNow;
        var group = new Group
        {
            Name = "Friday crew",
            CreatedAt = now,
            Members = [.. members.Select((m, i) => new GroupMember
            {
                UserId = m.Id, Role = i == 0 ? GroupRole.Owner : GroupRole.Member, JoinedAt = now,
            })],
        };
        db.Groups.Add(group);
        var (planA, planB) = (Guid.NewGuid(), Guid.NewGuid());
        var round = new GroupPlanRound
        {
            GroupId = group.Id,
            CreatedById = members[0].Id,
            GroupSize = Math.Max(members.Length, 2),
            CreatedAt = now,
            Plans =
            [
                new Plan { SourcePlanId = planA, Title = "Tapas and drinks", Summary = "Dinner, then a bar.", CreatedAt = now },
                new Plan { SourcePlanId = planB, Title = "Bowling", Summary = "Games, then food.", CreatedAt = now.AddTicks(10) },
            ],
        };
        db.GroupPlanRounds.Add(round);
        await db.SaveChangesAsync();
        return new Round(group.Id, round.Id, planA, planB, [.. round.Plans.Select(p => p.Id)]);
    });

    private static string Url(Round round, string path) => $"/api/groups/{round.GroupId}/rounds/{round.RoundId}/{path}";

    private static Task<HttpResponseMessage> VoteAsync(Account who, Round round, Guid planId) =>
        who.Client.PutAsJsonAsync(Url(round, "votes/me"), new { planId });

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response, HttpStatusCode expected = HttpStatusCode.OK)
    {
        using (response)
        {
            Assert.Equal(expected, response.StatusCode);
            return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();
        }
    }

    private static async Task<JsonElement> ResultsAsync(Account who, Round round) =>
        await ReadAsync(await who.Client.GetAsync(Url(round, "votes")));

    private static int[] VotesPerPlan(JsonElement results) =>
        [.. results.GetProperty("plans").EnumerateArray().Select(p => p.GetProperty("votes").GetInt32())];

    private static async Task AssertStatusAsync(HttpStatusCode expected, Task<HttpResponseMessage> request)
    {
        using var response = await request;
        Assert.Equal(expected, response.StatusCode);
    }

    [Fact]
    public async Task Voting_needs_an_account()
    {
        var owner = await NewAccountAsync();
        var round = await NewRoundAsync(owner);
        using var anonymous = factory.CreateClient();

        await AssertStatusAsync(HttpStatusCode.Unauthorized, anonymous.GetAsync(Url(round, "votes")));
        await AssertStatusAsync(HttpStatusCode.Unauthorized, anonymous.PutAsJsonAsync(Url(round, "votes/me"), new { planId = round.PlanA }));
        await AssertStatusAsync(HttpStatusCode.Unauthorized, anonymous.PostAsync(Url(round, "close"), null));
    }

    [Fact]
    public async Task Nobody_has_voted_yet()
    {
        var (owner, ann) = (await NewAccountAsync(), await NewAccountAsync());
        var round = await NewRoundAsync(owner, ann);

        var results = await ResultsAsync(ann, round);

        Assert.Equal(round.RoundId, results.GetProperty("roundId").GetGuid());
        Assert.Equal(JsonValueKind.Null, results.GetProperty("closedAt").ValueKind);
        Assert.Equal(2, results.GetProperty("memberCount").GetInt32());
        Assert.Equal(0, results.GetProperty("votesCast").GetInt32());
        Assert.Equal(JsonValueKind.Null, results.GetProperty("myVotePlanId").ValueKind);
        Assert.Equal(
            [round.PlanA, round.PlanB],
            results.GetProperty("plans").EnumerateArray().Select(p => p.GetProperty("planId").GetGuid()));
        Assert.Equal([0, 0], VotesPerPlan(results));
    }

    [Fact]
    public async Task Members_vote_and_each_sees_their_own_vote()
    {
        var (owner, ann, bob) = (await NewAccountAsync(), await NewAccountAsync(), await NewAccountAsync());
        var round = await NewRoundAsync(owner, ann, bob);

        await ReadAsync(await VoteAsync(owner, round, round.PlanB));
        await ReadAsync(await VoteAsync(ann, round, round.PlanB));
        var afterBob = await ReadAsync(await VoteAsync(bob, round, round.PlanA));

        Assert.Equal([1, 2], VotesPerPlan(afterBob));
        Assert.Equal(3, afterBob.GetProperty("votesCast").GetInt32());
        Assert.Equal(round.PlanA, afterBob.GetProperty("myVotePlanId").GetGuid());
        Assert.Equal(round.PlanB, (await ResultsAsync(ann, round)).GetProperty("myVotePlanId").GetGuid());
    }

    [Fact]
    public async Task A_member_can_change_their_vote_and_still_counts_once()
    {
        var (owner, ann) = (await NewAccountAsync(), await NewAccountAsync());
        var round = await NewRoundAsync(owner, ann);

        await ReadAsync(await VoteAsync(ann, round, round.PlanA));
        var changed = await ReadAsync(await VoteAsync(ann, round, round.PlanB));
        var again = await ReadAsync(await VoteAsync(ann, round, round.PlanB));

        Assert.Equal([0, 1], VotesPerPlan(changed));
        Assert.Equal([0, 1], VotesPerPlan(again));
        Assert.Equal(1, again.GetProperty("votesCast").GetInt32());
        Assert.Equal(round.PlanB, again.GetProperty("myVotePlanId").GetGuid());
        var stored = await factory.WithDbAsync(db => db.GroupPlanVotes.AsNoTracking()
            .Where(v => v.GroupPlanRoundId == round.RoundId).ToListAsync());
        Assert.Single(stored);
    }

    [Fact]
    public async Task Only_members_of_the_group_can_see_or_vote()
    {
        var (owner, outsider) = (await NewAccountAsync(), await NewAccountAsync());
        var round = await NewRoundAsync(owner);

        await AssertStatusAsync(HttpStatusCode.NotFound, outsider.Client.GetAsync(Url(round, "votes")));
        await AssertStatusAsync(HttpStatusCode.NotFound, VoteAsync(outsider, round, round.PlanA));
        await AssertStatusAsync(HttpStatusCode.NotFound, outsider.Client.PostAsync(Url(round, "close"), null));
        Assert.Equal(0, (await ResultsAsync(owner, round)).GetProperty("votesCast").GetInt32());
    }

    [Fact]
    public async Task A_round_is_only_found_through_its_own_group()
    {
        var owner = await NewAccountAsync();
        var (mine, other) = (await NewRoundAsync(owner), await NewRoundAsync(owner));
        var wrongGroup = $"/api/groups/{other.GroupId}/rounds/{mine.RoundId}/votes";

        await AssertStatusAsync(HttpStatusCode.NotFound, owner.Client.GetAsync(wrongGroup));
        await AssertStatusAsync(HttpStatusCode.NotFound,
            owner.Client.GetAsync($"/api/groups/{mine.GroupId}/rounds/{Guid.NewGuid()}/votes"));
    }

    [Fact]
    public async Task The_plan_must_be_one_of_the_rounds_plans()
    {
        var owner = await NewAccountAsync();
        var (round, other) = (await NewRoundAsync(owner), await NewRoundAsync(owner));

        await AssertStatusAsync(HttpStatusCode.NotFound, VoteAsync(owner, round, Guid.NewGuid()));
        await AssertStatusAsync(HttpStatusCode.NotFound, VoteAsync(owner, round, Guid.Empty));
        await AssertStatusAsync(HttpStatusCode.NotFound, VoteAsync(owner, round, other.PlanA));
        Assert.Equal(0, (await ResultsAsync(owner, round)).GetProperty("votesCast").GetInt32());
    }

    [Fact]
    public async Task A_vote_without_a_plan_is_a_bad_request()
    {
        var owner = await NewAccountAsync();
        var round = await NewRoundAsync(owner);

        await AssertStatusAsync(HttpStatusCode.BadRequest, owner.Client.PutAsJsonAsync(Url(round, "votes/me"), new { }));
    }

    [Fact]
    public async Task A_plan_can_be_voted_for_by_the_id_it_is_stored_under_when_it_has_no_generated_one()
    {
        var owner = await NewAccountAsync();
        var round = await NewRoundAsync(owner);
        await factory.WithDbAsync(db =>
            db.Plans.Where(p => p.Id == round.DbPlanIds[0]).ExecuteUpdateAsync(s => s.SetProperty(p => p.SourcePlanId, (Guid?)null)));

        var results = await ReadAsync(await VoteAsync(owner, round, round.DbPlanIds[0]));

        Assert.Equal([1, 0], VotesPerPlan(results));
        Assert.Equal(round.DbPlanIds[0], results.GetProperty("myVotePlanId").GetGuid());
    }

    [Fact]
    public async Task Only_the_owner_can_close_the_vote()
    {
        var (owner, ann) = (await NewAccountAsync(), await NewAccountAsync());
        var round = await NewRoundAsync(owner, ann);

        await AssertStatusAsync(HttpStatusCode.Forbidden, ann.Client.PostAsync(Url(round, "close"), null));
        Assert.Equal(JsonValueKind.Null, (await ResultsAsync(ann, round)).GetProperty("closedAt").ValueKind);

        var closed = await ReadAsync(await owner.Client.PostAsync(Url(round, "close"), null));

        Assert.NotEqual(JsonValueKind.Null, closed.GetProperty("closedAt").ValueKind);
        Assert.NotEqual(JsonValueKind.Null, (await ResultsAsync(ann, round)).GetProperty("closedAt").ValueKind);
    }

    [Fact]
    public async Task Nobody_can_vote_or_change_their_vote_once_it_is_closed()
    {
        var (owner, ann) = (await NewAccountAsync(), await NewAccountAsync());
        var round = await NewRoundAsync(owner, ann);
        await ReadAsync(await VoteAsync(ann, round, round.PlanA));

        await ReadAsync(await owner.Client.PostAsync(Url(round, "close"), null));

        await AssertStatusAsync(HttpStatusCode.Conflict, VoteAsync(owner, round, round.PlanA));
        await AssertStatusAsync(HttpStatusCode.Conflict, VoteAsync(ann, round, round.PlanB));
        var results = await ResultsAsync(ann, round);
        Assert.Equal([1, 0], VotesPerPlan(results));
        Assert.Equal(round.PlanA, results.GetProperty("myVotePlanId").GetGuid());
    }

    [Fact]
    public async Task Closing_again_keeps_the_time_of_the_first_time()
    {
        var owner = await NewAccountAsync();
        var round = await NewRoundAsync(owner);

        var first = await ReadAsync(await owner.Client.PostAsync(Url(round, "close"), null));
        var second = await ReadAsync(await owner.Client.PostAsync(Url(round, "close"), null));

        Assert.Equal(first.GetProperty("closedAt").GetDateTimeOffset(), second.GetProperty("closedAt").GetDateTimeOffset());
    }

    [Fact]
    public async Task The_votes_of_people_who_left_the_group_do_not_count()
    {
        var (owner, ann, bob) = (await NewAccountAsync(), await NewAccountAsync(), await NewAccountAsync());
        var round = await NewRoundAsync(owner, ann, bob);
        await ReadAsync(await VoteAsync(owner, round, round.PlanA));
        await ReadAsync(await VoteAsync(bob, round, round.PlanA));

        await AssertStatusAsync(HttpStatusCode.NoContent, bob.Client.DeleteAsync($"/api/groups/{round.GroupId}/members/{bob.Id}"));

        var results = await ResultsAsync(owner, round);
        Assert.Equal([1, 0], VotesPerPlan(results));
        Assert.Equal(1, results.GetProperty("votesCast").GetInt32());
        Assert.Equal(2, results.GetProperty("memberCount").GetInt32());
        await AssertStatusAsync(HttpStatusCode.NotFound, bob.Client.GetAsync(Url(round, "votes")));
    }

    [Fact]
    public async Task Concurrent_votes_from_one_member_leave_exactly_one_vote()
    {
        var (owner, ann) = (await NewAccountAsync(), await NewAccountAsync());
        var round = await NewRoundAsync(owner, ann);

        var responses = await Task.WhenAll(Enumerable.Range(0, 8)
            .Select(i => VoteAsync(ann, round, i % 2 == 0 ? round.PlanA : round.PlanB)));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        var results = await ResultsAsync(owner, round);
        Assert.Equal(1, results.GetProperty("votesCast").GetInt32());
        Assert.Equal(1, VotesPerPlan(results).Sum());
    }
}
