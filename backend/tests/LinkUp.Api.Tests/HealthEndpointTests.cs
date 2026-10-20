using System.Net;
using System.Text.Json;

namespace LinkUp.Api.Tests;

public sealed class HealthEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Returns_200_and_healthy_when_the_database_is_reachable()
    {
        using var response = await factory.CreateClient().GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("healthy", body.RootElement.GetProperty("status").GetString());
        Assert.Equal("healthy", body.RootElement.GetProperty("checks").GetProperty("database").GetString());
    }
}

public sealed class UnhealthyHealthEndpointTests(UnhealthyDatabaseApiFactory factory)
    : IClassFixture<UnhealthyDatabaseApiFactory>
{
    [Fact]
    public async Task Returns_503_and_unhealthy_when_the_database_is_unreachable()
    {
        using var response = await factory.CreateClient().GetAsync("/health");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("unhealthy", body.RootElement.GetProperty("status").GetString());
        Assert.Equal("unhealthy", body.RootElement.GetProperty("checks").GetProperty("database").GetString());
    }
}
