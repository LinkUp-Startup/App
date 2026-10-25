using LinkUp.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace LinkUp.Api.Tests;

// Needs PostgreSQL: run `docker compose up -d` first
public sealed class PlanPersistenceTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>
{
    private static readonly DateTimeOffset Evening = new(2026, 11, 6, 20, 0, 0, TimeSpan.FromHours(1));

    private static PlanItem Item(int position, int venueId) => new()
    {
        Position = position,
        VenueId = venueId,
        StartTime = Evening.AddHours(position),
        EndTime = Evening.AddHours(position + 1),
        EstimatedCostPerPerson = 10m,
        DistanceKm = position == 0 ? 0 : 0.8,
    };

    private async Task<int[]> VenueIdsAsync(int count) =>
        await factory.WithDbAsync(db => db.Venues.OrderBy(v => v.Id).Select(v => v.Id).Take(count).ToArrayAsync());

    private async Task<Guid> SavePlanAsync(Guid? userId, params PlanItem[] items)
    {
        var plan = new Plan
        {
            UserId = userId,
            Title = "Tapas and drinks",
            Summary = "Dinner, then a bar nearby.",
            EstimatedCostPerPerson = 20m,
            TotalDistanceKm = 0.8,
            Items = [.. items],
        };
        await factory.WithDbAsync(db =>
        {
            db.Plans.Add(plan);
            return db.SaveChangesAsync();
        });
        return plan.Id;
    }

    // Asserts the database itself rejected the change, not some earlier error
    private static async Task AssertRejectedAsync(string sqlState, Func<Task> action)
    {
        var error = await Assert.ThrowsAnyAsync<Exception>(action);
        var postgres = Assert.IsType<PostgresException>(error as PostgresException ?? error.InnerException);
        Assert.Equal(sqlState, postgres.SqlState);
    }

    [Fact]
    public async Task Plan_is_stored_with_its_items_in_order_and_their_venues()
    {
        var venues = await VenueIdsAsync(2);
        var id = await SavePlanAsync(null, Item(1, venues[1]), Item(0, venues[0]));

        var plan = await factory.WithDbAsync(db => db.Plans.AsNoTracking()
            .Include(p => p.Items.OrderBy(i => i.Position)).ThenInclude(i => i.Venue)
            .SingleAsync(p => p.Id == id));

        Assert.Equal("Tapas and drinks", plan.Title);
        Assert.NotEqual(default, plan.CreatedAt);
        Assert.Equal([venues[0], venues[1]], plan.Items.Select(i => i.Venue.Id));
        Assert.Equal(Evening.AddHours(1), plan.Items[1].StartTime);
    }

    [Fact]
    public async Task Two_items_cannot_share_a_position()
    {
        var venues = await VenueIdsAsync(2);

        await AssertRejectedAsync(PostgresErrorCodes.UniqueViolation,
            () => SavePlanAsync(null, Item(0, venues[0]), Item(0, venues[1])));
    }

    [Fact]
    public async Task Item_must_end_after_it_starts()
    {
        var venues = await VenueIdsAsync(1);
        var item = Item(0, venues[0]);
        item.EndTime = item.StartTime;

        await AssertRejectedAsync(PostgresErrorCodes.CheckViolation, () => SavePlanAsync(null, item));
    }

    [Fact]
    public async Task Item_must_reference_an_existing_venue()
    {
        await AssertRejectedAsync(PostgresErrorCodes.ForeignKeyViolation, () => SavePlanAsync(null, Item(0, -1)));
    }

    [Fact]
    public async Task Deleting_a_plan_deletes_its_items()
    {
        var venues = await VenueIdsAsync(1);
        var id = await SavePlanAsync(null, Item(0, venues[0]));

        var remaining = await factory.WithDbAsync(async db =>
        {
            await db.Plans.Where(p => p.Id == id).ExecuteDeleteAsync();
            return await db.Set<PlanItem>().CountAsync(i => i.PlanId == id);
        });

        Assert.Equal(0, remaining);
    }

    [Fact]
    public async Task Venue_used_in_a_plan_cannot_be_deleted()
    {
        var venues = await VenueIdsAsync(1);
        await SavePlanAsync(null, Item(0, venues[0]));

        await AssertRejectedAsync(PostgresErrorCodes.RestrictViolation, () =>
            factory.WithDbAsync(db => db.Venues.Where(v => v.Id == venues[0]).ExecuteDeleteAsync()));
    }

    [Fact]
    public async Task Deleting_an_account_deletes_its_saved_plans()
    {
        var venues = await VenueIdsAsync(1);
        var user = new User { Email = $"{Guid.NewGuid():N}@example.com", PasswordHash = "hash", DisplayName = "Ann" };
        await factory.WithDbAsync(db =>
        {
            db.Users.Add(user);
            return db.SaveChangesAsync();
        });
        var id = await SavePlanAsync(user.Id, Item(0, venues[0]));

        var stillThere = await factory.WithDbAsync(async db =>
        {
            await db.Users.Where(u => u.Id == user.Id).ExecuteDeleteAsync();
            return await db.Plans.AnyAsync(p => p.Id == id);
        });

        Assert.False(stillThere);
    }
}
