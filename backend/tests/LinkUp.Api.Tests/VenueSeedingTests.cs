using LinkUp.Api.Data.Entities;
using LinkUp.Api.Data.Seed;
using Microsoft.EntityFrameworkCore;

namespace LinkUp.Api.Tests;

// Needs PostgreSQL: run `docker compose up -d` first
public sealed class VenueSeedingTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>
{
    [Fact]
    public async Task Fresh_database_contains_all_venues()
    {
        var expected = VenueSeedData.Load();

        var (venues, openingHours) = await factory.WithDbAsync(async db =>
            (await db.Venues.CountAsync(), await db.Set<VenueOpeningHours>().CountAsync()));

        Assert.Equal(expected.Count, venues);
        Assert.Equal(expected.Sum(v => v.OpeningHours.Count), openingHours);
    }

    [Fact]
    public async Task Seeding_again_adds_nothing()
    {
        await factory.WithDbAsync(async db =>
        {
            await VenueSeeder.SeedAsync(db, CancellationToken.None);
            return 0;
        });

        var venues = await factory.WithDbAsync(db => db.Venues.CountAsync());

        Assert.Equal(VenueSeedData.Load().Count, venues);
    }
}