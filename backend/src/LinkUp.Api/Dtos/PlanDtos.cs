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
    double TotalDistanceKm);

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
