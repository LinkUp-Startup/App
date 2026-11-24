using System.Text.Json.Serialization;

namespace LinkUp.Api.Dtos;

/// <summary>The plan to vote for.</summary>
public sealed record CastVoteRequest(
    // The plan's id as in the round's plans. Required so a request that leaves it out gets a 400.
    [property: JsonRequired] Guid PlanId);

/// <summary>The votes for one plan of the round.</summary>
public sealed record PlanVotesDto(Guid PlanId, int Votes);

/// <summary>Where the vote of a round stands. Only the votes of members still in the group count.</summary>
public sealed record GroupVoteResultsDto(
    Guid RoundId,
    // Null while members can still vote
    DateTimeOffset? ClosedAt,
    int MemberCount,
    int VotesCast,
    // The plan the caller voted for; null if they haven't voted
    Guid? MyVotePlanId,
    // Every plan of the round, in the order they were generated, also those without votes
    IReadOnlyList<PlanVotesDto> Plans,
    // The plans with the most votes, once the vote has an outcome: when the owner closed it or every member voted.
    // One plan is the winner; several are a tie. Empty before that, and when nobody voted. Until the owner closes
    // the vote, members can still change theirs, so this can still change.
    IReadOnlyList<Guid> WinnerPlanIds);

/// <summary>The venue to put in place of a stop: one of the swap options for that stop.</summary>
public sealed record SwapGroupStopRequest(
    // The venue's id as in the swap options. Required so a request that leaves it out gets a 400.
    [property: JsonRequired] int VenueId);
