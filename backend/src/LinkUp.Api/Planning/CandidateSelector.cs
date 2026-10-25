using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using LinkUp.Api.Services;

namespace LinkUp.Api.Planning;

/// <summary>Narrows the filtered candidates to the ones sent to the AI.</summary>
public static class CandidateSelector
{
    /// <summary>
    /// Takes turns between the selected activities, picking a random venue for each, until <paramref name="max"/>
    /// venues are chosen. Every activity gets its share, a venue serving two activities counts once, and
    /// repeating a request gives different venues. Fewer than <paramref name="max"/> candidates are returned unchanged.
    /// </summary>
    public static IReadOnlyList<Venue> Select(
        IReadOnlyList<Venue> candidates, IReadOnlyList<Activity> activities, int max, Random random)
    {
        if (candidates.Count <= max) return candidates;

        var pools = activities
            .Select(activity => new Queue<Venue>(candidates
                .Where(v => VenueFilteringService.CategoriesFor(activity).Contains(v.Category))
                .OrderBy(_ => random.Next())))
            .Where(pool => pool.Count > 0)
            .ToList();

        var chosen = new HashSet<Venue>();
        while (chosen.Count < max && pools.Any(pool => pool.Count > 0))
        {
            foreach (var pool in pools)
            {
                while (pool.TryDequeue(out var venue) && !chosen.Add(venue))
                {
                    // Already chosen for another activity: take the next one.
                }

                if (chosen.Count == max) break;
            }
        }

        // Same order as the filtered list, so the prompt doesn't group venues by activity.
        return candidates.Where(chosen.Contains).ToList();
    }
}
