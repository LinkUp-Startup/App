using System.ComponentModel.DataAnnotations;
using LinkUp.Api.Data.Entities;

namespace LinkUp.Api.Dtos;

public static class GroupLimits
{
    public const int NameMaxLength = GroupConfiguration.NameMaxLength;
    // The members will be a plan's group size, so a group can't be larger than a plan allows.
    public const int MaxMembers = PreferenceRules.MaxGroupSize;
    public const int MaxGroupsPerUser = 50;
    // Older rounds of plans are deleted when a new one is generated.
    public const int MaxPlanRoundsPerGroup = 20;
}

/// <summary>A new group. The creator becomes its owner; the members must be the creator's friends.</summary>
public sealed record CreateGroupRequest(
    [Required(AllowEmptyStrings = false)] [MaxLength(GroupLimits.NameMaxLength)] string Name,
    // Friends to add straight away. Optional: more can be added later.
    [MaxLength(GroupLimits.MaxMembers - 1)] IReadOnlyList<Guid>? MemberIds = null);

public sealed record GroupMemberDto(Guid UserId, string DisplayName, GroupRole Role, DateTimeOffset JoinedAt);

/// <summary>A group with its members: the owner first, then by when they joined.</summary>
public sealed record GroupDto(
    Guid Id, string Name, DateTimeOffset CreatedAt, GroupRole MyRole, IReadOnlyList<GroupMemberDto> Members);

/// <summary>A group in the list of the user's groups.</summary>
public sealed record GroupSummaryDto(Guid Id, string Name, int MemberCount, GroupRole MyRole, DateTimeOffset CreatedAt);

/// <summary>The user's groups, newest first.</summary>
public sealed record GroupsResponse(IReadOnlyList<GroupSummaryDto> Groups);

/// <summary>Who generated a round of group plans. Null in a round when that account no longer exists.</summary>
public sealed record GroupPlanAuthorDto(Guid UserId, string DisplayName);

/// <summary>The plans generated together for the group in one go, saved to the group.</summary>
public sealed record GroupPlanRoundDto(
    Guid Id, DateTimeOffset CreatedAt, GroupPlanAuthorDto? CreatedBy, int GroupSize, IReadOnlyList<PlanDto> Plans);

/// <summary>The group's rounds of plans, newest first.</summary>
public sealed record GroupPlanRoundsResponse(IReadOnlyList<GroupPlanRoundDto> Rounds);
