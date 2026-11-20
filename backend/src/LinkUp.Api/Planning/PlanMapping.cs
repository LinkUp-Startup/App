using System.Globalization;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;

namespace LinkUp.Api.Planning;

/// <summary>Converts between stored plans and the plans the API sends, for saved plans and group plans.</summary>
public static class PlanMapping
{
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

    /// <summary>The plan as the app knows it: its id is the generated plan's id when there is one.</summary>
    public static PlanDto ToDto(Plan plan, Func<PlanItem, Venue> venueOf) => new(
        (plan.SourcePlanId ?? plan.Id).ToString(),
        plan.Title,
        plan.Summary,
        plan.Items.OrderBy(i => i.Position).Select(i => ToDto(i, venueOf(i))).ToList(),
        plan.EstimatedCostPerPerson,
        plan.EstimatedTotalCost,
        plan.TotalDistanceKm);

    private static PlanItemDto ToDto(PlanItem item, Venue venue) => new(
        new VenueDto(
            venue.Id.ToString(CultureInfo.InvariantCulture), venue.Name, item.Activity, venue.Address,
            venue.Latitude, venue.Longitude, venue.PriceLevel),
        item.StartTime, item.EndTime, item.EstimatedCostPerPerson, item.DistanceKm);
}
