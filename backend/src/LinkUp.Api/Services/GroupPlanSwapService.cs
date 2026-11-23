using LinkUp.Api.Data;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using LinkUp.Api.Planning;
using Microsoft.EntityFrameworkCore;

namespace LinkUp.Api.Services;

/// <summary>
/// Swap a stop in one of a group round's plans while the vote is open: any member can, and everyone sees the
/// changed plan. Only a venue that <see cref="IPlanSwapService"/> offers for that stop is accepted, so a group plan
/// follows the same rules as a generated one. Votes for the plan stay: members can still move theirs.
/// </summary>
public interface IGroupPlanSwapService
{
    /// <summary>Throws <see cref="InvalidSwapException"/> for a stop the plan doesn't have.</summary>
    Task<SwapStopResult> SwapStopAsync(
        Guid userId, Guid groupId, Guid roundId, Guid planId, int stopIndex, int venueId,
        CancellationToken cancellationToken);
}

public abstract record SwapStopResult
{
    public sealed record Swapped(PlanDto Plan) : SwapStopResult;

    /// <summary>No such round in this group, or the user is not a member.</summary>
    public sealed record RoundNotFound : SwapStopResult;

    /// <summary>The plan is not one of the round's plans.</summary>
    public sealed record PlanNotFound : SwapStopResult;

    public sealed record AlreadyClosed : SwapStopResult;

    /// <summary>The venue is not one of the options for that stop (any more).</summary>
    public sealed record NotAnOption : SwapStopResult;
}

public sealed class GroupPlanSwapService(AppDbContext db, IPlanSwapService swaps) : IGroupPlanSwapService
{
    public async Task<SwapStopResult> SwapStopAsync(
        Guid userId, Guid groupId, Guid roundId, Guid planId, int stopIndex, int venueId,
        CancellationToken cancellationToken)
    {
        var round = await db.GroupPlanRounds.AsNoTracking().SingleOrDefaultAsync(
            r => r.Id == roundId
                && r.GroupId == groupId
                && db.GroupMembers.Any(m => m.GroupId == groupId && m.UserId == userId),
            cancellationToken);
        if (round is null) return new SwapStopResult.RoundNotFound();
        if (round.ClosedAt is not null) return new SwapStopResult.AlreadyClosed();

        // The id the app knows a plan by: the generated one, or the stored one for a plan that has none.
        var plan = await db.Plans
            .Include(p => p.Items).ThenInclude(i => i.Venue)
            .SingleOrDefaultAsync(
                p => p.GroupPlanRoundId == roundId && (p.SourcePlanId ?? p.Id) == planId, cancellationToken);
        if (plan is null) return new SwapStopResult.PlanNotFound();

        // The round doesn't keep the budget or the start point, so an option costs at most what the stop costs and
        // the first leg keeps its distance.
        var options = await swaps.GetOptionsAsync(
            new SwapOptionsRequest(PlanMapping.ToDto(plan, item => item.Venue), stopIndex, GroupSize: round.GroupSize),
            cancellationToken);
        var chosen = options.FirstOrDefault(option => PlanMapping.VenueId(option.Items[stopIndex].Venue.Id) == venueId);
        if (chosen is null) return new SwapStopResult.NotAnOption();

        var replacement = await db.Venues.SingleAsync(v => v.Id == venueId, cancellationToken);
        Apply(plan, chosen, stopIndex, replacement);
        await db.SaveChangesAsync(cancellationToken);
        return new SwapStopResult.Swapped(chosen);
    }

    // Updates the stored stops in place, so each keeps its row and position.
    private static void Apply(Plan plan, PlanDto chosen, int stopIndex, Venue replacement)
    {
        plan.Title = chosen.Title;
        plan.Summary = chosen.Summary;
        plan.EstimatedCostPerPerson = chosen.EstimatedCostPerPerson;
        plan.EstimatedTotalCost = chosen.EstimatedTotalCost;
        plan.TotalDistanceKm = chosen.TotalDistanceKm;

        var items = plan.Items.OrderBy(i => i.Position).ToList();
        for (var i = 0; i < items.Count; i++)
        {
            var item = items[i];
            var next = chosen.Items[i];
            if (i == stopIndex)
            {
                item.VenueId = replacement.Id;
                item.Venue = replacement;
            }
            item.StartTime = next.StartTime;
            item.EndTime = next.EndTime;
            item.EstimatedCostPerPerson = next.EstimatedCostPerPerson;
            item.DistanceKm = next.DistanceKm;
        }
    }
}
