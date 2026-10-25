using System.Globalization;
using LinkUp.Api.Data;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace LinkUp.Api.Services;

public sealed class SavedPlanService(AppDbContext db, TimeProvider clock) : ISavedPlanService
{
    public const int MaxPlansPerAccount = 200;
    public const int MaxItems = 10;

    // What the columns can hold (numeric(8,2) and numeric(10,2)); larger values would fail in the database.
    private const decimal MaxCostPerPerson = 999_999.99m;
    private const decimal MaxTotalCost = 99_999_999.99m;
    private const double MaxDistanceKm = 1000;
    private const string CostsMessage = "Costs and distances can't be negative or unrealistically large.";

    private static bool IsAmount(decimal? amount, decimal max) => amount is null || (amount >= 0 && amount <= max);

    private static bool IsDistance(double km) => double.IsFinite(km) && km is >= 0 and <= MaxDistanceKm;

    public async Task<IReadOnlyList<SavedPlanDto>> ListAsync(Guid userId, CancellationToken cancellationToken)
    {
        var plans = await WithItems(db.Plans.AsNoTracking())
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(cancellationToken);
        return plans.Select(p => ToDto(p, item => item.Venue)).ToList();
    }

    public async Task<SavePlanResult> SaveAsync(
        Guid userId, Guid planId, PlanDto plan, CancellationToken cancellationToken)
    {
        var errors = Validate(plan, planId);
        if (errors.Count > 0) return new SavePlanResult.Invalid(errors);

        // The venue's name, address and position come from the database, never from the request.
        var venueIds = plan.Items.Select(i => VenueId(i.Venue.Id)).Distinct().ToList();
        var venues = await db.Venues.AsNoTracking()
            .Where(v => venueIds.Contains(v.Id))
            .ToDictionaryAsync(v => v.Id, cancellationToken);
        for (var i = 0; i < StopCount(plan); i++)
        {
            if (!venues.ContainsKey(VenueId(plan.Items[i].Venue.Id)))
                errors[$"Items[{i}].Venue"] = ["This venue does not exist."];
        }
        if (errors.Count > 0) return new SavePlanResult.Invalid(errors);

        // A token can outlive its account; saving would then break the foreign key.
        if (!await db.Users.AnyAsync(u => u.Id == userId, cancellationToken))
            return new SavePlanResult.UnknownUser();

        // Saving again replaces the plan: same id, same account, new content, and it counts as saved now.
        // One transaction, so a failed save never leaves the account without its old copy. The per-account lock
        // makes concurrent saves (a double tap, two devices) run one after the other, so the replace and the
        // limit check never race.
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.Database.ExecuteSqlAsync(
            $"SELECT pg_advisory_xact_lock(hashtextextended({userId.ToString()}, 0))", cancellationToken);

        var existing = await WithItems(db.Plans)
            .SingleOrDefaultAsync(p => p.UserId == userId && p.SourcePlanId == planId, cancellationToken);
        if (existing is null && await db.Plans.CountAsync(p => p.UserId == userId, cancellationToken) >= MaxPlansPerAccount)
            return new SavePlanResult.LimitReached(MaxPlansPerAccount);

        if (existing is not null)
        {
            db.Plans.Remove(existing);
            await db.SaveChangesAsync(cancellationToken);
        }

        var saved = new Plan
        {
            UserId = userId,
            SourcePlanId = planId,
            Title = plan.Title.Trim(),
            Summary = plan.Summary.Trim(),
            EstimatedCostPerPerson = plan.EstimatedCostPerPerson,
            EstimatedTotalCost = plan.EstimatedTotalCost,
            TotalDistanceKm = plan.TotalDistanceKm,
            CreatedAt = clock.GetUtcNow(),
            Items = plan.Items.Select((item, position) => new PlanItem
            {
                Position = position,
                VenueId = VenueId(item.Venue.Id),
                Activity = item.Venue.Category,
                StartTime = item.StartTime,
                EndTime = item.EndTime,
                EstimatedCostPerPerson = item.EstimatedCostPerPerson,
                DistanceKm = item.DistanceKm,
            }).ToList(),
        };
        db.Plans.Add(saved);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new SavePlanResult.Saved(ToDto(saved, item => venues[item.VenueId]));
    }

    public async Task DeleteAsync(Guid userId, Guid planId, CancellationToken cancellationToken) =>
        await db.Plans.Where(p => p.UserId == userId && p.SourcePlanId == planId).ExecuteDeleteAsync(cancellationToken);

    private static IQueryable<Plan> WithItems(IQueryable<Plan> plans) =>
        plans.Include(p => p.Items).ThenInclude(i => i.Venue);

    // The number of stops comes from the request. Validate rejects more than MaxItems; this keeps every loop
    // over the stops bounded by that limit on its own, whatever the caller sent.
    private static int StopCount(PlanDto plan) => Math.Min(plan.Items.Count, MaxItems);

    // -1 never matches a venue, so a malformed id is reported as an unknown venue.
    private static int VenueId(string id) =>
        int.TryParse(id, NumberStyles.None, CultureInfo.InvariantCulture, out var venueId) ? venueId : -1;

    private static Dictionary<string, string[]> Validate(PlanDto plan, Guid planId)
    {
        var errors = new Dictionary<string, string[]>();
        if (!Guid.TryParse(plan.Id, out var bodyId) || bodyId != planId)
            errors[nameof(PlanDto.Id)] = ["The plan id must match the id in the URL."];
        if (string.IsNullOrWhiteSpace(plan.Title) || plan.Title.Trim().Length > PlanConfiguration.TitleMaxLength)
            errors[nameof(PlanDto.Title)] = [$"The title is required and at most {PlanConfiguration.TitleMaxLength} characters."];
        if (plan.Summary is null || plan.Summary.Trim().Length > PlanConfiguration.SummaryMaxLength)
            errors[nameof(PlanDto.Summary)] = [$"The summary is at most {PlanConfiguration.SummaryMaxLength} characters."];
        if (!IsAmount(plan.EstimatedCostPerPerson, MaxCostPerPerson) || !IsAmount(plan.EstimatedTotalCost, MaxTotalCost)
            || !IsDistance(plan.TotalDistanceKm))
            errors["Costs"] = [CostsMessage];

        if (plan.Items is null || plan.Items.Count is 0 or > MaxItems)
        {
            errors[nameof(PlanDto.Items)] = [$"A plan has 1 to {MaxItems} stops."];
            return errors;
        }

        for (var i = 0; i < StopCount(plan); i++)
        {
            var item = plan.Items[i];
            if (item?.Venue is null)
            {
                errors[$"Items[{i}]"] = ["The stop needs a venue."];
                continue;
            }
            if (item.EndTime <= item.StartTime)
                errors[$"Items[{i}].EndTime"] = ["A stop must end after it starts."];
            if (i > 0 && plan.Items[i - 1] is { } previous && item.StartTime < previous.EndTime)
                errors[$"Items[{i}].StartTime"] = ["Stops must be in order and not overlap."];
            if (!IsAmount(item.EstimatedCostPerPerson, MaxCostPerPerson) || !IsDistance(item.DistanceKm))
                errors[$"Items[{i}].Costs"] = [CostsMessage];
            if (!Enum.IsDefined(item.Venue.Category))
                errors[$"Items[{i}].Venue.Category"] = ["Unknown activity."];
        }

        return errors;
    }

    private static SavedPlanDto ToDto(Plan plan, Func<PlanItem, Venue> venueOf) => new(
        new PlanDto(
            (plan.SourcePlanId ?? plan.Id).ToString(),
            plan.Title,
            plan.Summary,
            plan.Items.OrderBy(i => i.Position).Select(i => ToDto(i, venueOf(i))).ToList(),
            plan.EstimatedCostPerPerson,
            plan.EstimatedTotalCost,
            plan.TotalDistanceKm),
        plan.CreatedAt);

    private static PlanItemDto ToDto(PlanItem item, Venue venue) => new(
        new VenueDto(
            venue.Id.ToString(CultureInfo.InvariantCulture), venue.Name, item.Activity, venue.Address,
            venue.Latitude, venue.Longitude, venue.PriceLevel),
        item.StartTime, item.EndTime, item.EstimatedCostPerPerson, item.DistanceKm);
}
