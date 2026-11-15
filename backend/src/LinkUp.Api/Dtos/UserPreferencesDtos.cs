using System.ComponentModel.DataAnnotations;

namespace LinkUp.Api.Dtos;

/// <summary>Full replacement of saved defaults. Missing or null fields clear the corresponding default.</summary>
public sealed record UpdateUserPreferencesRequest(
    [Range(typeof(decimal), PreferenceRules.MinBudget, PreferenceRules.MaxBudget)] decimal? BudgetPerPerson = null,
    [Range(PreferenceRules.MinGroupSize, PreferenceRules.MaxGroupSize)] int? GroupSize = null,
    [MinLength(1, ErrorMessage = "Pick at least one activity.")] IReadOnlyList<Activity>? Activities = null,
    [Range(PreferenceRules.MinDistanceKm, PreferenceRules.MaxDistanceKm)] double? MaxDistanceKm = null,
    [MinLength(1, ErrorMessage = "Pick at least one way to get around.")] IReadOnlyList<Transport>? Transport = null)
    : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext) =>
        PreferenceRules.ValidateSelections(Activities, Transport);
}

/// <summary>Only saved planning defaults; amounts are EUR per person and distances are kilometres.</summary>
public sealed record UserPreferencesDto(
    decimal? BudgetPerPerson, int? GroupSize, IReadOnlyList<Activity>? Activities,
    double? MaxDistanceKm, IReadOnlyList<Transport>? Transport);
