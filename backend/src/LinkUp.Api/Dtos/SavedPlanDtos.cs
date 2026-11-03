namespace LinkUp.Api.Dtos;

/// <summary>
/// A plan saved to the signed-in account, with when it was saved and its public link (null when not shared).
/// </summary>
public sealed record SavedPlanDto(PlanDto Plan, DateTimeOffset SavedAt, string? ShareUrl);

public sealed record SavedPlansResponse(IReadOnlyList<SavedPlanDto> Plans);

/// <summary>The public link of a shared plan.</summary>
public sealed record ShareLinkDto(string Url);

/// <summary>A plan opened through its share link. Only the plan itself: nothing about the account that shared it.</summary>
public sealed record SharedPlanDto(PlanDto Plan);
