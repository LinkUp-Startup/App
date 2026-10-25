using System.ComponentModel.DataAnnotations;

namespace LinkUp.Api.Options;

public sealed class PlanGenerationOptions
{
    public const string SectionName = "PlanGeneration";

    // The current stub produces a valid single-stop plan. No higher minimum is specified.
    [Range(1, int.MaxValue)]
    public int MinimumCandidateCount { get; init; } = 1;
}
