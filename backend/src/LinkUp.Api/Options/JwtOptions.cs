using System.ComponentModel.DataAnnotations;

namespace LinkUp.Api.Options;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";
    public const int SigningKeyMinLength = 32;

    /// <summary>
    /// Secret used to sign access tokens. Never commit a real one: set the Jwt__SigningKey environment
    /// variable on the server. Anyone who knows it can issue tokens for any account.
    /// </summary>
    [Required, MinLength(SigningKeyMinLength)]
    public string SigningKey { get; set; } = "";

    [Required]
    public string Issuer { get; set; } = "linkup-api";

    [Required]
    public string Audience { get; set; } = "linkup-app";

    [Range(1, 60 * 24 * 30)]
    public int AccessTokenMinutes { get; set; } = 60;
}
