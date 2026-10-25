using System.ComponentModel.DataAnnotations;

namespace LinkUp.Api.Options;

public sealed class PlanGenerationOptions
{
    public const string SectionName = "PlanGeneration";

    // Two distinct plans (#71) need at least two venues; with fewer the request gets a clear 422 instead of
    // an AI call that can't succeed.
    [Range(1, int.MaxValue)]
    public int MinimumCandidateCount { get; init; } = 2;

    /// <summary>
    /// Most candidates sent to the AI, spread over the selected activities. Every venue costs prompt tokens
    /// (about 160 each), so a broad request is narrowed before it reaches the AI.
    /// </summary>
    [Range(2, 100)]
    public int MaxAiCandidates { get; init; } = 20;
}
