using LinkUp.Api.Dtos;
using LinkUp.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
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
public sealed class AuthController(IAuthService authService, ITokenService tokenService) : ControllerBase
{
    [HttpPost("register")]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request, CancellationToken cancellationToken)
    {
        var user = await authService.RegisterAsync(request, cancellationToken);
        if (user is null)
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "An account with this email already exists.");

        return StatusCode(StatusCodes.Status201Created, ToResponse(user));
    }

    [HttpPost("login")]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var user = await authService.LoginAsync(request, cancellationToken);
        if (user is null)
            // One message for both "no such email" and "wrong password".
            return Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Invalid email or password.");

        return Ok(ToResponse(user));
    }

    /// <summary>The signed-in account. Needs "Authorization: Bearer &lt;token&gt;"; otherwise 401.</summary>
    [Authorize]
    [HttpGet("me")]
    [ProducesResponseType<UserDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<UserDto>> Me(CancellationToken cancellationToken)
    {
        // A valid token for an account that has since been deleted is no longer a valid login.
        if (!Guid.TryParse(User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out var id))
            return Unauthorized();

        var user = await authService.GetUserAsync(id, cancellationToken);
        return user is null ? Unauthorized() : Ok(user);
    }

    private AuthResponse ToResponse(UserDto user)
    {
        var token = tokenService.Create(user);
        return new AuthResponse(token.Value, token.ExpiresAt, user);
    }
}
