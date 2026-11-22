using LinkUp.Api.Dtos;

namespace LinkUp.Api.Services;

/// <summary>Sending saved plans to friends, and the plans friends sent you (#207).</summary>
public interface IReceivedPlanService
{
    /// <summary>
    /// Sends a copy of one of the user's saved plans to a friend. Sending the same plan to the same friend again
    /// replaces the copy they had.
    /// </summary>
    Task<SendPlanResult> SendAsync(Guid userId, Guid planId, Guid friendId, CancellationToken cancellationToken);

    /// <summary>The plans friends sent the user, newest first.</summary>
    Task<IReadOnlyList<ReceivedPlanDto>> ListAsync(Guid userId, CancellationToken cancellationToken);

    /// <summary>Removes a received plan. Does nothing when it isn't there or isn't the user's.</summary>
    Task DeleteAsync(Guid userId, Guid receivedPlanId, CancellationToken cancellationToken);
}

public enum SendPlanResult
{
    Sent,
    // The user hasn't saved this plan to their account
    PlanNotFound,
    // Plans can only be sent to friends (never to yourself)
    NotAFriend,
}
