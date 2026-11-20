using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using LinkUp.Api.Dtos;
using LinkUp.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace LinkUp.Api.Tests;

public sealed class GroupRoundsEndpointTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>
{
    private const string Password = "correct-horse-battery";
    private static readonly DateTimeOffset Evening = new(2026, 11, 20, 19, 0, 0, TimeSpan.Zero);

    private sealed record Account(HttpClient Client, Guid Id, string DisplayName);

    private async Task<Account> NewAccountAsync(string displayName)
    {
        using var anonymous = factory.CreateClient();
        var response = await anonymous.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"{Guid.NewGuid():N}@example.com", password = Password, displayName,
        });
        response.EnsureSuccessStatusCode();

        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", body.RootElement.GetProperty("accessToken").GetString());
        return new Account(client, body.RootElement.GetProperty("user").GetProperty("id").GetGuid(), displayName);
    }

    private Task<Guid> NewGroupAsync(params Account[] members) => factory.WithDbAsync(async db =>
    {
        var group = new Group
        {
            Name = "Friday crew",
            CreatedAt = Evening,
            Members = [.. members.Select((m, i) => new GroupMember
            {
                UserId = m.Id, Role = i == 0 ? GroupRole.Owner : GroupRole.Member, JoinedAt = Evening,
            })],
        };
        db.Groups.Add(group);
        await db.SaveChangesAsync();
        return group.Id;
    });

    // A round of two plans of two stops each, created the given number of minutes after the evening begins
    private Task<(Guid Round, Guid[] SourceIds)> NewRoundAsync(Guid groupId, Account? author, int minutes) =>
        factory.WithDbAsync(async db =>
        {
            var venues = await db.Venues.OrderBy(v => v.Id).Take(2).ToListAsync();
            var created = Evening.AddMinutes(minutes);

            Plan NewPlan(string title, int order) => new()
            {
                SourcePlanId = Guid.NewGuid(),
                Title = title,
                Summary = $"{title} summary",
                EstimatedCostPerPerson = 20m,
                EstimatedTotalCost = 80m,
                TotalDistanceKm = 0.8,
                CreatedAt = created.AddTicks(order * 10),
                // Stored out of order on purpose: the API sends them by position
                Items =
                [
                    new PlanItem { Position = 1, VenueId = venues[1].Id, Activity = Activity.Drinks, StartTime = created.AddHours(2), EndTime = created.AddHours(3), EstimatedCostPerPerson = 8m, DistanceKm = 0.8 },
                    new PlanItem { Position = 0, VenueId = venues[0].Id, Activity = Activity.Dinner, StartTime = created, EndTime = created.AddHours(2), EstimatedCostPerPerson = 12m, DistanceKm = 0 },
                ],
            };

            var round = new GroupPlanRound
            {
                GroupId = groupId,
                CreatedById = author?.Id,
                GroupSize = 4,
                CreatedAt = created,
                Plans = [NewPlan("Tapas", 0), NewPlan("Bowling", 1)],
            };
            db.GroupPlanRounds.Add(round);
            await db.SaveChangesAsync();
            return (round.Id, round.Plans.Select(p => p.SourcePlanId!.Value).ToArray());
        });

    private static async Task<JsonElement[]> RoundsAsync(Account who, Guid groupId)
    {
        using var response = await who.Client.GetAsync($"/api/groups/{groupId}/rounds");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement
            .GetProperty("rounds").EnumerateArray().Select(r => r.Clone()).ToArray();
    }

    [Fact]
    public async Task Rounds_need_an_account()
    {
        var owner = await NewAccountAsync("Ann");
        var groupId = await NewGroupAsync(owner);
        using var anonymous = factory.CreateClient();

        using var response = await anonymous.GetAsync($"/api/groups/{groupId}/rounds");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task A_group_without_plans_has_no_rounds()
    {
        var owner = await NewAccountAsync("Ann");

        Assert.Empty(await RoundsAsync(owner, await NewGroupAsync(owner)));
    }

    [Fact]
    public async Task A_member_sees_the_rounds_newest_first_with_their_plans_and_stops()
    {
        var (ann, bob) = (await NewAccountAsync("Ann"), await NewAccountAsync("Bob"));
        var groupId = await NewGroupAsync(ann, bob);
        var older = await NewRoundAsync(groupId, ann, minutes: 0);
        var newer = await NewRoundAsync(groupId, bob, minutes: 30);

        var rounds = await RoundsAsync(bob, groupId);

        Assert.Equal([newer.Round, older.Round], rounds.Select(r => r.GetProperty("id").GetGuid()));
        var round = rounds[0];
        Assert.Equal("Bob", round.GetProperty("createdBy").GetProperty("displayName").GetString());
        Assert.Equal(bob.Id, round.GetProperty("createdBy").GetProperty("userId").GetGuid());
        Assert.Equal(4, round.GetProperty("groupSize").GetInt32());

        // The plans keep the order they were generated in, under the id the app knows them by
        var plans = round.GetProperty("plans").EnumerateArray().ToArray();
        Assert.Equal(["Tapas", "Bowling"], plans.Select(p => p.GetProperty("title").GetString()));
        Assert.Equal(newer.SourceIds.Select(id => id.ToString()), plans.Select(p => p.GetProperty("id").GetString()));
        Assert.Equal(80m, plans[0].GetProperty("estimatedTotalCost").GetDecimal());

        var items = plans[0].GetProperty("items").EnumerateArray().ToArray();
        Assert.Equal(2, items.Length);
        Assert.Equal("dinner", items[0].GetProperty("venue").GetProperty("category").GetString());
        Assert.Equal("drinks", items[1].GetProperty("venue").GetProperty("category").GetString());
        Assert.False(string.IsNullOrEmpty(items[0].GetProperty("venue").GetProperty("name").GetString()));
        Assert.Equal(12m, items[0].GetProperty("estimatedCostPerPerson").GetDecimal());
    }

    [Fact]
    public async Task A_round_whose_author_deleted_their_account_has_no_author()
    {
        var (ann, bob) = (await NewAccountAsync("Ann"), await NewAccountAsync("Bob"));
        var groupId = await NewGroupAsync(ann, bob);
        await NewRoundAsync(groupId, bob, minutes: 0);
        await factory.WithDbAsync(db => db.Users.Where(u => u.Id == bob.Id).ExecuteDeleteAsync());

        var round = Assert.Single(await RoundsAsync(ann, groupId));

        Assert.Equal(JsonValueKind.Null, round.GetProperty("createdBy").ValueKind);
    }

    [Fact]
    public async Task Only_members_can_see_the_rounds_and_other_groups_rounds_stay_apart()
    {
        var (ann, outsider) = (await NewAccountAsync("Ann"), await NewAccountAsync("Eve"));
        var (mine, other) = (await NewGroupAsync(ann), await NewGroupAsync(outsider));
        await NewRoundAsync(mine, ann, minutes: 0);

        using var denied = await outsider.Client.GetAsync($"/api/groups/{mine}/rounds");
        using var unknown = await ann.Client.GetAsync($"/api/groups/{Guid.NewGuid()}/rounds");

        Assert.Equal(HttpStatusCode.NotFound, denied.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
        Assert.Empty(await RoundsAsync(outsider, other));
    }

    [Fact]
    public async Task A_stored_plan_without_a_generated_id_is_listed_under_its_own_id()
    {
        var ann = await NewAccountAsync("Ann");
        var groupId = await NewGroupAsync(ann);
        var round = await NewRoundAsync(groupId, ann, minutes: 0);
        var storedId = await factory.WithDbAsync(async db =>
        {
            var plan = await db.Plans.SingleAsync(p => p.SourcePlanId == round.SourceIds[0]);
            plan.SourcePlanId = null;
            await db.SaveChangesAsync();
            return plan.Id;
        });

        var plans = (await RoundsAsync(ann, groupId)).Single().GetProperty("plans").EnumerateArray().ToArray();

        Assert.Equal(storedId.ToString(), plans[0].GetProperty("id").GetString());
    }
}
