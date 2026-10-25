using System.IdentityModel.Tokens.Jwt;
using LinkUp.Api.Dtos;
using LinkUp.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LinkUp.Api.Controllers;

/// <summary>Plans saved to the signed-in account, so they show up on every device (#88).</summary>
[ApiController]
[Authorize]
[Route("api/saved-plans")]
public sealed class SavedPlansController(ISavedPlanService savedPlans) : ControllerBase
{
    [HttpGet]
    [EndpointSummary("List the account's saved plans")]
    [ProducesResponseType<SavedPlansResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<SavedPlansResponse>> List(CancellationToken cancellationToken)
    {
        if (CurrentUserId() is not { } userId) return Unauthorized();
        return Ok(new SavedPlansResponse(await savedPlans.ListAsync(userId, cancellationToken)));
    }

    [HttpPut("{id:guid}")]
    [EndpointSummary("Save a plan to the account")]
    [EndpointDescription(
        "Idempotent: saving the same plan id again replaces it. Plan ids are per account, so another account " +
        "saving the same id gets its own copy. The venues are looked up in the database (400 for an unknown " +
        "venue); the body's plan id must match the URL. 401 when the account no longer exists, 409 when it is at " +
        "its limit of saved plans.")]
    [ProducesResponseType<SavedPlanDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<SavedPlanDto>> Save(Guid id, PlanDto plan, CancellationToken cancellationToken)
    {
        if (CurrentUserId() is not { } userId) return Unauthorized();

        return await savedPlans.SaveAsync(userId, id, plan, cancellationToken) switch
        {
            SavePlanResult.Saved saved => Ok(saved.Plan),
            SavePlanResult.Invalid invalid => ValidationProblem(new ValidationProblemDetails(
                invalid.Errors.ToDictionary(e => e.Key, e => e.Value))),
            SavePlanResult.LimitReached limit => Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: $"You can save up to {limit.Limit} plans. Delete one to save another."),
            _ => Unauthorized(), // the account behind the token has been deleted
        };
    }

    [HttpDelete("{id:guid}")]
    [EndpointSummary("Remove a plan from the account")]
    [EndpointDescription("204 whether or not the plan was saved, so a retry is harmless.")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        if (CurrentUserId() is not { } userId) return Unauthorized();
        await savedPlans.DeleteAsync(userId, id, cancellationToken);
        return NoContent();
    }

    private Guid? CurrentUserId() =>
        Guid.TryParse(User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out var id) ? id : null;
}
