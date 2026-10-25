using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using LinkUp.Api.Ai;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using LinkUp.Api.Planning;
using LinkUp.Api.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace LinkUp.Api.Tests;

public sealed class PlanGenerationEndpointTests(PlanningApiFactory factory) : IClassFixture<PlanningApiFactory>
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

    private sealed class FailingPlanService : IPlanService
    {
        public Task<IReadOnlyList<PlanDto>> GeneratePlansAsync(
            NightPreferencesDto preferences, IReadOnlyList<Venue> candidates, CancellationToken cancellationToken) =>
            throw new PlanGenerationException("nothing usable");
    }

    [Fact]
    public async Task Ai_failure_returns_502_problem_details()
    {
        using var failing = factory.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
        {
            services.RemoveAll<IPlanService>();
            services.AddScoped<IPlanService, FailingPlanService>();
        }));

        using var response = await failing.CreateClient().PostAsJsonAsync("/api/plans/generate", ValidRequest);

        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("Couldn't generate plans right now.", body.RootElement.GetProperty("title").GetString());
    }

    [Theory]
    [InlineData(null, typeof(StubPlanService))]
    [InlineData("sk-test", typeof(AiPlanService))]
    public void Uses_the_ai_only_when_a_key_is_configured(string? apiKey, Type expected)
    {
        using var configured = new ApiFactory().WithWebHostBuilder(builder => builder.UseSetting("Ai:ApiKey", apiKey));
        using var scope = configured.Services.CreateScope();

        Assert.IsType(expected, scope.ServiceProvider.GetRequiredService<IPlanService>());
    }

    private sealed class RecordingFilter : IVenueFilteringService
    {
        public (double Latitude, double Longitude)? Start { get; private set; }
        public int Calls { get; private set; }

        private static readonly Venue[] Venues =
        [
            // Priced, so the budget check (#50) keeps them.
            new() { Id = 1, Name = "One", Address = "a", Latitude = 41.6176, Longitude = 0.62, EntranceFee = 0, MinSpend = 5, MaxSpend = 5 },
            new() { Id = 2, Name = "Two", Address = "b", Latitude = 41.62, Longitude = 0.62, EntranceFee = 0, MinSpend = 5, MaxSpend = 5 },
        ];

        public Task<IReadOnlyList<Venue>> FilterAsync(NightPreferencesDto preferences, CancellationToken cancellationToken)
        {
            Calls++;
            return Task.FromResult<IReadOnlyList<Venue>>(Venues);
        }

        public Task<IReadOnlyList<Venue>> FilterAsync(
            NightPreferencesDto preferences, double startLatitude, double startLongitude, CancellationToken cancellationToken)
        {
            Calls++;
            Start = (startLatitude, startLongitude);
            return Task.FromResult<IReadOnlyList<Venue>>(Venues);
        }
    }

    private static object RequestWith(object? startLocation) => new
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
            startLocation,
        },
    };

    private (Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> Api, RecordingFilter Filter) WithRecordingFilter()
    {
        var filter = new RecordingFilter();
        var api = factory.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
        {
            services.RemoveAll<IVenueFilteringService>();
            services.AddSingleton<IVenueFilteringService>(filter);
        }));
        return (api, filter);
    }

    [Fact]
    public async Task A_start_location_filters_by_distance_and_measures_the_first_leg()
    {
        var (api, filter) = WithRecordingFilter();
        using var _ = api;

        using var response = await api.CreateClient().PostAsJsonAsync(
            "/api/plans/generate", RequestWith(new { latitude = 41.6176, longitude = 0.6200 }));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal((41.6176, 0.6200), filter.Start);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var plans = body.RootElement.GetProperty("plans");
        Assert.Equal(0, plans[0].GetProperty("items")[0].GetProperty("distanceKm").GetDouble()); // venue 1 is at the start
        Assert.InRange(plans[1].GetProperty("items")[0].GetProperty("distanceKm").GetDouble(), 0.25, 0.3); // ~270 m north
    }

    [Fact]
    public async Task Without_a_start_location_nothing_is_filtered_by_distance()
    {
        var (api, filter) = WithRecordingFilter();
        using var _ = api;

        using var response = await api.CreateClient().PostAsJsonAsync("/api/plans/generate", RequestWith(null));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, filter.Calls);
        Assert.Null(filter.Start);
    }

    [Theory]
    [InlineData(95, 0.62)]
    [InlineData(41.6, 181)]
    public async Task An_impossible_start_location_is_rejected(double latitude, double longitude)
    {
        using var response = await factory.CreateClient().PostAsJsonAsync(
            "/api/plans/generate", RequestWith(new { latitude, longitude }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task A_start_location_without_a_longitude_is_rejected()
    {
        using var response = await factory.CreateClient().PostAsJsonAsync(
            "/api/plans/generate", RequestWith(new { latitude = 41.6 }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private sealed class FixedFilter(params Venue[] venues) : IVenueFilteringService
    {
        public Task<IReadOnlyList<Venue>> FilterAsync(NightPreferencesDto preferences, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<Venue>>(venues);

        public Task<IReadOnlyList<Venue>> FilterAsync(
            NightPreferencesDto preferences, double startLatitude, double startLongitude, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<Venue>>(venues);
    }

    private sealed class CapturingAi : IAiClient
    {
        public List<string> Inputs { get; } = [];

        public Task<AiJsonResponse> CompleteJsonAsync(AiJsonRequest request, CancellationToken cancellationToken)
        {
            Inputs.Add(request.Input);
            throw new AiException("not needed for this test");
        }
    }

    [Fact]
    public async Task Venues_without_a_known_price_never_reach_the_ai()
    {
        static Venue Priced(int id) => new()
        {
            Id = id, Name = $"Venue {id}", Address = "a", Latitude = 41.6176, Longitude = 0.62,
            EntranceFee = 0, MinSpend = 5, MaxSpend = 5,
        };
        var unpriced = new Venue { Id = 3, Name = "Club without prices", Address = "c", Latitude = 41.6176, Longitude = 0.62 };
        var ai = new CapturingAi();
        using var api = new ApiFactory().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Ai:ApiKey", "sk-test");
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IVenueFilteringService>();
                services.AddSingleton<IVenueFilteringService>(new FixedFilter(Priced(1), Priced(2), unpriced));
                services.RemoveAll<IAiClient>();
                services.AddSingleton<IAiClient>(ai);
            });
        });

        await api.CreateClient().PostAsJsonAsync("/api/plans/generate", ValidRequest);

        var input = Assert.Single(ai.Inputs);
        using var json = JsonDocument.Parse(input);
        Assert.Equal([1, 2], json.RootElement.GetProperty("venues").EnumerateArray().Select(v => v.GetProperty("id").GetInt32()));
    }
}
