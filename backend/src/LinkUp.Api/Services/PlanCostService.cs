using LinkUp.Api.Data.Entities;

namespace LinkUp.Api.Services;

public sealed class PlanCostService : IPlanCostService
{
    public PlanCostEstimate Estimate(Plan plan, int groupSize)
    {
        ArgumentNullException.ThrowIfNull(plan);
        ArgumentNullException.ThrowIfNull(plan.Items);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(groupSize);

        decimal perPerson = 0m;
        var unpricedItems = 0;
        var itemCosts = new List<decimal?>();
        foreach (var item in plan.Items)
        {
            ArgumentNullException.ThrowIfNull(item);
            var venue = item.Venue;
            // Persisted prices already obey these constraints; also protect in-memory callers.
            if (venue is not null && (venue.EntranceFee is < 0 || venue.MinSpend is < 0
                || venue.MaxSpend is < 0 || venue.MinSpend > venue.MaxSpend))
                throw new ArgumentException("Venue prices must be nonnegative and spend ranges ordered.", nameof(plan));

            var spend = venue?.EstimatedSpendPerPerson;
            var admission = venue?.EntranceFee;
            if (spend is null || admission is null)
            {
                unpricedItems++;
                itemCosts.Add(null);
                continue;
            }

            var itemCost = spend.Value + admission.Value;
            perPerson += itemCost;
            itemCosts.Add(itemCost);
        }

        var complete = unpricedItems == 0;
        return new PlanCostEstimate(complete ? perPerson : null, complete ? perPerson * groupSize : null, unpricedItems)
        {
            ItemCostsPerPerson = itemCosts.AsReadOnly(),
        };
    }
}
