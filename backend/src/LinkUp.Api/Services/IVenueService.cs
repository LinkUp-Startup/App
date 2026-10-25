using LinkUp.Api.Dtos;

namespace LinkUp.Api.Services;

public interface IVenueService
{
    // All venues ordered by id (including inactive ones)
    Task<IReadOnlyList<VenueDetailsDto>> GetAllAsync(CancellationToken cancellationToken);

    // Returns null when there is no venue with this id
    Task<VenueDetailsDto?> GetByIdAsync(int id, CancellationToken cancellationToken);
}