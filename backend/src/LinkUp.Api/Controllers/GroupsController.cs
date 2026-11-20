using System.IdentityModel.Tokens.Jwt;
using LinkUp.Api.Dtos;
using LinkUp.Api.Planning;
using LinkUp.Api.RateLimiting;
using LinkUp.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LinkUp.Api.Controllers;

/// <summary>Groups of friends who plan nights together (#165). Only members can see a group.</summary>
[ApiController]
[Authorize]
[Route("api/groups")]
public sealed class GroupsController(IGroupService groups, PlanGenerator generator) : ControllerBase
{
    [HttpGet]
    [EndpointSummary("List your groups")]
    [EndpointDescription("Newest first.")]
    [ProducesResponseType<GroupsResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<GroupsResponse>> List(CancellationToken cancellationToken)
    {
        if (CurrentUserId() is not { } userId) return Unauthorized();
        return Ok(new GroupsResponse(await groups.ListAsync(userId, cancellationToken)));
    }

    [HttpPost]
    [EndpointSummary("Create a group")]
    [EndpointDescription(
        "You become the owner. The members are optional and must all be your friends: 403 lists the ones who " +
        "aren't. 409 when you are already in the maximum number of groups.")]
    [ProducesResponseType<GroupDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<GroupDto>> Create(CreateGroupRequest request, CancellationToken cancellationToken)
    {
        if (CurrentUserId() is not { } userId) return Unauthorized();

        return await groups.CreateAsync(userId, request, cancellationToken) switch
        {
            CreateGroupResult.Created created =>
                CreatedAtAction(nameof(Get), new { groupId = created.Group.Id }, created.Group),
            CreateGroupResult.NotFriends notFriends => Problem(
                statusCode: StatusCodes.Status403Forbidden,
                title: "You can only add your friends to a group.",
                detail: $"Not your friends: {string.Join(", ", notFriends.UserIds)}."),
            CreateGroupResult.LimitReached limit => Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: $"You can be in up to {limit.Limit} groups. Leave one to create another."),
            _ => Unauthorized(), // the account behind the token has been deleted
        };
    }

    [HttpGet("{groupId:guid}")]
    [EndpointSummary("A group and its members")]
    [EndpointDescription("404 when the group doesn't exist or you are not a member.")]
    [ProducesResponseType<GroupDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<GroupDto>> Get(Guid groupId, CancellationToken cancellationToken)
    {
        if (CurrentUserId() is not { } userId) return Unauthorized();
        return await groups.GetAsync(userId, groupId, cancellationToken) is { } group ? Ok(group) : GroupNotFound();
    }

    [HttpPost("{groupId:guid}/members/{userId:guid}")]
    [EndpointSummary("Add a friend to a group")]
    [EndpointDescription(
        "Any member can add their own friends. 204 also when they are already a member. 403 when the user is not " +
        "your friend, 404 when the group doesn't exist or you are not a member, 409 when the group is full.")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AddMember(Guid groupId, Guid userId, CancellationToken cancellationToken)
    {
        if (CurrentUserId() is not { } currentUserId) return Unauthorized();
        return ToResponse(await groups.AddMemberAsync(currentUserId, groupId, userId, cancellationToken));
    }

    [HttpDelete("{groupId:guid}/members/{userId:guid}")]
    [EndpointSummary("Leave a group, or remove a member")]
    [EndpointDescription(
        "With your own id you leave the group; when the owner leaves, the longest-standing member becomes the " +
        "owner, and when the last member leaves the group is deleted. Only the owner can remove someone else " +
        "(403). 204 also when the user was not a member. 404 when the group doesn't exist or you are not a member.")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveMember(Guid groupId, Guid userId, CancellationToken cancellationToken)
    {
        if (CurrentUserId() is not { } currentUserId) return Unauthorized();
        return ToResponse(await groups.RemoveMemberAsync(currentUserId, groupId, userId, cancellationToken));
    }

    [HttpGet("{groupId:guid}/rounds")]
    [EndpointSummary("The group's rounds of plans")]
    [EndpointDescription(
        "Every round generated for the group (the newest 20 are kept), newest first, each with its plans in the " +
        "order they were generated. 404 when the group doesn't exist or you are not a member.")]
    [ProducesResponseType<GroupPlanRoundsResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<GroupPlanRoundsResponse>> ListRounds(Guid groupId, CancellationToken cancellationToken)
    {
        if (CurrentUserId() is not { } userId) return Unauthorized();
        return await groups.ListPlanRoundsAsync(userId, groupId, cancellationToken) is { } rounds
            ? Ok(new GroupPlanRoundsResponse(rounds))
            : GroupNotFound();
    }

    [HttpPost("{groupId:guid}/plans/generate")]
    [AiGeneration]
    [EndpointSummary("Generate plans for the group")]
    [EndpointDescription(
        "Like /api/plans/generate, but the group size is the number of members (the request's groupSize is " +
        "ignored) and the plans are saved to the group. 404 when you are not a member; 400, 422 and 502 as for " +
        "/api/plans/generate, and nothing is saved then.")]
    [ProducesResponseType<GroupPlanRoundDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<CandidateAvailabilityProblem>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status502BadGateway, "application/problem+json")]
    public async Task<ActionResult<GroupPlanRoundDto>> GeneratePlans(
        Guid groupId, GeneratePlansRequest request, CancellationToken cancellationToken)
    {
        if (CurrentUserId() is not { } userId) return Unauthorized();
        if (await groups.MemberCountAsync(userId, groupId, cancellationToken) is not { } groupSize)
            return GroupNotFound();

        var result = await generator.GenerateAsync(request.Preferences with { GroupSize = groupSize }, cancellationToken);
        if (result is not PlanGenerationResult.Generated generated) return PlanGenerationResponses.Failure(this, result);

        return await groups.AddPlanRoundAsync(userId, groupId, groupSize, generated.Plans, cancellationToken) is { } round
            ? Ok(round)
            : GroupNotFound(); // left the group while the plans were being generated
    }

    private IActionResult ToResponse(GroupActionResult result) => result switch
    {
        GroupActionResult.Done => NoContent(),
        GroupActionResult.NotAFriend =>
            Problem(statusCode: StatusCodes.Status403Forbidden, title: "You can only add your friends to a group."),
        GroupActionResult.NotTheOwner =>
            Problem(statusCode: StatusCodes.Status403Forbidden, title: "Only the group's owner can remove members."),
        GroupActionResult.GroupFull => Problem(
            statusCode: StatusCodes.Status409Conflict,
            title: $"A group can have up to {GroupLimits.MaxMembers} members."),
        _ => GroupNotFound(),
    };

    private ObjectResult GroupNotFound() => Problem(statusCode: StatusCodes.Status404NotFound, title: "Group not found.");

    private Guid? CurrentUserId() =>
        Guid.TryParse(User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out var id) ? id : null;
}
