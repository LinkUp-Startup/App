namespace LinkUp.Api.Dtos;

/// <param name="Status">"healthy" or "unhealthy".</param>
/// <param name="Checks">Result per dependency, e.g. { "database": "healthy" }.</param>
public sealed record HealthResponse(string Status, DateTime TimeUtc, IReadOnlyDictionary<string, string> Checks);
