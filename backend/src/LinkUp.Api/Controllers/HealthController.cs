using Microsoft.AspNetCore.Mvc;

namespace LinkUp.Api.Controllers;

[ApiController]
[Route("health")]
public sealed class HealthController : ControllerBase
{
    // TODO(#31+): also report database connectivity once EF Core is wired up.
    [HttpGet]
    public IActionResult Get() => Ok(new { status = "healthy", timeUtc = DateTime.UtcNow });
}
