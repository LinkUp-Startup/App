using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LinkUp.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupPlanVotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ClosedAt",
                table: "GroupPlanRounds",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "GroupPlanVotes",
                columns: table => new
                {
                    GroupPlanRoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GroupPlanVotes", x => new { x.GroupPlanRoundId, x.UserId });
                    table.CheckConstraint("CK_GroupPlanVotes_UpdatedAt", "\"UpdatedAt\" >= \"CreatedAt\"");
                    table.ForeignKey(
                        name: "FK_GroupPlanVotes_GroupPlanRounds_GroupPlanRoundId",
                        column: x => x.GroupPlanRoundId,
                        principalTable: "GroupPlanRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GroupPlanVotes_Plans_PlanId",
                        column: x => x.PlanId,
                        principalTable: "Plans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GroupPlanVotes_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GroupPlanVotes_PlanId",
                table: "GroupPlanVotes",
                column: "PlanId");

            migrationBuilder.CreateIndex(
                name: "IX_GroupPlanVotes_UserId",
                table: "GroupPlanVotes",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GroupPlanVotes");

            migrationBuilder.DropColumn(
                name: "ClosedAt",
                table: "GroupPlanRounds");
        }
    }
}
