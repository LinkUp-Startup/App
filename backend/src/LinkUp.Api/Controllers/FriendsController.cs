using System.IdentityModel.Tokens.Jwt;
using LinkUp.Api.Dtos;
using LinkUp.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LinkUp.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/friends")]
public sealed class FriendsController(IFriendService friends) : ControllerBase
{
    [HttpGet]
    [EndpointSummary("List friends and pending friend requests")]
    [ProducesResponseType<FriendsResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<FriendsResponse>> List(CancellationToken cancellationToken)
    {
        if (CurrentUserId() is not { } currentUserId) return Unauthorized();
        return Ok(await friends.ListAsync(currentUserId, cancellationToken));
    }

    [HttpPost("requests/{userId:guid}")]
    [EndpointSummary("Send a friend request")]
    [EndpointDescription(
        "204 also when the request was already sent. 409 when you are already friends or the user already sent " +
        "you a request (accept it instead). 400 for yourself, 404 for an unknown user.")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Send(Guid userId, CancellationToken cancellationToken)
    {
        if (CurrentUserId() is not { } currentUserId) return Unauthorized();
        return ToResponse(await friends.SendRequestAsync(currentUserId, userId, cancellationToken));
    }

    [HttpPost("requests/{userId:guid}/accept")]
    [EndpointSummary("Accept a friend request")]
    [EndpointDescription(
        "Accepts the request the given user sent you. Only the receiver can accept: 403 for the sender, 404 when " +
        "there is no pending request between you.")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Accept(Guid userId, CancellationToken cancellationToken)
    {
        if (CurrentUserId() is not { } currentUserId) return Unauthorized();
        return ToResponse(await friends.AcceptAsync(currentUserId, userId, cancellationToken));
    }

    [HttpPost("requests/{userId:guid}/decline")]
    [EndpointSummary("Decline a friend request")]
    [EndpointDescription(
        "Declines the request the given user sent you. Only the receiver can decline: 403 for the sender, 404 " +
        "when there is no pending request between you.")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Decline(Guid userId, CancellationToken cancellationToken)
    {
        if (CurrentUserId() is not { } currentUserId) return Unauthorized();
        return ToResponse(await friends.DeclineAsync(currentUserId, userId, cancellationToken));
    }

    [HttpDelete("{userId:guid}")]
    [EndpointSummary("Remove a friend or cancel a sent request")]
    [EndpointDescription("204 whether or not there was anything to remove, so a retry is harmless.")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Remove(Guid userId, CancellationToken cancellationToken)
    {
        if (CurrentUserId() is not { } currentUserId) return Unauthorized();
        await friends.RemoveAsync(currentUserId, userId, cancellationToken);
        return NoContent();
    }

    private IActionResult ToResponse(FriendActionResult result) => result switch
    {
        FriendActionResult.Done => NoContent(),
        FriendActionResult.UnknownAccount => Unauthorized(),
        FriendActionResult.UserNotFound =>
            Problem(statusCode: StatusCodes.Status404NotFound, title: "User not found."),
        FriendActionResult.CannotBefriendYourself =>
            Problem(statusCode: StatusCodes.Status400BadRequest, title: "You can't send a friend request to yourself."),
        FriendActionResult.AlreadyFriends =>
            Problem(statusCode: StatusCodes.Status409Conflict, title: "You are already friends."),
        FriendActionResult.RequestAlreadyReceived =>
            Problem(statusCode: StatusCodes.Status409Conflict, title: "This user already sent you a friend request. Accept it instead."),
        FriendActionResult.NoPendingRequest =>
            Problem(statusCode: StatusCodes.Status404NotFound, title: "There is no pending friend request from this user."),
        FriendActionResult.NotTheReceiver =>
            Problem(statusCode: StatusCodes.Status403Forbidden, title: "Only the person who received the request can accept or decline it."),
        _ => Problem(statusCode: StatusCodes.Status409Conflict, title: "The request changed at the same time. Try again."),
    };

    private Guid? CurrentUserId() =>
        Guid.TryParse(User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out var id) ? id : null;
}