using LinkUp.Api.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace LinkUp.Api.Data;

public static class DatabaseMigrator
{
    /// <summary>
    /// Applies pending migrations so a deploy always leaves the database matching the code.
    /// EF Core holds a database lock while migrating, so several instances starting at once is safe.
    /// If it still fails after the retries the exception propagates and the API does not start:
    /// better a failed deploy than running against an outdated schema.
    /// </summary>
    public static async Task MigrateDatabaseAsync(this WebApplication app)
    {
        var options = app.Services.GetRequiredService<IOptions<DatabaseOptions>>().Value;
        if (!options.MigrateOnStartup) return;

        var logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger(typeof(DatabaseMigrator));
        var maxAttempts = Math.Max(1, options.MigrationMaxAttempts);

        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await using var scope = app.Services.CreateAsyncScope();
                var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                var pending = (await context.Database.GetPendingMigrationsAsync()).ToList();
                if (pending.Count == 0)
                {
                    logger.LogInformation("Database is up to date.");
                    return;
                }

                logger.LogInformation("Applying {Count} migration(s): {Migrations}", pending.Count, string.Join(", ", pending));
                await context.Database.MigrateAsync();
                logger.LogInformation("Database migrated.");
                return;
            }
            catch (Exception ex) when (attempt < maxAttempts)
            {
                logger.LogWarning(ex, "Migration attempt {Attempt}/{Max} failed; retrying in {Delay}s.",
                    attempt, maxAttempts, options.MigrationRetryDelaySeconds);
                await Task.Delay(TimeSpan.FromSeconds(options.MigrationRetryDelaySeconds));
            }
        }
    }
}
