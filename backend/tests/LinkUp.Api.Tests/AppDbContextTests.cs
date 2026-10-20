using LinkUp.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace LinkUp.Api.Tests;

public sealed class AppDbContextTests
{
    [Fact]
    public void Model_builds_and_matches_the_latest_migration()
    {
        // No connection is opened: building the model only needs the provider.
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=unused")
            .Options;
        using var context = new AppDbContext(options);

        Assert.NotNull(context.Model);
        Assert.False(
            context.Database.HasPendingModelChanges(),
            "The model has changes without a migration. Run `dotnet ef migrations add <Name>`.");
    }
}
