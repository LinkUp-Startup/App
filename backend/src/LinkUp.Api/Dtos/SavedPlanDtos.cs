namespace LinkUp.Api.Dtos;

/// <summary>A plan saved to the signed-in account, with when it was saved.</summary>
public sealed record SavedPlanDto(PlanDto Plan, DateTimeOffset SavedAt);

public sealed record SavedPlansResponse(IReadOnlyList<SavedPlanDto> Plans);
