using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging;

namespace LinkUp.Api.Tests;

public sealed class HttpLoggingPrivacyTests
{
    [Fact]
    public async Task Request_bodies_with_personal_data_are_not_logged_outside_development()
    {
        var logs = new AuthApiFactory.CapturedLogs();
        using var api = new PlanningApiFactory().WithWebHostBuilder(builder =>
            builder.ConfigureLogging(logging => logging.AddProvider(logs)));

        await api.CreateClient().PostAsJsonAsync("/api/plans/generate", new
        {
            preferences = new
            {
                budgetPerPerson = 30, groupSize = 2, activities = new[] { "drinks" },
                startTime = "2026-10-30T20:00:00Z", endTime = "2026-10-31T02:00:00Z", maxDistanceKm = 3,
                transport = new[] { "walking" }, notes = "private-note-7f3a",
                startLocation = new { latitude = 41.617654, longitude = 0.620111 },
            },
        });

        // The request itself is logged (method, path, status) ...
        Assert.Contains(logs.Messages, m => m.Contains("/api/plans/generate"));
        // ... but not what was in it.
        Assert.DoesNotContain(logs.Messages, m => m.Contains("private-note-7f3a") || m.Contains("41.617654"));
    }
}
