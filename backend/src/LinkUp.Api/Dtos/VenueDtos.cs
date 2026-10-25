using LinkUp.Api.Data.Entities;

namespace LinkUp.Api.Dtos;

// Everything stored about a venue (Plans use the smaller VenueDto)
public sealed record VenueDetailsDto(
    int Id,
    string Name,
    VenueCategory Category,
    string Address,
    double Latitude,
    double Longitude,
    EntranceType EntranceType,
    decimal? EntranceFee,
    decimal? MinSpend,
    decimal? MaxSpend,
    int PriceLevel,
    string? Notes,
    IReadOnlyList<string> Tags,
    bool IsActive,
    IReadOnlyList<OpeningHoursDto> OpeningHours);

// One opening slot. Closes &lt;= Opens means it ends after midnight
public sealed record OpeningHoursDto(DayOfWeek Day, TimeOnly Opens, TimeOnly Closes);