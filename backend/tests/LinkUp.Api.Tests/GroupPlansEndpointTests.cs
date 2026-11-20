using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using LinkUp.Api.Ai;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using LinkUp.Api.Planning;
using LinkUp.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using static LinkUp.Api.Tests.GroupTestApi;

namespace LinkUp.Api.Tests;

/// <summary>Generating plans for a group (#169) and every member seeing them (#170).</summary>
public sealed class GroupPlansEndpointTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>
{
    // Matches enough of the seeded Lleida venues for the stub planner to build plans.
    private static object PlanRequest(int groupSize = 1) => new
    {
        preferences = new
        {
            budgetPerPerson = 30,
            groupSize,
            activities = new[] { "drinks" },
            startTime = "2026-10-30T20:00:00Z",
            endTime = "2026-10-31T02:00:00Z",
            maxDistanceKm = 3,
            transport = new[] { "walking" },
        },
    };

    private static Task<HttpResponseMessage> GenerateAsync(Account account, Guid groupId, object? request = null) =>
        account.Client.PostAsJsonAsync($"/api/groups/{groupId}/plans/generate", request ?? PlanRequest());

    private static async Task<JsonElement[]> RoundsAsync(Account account, Guid groupId) =>
        (await JsonAsync(await account.Client.GetAsync($"/api/groups/{groupId}/plans")))
            .GetProperty("rounds").EnumerateArray().ToArray();

    private Task<bool> AnyRoundAsync(Guid groupId) =>
        factory.WithDbAsync(db => db.GroupPlanRounds.AnyAsync(r => r.GroupId == groupId));

    [Theory]
    [InlineData("GET", "/api/groups/00000000-0000-0000-0000-000000000001/plans")]
    [InlineData("POST", "/api/groups/00000000-0000-0000-0000-000000000001/plans/generate")]
    public async Task Endpoints_require_login(string method, string url)
    {
        using var anonymous = factory.CreateClient();

        await AssertStatusAsync(HttpStatusCode.Unauthorized,
            anonymous.SendAsync(new HttpRequestMessage(new HttpMethod(method), url)));
    }

    [Fact]
    public async Task Group_plans_use_the_member_count_and_every_member_sees_them()
    {
        var (ann, bob, cat) = (await NewAccountAsync(factory), await NewAccountAsync(factory), await NewAccountAsync(factory));
        await BefriendAsync(ann, bob);
        await BefriendAsync(ann, cat);
        var groupId = await CreateGroupAsync(ann, "Crew", bob, cat);
        Assert.Empty(await RoundsAsync(cat, groupId));

        // The request says 1 person; the group has 3 members
        var round = await JsonAsync(await GenerateAsync(bob, groupId, PlanRequest(1)));

        Assert.Equal(3, round.GetProperty("groupSize").GetInt32());
        Assert.Equal(bob.Id, round.GetProperty("createdBy").GetProperty("userId").GetGuid());
        Assert.Equal(bob.DisplayName, round.GetProperty("createdBy").GetProperty("displayName").GetString());
        var plans = round.GetProperty("plans").EnumerateArray().ToArray();
        Assert.InRange(plans.Length, 2, 3);
        Assert.All(plans, plan => Assert.Equal(
            plan.GetProperty("estimatedCostPerPerson").GetDecimal() * 3, plan.GetProperty("estimatedTotalCost").GetDecimal()));

        foreach (var member in new[] { ann, bob, cat })
        {
            var stored = Assert.Single(await RoundsAsync(member, groupId));
            Assert.Equal(round.GetProperty("id").GetGuid(), stored.GetProperty("id").GetGuid());
            Assert.Equal(3, stored.GetProperty("groupSize").GetInt32());
            // Exactly what the planner returned: the same plans, in the same order, with the same stops and costs
            Assert.Equal(round.GetProperty("plans").GetRawText(), stored.GetProperty("plans").GetRawText());
        }
    }

    [Fact]
    public async Task Generated_plans_are_saved_to_the_group_not_to_the_member()
    {
        var ann = await NewAccountAsync(factory);
        var groupId = await CreateGroupAsync(ann);

        var round = await JsonAsync(await GenerateAsync(ann, groupId));

        var stored = await factory.WithDbAsync(db => db.GroupPlanRounds
            .Include(r => r.Plans).ThenInclude(p => p.Items)
            .SingleAsync(r => r.GroupId == groupId));
        Assert.Equal(ann.Id, stored.CreatedById);
        Assert.All(stored.Plans, plan =>
        {
            Assert.Null(plan.UserId);
            Assert.NotEmpty(plan.Items);
        });
        // The plan ids stay the generated ones, so a member could save a plan under the same id later
        Assert.Equal(
            round.GetProperty("plans").EnumerateArray().Select(p => p.GetProperty("id").GetString()),
            stored.Plans.OrderBy(p => p.CreatedAt).Select(p => p.SourcePlanId.ToString()));
        Assert.Empty((await JsonAsync(await ann.Client.GetAsync("/api/saved-plans"))).GetProperty("plans").EnumerateArray());
    }

    [Fact]
    public async Task Rounds_are_listed_newest_first_with_their_authors()
    {
        var (ann, bob) = (await NewAccountAsync(factory), await NewAccountAsync(factory));
        await BefriendAsync(ann, bob);
        var groupId = await CreateGroupAsync(ann, "Crew", bob);
        var first = await JsonAsync(await GenerateAsync(bob, groupId));
        var second = await JsonAsync(await GenerateAsync(ann, groupId));

        var rounds = await RoundsAsync(bob, groupId);

        Assert.Equal(
            [second.GetProperty("id").GetGuid(), first.GetProperty("id").GetGuid()],
            rounds.Select(r => r.GetProperty("id").GetGuid()));
        Assert.Equal([ann.Id, bob.Id], rounds.Select(r => r.GetProperty("createdBy").GetProperty("userId").GetGuid()));
    }

    [Fact]
    public async Task A_round_stays_when_its_author_deletes_their_account()
    {
        var (ann, bob) = (await NewAccountAsync(factory), await NewAccountAsync(factory));
        await BefriendAsync(ann, bob);
        var groupId = await CreateGroupAsync(ann, "Crew", bob);
        await JsonAsync(await GenerateAsync(bob, groupId));

        await factory.WithDbAsync(db => db.Users.Where(u => u.Id == bob.Id).ExecuteDeleteAsync());

        var round = Assert.Single(await RoundsAsync(ann, groupId));
        Assert.Equal(JsonValueKind.Null, round.GetProperty("createdBy").ValueKind);
    }

    [Fact]
    public async Task Only_members_can_see_or_generate_group_plans()
    {
        var (ann, bob, outsider) = (await NewAccountAsync(factory), await NewAccountAsync(factory), await NewAccountAsync(factory));
        await BefriendAsync(ann, bob);
        var groupId = await CreateGroupAsync(ann, "Crew", bob);
        await JsonAsync(await GenerateAsync(ann, groupId));

        await AssertStatusAsync(HttpStatusCode.NotFound, outsider.Client.GetAsync($"/api/groups/{groupId}/plans"));
        await AssertStatusAsync(HttpStatusCode.NotFound, GenerateAsync(outsider, groupId));

        // A member who leaves stops seeing them
        (await bob.Client.DeleteAsync($"/api/groups/{groupId}/members/{bob.Id}")).EnsureSuccessStatusCode();
        await AssertStatusAsync(HttpStatusCode.NotFound, bob.Client.GetAsync($"/api/groups/{groupId}/plans"));
        Assert.Single(await RoundsAsync(ann, groupId));
    }

    [Fact]
    public async Task Only_the_newest_rounds_are_kept()
    {
        var ann = await NewAccountAsync(factory);
        var groupId = await CreateGroupAsync(ann);
        var first = await JsonAsync(await GenerateAsync(ann, groupId));

        for (var i = 0; i < GroupLimits.MaxPlanRoundsPerGroup; i++)
            await JsonAsync(await GenerateAsync(ann, groupId));

        var kept = await factory.WithDbAsync(db =>
            db.GroupPlanRounds.Where(r => r.GroupId == groupId).Select(r => r.Id).ToListAsync());
        Assert.Equal(GroupLimits.MaxPlanRoundsPerGroup, kept.Count);
        Assert.DoesNotContain(first.GetProperty("id").GetGuid(), kept);
        Assert.Equal(GroupLimits.MaxPlanRoundsPerGroup, (await RoundsAsync(ann, groupId)).Length);
    }

    [Fact]
    public async Task Deleting_the_group_deletes_its_plans()
    {
        var ann = await NewAccountAsync(factory);
        var groupId = await CreateGroupAsync(ann);
        await JsonAsync(await GenerateAsync(ann, groupId));
        var planIds = await factory.WithDbAsync(db => db.Plans
            .Where(p => db.GroupPlanRounds.Any(r => r.GroupId == groupId && r.Id == p.GroupPlanRoundId))
            .Select(p => p.Id).ToListAsync());

        (await ann.Client.DeleteAsync($"/api/groups/{groupId}/members/{ann.Id}")).EnsureSuccessStatusCode();

        Assert.False(await AnyRoundAsync(groupId));
        Assert.False(await factory.WithDbAsync(db => db.Plans.AnyAsync(p => planIds.Contains(p.Id))));
    }

    [Fact]
    public async Task Invalid_preferences_are_rejected_before_generating()
    {
        var ann = await NewAccountAsync(factory);
        var groupId = await CreateGroupAsync(ann);

        await AssertStatusAsync(HttpStatusCode.BadRequest, GenerateAsync(ann, groupId,
            new { preferences = new { budgetPerPerson = 30, groupSize = 2, activities = Array.Empty<string>() } }));
        Assert.False(await AnyRoundAsync(groupId));
    }

    [Fact]
    public async Task Too_few_matching_venues_give_the_same_422_as_solo_plans_and_save_nothing()
    {
        var ann = await NewAccountAsync(factory);
        var groupId = await CreateGroupAsync(ann);

        // Nothing matches a cinema at 5 in the morning within half a kilometre of the middle of the ocean
        using var response = await GenerateAsync(ann, groupId, new
        {
            preferences = new
            {
                budgetPerPerson = 0,
                groupSize = 1,
                activities = new[] { "cinema" },
                startTime = "2026-10-30T05:00:00Z",
                endTime = "2026-10-30T06:00:00Z",
                maxDistanceKm = 0.5,
                transport = new[] { "walking" },
                startLocation = new { latitude = 0, longitude = 0 },
            },
        });

        var problem = await JsonAsync(response, HttpStatusCode.UnprocessableEntity);
        Assert.Equal("no_candidates", problem.GetProperty("code").GetString());
        Assert.False(await AnyRoundAsync(groupId));
    }

    [Theory]
    [InlineData(typeof(UnavailablePlanService), "Couldn't generate plans right now.")]
    [InlineData(typeof(OverBudgetPlanService), "Couldn't generate plans within your budget.")]
    public async Task Generation_failures_are_reported_and_save_nothing(Type planService, string title)
    {
        using var failing = factory.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
        {
            services.RemoveAll<IPlanService>();
            services.AddScoped(typeof(IPlanService), planService);
        }));
        var ann = await NewAccountAsync(failing);
        var groupId = await CreateGroupAsync(ann);

        var problem = await JsonAsync(await GenerateAsync(ann, groupId), HttpStatusCode.BadGateway);

        Assert.Equal(title, problem.GetProperty("title").GetString());
        Assert.False(await AnyRoundAsync(groupId));
    }

    private sealed class UnavailablePlanService : IPlanService
    {
        public Task<IReadOnlyList<PlanDto>> GeneratePlansAsync(
            NightPreferencesDto preferences, IReadOnlyList<Venue> candidates, CancellationToken cancellationToken) =>
            throw new AiException("The AI is down.");
    }

    private sealed class OverBudgetPlanService : IPlanService
    {
        public Task<IReadOnlyList<PlanDto>> GeneratePlansAsync(
            NightPreferencesDto preferences, IReadOnlyList<Venue> candidates, CancellationToken cancellationToken) =>
            throw new PlanBudgetException("No plan fits 30 euros per person.");
    }
}
