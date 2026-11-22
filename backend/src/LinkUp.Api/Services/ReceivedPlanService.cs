using LinkUp.Api.Data;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using LinkUp.Api.Planning;
using Microsoft.EntityFrameworkCore;

namespace LinkUp.Api.Services;

public sealed class ReceivedPlanService(AppDbContext db, TimeProvider clock) : IReceivedPlanService
{
    public async Task<SendPlanResult> SendAsync(
        Guid userId, Guid planId, Guid friendId, CancellationToken cancellationToken)
    {
        if (friendId == userId || !await AreFriendsAsync(userId, friendId, cancellationToken))
            return SendPlanResult.NotAFriend;

        var original = await db.Plans.AsNoTracking()
            .Include(p => p.Items)
            .SingleOrDefaultAsync(p => p.UserId == userId && p.SourcePlanId == planId, cancellationToken);
        if (original is null) return SendPlanResult.PlanNotFound;

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        // The same plan sent again replaces the friend's copy instead of piling up duplicates.
        await db.SentPlans
            .Where(s => s.SenderId == userId && s.RecipientId == friendId && s.Plan.SourcePlanId == planId)
            .ExecuteDeleteAsync(cancellationToken);

        var now = clock.GetUtcNow();
        db.SentPlans.Add(new SentPlan
        {
            SenderId = userId,
            RecipientId = friendId,
            SentAt = now,
            Plan = new Plan
            {
                // The same id, so the friend saving it gets the same plan id in their account
                SourcePlanId = original.SourcePlanId,
                Title = original.Title,
                Summary = original.Summary,
                EstimatedCostPerPerson = original.EstimatedCostPerPerson,
                EstimatedTotalCost = original.EstimatedTotalCost,
                TotalDistanceKm = original.TotalDistanceKm,
                CreatedAt = now,
                Items = original.Items.Select(item => new PlanItem
                {
                    Position = item.Position,
                    VenueId = item.VenueId,
                    Activity = item.Activity,
                    StartTime = item.StartTime,
                    EndTime = item.EndTime,
                    EstimatedCostPerPerson = item.EstimatedCostPerPerson,
                    DistanceKm = item.DistanceKm,
                }).ToList(),
            },
        });
        await db.SaveChangesAsync(cancellationToken);

        // Keep only the friend's newest received plans
        var old = await db.SentPlans
            .Where(s => s.RecipientId == friendId)
            .OrderByDescending(s => s.SentAt).ThenBy(s => s.Id)
            .Skip(ReceivedPlanLimits.MaxReceivedPlans)
            .Select(s => s.Id)
            .ToListAsync(cancellationToken);
        if (old.Count > 0)
            await db.SentPlans.Where(s => old.Contains(s.Id)).ExecuteDeleteAsync(cancellationToken);

        await transaction.CommitAsync(cancellationToken);
        return SendPlanResult.Sent;
    }

    public async Task<IReadOnlyList<ReceivedPlanDto>> ListAsync(Guid userId, CancellationToken cancellationToken)
    {
        var received = await db.SentPlans.AsNoTracking()
            .Where(s => s.RecipientId == userId)
            .OrderByDescending(s => s.SentAt).ThenBy(s => s.Id)
            .Include(s => s.Plan).ThenInclude(p => p.Items).ThenInclude(i => i.Venue)
            .AsSplitQuery()
            .ToListAsync(cancellationToken);

        var senderIds = received.Where(s => s.SenderId is not null).Select(s => s.SenderId!.Value).Distinct().ToList();
        var names = await db.Users.AsNoTracking()
            .Where(u => senderIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName, cancellationToken);

        return received.Select(s => new ReceivedPlanDto(
                s.Id,
                PlanMapping.ToDto(s.Plan, item => item.Venue),
                s.SenderId is { } sender && names.TryGetValue(sender, out var name) ? new PlanSenderDto(sender, name) : null,
                s.SentAt))
            .ToList();
    }

    public async Task DeleteAsync(Guid userId, Guid receivedPlanId, CancellationToken cancellationToken) =>
        await db.SentPlans.Where(s => s.Id == receivedPlanId && s.RecipientId == userId)
            .ExecuteDeleteAsync(cancellationToken);

    private Task<bool> AreFriendsAsync(Guid userId, Guid otherUserId, CancellationToken cancellationToken)
    {
        var (userA, userB) = Friendship.OrderPair(userId, otherUserId);
        return db.Friendships.AnyAsync(
            f => f.UserAId == userA && f.UserBId == userB && f.Status == FriendshipStatus.Accepted, cancellationToken);
    }
}
