using LinkUp.Api.Data;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using LinkUp.Api.Planning;
using LinkUp.Api.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using static LinkUp.Api.Tests.PlanTestData;

namespace LinkUp.Api.Tests;

public sealed class GroupPlanSwapServiceTests : IAsyncLifetime
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private AppDbContext _db = null!;

    private const double Lat = 41.6176;
    private static readonly Guid Member = Guid.NewGuid(), Outsider = Guid.NewGuid(), PlanId = Guid.NewGuid();
    private static readonly DateTimeOffset Now = DateTimeOffset.UtcNow;
    private Guid _groupId, _roundId;

    public async Task InitializeAsync()
    {
        await _connection.OpenAsync();
        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options);
        await _db.Database.EnsureCreatedAsync();

        _db.Venues.AddRange(
            Priced(Venue(1, VenueCategory.Restaurant, latitude: Lat), 20),             // dinner in the plan
            Priced(Venue(2, VenueCategory.Bar, latitude: Lat + 0.005), 8),            // drinks in the plan
            Priced(Venue(3, VenueCategory.Restaurant, latitude: Lat + 0.002), 15),    // an option for dinner
            Priced(Venue(4, VenueCategory.Restaurant, latitude: Lat + 0.001), 35));   // dearer: not an option
        foreach (var id in new[] { Member, Outsider })
            _db.Users.Add(new User { Id = id, Email = $"{id:N}@example.com", PasswordHash = "x", DisplayName = "x", CreatedAt = Now });

        var group = new Group
        {
            Name = "Friday crew",
            CreatedAt = Now,
            Members = [new GroupMember { UserId = Member, Role = GroupRole.Owner, JoinedAt = Now }],
        };
        _db.Groups.Add(group);
        var round = new GroupPlanRound
        {
            GroupId = group.Id,
            CreatedById = Member,
            GroupSize = 4,
            CreatedAt = Now,
            Plans =
            [
                new Plan
                {
                    SourcePlanId = PlanId,
                    CreatedAt = Now,
                    Title = "Dinner at Place 1, then drinks",
                    Summary = "Start at Place 1.",
                    EstimatedCostPerPerson = 28,
                    EstimatedTotalCost = 112,
                    TotalDistanceKm = 0.96,
                    Items =
                    [
                        Stop(0, 1, Activity.Dinner, 20, 20, 0.4),
                        Stop(1, 2, Activity.Drinks, 22, 8, 0.56),
                    ],
                },
            ],
        };
        _db.GroupPlanRounds.Add(round);
        await _db.SaveChangesAsync();
        (_groupId, _roundId) = (group.Id, round.Id);
        _db.ChangeTracker.Clear();
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    private static Venue Priced(Venue venue, decimal spend)
    {
        venue.MinSpend = venue.MaxSpend = spend;
        venue.Name = $"Place {venue.Id}";
        return venue;
    }

    private static PlanItem Stop(int position, int venueId, Activity activity, int hour, decimal cost, double km) => new()
    {
        Position = position,
        VenueId = venueId,
        Activity = activity,
        StartTime = Start.AddHours(hour - 20),
        EndTime = Start.AddHours(hour - 20).AddMinutes(90),
        EstimatedCostPerPerson = cost,
        DistanceKm = km,
    };

    private Task<SwapStopResult> SwapAsync(
        Guid? user = null, Guid? planId = null, int stopIndex = 0, int venueId = 3) =>
        new GroupPlanSwapService(_db, new PlanSwapService(_db, new PlanCostService()))
            .SwapStopAsync(user ?? Member, _groupId, _roundId, planId ?? PlanId, stopIndex, venueId, default);

    private async Task<Plan> StoredPlanAsync()
    {
        _db.ChangeTracker.Clear();
        return await _db.Plans.AsNoTracking().Include(p => p.Items).SingleAsync(p => p.SourcePlanId == PlanId);
    }

    [Fact]
    public async Task A_member_swaps_a_stop_and_the_stored_plan_changes_for_everyone()
    {
        var result = Assert.IsType<SwapStopResult.Swapped>(await SwapAsync());

        Assert.Equal(PlanId.ToString(), result.Plan.Id);
        Assert.Equal("3", result.Plan.Items[0].Venue.Id);
        Assert.Equal("Dinner at Place 3, then drinks", result.Plan.Title);

        var stored = await StoredPlanAsync();
        var stops = stored.Items.OrderBy(i => i.Position).ToList();
        Assert.Equal([3, 2], stops.Select(i => i.VenueId));
        Assert.Equal(Activity.Dinner, stops[0].Activity);
        Assert.Equal(result.Plan.EstimatedCostPerPerson, stored.EstimatedCostPerPerson);
        Assert.Equal(result.Plan.EstimatedTotalCost, stored.EstimatedTotalCost);
        Assert.Equal(result.Plan.TotalDistanceKm, stored.TotalDistanceKm);
        Assert.Equal("Dinner at Place 3, then drinks", stored.Title);
    }

    [Fact]
    public async Task Only_a_venue_from_the_swap_options_is_accepted()
    {
        Assert.IsType<SwapStopResult.NotAnOption>(await SwapAsync(venueId: 4)); // over the stop's cost
        Assert.IsType<SwapStopResult.NotAnOption>(await SwapAsync(venueId: 2)); // already in the plan
        Assert.IsType<SwapStopResult.NotAnOption>(await SwapAsync(venueId: 99));
        Assert.Equal([1, 2], (await StoredPlanAsync()).Items.OrderBy(i => i.Position).Select(i => i.VenueId));
    }

    [Fact]
    public async Task Only_members_can_swap_and_only_plans_of_the_round()
    {
        Assert.IsType<SwapStopResult.RoundNotFound>(await SwapAsync(user: Outsider));
        Assert.IsType<SwapStopResult.PlanNotFound>(await SwapAsync(planId: Guid.NewGuid()));
    }

    [Fact]
    public async Task Nothing_can_be_swapped_once_the_vote_is_closed()
    {
        var round = await _db.GroupPlanRounds.SingleAsync(r => r.Id == _roundId);
        round.ClosedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();

        Assert.IsType<SwapStopResult.AlreadyClosed>(await SwapAsync());
    }

    [Fact]
    public async Task A_stop_the_plan_does_not_have_is_rejected()
    {
        var error = await Assert.ThrowsAsync<InvalidSwapException>(() => SwapAsync(stopIndex: 2));
        Assert.Equal("StopIndex", error.Field);
    }
}
