namespace LinkUp.Api.Dtos;

public enum Activity { Dinner, Drinks, Club, Concert, Cinema, Games, Outdoor }

public enum Transport { Walking, Bike, Car, PublicTransport, Taxi }

/// <summary>Mirrors NightPreferences in app/src/types/api.ts.</summary>
public sealed record NightPreferencesDto(
    decimal BudgetPerPerson,
    int GroupSize,
    IReadOnlyList<Activity> Activities,
    string StartTime,
    string EndTime,
    double MaxDistanceKm,
    IReadOnlyList<Transport> Transport,
    string? Notes);
