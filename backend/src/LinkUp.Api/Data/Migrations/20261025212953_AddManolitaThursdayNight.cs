using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LinkUp.Api.Data.Migrations
{
    /// <summary>
    /// Manolita (venue 67) is also open on Thursday nights, 00:00–05:00 (Q de Festa). The seeder only inserts
    /// venues a database doesn't have yet, so databases that already contain Manolita get the slot here. A fresh
    /// database has no venues yet when migrations run; it gets the slot from the dataset when the seeder runs.
    /// </summary>
    public partial class AddManolitaThursdayNight : Migration
    {
        // Day 5 = Friday: the night from Thursday into Friday.
        private const string Slot = "\"VenueId\" = 67 AND \"Day\" = 5 AND \"Opens\" = '00:00' AND \"Closes\" = '05:00'";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($"""
                INSERT INTO "VenueOpeningHours" ("VenueId", "Day", "Opens", "Closes")
                SELECT 67, 5, '00:00', '05:00'
                WHERE EXISTS (SELECT 1 FROM "Venues" WHERE "Id" = 67)
                  AND NOT EXISTS (SELECT 1 FROM "VenueOpeningHours" WHERE {Slot});
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($"""DELETE FROM "VenueOpeningHours" WHERE {Slot};""");
        }
    }
}
