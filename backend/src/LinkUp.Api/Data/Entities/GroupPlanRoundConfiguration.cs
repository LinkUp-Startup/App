using LinkUp.Api.Dtos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LinkUp.Api.Data.Entities;

public sealed class GroupPlanRoundConfiguration : IEntityTypeConfiguration<GroupPlanRound>
{
    public void Configure(EntityTypeBuilder<GroupPlanRound> builder)
    {
        builder.ToTable("GroupPlanRounds", table =>
            table.HasCheckConstraint("CK_GroupPlanRounds_GroupSize",
                $"\"GroupSize\" BETWEEN {PreferenceRules.MinGroupSize} AND {PreferenceRules.MaxGroupSize}"));
        builder.HasKey(r => r.Id);

        // A group's plans, newest first
        builder.HasIndex(r => new { r.GroupId, r.CreatedAt });

        builder.Property(r => r.CreatedAt).HasDefaultValueSql("now()");

        // Deleting a group deletes its rounds and their plans.
        builder.HasOne<Group>().WithMany().HasForeignKey(r => r.GroupId).OnDelete(DeleteBehavior.Cascade);
        // The plans stay when the member who generated them deletes their account.
        builder.HasOne<User>().WithMany().HasForeignKey(r => r.CreatedById).OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(r => r.Plans).WithOne().HasForeignKey(p => p.GroupPlanRoundId).OnDelete(DeleteBehavior.Cascade);
    }
}
