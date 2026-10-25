namespace LinkUp.Api.Dtos;

public sealed record GeneratePlansRequest(NightPreferencesDto Preferences);

public sealed record GeneratePlansResponse(IReadOnlyList<PlanDto> Plans);

public sealed record PlanDto(
    string Id,
    string Title,
    string Summary,
    IReadOnlyList<PlanItemDto> Items,
    decimal EstimatedCostPerPerson,
    double TotalDistanceKm);

public sealed record PlanItemDto(
    VenueDto Venue,
    DateTimeOffset StartTime,
    DateTimeOffset EndTime,
    decimal EstimatedCostPerPerson,
    double DistanceKm);

public sealed record VenueDto(
    string Id,
    string Name,
    Activity Category,
    string Address,
    double Latitude,
    double Longitude,
    int? PriceLevel);
