using LinkUp.Api.Dtos;

namespace LinkUp.Api.Services;

/// <summary>
/// Voting between the plans of a group's round (#172). Like the group itself, a round only exists for the group's
/// members: for everyone else, and for a round that belongs to another group, it is "not found".
/// </summary>
public interface IGroupVoteService
{
    /// <summary>Where the vote stands, or null when the round is not found.</summary>
    Task<GroupVoteResultsDto?> GetResultsAsync(Guid userId, Guid groupId, Guid roundId, CancellationToken cancellationToken);

    /// <summary>Casts the user's vote or, if they already voted, moves it to another plan. Not once the round is closed.</summary>
    Task<VoteResult> CastAsync(Guid userId, Guid groupId, Guid roundId, Guid planId, CancellationToken cancellationToken);

    /// <summary>Closes the vote: nobody can vote or change their vote any more. Only the group's owner can; closing again does nothing.</summary>
    Task<VoteResult> CloseAsync(Guid userId, Guid groupId, Guid roundId, CancellationToken cancellationToken);
}

public abstract record VoteResult
{
    public sealed record Done(GroupVoteResultsDto Results) : VoteResult;

    public sealed record RoundNotFound : VoteResult;

    /// <summary>The plan is not one of the round's plans.</summary>
    public sealed record PlanNotFound : VoteResult;

    public sealed record AlreadyClosed : VoteResult;

    public sealed record NotTheOwner : VoteResult;
}
