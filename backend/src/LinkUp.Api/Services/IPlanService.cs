using LinkUp.Api.Dtos;

namespace LinkUp.Api.Services;

public interface IPlanService
{
    Task<IReadOnlyList<PlanDto>> GeneratePlansAsync(
        NightPreferencesDto preferences, CancellationToken cancellationToken);
}
