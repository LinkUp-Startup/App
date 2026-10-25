using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using LinkUp.Api.Dtos;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace LinkUp.Api.Tests;

public sealed class JwtAuthenticationTests : IClassFixture<AuthApiFactory>
{
    private const string Password = "correct-horse-battery";
    private readonly AuthApiFactory _factory;
    private readonly HttpClient _client;

    public JwtAuthenticationTests(AuthApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private static string NewEmail() => $"{Guid.NewGuid():N}@example.com";

    private async Task<AuthResponse> RegisterAsync(string? email = null, string displayName = "Ann")
    {
        var response = await _client.PostAsJsonAsync("/api/auth/register",
            new { email = email ?? NewEmail(), password = Password, displayName });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<AuthResponse>())!;
    }

    private Task<HttpResponseMessage> GetMeAsync(string? token)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me");
        if (token is not null)
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return _client.SendAsync(request);
    }

    /// <summary>Builds a token the API would accept, except for whatever the test changes.</summary>
    private static string ForgeToken(
        string? subject = null,
        string signingKey = TestJwt.SigningKey,
        string issuer = TestJwt.Issuer,
        string audience = TestJwt.Audience,
        TimeSpan? expiresIn = null,
        bool signed = true)
    {
        var now = DateTime.UtcNow;
        var expires = now + (expiresIn ?? TimeSpan.FromMinutes(10));
        return new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = issuer,
            Audience = audience,
            Subject = new ClaimsIdentity([new Claim(JwtRegisteredClaimNames.Sub, subject ?? Guid.NewGuid().ToString())]),
            // NotBefore may not be later than Expires, so an expired token also starts in the past.
            NotBefore = expires < now ? expires.AddMinutes(-10) : now,
            Expires = expires,
            SigningCredentials = signed
                ? new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)), SecurityAlgorithms.HmacSha256)
                : null,
        });
    }

    [Fact]
    public async Task Login_returns_a_signed_token_with_the_account_claims_and_expiry()
    {
        var email = NewEmail();
        var registered = await RegisterAsync(email, "Ann");

        var response = await _client.PostAsJsonAsync("/api/auth/login", new { email, password = Password });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var auth = (await response.Content.ReadFromJsonAsync<AuthResponse>())!;
        var validation = await new JsonWebTokenHandler().ValidateTokenAsync(auth.AccessToken, new TokenValidationParameters
        {
            ValidIssuer = TestJwt.Issuer,
            ValidAudience = TestJwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(TestJwt.SigningKey)),
        });
        Assert.True(validation.IsValid, validation.Exception?.Message);
        var claims = validation.ClaimsIdentity.Claims.ToDictionary(c => c.Type, c => c.Value);
        Assert.Equal(registered.User.Id.ToString(), claims[JwtRegisteredClaimNames.Sub]);
        Assert.Equal(email, claims[JwtRegisteredClaimNames.Email]);
        Assert.Equal("Ann", claims["name"]);
        Assert.Equal(auth.ExpiresAt.ToUnixTimeSeconds(), ((JsonWebToken)validation.SecurityToken).ValidTo.Subtract(DateTime.UnixEpoch).TotalSeconds, precision: 1);
        Assert.InRange(auth.ExpiresAt, DateTimeOffset.UtcNow.AddMinutes(55), DateTimeOffset.UtcNow.AddMinutes(61));
    }

    [Fact]
    public async Task The_token_from_register_works_straight_away()
    {
        var auth = await RegisterAsync();

        var response = await GetMeAsync(auth.AccessToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Me_returns_the_account_for_a_valid_token()
    {
        var auth = await RegisterAsync(displayName: "Bea");

        var response = await GetMeAsync(auth.AccessToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var user = await response.Content.ReadFromJsonAsync<UserDto>();
        Assert.Equal(auth.User, user);
    }

    [Fact]
    public async Task Me_without_a_token_is_401_and_asks_for_a_bearer_token()
    {
        var response = await GetMeAsync(token: null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Contains(response.Headers.WwwAuthenticate, h => h.Scheme == "Bearer");
    }

    [Fact]
    public async Task Me_rejects_a_token_that_is_not_a_jwt()
    {
        var response = await GetMeAsync("not-a-token");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Me_rejects_other_authorization_schemes()
    {
        var auth = await RegisterAsync();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me");
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", auth.AccessToken);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Me_rejects_a_token_signed_with_a_different_key()
    {
        var auth = await RegisterAsync();
        var forged = ForgeToken(auth.User.Id.ToString(), signingKey: "some-other-signing-key-0123456789-abcdef");

        Assert.Equal(HttpStatusCode.Unauthorized, (await GetMeAsync(forged)).StatusCode);
    }

    [Fact]
    public async Task Me_rejects_an_unsigned_token()
    {
        var auth = await RegisterAsync();
        var forged = ForgeToken(auth.User.Id.ToString(), signed: false);

        Assert.Equal(HttpStatusCode.Unauthorized, (await GetMeAsync(forged)).StatusCode);
    }

    [Fact]
    public async Task Me_rejects_a_token_with_the_wrong_issuer_or_audience()
    {
        var auth = await RegisterAsync();

        Assert.Equal(HttpStatusCode.Unauthorized, (await GetMeAsync(ForgeToken(auth.User.Id.ToString(), issuer: "someone-else"))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await GetMeAsync(ForgeToken(auth.User.Id.ToString(), audience: "another-app"))).StatusCode);
    }

    [Fact]
    public async Task Me_rejects_an_expired_token()
    {
        var auth = await RegisterAsync();
        var expired = ForgeToken(auth.User.Id.ToString(), expiresIn: TimeSpan.FromMinutes(-5));

        Assert.Equal(HttpStatusCode.Unauthorized, (await GetMeAsync(expired)).StatusCode);
    }

    [Fact]
    public async Task Me_accepts_a_forged_token_only_when_everything_matches()
    {
        // Control for the rejection tests above: the same forging helper, unchanged, is accepted.
        var auth = await RegisterAsync();

        Assert.Equal(HttpStatusCode.OK, (await GetMeAsync(ForgeToken(auth.User.Id.ToString()))).StatusCode);
    }

    [Fact]
    public async Task Me_rejects_a_valid_token_whose_subject_is_not_an_account_id()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await GetMeAsync(ForgeToken("not-a-guid"))).StatusCode);
    }

    [Fact]
    public async Task Me_rejects_a_valid_token_for_an_account_that_no_longer_exists()
    {
        var auth = await RegisterAsync();
        await _factory.WithDbAsync(db => db.Users.Where(u => u.Id == auth.User.Id).ExecuteDeleteAsync());

        Assert.Equal(HttpStatusCode.Unauthorized, (await GetMeAsync(auth.AccessToken)).StatusCode);
    }

    [Fact]
    public async Task Guest_mode_still_works_plans_can_be_generated_without_a_token()
    {
        var response = await _client.PostAsJsonAsync("/api/plans/generate", new
        {
            preferences = new
            {
                budgetPerPerson = 30,
                groupSize = 4,
                activities = new[] { "dinner" },
                startTime = "2026-10-30T20:00:00+01:00",
                endTime = "2026-10-30T23:00:00+01:00",
                maxDistanceKm = 5,
                transport = new[] { "walking" },
            },
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Tokens_never_appear_in_the_logs()
    {
        var auth = await RegisterAsync();
        var login = await _client.PostAsJsonAsync("/api/auth/login", new { email = auth.User.Email, password = Password });
        var loginToken = (await login.Content.ReadFromJsonAsync<AuthResponse>())!.AccessToken;
        await GetMeAsync(auth.AccessToken);
        await GetMeAsync(ForgeToken(signingKey: "some-other-signing-key-0123456789-abcdef"));

        var logged = string.Join("\n", _factory.Logs.Messages);

        Assert.DoesNotContain(auth.AccessToken, logged);
        Assert.DoesNotContain(loginToken, logged);
        Assert.Contains("/api/auth/me", logged); // the requests themselves are logged
    }

    [Theory]
    [InlineData("")]
    [InlineData("too-short-for-hmac")]
    public void Api_refuses_to_start_without_a_strong_signing_key(string signingKey)
    {
        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing"); // Development would supply its own key
            builder.UseSetting("ConnectionStrings:Default", "Host=localhost;Database=unused");
            builder.UseSetting("Database:MigrateOnStartup", "false");
            builder.UseSetting("Jwt:SigningKey", signingKey);
        });

        var error = Assert.ThrowsAny<Exception>(() => factory.CreateClient());
        Assert.Contains("SigningKey", error.ToString());
    }
}
