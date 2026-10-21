using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace LinkUp.Api.Dtos;

public enum Activity { Dinner, Drinks, Club, Concert, Cinema, Games, Outdoor }

public enum Transport { Walking, Bike, Car, PublicTransport, Taxi }

/// <summary>What the user wants from their night. Sent by the app's preference form.</summary>
/// <remarks>
/// Limits mirror the app's form (<c>Limits</c> in app/src/features/preferences/form.ts); keep both in sync.
/// Numeric fields are [JsonRequired] so a request that leaves them out gets a 400 instead of
/// silently defaulting to 0 (under-posting). Invalid requests return 400 with a ValidationProblemDetails
/// body listing the errors per field.
/// </remarks>
public sealed record NightPreferencesDto(
    [property: JsonRequired] [Range(0, 500)] decimal BudgetPerPerson,
    [property: JsonRequired] [Range(1, 20)] int GroupSize,
    [MinLength(1, ErrorMessage = "Pick at least one activity.")] IReadOnlyList<Activity> Activities,
    DateTimeOffset StartTime,
    DateTimeOffset EndTime,
    [property: JsonRequired] [Range(0.5, 30)] double MaxDistanceKm,
    [MinLength(1, ErrorMessage = "Pick at least one way to get around.")] IReadOnlyList<Transport> Transport,
    [MaxLength(500)] string? Notes = null) : IValidatableObject
{
    public static readonly TimeSpan MinDuration = TimeSpan.FromHours(1);
    public static readonly TimeSpan MaxDuration = TimeSpan.FromHours(12);

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        var duration = EndTime - StartTime;
        if (duration < MinDuration)
            yield return new ValidationResult(
                $"The end time must be at least {MinDuration.TotalHours:0} hour after the start time.", [nameof(EndTime)]);
        else if (duration > MaxDuration)
            yield return new ValidationResult(
                $"A night can be at most {MaxDuration.TotalHours:0} hours.", [nameof(EndTime)]);

        if (Activities.Distinct().Count() != Activities.Count)
            yield return new ValidationResult("Activities must not contain duplicates.", [nameof(Activities)]);
        if (Transport.Distinct().Count() != Transport.Count)
            yield return new ValidationResult("Transport must not contain duplicates.", [nameof(Transport)]);
    }
}
