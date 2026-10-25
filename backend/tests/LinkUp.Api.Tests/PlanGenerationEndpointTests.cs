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
}
