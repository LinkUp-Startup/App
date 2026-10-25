using LinkUp.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace LinkUp.Api.Data.Seed;

// Inserts the dataset's venues that aren't in the database yet (matched by id)
public static class VenueSeeder
{
    // Used by `dotnet ef database update`.
    public static void Seed(DbContext context)
    {
        var existing = context.Set<Venue>().Select(v => v.Id).ToHashSet();
        var missing = VenueSeedData.Load().Where(v => !existing.Contains(v.Id)).ToList();
        if (missing.Count == 0) return;

        context.Set<Venue>().AddRange(missing);
        context.SaveChanges();
    }

    // Used when the API applies migrations on startup
    public static async Task SeedAsync(DbContext context, CancellationToken cancellationToken)
    {
        var existing = (await context.Set<Venue>().Select(v => v.Id).ToListAsync(cancellationToken)).ToHashSet();
        var missing = VenueSeedData.Load().Where(v => !existing.Contains(v.Id)).ToList();
        if (missing.Count == 0) return;

        context.Set<Venue>().AddRange(missing);
        await context.SaveChangesAsync(cancellationToken);
    }
}