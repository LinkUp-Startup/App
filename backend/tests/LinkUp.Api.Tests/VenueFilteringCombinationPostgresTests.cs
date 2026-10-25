using LinkUp.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace LinkUp.Api.Tests;

// The same matrix executes against the production provider in CI, with rollback per case.
public sealed class VenueFilteringCombinationPostgresTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>
{
    public static IEnumerable<object[]> Combinations => VenueFilteringScenarios.Combinations.Select(c => new object[] { c });

    [Theory]
    [MemberData(nameof(Combinations))]
    public async Task Every_filter_combination_translates_and_executes_on_PostgreSQL(FilteringConstraints constraints)
    {
        await factory.WithDbAsync(async db =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync();
            db.Venues.AddRange(VenueFilteringScenarios.Venues(idOffset: 9000));
            await db.SaveChangesAsync();
            db.ChangeTracker.Clear();

            var candidates = await new VenueFilteringService(db).FilterAsync(
                VenueFilteringScenarios.Preferences(constraints), VenueFilteringScenarios.StartLatitude,
                VenueFilteringScenarios.StartLongitude, CancellationToken.None);

            Assert.Equal(VenueFilteringScenarios.ExpectedIds(constraints, idOffset: 9000),
                candidates.Where(v => v.Id is >= 9001 and <= 9016).Select(v => v.Id));
            Assert.Empty(db.ChangeTracker.Entries());
            return 0;
        });
    }
}
