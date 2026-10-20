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
}
