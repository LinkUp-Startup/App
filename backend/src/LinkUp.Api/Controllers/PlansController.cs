using LinkUp.Api.Dtos;
using LinkUp.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace LinkUp.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class PlansController(IPlanService planService) : ControllerBase
{
    [HttpPost("generate")]
    public async Task<ActionResult<GeneratePlansResponse>> Generate(
        GeneratePlansRequest request, CancellationToken cancellationToken)
    {
        var plans = await planService.GeneratePlansAsync(request.Preferences, cancellationToken);
        return Ok(new GeneratePlansResponse(plans));
    }
}
