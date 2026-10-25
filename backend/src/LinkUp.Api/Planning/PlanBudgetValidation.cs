using System.Globalization;
using LinkUp.Api.Ai;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using LinkUp.Api.Services;

namespace LinkUp.Api.Planning;

internal static class PlanBudgetValidation
{
    internal static void ValidatePreferences(NightPreferencesDto preferences)
    {
        ArgumentNullException.ThrowIfNull(preferences);
        ArgumentOutOfRangeException.ThrowIfNegative(preferences.BudgetPerPerson);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(preferences.GroupSize);
    }

    internal static bool TryEstimate(
        IEnumerable<Venue> venues, NightPreferencesDto preferences, IPlanCostService costs,
        out PlanCostEstimate estimate, out string? problem)
    {
        // Use already materialized candidate entities; never trust AI or cached DTO cost fields.
        var plan = new Plan
        {
            Title = "", Summary = "",
            Items = venues.Select((venue, position) => new PlanItem
            {
                VenueId = venue.Id, Venue = venue, Position = position,
            }).ToList(),
        };
        estimate = costs.Estimate(plan, preferences.GroupSize);
        if (!estimate.IsComplete)
        {
            problem = $"cost is incomplete ({estimate.UnpricedItemCount} unpriced item(s))";
            return false;
        }

        // The request budget is per person, just like venue filtering (#49).
        var available = preferences.BudgetPerPerson * preferences.GroupSize;
        if (estimate.TotalEstimatedCost > available)
        {
            problem = string.Create(CultureInfo.InvariantCulture,
                $"estimated total EUR {estimate.TotalEstimatedCost:0.00} exceeds group budget EUR {available:0.00}");
            return false;
        }

        problem = null;
        return true;
    }
}

/// <summary>No fully priced, budget-compliant result was available after bounded generation.</summary>
public sealed class PlanBudgetException(string message) : AiException(message);
