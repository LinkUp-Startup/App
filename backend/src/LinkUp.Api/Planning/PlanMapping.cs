using System.Globalization;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;

namespace LinkUp.Api.Planning;

/// <summary>Turns plans into stored rows and back, for saved plans and group plans.</summary>
public static class PlanMapping
{
    /// <summary>
    /// A stored plan as the API sends it: the stops in order, and the id the app knows the plan by (the generated
    /// one, or the stored one for a plan that has none). venueOf finds the venue of a stop.
    /// </summary>
    public static PlanDto ToDto(Plan plan, Func<PlanItem, Venue> venueOf) => new(
        (plan.SourcePlanId ?? plan.Id).ToString(),
        plan.Title,
        plan.Summary,
        plan.Items.OrderBy(i => i.Position).Select(i => ToDto(i, venueOf(i))).ToList(),
        plan.EstimatedCostPerPerson,
        plan.EstimatedTotalCost,
        plan.TotalDistanceKm);

    /// <summary>A stored plan whose stops were loaded together with their venues.</summary>
    public static PlanDto ToDto(Plan plan) => ToDto(plan, item => item.Venue);

    private static PlanItemDto ToDto(PlanItem item, Venue venue) => new(
        new VenueDto(
            venue.Id.ToString(CultureInfo.InvariantCulture), venue.Name, item.Activity, venue.Address,
            venue.Latitude, venue.Longitude, venue.PriceLevel),
        item.StartTime, item.EndTime, item.EstimatedCostPerPerson, item.DistanceKm);

    // -1 never matches a venue, so a malformed id is reported as an unknown venue.
    public static int VenueId(string id) =>
        int.TryParse(id, NumberStyles.None, CultureInfo.InvariantCulture, out var venueId) ? venueId : -1;

    /// <summary>The plan's stops as rows, in order. The venue itself is referenced by id only.</summary>
    public static List<PlanItem> ToItems(PlanDto plan) => plan.Items.Select((item, position) => new PlanItem
    {
        Position = position,
        VenueId = VenueId(item.Venue.Id),
        Activity = item.Venue.Category,
        StartTime = item.StartTime,
        EndTime = item.EndTime,
        EstimatedCostPerPerson = item.EstimatedCostPerPerson,
        DistanceKm = item.DistanceKm,
    }).ToList();
}
