using LinkUp.Api.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace LinkUp.Api.Data;

public static class DatabaseMigrator
{
    // Applies pending migrations so a deploy always leaves the database matching the code
    // If it still fails after the retries the exception propagates and the API does not start
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
                    logger.LogInformation("Database schema is up to date.");
                else if (logger.IsEnabled(LogLevel.Information))
                    logger.LogInformation("Applying {Count} migration(s): {Migrations}", pending.Count, string.Join(", ", pending));

                // When nothing is pending -> MigrateAsync runs the data seeding so venues added to the dataset reach existing databases too
                await context.Database.MigrateAsync();
                logger.LogInformation("Database ready.");
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
