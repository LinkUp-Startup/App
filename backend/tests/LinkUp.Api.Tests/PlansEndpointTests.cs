using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace LinkUp.Api.Tests;

public sealed class PlansEndpointTests(PlanningApiFactory factory) : IClassFixture<PlanningApiFactory>
{
    // Same shape the app sends (see app/src/types/api.ts): camelCase, enums as camelCase strings.
    private static readonly object ValidRequest = new
    {
        preferences = new
        {
            budgetPerPerson = 30,
            groupSize = 4,
            activities = new[] { "dinner", "drinks" },
            startTime = "2026-10-30T20:00:00Z",
            endTime = "2026-10-31T02:00:00Z",
            maxDistanceKm = 3,
            transport = new[] { "walking", "publicTransport" },
        },
    };

    [Fact]
    public async Task Generate_returns_plans_for_valid_preferences()
    {
        using var response = await factory.CreateClient().PostAsJsonAsync("/api/plans/generate", ValidRequest);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var plans = body.RootElement.GetProperty("plans");
        Assert.True(plans.GetArrayLength() > 0);

        var venue = plans[0].GetProperty("items")[0].GetProperty("venue");
        Assert.Equal("dinner", venue.GetProperty("category").GetString());
    }

    [Fact]
    public async Task Generate_rejects_an_unknown_activity_with_400()
    {
        var request = new
        {
            preferences = new
            {
                budgetPerPerson = 30,
                groupSize = 4,
                activities = new[] { "skydiving" },
                startTime = "2026-10-30T20:00:00Z",
                endTime = "2026-10-31T02:00:00Z",
                maxDistanceKm = 3,
                transport = new[] { "walking" },
            },
        };

        using var response = await factory.CreateClient().PostAsJsonAsync("/api/plans/generate", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Generate_rejects_missing_numeric_fields_with_400()
    {
        var request = new
        {
            preferences = new
            {
                activities = new[] { "dinner" },
                startTime = "2026-10-30T20:00:00Z",
                endTime = "2026-10-31T02:00:00Z",
                transport = new[] { "walking" },
            },
        };

        using var response = await factory.CreateClient().PostAsJsonAsync("/api/plans/generate", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Generate_rejects_numbers_sent_as_strings_with_400()
    {
        var request = new
        {
            preferences = new
            {
                budgetPerPerson = "30",
                groupSize = 4,
                activities = new[] { "dinner" },
                startTime = "2026-10-30T20:00:00Z",
                endTime = "2026-10-31T02:00:00Z",
                maxDistanceKm = 3,
                transport = new[] { "walking" },
            },
        };

        using var response = await factory.CreateClient().PostAsJsonAsync("/api/plans/generate", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Generate_rejects_a_missing_body_with_400()
    {
        using var response = await factory.CreateClient().PostAsync(
            "/api/plans/generate", new StringContent("", null, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
