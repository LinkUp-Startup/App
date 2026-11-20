using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LinkUp.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupPlanRounds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "GroupPlanRoundId",
                table: "Plans",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "GroupPlanRounds",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    GroupSize = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GroupPlanRounds", x => x.Id);
                    table.CheckConstraint("CK_GroupPlanRounds_GroupSize", "\"GroupSize\" BETWEEN 1 AND 20");
                    table.ForeignKey(
                        name: "FK_GroupPlanRounds_Groups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "Groups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GroupPlanRounds_users_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Plans_GroupPlanRoundId",
                table: "Plans",
                column: "GroupPlanRoundId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Plans_AccountOrGroup",
                table: "Plans",
                sql: "\"UserId\" IS NULL OR \"GroupPlanRoundId\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_GroupPlanRounds_CreatedById",
                table: "GroupPlanRounds",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_GroupPlanRounds_GroupId_CreatedAt",
                table: "GroupPlanRounds",
                columns: new[] { "GroupId", "CreatedAt" });

            migrationBuilder.AddForeignKey(
                name: "FK_Plans_GroupPlanRounds_GroupPlanRoundId",
                table: "Plans",
                column: "GroupPlanRoundId",
                principalTable: "GroupPlanRounds",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Plans_GroupPlanRounds_GroupPlanRoundId",
                table: "Plans");

            migrationBuilder.DropTable(
                name: "GroupPlanRounds");

            migrationBuilder.DropIndex(
                name: "IX_Plans_GroupPlanRoundId",
                table: "Plans");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Plans_AccountOrGroup",
                table: "Plans");

            migrationBuilder.DropColumn(
                name: "GroupPlanRoundId",
                table: "Plans");
        }
    }
}
