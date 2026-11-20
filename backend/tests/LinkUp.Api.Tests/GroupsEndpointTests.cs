using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace LinkUp.Api.Tests;

/// <summary>Creating groups, adding and removing members, and who can see a group (#167).</summary>
public sealed class GroupsEndpointTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>
{
    [Theory]
    [InlineData("GET", "/api/groups")]
    [InlineData("POST", "/api/groups")]
    [InlineData("GET", "/api/groups/00000000-0000-0000-0000-000000000001")]
    [InlineData("POST", "/api/groups/00000000-0000-0000-0000-000000000001/members/00000000-0000-0000-0000-000000000002")]
    [InlineData("DELETE", "/api/groups/00000000-0000-0000-0000-000000000001/members/00000000-0000-0000-0000-000000000002")]
    public async Task Endpoints_require_login(string method, string url)
    {
        using var anonymous = factory.CreateClient();

        await GroupTestApi.AssertStatusAsync(HttpStatusCode.Unauthorized,
            anonymous.SendAsync(new HttpRequestMessage(new HttpMethod(method), url)));
    }

    // A correctly signed token whose subject is missing or isn't a user id
    private static string SignedToken(string? subject) => new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
    {
        Issuer = TestJwt.Issuer,
        Audience = TestJwt.Audience,
        Subject = new ClaimsIdentity(subject is null ? [] : [new Claim("sub", subject)]),
        Expires = DateTime.UtcNow.AddMinutes(10),
        SigningCredentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(TestJwt.SigningKey)), SecurityAlgorithms.HmacSha256),
    });

    private static IEnumerable<HttpRequestMessage> EveryGroupRequest(Guid groupId, Guid userId) =>
    [
        new(HttpMethod.Get, "/api/groups"),
        new(HttpMethod.Post, "/api/groups") { Content = JsonContent.Create(new { name = "Crew" }) },
        new(HttpMethod.Get, $"/api/groups/{groupId}"),
        new(HttpMethod.Post, $"/api/groups/{groupId}/members/{userId}"),
        new(HttpMethod.Delete, $"/api/groups/{groupId}/members/{userId}"),
        new(HttpMethod.Get, $"/api/groups/{groupId}/plans"),
        new(HttpMethod.Post, $"/api/groups/{groupId}/plans/generate")
        {
            Content = JsonContent.Create(new
            {
                preferences = new
                {
                    budgetPerPerson = 30, groupSize = 1, activities = new[] { "drinks" },
                    startTime = "2026-10-30T20:00:00Z", endTime = "2026-10-31T02:00:00Z",
                    maxDistanceKm = 3, transport = new[] { "walking" },
                },
            }),
        },
    ];

    [Theory]
    [InlineData(null)]
    [InlineData("not-a-guid")]
    public async Task Signed_tokens_without_a_user_id_are_unauthorized(string? subject)
    {
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", SignedToken(subject));

        foreach (var request in EveryGroupRequest(Guid.NewGuid(), Guid.NewGuid()))
        {
            using (request)
                await GroupTestApi.AssertStatusAsync(HttpStatusCode.Unauthorized, client.SendAsync(request));
        }
    }

    [Fact]
    public async Task Creator_is_the_owner_and_friends_are_members()
    {
        var (ann, bob) = (await GroupTestApi.NewAccountAsync(factory), await GroupTestApi.NewAccountAsync(factory));
        await GroupTestApi.BefriendAsync(ann, bob);

        // Duplicates and the creator's own id in the list are ignored
        using var response = await ann.Client.PostAsJsonAsync("/api/groups",
            new { name = "  Friday crew  ", memberIds = new[] { bob.Id, bob.Id, ann.Id } });
        var group = await GroupTestApi.JsonAsync(response, HttpStatusCode.Created);

        var id = group.GetProperty("id").GetGuid();
        Assert.Equal($"/api/groups/{id}", response.Headers.Location?.AbsolutePath);
        Assert.Equal("Friday crew", group.GetProperty("name").GetString());
        Assert.Equal("owner", group.GetProperty("myRole").GetString());
        var members = group.GetProperty("members").EnumerateArray().ToArray();
        Assert.Equal([ann.Id, bob.Id], members.Select(m => m.GetProperty("userId").GetGuid()));
        Assert.Equal(["owner", "member"], members.Select(m => m.GetProperty("role").GetString()));
        Assert.Equal(bob.DisplayName, members[1].GetProperty("displayName").GetString());

        Assert.Equal("member", (await GroupTestApi.GroupAsync(bob, id)).GetProperty("myRole").GetString());
    }

    [Fact]
    public async Task A_group_can_be_created_without_members()
    {
        var ann = await GroupTestApi.NewAccountAsync(factory);

        var group = await GroupTestApi.JsonAsync(
            await ann.Client.PostAsJsonAsync("/api/groups", new { name = "Just me" }), HttpStatusCode.Created);

        Assert.Equal([ann.Id], GroupTestApi.MemberIds(group));
    }

    [Fact]
    public async Task A_user_can_be_in_several_groups_listed_newest_first()
    {
        var (ann, bob) = (await GroupTestApi.NewAccountAsync(factory), await GroupTestApi.NewAccountAsync(factory));
        await GroupTestApi.BefriendAsync(ann, bob);
        var first = await GroupTestApi.CreateGroupAsync(ann, "First", bob);
        var second = await GroupTestApi.CreateGroupAsync(bob, "Second", ann);

        var groups = (await GroupTestApi.JsonAsync(await ann.Client.GetAsync("/api/groups")))
            .GetProperty("groups").EnumerateArray().ToArray();

        Assert.Equal([second, first], groups.Select(g => g.GetProperty("id").GetGuid()));
        Assert.Equal(["Second", "First"], groups.Select(g => g.GetProperty("name").GetString()));
        Assert.Equal(["member", "owner"], groups.Select(g => g.GetProperty("myRole").GetString()));
        Assert.All(groups, g => Assert.Equal(2, g.GetProperty("memberCount").GetInt32()));
    }

    [Fact]
    public async Task Only_friends_can_be_added()
    {
        var (ann, stranger) = (await GroupTestApi.NewAccountAsync(factory), await GroupTestApi.NewAccountAsync(factory));

        using var create = await ann.Client.PostAsJsonAsync("/api/groups", new { name = "Crew", memberIds = new[] { stranger.Id } });
        var problem = await GroupTestApi.JsonAsync(create, HttpStatusCode.Forbidden);
        Assert.Contains(stranger.Id.ToString(), problem.GetProperty("detail").GetString());
        Assert.Empty((await GroupTestApi.JsonAsync(await ann.Client.GetAsync("/api/groups"))).GetProperty("groups").EnumerateArray());

        var groupId = await GroupTestApi.CreateGroupAsync(ann);
        await GroupTestApi.AssertStatusAsync(HttpStatusCode.Forbidden,
            ann.Client.PostAsync($"/api/groups/{groupId}/members/{stranger.Id}", null));
        Assert.Equal([ann.Id], GroupTestApi.MemberIds(await GroupTestApi.GroupAsync(ann, groupId)));
    }

    [Fact]
    public async Task A_pending_or_declined_request_is_not_a_friendship()
    {
        var (ann, bob, cat) = (await GroupTestApi.NewAccountAsync(factory), await GroupTestApi.NewAccountAsync(factory),
            await GroupTestApi.NewAccountAsync(factory));
        (await ann.Client.PostAsync($"/api/friends/requests/{bob.Id}", null)).EnsureSuccessStatusCode();
        (await ann.Client.PostAsync($"/api/friends/requests/{cat.Id}", null)).EnsureSuccessStatusCode();
        (await cat.Client.PostAsync($"/api/friends/requests/{ann.Id}/decline", null)).EnsureSuccessStatusCode();
        var groupId = await GroupTestApi.CreateGroupAsync(ann);

        await GroupTestApi.AssertStatusAsync(HttpStatusCode.Forbidden,
            ann.Client.PostAsync($"/api/groups/{groupId}/members/{bob.Id}", null));
        await GroupTestApi.AssertStatusAsync(HttpStatusCode.Forbidden,
            ann.Client.PostAsync($"/api/groups/{groupId}/members/{cat.Id}", null));
    }

    [Fact]
    public async Task Any_member_can_add_their_own_friends_and_adding_twice_is_harmless()
    {
        var (ann, bob, cat) = (await GroupTestApi.NewAccountAsync(factory), await GroupTestApi.NewAccountAsync(factory),
            await GroupTestApi.NewAccountAsync(factory));
        await GroupTestApi.BefriendAsync(ann, bob);
        await GroupTestApi.BefriendAsync(bob, cat);
        var groupId = await GroupTestApi.CreateGroupAsync(ann, "Crew", bob);

        await GroupTestApi.AssertStatusAsync(HttpStatusCode.NoContent,
            bob.Client.PostAsync($"/api/groups/{groupId}/members/{cat.Id}", null));
        await GroupTestApi.AssertStatusAsync(HttpStatusCode.NoContent,
            bob.Client.PostAsync($"/api/groups/{groupId}/members/{cat.Id}", null));
        // Cat is not Ann's friend, but already a member: nothing to do
        await GroupTestApi.AssertStatusAsync(HttpStatusCode.NoContent,
            ann.Client.PostAsync($"/api/groups/{groupId}/members/{cat.Id}", null));

        Assert.Equal([ann.Id, bob.Id, cat.Id], GroupTestApi.MemberIds(await GroupTestApi.GroupAsync(cat, groupId)));
    }

    [Fact]
    public async Task Only_members_can_see_or_change_a_group()
    {
        var (ann, outsider) = (await GroupTestApi.NewAccountAsync(factory), await GroupTestApi.NewAccountAsync(factory));
        await GroupTestApi.BefriendAsync(ann, outsider);
        var groupId = await GroupTestApi.CreateGroupAsync(ann);

        await GroupTestApi.AssertStatusAsync(HttpStatusCode.NotFound, outsider.Client.GetAsync($"/api/groups/{groupId}"));
        // Being friends with a member doesn't let you add yourself, or change anything
        await GroupTestApi.AssertStatusAsync(HttpStatusCode.NotFound,
            outsider.Client.PostAsync($"/api/groups/{groupId}/members/{ann.Id}", null));
        await GroupTestApi.AssertStatusAsync(HttpStatusCode.NotFound,
            outsider.Client.DeleteAsync($"/api/groups/{groupId}/members/{ann.Id}"));
        Assert.Empty((await GroupTestApi.JsonAsync(await outsider.Client.GetAsync("/api/groups"))).GetProperty("groups").EnumerateArray());

        await GroupTestApi.AssertStatusAsync(HttpStatusCode.NotFound, ann.Client.GetAsync($"/api/groups/{Guid.NewGuid()}"));
        Assert.Equal([ann.Id], GroupTestApi.MemberIds(await GroupTestApi.GroupAsync(ann, groupId)));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public async Task A_group_needs_a_name(string? name)
    {
        var ann = await GroupTestApi.NewAccountAsync(factory);

        await GroupTestApi.AssertStatusAsync(HttpStatusCode.BadRequest, ann.Client.PostAsJsonAsync("/api/groups", new { name }));
    }

    [Fact]
    public async Task Names_longer_than_the_limit_are_rejected()
    {
        var ann = await GroupTestApi.NewAccountAsync(factory);

        await GroupTestApi.AssertStatusAsync(HttpStatusCode.BadRequest,
            ann.Client.PostAsJsonAsync("/api/groups", new { name = new string('a', GroupLimits.NameMaxLength + 1) }));
        await GroupTestApi.AssertStatusAsync(HttpStatusCode.Created,
            ann.Client.PostAsJsonAsync("/api/groups", new { name = new string('a', GroupLimits.NameMaxLength) }));
    }

    [Fact]
    public async Task A_full_group_takes_no_more_members()
    {
        var owner = await GroupTestApi.NewAccountAsync(factory);
        var groupId = await GroupTestApi.CreateGroupAsync(owner);
        await AddFillerMembersAsync(groupId, GroupLimits.MaxMembers - 1);
        var friend = await GroupTestApi.NewAccountAsync(factory);
        await GroupTestApi.BefriendAsync(owner, friend);

        await GroupTestApi.AssertStatusAsync(HttpStatusCode.Conflict,
            owner.Client.PostAsync($"/api/groups/{groupId}/members/{friend.Id}", null));
    }

    [Fact]
    public async Task A_user_can_be_in_a_limited_number_of_groups()
    {
        var ann = await GroupTestApi.NewAccountAsync(factory);
        await factory.WithDbAsync(db =>
        {
            for (var i = 0; i < GroupLimits.MaxGroupsPerUser; i++)
                db.Groups.Add(new Group { Name = $"G{i}", Members = [new GroupMember { UserId = ann.Id, Role = GroupRole.Owner }] });
            return db.SaveChangesAsync();
        });

        await GroupTestApi.AssertStatusAsync(HttpStatusCode.Conflict,
            ann.Client.PostAsJsonAsync("/api/groups", new { name = "One too many" }));
    }

    [Fact]
    public async Task A_token_whose_account_was_deleted_cannot_create_a_group()
    {
        var ann = await GroupTestApi.NewAccountAsync(factory);
        await factory.WithDbAsync(db => db.Users.Where(u => u.Id == ann.Id).ExecuteDeleteAsync());

        await GroupTestApi.AssertStatusAsync(HttpStatusCode.Unauthorized,
            ann.Client.PostAsJsonAsync("/api/groups", new { name = "Ghost" }));
    }

    [Fact]
    public async Task Members_can_leave_and_only_the_owner_removes_others()
    {
        var (ann, bob, cat) = (await GroupTestApi.NewAccountAsync(factory), await GroupTestApi.NewAccountAsync(factory),
            await GroupTestApi.NewAccountAsync(factory));
        await GroupTestApi.BefriendAsync(ann, bob);
        await GroupTestApi.BefriendAsync(ann, cat);
        var groupId = await GroupTestApi.CreateGroupAsync(ann, "Crew", bob, cat);

        await GroupTestApi.AssertStatusAsync(HttpStatusCode.Forbidden,
            bob.Client.DeleteAsync($"/api/groups/{groupId}/members/{cat.Id}"));
        await GroupTestApi.AssertStatusAsync(HttpStatusCode.NoContent,
            ann.Client.DeleteAsync($"/api/groups/{groupId}/members/{cat.Id}"));
        await GroupTestApi.AssertStatusAsync(HttpStatusCode.NoContent,
            bob.Client.DeleteAsync($"/api/groups/{groupId}/members/{bob.Id}"));
        // Removing someone who isn't a member is harmless
        await GroupTestApi.AssertStatusAsync(HttpStatusCode.NoContent,
            ann.Client.DeleteAsync($"/api/groups/{groupId}/members/{bob.Id}"));

        Assert.Equal([ann.Id], GroupTestApi.MemberIds(await GroupTestApi.GroupAsync(ann, groupId)));
        await GroupTestApi.AssertStatusAsync(HttpStatusCode.NotFound, bob.Client.GetAsync($"/api/groups/{groupId}"));
        await GroupTestApi.AssertStatusAsync(HttpStatusCode.NotFound, cat.Client.GetAsync($"/api/groups/{groupId}"));
    }

    [Fact]
    public async Task When_the_owner_leaves_the_longest_standing_member_takes_over()
    {
        var (ann, bob, cat) = (await GroupTestApi.NewAccountAsync(factory), await GroupTestApi.NewAccountAsync(factory),
            await GroupTestApi.NewAccountAsync(factory));
        await GroupTestApi.BefriendAsync(ann, bob);
        await GroupTestApi.BefriendAsync(ann, cat);
        var groupId = await GroupTestApi.CreateGroupAsync(ann, "Crew", bob);
        await GroupTestApi.AssertStatusAsync(HttpStatusCode.NoContent,
            ann.Client.PostAsync($"/api/groups/{groupId}/members/{cat.Id}", null));

        await GroupTestApi.AssertStatusAsync(HttpStatusCode.NoContent,
            ann.Client.DeleteAsync($"/api/groups/{groupId}/members/{ann.Id}"));

        var group = await GroupTestApi.GroupAsync(bob, groupId);
        Assert.Equal("owner", group.GetProperty("myRole").GetString());
        Assert.Equal([bob.Id, cat.Id], GroupTestApi.MemberIds(group));
        Assert.Equal("member", (await GroupTestApi.GroupAsync(cat, groupId)).GetProperty("myRole").GetString());
    }

    [Fact]
    public async Task When_the_last_member_leaves_the_group_is_deleted()
    {
        var ann = await GroupTestApi.NewAccountAsync(factory);
        var groupId = await GroupTestApi.CreateGroupAsync(ann);

        await GroupTestApi.AssertStatusAsync(HttpStatusCode.NoContent,
            ann.Client.DeleteAsync($"/api/groups/{groupId}/members/{ann.Id}"));

        Assert.False(await factory.WithDbAsync(db => db.Groups.AnyAsync(g => g.Id == groupId)));
    }

    private Task<int> AddFillerMembersAsync(Guid groupId, int count) => factory.WithDbAsync(db =>
    {
        for (var i = 0; i < count; i++)
        {
            var user = new User { Email = $"{Guid.NewGuid():N}@example.com", DisplayName = $"Filler {i}", PasswordHash = "x" };
            db.Users.Add(user);
            db.GroupMembers.Add(new GroupMember { GroupId = groupId, UserId = user.Id, Role = GroupRole.Member });
        }
        return db.SaveChangesAsync();
    });
}

/// <summary>Helpers for the group tests: accounts, friendships and groups through the real API.</summary>
internal static class GroupTestApi
{
    private const string Password = "correct-horse-battery";

    public sealed record Account(HttpClient Client, Guid Id, string DisplayName);

    public static async Task<Account> NewAccountAsync(WebApplicationFactory<Program> api)
    {
        var displayName = $"User {Guid.NewGuid():N}"[..20];
        using var anonymous = api.CreateClient();
        var response = await anonymous.PostAsJsonAsync("/api/auth/register",
            new { email = $"{Guid.NewGuid():N}@example.com", password = Password, displayName });
        response.EnsureSuccessStatusCode();

        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var client = api.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", body.RootElement.GetProperty("accessToken").GetString());
        return new Account(client, body.RootElement.GetProperty("user").GetProperty("id").GetGuid(), displayName);
    }

    public static async Task BefriendAsync(Account a, Account b)
    {
        (await a.Client.PostAsync($"/api/friends/requests/{b.Id}", null)).EnsureSuccessStatusCode();
        (await b.Client.PostAsync($"/api/friends/requests/{a.Id}/accept", null)).EnsureSuccessStatusCode();
    }

    public static async Task<JsonElement> JsonAsync(HttpResponseMessage response, HttpStatusCode expected = HttpStatusCode.OK)
    {
        var raw = await response.Content.ReadAsStringAsync();
        Assert.True(expected == response.StatusCode, $"Expected {expected}, got {response.StatusCode}: {raw}");
        return JsonDocument.Parse(raw).RootElement.Clone();
    }

    public static async Task<Guid> CreateGroupAsync(Account owner, string name = "Friday crew", params Account[] members)
    {
        var group = await JsonAsync(
            await owner.Client.PostAsJsonAsync("/api/groups", new { name, memberIds = members.Select(m => m.Id) }),
            HttpStatusCode.Created);
        return group.GetProperty("id").GetGuid();
    }

    public static async Task<JsonElement> GroupAsync(Account account, Guid groupId) =>
        await JsonAsync(await account.Client.GetAsync($"/api/groups/{groupId}"));

    public static Guid[] MemberIds(JsonElement group) =>
        group.GetProperty("members").EnumerateArray().Select(m => m.GetProperty("userId").GetGuid()).ToArray();

    public static async Task AssertStatusAsync(HttpStatusCode expected, Task<HttpResponseMessage> request)
    {
        using var response = await request;
        Assert.Equal(expected, response.StatusCode);
    }
}
