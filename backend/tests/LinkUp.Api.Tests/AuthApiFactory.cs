using LinkUp.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace LinkUp.Api.Tests;

/// <summary>
/// The API against a real PostgreSQL: a throwaway database is created on the local server (the one from
/// docker-compose.yml), migrated by the API's own startup migration, and dropped when the factory is disposed.
/// Also captures the logs. Override the server with the TEST_POSTGRES environment variable (an Npgsql
/// connection string that may create databases).
/// </summary>
public sealed class AuthApiFactory : ApiFactory
{
    private const string DefaultServer = "Host=localhost;Port=5432;Username=linkup;Password=linkup;Database=postgres";

    private readonly string _adminConnectionString =
        Environment.GetEnvironmentVariable("TEST_POSTGRES") is { Length: > 0 } custom ? custom : DefaultServer;

    private readonly string _databaseName = $"linkup_test_{Guid.NewGuid():N}";

    public CapturedLogs Logs { get; } = new();

    public AuthApiFactory() => CreateDatabase();

    private string TestConnectionString =>
        new NpgsqlConnectionStringBuilder(_adminConnectionString) { Database = _databaseName }.ConnectionString;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting("ConnectionStrings:Default", TestConnectionString);
        builder.UseSetting("Database:MigrateOnStartup", "true"); // the real migrations build the schema
        builder.UseSetting("Database:MigrationMaxAttempts", "1");
        builder.ConfigureLogging(logging => logging.AddProvider(Logs));
    }

    public async Task<T> WithDbAsync<T>(Func<AppDbContext, Task<T>> action)
    {
        await using var scope = Services.CreateAsyncScope();
        return await action(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }

    private void CreateDatabase()
    {
        try
        {
            using var connection = new NpgsqlConnection(_adminConnectionString);
            connection.Open();
            using var command = connection.CreateCommand();
            command.CommandText = $"CREATE DATABASE \"{_databaseName}\"";
            command.ExecuteNonQuery();
        }
        catch (NpgsqlException ex)
        {
            throw new InvalidOperationException(
                "These tests need PostgreSQL. Start the local database with `docker compose up -d` " +
                "(or set TEST_POSTGRES to a connection string for a server that can create databases).", ex);
        }
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (!disposing) return;

        NpgsqlConnection.ClearAllPools(); // pooled connections would block the DROP
        using var connection = new NpgsqlConnection(_adminConnectionString);
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = $"DROP DATABASE IF EXISTS \"{_databaseName}\" WITH (FORCE)";
        command.ExecuteNonQuery();
    }

    public sealed class CapturedLogs : ILoggerProvider
    {
        private readonly List<string> _messages = [];

        public IReadOnlyList<string> Messages
        {
            get
            {
                lock (_messages) return [.. _messages];
            }
        }

        public ILogger CreateLogger(string categoryName) => new Capture(this);

        public void Dispose() { }

        private sealed class Capture(CapturedLogs owner) : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

            public bool IsEnabled(LogLevel logLevel) => true;

            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
                Func<TState, Exception?, string> formatter)
            {
                lock (owner._messages)
                    owner._messages.Add(formatter(state, exception) + (exception?.ToString() ?? ""));
            }
        }
    }
}
