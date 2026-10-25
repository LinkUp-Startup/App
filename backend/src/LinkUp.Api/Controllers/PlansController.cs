using LinkUp.Api.Ai;
using LinkUp.Api.Dtos;
using LinkUp.Api.Services;
using LinkUp.Api.Options;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace LinkUp.Api.Controllers;

[ApiController]
[Route("api/plans")]
public sealed class PlansController(
    IPlanService planService, IVenueFilteringService venueFilteringService,
    IOptions<PlanGenerationOptions> options) : ControllerBase
{
    [HttpPost("generate")]
    [EndpointSummary("Generate 2-3 night plans")]
    [EndpointDescription(
        "Validates the preferences (400), filters the venue database (422 when too few venues match), lets the AI " +
        "combine the remaining venues into plans, and checks every plan against the database before returning " +
        "2 or 3 distinct plans. 502 when the AI is unavailable or returns fewer than 2 usable plans.")]
    [ProducesResponseType<GeneratePlansResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<CandidateAvailabilityProblem>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status502BadGateway, "application/problem+json")]
    public async Task<ActionResult<GeneratePlansResponse>> Generate(
        GeneratePlansRequest request, CancellationToken cancellationToken)
    {
        var candidates = await venueFilteringService.FilterAsync(request.Preferences, cancellationToken);
        var minimum = options.Value.MinimumCandidateCount;
        if (candidates.Count < minimum)
        {
            var none = candidates.Count == 0;
            return UnprocessableEntity(new CandidateAvailabilityProblem
            {
                Status = StatusCodes.Status422UnprocessableEntity,
                Code = none ? "no_candidates" : "insufficient_candidates",
                Title = none ? "No venues match your preferences." : "Not enough venues match your preferences.",
                Detail = none
                    ? "No venues match the selected preferences. A plan cannot be generated."
                    : $"Only {candidates.Count} matching {(candidates.Count == 1 ? "venue was" : "venues were")} found; at least {minimum} are needed to build a plan.",
                CandidateCount = candidates.Count,
                MinimumRequired = minimum,
                Suggestion = "Try different activities or a wider time window, and check that a transport option is selected.",
            });
        }

        try
        {
            var plans = await planService.GeneratePlansAsync(request.Preferences, candidates, cancellationToken);
            return Ok(new GeneratePlansResponse(plans));
        }
        catch (AiException)
        {
            // Already logged with the details by the AI client or the plan service.
            return Problem(
                statusCode: StatusCodes.Status502BadGateway,
                title: "Couldn't generate plans right now.",
                detail: "The plan generator is unavailable or returned no usable plan. Try again in a moment.");
        }
    }
}
