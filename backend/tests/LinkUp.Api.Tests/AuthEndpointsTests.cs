using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;

namespace LinkUp.Api.Tests;

public sealed class AuthEndpointsTests : IClassFixture<AuthApiFactory>
{
    private const string Password = "correct-horse-battery";
    private readonly AuthApiFactory _factory;
    private readonly HttpClient _client;

    public AuthEndpointsTests(AuthApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // Each test uses its own email so the tests can share one database.
    private static string NewEmail() => $"{Guid.NewGuid():N}@example.com";

    private Task<HttpResponseMessage> RegisterAsync(string email, string password = Password, string displayName = "Ann") =>
        _client.PostAsJsonAsync("/api/auth/register", new { email, password, displayName });

    private Task<HttpResponseMessage> LoginAsync(string email, string password) =>
        _client.PostAsJsonAsync("/api/auth/login", new { email, password });

    [Fact]
    public async Task Register_creates_the_account_and_never_returns_the_hash()
    {
        var email = NewEmail();

        var response = await RegisterAsync(email, displayName: "  Ann  ");

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        var user = JsonSerializer.Deserialize<UserDto>(body, new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        Assert.Equal(email, user.Email);
        Assert.Equal("Ann", user.DisplayName);
        Assert.NotEqual(Guid.Empty, user.Id);
        Assert.DoesNotContain("hash", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(Password, body);
    }

    [Fact]
    public async Task Register_stores_a_hash_not_the_password()
    {
        var email = NewEmail();
        await RegisterAsync(email);

        var stored = await _factory.WithDbAsync(
            db => db.Users.Where(u => u.Email == email).Select(u => u.PasswordHash).SingleAsync());

        Assert.NotEqual(Password, stored);
        Assert.DoesNotContain(Password, stored);
        Assert.True(stored.Length > 40);
    }

    [Fact]
    public async Task Register_treats_emails_case_insensitively_and_rejects_duplicates_with_409()
    {
        var email = NewEmail();
        await RegisterAsync(email);

        var duplicate = await RegisterAsync(email.ToUpperInvariant());

        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        Assert.Equal("application/problem+json", duplicate.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Simultaneous_registrations_of_one_email_create_exactly_one_account()
    {
        var email = NewEmail();

        var responses = await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => RegisterAsync(email)));

        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(9, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        Assert.Equal(1, await _factory.WithDbAsync(db => db.Users.CountAsync(u => u.Email == email)));
    }

    [Fact]
    public async Task A_registration_that_loses_the_race_to_the_unique_index_gets_409_not_500()
    {
        // Both requests pass the "email already registered?" check, then meet at a barrier inside the hasher,
        // so both really insert and the database's unique index decides which one wins.
        var hasher = new RendezvousPasswordHasher(participants: 2);
        using var client = _factory
            .WithWebHostBuilder(builder => builder.ConfigureServices(services =>
            {
                services.RemoveAll<IPasswordHasher<User>>();
                services.AddSingleton<IPasswordHasher<User>>(hasher);
            }))
            .CreateClient();
        var email = NewEmail();

        var responses = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ =>
            client.PostAsJsonAsync("/api/auth/register", new { email, password = Password, displayName = "Ann" })));

        Assert.True(hasher.BothMet, "The two requests never overlapped, so the race was not exercised.");
        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        Assert.Equal(1, await _factory.WithDbAsync(db => db.Users.CountAsync(u => u.Email == email)));
    }

    /// <summary>Makes the first N callers wait for each other before hashing.</summary>
    private sealed class RendezvousPasswordHasher(int participants) : IPasswordHasher<User>
    {
        private readonly Barrier _barrier = new(participants);
        private readonly PasswordHasher<User> _inner = new();

        public bool BothMet { get; private set; }

        public string HashPassword(User user, string password)
        {
            BothMet = _barrier.SignalAndWait(TimeSpan.FromSeconds(10)) || BothMet;
            return _inner.HashPassword(user, password);
        }

        public PasswordVerificationResult VerifyHashedPassword(User user, string hashedPassword, string providedPassword) =>
            _inner.VerifyHashedPassword(user, hashedPassword, providedPassword);
    }

    [Fact]
    public async Task The_database_itself_rejects_a_duplicate_email()
    {
        var email = NewEmail();
        await RegisterAsync(email);

        var error = await Assert.ThrowsAsync<DbUpdateException>(() => _factory.WithDbAsync(async db =>
        {
            db.Users.Add(new User { Id = Guid.NewGuid(), Email = email, PasswordHash = "x", DisplayName = "Dup" });
            return await db.SaveChangesAsync();
        }));

        Assert.IsType<PostgresException>(error.InnerException);
    }

    [Fact]
    public async Task Register_stamps_the_creation_time_from_the_database()
    {
        var email = NewEmail();
        var before = DateTimeOffset.UtcNow.AddMinutes(-1);
        await RegisterAsync(email);

        var createdAt = await _factory.WithDbAsync(db => db.Users.Where(u => u.Email == email).Select(u => u.CreatedAt).SingleAsync());

        Assert.InRange(createdAt, before, DateTimeOffset.UtcNow.AddMinutes(1));
    }

    [Theory]
    [InlineData("not-an-email", "correct-horse-battery", "Ann")]
    [InlineData("a@example.com", "short", "Ann")]
    [InlineData("a@example.com", "correct-horse-battery", "")]
    [InlineData("a@example.com", "correct-horse-battery", "   ")]
    public async Task Register_rejects_invalid_input_with_400(string email, string password, string displayName)
    {
        var response = await RegisterAsync(email, password, displayName);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Register_rejects_missing_fields_with_400()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/register", new { email = NewEmail() });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Login_succeeds_with_the_right_password_and_any_email_casing()
    {
        var email = NewEmail();
        await RegisterAsync(email, displayName: "Ann");

        var response = await LoginAsync(email.ToUpperInvariant(), Password);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var user = await response.Content.ReadFromJsonAsync<UserDto>();
        Assert.Equal(email, user!.Email);
        Assert.Equal("Ann", user.DisplayName);
    }

    [Fact]
    public async Task Login_gives_the_same_401_for_a_wrong_password_and_an_unknown_email()
    {
        var email = NewEmail();
        await RegisterAsync(email);

        var wrongPassword = await LoginAsync(email, "wrong-password-1");
        var unknownEmail = await LoginAsync(NewEmail(), Password);

        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknownEmail.StatusCode);
        // Everything but the per-request traceId must match, or the response would reveal which emails exist.
        Assert.Equal(await DescribeProblemAsync(wrongPassword), await DescribeProblemAsync(unknownEmail));
    }

    private static async Task<string> DescribeProblemAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = document.RootElement;
        return $"{root.GetProperty("status")}|{root.GetProperty("title")}|{root.GetProperty("type")}";
    }

    [Fact]
    public async Task Login_rejects_a_missing_password_with_400()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/login", new { email = NewEmail() });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Passwords_never_appear_in_the_logs()
    {
        var email = NewEmail();
        const string secret = "log-canary-p4ssword!";
        await RegisterAsync(email, secret);
        await LoginAsync(email, secret);
        await LoginAsync(email, "log-canary-wrong-password");

        var logged = string.Join("\n", _factory.Logs.Messages);

        Assert.DoesNotContain(secret, logged);
        Assert.DoesNotContain("log-canary-wrong-password", logged);
        Assert.Contains("/api/auth/login", logged); // the request itself is still logged
    }
}
