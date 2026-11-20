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
    IReadOnlyList<PlanVotesDto> Plans);
