using System.ComponentModel.DataAnnotations;

namespace LinkUp.Api.Options;

/// <summary>
/// Limits that keep scrapers and bots from overloading the API or spending the AI budget, loose enough for a
/// classroom demo where many phones share one public IP. Every value can be raised from Dokploy, e.g.
/// <c>RateLimiting__GenerationsPerHour=100</c>, without a code change.
/// </summary>
public sealed class RateLimitingOptions
{
    public const string SectionName = "RateLimiting";

    /// <summary>Requests per client IP per minute, for every endpoint. Only stops floods.</summary>
    [Range(1, 100_000)]
    public int RequestsPerMinute { get; init; } = 300;

    /// <summary>
    /// Plan generations per minute and per hour, counted per account when logged in and per client IP for guests.
    /// Each one is a paid AI call. The per-minute limit is what stops a bot; people rarely generate more than a
    /// few plans in a row.
    /// </summary>
    [Range(1, 10_000)]
    public int GenerationsPerMinute { get; init; } = 5;

    [Range(1, 10_000)]
    public int GenerationsPerHour { get; init; } = 30;

    /// <summary>
    /// Plan generations per day for everyone together (UTC days), so many IPs can't spend more than a fixed
    /// budget either: 1,000 × ~$0.0007 ≈ $0.70 a day.
    /// </summary>
    [Range(1, 1_000_000)]
    public int GenerationsPerDay { get; init; } = 1000;

    /// <summary>
    /// Proxies whose X-Forwarded-For header is trusted, in CIDR notation. Defaults to the private ranges the
    /// Docker network of Dokploy's Traefik lives in. A client reaching the API directly has a public address,
    /// so its own X-Forwarded-For is ignored and can't be used to dodge the limits.
    /// </summary>
    public string[] TrustedProxyNetworks { get; init; } = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8", "::1/128"];
}
