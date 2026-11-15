using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace LinkUp.Api.Tests;

public sealed class PreferenceRuleParityTests(PlanningApiFactory factory) : IClassFixture<PlanningApiFactory>
{
    [Theory]
    [MemberData(nameof(UserPreferencesEndpointTests.InvalidValues), MemberType = typeof(UserPreferencesEndpointTests))]
    public async Task Plan_request_rejects_the_same_invalid_preference_values(string field, string json, string errorField)
    {
        var values = new JsonObject
        {
            ["budgetPerPerson"] = 30, ["groupSize"] = 4, ["maxDistanceKm"] = 5,
            ["activities"] = new JsonArray("dinner"), ["transport"] = new JsonArray("walking"),
            ["startTime"] = "2026-11-20T20:00:00+01:00", ["endTime"] = "2026-11-20T23:00:00+01:00",
        };
        values[field] = JsonNode.Parse(json);
        using var client = factory.CreateClient();
        using var response = await client.PostAsJsonAsync("/api/plans/generate", new JsonObject { ["preferences"] = values });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        using var problem = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Contains(problem.RootElement.GetProperty("errors").EnumerateObject(),
            error => error.Name.Contains(errorField, StringComparison.OrdinalIgnoreCase));
    }
}
