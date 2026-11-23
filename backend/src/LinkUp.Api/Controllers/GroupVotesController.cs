using System.IdentityModel.Tokens.Jwt;
using LinkUp.Api.Dtos;
using LinkUp.Api.Planning;
using LinkUp.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LinkUp.Api.Controllers;

/// <summary>Voting between the plans of a group's round (#172). Only the group's members can see or vote.</summary>
[ApiController]
[Authorize]
[Route("api/groups/{groupId:guid}/rounds/{roundId:guid}")]
public sealed class GroupVotesController(IGroupVoteService votes, IGroupPlanSwapService swaps) : ControllerBase
{
    [HttpGet("votes")]
    [EndpointSummary("Where the vote stands")]
    [EndpointDescription(
        "The votes per plan, how many members voted and which plan you voted for. Once every member has voted or " +
        "the owner has closed the vote, winnerPlanIds lists the plan with the most votes (several plans are a tie; " +
        "none when nobody voted). Only the votes of members still in the group count. 404 when the round doesn't " +
        "exist, belongs to another group, or you are not a member.")]
    [ProducesResponseType<GroupVoteResultsDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<GroupVoteResultsDto>> Get(Guid groupId, Guid roundId, CancellationToken cancellationToken)
    {
        if (CurrentUserId() is not { } userId) return Unauthorized();
        return await votes.GetResultsAsync(userId, groupId, roundId, cancellationToken) is { } results
            ? Ok(results)
            : RoundNotFound();
    }

    [HttpPut("votes/me")]
    [EndpointSummary("Vote for a plan, or change your vote")]
    [EndpointDescription(
        "One vote per member per round: voting again moves your vote to the other plan. Returns where the vote " +
        "stands. 404 when the round isn't found (as for the results) or the plan is not one of its plans, 409 once " +
        "the owner has closed the vote.")]
    [ProducesResponseType<GroupVoteResultsDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<GroupVoteResultsDto>> Cast(
        Guid groupId, Guid roundId, CastVoteRequest request, CancellationToken cancellationToken)
    {
        if (CurrentUserId() is not { } userId) return Unauthorized();
        return ToResponse(await votes.CastAsync(userId, groupId, roundId, request.PlanId, cancellationToken));
    }

    [HttpPost("close")]
    [EndpointSummary("Close the vote")]
    [EndpointDescription(
        "Nobody can vote or change their vote any more. Only the group's owner can (403); closing again does " +
        "nothing. Returns where the vote stands. 404 when the round isn't found (as for the results).")]
    [ProducesResponseType<GroupVoteResultsDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<GroupVoteResultsDto>> Close(Guid groupId, Guid roundId, CancellationToken cancellationToken)
    {
        if (CurrentUserId() is not { } userId) return Unauthorized();
        return ToResponse(await votes.CloseAsync(userId, groupId, roundId, cancellationToken));
    }

    [HttpPut("plans/{planId:guid}/stops/{stopIndex:int:min(0)}")]
    [EndpointSummary("Swap a stop in one of the round's plans")]
    [EndpointDescription(
        "While the vote is open, any member can replace one stop of a plan with a venue from the swap options " +
        "for that stop (POST /api/plans/swap-options with the round's group size). The venue is checked against " +
        "those options again here, so the plan follows the same rules as a generated one. Everyone sees the " +
        "changed plan; votes for it stay. Returns the changed plan. 400 for a stop the plan doesn't have or a " +
        "venue that is not an option, 404 when the round isn't found (as for the results) or the plan is not " +
        "one of its plans, 409 once the vote is closed.")]
    [ProducesResponseType<PlanDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<PlanDto>> SwapStop(
        Guid groupId, Guid roundId, Guid planId, int stopIndex, SwapGroupStopRequest request,
        CancellationToken cancellationToken)
    {
        if (CurrentUserId() is not { } userId) return Unauthorized();
        try
        {
            return await swaps.SwapStopAsync(
                    userId, groupId, roundId, planId, stopIndex, request.VenueId, cancellationToken) switch
            {
                SwapStopResult.Swapped swapped => Ok(swapped.Plan),
                SwapStopResult.PlanNotFound => Problem(
                    statusCode: StatusCodes.Status404NotFound, title: "That plan is not one of this round's plans."),
                SwapStopResult.AlreadyClosed => Problem(
                    statusCode: StatusCodes.Status409Conflict, title: "The vote is closed."),
                SwapStopResult.NotAnOption => InvalidSwap(
                    nameof(request.VenueId), "That place is not an option for this stop any more."),
                _ => RoundNotFound(),
            };
        }
        catch (InvalidSwapException ex)
        {
            return InvalidSwap(ex.Field == nameof(SwapOptionsRequest.StopIndex) ? "stopIndex" : ex.Field, ex.Message);
        }
    }

    private ActionResult InvalidSwap(string field, string message)
    {
        ModelState.AddModelError(field, message);
        return ValidationProblem(ModelState);
    }

    private ActionResult<GroupVoteResultsDto> ToResponse(VoteResult result) => result switch
    {
        VoteResult.Done done => Ok(done.Results),
        VoteResult.PlanNotFound => Problem(
            statusCode: StatusCodes.Status404NotFound, title: "That plan is not one of this round's plans."),
        VoteResult.AlreadyClosed => Problem(
            statusCode: StatusCodes.Status409Conflict, title: "The vote is closed."),
        VoteResult.NotTheOwner => Problem(
            statusCode: StatusCodes.Status403Forbidden, title: "Only the group's owner can close the vote."),
        _ => RoundNotFound(),
    };

    private ObjectResult RoundNotFound() => Problem(statusCode: StatusCodes.Status404NotFound, title: "Round not found.");

    private Guid? CurrentUserId() =>
        Guid.TryParse(User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out var id) ? id : null;
}
