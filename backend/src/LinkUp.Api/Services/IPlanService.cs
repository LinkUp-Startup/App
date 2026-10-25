using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;

namespace LinkUp.Api.Services;

public interface IPlanService
{
    /// <summary>Combines <paramref name="candidates"/>, the venues that passed filtering, into plans.</summary>
    /// <exception cref="Ai.AiException">The plans could not be generated.</exception>
    Task<IReadOnlyList<PlanDto>> GeneratePlansAsync(
        NightPreferencesDto preferences, IReadOnlyList<Venue> candidates, CancellationToken cancellationToken);
}
