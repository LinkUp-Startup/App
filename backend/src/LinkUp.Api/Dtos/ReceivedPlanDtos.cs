namespace LinkUp.Api.Dtos;

public static class ReceivedPlanLimits
{
    // The oldest received plans are dropped beyond this, so a user's list can't grow without bound.
    public const int MaxReceivedPlans = 100;
}

/// <summary>The friend who sent a plan. Null in a received plan when that account no longer exists.</summary>
public sealed record PlanSenderDto(Guid UserId, string DisplayName);

/// <summary>
/// A plan a friend sent you: your own copy, who sent it and when. Save it to keep it in your saved plans.
/// </summary>
public sealed record ReceivedPlanDto(Guid Id, PlanDto Plan, PlanSenderDto? From, DateTimeOffset SentAt);

/// <summary>The plans friends sent you, newest first.</summary>
public sealed record ReceivedPlansResponse(IReadOnlyList<ReceivedPlanDto> Plans);
