using LinkUp.Api.Ai;
using LinkUp.Api.Dtos;
using LinkUp.Api.Options;
using LinkUp.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace LinkUp.Api.Planning;

/// <summary>
/// Turns preferences into plans: filters the venue database, lets the plan service combine the remaining venues,
/// and reports the expected failures as results. Used for solo plans and group plans alike.
/// </summary>
public sealed class PlanGenerator(
    IPlanService planService, IVenueFilteringService venueFilteringService, IPlanCostService costs,
    IOptions<PlanGenerationOptions> options)
{
    public async Task<PlanGenerationResult> GenerateAsync(
        NightPreferencesDto preferences, CancellationToken cancellationToken)
    {
        var filtered = preferences.StartLocation is { } start
            ? await venueFilteringService.FilterAsync(preferences, start.Latitude, start.Longitude, cancellationToken)
            : await venueFilteringService.FilterAsync(preferences, cancellationToken);
        // A plan with an unpriced venue can't be checked against the budget (#50) and is always rejected, so
        // unpriced venues never reach the AI: no tokens spent on plans that can't be returned, and a request that
        // only matches unpriced venues gets the clear 422 instead of a 502 after the AI.
        var candidates = filtered.Where(venue => PlanBudgetValidation.IsPriced(venue, costs)).ToList();
        var minimum = options.Value.MinimumCandidateCount;
        if (candidates.Count < minimum)
            return new PlanGenerationResult.TooFewCandidates(CandidateProblem(preferences, candidates.Count, minimum));

        try
        {
            return new PlanGenerationResult.Generated(
                await planService.GeneratePlansAsync(preferences, candidates, cancellationToken));
        }
        catch (PlanBudgetException ex)
        {
            return new PlanGenerationResult.OverBudget(ex.Message);
        }
        catch (AiException)
        {
            // Already logged with the details by the AI client or the plan service.
            return new PlanGenerationResult.Unavailable();
        }
    }

    private static CandidateAvailabilityProblem CandidateProblem(NightPreferencesDto preferences, int count, int minimum)
    {
        var none = count == 0;
        return new CandidateAvailabilityProblem
        {
            Status = StatusCodes.Status422UnprocessableEntity,
            Code = none ? "no_candidates" : "insufficient_candidates",
            Title = none ? "No venues match your preferences." : "Not enough venues match your preferences.",
            Detail = none
                ? "No venues match the selected preferences. A plan cannot be generated."
                : $"Only {count} matching {(count == 1 ? "venue was" : "venues were")} found; at least {minimum} are needed to build a plan.",
            CandidateCount = count,
            MinimumRequired = minimum,
            Suggestion = preferences.StartLocation is null
                ? "Try different activities or a wider time window, and check that a transport option is selected."
                : "Try a larger distance, different activities or a wider time window, and check that a transport option is selected.",
        };
    }
}

public abstract record PlanGenerationResult
{
    public sealed record Generated(IReadOnlyList<PlanDto> Plans) : PlanGenerationResult;

    /// <summary>Too few venues match the preferences to build a plan (422).</summary>
    public sealed record TooFewCandidates(CandidateAvailabilityProblem Problem) : PlanGenerationResult;

    /// <summary>No plan fitted the budget (502).</summary>
    public sealed record OverBudget(string Message) : PlanGenerationResult;

    /// <summary>The AI is unavailable or returned no usable plan (502).</summary>
    public sealed record Unavailable : PlanGenerationResult;
}

/// <summary>The HTTP responses for the generation failures, shared by the solo and group endpoints.</summary>
public static class PlanGenerationResponses
{
    public static ActionResult Failure(ControllerBase controller, PlanGenerationResult result) => result switch
    {
        PlanGenerationResult.TooFewCandidates tooFew => controller.UnprocessableEntity(tooFew.Problem),
        PlanGenerationResult.OverBudget overBudget => controller.Problem(
            statusCode: StatusCodes.Status502BadGateway,
            title: "Couldn't generate plans within your budget.",
            detail: overBudget.Message),
        _ => controller.Problem(
            statusCode: StatusCodes.Status502BadGateway,
            title: "Couldn't generate plans right now.",
            detail: "The plan generator is unavailable or returned no usable plan. Try again in a moment."),
    };
}
