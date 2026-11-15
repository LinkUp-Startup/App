using LinkUp.Api.Dtos;

namespace LinkUp.Api.Data.Entities;

public sealed class User
{
    public Guid Id { get; set; }

    /// <summary>Stored lowercase and unique; used to log in.</summary>
    public required string Email { get; set; }

    /// <summary>Output of the password hasher, never the plain password.</summary>
    public required string PasswordHash { get; set; }

    public required string DisplayName { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>Optional per-person budget in EUR. Zero means free; null means unspecified.</summary>
    public decimal? DefaultBudgetPerPerson { get; set; }

    public int? DefaultGroupSize { get; set; }

    /// <summary>Optional maximum distance in kilometres, as in NightPreferencesDto.</summary>
    public double? DefaultMaxDistanceKm { get; set; }

    /// <summary>Null or empty means no saved selections. Uses the planning transport modes.</summary>
    public Transport[]? DefaultTransport { get; set; }

    /// <summary>Planning activities, mapped to venue categories by VenueFilteringService.</summary>
    public Activity[]? DefaultActivities { get; set; }
}
