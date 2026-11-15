using System.ComponentModel.DataAnnotations;

namespace LinkUp.Api.Dtos;

/// <summary>Shared form rules for saved defaults and individual plan requests.</summary>
public static class PreferenceRules
{
    // Range(typeof(decimal), ...) avoids rounding fractional values through the integer overload.
    public const string MinBudget = "0";
    public const string MaxBudget = "500";
    public const int MinGroupSize = 1;
    public const int MaxGroupSize = 20;
    public const double MinDistanceKm = 0.5;
    public const double MaxDistanceKm = 30;

    public static IEnumerable<ValidationResult> ValidateSelections(
        IReadOnlyList<Activity>? activities, IReadOnlyList<Transport>? transport)
    {
        if (activities is not null)
        {
            if (activities.Distinct().Count() != activities.Count)
                yield return new ValidationResult("Activities must not contain duplicates.", ["Activities"]);
            if (activities.Any(activity => !Enum.IsDefined(activity)))
                yield return new ValidationResult("Activities must contain only supported activities.", ["Activities"]);
        }

        if (transport is not null)
        {
            if (transport.Distinct().Count() != transport.Count)
                yield return new ValidationResult("Transport must not contain duplicates.", ["Transport"]);
            if (transport.Any(mode => !Enum.IsDefined(mode)))
                yield return new ValidationResult("Transport must contain only supported modes.", ["Transport"]);
        }
    }
}
