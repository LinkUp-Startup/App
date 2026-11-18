using System.Globalization;
using LinkUp.Api.Data;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using LinkUp.Api.Geo;
using LinkUp.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace LinkUp.Api.Planning;

/// <summary>A swap request that can't be answered, with the request field it is about.</summary>
public sealed class InvalidSwapException(string field, string message) : Exception(message)
{
    public string Field { get; } = field;
}

public interface IPlanSwapService
{
    /// <summary>
    /// Other venues for one stop of a plan, each returned as the whole plan with that stop replaced and its costs
    /// and distances worked out again. Throws <see cref="InvalidSwapException"/> for a plan that can't be read.
    /// </summary>
    Task<IReadOnlyList<PlanDto>> GetOptionsAsync(SwapOptionsRequest request, CancellationToken cancellationToken);
}

/// <summary>
/// Swap a stop (#229) without the AI: alternatives come from the venue database and follow the same rules as
/// generated plans. Same activity, open for the stop's time (trimmed to the opening hours like
/// <see cref="PlanValidator"/>), fully priced, within the budget, and not much further away than the original.
/// Venues, prices and distances are read from the database; only the plan's shape comes from the app.
/// </summary>
public sealed class PlanSwapService(AppDbContext db, IPlanCostService costs) : IPlanSwapService
{
    public const int MaxOptions = 5;
    /// <summary>How much longer the way to and from the new stop may be than to and from the old one.</summary>
    public const double MaxExtraKm = 2;

    public async Task<IReadOnlyList<PlanDto>> GetOptionsAsync(
        SwapOptionsRequest request, CancellationToken cancellationToken)
    {
        var plan = request.Plan;
        if (plan.Items is not { Count: > 0 and <= PlanValidator.MaxStops })
            throw new InvalidSwapException(nameof(request.Plan), $"A plan has 1 to {PlanValidator.MaxStops} stops.");
        if (request.StopIndex >= plan.Items.Count)
            throw new InvalidSwapException(nameof(request.StopIndex), $"This plan has no stop {request.StopIndex + 1}.");

        var ids = plan.Items.Select(item => ParseVenueId(item.Venue.Id)).ToList();
        var known = await db.Venues.AsNoTracking()
            .Include(v => v.OpeningHours)
            .Where(v => ids.Contains(v.Id))
            .ToDictionaryAsync(v => v.Id, cancellationToken);
        if (ids.Any(id => !known.ContainsKey(id)))
            throw new InvalidSwapException(nameof(request.Plan), "A place in this plan no longer exists.");

        var index = request.StopIndex;
        var stop = plan.Items[index];
        if (stop.EndTime <= stop.StartTime)
            throw new InvalidSwapException(nameof(request.Plan), "The stop ends before it starts.");

        var categories = VenueFilteringService.CategoriesFor(stop.Venue.Category);
        var candidates = await db.Venues.AsNoTracking()
            .Include(v => v.OpeningHours)
            .Where(v => v.IsActive && categories.Contains(v.Category) && !ids.Contains(v.Id))
            .OpenDuring(stop.StartTime, stop.EndTime)
            .OrderBy(v => v.Id)
            .ToListAsync(cancellationToken);

        (double Latitude, double Longitude)? previous = index > 0
            ? Point(known[ids[index - 1]])
            : request.StartLocation is { } start ? (start.Latitude, start.Longitude) : null;
        (double Latitude, double Longitude)? next = index < ids.Count - 1 ? Point(known[ids[index + 1]]) : null;
        double Legs(Venue venue) =>
            (previous is { } from ? Km(from, Point(venue)) : 0) + (next is { } to ? Km(Point(venue), to) : 0);
        var maxLegs = Legs(known[ids[index]]) + MaxExtraKm;

        var others = ids.Where((_, i) => i != index).Select(id => CostPerPerson(known[id])).ToList();
        decimal? othersCost = others.All(cost => cost is not null) ? others.Sum() : null;
        var originalCost = CostPerPerson(known[ids[index]]);
        bool FitsBudget(decimal cost) => request.BudgetPerPerson is { } budget && othersCost is { } rest
            ? rest + cost <= budget
            : originalCost is not { } old || cost <= old;

        var groupSize = request.GroupSize ?? GroupSizeOf(plan);
        return candidates
            .Select(venue => (Venue: venue, Cost: CostPerPerson(venue), Legs: Legs(venue),
                Slot: PlanValidator.FitToOpeningHours(venue, stop.StartTime, stop.EndTime)))
            .Where(c => c.Cost is { } cost && FitsBudget(cost) && c.Slot is not null && c.Legs <= maxLegs)
            .OrderBy(c => c.Legs).ThenBy(c => c.Venue.Id)
            .Take(MaxOptions)
            .Select(c => WithStop(request, known, ids, c.Venue, c.Slot!.Value, groupSize))
            .ToList();
    }

    private PlanDto WithStop(
        SwapOptionsRequest request, Dictionary<int, Venue> known, List<int> ids, Venue replacement,
        (DateTimeOffset Start, DateTimeOffset End) slot, int groupSize)
    {
        var plan = request.Plan;
        var index = request.StopIndex;
        var venues = ids.Select((id, i) => i == index ? replacement : known[id]).ToList();
        var estimate = costs.Estimate(new Plan
        {
            Title = "", Summary = "",
            Items = venues.Select((venue, position) => new PlanItem
            {
                VenueId = venue.Id, Venue = venue, Position = position,
            }).ToList(),
        }, groupSize);

        var items = new List<PlanItemDto>();
        for (var i = 0; i < venues.Count; i++)
        {
            var original = plan.Items[i];
            var venue = venues[i];
            // Legs between stops come from the database; the first leg only when the start point is known,
            // otherwise an unchanged first stop keeps the distance it had.
            double distance = i > 0
                ? Km(Point(venues[i - 1]), Point(venue))
                : request.StartLocation is { } start ? Km((start.Latitude, start.Longitude), Point(venue))
                : i == index ? 0 : Math.Max(0, original.DistanceKm);
            items.Add(new PlanItemDto(
                new VenueDto(venue.Id.ToString(CultureInfo.InvariantCulture), venue.Name, original.Venue.Category,
                    venue.Address, venue.Latitude, venue.Longitude, venue.PriceLevel),
                i == index ? slot.Start : original.StartTime,
                i == index ? slot.End : original.EndTime,
                estimate.ItemCostsPerPerson[i],
                Math.Round(distance, 2)));
        }

        // The AI's title and summary often name the old place.
        var oldName = known[ids[index]].Name;
        string Rename(string text) => text.Replace(oldName, replacement.Name, StringComparison.Ordinal);
        return new PlanDto(
            plan.Id, Rename(plan.Title), Rename(plan.Summary), items,
            estimate.EstimatedCostPerPerson, estimate.TotalEstimatedCost,
            Math.Round(items.Sum(item => item.DistanceKm), 2));
    }

    private decimal? CostPerPerson(Venue venue) =>
        costs.Estimate(new Plan
        {
            Title = "", Summary = "", Items = [new PlanItem { VenueId = venue.Id, Venue = venue }],
        }, 1).EstimatedCostPerPerson;

    /// <summary>The group size the plan was priced for; 1 when the plan doesn't say.</summary>
    public static int GroupSizeOf(PlanDto plan) =>
        plan is { EstimatedCostPerPerson: > 0, EstimatedTotalCost: { } total }
            ? Math.Clamp((int)Math.Round(total / plan.EstimatedCostPerPerson.Value), PreferenceRules.MinGroupSize,
                PreferenceRules.MaxGroupSize)
            : 1;

    private static int ParseVenueId(string id) =>
        int.TryParse(id, NumberStyles.None, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : throw new InvalidSwapException(nameof(SwapOptionsRequest.Plan), "A place in this plan is unknown.");

    private static (double Latitude, double Longitude) Point(Venue venue) => (venue.Latitude, venue.Longitude);

    private static double Km((double Latitude, double Longitude) from, (double Latitude, double Longitude) to) =>
        GeoDistance.HaversineKm(from.Latitude, from.Longitude, to.Latitude, to.Longitude);
}
