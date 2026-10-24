using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LinkUp.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddVenues : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Venues",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Category = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Address = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Latitude = table.Column<double>(type: "double precision", nullable: false),
                    Longitude = table.Column<double>(type: "double precision", nullable: false),
                    EntranceType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    EntranceFee = table.Column<decimal>(type: "numeric(8,2)", precision: 8, scale: 2, nullable: true),
                    MinSpend = table.Column<decimal>(type: "numeric(8,2)", precision: 8, scale: 2, nullable: true),
                    MaxSpend = table.Column<decimal>(type: "numeric(8,2)", precision: 8, scale: 2, nullable: true),
                    PriceLevel = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Tags = table.Column<List<string>>(type: "text[]", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Venues", x => x.Id);
                    table.CheckConstraint("CK_Venues_EntranceFee", "\"EntranceFee\" IS NULL OR \"EntranceFee\" >= 0");
                    table.CheckConstraint("CK_Venues_Latitude", "\"Latitude\" BETWEEN -90 AND 90");
                    table.CheckConstraint("CK_Venues_Longitude", "\"Longitude\" BETWEEN -180 AND 180");
                    table.CheckConstraint("CK_Venues_PriceLevel", "\"PriceLevel\" BETWEEN 1 AND 4");
                    table.CheckConstraint("CK_Venues_SpendRange", "\"MinSpend\" IS NULL OR \"MaxSpend\" IS NULL OR \"MinSpend\" <= \"MaxSpend\"");
                });

            migrationBuilder.CreateTable(
                name: "VenueOpeningHours",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    VenueId = table.Column<int>(type: "integer", nullable: false),
                    Day = table.Column<int>(type: "integer", nullable: false),
                    Opens = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    Closes = table.Column<TimeOnly>(type: "time without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VenueOpeningHours", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VenueOpeningHours_Venues_VenueId",
                        column: x => x.VenueId,
                        principalTable: "Venues",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_VenueOpeningHours_VenueId",
                table: "VenueOpeningHours",
                column: "VenueId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "VenueOpeningHours");

            migrationBuilder.DropTable(
                name: "Venues");
        }
    }
}
