using LinkUp.Api.Dtos;
using LinkUp.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LinkUp.Api.Controllers;

/// <summary>Plans opened through their share link (#153): public and read-only.</summary>
[ApiController]
[AllowAnonymous]
[Route("api/shared-plans")]
public sealed class SharedPlansController(ISavedPlanService savedPlans) : ControllerBase
{
    [HttpGet("{token}")]
    [EndpointSummary("Open a shared plan")]
    [EndpointDescription("No account needed. 404 when the link is unknown or the owner stopped sharing it.")]
    [ProducesResponseType<SharedPlanDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SharedPlanDto>> Get(string token, CancellationToken cancellationToken) =>
        await savedPlans.GetSharedAsync(token, cancellationToken) is { } plan
            ? Ok(new SharedPlanDto(plan))
            : Problem(statusCode: StatusCodes.Status404NotFound, title: "This plan is not shared or no longer exists.");
}
