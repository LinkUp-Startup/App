using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LinkUp.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class DefineVenuePriceModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "PriceLevel",
                table: "Venues",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Venues_MaxSpend",
                table: "Venues",
                sql: "\"MaxSpend\" IS NULL OR \"MaxSpend\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Venues_MinSpend",
                table: "Venues",
                sql: "\"MinSpend\" IS NULL OR \"MinSpend\" >= 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Resolve unknown labels before downgrading; do not invent a default price level.
            migrationBuilder.DropCheckConstraint(
                name: "CK_Venues_MaxSpend",
                table: "Venues");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Venues_MinSpend",
                table: "Venues");

            migrationBuilder.AlterColumn<int>(
                name: "PriceLevel",
                table: "Venues",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }
    }
}
