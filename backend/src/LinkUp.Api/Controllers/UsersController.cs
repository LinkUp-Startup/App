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
public sealed class UsersController(IFriendService friends) : ControllerBase
{
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