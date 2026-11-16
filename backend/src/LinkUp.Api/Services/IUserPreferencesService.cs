using LinkUp.Api.Dtos;

namespace LinkUp.Api.Services;

public interface IUserPreferencesService
{
    /// <summary>Returns null when the account no longer exists.</summary>
    Task<UserPreferencesDto?> GetAsync(Guid userId, CancellationToken cancellationToken);

    /// <summary>Replaces all defaults; returns null when the account no longer exists.</summary>
    Task<UserPreferencesDto?> UpdateAsync(Guid userId, UpdateUserPreferencesRequest request, CancellationToken cancellationToken);
}
