using System.Globalization;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using LinkUp.Api.Geo;
using LinkUp.Api.Services;

namespace LinkUp.Api.Planning;

/// <summary>
/// Checks the AI's plans against the candidate venues and the group's window (issue #67). Invalid stops are
/// dropped rather than failing the whole response, so no invented or closed venue reaches the app.
/// Prices (<see cref="PlanPricing"/>) and distances come from the database, never from the AI.
/// </summary>
public static class PlanValidator
{
    public const int MinPlans = 2;
    public const int MaxPlans = 3;
    public const int MaxStops = 4;
    public const int TitleMaxLength = 60;
    public const int SummaryMaxLength = 500;

    /// <param name="Plans">Usable plans, at most <see cref="MaxPlans"/>.</param>
    /// <param name="Problems">What was dropped and why, for the logs.</param>
    public sealed record Result(IReadOnlyList<PlanDto> Plans, IReadOnlyList<string> Problems);

    public static Result Validate(
        IReadOnlyList<AiPlan> aiPlans, IReadOnlyList<Venue> candidates, NightPreferencesDto preferences,
        IPlanCostService costs)
    {
        var venues = candidates.ToDictionary(v => v.Id);
        var problems = new List<string>();
        var plans = new List<PlanDto>();
        var seen = new HashSet<string>();

        for (var p = 0; p < aiPlans.Count; p++)
        {
            var label = $"plan {p + 1}";
            var stops = ValidStops(aiPlans[p].Stops ?? [], venues, preferences, label, problems);
            if (stops.Count == 0)
            {
                problems.Add($"{label}: dropped, no valid stops");
                continue;
            }

            // Two plans visiting the same venues, in any order, are one plan.
            if (!seen.Add(VenueKey(stops.Select(s => s.Venue.Id))))
            {
                problems.Add($"{label}: dropped, same venues as an earlier plan");
                continue;
            }

            if (plans.Count == MaxPlans)
            {
                problems.Add($"{label}: dropped, more than {MaxPlans} plans");
                continue;
            }

            plans.Add(ToPlan(aiPlans[p], stops, preferences, costs));
        }

        return new Result(plans, problems);
    }

    private sealed record Stop(Venue Venue, DateTimeOffset Start, DateTimeOffset End);

    private static List<Stop> ValidStops(
        IReadOnlyList<AiStop> aiStops, Dictionary<int, Venue> venues, NightPreferencesDto preferences,
        string label, List<string> problems)
    {
        var parsed = new List<Stop>();
        for (var s = 0; s < aiStops.Count; s++)
        {
            var stop = aiStops[s];
            var where = $"{label} stop {s + 1}";

            if (!venues.TryGetValue(stop.VenueId, out var venue))
            {
                problems.Add($"{where}: venue {stop.VenueId} is not a candidate");
                continue;
            }

            if (!TryParseTime(stop.StartTime, out var start) || !TryParseTime(stop.EndTime, out var end))
            {
                problems.Add($"{where}: unreadable time \"{stop.StartTime}\" - \"{stop.EndTime}\"");
                continue;
            }

            // Repair stops that spill over the window instead of dropping them.
            if (start < preferences.StartTime) start = preferences.StartTime;
            if (end > preferences.EndTime) end = preferences.EndTime;
            if (end <= start)
            {
                problems.Add($"{where}: outside the window or ends before it starts");
                continue;
            }

            if (!IsOpenDuring(venue, start, end))
            {
                problems.Add($"{where}: venue {venue.Id} is closed then");
                continue;
            }

            parsed.Add(new Stop(venue, start, end));
        }

        var valid = new List<Stop>();
        foreach (var stop in parsed.OrderBy(s => s.Start))
        {
            if (valid.Count == MaxStops)
                problems.Add($"{label}: venue {stop.Venue.Id} dropped, more than {MaxStops} stops");
            else if (valid.Any(v => v.Venue.Id == stop.Venue.Id))
                problems.Add($"{label}: venue {stop.Venue.Id} visited twice");
            else if (valid.Count > 0 && stop.Start < valid[^1].End)
                problems.Add($"{label}: venue {stop.Venue.Id} overlaps the previous stop");
            else
                valid.Add(stop);
        }

        return valid;
    }

    /// <summary>Identifies a plan by its set of venues, so a reordered copy counts as the same plan.</summary>
    public static string VenueKey(PlanDto plan) => VenueKey(plan.Items.Select(i => int.Parse(i.Venue.Id, CultureInfo.InvariantCulture)));

    private static string VenueKey(IEnumerable<int> venueIds) => string.Join(",", venueIds.Order());

    private static bool TryParseTime(string? text, out DateTimeOffset time) =>
        DateTimeOffset.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out time);

    // Same rule as filtering: the stop overlaps an opening slot.
    private static bool IsOpenDuring(Venue venue, DateTimeOffset start, DateTimeOffset end) =>
        new[] { venue }.AsQueryable().OpenDuring(start, end).Any();

    private static PlanDto ToPlan(
        AiPlan plan, List<Stop> stops, NightPreferencesDto preferences, IPlanCostService costs)
    {
        var prices = PlanPricing.Price(costs, stops.Select(s => s.Venue).ToList(), preferences.GroupSize);
        var items = new List<PlanItemDto>();
        Venue? previous = null;
        foreach (var (stop, i) in stops.Select((stop, i) => (stop, i)))
        {
            var distance = previous is null
                ? 0
                : GeoDistance.HaversineKm(previous.Latitude, previous.Longitude, stop.Venue.Latitude, stop.Venue.Longitude);
            items.Add(new PlanItemDto(
                ToVenueDto(stop.Venue, preferences), stop.Start, stop.End, prices.PerStop[i], Math.Round(distance, 2)));
            previous = stop.Venue;
        }

        return new PlanDto(
            Guid.NewGuid().ToString(),
            Truncate(plan.Title, TitleMaxLength, "Night out"),
            Truncate(plan.Summary, SummaryMaxLength, ""),
            items,
            prices.Plan.EstimatedCostPerPerson,
            prices.Plan.TotalEstimatedCost,
            Math.Round(items.Sum(i => i.DistanceKm), 2));
    }

    /// <summary>The venue with the selected activity it serves in this plan.</summary>
    internal static VenueDto ToVenueDto(Venue venue, NightPreferencesDto preferences)
    {
        var activity = preferences.Activities
            .Where(a => VenueFilteringService.CategoriesFor(a).Contains(venue.Category))
            .Select(a => (Activity?)a)
            .FirstOrDefault() ?? preferences.Activities.FirstOrDefault();
        return new VenueDto(
            venue.Id.ToString(CultureInfo.InvariantCulture), venue.Name, activity, venue.Address,
            venue.Latitude, venue.Longitude, venue.PriceLevel);
    }

    private static string Truncate(string? text, int maxLength, string fallback)
    {
        var trimmed = text?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return fallback;
        return trimmed.Length <= maxLength ? trimmed : trimmed[..(maxLength - 1)].TrimEnd() + "…";
    }
}
