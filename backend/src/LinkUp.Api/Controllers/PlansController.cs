using LinkUp.Api.Dtos;
using LinkUp.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace LinkUp.Api.Controllers;

[ApiController]
[Route("api/plans")]
public sealed class PlansController(IPlanService planService) : ControllerBase
{
    [HttpPost("generate")]
    [ProducesResponseType<GeneratePlansResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<GeneratePlansResponse>> Generate(
        GeneratePlansRequest request, CancellationToken cancellationToken)
    {
        var plans = await planService.GeneratePlansAsync(request.Preferences, cancellationToken);
        return Ok(new GeneratePlansResponse(plans));
    }
}
