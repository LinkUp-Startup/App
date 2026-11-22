using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LinkUp.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSentPlans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Plans_AccountOrGroup",
                table: "Plans");

            migrationBuilder.AddColumn<Guid>(
                name: "SentPlanId",
                table: "Plans",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SentPlans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SenderId = table.Column<Guid>(type: "uuid", nullable: true),
                    RecipientId = table.Column<Guid>(type: "uuid", nullable: false),
                    SentAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SentPlans", x => x.Id);
                    table.CheckConstraint("CK_SentPlans_NotToSelf", "\"SenderId\" IS NULL OR \"SenderId\" <> \"RecipientId\"");
                    table.ForeignKey(
                        name: "FK_SentPlans_users_RecipientId",
                        column: x => x.RecipientId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SentPlans_users_SenderId",
                        column: x => x.SenderId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Plans_SentPlanId",
                table: "Plans",
                column: "SentPlanId",
                unique: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Plans_OneOwner",
                table: "Plans",
                sql: "(\"UserId\" IS NULL AND \"GroupPlanRoundId\" IS NULL) OR (\"UserId\" IS NULL AND \"SentPlanId\" IS NULL) OR (\"GroupPlanRoundId\" IS NULL AND \"SentPlanId\" IS NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_SentPlans_RecipientId_SentAt",
                table: "SentPlans",
                columns: new[] { "RecipientId", "SentAt" });

            migrationBuilder.CreateIndex(
                name: "IX_SentPlans_SenderId",
                table: "SentPlans",
                column: "SenderId");

            migrationBuilder.AddForeignKey(
                name: "FK_Plans_SentPlans_SentPlanId",
                table: "Plans",
                column: "SentPlanId",
                principalTable: "SentPlans",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Plans_SentPlans_SentPlanId",
                table: "Plans");

            migrationBuilder.DropTable(
                name: "SentPlans");

            migrationBuilder.DropIndex(
                name: "IX_Plans_SentPlanId",
                table: "Plans");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Plans_OneOwner",
                table: "Plans");

            migrationBuilder.DropColumn(
                name: "SentPlanId",
                table: "Plans");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Plans_AccountOrGroup",
                table: "Plans",
                sql: "\"UserId\" IS NULL OR \"GroupPlanRoundId\" IS NULL");
        }
    }
}
