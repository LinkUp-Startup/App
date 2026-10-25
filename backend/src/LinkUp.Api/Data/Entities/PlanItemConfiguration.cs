using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LinkUp.Api.Data.Entities;

public sealed class PlanItemConfiguration : IEntityTypeConfiguration<PlanItem>
{
    public void Configure(EntityTypeBuilder<PlanItem> builder)
    {
        builder.ToTable("PlanItems", table =>
        {
            table.HasCheckConstraint("CK_PlanItems_Position", "\"Position\" >= 0");
            table.HasCheckConstraint("CK_PlanItems_Times", "\"EndTime\" > \"StartTime\"");
            table.HasCheckConstraint("CK_PlanItems_EstimatedCostPerPerson", "\"EstimatedCostPerPerson\" >= 0");
            table.HasCheckConstraint("CK_PlanItems_DistanceKm", "\"DistanceKm\" >= 0");
        });
        builder.HasKey(i => i.Id);

        builder.HasIndex(i => new { i.PlanId, i.Position }).IsUnique();
        builder.Property(i => i.EstimatedCostPerPerson).HasPrecision(8, 2);
        builder.Property(i => i.Activity).HasConversion<string>().HasMaxLength(32);

        // Npgsql only writes UTC offsets, but plan times arrive in the user's offset (e.g. +01:00)
        builder.Property(i => i.StartTime).HasConversion(t => t.ToUniversalTime(), t => t);
        builder.Property(i => i.EndTime).HasConversion(t => t.ToUniversalTime(), t => t);

        // A venue used in plans can't be deleted; set Venue.IsActive = false to hide it instead
        builder.HasOne(i => i.Venue)
            .WithMany()
            .HasForeignKey(i => i.VenueId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
