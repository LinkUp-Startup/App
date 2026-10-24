namespace LinkUp.Api.Data.Entities;

public sealed class User
{
    public Guid Id { get; set; }

    /// <summary>Stored lowercase and unique; used to log in.</summary>
    public required string Email { get; set; }

    /// <summary>Output of the password hasher, never the plain password.</summary>
    public required string PasswordHash { get; set; }

    public required string DisplayName { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
