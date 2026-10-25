using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using LinkUp.Api.Ai;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using LinkUp.Api.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using static LinkUp.Api.Tests.PlanTestData;

namespace LinkUp.Api.Tests;

public sealed class PlanBudgetEndpointTests
{
    private sealed class Candidates(IReadOnlyList<Venue> venues) : IVenueFilteringService
    {
        public Task<IReadOnlyList<Venue>> FilterAsync(NightPreferencesDto preferences, CancellationToken cancellationToken) =>
            Task.FromResult(venues);
        public Task<IReadOnlyList<Venue>> FilterAsync(
            NightPreferencesDto preferences, double latitude, double longitude, CancellationToken cancellationToken) =>
            FilterAsync(preferences, cancellationToken);
    }

    private sealed class FakeAi(bool combined) : IAiClient
    {
        public int Calls { get; private set; }
        public Task<AiJsonResponse> CompleteJsonAsync(AiJsonRequest request, CancellationToken cancellationToken)
        {
            Calls++;
            int[][] plans = combined ? [[1, 2], [2, 3]] : [[1], [2]];
            var json = JsonSerializer.Serialize(new
            {
                plans = plans.Select(ids => new
                {
                    title = "Budget checked", summary = "A test plan.",
                    stops = ids.Select((id, index) => new
                    {
                        venueId = id, startTime = At(21 + index), endTime = At(22 + index),
                    }),
                }),
            });
            return Task.FromResult(new AiJsonResponse(json, new AiUsage(10, 10, 0, TimeSpan.Zero)));
        }
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, false)]
    [InlineData(true, true)]
    [InlineData(false, true)]
    public async Task Neither_AI_nor_stub_returns_unknown_or_over_budget_plans_as_success(bool useAi, bool unknown)
    {
        var venues = Enumerable.Range(1, 3).Select(id =>
        {
            var venue = Venue(id);
            venue.MinSpend = venue.MaxSpend = useAi ? 10m : 20m;
            if (unknown) venue.EntranceFee = null;
            return venue;
        }).ToArray();
        var ai = new FakeAi(combined: true);
        using var factory = new ApiFactory();
        using var application = factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Ai:ApiKey", useAi ? "sk-test" : null);
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IVenueFilteringService>();
                services.AddSingleton<IVenueFilteringService>(new Candidates(venues));
                services.RemoveAll<IAiClient>();
                services.AddSingleton<IAiClient>(ai);
            });
        });

        using var response = await application.CreateClient().PostAsJsonAsync("/api/plans/generate",
            new GeneratePlansRequest(Preferences() with { BudgetPerPerson = 10m }));

        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("Couldn't generate plans within your budget.", body.RootElement.GetProperty("title").GetString());
        Assert.Contains("fully priced", body.RootElement.GetProperty("detail").GetString());
        Assert.Contains("budget", body.RootElement.GetProperty("detail").GetString());
        Assert.False(body.RootElement.TryGetProperty("plans", out _));
        Assert.Equal(useAi ? 2 : 0, ai.Calls);
    }

    [Theory]
    [InlineData(true, 10)]
    [InlineData(false, 10)]
    [InlineData(true, 0)]
    [InlineData(false, 0)]
    public async Task Valid_AI_and_stub_responses_keep_the_existing_shape_and_correct_per_person_prices(bool useAi, int price)
    {
        var venues = Enumerable.Range(1, 2).Select(id =>
        {
            var venue = Venue(id);
            venue.MinSpend = venue.MaxSpend = price;
            return venue;
        }).ToArray();
        var ai = new FakeAi(combined: false);
        using var factory = new ApiFactory();
        using var application = factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Ai:ApiKey", useAi ? "sk-test" : null);
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IVenueFilteringService>();
                services.AddSingleton<IVenueFilteringService>(new Candidates(venues));
                services.RemoveAll<IAiClient>();
                services.AddSingleton<IAiClient>(ai);
            });
        });

        using var response = await application.CreateClient().PostAsJsonAsync("/api/plans/generate",
            new GeneratePlansRequest(Preferences() with { BudgetPerPerson = price, GroupSize = 3 }));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Single(body.RootElement.EnumerateObject());
        var plans = body.RootElement.GetProperty("plans").EnumerateArray().ToArray();
        Assert.Equal(2, plans.Length);
        Assert.All(plans, plan =>
        {
            Assert.Equal(price, plan.GetProperty("estimatedCostPerPerson").GetDecimal());
            Assert.Equal(price, Assert.Single(plan.GetProperty("items").EnumerateArray())
                .GetProperty("estimatedCostPerPerson").GetDecimal());
        });
        Assert.Equal(useAi ? 1 : 0, ai.Calls);
    }
}
