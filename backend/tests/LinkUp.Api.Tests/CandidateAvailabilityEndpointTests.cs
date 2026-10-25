using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using LinkUp.Api.Data;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using LinkUp.Api.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

namespace LinkUp.Api.Tests;

public sealed class CandidateAvailabilityEndpointTests
{
    private static readonly object ValidRequest = new
    {
        preferences = new
        {
            budgetPerPerson = 30,
            groupSize = 4,
            activities = new[] { "dinner" },
            startTime = "2026-10-30T20:00:00Z",
            endTime = "2026-10-31T02:00:00Z",
            maxDistanceKm = 3,
            transport = new[] { "walking" },
        },
    };

    [Theory]
    [InlineData(0, 1, "no_candidates")]
    [InlineData(0, 3, "no_candidates")]
    [InlineData(1, 3, "insufficient_candidates")]
    [InlineData(2, 3, "insufficient_candidates")]
    public async Task Too_few_candidates_return_a_helpful_problem_and_do_not_generate(
        int count, int minimum, string code)
    {
        using var factory = new CandidateFactory(minimum);
        await factory.SeedAsync(count);

        using var response = await factory.CreateClient().PostAsJsonAsync("/api/plans/generate", ValidRequest);

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var problem = document.RootElement;
        Assert.Equal(422, problem.GetProperty("status").GetInt32());
        Assert.Equal(code, problem.GetProperty("code").GetString());
        Assert.Equal(count, problem.GetProperty("candidateCount").GetInt32());
        Assert.Equal(minimum, problem.GetProperty("minimumRequired").GetInt32());
        Assert.Contains(count == 0 ? "No venues" : "Not enough venues", problem.GetProperty("title").GetString());
        var detail = problem.GetProperty("detail").GetString();
        if (count == 0)
            Assert.Contains("No venues match the selected preferences", detail);
        else
        {
            Assert.Contains($"{count} matching venue", detail);
            Assert.Contains($"at least {minimum}", detail);
        }
        Assert.Contains("different activities or a wider time window", problem.GetProperty("suggestion").GetString());
        Assert.Equal(1, factory.Filter.Calls);
        Assert.Equal(0, factory.Generator.Calls);
    }

    [Theory]
    [InlineData(1, 1)]
    [InlineData(3, 3)]
    [InlineData(4, 3)]
    public async Task At_or_above_minimum_preserves_the_successful_response(int count, int minimum)
    {
        using var factory = new CandidateFactory(minimum);
        await factory.SeedAsync(count);

        using var response = await factory.CreateClient().PostAsJsonAsync("/api/plans/generate", ValidRequest);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Single(document.RootElement.EnumerateObject());
        var plan = Assert.Single(document.RootElement.GetProperty("plans").EnumerateArray());
        Assert.StartsWith("stub-", plan.GetProperty("id").GetString());
        var item = Assert.Single(plan.GetProperty("items").EnumerateArray());
        Assert.Equal("1", item.GetProperty("venue").GetProperty("id").GetString()); // the first candidate
        Assert.Equal(1, factory.Filter.Calls);
        Assert.Equal(1, factory.Generator.Calls);
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("{\"preferences\":null}")]
    public async Task Missing_preferences_remain_validation_errors_without_filtering_or_generation(string request)
    {
        using var factory = new CandidateFactory(1);

        using var response = await factory.CreateClient().PostAsync(
            "/api/plans/generate", new StringContent(request, null, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, factory.Filter.Calls);
        Assert.Equal(0, factory.Generator.Calls);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Minimum_must_be_positive(int minimum)
    {
        using var factory = new CandidateFactory(minimum);

        Assert.Throws<OptionsValidationException>(() => factory.CreateClient());
    }

    // Exercise HTTP presentation, real filtering, and the downstream generation boundary together.
    private sealed class CandidateFactory : ApiFactory
    {
        private readonly int _minimum;
        private readonly SqliteConnection _connection = new("Data Source=:memory:");
        private readonly AppDbContext _db;
        public CountingFilter Filter { get; }
        public RecordingGenerator Generator { get; } = new();

        public CandidateFactory(int minimum)
        {
            _minimum = minimum;
            _connection.Open();
            _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options);
            _db.Database.EnsureCreated();
            Filter = new CountingFilter(new VenueFilteringService(_db));
        }

        public async Task SeedAsync(int matchingCount)
        {
            for (var id = 1; id <= matchingCount; id++)
                _db.Venues.Add(Venue(id));
            // These rows must not count: inactive, closed, and wrong activity respectively.
            var inactive = Venue(1001);
            inactive.IsActive = false;
            var closed = Venue(1002);
            closed.OpeningHours.Clear();
            var wrongActivity = Venue(1003);
            wrongActivity.Category = VenueCategory.Bar;
            _db.Venues.AddRange(inactive, closed, wrongActivity);
            await _db.SaveChangesAsync();
            _db.ChangeTracker.Clear();
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.UseSetting("PlanGeneration:MinimumCandidateCount", _minimum.ToString());
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IVenueFilteringService>();
                services.AddSingleton<IVenueFilteringService>(Filter);
                services.RemoveAll<IPlanService>();
                services.AddSingleton<IPlanService>(Generator);
            });
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);
            if (!disposing) return;
            _db.Dispose();
            _connection.Dispose();
        }

        private static Venue Venue(int id) => new()
        {
            Id = id, Name = $"Venue {id}", Address = "Test address", PriceLevel = 1,
            Category = VenueCategory.Restaurant,
            OpeningHours = [new VenueOpeningHours
            {
                Day = DayOfWeek.Friday, Opens = new TimeOnly(18, 0), Closes = new TimeOnly(23, 0),
            }],
        };
    }

    private sealed class CountingFilter(IVenueFilteringService inner) : IVenueFilteringService
    {
        public int Calls { get; private set; }
        public Task<IReadOnlyList<Venue>> FilterAsync(NightPreferencesDto preferences, CancellationToken cancellationToken)
        {
            Calls++;
            return inner.FilterAsync(preferences, cancellationToken);
        }
    }

    private sealed class RecordingGenerator : IPlanService
    {
        public int Calls { get; private set; }
        public Task<IReadOnlyList<PlanDto>> GeneratePlansAsync(
            NightPreferencesDto preferences, IReadOnlyList<Venue> candidates, CancellationToken cancellationToken)
        {
            Calls++;
            return new StubPlanService().GeneratePlansAsync(preferences, candidates, cancellationToken);
        }
    }
}
