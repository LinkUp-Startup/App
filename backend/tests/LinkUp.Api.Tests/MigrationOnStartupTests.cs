using LinkUp.Api.Data;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Data.Seed;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;

namespace LinkUp.Api.Tests;

// Needs PostgreSQL: run `docker compose up -d` first
public sealed class MigrationOnStartupTests
{
    [Fact]
    public async Task Startup_applies_a_new_migration_to_an_existing_database()
    {
        // A database deployed before the latest migration existed
        using var factory = new AuthApiFactory();
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(factory.TestConnectionString).Options;
        string latest;
        await using (var outdated = new AppDbContext(options))
        {
            var migrations = outdated.Database.GetMigrations().ToList();
            latest = migrations[^1];
            await outdated.GetService<IMigrator>().MigrateAsync(migrations[^2]);
        }

        // Starting the API (the deploy) brings it up to date
        _ = factory.Services;

        var (applied, pending) = await factory.WithDbAsync(async db =>
            ((await db.Database.GetAppliedMigrationsAsync()).ToList(),
                (await db.Database.GetPendingMigrationsAsync()).ToList()));
        Assert.Contains(latest, applied);
        Assert.Empty(pending);
        Assert.Contains(factory.Logs.Messages, m => m.StartsWith("Applying 1 migration(s)") && m.Contains(latest));
    }

    [Fact]
    public void Restarting_without_new_migrations_leaves_the_schema_alone()
    {
        using var factory = new AuthApiFactory();
        _ = factory.Services;

        // A redeploy: a second API instance against the same, already migrated database
        using var redeploy = factory.WithWebHostBuilder(_ => { });
        _ = redeploy.Services;

        Assert.Contains(factory.Logs.Messages, m => m == "Database schema is up to date.");
    }

    [Fact]
    public async Task A_database_that_already_has_manolita_gets_its_thursday_night()
    {
        // Seeded before the Thursday-night slot existed: one migration behind, slot missing.
        using var factory = new AuthApiFactory();
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(factory.TestConnectionString).Options;
        await using (var outdated = new AppDbContext(options))
        {
            await outdated.GetService<IMigrator>().MigrateAsync(
                outdated.Database.GetMigrations().Single(m => m.EndsWith("_AddManolitaThursdayNight")) is var target
                    ? outdated.Database.GetMigrations().TakeWhile(m => m != target).Last()
                    : null);
            await VenueSeeder.SeedAsync(outdated, CancellationToken.None);
            await outdated.Set<VenueOpeningHours>()
                .Where(h => h.VenueId == 67 && h.Day == DayOfWeek.Friday && h.Opens == new TimeOnly(0, 0))
                .ExecuteDeleteAsync();
        }

        _ = factory.Services; // the deploy

        var slots = await factory.WithDbAsync(db => db.Set<VenueOpeningHours>()
            .CountAsync(h => h.VenueId == 67 && h.Day == DayOfWeek.Friday && h.Opens == new TimeOnly(0, 0)
                             && h.Closes == new TimeOnly(5, 0)));
        Assert.Equal(1, slots);
    }
}
