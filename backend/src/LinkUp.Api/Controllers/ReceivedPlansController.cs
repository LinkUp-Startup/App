using System.IdentityModel.Tokens.Jwt;
using LinkUp.Api.Dtos;
using LinkUp.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LinkUp.Api.Controllers;

/// <summary>Plans friends sent you (#207).</summary>
[ApiController]
[Authorize]
[Route("api/received-plans")]
public sealed class ReceivedPlansController(IReceivedPlanService receivedPlans) : ControllerBase
{
    [HttpGet]
    [EndpointSummary("List the plans friends sent you")]
    [EndpointDescription("Newest first, each with who sent it. Save one to your account to keep it in your saved plans.")]
    [ProducesResponseType<ReceivedPlansResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ReceivedPlansResponse>> List(CancellationToken cancellationToken)
    {
        if (CurrentUserId() is not { } userId) return Unauthorized();
        return Ok(new ReceivedPlansResponse(await receivedPlans.ListAsync(userId, cancellationToken)));
    }

    [HttpDelete("{id:guid}")]
    [EndpointSummary("Remove a plan a friend sent you")]
    [EndpointDescription("204 whether or not it was there, so a retry is harmless. Plans you saved stay saved.")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        if (CurrentUserId() is not { } userId) return Unauthorized();
        await receivedPlans.DeleteAsync(userId, id, cancellationToken);
        return NoContent();
    }

    private Guid? CurrentUserId() =>
        Guid.TryParse(User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out var id) ? id : null;
}
