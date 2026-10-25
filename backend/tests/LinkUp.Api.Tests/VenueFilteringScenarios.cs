using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;

namespace LinkUp.Api.Tests;

[Flags]
public enum FilteringConstraints
{
    None = 0,
    Budget = 1,
    Distance = 2,
    OpeningHours = 4,
    Category = 8,
    All = Budget | Distance | OpeningHours | Category,
}

// Shared deterministic data for SQLite and PostgreSQL: one venue for every pass/fail combination.
internal static class VenueFilteringScenarios
{
    internal const double StartLatitude = 41.6176;
    internal const double StartLongitude = 0.62;

    internal static readonly FilteringConstraints[] Combinations =
    [
        FilteringConstraints.Budget | FilteringConstraints.Distance,
        FilteringConstraints.Budget | FilteringConstraints.OpeningHours,
        FilteringConstraints.Budget | FilteringConstraints.Category,
        FilteringConstraints.Distance | FilteringConstraints.OpeningHours,
        FilteringConstraints.Distance | FilteringConstraints.Category,
        FilteringConstraints.OpeningHours | FilteringConstraints.Category,
        FilteringConstraints.Budget | FilteringConstraints.Distance | FilteringConstraints.OpeningHours,
        FilteringConstraints.Budget | FilteringConstraints.Distance | FilteringConstraints.Category,
        FilteringConstraints.Budget | FilteringConstraints.OpeningHours | FilteringConstraints.Category,
        FilteringConstraints.Distance | FilteringConstraints.OpeningHours | FilteringConstraints.Category,
        FilteringConstraints.All,
    ];

    internal static readonly FilteringConstraints[] IndividualConstraints =
    [
        FilteringConstraints.Budget, FilteringConstraints.Distance,
        FilteringConstraints.OpeningHours, FilteringConstraints.Category,
    ];

    internal static NightPreferencesDto Preferences(FilteringConstraints constraints) => new(
        constraints.HasFlag(FilteringConstraints.Budget) ? 5m : 30m,
        4,
        constraints.HasFlag(FilteringConstraints.Category) ? [Activity.Dinner] : [Activity.Dinner, Activity.Drinks],
        new DateTimeOffset(2026, 11, 6, 20, 0, 0, TimeSpan.FromHours(1)),
        constraints.HasFlag(FilteringConstraints.OpeningHours)
            ? new DateTimeOffset(2026, 11, 6, 22, 0, 0, TimeSpan.FromHours(1))
            : new DateTimeOffset(2026, 11, 7, 2, 0, 0, TimeSpan.FromHours(1)),
        constraints.HasFlag(FilteringConstraints.Distance) ? 1 : 10,
        [Transport.Walking, Transport.Bike]);

    internal static Venue[] Venues(int idOffset = 0) => Enumerable.Range(0, 16)
        .Select(mask =>
        {
            var failures = (FilteringConstraints)mask;
            var expensive = failures.HasFlag(FilteringConstraints.Budget);
            var late = failures.HasFlag(FilteringConstraints.OpeningHours);
            return new Venue
            {
                Id = idOffset + mask + 1,
                Name = $"Scenario {mask}: {failures}",
                Address = "Lleida test venue",
                Category = failures.HasFlag(FilteringConstraints.Category) ? VenueCategory.Bar : VenueCategory.Restaurant,
                Latitude = StartLatitude + (failures.HasFlag(FilteringConstraints.Distance) ? 0.05 : 0.005),
                Longitude = StartLongitude,
                MinSpend = expensive ? 14m : 4m,
                MaxSpend = expensive ? 14m : 4m,
                EntranceFee = 1m,
                EntranceType = EntranceType.Paid,
                PriceLevel = expensive ? 2 : 1,
                OpeningHours = [new VenueOpeningHours
                {
                    Day = DayOfWeek.Friday,
                    Opens = late ? new TimeOnly(23, 0) : new TimeOnly(19, 0),
                    Closes = late ? new TimeOnly(2, 0) : new TimeOnly(22, 0),
                }],
            };
        }).Reverse().ToArray(); // Insertion order must not determine result order.

    // The mask records independent reasons to fail a tightened preference; no production predicates
    // or price/distance calculations are used as the expected-result oracle.
    internal static int[] ExpectedIds(FilteringConstraints constraints, int idOffset = 0) =>
        Enumerable.Range(0, 16)
            .Where(mask => ((FilteringConstraints)mask & constraints) == FilteringConstraints.None)
            .Select(mask => idOffset + mask + 1).ToArray();
}
