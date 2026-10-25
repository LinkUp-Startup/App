using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace LinkUp.Api.Dtos;

/// <summary>Limits are checked on the server; the app's forms should mirror them.</summary>
public static class AuthLimits
{
    public const int EmailMaxLength = 254; // RFC 5321 maximum address length
    public const int PasswordMinLength = 8;
    public const int PasswordMaxLength = 128; // caps the work a single hash can cost
    public const int DisplayNameMaxLength = 50;
}

public sealed record RegisterRequest(
    [property: JsonRequired] [Required] [EmailAddress] [MaxLength(AuthLimits.EmailMaxLength)] string Email,
    [property: JsonRequired] [Required] [StringLength(AuthLimits.PasswordMaxLength, MinimumLength = AuthLimits.PasswordMinLength)] string Password,
    [property: JsonRequired] [Required] [MaxLength(AuthLimits.DisplayNameMaxLength)] string DisplayName);

public sealed record LoginRequest(
    [property: JsonRequired] [Required] [MaxLength(AuthLimits.EmailMaxLength)] string Email,
    [property: JsonRequired] [Required] [MaxLength(AuthLimits.PasswordMaxLength)] string Password);

/// <summary>What the API reveals about an account. Never includes the password hash.</summary>
public sealed record UserDto(Guid Id, string Email, string DisplayName);

/// <summary>Returned by register and login. Send the token as "Authorization: Bearer &lt;accessToken&gt;".</summary>
public sealed record AuthResponse(string AccessToken, DateTimeOffset ExpiresAt, UserDto User);
