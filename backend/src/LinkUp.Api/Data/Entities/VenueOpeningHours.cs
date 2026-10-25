namespace LinkUp.Api.Data.Entities;

// - One opening slot on one day
// - A day can have several slots (lunch and dinner)
// - A day with no slots = closed
public sealed class VenueOpeningHours
{
    public int Id { get; set; }
    public int VenueId { get; set; }
    public DayOfWeek Day { get; set; }
    public TimeOnly Opens { get; set; }
    // If Closes &lt;= Opens, the slot ends after midnight (on the next day)
    public TimeOnly Closes { get; set; }
}