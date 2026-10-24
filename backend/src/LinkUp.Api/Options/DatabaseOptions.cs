namespace LinkUp.Api.Options;

public sealed class DatabaseOptions
{
    public const string SectionName = "Database";

    /// <summary>Apply pending EF Core migrations when the API starts (issue #34).</summary>
    public bool MigrateOnStartup { get; init; } = true;

    /// <summary>The database may still be starting when the API is deployed, so connecting is retried.</summary>
    public int MigrationMaxAttempts { get; init; } = 5;

    public int MigrationRetryDelaySeconds { get; init; } = 3;
}
