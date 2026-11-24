using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using static LinkUp.Api.Tests.PlanTestData;

namespace LinkUp.Api.Tests;

/// <summary>PUT /api/groups/{groupId}/rounds/{roundId}/plans/{planId}/stops/{stopIndex}: swapping a stop before the vote.</summary>
public sealed class GroupStopSwapEndpointTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>
{
    private static int _nextVenueId = 71000;

    private sealed record Account(HttpClient Client, Guid Id);

    // A round with one plan of two stops (dinner, drinks) and an alternative dinner venue
    private sealed record Round(Guid GroupId, Guid RoundId, Guid PlanId, int Dinner, int Drinks, int Option);

    private async Task<Account> NewAccountAsync()
    {
        using var anonymous = factory.CreateClient();
        var response = await anonymous.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"{Guid.NewGuid():N}@example.com", password = "correct-horse-battery", displayName = "Swapper",
        });
        response.EnsureSuccessStatusCode();
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", body.RootElement.GetProperty("accessToken").GetString());
        return new Account(client, body.RootElement.GetProperty("user").GetProperty("id").GetGuid());
    }

    private static Venue Priced(int id, VenueCategory category, double latitude, decimal spend)
    {
        var venue = Venue(id, category, latitude: latitude);
        venue.MinSpend = venue.MaxSpend = spend;
        venue.Name = $"Place {id}";
        return venue;
    }

    private Task<Round> NewRoundAsync(Account owner) => factory.WithDbAsync(async db =>
    {
        var first = Interlocked.Add(ref _nextVenueId, 3) - 3;
        var (dinner, drinks, option) = (first, first + 1, first + 2);
        db.Venues.AddRange(
            Priced(dinner, VenueCategory.Restaurant, 41.6176, 20),
            Priced(drinks, VenueCategory.Bar, 41.6226, 8),
            Priced(option, VenueCategory.Restaurant, 41.6196, 15));

        var now = DateTimeOffset.UtcNow;
        var group = new Group
        {
            Name = "Friday crew",
            CreatedAt = now,
            Members = [new GroupMember { UserId = owner.Id, Role = GroupRole.Owner, JoinedAt = now }],
        };
        db.Groups.Add(group);
        var planId = Guid.NewGuid();
        PlanItem Stop(int position, int venueId, Activity activity, int hour, decimal cost) => new()
        {
            Position = position, VenueId = venueId, Activity = activity,
            StartTime = Start.AddHours(hour - 20), EndTime = Start.AddHours(hour - 20).AddMinutes(90),
            EstimatedCostPerPerson = cost, DistanceKm = 0.5,
        };
        var round = new GroupPlanRound
        {
            GroupId = group.Id,
            CreatedById = owner.Id,
            GroupSize = 2,
            CreatedAt = now,
            Plans =
            [
                new Plan
                {
                    SourcePlanId = planId, Title = $"Dinner at Place {dinner}", Summary = "Dinner, then drinks.",
                    EstimatedCostPerPerson = 28, EstimatedTotalCost = 56, TotalDistanceKm = 1, CreatedAt = now,
                    Items = [Stop(0, dinner, Activity.Dinner, 20, 20), Stop(1, drinks, Activity.Drinks, 22, 8)],
                },
            ],
        };
        db.GroupPlanRounds.Add(round);
        await db.SaveChangesAsync();
        return new Round(group.Id, round.Id, planId, dinner, drinks, option);
    });

    private static string Url(Round round, int stopIndex = 0) =>
        $"/api/groups/{round.GroupId}/rounds/{round.RoundId}/plans/{round.PlanId}/stops/{stopIndex}";

    private static async Task AssertStatusAsync(HttpStatusCode expected, Task<HttpResponseMessage> request)
    {
        using var response = await request;
        Assert.Equal(expected, response.StatusCode);
    }

    [Fact]
    public async Task A_member_swaps_a_stop_and_the_group_sees_the_changed_plan()
    {
        var owner = await NewAccountAsync();
        var round = await NewRoundAsync(owner);

        using var response = await owner.Client.PutAsJsonAsync(Url(round), new { venueId = round.Option });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var plan = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(round.PlanId.ToString(), plan.RootElement.GetProperty("id").GetString());
        Assert.Equal($"Dinner at Place {round.Option}", plan.RootElement.GetProperty("title").GetString());

        using var listed = JsonDocument.Parse(await owner.Client.GetStringAsync($"/api/groups/{round.GroupId}/plans"));
        var items = listed.RootElement.GetProperty("rounds")[0].GetProperty("plans")[0].GetProperty("items");
        Assert.Equal(
            [round.Option.ToString(), round.Drinks.ToString()],
            items.EnumerateArray().Select(i => i.GetProperty("venue").GetProperty("id").GetString()));
    }

    [Fact]
    public async Task Swapping_is_refused_with_the_right_status()
    {
        var (owner, outsider) = (await NewAccountAsync(), await NewAccountAsync());
        var round = await NewRoundAsync(owner);
        using var anonymous = factory.CreateClient();

        await AssertStatusAsync(HttpStatusCode.Unauthorized, anonymous.PutAsJsonAsync(Url(round), new { venueId = round.Option }));
        await AssertStatusAsync(HttpStatusCode.NotFound, outsider.Client.PutAsJsonAsync(Url(round), new { venueId = round.Option }));
        await AssertStatusAsync(HttpStatusCode.NotFound, owner.Client.PutAsJsonAsync(
            Url(round with { PlanId = Guid.NewGuid() }), new { venueId = round.Option }));
        await AssertStatusAsync(HttpStatusCode.BadRequest, owner.Client.PutAsJsonAsync(Url(round), new { }));
        await AssertStatusAsync(HttpStatusCode.BadRequest, owner.Client.PutAsJsonAsync(Url(round), new { venueId = round.Drinks }));
        await AssertStatusAsync(HttpStatusCode.BadRequest, owner.Client.PutAsJsonAsync(Url(round, 5), new { venueId = round.Option }));

        await AssertStatusAsync(HttpStatusCode.OK, owner.Client.PostAsync(
            $"/api/groups/{round.GroupId}/rounds/{round.RoundId}/close", null));
        await AssertStatusAsync(HttpStatusCode.Conflict, owner.Client.PutAsJsonAsync(Url(round), new { venueId = round.Option }));
    }
}
