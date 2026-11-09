using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace LinkUp.Api.Tests;

public sealed class FriendsEndpointTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>
{
    private const string Password = "correct-horse-battery";

    private sealed record Account(HttpClient Client, Guid Id, string Email, string DisplayName);

    private async Task<Account> NewAccountAsync(string? displayName = null)
    {
        var email = $"{Guid.NewGuid():N}@example.com";
        displayName ??= $"User {Guid.NewGuid():N}"[..20];
        using var anonymous = factory.CreateClient();
        var response = await anonymous.PostAsJsonAsync("/api/auth/register", new { email, password = Password, displayName });
        response.EnsureSuccessStatusCode();

        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", body.RootElement.GetProperty("accessToken").GetString());
        return new Account(client, body.RootElement.GetProperty("user").GetProperty("id").GetGuid(), email, displayName);
    }

    private static Task<HttpResponseMessage> SendAsync(Account from, Account to) =>
        from.Client.PostAsync($"/api/friends/requests/{to.Id}", null);

    private static Task<HttpResponseMessage> AcceptAsync(Account receiver, Account sender) =>
        receiver.Client.PostAsync($"/api/friends/requests/{sender.Id}/accept", null);

    private static Task<HttpResponseMessage> DeclineAsync(Account receiver, Account sender) =>
        receiver.Client.PostAsync($"/api/friends/requests/{sender.Id}/decline", null);

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();
    }

    private static async Task<JsonElement> FriendsOfAsync(Account account) =>
        await JsonAsync(await account.Client.GetAsync("/api/friends"));

    private static async Task<JsonElement[]> SearchAsync(Account account, string query) =>
        (await JsonAsync(await account.Client.GetAsync($"/api/users/search?query={Uri.EscapeDataString(query)}")))
            .GetProperty("users").EnumerateArray().ToArray();

    private static Guid[] UserIds(JsonElement friends, string list) =>
        friends.GetProperty(list).EnumerateArray().Select(f => f.GetProperty("userId").GetGuid()).ToArray();

    private static async Task AssertStatusAsync(HttpStatusCode expected, Task<HttpResponseMessage> request)
    {
        using var response = await request;
        Assert.Equal(expected, response.StatusCode);
    }

    [Fact]
    public async Task Search_finds_users_by_name_and_never_returns_emails()
    {
        var tag = Guid.NewGuid().ToString("N")[..10];
        var me = await NewAccountAsync();
        var ann = await NewAccountAsync($"{tag} Ann");
        var annabel = await NewAccountAsync($"{tag} ANNABEL");

        using var response = await me.Client.GetAsync($"/api/users/search?query={tag}%20ann");
        var raw = await response.Content.ReadAsStringAsync();
        var users = JsonDocument.Parse(raw).RootElement.GetProperty("users").EnumerateArray().ToArray();

        Assert.Equal(new[] { ann.Id, annabel.Id }.Order(), users.Select(u => u.GetProperty("id").GetGuid()).Order());
        Assert.All(users, u => Assert.Equal(
            new[] { "displayName", "id", "relation" },
            u.EnumerateObject().Select(p => p.Name).Order()));
        Assert.DoesNotContain(ann.Email, raw, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("@", raw);
    }

    [Fact]
    public async Task Search_does_not_find_users_by_email_or_include_yourself()
    {
        var tag = Guid.NewGuid().ToString("N")[..10];
        var me = await NewAccountAsync($"Me {tag}");
        var other = await NewAccountAsync();

        Assert.Empty(await SearchAsync(me, tag));
        Assert.Empty(await SearchAsync(me, other.Email));
    }

    [Fact]
    public async Task Search_matches_wildcards_literally()
    {
        var me = await NewAccountAsync();

        var users = await SearchAsync(me, "%%");

        Assert.All(users, u => Assert.Contains("%%", u.GetProperty("displayName").GetString()));
    }

    [Theory]
    [InlineData("/api/users/search?query=a")]
    [InlineData("/api/users/search")]
    public async Task Search_needs_at_least_two_characters(string url)
    {
        var me = await NewAccountAsync();

        await AssertStatusAsync(HttpStatusCode.BadRequest, me.Client.GetAsync(url));
    }

    [Theory]
    [InlineData("/api/users/search?query=ann")]
    [InlineData("/api/friends")]
    public async Task Endpoints_require_login(string url)
    {
        using var anonymous = factory.CreateClient();

        await AssertStatusAsync(HttpStatusCode.Unauthorized, anonymous.GetAsync(url));
    }

    [Fact]
    public async Task Request_can_be_sent_and_accepted()
    {
        var (ann, bob) = (await NewAccountAsync(), await NewAccountAsync());

        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(ann, bob));
        Assert.Equal([bob.Id], UserIds(await FriendsOfAsync(ann), "outgoing"));
        Assert.Equal([ann.Id], UserIds(await FriendsOfAsync(bob), "incoming"));
        Assert.Equal("requestReceived",
            (await SearchAsync(bob, ann.DisplayName)).Single().GetProperty("relation").GetString());

        await AssertStatusAsync(HttpStatusCode.NoContent, AcceptAsync(bob, ann));

        var annFriends = await FriendsOfAsync(ann);
        Assert.Equal([bob.Id], UserIds(annFriends, "friends"));
        Assert.Empty(UserIds(annFriends, "outgoing"));
        Assert.Equal([ann.Id], UserIds(await FriendsOfAsync(bob), "friends"));
        Assert.Equal("friends", (await SearchAsync(ann, bob.DisplayName)).Single().GetProperty("relation").GetString());
    }

    [Fact]
    public async Task Only_the_receiver_can_accept_or_decline()
    {
        var (ann, bob) = (await NewAccountAsync(), await NewAccountAsync());
        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(ann, bob));

        await AssertStatusAsync(HttpStatusCode.Forbidden, AcceptAsync(ann, bob));
        await AssertStatusAsync(HttpStatusCode.Forbidden, DeclineAsync(ann, bob));

        Assert.Equal([bob.Id], UserIds(await FriendsOfAsync(ann), "outgoing")); // Still pending
        Assert.Empty(UserIds(await FriendsOfAsync(ann), "friends"));
    }

    [Fact]
    public async Task Declined_request_disappears_and_can_be_sent_again()
    {
        var (ann, bob) = (await NewAccountAsync(), await NewAccountAsync());
        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(ann, bob));

        await AssertStatusAsync(HttpStatusCode.NoContent, DeclineAsync(bob, ann));

        Assert.Empty(UserIds(await FriendsOfAsync(ann), "outgoing"));
        Assert.Empty(UserIds(await FriendsOfAsync(bob), "incoming"));
        Assert.Equal("none", (await SearchAsync(ann, bob.DisplayName)).Single().GetProperty("relation").GetString());

        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(ann, bob));
        Assert.Equal([ann.Id], UserIds(await FriendsOfAsync(bob), "incoming"));
    }

    [Fact]
    public async Task Sending_rules()
    {
        var (ann, bob) = (await NewAccountAsync(), await NewAccountAsync());

        await AssertStatusAsync(HttpStatusCode.BadRequest, SendAsync(ann, ann));
        await AssertStatusAsync(HttpStatusCode.NotFound, ann.Client.PostAsync($"/api/friends/requests/{Guid.NewGuid()}", null));

        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(ann, bob));
        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(ann, bob)); // Again: harmless
        await AssertStatusAsync(HttpStatusCode.Conflict, SendAsync(bob, ann)); // Accept it instead

        await AssertStatusAsync(HttpStatusCode.NoContent, AcceptAsync(bob, ann));
        await AssertStatusAsync(HttpStatusCode.Conflict, SendAsync(ann, bob)); // Already friends
    }

    [Fact]
    public async Task Accepting_without_a_request_is_404()
    {
        var (ann, bob) = (await NewAccountAsync(), await NewAccountAsync());

        await AssertStatusAsync(HttpStatusCode.NotFound, AcceptAsync(bob, ann));
        await AssertStatusAsync(HttpStatusCode.NotFound, DeclineAsync(bob, ann));
    }

    [Fact]
    public async Task Friend_can_be_removed_by_either_side()
    {
        var (ann, bob) = (await NewAccountAsync(), await NewAccountAsync());
        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(ann, bob));
        await AssertStatusAsync(HttpStatusCode.NoContent, AcceptAsync(bob, ann));

        await AssertStatusAsync(HttpStatusCode.NoContent, bob.Client.DeleteAsync($"/api/friends/{ann.Id}"));
        await AssertStatusAsync(HttpStatusCode.NoContent, bob.Client.DeleteAsync($"/api/friends/{ann.Id}")); // Retry

        Assert.Empty(UserIds(await FriendsOfAsync(ann), "friends"));
        Assert.Empty(UserIds(await FriendsOfAsync(bob), "friends"));
    }

    [Fact]
    public async Task Sender_can_cancel_a_request_but_the_receiver_must_decline_it()
    {
        var (ann, bob) = (await NewAccountAsync(), await NewAccountAsync());
        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(ann, bob));

        // The receiver deleting does nothing: they decline instead
        await AssertStatusAsync(HttpStatusCode.NoContent, bob.Client.DeleteAsync($"/api/friends/{ann.Id}"));
        Assert.Equal([ann.Id], UserIds(await FriendsOfAsync(bob), "incoming"));

        await AssertStatusAsync(HttpStatusCode.NoContent, ann.Client.DeleteAsync($"/api/friends/{bob.Id}"));
        Assert.Empty(UserIds(await FriendsOfAsync(bob), "incoming"));
    }
}