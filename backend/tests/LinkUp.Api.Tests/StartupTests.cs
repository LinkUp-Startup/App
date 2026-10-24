using Microsoft.AspNetCore.Mvc.Testing;

namespace LinkUp.Api.Tests;

public sealed class StartupTests
{
    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Api_refuses_to_start_without_a_connection_string(string connectionString)
    {
        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder => builder.UseSetting("ConnectionStrings:Default", connectionString));

        var error = Assert.Throws<InvalidOperationException>(() => factory.CreateClient());
        Assert.Contains("ConnectionStrings__Default", error.Message);
    }

    [Fact]
    public void Api_does_not_start_when_migrations_cannot_be_applied()
    {
        // Port 1 refuses connections immediately; one attempt keeps the test fast.
        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("ConnectionStrings:Default", "Host=127.0.0.1;Port=1;Database=unused;Timeout=2");
            builder.UseSetting("Database:MigrateOnStartup", "true");
            builder.UseSetting("Database:MigrationMaxAttempts", "1");
        });

        Assert.ThrowsAny<Exception>(() => factory.CreateClient());
    }
}
