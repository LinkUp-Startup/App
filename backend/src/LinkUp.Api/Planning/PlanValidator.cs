using System.Globalization;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using LinkUp.Api.Geo;
using LinkUp.Api.Services;

namespace LinkUp.Api.Planning;

/// <summary>
/// Checks the AI's plans against the candidate venues and the group's window (issue #67). Invalid stops are
/// dropped rather than failing the whole response, so no invented or closed venue reaches the app.
/// Prices (<see cref="IPlanCostService"/>) and distances come from the database, never from the AI.
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
    public sealed record Result(IReadOnlyList<PlanDto> Plans, IReadOnlyList<string> Problems, bool HasCostFailures);

    public static Result Validate(
        IReadOnlyList<AiPlan> aiPlans, IReadOnlyList<Venue> candidates, NightPreferencesDto preferences,
        IPlanCostService costs)
    {
        PlanBudgetValidation.ValidatePreferences(preferences);
        var venues = candidates.ToDictionary(v => v.Id);
        var problems = new List<string>();
        var plans = new List<PlanDto>();
        var seen = new HashSet<string>();
        var hasCostFailures = false;

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

            if (!PlanBudgetValidation.TryEstimate(stops.Select(s => s.Venue), preferences, costs,
                out var estimate, out var costProblem))
            {
                problems.Add($"{label}: dropped, {costProblem}");
                hasCostFailures = true;
                continue;
            }

            plans.Add(ToPlan(aiPlans[p], stops, preferences, estimate));
        }

        return new Result(plans, problems, hasCostFailures);
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

            // A stop must lie inside the venue's opening hours, not just overlap them: trim it to the opening
            // slot it overlaps most, and drop it when too little of it is left.
            if (FitToOpeningHours(venue, start, end) is not { } open)
            {
                problems.Add($"{where}: venue {venue.Id} is closed for (most of) that time");
                continue;
            }
            if (open.Start != start || open.End != end)
                problems.Add($"{where}: trimmed to venue {venue.Id}'s opening hours");

            parsed.Add(new Stop(venue, open.Start, open.End));
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

    /// <summary>Shorter than this after trimming to the opening hours, a stop isn't worth going to.</summary>
    public static readonly TimeSpan MinStopDuration = TimeSpan.FromMinutes(30);

    /// <summary>
    /// The part of the stop that falls inside one opening slot of the venue, using the slot it overlaps most;
    /// null when that part is shorter than <see cref="MinStopDuration"/>. Opening hours are wall-clock times in
    /// Madrid; a slot whose closing time isn't after its opening time ends on the next day.
    /// </summary>
    internal static (DateTimeOffset Start, DateTimeOffset End)? FitToOpeningHours(
        Venue venue, DateTimeOffset start, DateTimeOffset end)
    {
        var zone = VenueQueries.VenueTimeZone;
        var localStart = TimeZoneInfo.ConvertTime(start, zone).DateTime;
        var localEnd = TimeZoneInfo.ConvertTime(end, zone).DateTime;

        (DateTime Start, DateTime End)? best = null;
        // Yesterday's overnight slots can still be open at the start.
        for (var date = localStart.Date.AddDays(-1); date <= localEnd.Date; date = date.AddDays(1))
        {
            foreach (var slot in venue.OpeningHours.Where(h => h.Day == date.DayOfWeek))
            {
                var opens = date + slot.Opens.ToTimeSpan();
                var closes = (slot.Closes > slot.Opens ? date : date.AddDays(1)) + slot.Closes.ToTimeSpan();
                var from = opens > localStart ? opens : localStart;
                var to = closes < localEnd ? closes : localEnd;
                var bestLength = best is { } current ? current.End - current.Start : TimeSpan.Zero;
                if (to - from > bestLength)
                    best = (from, to);
            }
        }

        if (best is not { } fit || fit.End - fit.Start < MinStopDuration) return null;
        // Keep the original instants where nothing was trimmed, so their offset doesn't change.
        return (fit.Start == localStart ? start : InZone(fit.Start), fit.End == localEnd ? end : InZone(fit.End));

        DateTimeOffset InZone(DateTime local) => new(local, zone.GetUtcOffset(local));
    }

    private static PlanDto ToPlan(
        AiPlan plan, List<Stop> stops, NightPreferencesDto preferences, PlanCostEstimate estimate)
    {
        var items = new List<PlanItemDto>();
        // The first leg starts at the group's start point (#55); without one the first stop has no leg.
        var from = preferences.StartLocation is { } start ? (start.Latitude, start.Longitude) : ((double, double)?)null;
        foreach (var stop in stops)
        {
            var distance = from is var (latitude, longitude)
                ? GeoDistance.HaversineKm(latitude, longitude, stop.Venue.Latitude, stop.Venue.Longitude)
                : 0;
            items.Add(new PlanItemDto(
                ToVenueDto(stop.Venue, preferences), stop.Start, stop.End,
                estimate.ItemCostsPerPerson[items.Count]!.Value, Math.Round(distance, 2)));
            from = (stop.Venue.Latitude, stop.Venue.Longitude);
        }

        return new PlanDto(
            Guid.NewGuid().ToString(),
            Truncate(plan.Title, TitleMaxLength, "Night out"),
            Truncate(plan.Summary, SummaryMaxLength, ""),
            items,
            estimate.EstimatedCostPerPerson,
            estimate.TotalEstimatedCost,
            Math.Round(items.Sum(i => i.DistanceKm), 2));
    }

    /// <summary>The venue with the selected activity it serves in this plan.</summary>
    internal static VenueDto ToVenueDto(Venue venue, NightPreferencesDto preferences)
    {
        var activity = preferences.Activities
            .Where(a => VenueFilteringService.CategoriesFor(a).Contains(venue.Category))
            .Select(a => (Activity?)a)
            .FirstOrDefault() ?? (preferences.Activities is [var first, ..] ? first : default);
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
