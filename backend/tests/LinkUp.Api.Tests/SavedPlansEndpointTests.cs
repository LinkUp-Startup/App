using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace LinkUp.Api.Tests;

// Needs PostgreSQL: run `docker compose up -d` first
public sealed class SavedPlansEndpointTests : IClassFixture<AuthApiFactory>
{
    private const string Password = "correct-horse-battery";
    private static readonly DateTimeOffset Evening = new(2026, 11, 6, 20, 0, 0, TimeSpan.FromHours(1));

    private readonly AuthApiFactory _factory;

    public SavedPlansEndpointTests(AuthApiFactory factory) => _factory = factory;

    private sealed record Account(HttpClient Client, string Email);

    private async Task<Account> NewAccountAsync()
    {
        var email = $"{Guid.NewGuid():N}@example.com";
        using var anonymous = _factory.CreateClient();
        var response = await anonymous.PostAsJsonAsync("/api/auth/register", new { email, password = Password, displayName = "Ann" });
        response.EnsureSuccessStatusCode();
        return new Account(ClientWithToken(await TokenFromAsync(response)), email);
    }

    /// <summary>The same account signing in again, as on another device.</summary>
    private async Task<HttpClient> LoginAsync(string email)
    {
        using var anonymous = _factory.CreateClient();
        var response = await anonymous.PostAsJsonAsync("/api/auth/login", new { email, password = Password });
        response.EnsureSuccessStatusCode();
        return ClientWithToken(await TokenFromAsync(response));
    }

    private static async Task<string> TokenFromAsync(HttpResponseMessage response)
    {
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return body.RootElement.GetProperty("accessToken").GetString()!;
    }

    private HttpClient ClientWithToken(string token)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private async Task<(int Id, string Name)[]> VenuesAsync(int count) =>
        (await _factory.WithDbAsync(db => db.Venues.OrderBy(v => v.Id).Select(v => new { v.Id, v.Name }).Take(count).ToArrayAsync()))
            .Select(v => (v.Id, v.Name)).ToArray();

    // The shape the API returns from /api/plans/generate, which is also what the app saves.
    private static object Stop(int venueId, int position, string name = "ignored", decimal? cost = 12.5m, string activity = "dinner") => new
    {
        venue = new { id = venueId.ToString(), name, category = activity, address = "ignored", latitude = 0, longitude = 0, priceLevel = (int?)null },
        startTime = Evening.AddHours(position * 2),
        endTime = Evening.AddHours(position * 2 + 1),
        estimatedCostPerPerson = cost,
        distanceKm = position == 0 ? 0 : 0.8,
    };

    private static object RawStop(string venueId, DateTimeOffset start, DateTimeOffset end, string activity = "dinner") => new
    {
        venue = new { id = venueId, name = "x", category = activity, address = "x", latitude = 0, longitude = 0, priceLevel = (int?)null },
        startTime = start,
        endTime = end,
        estimatedCostPerPerson = (decimal?)1m,
        distanceKm = 0.5,
    };

    private static object Plan(Guid id, string title = "Tapas and drinks", params object[] items) => new
    {
        id = id.ToString(),
        title,
        summary = "Dinner, then a bar nearby.",
        items,
        estimatedCostPerPerson = (decimal?)25m,
        estimatedTotalCost = (decimal?)50m,
        totalDistanceKm = 0.8,
    };

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    private static async Task<JsonElement> ListAsync(HttpClient client)
    {
        using var response = await client.GetAsync("/api/saved-plans");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await JsonAsync(response)).GetProperty("plans");
    }

    private static Task<HttpResponseMessage> SaveAsync(HttpClient client, Guid id, object plan) =>
        client.PutAsJsonAsync($"/api/saved-plans/{id}", plan);

    [Fact]
    public async Task Every_endpoint_needs_a_signed_in_account()
    {
        using var anonymous = _factory.CreateClient();
        var id = Guid.NewGuid();

        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/saved-plans")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PutAsJsonAsync($"/api/saved-plans/{id}", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.DeleteAsync($"/api/saved-plans/{id}")).StatusCode);
    }

    [Fact]
    public async Task A_new_account_has_no_saved_plans()
    {
        var account = await NewAccountAsync();

        Assert.Equal(0, (await ListAsync(account.Client)).GetArrayLength());
    }

    [Fact]
    public async Task A_saved_plan_is_listed_with_its_stops_in_order_and_visible_after_logging_in_again()
    {
        var venues = await VenuesAsync(2);
        var account = await NewAccountAsync();
        var id = Guid.NewGuid();

        using var saved = await SaveAsync(account.Client, id, Plan(id, "Tapas and drinks",
            Stop(venues[0].Id, 0, activity: "dinner"), Stop(venues[1].Id, 1, cost: null, activity: "drinks")));
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);

        // "Visible on another device": a second login of the same account sees it.
        var otherDevice = await LoginAsync(account.Email);
        var plans = await ListAsync(otherDevice);
        var plan = Assert.Single(plans.EnumerateArray()).GetProperty("plan");

        Assert.Equal(id.ToString(), plan.GetProperty("id").GetString());
        Assert.Equal("Tapas and drinks", plan.GetProperty("title").GetString());
        Assert.Equal(25m, plan.GetProperty("estimatedCostPerPerson").GetDecimal());
        Assert.Equal(50m, plan.GetProperty("estimatedTotalCost").GetDecimal());
        var items = plan.GetProperty("items");
        Assert.Equal(2, items.GetArrayLength());
        Assert.Equal(venues[0].Id.ToString(), items[0].GetProperty("venue").GetProperty("id").GetString());
        Assert.Equal("dinner", items[0].GetProperty("venue").GetProperty("category").GetString());
        Assert.Equal(venues[1].Id.ToString(), items[1].GetProperty("venue").GetProperty("id").GetString());
        Assert.Equal("drinks", items[1].GetProperty("venue").GetProperty("category").GetString());
        Assert.Equal(12.5m, items[0].GetProperty("estimatedCostPerPerson").GetDecimal());
        // An unknown price stays unknown, it is not turned into a free stop.
        Assert.Equal(JsonValueKind.Null, items[1].GetProperty("estimatedCostPerPerson").ValueKind);
        Assert.Equal(Evening.AddHours(2).ToUniversalTime(), items[1].GetProperty("startTime").GetDateTimeOffset().ToUniversalTime());
    }

    [Fact]
    public async Task Venue_details_come_from_the_database_not_from_the_request()
    {
        var venue = (await VenuesAsync(1))[0];
        var account = await NewAccountAsync();
        var id = Guid.NewGuid();

        using var saved = await SaveAsync(account.Client, id, Plan(id, "Spoof", Stop(venue.Id, 0, name: "Totally fake name")));

        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        var returned = (await JsonAsync(saved)).GetProperty("plan").GetProperty("items")[0].GetProperty("venue");
        Assert.Equal(venue.Name, returned.GetProperty("name").GetString());
    }

    [Fact]
    public async Task Saving_the_same_plan_again_replaces_it_instead_of_adding_a_second_copy()
    {
        var venues = await VenuesAsync(2);
        var account = await NewAccountAsync();
        var id = Guid.NewGuid();

        (await SaveAsync(account.Client, id, Plan(id, "First", Stop(venues[0].Id, 0)))).EnsureSuccessStatusCode();
        (await SaveAsync(account.Client, id, Plan(id, "Second", Stop(venues[1].Id, 0)))).EnsureSuccessStatusCode();

        var plan = Assert.Single((await ListAsync(account.Client)).EnumerateArray()).GetProperty("plan");
        Assert.Equal("Second", plan.GetProperty("title").GetString());
        Assert.Equal(venues[1].Id.ToString(), plan.GetProperty("items")[0].GetProperty("venue").GetProperty("id").GetString());
        Assert.Equal(1, await _factory.WithDbAsync(db =>
            db.Plans.Where(p => p.SourcePlanId == id).SelectMany(p => p.Items).CountAsync()));
    }

    [Fact]
    public async Task Plans_are_listed_most_recently_saved_first()
    {
        var venue = (await VenuesAsync(1))[0];
        var account = await NewAccountAsync();
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();

        (await SaveAsync(account.Client, first, Plan(first, "A", Stop(venue.Id, 0)))).EnsureSuccessStatusCode();
        (await SaveAsync(account.Client, second, Plan(second, "B", Stop(venue.Id, 0)))).EnsureSuccessStatusCode();

        var titles = (await ListAsync(account.Client)).EnumerateArray().Select(p => p.GetProperty("plan").GetProperty("title").GetString());
        Assert.Equal(["B", "A"], titles);
    }

    [Fact]
    public async Task Accounts_only_see_their_own_plans()
    {
        var venue = (await VenuesAsync(1))[0];
        var ann = await NewAccountAsync();
        var bob = await NewAccountAsync();
        var id = Guid.NewGuid();
        (await SaveAsync(ann.Client, id, Plan(id, "Ann's night", Stop(venue.Id, 0)))).EnsureSuccessStatusCode();

        Assert.Equal(0, (await ListAsync(bob.Client)).GetArrayLength());
    }

    [Fact]
    public async Task Another_account_saving_the_same_plan_gets_its_own_copy()
    {
        // E.g. a plan shared with a friend: both can save it, and neither can touch the other's copy.
        var venue = (await VenuesAsync(1))[0];
        var ann = await NewAccountAsync();
        var bob = await NewAccountAsync();
        var id = Guid.NewGuid();
        (await SaveAsync(ann.Client, id, Plan(id, "Ann's night", Stop(venue.Id, 0)))).EnsureSuccessStatusCode();

        using var bobsSave = await SaveAsync(bob.Client, id, Plan(id, "Bob's night", Stop(venue.Id, 0)));
        Assert.Equal(HttpStatusCode.OK, bobsSave.StatusCode);
        var bobsPlan = Assert.Single((await ListAsync(bob.Client)).EnumerateArray()).GetProperty("plan");
        Assert.Equal(id.ToString(), bobsPlan.GetProperty("id").GetString());

        using var delete = await bob.Client.DeleteAsync($"/api/saved-plans/{id}");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
        Assert.Empty((await ListAsync(bob.Client)).EnumerateArray());
        var annsPlan = Assert.Single((await ListAsync(ann.Client)).EnumerateArray()).GetProperty("plan");
        Assert.Equal("Ann's night", annsPlan.GetProperty("title").GetString());
    }

    [Fact]
    public async Task A_deleted_account_cannot_save_even_with_a_valid_token()
    {
        var venue = (await VenuesAsync(1))[0];
        var account = await NewAccountAsync();
        await _factory.WithDbAsync(db => db.Users.Where(u => u.Email == account.Email).ExecuteDeleteAsync());
        var id = Guid.NewGuid();

        using var response = await SaveAsync(account.Client, id, Plan(id, "Too late", Stop(venue.Id, 0)));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Deleting_removes_the_plan_and_deleting_it_again_is_harmless()
    {
        var venue = (await VenuesAsync(1))[0];
        var account = await NewAccountAsync();
        var id = Guid.NewGuid();
        (await SaveAsync(account.Client, id, Plan(id, "Gone soon", Stop(venue.Id, 0)))).EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.NoContent, (await account.Client.DeleteAsync($"/api/saved-plans/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await account.Client.DeleteAsync($"/api/saved-plans/{id}")).StatusCode);

        Assert.Equal(0, (await ListAsync(account.Client)).GetArrayLength());
        Assert.Equal(0, await _factory.WithDbAsync(db => db.Set<PlanItem>().CountAsync(i => i.PlanId == id)));
    }

    public static TheoryData<string> InvalidPlans => new()
    {
        "id-mismatch", "no-title", "no-stops", "too-many-stops", "unknown-venue", "malformed-venue",
        "ends-before-start", "overlap", "negative-cost", "huge-cost", "unknown-activity", "no-total-distance",
    };

    [Theory]
    [MemberData(nameof(InvalidPlans))]
    public async Task An_invalid_plan_is_rejected_with_400_and_nothing_is_saved(string problem)
    {
        var venue = (await VenuesAsync(1))[0].Id;
        var account = await NewAccountAsync();
        var id = Guid.NewGuid();
        object Ok(int position) => Stop(venue, position);

        object plan = problem switch
        {
            "id-mismatch" => Plan(Guid.NewGuid(), "Wrong id", Ok(0)),
            "no-title" => Plan(id, "  ", Ok(0)),
            "no-stops" => Plan(id, "Empty"),
            "too-many-stops" => Plan(id, "Marathon", Enumerable.Range(0, SavedPlanService.MaxItems + 1).Select(Ok).ToArray()),
            "unknown-venue" => Plan(id, "Ghost", Stop(int.MaxValue, 0)),
            "malformed-venue" => Plan(id, "Odd", RawStop("abc", Evening, Evening.AddHours(1))),
            "ends-before-start" => Plan(id, "Backwards", RawStop(venue.ToString(), Evening, Evening.AddHours(-1))),
            "overlap" => Plan(id, "Overlap", Stop(venue, 0), RawStop(venue.ToString(), Evening.AddMinutes(30), Evening.AddHours(2), "drinks")),
            "negative-cost" => Plan(id, "Refund", Stop(venue, 0, cost: -5m)),
            "huge-cost" => Plan(id, "Yacht", Stop(venue, 0, cost: 10_000_000m)), // more than the column holds
            "unknown-activity" => Plan(id, "Mystery", Stop(venue, 0, activity: "teleport")),
            _ => new { id = id.ToString(), title = "No distance", summary = "x", items = new[] { Ok(0) } },
        };

        using var response = await SaveAsync(account.Client, id, plan);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, (await ListAsync(account.Client)).GetArrayLength());
    }

    [Fact]
    public async Task Saving_the_same_plan_many_times_at_once_keeps_one_copy()
    {
        // A double tap, or two devices: concurrent first saves and concurrent re-saves.
        var venue = (await VenuesAsync(1))[0];
        var account = await NewAccountAsync();
        var id = Guid.NewGuid();

        for (var round = 0; round < 2; round++)
        {
            var responses = await Task.WhenAll(Enumerable.Range(0, 8).Select(i =>
                SaveAsync(account.Client, id, Plan(id, $"Version {i}", Stop(venue.Id, 0)))));

            Assert.All(responses, response => Assert.Equal(HttpStatusCode.OK, response.StatusCode));
            Assert.Single((await ListAsync(account.Client)).EnumerateArray());
            Assert.Equal(1, await _factory.WithDbAsync(db => db.Plans.CountAsync(p => p.SourcePlanId == id)));
            foreach (var response in responses) response.Dispose();
        }
    }

    [Fact]
    public async Task An_account_cannot_save_more_than_the_limit()
    {
        var venue = (await VenuesAsync(1))[0];
        var account = await NewAccountAsync();
        var userId = await _factory.WithDbAsync(db => db.Users.Where(u => u.Email == account.Email).Select(u => u.Id).SingleAsync());
        await _factory.WithDbAsync(async db =>
        {
            db.Plans.AddRange(Enumerable.Range(0, SavedPlanService.MaxPlansPerAccount).Select(i => new Data.Entities.Plan
            {
                UserId = userId,
                SourcePlanId = Guid.NewGuid(),
                Title = $"Plan {i}",
                Summary = "",
                TotalDistanceKm = 0,
                Items = [new PlanItem { Position = 0, VenueId = venue.Id, StartTime = Evening, EndTime = Evening.AddHours(1) }],
            }));
            return await db.SaveChangesAsync();
        });

        var extra = Guid.NewGuid();
        using var refused = await SaveAsync(account.Client, extra, Plan(extra, "One too many", Stop(venue.Id, 0)));

        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);

        // Replacing a plan it already has is still fine at the limit.
        var existing = await _factory.WithDbAsync(db =>
            db.Plans.Where(p => p.UserId == userId).Select(p => p.SourcePlanId!.Value).FirstAsync());
        using var replaced = await SaveAsync(account.Client, existing, Plan(existing, "Updated", Stop(venue.Id, 0)));
        Assert.Equal(HttpStatusCode.OK, replaced.StatusCode);
    }

    [Fact]
    public async Task Deleting_an_account_deletes_its_saved_plans()
    {
        var venue = (await VenuesAsync(1))[0];
        var account = await NewAccountAsync();
        var id = Guid.NewGuid();
        (await SaveAsync(account.Client, id, Plan(id, "Mine", Stop(venue.Id, 0)))).EnsureSuccessStatusCode();

        await _factory.WithDbAsync(db => db.Users.Where(u => u.Email == account.Email).ExecuteDeleteAsync());

        Assert.Equal(0, await _factory.WithDbAsync(db => db.Plans.CountAsync(p => p.Id == id)));
    }

    // Sharing (#152, #153)

    private static async Task<string> ShareAsync(HttpClient client, Guid id)
    {
        using var response = await client.PostAsync($"/api/saved-plans/{id}/share", null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await JsonAsync(response)).GetProperty("url").GetString()!;
    }

    private static string TokenOf(string url) => url[(url.LastIndexOf('/') + 1)..];

    private async Task<HttpResponseMessage> OpenSharedAsync(string url)
    {
        using var anonymous = _factory.CreateClient();
        return await anonymous.GetAsync($"/api/shared-plans/{TokenOf(url)}");
    }

    private async Task<(Account Account, Guid Id)> SavedPlanAsync(string title = "Tapas and drinks")
    {
        var venues = await VenuesAsync(2);
        var account = await NewAccountAsync();
        var id = Guid.NewGuid();
        using var saved = await SaveAsync(account.Client, id, Plan(id, title,
            Stop(venues[0].Id, 0, activity: "dinner"), Stop(venues[1].Id, 1, activity: "drinks")));
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        return (account, id);
    }

    [Fact]
    public async Task Sharing_needs_a_signed_in_account()
    {
        using var anonymous = _factory.CreateClient();
        var id = Guid.NewGuid();

        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsync($"/api/saved-plans/{id}/share", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.DeleteAsync($"/api/saved-plans/{id}/share")).StatusCode);
    }

    [Fact]
    public async Task A_shared_plan_opens_without_an_account_and_shows_only_the_plan()
    {
        var (account, id) = await SavedPlanAsync();

        var url = await ShareAsync(account.Client, id);
        Assert.StartsWith("https://linkup.th7bo.dev/plan/", url);
        Assert.Matches("^[A-Za-z0-9_-]{22}$", TokenOf(url));

        using var response = await OpenSharedAsync(url);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await JsonAsync(response);
        // Nothing about the account that shared it: just the plan.
        Assert.Equal(["plan"], body.EnumerateObject().Select(p => p.Name));
        var plan = body.GetProperty("plan");
        Assert.Equal("Tapas and drinks", plan.GetProperty("title").GetString());
        Assert.Equal(2, plan.GetProperty("items").GetArrayLength());
        Assert.DoesNotContain(account.Email, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Sharing_again_returns_the_same_link_and_the_saved_plan_shows_it()
    {
        var (account, id) = await SavedPlanAsync();

        var first = await ShareAsync(account.Client, id);
        var second = await ShareAsync(account.Client, id);

        Assert.Equal(first, second);
        var saved = Assert.Single((await ListAsync(account.Client)).EnumerateArray());
        Assert.Equal(first, saved.GetProperty("shareUrl").GetString());
    }

    [Fact]
    public async Task A_plan_that_is_not_shared_has_no_link()
    {
        var (account, _) = await SavedPlanAsync();

        var saved = Assert.Single((await ListAsync(account.Client)).EnumerateArray());
        Assert.Equal(JsonValueKind.Null, saved.GetProperty("shareUrl").ValueKind);
    }

    [Fact]
    public async Task Saving_a_shared_plan_again_keeps_its_link_and_the_link_shows_the_new_version()
    {
        var venues = await VenuesAsync(1);
        var (account, id) = await SavedPlanAsync("Old title");
        var url = await ShareAsync(account.Client, id);

        using var resaved = await SaveAsync(account.Client, id, Plan(id, "New title", Stop(venues[0].Id, 0)));
        Assert.Equal(HttpStatusCode.OK, resaved.StatusCode);
        Assert.Equal(url, (await JsonAsync(resaved)).GetProperty("shareUrl").GetString());

        using var opened = await OpenSharedAsync(url);
        Assert.Equal("New title", (await JsonAsync(opened)).GetProperty("plan").GetProperty("title").GetString());
    }

    [Fact]
    public async Task Stopping_sharing_breaks_the_link_and_sharing_again_gives_a_new_one()
    {
        var (account, id) = await SavedPlanAsync();
        var url = await ShareAsync(account.Client, id);

        using (var stopped = await account.Client.DeleteAsync($"/api/saved-plans/{id}/share"))
            Assert.Equal(HttpStatusCode.NoContent, stopped.StatusCode);
        using (var opened = await OpenSharedAsync(url))
            Assert.Equal(HttpStatusCode.NotFound, opened.StatusCode);
        // Stopping again is harmless.
        using (var again = await account.Client.DeleteAsync($"/api/saved-plans/{id}/share"))
            Assert.Equal(HttpStatusCode.NoContent, again.StatusCode);

        var newUrl = await ShareAsync(account.Client, id);
        Assert.NotEqual(url, newUrl);
        using var reopened = await OpenSharedAsync(newUrl);
        Assert.Equal(HttpStatusCode.OK, reopened.StatusCode);
    }

    [Fact]
    public async Task Deleting_a_shared_plan_breaks_its_link()
    {
        var (account, id) = await SavedPlanAsync();
        var url = await ShareAsync(account.Client, id);

        using (var deleted = await account.Client.DeleteAsync($"/api/saved-plans/{id}"))
            Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);

        using var opened = await OpenSharedAsync(url);
        Assert.Equal(HttpStatusCode.NotFound, opened.StatusCode);
    }

    [Fact]
    public async Task An_account_cannot_share_or_unshare_a_plan_it_did_not_save()
    {
        var (owner, id) = await SavedPlanAsync();
        var url = await ShareAsync(owner.Client, id);
        var other = await NewAccountAsync();

        using (var share = await other.Client.PostAsync($"/api/saved-plans/{id}/share", null))
            Assert.Equal(HttpStatusCode.NotFound, share.StatusCode);
        using (var unshare = await other.Client.DeleteAsync($"/api/saved-plans/{id}/share"))
            Assert.Equal(HttpStatusCode.NoContent, unshare.StatusCode);

        // The owner's link still works.
        using var opened = await OpenSharedAsync(url);
        Assert.Equal(HttpStatusCode.OK, opened.StatusCode);
    }

    [Fact]
    public async Task Someone_who_got_the_link_can_save_their_own_copy_and_keep_it_after_the_owner_deletes_it()
    {
        var (owner, id) = await SavedPlanAsync();
        var url = await ShareAsync(owner.Client, id);
        var friend = await NewAccountAsync();

        // The friend opens the link and saves the plan exactly as the shared page returned it.
        using var opened = await OpenSharedAsync(url);
        var shared = (await JsonAsync(opened)).GetProperty("plan");
        using (var saved = await friend.Client.PutAsync(
            $"/api/saved-plans/{shared.GetProperty("id").GetString()}",
            new StringContent(shared.GetRawText(), System.Text.Encoding.UTF8, "application/json")))
            Assert.Equal(HttpStatusCode.OK, saved.StatusCode);

        using (var deleted = await owner.Client.DeleteAsync($"/api/saved-plans/{id}"))
            Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);

        var copy = Assert.Single((await ListAsync(friend.Client)).EnumerateArray());
        Assert.Equal("Tapas and drinks", copy.GetProperty("plan").GetProperty("title").GetString());
        Assert.Equal(2, copy.GetProperty("plan").GetProperty("items").GetArrayLength());
        // The copy is the friend's own: not shared, and the owner's link is gone.
        Assert.Equal(JsonValueKind.Null, copy.GetProperty("shareUrl").ValueKind);
        using var gone = await OpenSharedAsync(url);
        Assert.Equal(HttpStatusCode.NotFound, gone.StatusCode);
    }

    [Theory]
    [InlineData("AAAAAAAAAAAAAAAAAAAAAA")] // the right shape, but no plan has it
    [InlineData("abc")]
    [InlineData("AAAAAAAAAAAAAAAAAAAA.A")]
    [InlineData("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")]
    public async Task An_unknown_or_malformed_link_is_404(string token)
    {
        using var anonymous = _factory.CreateClient();

        using var response = await anonymous.GetAsync($"/api/shared-plans/{token}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
