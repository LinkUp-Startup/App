using System.Net;
using System.Net.Http.Json;
using LinkUp.Api.Dtos;
using LinkUp.Api.Planning;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using static LinkUp.Api.Tests.PlanTestData;

namespace LinkUp.Api.Tests;

public sealed class SwapOptionsEndpointTests
{
    private sealed class FakeSwaps(Func<SwapOptionsRequest, IReadOnlyList<PlanDto>> answer) : IPlanSwapService
    {
        public SwapOptionsRequest? Received { get; private set; }

        public Task<IReadOnlyList<PlanDto>> GetOptionsAsync(SwapOptionsRequest request, CancellationToken cancellationToken)
        {
            Received = request;
            return Task.FromResult(answer(request));
        }
    }

    // The API writes enums as camelCase strings.
    private static readonly System.Text.Json.JsonSerializerOptions Json = new(System.Text.Json.JsonSerializerDefaults.Web)
    {
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter(System.Text.Json.JsonNamingPolicy.CamelCase) },
    };

    private static readonly PlanDto Plan = new(
        "plan-1", "Night out", "", [
            new PlanItemDto(new VenueDto("1", "Venue 1", Activity.Dinner, "Carrer Major", 41.6, 0.6, 2),
                Start, Start.AddHours(1), 20, 0),
        ], 20, 80, 0);

    private static HttpClient Client(FakeSwaps swaps)
    {
        var factory = new ApiFactory().WithWebHostBuilder(builder => builder.ConfigureServices(services =>
        {
            services.RemoveAll<IPlanSwapService>();
            services.AddSingleton<IPlanSwapService>(swaps);
        }));
        return factory.CreateClient();
    }

    [Fact]
    public async Task Returns_the_options_for_the_stop()
    {
        var swaps = new FakeSwaps(_ => [Plan with { Title = "Swapped" }]);

        using var response = await Client(swaps).PostAsJsonAsync("/api/plans/swap-options",
            new SwapOptionsRequest(Plan, 0, BudgetPerPerson: 30, GroupSize: 4), Json);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<SwapOptionsResponse>(Json);
        Assert.Equal("Swapped", Assert.Single(body!.Options).Title);
        Assert.Equal((0, 30m, 4), (swaps.Received!.StopIndex, swaps.Received.BudgetPerPerson, swaps.Received.GroupSize));
    }

    [Fact]
    public async Task Turns_an_unreadable_plan_into_a_400_for_that_field()
    {
        var swaps = new FakeSwaps(_ => throw new InvalidSwapException("Plan", "A place in this plan no longer exists."));

        using var response = await Client(swaps).PostAsJsonAsync("/api/plans/swap-options", new SwapOptionsRequest(Plan, 0), Json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.Equal(["A place in this plan no longer exists."], problem!.Errors["Plan"]);
    }

    [Theory]
    [InlineData("""{"plan":null,"stopIndex":0}""")]
    [InlineData("""{"stopIndex":0}""")]
    [InlineData("""{"plan":PLAN,"stopIndex":-1}""")]
    [InlineData("""{"plan":PLAN,"stopIndex":4}""")]
    [InlineData("""{"plan":PLAN,"stopIndex":0,"groupSize":0}""")]
    [InlineData("""{"plan":PLAN,"stopIndex":0,"budgetPerPerson":-5}""")]
    public async Task Rejects_invalid_requests_before_looking_for_options(string json)
    {
        var swaps = new FakeSwaps(_ => []);
        var plan = System.Text.Json.JsonSerializer.Serialize(Plan, Json);

        using var response = await Client(swaps).PostAsync("/api/plans/swap-options",
            new StringContent(json.Replace("PLAN", plan), System.Text.Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Null(swaps.Received);
    }
}
