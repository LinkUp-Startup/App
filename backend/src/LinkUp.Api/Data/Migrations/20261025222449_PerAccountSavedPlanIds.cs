using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LinkUp.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class PerAccountSavedPlanIds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Plans_UserId",
                table: "Plans");

            migrationBuilder.AddColumn<Guid>(
                name: "SourcePlanId",
                table: "Plans",
                type: "uuid",
                nullable: true);

            // Plans saved so far used the app's plan id as their row id: keep that as their per-account id.
            migrationBuilder.Sql("""UPDATE "Plans" SET "SourcePlanId" = "Id" WHERE "UserId" IS NOT NULL;""");

            migrationBuilder.CreateIndex(
                name: "IX_Plans_UserId_SourcePlanId",
                table: "Plans",
                columns: new[] { "UserId", "SourcePlanId" },
                unique: true,
                filter: "\"UserId\" IS NOT NULL AND \"SourcePlanId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Plans_UserId_SourcePlanId",
                table: "Plans");

            migrationBuilder.DropColumn(
                name: "SourcePlanId",
                table: "Plans");

            migrationBuilder.CreateIndex(
                name: "IX_Plans_UserId",
                table: "Plans",
                column: "UserId");
        }
    }
}
