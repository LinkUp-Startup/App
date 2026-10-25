using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using LinkUp.Api.Services;
using Microsoft.Extensions.DependencyInjection.Extensions;

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
        builder.UseSetting("Jwt:SigningKey", TestJwt.SigningKey);
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

// Plan HTTP/validation tests remain independent of PostgreSQL. Filtering is tested with SQLite.
public class PlanningApiFactory : ApiFactory
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IVenueFilteringService>();
            services.AddScoped<IVenueFilteringService, EligibleVenueFilter>();
        });
    }

    private sealed class EligibleVenueFilter : IVenueFilteringService
    {
        public Task<IReadOnlyList<Venue>> FilterAsync(
            NightPreferencesDto preferences, double startLatitude, double startLongitude,
            CancellationToken cancellationToken) => FilterAsync(preferences, cancellationToken);

        public Task<IReadOnlyList<Venue>> FilterAsync(
            NightPreferencesDto preferences, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<Venue>>(
                [new Venue { Id = 1, Name = "Eligible venue", Address = "Test address" }]);
    }
}
