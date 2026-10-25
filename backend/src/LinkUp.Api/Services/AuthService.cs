using LinkUp.Api.Data;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace LinkUp.Api.Services;

public sealed class AuthService(AppDbContext db, IPasswordHasher<User> passwordHasher) : IAuthService
{
    private const string UniqueViolation = "23505";

    // Verified against when the email is unknown, so "no such user" costs the same time as "wrong
    // password" and the response doesn't reveal which emails are registered.
    private static readonly Lazy<string> DummyHash = new(() =>
        new PasswordHasher<User>().HashPassword(new User { Email = "", PasswordHash = "", DisplayName = "" }, "not-a-real-password"));

    public async Task<UserDto?> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken)
    {
        var email = NormalizeEmail(request.Email);

        if (await db.Users.AnyAsync(u => u.Email == email, cancellationToken))
            return null;

        var user = new User { Id = Guid.NewGuid(), Email = email, PasswordHash = "", DisplayName = request.DisplayName.Trim() };
        user.PasswordHash = passwordHasher.HashPassword(user, request.Password);
        db.Users.Add(user);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: UniqueViolation })
        {
            // Two registrations for the same email raced past the check above; the unique index decided.
            return null;
        }

        return ToDto(user);
    }

    public async Task<UserDto?> LoginAsync(LoginRequest request, CancellationToken cancellationToken)
    {
        var email = NormalizeEmail(request.Email);
        var user = await db.Users.SingleOrDefaultAsync(u => u.Email == email, cancellationToken);

        if (user is null)
        {
            passwordHasher.VerifyHashedPassword(new User { Email = "", PasswordHash = "", DisplayName = "" }, DummyHash.Value, request.Password);
            return null;
        }

        var result = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (result == PasswordVerificationResult.Failed)
            return null;

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            // The hashing settings were strengthened since this password was stored.
            user.PasswordHash = passwordHasher.HashPassword(user, request.Password);
            await db.SaveChangesAsync(cancellationToken);
        }

        return ToDto(user);
    }

    public async Task<UserDto?> GetUserAsync(Guid id, CancellationToken cancellationToken)
    {
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == id, cancellationToken);
        return user is null ? null : ToDto(user);
    }

    /// <summary>Emails are stored trimmed and lowercase so "Ann@x.com" and "ann@x.com" are one account.</summary>
    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    private static UserDto ToDto(User user) => new(user.Id, user.Email, user.DisplayName);
}
