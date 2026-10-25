using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;

namespace LinkUp.Api.Services;

public interface IPlanService
{
    /// <summary>
    /// Combines filtered candidates into fully priced plans within the request's per-person budget.
    /// Every successful implementation must verify costs with IPlanCostService before returning.
    /// </summary>
    /// <exception cref="Ai.AiException">The plans could not be generated.</exception>
    Task<IReadOnlyList<PlanDto>> GeneratePlansAsync(
        NightPreferencesDto preferences, IReadOnlyList<Venue> candidates, CancellationToken cancellationToken);
}
