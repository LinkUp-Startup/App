using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace LinkUp.Api.Controllers;

[ApiController]
[Route("health")]
public sealed class HealthController(HealthCheckService healthChecks) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var report = await healthChecks.CheckHealthAsync(cancellationToken);
        var healthy = report.Status == HealthStatus.Healthy;

        var body = new
        {
            status = healthy ? "healthy" : "unhealthy",
            timeUtc = DateTime.UtcNow,
            checks = report.Entries.ToDictionary(
                entry => entry.Key, entry => entry.Value.Status.ToString().ToLowerInvariant()),
        };

        return healthy ? Ok(body) : StatusCode(StatusCodes.Status503ServiceUnavailable, body);
    }
}
