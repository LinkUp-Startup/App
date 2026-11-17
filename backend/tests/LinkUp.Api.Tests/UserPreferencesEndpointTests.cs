using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using LinkUp.Api.Data;
using LinkUp.Api.Dtos;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace LinkUp.Api.Tests;

public sealed class UserPreferencesEndpointTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>
{
    private const string Route = "/api/users/me/preferences";

    private sealed class RecordingFilter : IVenueFilteringService
    {
        public NightPreferencesDto? Received { get; private set; }

        public Task<IReadOnlyList<Venue>> FilterAsync(NightPreferencesDto preferences, CancellationToken cancellationToken)
        {
            Received = preferences;
            return Task.FromResult<IReadOnlyList<Venue>>([
                new() { Id = 1, Name = "One", Address = "a", EntranceFee = 0, MinSpend = 5, MaxSpend = 5 },
                new() { Id = 2, Name = "Two", Address = "b", EntranceFee = 0, MinSpend = 5, MaxSpend = 5 },
            ]);
        }

        public Task<IReadOnlyList<Venue>> FilterAsync(NightPreferencesDto preferences, double latitude, double longitude,
            CancellationToken cancellationToken) => FilterAsync(preferences, cancellationToken);
    }

    [Fact]
    public async Task Saved_defaults_can_be_overridden_for_generation_without_updating_either_account()
    {
        var (client, auth) = await Account();
        var (other, _) = await Account();
        using (client)
        using (other)
        {
            using var save = await client.PutAsJsonAsync(Route, Values());
            EqualValues(Values(), await Body(save));
            using var read = await client.GetAsync(Route);
            var plan = (JsonObject)(await Body(read)).DeepClone();
            plan["budgetPerPerson"] = 100;
            plan["groupSize"] = 5;
            plan["maxDistanceKm"] = 10;
            plan["activities"] = new JsonArray("cinema", "games");
            plan["transport"] = new JsonArray("bike", "taxi");
            plan["startTime"] = "2026-11-20T20:00:00Z";
            plan["endTime"] = "2026-11-20T23:00:00Z";

            // Keep the real HTTP pipeline, validation, auth, persistence and stub generator;
            // only candidate discovery is controlled to avoid depending on seeded venues.
            var filter = new RecordingFilter();
            using var api = factory.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
            {
                services.RemoveAll<IVenueFilteringService>();
                services.AddSingleton<IVenueFilteringService>(filter);
            }));
            using var planning = api.CreateClient();
            planning.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
            using var generated = await planning.PostAsJsonAsync("/api/plans/generate", new JsonObject { ["preferences"] = plan });
            Assert.Equal(HttpStatusCode.OK, generated.StatusCode);
            var result = await Body(generated);
            Assert.NotEmpty(result["plans"]!.AsArray());
            Assert.NotNull(filter.Received);
            Assert.Equal(100m, filter.Received.BudgetPerPerson);
            Assert.Equal(5, filter.Received.GroupSize);
            Assert.Equal(10, filter.Received.MaxDistanceKm);
            Assert.Equal([Activity.Cinema, Activity.Games], filter.Received.Activities);
            Assert.Equal([Transport.Bike, Transport.Taxi], filter.Received.Transport);

            using var unchanged = await client.GetAsync(Route);
            EqualValues(Values(), await Body(unchanged));
            using var independent = await other.GetAsync(Route);
            EqualValues(Unspecified(), await Body(independent));
        }
    }

    [Theory]
    [InlineData("PATCH")]
    [InlineData("POST")]
    [InlineData("DELETE")]
    public async Task Unsupported_write_methods_do_not_change_saved_preferences(string method)
    {
        var (client, _) = await Account();
        using (client)
        {
            using var saved = await client.PutAsJsonAsync(Route, Values());
            saved.EnsureSuccessStatusCode();
            using var request = new HttpRequestMessage(new HttpMethod(method), Route)
            {
                Content = JsonContent.Create(new { budgetPerPerson = 0 }),
            };
            using var response = await client.SendAsync(request);
            Assert.Equal(HttpStatusCode.MethodNotAllowed, response.StatusCode);
            using var unchanged = await client.GetAsync(Route);
            EqualValues(Values(), await Body(unchanged));
        }
    }

    private static JsonObject Values() => new()
    {
        ["budgetPerPerson"] = 25.75m, ["groupSize"] = 4, ["maxDistanceKm"] = 5.5,
        ["activities"] = new JsonArray("dinner", "drinks"),
        ["transport"] = new JsonArray("walking", "publicTransport"),
    };

    private async Task<(HttpClient Client, AuthResponse Auth)> Account()
    {
        using var client = factory.CreateClient();
        using var response = await client.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"{Guid.NewGuid():N}@example.com", password = "correct-horse-battery", displayName = "Ann",
        });
        response.EnsureSuccessStatusCode();
        var auth = (await response.Content.ReadFromJsonAsync<AuthResponse>())!;
        return (Client(auth.AccessToken), auth);
    }

    private HttpClient Client(string? token = null)
    {
        var client = factory.CreateClient();
        if (token is not null) client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private static async Task<JsonNode> Body(HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonNode>())!;
    }

    private static void EqualValues(JsonNode expected, JsonNode actual) =>
        Assert.True(JsonNode.DeepEquals(expected, actual), $"Expected {expected}, got {actual}");

    private static JsonObject Unspecified() => new()
    {
        ["budgetPerPerson"] = null, ["groupSize"] = null, ["activities"] = null,
        ["maxDistanceKm"] = null, ["transport"] = null,
    };

    [Fact]
    public async Task New_account_gets_only_five_unspecified_defaults()
    {
        var (client, _) = await Account();
        using (client)
        using (var response = await client.GetAsync(Route))
        {
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            EqualValues(Unspecified(), await Body(response));
        }
    }

    [Fact]
    public async Task Get_returns_defaults_already_saved_in_the_database()
    {
        var (client, auth) = await Account();
        using (client)
        {
            await factory.WithDbAsync(async db =>
            {
                var user = await db.Users.SingleAsync(u => u.Id == auth.User.Id);
                user.DefaultBudgetPerPerson = 25.75m;
                user.DefaultGroupSize = 4;
                user.DefaultMaxDistanceKm = 5.5;
                user.DefaultActivities = [Activity.Dinner, Activity.Drinks];
                user.DefaultTransport = [Transport.Walking, Transport.PublicTransport];
                return await db.SaveChangesAsync();
            });
            using var response = await client.GetAsync(Route);
            EqualValues(Values(), await Body(response));
        }
    }

    [Fact]
    public async Task Put_persists_all_fields_and_survives_a_new_api_instance()
    {
        var (client, auth) = await Account();
        using (client)
        {
            using var response = await client.PutAsJsonAsync(Route, Values());
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            EqualValues(Values(), await Body(response));
            await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql(factory.TestConnectionString).Options);
            var saved = await db.Users.SingleAsync(u => u.Id == auth.User.Id);
            Assert.Equal(25.75m, saved.DefaultBudgetPerPerson);
            Assert.Equal(4, saved.DefaultGroupSize);
            Assert.Equal(5.5, saved.DefaultMaxDistanceKm);
            Assert.Equal([Activity.Dinner, Activity.Drinks], saved.DefaultActivities);
            Assert.Equal([Transport.Walking, Transport.PublicTransport], saved.DefaultTransport);
            Assert.Equal(auth.User.Email, saved.Email);
            Assert.Equal(auth.User.DisplayName, saved.DisplayName);

            using var restarted = factory.WithWebHostBuilder(_ => { });
            using var otherClient = restarted.CreateClient();
            otherClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
            using var get = await otherClient.GetAsync(Route);
            EqualValues(Values(), await Body(get));
        }
    }

    [Fact]
    public async Task Put_and_get_ignore_other_user_ids_and_keep_accounts_independent()
    {
        var (alice, _) = await Account();
        var (bob, bobAuth) = await Account();
        using (alice)
        using (bob)
        {
            using var initial = await bob.PutAsJsonAsync(Route, Values());
            initial.EnsureSuccessStatusCode();
            var own = Values();
            own["budgetPerPerson"] = 0;
            own["groupSize"] = 1;
            own["maxDistanceKm"] = 0.5;
            own["activities"] = new JsonArray("outdoor");
            own["transport"] = new JsonArray("bike");
            var injected = (JsonObject)own.DeepClone();
            injected["userId"] = bobAuth.User.Id.ToString();
            using var update = await alice.PutAsJsonAsync($"{Route}?userId={bobAuth.User.Id}", injected);
            EqualValues(own, await Body(update));
            using var getOwn = await alice.GetAsync($"{Route}?userId={bobAuth.User.Id}");
            EqualValues(own, await Body(getOwn));
            using var getOther = await bob.GetAsync(Route);
            EqualValues(Values(), await Body(getOther));
            using var arbitraryPath = await alice.GetAsync($"/api/users/{bobAuth.User.Id}/preferences");
            Assert.Equal(HttpStatusCode.NotFound, arbitraryPath.StatusCode);
        }
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Put_replaces_defaults_and_clears_omitted_or_null_fields(bool explicitNull)
    {
        var (client, _) = await Account();
        using (client)
        {
            using var initial = await client.PutAsJsonAsync(Route, Values());
            initial.EnsureSuccessStatusCode();
            var replacement = explicitNull ? Unspecified() : new JsonObject();
            replacement["budgetPerPerson"] = 0;
            var expected = Unspecified();
            expected["budgetPerPerson"] = 0;
            using var update = await client.PutAsJsonAsync(Route, replacement);
            EqualValues(expected, await Body(update));
            using var get = await client.GetAsync(Route);
            EqualValues(expected, await Body(get));
            using var clear = await client.PutAsJsonAsync(Route, new JsonObject());
            EqualValues(Unspecified(), await Body(clear));
            using var clearedGet = await client.GetAsync(Route);
            EqualValues(Unspecified(), await Body(clearedGet));
        }
    }

    [Theory]
    [InlineData(0, 1, 0.5)]
    [InlineData(500, 20, 30)]
    public async Task Existing_numeric_boundaries_and_every_supported_selection_are_accepted(decimal budget, int size, double radius)
    {
        var (client, _) = await Account();
        using (client)
        {
            var values = Values();
            values["budgetPerPerson"] = budget;
            values["groupSize"] = size;
            values["maxDistanceKm"] = radius;
            values["activities"] = new JsonArray("dinner", "drinks", "club", "concert", "cinema", "games", "outdoor");
            values["transport"] = new JsonArray("walking", "bike", "car", "publicTransport", "taxi");
            using var response = await client.PutAsJsonAsync(Route, values);
            EqualValues(values, await Body(response));
        }
    }

    [Fact]
    public async Task Update_response_matches_database_monetary_rounding()
    {
        var (client, _) = await Account();
        using (client)
        {
            var values = Values();
            values["budgetPerPerson"] = 25.755m;
            using var update = await client.PutAsJsonAsync(Route, values);
            values["budgetPerPerson"] = 25.76m;
            EqualValues(values, await Body(update));
            using var get = await client.GetAsync(Route);
            EqualValues(values, await Body(get));
        }
    }

    public static TheoryData<string, string, string> InvalidValues => new()
    {
        { "budgetPerPerson", "-0.01", "BudgetPerPerson" },
        { "budgetPerPerson", "500.01", "BudgetPerPerson" },
        { "groupSize", "0", "GroupSize" },
        { "groupSize", "-1", "GroupSize" },
        { "groupSize", "21", "GroupSize" },
        { "groupSize", "1.5", "groupSize" },
        { "maxDistanceKm", "0", "MaxDistanceKm" },
        { "maxDistanceKm", "-1", "MaxDistanceKm" },
        { "maxDistanceKm", "0.49", "MaxDistanceKm" },
        { "maxDistanceKm", "30.01", "MaxDistanceKm" },
        { "budgetPerPerson", "\"30\"", "budgetPerPerson" },
        { "maxDistanceKm", "\"NaN\"", "maxDistanceKm" },
        { "maxDistanceKm", "1e999", "MaxDistanceKm" },
        { "activities", "[]", "Activities" },
        { "transport", "[]", "Transport" },
        { "activities", "[\"dinner\",\"dinner\"]", "Activities" },
        { "transport", "[\"bike\",\"bike\"]", "Transport" },
        { "activities", "[\"unknown\"]", "activities" },
        { "transport", "[\"spaceship\"]", "transport" },
        { "activities", "[999]", "Activities" },
        { "transport", "[-1]", "Transport" },
        { "activities", "[null]", "activities" },
        { "transport", "[null]", "transport" },
    };

    [Theory]
    [MemberData(nameof(InvalidValues))]
    public async Task Invalid_requests_return_validation_problems_without_persisting_any_changes(
        string field, string json, string errorField)
    {
        var (client, auth) = await Account();
        using (client)
        {
            using var initial = await client.PutAsJsonAsync(Route, Values());
            initial.EnsureSuccessStatusCode();
            var invalid = Values();
            invalid["budgetPerPerson"] = 10;
            invalid["groupSize"] = 2;
            invalid[field] = JsonNode.Parse(json);
            using var response = await client.PutAsJsonAsync(Route, invalid);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
            using var problem = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.Equal(400, problem.RootElement.GetProperty("status").GetInt32());
            Assert.Contains(problem.RootElement.GetProperty("errors").EnumerateObject(),
                error => error.Name.Contains(errorField, StringComparison.OrdinalIgnoreCase));
            using var get = await client.GetAsync(Route);
            EqualValues(Values(), await Body(get));
            Assert.Equal(25.75m, await factory.WithDbAsync(db => db.Users.Where(u => u.Id == auth.User.Id)
                .Select(u => u.DefaultBudgetPerPerson).SingleAsync()));
        }
    }

    [Theory]
    [InlineData("GET", null)]
    [InlineData("PUT", null)]
    [InlineData("GET", "invalid-token")]
    [InlineData("PUT", "invalid-token")]
    public async Task Missing_or_invalid_authentication_is_rejected(string method, string? token)
    {
        using var client = Client(token);
        using var request = new HttpRequestMessage(new HttpMethod(method), Route);
        if (method == "PUT") request.Content = JsonContent.Create(Values());
        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Contains(response.Headers.WwwAuthenticate, challenge => challenge.Scheme == "Bearer");
    }

    private static string SignedToken(string? subject) => new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
    {
        Issuer = TestJwt.Issuer, Audience = TestJwt.Audience,
        Subject = new ClaimsIdentity(subject is null ? [] : [new Claim("sub", subject)]),
        Expires = DateTime.UtcNow.AddMinutes(10),
        SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(TestJwt.SigningKey)),
            SecurityAlgorithms.HmacSha256),
    });

    [Theory]
    [InlineData(null)]
    [InlineData("not-a-guid")]
    public async Task Signed_tokens_without_a_valid_user_identity_are_unauthorized(string? subject)
    {
        using var client = Client(SignedToken(subject));
        using var get = await client.GetAsync(Route);
        Assert.Equal(HttpStatusCode.Unauthorized, get.StatusCode);
        using var put = await client.PutAsJsonAsync(Route, Values());
        Assert.Equal(HttpStatusCode.Unauthorized, put.StatusCode);
    }

    [Fact]
    public async Task Deleted_accounts_cannot_read_or_update_preferences()
    {
        var (client, auth) = await Account();
        using (client)
        {
            await factory.WithDbAsync(db => db.Users.Where(u => u.Id == auth.User.Id).ExecuteDeleteAsync());
            using var get = await client.GetAsync(Route);
            Assert.Equal(HttpStatusCode.Unauthorized, get.StatusCode);
            using var put = await client.PutAsJsonAsync(Route, Values());
            Assert.Equal(HttpStatusCode.Unauthorized, put.StatusCode);
        }
    }
}
