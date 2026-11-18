using System.ComponentModel.DataAnnotations;
using LinkUp.Api.Planning;
using System.Text.Json.Serialization;

namespace LinkUp.Api.Dtos;

public sealed record GeneratePlansRequest(NightPreferencesDto Preferences);

public sealed record GeneratePlansResponse(IReadOnlyList<PlanDto> Plans);

public sealed record PlanDto(
    string Id,
    string Title,
    string Summary,
    IReadOnlyList<PlanItemDto> Items,
    // Null when the price of any stop is unknown (see docs/venue-prices.md).
    decimal? EstimatedCostPerPerson,
    // For the whole group: the cost per person times the group size. Null like the cost per person.
    decimal? EstimatedTotalCost,
    // Required so a save that leaves it out gets a 400 instead of silently storing 0.
    [property: JsonRequired] double TotalDistanceKm);

public sealed record PlanItemDto(
    VenueDto Venue,
    DateTimeOffset StartTime,
    DateTimeOffset EndTime,
    // Entrance fee plus typical spend; null when the venue's price is unknown.
    decimal? EstimatedCostPerPerson,
    // From the previous stop, or from the start location for the first stop (0 without one).
    double DistanceKm);

public sealed record VenueDto(
    string Id,
    string Name,
    Activity Category,
    string Address,
    double Latitude,
    double Longitude,
    int? PriceLevel);

/// <summary>Replace one stop of a plan (#229). The plan comes from the app; everything else from the database.</summary>
public sealed record SwapOptionsRequest(
    [property: JsonRequired] PlanDto Plan,
    [property: JsonRequired] [Range(0, PlanValidator.MaxStops - 1)] int StopIndex,
    // Known on the results screen: the whole plan must then stay within it. Without it, an alternative
    // costs at most what the stop it replaces costs.
    [Range(typeof(decimal), PreferenceRules.MinBudget, PreferenceRules.MaxBudget)] decimal? BudgetPerPerson = null,
    // For the group total; without it the group size is worked out from the plan's own totals.
    [Range(PreferenceRules.MinGroupSize, PreferenceRules.MaxGroupSize)] int? GroupSize = null,
    // Where the group starts, for the distance to the first stop.
    GeoPointDto? StartLocation = null);

/// <summary>The plan with the stop replaced, once per alternative venue, closest first.</summary>
public sealed record SwapOptionsResponse(IReadOnlyList<PlanDto> Options);
