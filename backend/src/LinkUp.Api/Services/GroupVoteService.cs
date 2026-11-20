using LinkUp.Api.Data;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace LinkUp.Api.Services;

public sealed class GroupVoteService(AppDbContext db, TimeProvider clock) : IGroupVoteService
{
    public async Task<GroupVoteResultsDto?> GetResultsAsync(
        Guid userId, Guid groupId, Guid roundId, CancellationToken cancellationToken)
    {
        var round = await FindRoundAsync(userId, groupId, roundId, tracked: false, cancellationToken);
        return round is null ? null : await ResultsAsync(userId, groupId, round, cancellationToken);
    }

    public async Task<VoteResult> CastAsync(
        Guid userId, Guid groupId, Guid roundId, Guid planId, CancellationToken cancellationToken)
    {
        // The same lock as adding rounds and changing members, so a vote never meets a round that was just pruned
        // or a member who is just leaving.
        await using var transaction = await LockAsync(groupId, cancellationToken);
        if (await FindRoundAsync(userId, groupId, roundId, tracked: false, cancellationToken) is not { } round)
            return new VoteResult.RoundNotFound();
        if (round.ClosedAt is not null) return new VoteResult.AlreadyClosed();

        // The id the app knows a plan by: the generated one, or the stored one for a plan that has none.
        var plan = await db.Plans.AsNoTracking()
            .Where(p => p.GroupPlanRoundId == roundId && (p.SourcePlanId ?? p.Id) == planId)
            .Select(p => new { p.Id })
            .FirstOrDefaultAsync(cancellationToken);
        if (plan is null) return new VoteResult.PlanNotFound();

        var vote = await db.GroupPlanVotes.SingleOrDefaultAsync(
            v => v.GroupPlanRoundId == roundId && v.UserId == userId, cancellationToken);
        var now = Now();
        if (vote is null)
        {
            db.GroupPlanVotes.Add(new GroupPlanVote
            {
                GroupPlanRoundId = roundId, UserId = userId, PlanId = plan.Id, CreatedAt = now, UpdatedAt = now,
            });
        }
        else if (vote.PlanId != plan.Id)
        {
            vote.PlanId = plan.Id;
            vote.UpdatedAt = now;
        }

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new VoteResult.Done(await ResultsAsync(userId, groupId, round, cancellationToken));
    }

    public async Task<VoteResult> CloseAsync(Guid userId, Guid groupId, Guid roundId, CancellationToken cancellationToken)
    {
        await using var transaction = await LockAsync(groupId, cancellationToken);
        if (await FindRoundAsync(userId, groupId, roundId, tracked: true, cancellationToken) is not { } round)
            return new VoteResult.RoundNotFound();

        var isOwner = await db.GroupMembers.AnyAsync(
            m => m.GroupId == groupId && m.UserId == userId && m.Role == GroupRole.Owner, cancellationToken);
        if (!isOwner) return new VoteResult.NotTheOwner();

        // Closing again keeps the time of the first time.
        if (round.ClosedAt is null)
        {
            round.ClosedAt = Now();
            await db.SaveChangesAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return new VoteResult.Done(await ResultsAsync(userId, groupId, round, cancellationToken));
    }

    // To the microsecond, which is all PostgreSQL keeps: the time in the response is then the stored one.
    private DateTimeOffset Now()
    {
        var now = clock.GetUtcNow();
        return new DateTimeOffset(now.Ticks - now.Ticks % 10, now.Offset);
    }

    // The round, when it belongs to the group and the user is a member of that group
    private Task<GroupPlanRound?> FindRoundAsync(
        Guid userId, Guid groupId, Guid roundId, bool tracked, CancellationToken cancellationToken)
    {
        var rounds = tracked ? db.GroupPlanRounds : db.GroupPlanRounds.AsNoTracking();
        return rounds.SingleOrDefaultAsync(
            r => r.Id == roundId
                && r.GroupId == groupId
                && db.GroupMembers.Any(m => m.GroupId == groupId && m.UserId == userId),
            cancellationToken);
    }

    private async Task<GroupVoteResultsDto> ResultsAsync(
        Guid userId, Guid groupId, GroupPlanRound round, CancellationToken cancellationToken)
    {
        var memberCount = await db.GroupMembers.CountAsync(m => m.GroupId == groupId, cancellationToken);

        // Votes of people who have left the group no longer count.
        var votes = await (
                from v in db.GroupPlanVotes.AsNoTracking()
                where v.GroupPlanRoundId == round.Id
                    && db.GroupMembers.Any(m => m.GroupId == groupId && m.UserId == v.UserId)
                select new { v.UserId, v.PlanId })
            .ToListAsync(cancellationToken);

        // In the order they were generated (see GroupService.AddPlanRoundAsync)
        var plans = await db.Plans.AsNoTracking()
            .Where(p => p.GroupPlanRoundId == round.Id)
            .OrderBy(p => p.CreatedAt).ThenBy(p => p.Id)
            .Select(p => new { p.Id, AppId = p.SourcePlanId ?? p.Id })
            .ToListAsync(cancellationToken);

        var perPlan = votes.GroupBy(v => v.PlanId).ToDictionary(g => g.Key, g => g.Count());
        var mine = votes.SingleOrDefault(v => v.UserId == userId)?.PlanId;

        var winners = VoteRules.Winners(
            VoteRules.HasOutcome(round.ClosedAt is not null, memberCount, votes.Count),
            plans.Select(p => (p.Id, p.AppId)),
            perPlan);

        return new GroupVoteResultsDto(
            round.Id,
            round.ClosedAt,
            memberCount,
            votes.Count,
            plans.FirstOrDefault(p => p.Id == mine)?.AppId,
            [.. plans.Select(p => new PlanVotesDto(p.AppId, perPlan.GetValueOrDefault(p.Id)))],
            winners);
    }

    // Changes in the same group run one after the other (the same key as GroupService).
    private async Task<IDbContextTransaction> LockAsync(Guid groupId, CancellationToken cancellationToken)
    {
        var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var key = $"group:{groupId}";
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({key}, 0))", cancellationToken);
        return transaction;
    }
}
