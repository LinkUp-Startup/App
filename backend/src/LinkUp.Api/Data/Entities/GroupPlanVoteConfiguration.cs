using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LinkUp.Api.Data.Entities;

public sealed class GroupPlanVoteConfiguration : IEntityTypeConfiguration<GroupPlanVote>
{
    public void Configure(EntityTypeBuilder<GroupPlanVote> builder)
    {
        builder.ToTable("GroupPlanVotes", table =>
            table.HasCheckConstraint("CK_GroupPlanVotes_UpdatedAt", "\"UpdatedAt\" >= \"CreatedAt\""));

        // One vote per member per round. Also serves "the votes of round X".
        builder.HasKey(v => new { v.GroupPlanRoundId, v.UserId });
        // "The votes for plan X": the count per plan
        builder.HasIndex(v => v.PlanId);
        // "The votes of user X": removing an account removes its votes
        builder.HasIndex(v => v.UserId);

        builder.Property(v => v.CreatedAt).HasDefaultValueSql("now()");
        builder.Property(v => v.UpdatedAt).HasDefaultValueSql("now()");

        // The votes go with their round, with the plan voted for and with the account that cast them.
        builder.HasOne<GroupPlanRound>().WithMany().HasForeignKey(v => v.GroupPlanRoundId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<Plan>().WithMany().HasForeignKey(v => v.PlanId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<User>().WithMany().HasForeignKey(v => v.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
