using System.Text.Json.Serialization;

namespace LinkUp.Api.Dtos;

public enum Activity { Dinner, Drinks, Club, Concert, Cinema, Games, Outdoor }

public enum Transport { Walking, Bike, Car, PublicTransport, Taxi }

/// <summary>Mirrors NightPreferences in app/src/types/api.ts.</summary>
/// <remarks>
/// Numeric fields are [JsonRequired] so a request that leaves them out gets a 400 instead of
/// silently defaulting to 0 (under-posting).
/// </remarks>
public sealed record NightPreferencesDto(
    [property: JsonRequired] decimal BudgetPerPerson,
    [property: JsonRequired] int GroupSize,
    IReadOnlyList<Activity> Activities,
    string StartTime,
    string EndTime,
    [property: JsonRequired] double MaxDistanceKm,
    IReadOnlyList<Transport> Transport,
    string? Notes);
