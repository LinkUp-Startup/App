using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using LinkUp.Api.Dtos;
using LinkUp.Api.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace LinkUp.Api.Tests;

public sealed class RateLimitingTests
{
    private static readonly object ValidRequest = new
    {
        preferences = new
        {
            budgetPerPerson = 30,
            groupSize = 4,
            activities = new[] { "drinks" },
            startTime = "2026-10-30T20:00:00Z",
            endTime = "2026-10-31T02:00:00Z",
            maxDistanceKm = 3,
            transport = new[] { "walking" },
        },
    };

    /// <summary>The planning API with the given limits, every request arriving from <paramref name="remoteIp"/>.</summary>
    private static WebApplicationFactory<Program> Api(Dictionary<string, string> limits, string remoteIp = "203.0.113.7") =>
        new PlanningApiFactory().WithWebHostBuilder(builder =>
        {
            foreach (var (key, value) in limits)
                builder.UseSetting($"RateLimiting:{key}", value);
            // TestServer has no remote address; set one the way Kestrel would, before the app's pipeline.
            builder.ConfigureServices(services =>
                services.AddSingleton<IStartupFilter>(new RemoteIpFilter(IPAddress.Parse(remoteIp))));
        });

    private sealed class RemoteIpFilter(IPAddress address) : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use((context, nextMiddleware) =>
            {
                context.Connection.RemoteIpAddress = address;
                return nextMiddleware(context);
            });
            next(app);
        };
    }

    private static Task<HttpResponseMessage> GenerateAsync(HttpClient client, string? token = null, string? forwardedFor = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/plans/generate") { Content = JsonContent.Create(ValidRequest) };
        if (token is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (forwardedFor is not null) request.Headers.Add("X-Forwarded-For", forwardedFor);
        return client.SendAsync(request);
    }

    private static string TokenFor(WebApplicationFactory<Program> api) =>
        api.Services.GetRequiredService<ITokenService>()
            .Create(new UserDto(Guid.NewGuid(), $"{Guid.NewGuid():N}@example.com", "Ann")).Value;

    [Fact]
    public async Task Generation_is_limited_per_minute_with_a_clear_429()
    {
        using var api = Api(new() { ["GenerationsPerMinute"] = "2" });
        var client = api.CreateClient();

        Assert.Equal(HttpStatusCode.OK, (await GenerateAsync(client)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await GenerateAsync(client)).StatusCode);
        using var rejected = await GenerateAsync(client);

        Assert.Equal(HttpStatusCode.TooManyRequests, rejected.StatusCode);
        Assert.Equal("application/problem+json", rejected.Content.Headers.ContentType?.MediaType);
        Assert.True(rejected.Headers.RetryAfter?.Delta > TimeSpan.Zero);
        using var body = JsonDocument.Parse(await rejected.Content.ReadAsStringAsync());
        Assert.Equal("Too many plans were requested. Wait a while and try again.", body.RootElement.GetProperty("detail").GetString());

        // Other endpoints keep working.
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health")).StatusCode);
    }

    [Fact]
    public async Task Generation_is_limited_per_hour()
    {
        using var api = Api(new() { ["GenerationsPerHour"] = "1" });
        var client = api.CreateClient();

        Assert.Equal(HttpStatusCode.OK, (await GenerateAsync(client)).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await GenerateAsync(client)).StatusCode);
    }

    [Fact]
    public async Task Logged_in_users_on_one_network_each_get_their_own_limit()
    {
        using var api = Api(new() { ["GenerationsPerMinute"] = "1" });
        var client = api.CreateClient();
        var ann = TokenFor(api);
        var ben = TokenFor(api);

        // Same IP for all three, like a classroom on one Wi-Fi.
        Assert.Equal(HttpStatusCode.OK, (await GenerateAsync(client, ann)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await GenerateAsync(client, ben)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await GenerateAsync(client)).StatusCode); // a guest
        Assert.Equal(HttpStatusCode.TooManyRequests, (await GenerateAsync(client, ann)).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await GenerateAsync(client)).StatusCode);
    }

    [Fact]
    public async Task Total_generations_per_day_are_capped_for_everyone_together()
    {
        using var api = Api(new() { ["GenerationsPerDay"] = "2" });
        var client = api.CreateClient();

        Assert.Equal(HttpStatusCode.OK, (await GenerateAsync(client, TokenFor(api))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await GenerateAsync(client, TokenFor(api))).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await GenerateAsync(client, TokenFor(api))).StatusCode);
    }

    [Fact]
    public async Task All_requests_are_limited_per_ip_per_minute()
    {
        using var api = Api(new() { ["RequestsPerMinute"] = "2" });
        var client = api.CreateClient();

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health")).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await client.GetAsync("/health")).StatusCode);
    }

    [Fact]
    public async Task Behind_the_proxy_each_client_ip_gets_its_own_limit()
    {
        // Traefik's address on the Docker network.
        using var api = Api(new() { ["GenerationsPerMinute"] = "1" }, remoteIp: "10.0.1.2");
        var client = api.CreateClient();

        Assert.Equal(HttpStatusCode.OK, (await GenerateAsync(client, forwardedFor: "198.51.100.1")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await GenerateAsync(client, forwardedFor: "198.51.100.2")).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await GenerateAsync(client, forwardedFor: "198.51.100.1")).StatusCode);
    }

    [Fact]
    public async Task A_client_cannot_dodge_the_limit_with_its_own_forwarded_header()
    {
        // A public address talking to the API directly: its X-Forwarded-For is ignored.
        using var api = Api(new() { ["GenerationsPerMinute"] = "1" }, remoteIp: "203.0.113.7");
        var client = api.CreateClient();

        Assert.Equal(HttpStatusCode.OK, (await GenerateAsync(client, forwardedFor: "198.51.100.1")).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await GenerateAsync(client, forwardedFor: "198.51.100.2")).StatusCode);
    }

    [Fact]
    public void Invalid_limits_stop_the_api_from_starting()
    {
        using var api = Api(new() { ["GenerationsPerMinute"] = "0" });

        Assert.ThrowsAny<Exception>(() => api.CreateClient());
    }
}
