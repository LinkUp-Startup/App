using LinkUp.Api.Dtos;
using LinkUp.Api.Services;
using Microsoft.AspNetCore.HttpLogging;
using Microsoft.AspNetCore.Mvc;

namespace LinkUp.Api.Controllers;

/// <summary>
/// Request bodies here contain passwords, so unlike the rest of the API they are never logged
/// (this attribute overrides the global request-body logging).
/// </summary>
[ApiController]
[Route("api/auth")]
[HttpLogging(HttpLoggingFields.RequestMethod | HttpLoggingFields.RequestPath | HttpLoggingFields.ResponseStatusCode)]
public sealed class AuthController(IAuthService authService) : ControllerBase
{
    [HttpPost("register")]
    [ProducesResponseType<UserDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<UserDto>> Register(RegisterRequest request, CancellationToken cancellationToken)
    {
        var user = await authService.RegisterAsync(request, cancellationToken);
        if (user is null)
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "An account with this email already exists.");

        return StatusCode(StatusCodes.Status201Created, user);
    }

    [HttpPost("login")]
    [ProducesResponseType<UserDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<UserDto>> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var user = await authService.LoginAsync(request, cancellationToken);
        if (user is null)
            // One message for both "no such email" and "wrong password".
            return Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Invalid email or password.");

        return Ok(user);
    }
}
