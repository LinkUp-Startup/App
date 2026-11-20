using LinkUp.Api.Dtos;
using LinkUp.Api.Services;
using LinkUp.Api.RateLimiting;
using LinkUp.Api.Planning;
using Microsoft.AspNetCore.Mvc;

namespace LinkUp.Api.Controllers;

[ApiController]
[Route("api/plans")]
public sealed class PlansController(PlanGenerator generator) : ControllerBase
{
    [HttpPost("generate")]
    [AiGeneration]
    [EndpointSummary("Generate 2-3 night plans")]
    [EndpointDescription(
        "Validates the preferences (400), filters the venue database (422 when too few venues match), lets the AI " +
        "combine the remaining venues into plans, and checks every plan against the database before returning " +
        "2 or 3 distinct plans. 502 when the AI is unavailable or returns fewer than 2 usable plans.")]
    [ProducesResponseType<GeneratePlansResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<CandidateAvailabilityProblem>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status502BadGateway, "application/problem+json")]
    public async Task<ActionResult<GeneratePlansResponse>> Generate(
        GeneratePlansRequest request, CancellationToken cancellationToken)
    {
        var result = await generator.GenerateAsync(request.Preferences, cancellationToken);
        return result is PlanGenerationResult.Generated generated
            ? Ok(new GeneratePlansResponse(generated.Plans))
            : PlanGenerationResponses.Failure(this, result);
    }

    [HttpPost("swap-options")]
    [EndpointSummary("Alternatives for one stop of a plan")]
    [EndpointDescription(
        "Swap a stop (#229): returns up to 5 copies of the plan with one stop replaced by another venue of the " +
        "same activity that is open at that time, fits the budget (or costs no more than the stop it replaces when " +
        "no budget is sent) and is at most 2 km further out of the way. Costs and distances are recalculated from " +
        "the database. No AI call. 400 when the plan can't be read or a place in it no longer exists.")]
    [ProducesResponseType<SwapOptionsResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests, "application/problem+json")]
    public async Task<ActionResult<SwapOptionsResponse>> SwapOptions(
        SwapOptionsRequest request, [FromServices] IPlanSwapService swaps, CancellationToken cancellationToken)
    {
        try
        {
            return Ok(new SwapOptionsResponse(await swaps.GetOptionsAsync(request, cancellationToken)));
        }
        catch (InvalidSwapException ex)
        {
            ModelState.AddModelError(ex.Field, ex.Message);
            return ValidationProblem(ModelState);
        }
    }
}
