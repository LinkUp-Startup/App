using LinkUp.Api.Dtos;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace LinkUp.Api.Controllers;

[ApiController]
[Route("health")]
public sealed class HealthController(HealthCheckService healthChecks) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<HealthResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<HealthResponse>(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<HealthResponse>> Get(CancellationToken cancellationToken)
    {
        var report = await healthChecks.CheckHealthAsync(cancellationToken);
        var healthy = report.Status == HealthStatus.Healthy;

        var body = new HealthResponse(
            healthy ? "healthy" : "unhealthy",
            DateTime.UtcNow,
            report.Entries.ToDictionary(
                entry => entry.Key, entry => entry.Value.Status.ToString().ToLowerInvariant()));

        return healthy ? Ok(body) : StatusCode(StatusCodes.Status503ServiceUnavailable, body);
    }
}
