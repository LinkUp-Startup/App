using LinkUp.Api.Dtos;
using LinkUp.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace LinkUp.Api.Controllers;

[ApiController]
[Route("api/venues")]
public sealed class VenuesController(IVenueService venueService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<VenueDetailsDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<VenueDetailsDto>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await venueService.GetAllAsync(cancellationToken));

    [HttpGet("{id:int}")]
    [ProducesResponseType<VenueDetailsDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<VenueDetailsDto>> GetById(int id, CancellationToken cancellationToken)
    {
        var venue = await venueService.GetByIdAsync(id, cancellationToken);
        if (venue is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: $"Venue {id} not found.");

        return Ok(venue);
    }
}