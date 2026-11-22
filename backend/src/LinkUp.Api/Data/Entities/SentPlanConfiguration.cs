using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LinkUp.Api.Data.Entities;

public sealed class SentPlanConfiguration : IEntityTypeConfiguration<SentPlan>
{
    public void Configure(EntityTypeBuilder<SentPlan> builder)
    {
        builder.ToTable("SentPlans", table =>
            table.HasCheckConstraint("CK_SentPlans_NotToSelf", "\"SenderId\" IS NULL OR \"SenderId\" <> \"RecipientId\""));
        builder.HasKey(s => s.Id);

        // A user's received plans, newest first
        builder.HasIndex(s => new { s.RecipientId, s.SentAt });

        // PostgreSQL only stores UTC
        builder.Property(s => s.SentAt).HasConversion(t => t.ToUniversalTime(), t => t);

        // Deleting the recipient's account deletes what they received; the sender's only forgets who sent it.
        builder.HasOne<User>().WithMany().HasForeignKey(s => s.RecipientId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<User>().WithMany().HasForeignKey(s => s.SenderId).OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(s => s.Plan).WithOne().HasForeignKey<Plan>(p => p.SentPlanId).OnDelete(DeleteBehavior.Cascade);
    }
}
