using LinkUp.Api.Dtos;

namespace LinkUp.Api.Services;

public interface ISavedPlanService
{
    /// <summary>The account's saved plans, most recently saved first.</summary>
    Task<IReadOnlyList<SavedPlanDto>> ListAsync(Guid userId, CancellationToken cancellationToken);

    /// <summary>Saves the plan to the account, or replaces it when the account already saved this id.</summary>
    Task<SavePlanResult> SaveAsync(Guid userId, Guid planId, PlanDto plan, CancellationToken cancellationToken);

    /// <summary>Removes the plan from the account. Does nothing when it isn't there.</summary>
    Task DeleteAsync(Guid userId, Guid planId, CancellationToken cancellationToken);
}

public abstract record SavePlanResult
{
    public sealed record Saved(SavedPlanDto Plan) : SavePlanResult;

    /// <summary>The plan is not acceptable; <see cref="Errors"/> says what is wrong, per field.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string[]> Errors) : SavePlanResult;

    /// <summary>The id belongs to a plan of another account.</summary>
    public sealed record NotFound : SavePlanResult;

    public sealed record LimitReached(int Limit) : SavePlanResult;
}
