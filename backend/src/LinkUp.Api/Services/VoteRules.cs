namespace LinkUp.Api.Services;

/// <summary>
/// Who leads the vote of a round. One rule, used by the vote results and by the group's plans, so they always agree.
/// </summary>
public static class VoteRules
{
    /// <summary>
    /// The vote has an outcome when the owner closed it or every member voted. Until the owner closes it, members can
    /// still change their vote, so the outcome can still change.
    /// </summary>
    public static bool HasOutcome(bool closed, int memberCount, int votesCast) =>
        closed || (memberCount > 0 && votesCast == memberCount);

    /// <summary>
    /// The plans with the most votes, by the id the app knows them by, in the order they were generated: one plan is
    /// the winner, several are a tie. None before the vote has an outcome, and none when nobody voted.
    /// </summary>
    /// <param name="plansInOrder">Each plan's stored id and the id the app knows it by.</param>
    /// <param name="votesPerPlan">Votes by stored plan id; plans without votes are missing.</param>
    public static List<Guid> Winners(
        bool hasOutcome, IEnumerable<(Guid Id, Guid AppId)> plansInOrder, IReadOnlyDictionary<Guid, int> votesPerPlan)
    {
        if (!hasOutcome) return [];

        var plans = plansInOrder.ToList();
        var mostVotes = plans.Select(p => votesPerPlan.GetValueOrDefault(p.Id)).DefaultIfEmpty(0).Max();
        return mostVotes > 0
            ? [.. plans.Where(p => votesPerPlan.GetValueOrDefault(p.Id) == mostVotes).Select(p => p.AppId)]
            : [];
    }
}
