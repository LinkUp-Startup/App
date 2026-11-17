using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using LinkUp.Api.Dtos;
using LinkUp.Api.Services;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace LinkUp.Api.Tests;

/// <summary>
/// How every result of the friend service becomes an HTTP response, with the service faked: some results
/// (a deleted account, two requests racing) are hard to reach through real requests. No database needed.
/// </summary>
public sealed class FriendsControllerResponseTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly Guid Me = Guid.NewGuid();
    private static readonly Guid Other = Guid.NewGuid();

    private sealed class FakeFriendService : IFriendService
    {
        public FriendActionResult Result { get; set; }
        public List<string> Calls { get; } = [];

        public Task<IReadOnlyList<UserSearchResultDto>> SearchUsersAsync(Guid userId, string query, CancellationToken cancellationToken)
        {
            Calls.Add($"search {userId} {query}");
            return Task.FromResult<IReadOnlyList<UserSearchResultDto>>([new UserSearchResultDto(Other, "Ann", FriendRelation.RequestSent)]);
        }

        public Task<FriendsResponse> ListAsync(Guid userId, CancellationToken cancellationToken)
        {
            Calls.Add($"list {userId}");
            return Task.FromResult(new FriendsResponse([], [], []));
        }

        public Task<FriendActionResult> SendRequestAsync(Guid userId, Guid otherUserId, CancellationToken cancellationToken) =>
            Record($"send {userId} {otherUserId}");

        public Task<FriendActionResult> AcceptAsync(Guid userId, Guid otherUserId, CancellationToken cancellationToken) =>
            Record($"accept {userId} {otherUserId}");

        public Task<FriendActionResult> DeclineAsync(Guid userId, Guid otherUserId, CancellationToken cancellationToken) =>
            Record($"decline {userId} {otherUserId}");

        public Task RemoveAsync(Guid userId, Guid otherUserId, CancellationToken cancellationToken) =>
            Record($"remove {userId} {otherUserId}");

        private Task<FriendActionResult> Record(string call)
        {
            Calls.Add(call);
            return Task.FromResult(Result);
        }
    }

    private (HttpClient Client, FakeFriendService Service) Create()
    {
        var service = new FakeFriendService();
        var client = factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IFriendService>();
            services.AddSingleton<IFriendService>(service);
        })).CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", TokenFor(Me));
        return (client, service);
    }

    private static string TokenFor(Guid userId) => new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
    {
        Issuer = TestJwt.Issuer,
        Audience = TestJwt.Audience,
        Subject = new ClaimsIdentity([new Claim("sub", userId.ToString())]),
        Expires = DateTime.UtcNow.AddMinutes(10),
        SigningCredentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(TestJwt.SigningKey)), SecurityAlgorithms.HmacSha256),
    });

    public static TheoryData<FriendActionResult, HttpStatusCode, string?> Results => new()
    {
        { FriendActionResult.Done, HttpStatusCode.NoContent, null },
        { FriendActionResult.UnknownAccount, HttpStatusCode.Unauthorized, null },
        { FriendActionResult.UserNotFound, HttpStatusCode.NotFound, "User not found." },
        { FriendActionResult.CannotBefriendYourself, HttpStatusCode.BadRequest, "You can't send a friend request to yourself." },
        { FriendActionResult.AlreadyFriends, HttpStatusCode.Conflict, "You are already friends." },
        { FriendActionResult.RequestAlreadyReceived, HttpStatusCode.Conflict, "This user already sent you a friend request. Accept it instead." },
        { FriendActionResult.NoPendingRequest, HttpStatusCode.NotFound, "There is no pending friend request from this user." },
        { FriendActionResult.NotTheReceiver, HttpStatusCode.Forbidden, "Only the person who received the request can accept or decline it." },
        { FriendActionResult.ChangedConcurrently, HttpStatusCode.Conflict, "The request changed at the same time. Try again." },
    };

    [Theory]
    [MemberData(nameof(Results))]
    public async Task Each_result_has_its_own_status_and_title(FriendActionResult result, HttpStatusCode status, string? title)
    {
        var (client, service) = Create();
        service.Result = result;

        foreach (var path in new[] { $"requests/{Other}", $"requests/{Other}/accept", $"requests/{Other}/decline" })
        {
            using var response = await client.PostAsync($"/api/friends/{path}", null);

            Assert.Equal(status, response.StatusCode);
            if (title is null) continue;
            Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
            using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.Equal(title, body.RootElement.GetProperty("title").GetString());
            Assert.Equal((int)status, body.RootElement.GetProperty("status").GetInt32());
        }
    }

    [Fact]
    public async Task Calls_the_service_as_the_signed_in_user()
    {
        var (client, service) = Create();

        (await client.GetAsync("/api/friends")).Dispose();
        (await client.GetAsync("/api/users/search?query=an")).Dispose();
        (await client.PostAsync($"/api/friends/requests/{Other}", null)).Dispose();
        (await client.PostAsync($"/api/friends/requests/{Other}/accept", null)).Dispose();
        (await client.PostAsync($"/api/friends/requests/{Other}/decline", null)).Dispose();
        (await client.DeleteAsync($"/api/friends/{Other}")).Dispose();

        Assert.Equal(
        [
            $"list {Me}",
            $"search {Me} an",
            $"send {Me} {Other}",
            $"accept {Me} {Other}",
            $"decline {Me} {Other}",
            $"remove {Me} {Other}",
        ], service.Calls);
    }

    [Fact]
    public async Task Remove_is_always_204()
    {
        var (client, service) = Create();
        service.Result = FriendActionResult.NoPendingRequest; // Ignored: removing returns nothing

        using var response = await client.DeleteAsync($"/api/friends/{Other}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/friends/requests/not-a-guid")]
    [InlineData("/api/friends/requests/not-a-guid/accept")]
    public async Task User_ids_must_be_guids(string path)
    {
        var (client, service) = Create();

        using var response = await client.PostAsync(path, null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode); // The route does not match
        Assert.Empty(service.Calls);
    }
}
