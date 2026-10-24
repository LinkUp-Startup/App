using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace LinkUp.Api.Tests;

/// <summary>
/// Runs the real API in memory. The database health check is replaced by a fake with a
/// fixed result, so tests don't need a running PostgreSQL.
/// </summary>
public class ApiFactory : WebApplicationFactory<Program>
{
    protected virtual HealthStatus DatabaseStatus => HealthStatus.Healthy;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Default", "Host=localhost;Database=unused");
        builder.UseSetting("Database:MigrateOnStartup", "false"); // no real database in these tests
        builder.ConfigureServices(services =>
            services.Configure<HealthCheckServiceOptions>(options =>
            {
                options.Registrations.Clear();
                options.Registrations.Add(new HealthCheckRegistration(
                    "database",
                    _ => new FixedHealthCheck(DatabaseStatus),
                    failureStatus: null,
                    tags: null));
            }));
    }

    private sealed class FixedHealthCheck(HealthStatus status) : IHealthCheck
    {
        public Task<HealthCheckResult> CheckHealthAsync(
            HealthCheckContext context, CancellationToken cancellationToken = default) =>
            Task.FromResult(new HealthCheckResult(status));
    }
}

public sealed class UnhealthyDatabaseApiFactory : ApiFactory
{
    protected override HealthStatus DatabaseStatus => HealthStatus.Unhealthy;
}
