using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LinkUp.Api.Data.Entities;

public sealed class PlanConfiguration : IEntityTypeConfiguration<Plan>
{
    public const int TitleMaxLength = 200;
    public const int SummaryMaxLength = 1000;

    public void Configure(EntityTypeBuilder<Plan> builder)
    {
        builder.ToTable("Plans", table =>
        {
            table.HasCheckConstraint("CK_Plans_EstimatedCostPerPerson", "\"EstimatedCostPerPerson\" >= 0");
            table.HasCheckConstraint("CK_Plans_EstimatedTotalCost", "\"EstimatedTotalCost\" >= 0");
            table.HasCheckConstraint("CK_Plans_TotalDistanceKm", "\"TotalDistanceKm\" >= 0");
        });
        builder.HasKey(p => p.Id);
        builder.HasIndex(p => new { p.UserId, p.SourcePlanId }).IsUnique()
            .HasFilter("\"UserId\" IS NOT NULL AND \"SourcePlanId\" IS NOT NULL");

        builder.Property(p => p.Title).HasMaxLength(TitleMaxLength);
        builder.Property(p => p.Summary).HasMaxLength(SummaryMaxLength);
        builder.Property(p => p.EstimatedCostPerPerson).HasPrecision(8, 2);
        builder.Property(p => p.EstimatedTotalCost).HasPrecision(10, 2);

        // Filled by PostgreSQL if the app doesn't set it.
        builder.Property(p => p.CreatedAt).HasDefaultValueSql("now()");

        // Deleting an account deletes its saved plans
        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(p => p.Items)
            .WithOne()
            .HasForeignKey(i => i.PlanId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
