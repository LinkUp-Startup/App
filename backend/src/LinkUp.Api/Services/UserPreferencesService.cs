using LinkUp.Api.Data;
using LinkUp.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace LinkUp.Api.Services;

public sealed class UserPreferencesService(AppDbContext db) : IUserPreferencesService
{
    public Task<UserPreferencesDto?> GetAsync(Guid userId, CancellationToken cancellationToken) =>
        db.Users.AsNoTracking().Where(user => user.Id == userId)
            .Select(user => new UserPreferencesDto(user.DefaultBudgetPerPerson, user.DefaultGroupSize,
                user.DefaultActivities, user.DefaultMaxDistanceKm, user.DefaultTransport))
            .SingleOrDefaultAsync(cancellationToken);

    public async Task<UserPreferencesDto?> UpdateAsync(
        Guid userId, UpdateUserPreferencesRequest request, CancellationToken cancellationToken)
    {
        var user = await db.Users.SingleOrDefaultAsync(user => user.Id == userId, cancellationToken);
        if (user is null) return null;

        user.DefaultBudgetPerPerson = request.BudgetPerPerson;
        user.DefaultGroupSize = request.GroupSize;
        user.DefaultActivities = request.Activities?.ToArray();
        user.DefaultMaxDistanceKm = request.MaxDistanceKm;
        user.DefaultTransport = request.Transport?.ToArray();
        await db.SaveChangesAsync(cancellationToken);

        // Read the stored value: PostgreSQL rounds monetary columns to cents.
        return await GetAsync(userId, cancellationToken);
    }
}
