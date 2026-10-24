namespace LinkUp.Api.Data.Entities;

/// <summary>
/// One opening slot on one day. A day can have several slots (lunch and dinner);
/// a day with no slots means closed.
/// </summary>
public sealed class VenueOpeningHours
{
    public int Id { get; set; }
    public int VenueId { get; set; }
    public DayOfWeek Day { get; set; }
    public TimeOnly Opens { get; set; }
    /// <summary>If Closes &lt;= Opens, the slot ends after midnight (on the next day).</summary>
    public TimeOnly Closes { get; set; }
}