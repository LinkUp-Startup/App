using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace LinkUp.Api.Tests;

public sealed class PreferencesValidationTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static JsonObject ValidPreferences() => new()
    {
        ["budgetPerPerson"] = 30,
        ["groupSize"] = 4,
        ["activities"] = new JsonArray("dinner", "drinks"),
        ["startTime"] = "2026-10-30T20:00:00+01:00",
        ["endTime"] = "2026-10-31T01:00:00+01:00",
        ["maxDistanceKm"] = 3,
        ["transport"] = new JsonArray("walking"),
        ["notes"] = "vegetarian",
    };

    private async Task<HttpResponseMessage> PostAsync(JsonObject preferences) =>
        await factory.CreateClient().PostAsJsonAsync(
            "/api/plans/generate", new JsonObject { ["preferences"] = preferences });

    [Fact]
    public async Task Valid_preferences_are_accepted()
    {
        using var response = await PostAsync(ValidPreferences());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [InlineData("budgetPerPerson", -1, "Preferences.BudgetPerPerson")]
    [InlineData("budgetPerPerson", 501, "Preferences.BudgetPerPerson")]
    [InlineData("groupSize", 0, "Preferences.GroupSize")]
    [InlineData("groupSize", 21, "Preferences.GroupSize")]
    [InlineData("maxDistanceKm", 0.4, "Preferences.MaxDistanceKm")]
    [InlineData("maxDistanceKm", 31, "Preferences.MaxDistanceKm")]
    public async Task Out_of_range_numbers_return_400_naming_the_field(string field, double value, string errorKey)
    {
        var preferences = ValidPreferences();
        preferences[field] = value;

        var errors = await AssertValidationProblemAsync(await PostAsync(preferences));

        Assert.True(errors.TryGetProperty(errorKey, out _), $"Expected an error for {errorKey}, got {errors}");
    }

    [Theory]
    [InlineData("activities", "Preferences.Activities", "Pick at least one activity.")]
    [InlineData("transport", "Preferences.Transport", "Pick at least one way to get around.")]
    public async Task Empty_selections_return_400_with_a_message(string field, string errorKey, string message)
    {
        var preferences = ValidPreferences();
        preferences[field] = new JsonArray();

        var errors = await AssertValidationProblemAsync(await PostAsync(preferences));

        Assert.Equal(message, errors.GetProperty(errorKey)[0].GetString());
    }

    [Fact]
    public async Task Notes_longer_than_500_characters_return_400()
    {
        var preferences = ValidPreferences();
        preferences["notes"] = new string('x', 501);

        var errors = await AssertValidationProblemAsync(await PostAsync(preferences));

        Assert.True(errors.TryGetProperty("Preferences.Notes", out _));
    }

    [Theory]
    [InlineData("2026-10-30T20:30:00+01:00", "at least 1 hour")]
    [InlineData("2026-10-30T19:00:00+01:00", "at least 1 hour")]
    [InlineData("2026-10-31T09:00:00+01:00", "at most 12 hours")]
    public async Task End_time_must_give_a_night_between_1_and_12_hours(string endTime, string message)
    {
        var preferences = ValidPreferences();
        preferences["endTime"] = endTime;

        var errors = await AssertValidationProblemAsync(await PostAsync(preferences));

        Assert.Contains(message, errors.GetProperty("Preferences.EndTime")[0].GetString());
    }

    [Fact]
    public async Task Duplicate_selections_return_400()
    {
        var preferences = ValidPreferences();
        preferences["activities"] = new JsonArray("dinner", "dinner");
        preferences["transport"] = new JsonArray("bike", "bike");

        var errors = await AssertValidationProblemAsync(await PostAsync(preferences));

        Assert.True(errors.TryGetProperty("Preferences.Activities", out _));
        Assert.True(errors.TryGetProperty("Preferences.Transport", out _));
    }

    [Theory]
    [InlineData("startTime")]
    [InlineData("endTime")]
    public async Task Missing_time_returns_400(string field)
    {
        var preferences = ValidPreferences();
        preferences.Remove(field);

        using var response = await PostAsync(preferences);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Malformed_time_returns_400()
    {
        var preferences = ValidPreferences();
        preferences["startTime"] = "tonight";

        using var response = await PostAsync(preferences);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static async Task<JsonElement> AssertValidationProblemAsync(HttpResponseMessage response)
    {
        using (response)
        {
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
            using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return body.RootElement.GetProperty("errors").Clone();
        }
    }
}
