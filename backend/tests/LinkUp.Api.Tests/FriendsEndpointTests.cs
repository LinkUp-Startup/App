using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

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

    private static async Task<string?> ProblemTitleAsync(Task<HttpResponseMessage> request)
    {
        using var response = await request;
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return body.RootElement.GetProperty("title").GetString();
    }

    private static string SignedToken(string? subject) => new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
    {
        Issuer = TestJwt.Issuer,
        Audience = TestJwt.Audience,
        Subject = new ClaimsIdentity(subject is null ? [] : [new Claim("sub", subject)]),
        Expires = DateTime.UtcNow.AddMinutes(10),
        SigningCredentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(TestJwt.SigningKey)), SecurityAlgorithms.HmacSha256),
    });

    private static IEnumerable<HttpRequestMessage> EveryFriendsRequest(Guid other) =>
    [
        new(HttpMethod.Get, "/api/friends"),
        new(HttpMethod.Get, "/api/users/search?query=ann"),
        new(HttpMethod.Post, $"/api/friends/requests/{other}"),
        new(HttpMethod.Post, $"/api/friends/requests/{other}/accept"),
        new(HttpMethod.Post, $"/api/friends/requests/{other}/decline"),
        new(HttpMethod.Delete, $"/api/friends/{other}"),
    ];

    [Fact]
    public async Task Every_friends_endpoint_requires_login()
    {
        using var anonymous = factory.CreateClient();

        foreach (var request in EveryFriendsRequest(Guid.NewGuid()))
        {
            using (request)
                await AssertStatusAsync(HttpStatusCode.Unauthorized, anonymous.SendAsync(request));
        }
    }

    [Theory]
    [InlineData(null)]
    [InlineData("not-a-guid")]
    public async Task Signed_tokens_without_a_user_id_are_unauthorized(string? subject)
    {
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", SignedToken(subject));

        foreach (var request in EveryFriendsRequest(Guid.NewGuid()))
        {
            using (request)
                await AssertStatusAsync(HttpStatusCode.Unauthorized, client.SendAsync(request));
        }
    }

    [Fact]
    public async Task A_deleted_account_cannot_send_requests()
    {
        var (ann, bob) = (await NewAccountAsync(), await NewAccountAsync());
        await factory.WithDbAsync(db => db.Users.Where(u => u.Id == ann.Id).ExecuteDeleteAsync());

        // The token is still valid, but saving would break the foreign key
        await AssertStatusAsync(HttpStatusCode.Unauthorized, SendAsync(ann, bob));
        Assert.Empty(UserIds(await FriendsOfAsync(bob), "incoming"));
    }

    [Fact]
    public async Task Errors_have_a_title_the_app_can_show()
    {
        var (ann, bob) = (await NewAccountAsync(), await NewAccountAsync());

        Assert.Equal("You can't send a friend request to yourself.", await ProblemTitleAsync(SendAsync(ann, ann)));
        Assert.Equal("User not found.",
            await ProblemTitleAsync(ann.Client.PostAsync($"/api/friends/requests/{Guid.NewGuid()}", null)));
        Assert.Equal("There is no pending friend request from this user.", await ProblemTitleAsync(AcceptAsync(bob, ann)));

        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(ann, bob));
        Assert.Equal("This user already sent you a friend request. Accept it instead.",
            await ProblemTitleAsync(SendAsync(bob, ann)));
        Assert.Equal("Only the person who received the request can accept or decline it.",
            await ProblemTitleAsync(AcceptAsync(ann, bob)));

        await AssertStatusAsync(HttpStatusCode.NoContent, AcceptAsync(bob, ann));
        Assert.Equal("You are already friends.", await ProblemTitleAsync(SendAsync(bob, ann)));
    }

    [Fact]
    public async Task An_answered_request_cannot_be_answered_again()
    {
        var (ann, bob, carol) = (await NewAccountAsync(), await NewAccountAsync(), await NewAccountAsync());
        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(ann, bob));
        await AssertStatusAsync(HttpStatusCode.NoContent, AcceptAsync(bob, ann));
        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(carol, bob));
        await AssertStatusAsync(HttpStatusCode.NoContent, DeclineAsync(bob, carol));

        await AssertStatusAsync(HttpStatusCode.NotFound, AcceptAsync(bob, ann));
        await AssertStatusAsync(HttpStatusCode.NotFound, DeclineAsync(bob, ann)); // Declining a friend does not unfriend
        await AssertStatusAsync(HttpStatusCode.NotFound, AcceptAsync(bob, carol)); // Declined stays declined

        Assert.Equal([ann.Id], UserIds(await FriendsOfAsync(bob), "friends"));
    }

    [Fact]
    public async Task The_receiver_of_a_declined_request_can_send_one_back()
    {
        var (ann, bob) = (await NewAccountAsync(), await NewAccountAsync());
        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(ann, bob));
        await AssertStatusAsync(HttpStatusCode.NoContent, DeclineAsync(bob, ann));

        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(bob, ann));

        // The pair's row is reused, now as Bob's request: only Ann can answer it
        Assert.Equal([ann.Id], UserIds(await FriendsOfAsync(bob), "outgoing"));
        Assert.Equal([bob.Id], UserIds(await FriendsOfAsync(ann), "incoming"));
        await AssertStatusAsync(HttpStatusCode.Forbidden, AcceptAsync(bob, ann));
        await AssertStatusAsync(HttpStatusCode.NoContent, AcceptAsync(ann, bob));
        Assert.Equal([bob.Id], UserIds(await FriendsOfAsync(ann), "friends"));
    }

    [Fact]
    public async Task List_sorts_friends_by_name_and_requests_newest_first()
    {
        var tag = Guid.NewGuid().ToString("N")[..8];
        var me = await NewAccountAsync();
        var zoe = await NewAccountAsync($"zoe {tag}");
        var bea = await NewAccountAsync($"Bea {tag}");
        var amy = await NewAccountAsync($"amy {tag}");
        foreach (var friend in new[] { zoe, bea, amy })
        {
            await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(friend, me));
            await AssertStatusAsync(HttpStatusCode.NoContent, AcceptAsync(me, friend));
        }
        var (first, second) = (await NewAccountAsync(), await NewAccountAsync());
        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(first, me));
        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(second, me));
        var (third, fourth) = (await NewAccountAsync(), await NewAccountAsync());
        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(me, third));
        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(me, fourth));

        var list = await FriendsOfAsync(me);

        Assert.Equal([amy.Id, bea.Id, zoe.Id], UserIds(list, "friends")); // Case does not matter
        Assert.Equal([second.Id, first.Id], UserIds(list, "incoming"));
        Assert.Equal([fourth.Id, third.Id], UserIds(list, "outgoing"));

        var amyEntry = list.GetProperty("friends")[0];
        Assert.Equal(amy.DisplayName, amyEntry.GetProperty("displayName").GetString());
        Assert.True(amyEntry.GetProperty("since").GetDateTimeOffset() > DateTimeOffset.UtcNow.AddMinutes(-5));
        var request = list.GetProperty("incoming")[0];
        Assert.Equal(second.DisplayName, request.GetProperty("displayName").GetString());
        Assert.True(request.TryGetProperty("sentAt", out _));
    }

    [Fact]
    public async Task List_is_empty_for_a_new_account_and_never_shows_others_requests()
    {
        var (ann, bob, carol) = (await NewAccountAsync(), await NewAccountAsync(), await NewAccountAsync());
        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(ann, bob));

        var list = await FriendsOfAsync(carol);

        Assert.Empty(UserIds(list, "friends"));
        Assert.Empty(UserIds(list, "incoming"));
        Assert.Empty(UserIds(list, "outgoing"));
    }

    [Fact]
    public async Task Search_shows_a_sent_request_to_the_sender()
    {
        var (ann, bob) = (await NewAccountAsync(), await NewAccountAsync());
        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(ann, bob));

        var found = (await SearchAsync(ann, bob.DisplayName)).Single();

        Assert.Equal(bob.Id, found.GetProperty("id").GetGuid());
        Assert.Equal("requestSent", found.GetProperty("relation").GetString());
    }

    [Fact]
    public async Task Search_trims_the_text_and_returns_at_most_20_sorted_by_name()
    {
        var tag = Guid.NewGuid().ToString("N")[..10];
        var me = await NewAccountAsync();
        for (var i = 0; i < 22; i++)
            await NewAccountAsync($"{tag} {i:D2}");

        var users = await SearchAsync(me, $"  {tag}  ");

        Assert.Equal(20, users.Length);
        var names = users.Select(u => u.GetProperty("displayName").GetString()).ToArray();
        Assert.Equal(Enumerable.Range(0, 20).Select(i => $"{tag} {i:D2}"), names);
    }

    [Fact]
    public async Task Search_text_is_limited_to_50_characters()
    {
        var me = await NewAccountAsync();

        await AssertStatusAsync(HttpStatusCode.BadRequest,
            me.Client.GetAsync($"/api/users/search?query={new string('a', 51)}"));
        await AssertStatusAsync(HttpStatusCode.OK,
            me.Client.GetAsync($"/api/users/search?query={new string('a', 50)}"));
    }

    [Fact]
    public async Task Search_needs_two_characters_besides_spaces()
    {
        var me = await NewAccountAsync();
        await NewAccountAsync("a  padded name");

        // Only spaces is rejected; one letter with spaces passes validation but finds no one once trimmed
        await AssertStatusAsync(HttpStatusCode.BadRequest, me.Client.GetAsync("/api/users/search?query=%20%20%20"));
        Assert.Empty(await SearchAsync(me, "a  "));
    }

    [Fact]
    public async Task Removed_friends_can_become_friends_again()
    {
        var (ann, bob) = (await NewAccountAsync(), await NewAccountAsync());
        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(ann, bob));
        await AssertStatusAsync(HttpStatusCode.NoContent, AcceptAsync(bob, ann));
        await AssertStatusAsync(HttpStatusCode.NoContent, ann.Client.DeleteAsync($"/api/friends/{bob.Id}"));

        Assert.Equal("none", (await SearchAsync(bob, ann.DisplayName)).Single().GetProperty("relation").GetString());
        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(bob, ann));
        await AssertStatusAsync(HttpStatusCode.NoContent, AcceptAsync(ann, bob));
        Assert.Equal([ann.Id], UserIds(await FriendsOfAsync(bob), "friends"));
    }

    [Fact]
    public async Task Removing_someone_you_have_no_friendship_with_does_nothing()
    {
        var (ann, bob, carol) = (await NewAccountAsync(), await NewAccountAsync(), await NewAccountAsync());
        await AssertStatusAsync(HttpStatusCode.NoContent, SendAsync(bob, carol));
        await AssertStatusAsync(HttpStatusCode.NoContent, AcceptAsync(carol, bob));

        await AssertStatusAsync(HttpStatusCode.NoContent, ann.Client.DeleteAsync($"/api/friends/{bob.Id}"));
        await AssertStatusAsync(HttpStatusCode.NoContent, ann.Client.DeleteAsync($"/api/friends/{Guid.NewGuid()}"));

        Assert.Equal([carol.Id], UserIds(await FriendsOfAsync(bob), "friends")); // Other people's friendships stay
    }

    [Fact]
    public async Task Requests_sent_by_both_sides_at_once_leave_one_consistent_row()
    {
        var pairs = new List<(Account Ann, Account Bob)>();
        for (var i = 0; i < 5; i++)
            pairs.Add((await NewAccountAsync(), await NewAccountAsync()));

        foreach (var (ann, bob) in pairs)
        {
            var responses = await Task.WhenAll(SendAsync(ann, bob), SendAsync(bob, ann));
            try
            {
                // At least one succeeds; the other is 204 too, or 409 (accept instead, or it raced)
                Assert.Contains(responses, r => r.StatusCode == HttpStatusCode.NoContent);
                Assert.All(responses, r => Assert.Contains(r.StatusCode, new[] { HttpStatusCode.NoContent, HttpStatusCode.Conflict }));
            }
            finally
            {
                foreach (var response in responses) response.Dispose();
            }

            var (userA, userB) = LinkUp.Api.Data.Entities.Friendship.OrderPair(ann.Id, bob.Id);
            var rows = await factory.WithDbAsync(db =>
                db.Friendships.CountAsync(f => f.UserAId == userA && f.UserBId == userB));
            Assert.Equal(1, rows);
            var pending = UserIds(await FriendsOfAsync(ann), "outgoing").Length + UserIds(await FriendsOfAsync(ann), "incoming").Length;
            Assert.Equal(1, pending);
        }
    }
}
