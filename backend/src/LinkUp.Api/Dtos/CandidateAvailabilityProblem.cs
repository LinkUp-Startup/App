using Microsoft.AspNetCore.Mvc;

namespace LinkUp.Api.Dtos;

public sealed class CandidateAvailabilityProblem : ProblemDetails
{
    public required string Code { get; init; }
    public int CandidateCount { get; init; }
    public int MinimumRequired { get; init; }
    public required string Suggestion { get; init; }
}
