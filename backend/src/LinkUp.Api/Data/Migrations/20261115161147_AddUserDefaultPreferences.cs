using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LinkUp.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddUserDefaultPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int[]>(
                name: "DefaultActivities",
                table: "users",
                type: "integer[]",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "DefaultBudgetPerPerson",
                table: "users",
                type: "numeric(8,2)",
                precision: 8,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DefaultGroupSize",
                table: "users",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "DefaultMaxDistanceKm",
                table: "users",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<int[]>(
                name: "DefaultTransport",
                table: "users",
                type: "integer[]",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_users_DefaultBudgetPerPerson",
                table: "users",
                sql: "CAST(\"DefaultBudgetPerPerson\" AS numeric) BETWEEN 0 AND 500");

            migrationBuilder.AddCheckConstraint(
                name: "CK_users_DefaultGroupSize",
                table: "users",
                sql: "\"DefaultGroupSize\" BETWEEN 1 AND 20");

            migrationBuilder.AddCheckConstraint(
                name: "CK_users_DefaultMaxDistanceKm",
                table: "users",
                sql: "\"DefaultMaxDistanceKm\" BETWEEN 0.5 AND 30");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_users_DefaultBudgetPerPerson",
                table: "users");

            migrationBuilder.DropCheckConstraint(
                name: "CK_users_DefaultGroupSize",
                table: "users");

            migrationBuilder.DropCheckConstraint(
                name: "CK_users_DefaultMaxDistanceKm",
                table: "users");

            migrationBuilder.DropColumn(
                name: "DefaultActivities",
                table: "users");

            migrationBuilder.DropColumn(
                name: "DefaultBudgetPerPerson",
                table: "users");

            migrationBuilder.DropColumn(
                name: "DefaultGroupSize",
                table: "users");

            migrationBuilder.DropColumn(
                name: "DefaultMaxDistanceKm",
                table: "users");

            migrationBuilder.DropColumn(
                name: "DefaultTransport",
                table: "users");
        }
    }
}
