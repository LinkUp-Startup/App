using LinkUp.Api.Ai;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using LinkUp.Api.Options;
using LinkUp.Api.Services;
using Microsoft.Extensions.Options;

namespace LinkUp.Api.Planning;

/// <summary>Plans combined by the AI from the filtered candidates, then checked against them.</summary>
public sealed class AiPlanService(
    IAiClient ai, IOptions<AiOptions> options, IOptions<PlanGenerationOptions> planOptions, ILogger<AiPlanService> logger)
    : IPlanService
{
    /// <summary>Unusable output (bad JSON, or no valid plan) gets one more try before giving up.</summary>
    public const int MaxAttempts = 2;

    public async Task<IReadOnlyList<PlanDto>> GeneratePlansAsync(
        NightPreferencesDto preferences, IReadOnlyList<Venue> filtered, CancellationToken cancellationToken)
    {
        // The AI only sees, and may only use, this selection.
        var candidates = CandidateSelector.Select(
            filtered, preferences.Activities, planOptions.Value.MaxAiCandidates, Random.Shared);
        var request = new AiJsonRequest(
            PlanPrompt.Instructions, PlanPrompt.BuildInput(preferences, candidates), PlanSchema.Name, PlanSchema.Schema);

        // One deadline for every attempt together, so a retry never pushes past the app's timeout.
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(TimeSpan.FromSeconds(options.Value.TotalTimeoutSeconds));

        for (var attempt = 1; attempt <= MaxAttempts; attempt++)
        {
            AiJsonResponse response;
            try
            {
                response = await ai.CompleteJsonAsync(request, deadline.Token);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                logger.LogWarning("Plan generation ({PromptVersion}) timed out after {Seconds} s in attempt {Attempt}/{MaxAttempts}",
                    PlanPrompt.Version, options.Value.TotalTimeoutSeconds, attempt, MaxAttempts);
                throw new PlanGenerationException("Plan generation timed out.");
            }

            if (!PlanSchema.TryParse(response.Json, out var aiPlans, out var error))
            {
                logger.LogWarning("Plan generation ({PromptVersion}) attempt {Attempt}/{MaxAttempts}: {Error}",
                    PlanPrompt.Version, attempt, MaxAttempts, error);
                continue;
            }

            var result = PlanValidator.Validate(aiPlans, candidates, preferences);
            logger.LogInformation(
                "Plan generation ({PromptVersion}) attempt {Attempt}/{MaxAttempts}: {Sent} of {Filtered} candidates sent, {Returned} plans from the AI, {Kept} kept",
                PlanPrompt.Version, attempt, MaxAttempts, candidates.Count, filtered.Count, aiPlans.Count, result.Plans.Count);
            if (result.Problems.Count > 0)
                logger.LogWarning("Plan generation ({PromptVersion}) repaired the AI output: {Problems}",
                    PlanPrompt.Version, string.Join("; ", result.Problems));

            if (result.Plans.Count > 0)
                return result.Plans;
        }

        throw new PlanGenerationException($"The AI returned no usable plan in {MaxAttempts} attempts.");
    }
}

public sealed class PlanGenerationException(string message) : AiException(message);
