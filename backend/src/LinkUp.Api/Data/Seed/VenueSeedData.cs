using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using LinkUp.Api.Data.Entities;

namespace LinkUp.Api.Data.Seed;

// Reads the curated Lleida dataset and converts it into entities
// Anything it can't read throws with the venue's id, so a bad edit to the JSON fails loudly instead of seeding wrong data
public static class VenueSeedData
{
    public const string ResourceName = "LinkUp.Api.Data.Seed.lleida_venues.json";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    };

    private static readonly Dictionary<string, VenueCategory> Categories = new()
    {
        ["restaurant"] = VenueCategory.Restaurant,
        ["bar"] = VenueCategory.Bar,
        ["pub"] = VenueCategory.Pub,
        ["bar / restaurant"] = VenueCategory.BarRestaurant,
        ["nightclub"] = VenueCategory.Nightclub,
        ["cafe"] = VenueCategory.Cafe,
        ["bakery"] = VenueCategory.Bakery,
        ["bakery / cafe"] = VenueCategory.BakeryCafe,
        ["ice cream shop"] = VenueCategory.IceCreamShop,
        ["museum"] = VenueCategory.Museum,
        ["library"] = VenueCategory.Library,
        ["market"] = VenueCategory.Market,
    };

    private static readonly Dictionary<string, EntranceType> EntranceTypes = new()
    {
        ["FREE"] = EntranceType.Free,
        ["PAID"] = EntranceType.Paid,
        ["PAID (event-dependent)"] = EntranceType.PaidEventDependent,
        ["UNVERIFIED"] = EntranceType.Unverified,
    };

    // "€10–20" or "€5"
    private static readonly Regex SpendPattern = new(@"^€(\d+(?:\.\d+)?)(?:–(\d+(?:\.\d+)?))?$");

    // Index 0 = Monday
    private static readonly string[] Days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    public static IReadOnlyList<Venue> Load()
    {
        using var stream = typeof(VenueSeedData).Assembly.GetManifestResourceStream(ResourceName)
            ?? throw new InvalidOperationException($"Embedded resource {ResourceName} not found.");
        var records = JsonSerializer.Deserialize<List<VenueRecord>>(stream, JsonOptions)
            ?? throw new InvalidOperationException("The venue dataset is empty.");
        return records.Select(ToVenue).ToList();
    }

    // 1 = cheap / 4 = expensive
    public static int PriceLevelFor(decimal minSpend, decimal maxSpend) =>
        ((minSpend + maxSpend) / 2) switch
        {
            <= 10m => 1,
            <= 20m => 2,
            <= 35m => 3,
            _ => 4,
        };

    public static (decimal Min, decimal Max) ParseSpend(string text)
    {
        var match = SpendPattern.Match(text);
        if (!match.Success)
            throw new FormatException($"Can't read average spend \"{text}\".");

        var min = decimal.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture);
        var max = match.Groups[2].Success
            ? decimal.Parse(match.Groups[2].Value, CultureInfo.InvariantCulture)
            : min;
        return (min, max);
    }

    // "Mon–Thu 13:00–16:00, 20:00–00:00; Fri 18:00–03:00; Sun closed" → one row per day and slot
    // Day ranges may wrap around the week ("Sun–Mon"). "closed" adds no rows
    public static IEnumerable<VenueOpeningHours> ParseOpeningHours(string text)
    {
        foreach (var group in text.Split("; "))
        {
            var space = group.IndexOf(' ');
            if (space < 0)
                throw new FormatException($"Can't read opening hours \"{group}\".");

            var days = ParseDays(group[..space]);
            var slots = group[(space + 1)..];
            if (slots == "closed") continue;

            foreach (var slot in slots.Split(", "))
            {
                var times = slot.Split('–');
                if (times.Length != 2)
                    throw new FormatException($"Can't read time slot \"{slot}\" in \"{group}\".");

                var opens = ParseTime(times[0]);
                var closes = ParseTime(times[1]);
                foreach (var day in days)
                    yield return new VenueOpeningHours { Day = day, Opens = opens, Closes = closes };
            }
        }
    }

    private static Venue ToVenue(VenueRecord record)
    {
        try
        {
            var (minSpend, maxSpend) = ParseSpend(record.AverageSpendIfConsuming);
            return new Venue
            {
                Id = record.Id,
                Name = record.Name,
                Category = Lookup(Categories, record.Category, "category"),
                Address = record.Address,
                Latitude = record.Latitude,
                Longitude = record.Longitude,
                EntranceType = Lookup(EntranceTypes, record.Entrance, "entrance"),
                EntranceFee = record.EntranceFeeEur,
                MinSpend = minSpend,
                MaxSpend = maxSpend,
                PriceLevel = PriceLevelFor(minSpend, maxSpend),
                Notes = record.Notes,
                OpeningHours = ParseOpeningHours(record.OpeningHours).ToList(),
            };
        }
        catch (FormatException ex)
        {
            throw new FormatException($"Venue {record.Id} ({record.Name}) in the dataset: {ex.Message}", ex);
        }
    }

    private static List<DayOfWeek> ParseDays(string text)
    {
        if (text == "Daily")
            return [.. Enum.GetValues<DayOfWeek>()];

        var parts = text.Split('–');
        if (parts.Length > 2)
            throw new FormatException($"Can't read days \"{text}\".");

        var first = DayIndex(parts[0]);
        var last = DayIndex(parts[^1]);
        var days = new List<DayOfWeek>();
        for (var i = first; ; i = (i + 1) % 7)
        {
            days.Add((DayOfWeek)((i + 1) % 7)); // Days[0] = Monday; DayOfWeek.Sunday = 0
            if (i == last) break;
        }
        return days;
    }

    private static int DayIndex(string day)
    {
        var index = Array.IndexOf(Days, day);
        return index >= 0 ? index : throw new FormatException($"Unknown day \"{day}\".");
    }

    private static TimeOnly ParseTime(string text) =>
        TimeOnly.ParseExact(text, "HH:mm", CultureInfo.InvariantCulture);

    private static T Lookup<T>(Dictionary<string, T> map, string value, string field) =>
        map.TryGetValue(value, out var result) ? result : throw new FormatException($"Unknown {field} \"{value}\".");

    internal sealed record VenueRecord(
        int Id,
        string Name,
        string Category,
        decimal? EntranceFeeEur,
        string Entrance,
        string AverageSpendIfConsuming,
        string Address,
        double Latitude,
        double Longitude,
        string OpeningHours,
        string? Notes);
}