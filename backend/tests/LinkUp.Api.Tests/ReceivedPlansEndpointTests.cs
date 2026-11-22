using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using LinkUp.Api.Dtos;
using Microsoft.EntityFrameworkCore;
using static LinkUp.Api.Tests.GroupTestApi;

namespace LinkUp.Api.Tests;

/// <summary>Sending a saved plan to a friend, and the plans friends sent you (#207).</summary>
public sealed class ReceivedPlansEndpointTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>
{
    private static readonly DateTimeOffset Evening = new(2026, 11, 6, 20, 0, 0, TimeSpan.FromHours(1));

    // Saves a two-stop plan to the account, as the app does, and returns its id.
    private async Task<Guid> SavePlanAsync(Account account, string title = "Tapas and drinks")
    {
        var venues = await factory.WithDbAsync(db => db.Venues.OrderBy(v => v.Id).Select(v => v.Id).Take(2).ToArrayAsync());
        var id = Guid.NewGuid();
        var plan = new
        {
            id = id.ToString(),
            title,
            summary = "Dinner, then a bar nearby.",
            items = venues.Select((venueId, position) => new
            {
                venue = new { id = venueId.ToString(), name = "x", category = position == 0 ? "dinner" : "drinks", address = "x", latitude = 0, longitude = 0, priceLevel = (int?)null },
                startTime = Evening.AddHours(position * 2),
                endTime = Evening.AddHours(position * 2 + 1),
                estimatedCostPerPerson = (decimal?)12.5m,
                distanceKm = position == 0 ? 0 : 0.8,
            }),
            estimatedCostPerPerson = (decimal?)25m,
            estimatedTotalCost = (decimal?)50m,
            totalDistanceKm = 0.8,
        };
        (await account.Client.PutAsJsonAsync($"/api/saved-plans/{id}", plan)).EnsureSuccessStatusCode();
        return id;
    }

    private static Task<HttpResponseMessage> SendAsync(Account from, Guid planId, Account to) =>
        from.Client.PostAsync($"/api/saved-plans/{planId}/send/{to.Id}", null);

    private static async Task<JsonElement[]> ReceivedAsync(Account account) =>
        (await JsonAsync(await account.Client.GetAsync("/api/received-plans")))
            .GetProperty("plans").EnumerateArray().ToArray();

    [Theory]
    [InlineData("GET", "/api/received-plans")]
    [InlineData("DELETE", "/api/received-plans/00000000-0000-0000-0000-000000000001")]
    [InlineData("POST", "/api/saved-plans/00000000-0000-0000-0000-000000000001/send/00000000-0000-0000-0000-000000000002")]
    public async Task Endpoints_require_login(string method, string url)
    {
        using var anonymous = factory.CreateClient();

        await AssertStatusAsync(HttpStatusCode.Unauthorized,
            anonymous.SendAsync(new HttpRequestMessage(new HttpMethod(method), url)));
    }

    [Fact]
    public async Task A_friend_receives_the_plan_with_who_sent_it()
    {
        var (ann, bob) = (await NewAccountAsync(factory), await NewAccountAsync(factory));
        await BefriendAsync(ann, bob);
        var planId = await SavePlanAsync(ann);
        var annsPlan = (await JsonAsync(await ann.Client.GetAsync("/api/saved-plans"))).GetProperty("plans")[0].GetProperty("plan");

        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(ann, planId, bob));

        var received = Assert.Single(await ReceivedAsync(bob));
        Assert.Equal(ann.Id, received.GetProperty("from").GetProperty("userId").GetGuid());
        Assert.Equal(ann.DisplayName, received.GetProperty("from").GetProperty("displayName").GetString());
        Assert.True(received.GetProperty("sentAt").GetDateTimeOffset() > DateTimeOffset.UtcNow.AddMinutes(-5));
        // The whole plan, as Ann saved it, under the same plan id
        Assert.Equal(annsPlan.GetRawText(), received.GetProperty("plan").GetRawText());
        Assert.Empty(await ReceivedAsync(ann));
    }

    [Fact]
    public async Task The_friend_can_save_their_own_copy()
    {
        var (ann, bob) = (await NewAccountAsync(factory), await NewAccountAsync(factory));
        await BefriendAsync(ann, bob);
        var planId = await SavePlanAsync(ann);
        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(ann, planId, bob));
        var plan = Assert.Single(await ReceivedAsync(bob)).GetProperty("plan");

        // What the app does with "Save to my plans"
        await AssertStatusAsync(HttpStatusCode.OK,
            bob.Client.PutAsync($"/api/saved-plans/{planId}", new StringContent(plan.GetRawText(), System.Text.Encoding.UTF8, "application/json")));

        var saved = (await JsonAsync(await bob.Client.GetAsync("/api/saved-plans"))).GetProperty("plans");
        Assert.Equal(planId.ToString(), Assert.Single(saved.EnumerateArray()).GetProperty("plan").GetProperty("id").GetString());
    }

    [Fact]
    public async Task The_copy_stays_when_the_sender_changes_or_deletes_their_plan()
    {
        var (ann, bob) = (await NewAccountAsync(factory), await NewAccountAsync(factory));
        await BefriendAsync(ann, bob);
        var planId = await SavePlanAsync(ann);
        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(ann, planId, bob));

        (await ann.Client.DeleteAsync($"/api/saved-plans/{planId}")).EnsureSuccessStatusCode();

        Assert.Equal("Tapas and drinks", Assert.Single(await ReceivedAsync(bob)).GetProperty("plan").GetProperty("title").GetString());
    }

    [Fact]
    public async Task Only_friends_can_receive_plans()
    {
        var (ann, stranger, pending) = (await NewAccountAsync(factory), await NewAccountAsync(factory), await NewAccountAsync(factory));
        (await ann.Client.PostAsync($"/api/friends/requests/{pending.Id}", null)).EnsureSuccessStatusCode();
        var planId = await SavePlanAsync(ann);

        foreach (var to in new[] { stranger, pending, ann })
        {
            using var response = await SendAsync(ann, planId, to);
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            Assert.Equal("You can only send plans to your friends.",
                (await JsonAsync(response, HttpStatusCode.Forbidden)).GetProperty("title").GetString());
            Assert.Empty(await ReceivedAsync(to));
        }
    }

    [Fact]
    public async Task Only_your_own_saved_plans_can_be_sent()
    {
        var (ann, bob, cat) = (await NewAccountAsync(factory), await NewAccountAsync(factory), await NewAccountAsync(factory));
        await BefriendAsync(ann, bob);
        await BefriendAsync(cat, bob);
        var catsPlan = await SavePlanAsync(cat);

        await AssertStatusAsync(HttpStatusCode.NotFound, SendAsync(ann, Guid.NewGuid(), bob));
        await AssertStatusAsync(HttpStatusCode.NotFound, SendAsync(ann, catsPlan, bob));
        Assert.Empty(await ReceivedAsync(bob));
    }

    [Fact]
    public async Task Sending_the_same_plan_again_replaces_the_copy_and_plans_are_newest_first()
    {
        var (ann, bob, cat) = (await NewAccountAsync(factory), await NewAccountAsync(factory), await NewAccountAsync(factory));
        await BefriendAsync(ann, bob);
        await BefriendAsync(cat, bob);
        var annsPlan = await SavePlanAsync(ann, "From Ann");
        var catsPlan = await SavePlanAsync(cat, "From Cat");

        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(ann, annsPlan, bob));
        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(cat, catsPlan, bob));
        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(ann, annsPlan, bob));

        Assert.Equal(["From Ann", "From Cat"],
            (await ReceivedAsync(bob)).Select(r => r.GetProperty("plan").GetProperty("title").GetString()));
    }

    [Fact]
    public async Task A_received_plan_can_be_removed_only_by_its_recipient()
    {
        var (ann, bob) = (await NewAccountAsync(factory), await NewAccountAsync(factory));
        await BefriendAsync(ann, bob);
        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(ann, await SavePlanAsync(ann), bob));
        var id = Assert.Single(await ReceivedAsync(bob)).GetProperty("id").GetGuid();

        await AssertStatusAsync(HttpStatusCode.NoContent, ann.Client.DeleteAsync($"/api/received-plans/{id}"));
        Assert.Single(await ReceivedAsync(bob));

        await AssertStatusAsync(HttpStatusCode.NoContent, bob.Client.DeleteAsync($"/api/received-plans/{id}"));
        await AssertStatusAsync(HttpStatusCode.NoContent, bob.Client.DeleteAsync($"/api/received-plans/{id}"));
        Assert.Empty(await ReceivedAsync(bob));
        // The copy goes with it
        Assert.False(await factory.WithDbAsync(db => db.Plans.AnyAsync(p => p.SentPlanId == id)));
    }

    [Fact]
    public async Task A_plan_stays_when_its_sender_deletes_their_account()
    {
        var (ann, bob) = (await NewAccountAsync(factory), await NewAccountAsync(factory));
        await BefriendAsync(ann, bob);
        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(ann, await SavePlanAsync(ann), bob));

        await factory.WithDbAsync(db => db.Users.Where(u => u.Id == ann.Id).ExecuteDeleteAsync());

        var received = Assert.Single(await ReceivedAsync(bob));
        Assert.Equal(JsonValueKind.Null, received.GetProperty("from").ValueKind);
    }

    [Fact]
    public async Task Received_plans_go_with_the_recipients_account()
    {
        var (ann, bob) = (await NewAccountAsync(factory), await NewAccountAsync(factory));
        await BefriendAsync(ann, bob);
        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(ann, await SavePlanAsync(ann), bob));

        await factory.WithDbAsync(db => db.Users.Where(u => u.Id == bob.Id).ExecuteDeleteAsync());

        Assert.False(await factory.WithDbAsync(db => db.SentPlans.AnyAsync(s => s.RecipientId == bob.Id)));
    }

    [Fact]
    public async Task Only_the_newest_received_plans_are_kept()
    {
        var (ann, bob) = (await NewAccountAsync(factory), await NewAccountAsync(factory));
        await BefriendAsync(ann, bob);
        var first = await SavePlanAsync(ann, "The first");
        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(ann, first, bob));
        // Fill the rest of the list straight in the database, older than the next send
        await factory.WithDbAsync(async db =>
        {
            var original = await db.Plans.Include(p => p.Items).SingleAsync(p => p.UserId == ann.Id && p.SourcePlanId == first);
            for (var i = 1; i < ReceivedPlanLimits.MaxReceivedPlans; i++)
            {
                db.SentPlans.Add(new Data.Entities.SentPlan
                {
                    SenderId = ann.Id, RecipientId = bob.Id, SentAt = DateTimeOffset.UtcNow.AddMinutes(-i),
                    Plan = new Data.Entities.Plan { Title = $"Filler {i}", Summary = "", SourcePlanId = Guid.NewGuid() },
                });
            }
            // The first plan is now the oldest
            await db.SentPlans.Where(s => s.Plan.SourcePlanId == first).ExecuteUpdateAsync(s => s.SetProperty(x => x.SentAt, DateTimeOffset.UtcNow.AddDays(-1)));
            return await db.SaveChangesAsync();
        });

        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(ann, await SavePlanAsync(ann, "The newest"), bob));

        var received = await ReceivedAsync(bob);
        Assert.Equal(ReceivedPlanLimits.MaxReceivedPlans, received.Length);
        Assert.Equal("The newest", received[0].GetProperty("plan").GetProperty("title").GetString());
        Assert.DoesNotContain(received, r => r.GetProperty("plan").GetProperty("title").GetString() == "The first");
    }
}
