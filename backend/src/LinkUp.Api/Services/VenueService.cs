using LinkUp.Api.Data;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace LinkUp.Api.Services;

public sealed class VenueService(AppDbContext db) : IVenueService
{
    public async Task<IReadOnlyList<VenueDetailsDto>> GetAllAsync(CancellationToken cancellationToken)
    {
        var venues = await Venues().OrderBy(v => v.Id).ToListAsync(cancellationToken);
        return venues.Select(ToDto).ToList();
    }

    public async Task<VenueDetailsDto?> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        var venue = await Venues().SingleOrDefaultAsync(v => v.Id == id, cancellationToken);
        return venue is null ? null : ToDto(venue);
    }

    // Read-only: AsNoTracking skips EF Core's change tracking
    private IQueryable<Venue> Venues() => db.Venues.AsNoTracking().Include(v => v.OpeningHours);

    private static VenueDetailsDto ToDto(Venue venue) => new(
        venue.Id,
        venue.Name,
        venue.Category,
        venue.Address,
        venue.Latitude,
        venue.Longitude,
        venue.EntranceType,
        venue.EntranceFee,
        venue.MinSpend,
        venue.MaxSpend,
        venue.PriceLevel,
        venue.Notes,
        venue.Tags,
        venue.IsActive,
        venue.OpeningHours
            .OrderBy(h => WeekdayIndex(h.Day))
            .ThenBy(h => h.Opens)
            .Select(h => new OpeningHoursDto(h.Day, h.Opens, h.Closes))
            .ToList(),
        venue.EstimatedSpendPerPerson,
        venue.Currency);

    // Monday first as in the dataset (DayOfWeek starts at Sunday)
    private static int WeekdayIndex(DayOfWeek day) => ((int)day + 6) % 7;
}
