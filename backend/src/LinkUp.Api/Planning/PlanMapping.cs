using System.Globalization;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;

namespace LinkUp.Api.Planning;

/// <summary>Turns the plans the API sends into stored rows, for saved plans and group plans.</summary>
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
}
