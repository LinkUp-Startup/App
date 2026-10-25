using System.Text.Json;
using Microsoft.AspNetCore.Hosting;

namespace LinkUp.Api.Tests;

/// <summary>The served OpenAPI document is what shared/api.ts is generated from, so check its shape.</summary>
public sealed class OpenApiDocumentTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private async Task<JsonElement> GetDocumentAsync()
    {
        // The document is only served in Development.
        using var client = factory
            .WithWebHostBuilder(builder => builder.UseEnvironment("Development"))
            .CreateClient();
        var json = await client.GetStringAsync("/openapi/v1.json");
        return JsonDocument.Parse(json).RootElement.Clone();
    }

    [Fact]
    public async Task Bearer_scheme_is_documented_as_a_jwt()
    {
        var scheme = (await GetDocumentAsync()).GetProperty("components").GetProperty("securitySchemes").GetProperty("Bearer");

        Assert.Equal("http", scheme.GetProperty("type").GetString());
        Assert.Equal("bearer", scheme.GetProperty("scheme").GetString());
        Assert.Equal("JWT", scheme.GetProperty("bearerFormat").GetString());
    }

    [Theory]
    [InlineData("/api/auth/me", "get", true)]
    [InlineData("/api/auth/login", "post", false)]
    [InlineData("/api/auth/register", "post", false)]
    [InlineData("/api/plans/generate", "post", false)] // guest mode: no account needed
    [InlineData("/health", "get", false)]
    public async Task Only_the_protected_endpoints_require_a_token(string path, string method, bool requiresToken)
    {
        var operation = (await GetDocumentAsync()).GetProperty("paths").GetProperty(path).GetProperty(method);

        Assert.Equal(requiresToken, operation.TryGetProperty("security", out var security) && security.GetArrayLength() > 0);
    }

    [Fact]
    public async Task Plans_route_is_lowercase()
    {
        var document = await GetDocumentAsync();

        Assert.True(document.GetProperty("paths").TryGetProperty("/api/plans/generate", out _));
    }

    [Fact]
    public async Task Preferences_use_plain_numbers_camelCase_enums_and_optional_notes()
    {
        var schemas = (await GetDocumentAsync()).GetProperty("components").GetProperty("schemas");
        var preferences = schemas.GetProperty("NightPreferencesDto");

        Assert.Equal("number", preferences.GetProperty("properties").GetProperty("budgetPerPerson").GetProperty("type").GetString());
        Assert.Equal("integer", preferences.GetProperty("properties").GetProperty("groupSize").GetProperty("type").GetString());

        var required = preferences.GetProperty("required").EnumerateArray().Select(e => e.GetString()).ToList();
        Assert.Contains("budgetPerPerson", required);
        Assert.DoesNotContain("notes", required);

        var transports = schemas.GetProperty("Transport").GetProperty("enum").EnumerateArray().Select(e => e.GetString());
        Assert.Contains("publicTransport", transports);
    }
}
