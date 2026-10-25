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
    [ProducesResponseType<GeneratePlansResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<CandidateAvailabilityProblem>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
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

        var plans = await planService.GeneratePlansAsync(request.Preferences, cancellationToken);
        return Ok(new GeneratePlansResponse(plans));
    }
}
