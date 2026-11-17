using System.ComponentModel.DataAnnotations;
using System.IdentityModel.Tokens.Jwt;
using LinkUp.Api.Dtos;
using LinkUp.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LinkUp.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/users")]
public sealed class UsersController(IFriendService friends, IUserPreferencesService preferences) : ControllerBase
{
    [HttpGet("me/preferences")]
    [EndpointSummary("Get the signed-in user's saved planning defaults")]
    [ProducesResponseType<UserPreferencesDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<UserPreferencesDto>> GetPreferences(CancellationToken cancellationToken)
    {
        if (CurrentUserId() is not { } userId) return Unauthorized();
        return await preferences.GetAsync(userId, cancellationToken) is { } saved
            ? Ok(saved) : Unauthorized();
    }

    [HttpPut("me/preferences")]
    [EndpointSummary("Replace the signed-in user's saved planning defaults")]
    [EndpointDescription("Replaces all five defaults. Omitted or null fields clear the saved value. " +
        "Supplied selections must be non-empty, supported and distinct. Budget is EUR per person; distance is kilometres. " +
        "Returns 401 if the account no longer exists.")]
    [ProducesResponseType<UserPreferencesDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<UserPreferencesDto>> UpdatePreferences(
        UpdateUserPreferencesRequest request, CancellationToken cancellationToken)
    {
        if (CurrentUserId() is not { } userId) return Unauthorized();
        return await preferences.UpdateAsync(userId, request, cancellationToken) is { } saved
            ? Ok(saved) : Unauthorized();
    }

    [HttpGet("search")]
    [EndpointSummary("Search users by display name")]
    [EndpointDescription(
        "Case-insensitive match anywhere in the display name, at least 2 characters, up to 20 results, never " +
        "including the signed-in user. Returns only ids and display names, never email addresses. Relation says " +
        "whether you are friends or a request is pending.")]
    [ProducesResponseType<UserSearchResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<UserSearchResponse>> Search(
        [FromQuery] [Required] [StringLength(FriendLimits.SearchMaxLength, MinimumLength = FriendLimits.SearchMinLength)] string query,
        CancellationToken cancellationToken)
    {
        if (CurrentUserId() is not { } currentUserId) return Unauthorized();
        return Ok(new UserSearchResponse(await friends.SearchUsersAsync(currentUserId, query, cancellationToken)));
    }

    private Guid? CurrentUserId() =>
        Guid.TryParse(User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out var id) ? id : null;
}
