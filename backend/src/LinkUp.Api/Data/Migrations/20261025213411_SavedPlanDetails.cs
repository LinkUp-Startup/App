using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LinkUp.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class SavedPlanDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "EstimatedCostPerPerson",
                table: "Plans",
                type: "numeric(8,2)",
                precision: 8,
                scale: 2,
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(8,2)",
                oldPrecision: 8,
                oldScale: 2);

            migrationBuilder.AddColumn<decimal>(
                name: "EstimatedTotalCost",
                table: "Plans",
                type: "numeric(10,2)",
                precision: 10,
                scale: 2,
                nullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "EstimatedCostPerPerson",
                table: "PlanItems",
                type: "numeric(8,2)",
                precision: 8,
                scale: 2,
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(8,2)",
                oldPrecision: 8,
                oldScale: 2);

            migrationBuilder.AddColumn<string>(
                name: "Activity",
                table: "PlanItems",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Dinner");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Plans_EstimatedTotalCost",
                table: "Plans",
                sql: "\"EstimatedTotalCost\" >= 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Plans_EstimatedTotalCost",
                table: "Plans");

            migrationBuilder.DropColumn(
                name: "EstimatedTotalCost",
                table: "Plans");

            migrationBuilder.DropColumn(
                name: "Activity",
                table: "PlanItems");

            migrationBuilder.AlterColumn<decimal>(
                name: "EstimatedCostPerPerson",
                table: "Plans",
                type: "numeric(8,2)",
                precision: 8,
                scale: 2,
                nullable: false,
                defaultValue: 0m,
                oldClrType: typeof(decimal),
                oldType: "numeric(8,2)",
                oldPrecision: 8,
                oldScale: 2,
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "EstimatedCostPerPerson",
                table: "PlanItems",
                type: "numeric(8,2)",
                precision: 8,
                scale: 2,
                nullable: false,
                defaultValue: 0m,
                oldClrType: typeof(decimal),
                oldType: "numeric(8,2)",
                oldPrecision: 8,
                oldScale: 2,
                oldNullable: true);
        }
    }
}
