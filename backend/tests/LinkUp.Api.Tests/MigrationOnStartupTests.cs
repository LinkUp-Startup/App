using LinkUp.Api.Data;
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
}
