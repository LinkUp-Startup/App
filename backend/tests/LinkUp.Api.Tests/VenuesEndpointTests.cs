using System.Net;
using System.Text.Json;
using LinkUp.Api.Data.Seed;

namespace LinkUp.Api.Tests;

// Needs PostgreSQL: run 'docker compose up -d' first
public sealed class VenuesEndpointTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    private async Task<JsonElement> GetJsonAsync(string url)
    {
        var response = await _client.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();
    }

    [Fact]
    public async Task List_returns_every_seeded_venue_ordered_by_id()
    {
        var expected = VenueSeedData.Load();

        var venues = await GetJsonAsync("/api/venues");

        var ids = venues.EnumerateArray().Select(v => v.GetProperty("id").GetInt32()).ToList();
        Assert.Equal(expected.Select(v => v.Id).Order(), ids);
        Assert.Equal(
            expected.Sum(v => v.OpeningHours.Count),
            venues.EnumerateArray().Sum(v => v.GetProperty("openingHours").GetArrayLength()));
    }

    [Fact]
    public async Task Single_venue_has_all_fields()
    {
        var venue = await GetJsonAsync("/api/venues/6"); // Pub Legend: bar, free, €1–10, Daily 18:00–03:00

        Assert.Equal("Pub Legend", venue.GetProperty("name").GetString());
        Assert.Equal("bar", venue.GetProperty("category").GetString());
        Assert.Equal("free", venue.GetProperty("entranceType").GetString());
        Assert.Equal(1m, venue.GetProperty("minSpend").GetDecimal());
        Assert.Equal(10m, venue.GetProperty("maxSpend").GetDecimal());
        Assert.Equal(1, venue.GetProperty("priceLevel").GetInt32());
        Assert.True(venue.GetProperty("isActive").GetBoolean());

        var hours = venue.GetProperty("openingHours").EnumerateArray().ToList();
        Assert.Equal(7, hours.Count);
        Assert.Equal("monday", hours[0].GetProperty("day").GetString()); // Monday first
        Assert.StartsWith("18:00", hours[0].GetProperty("opens").GetString());
        Assert.StartsWith("03:00", hours[0].GetProperty("closes").GetString());
    }

    [Theory]
    [InlineData("/api/venues/9999")]
    [InlineData("/api/venues/abc")]
    public async Task Unknown_venue_is_404(string url)
    {
        var response = await _client.GetAsync(url);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}