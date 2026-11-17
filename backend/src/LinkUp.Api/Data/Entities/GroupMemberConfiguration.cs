using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LinkUp.Api.Data.Entities;

public sealed class GroupMemberConfiguration : IEntityTypeConfiguration<GroupMember>
{
    public void Configure(EntityTypeBuilder<GroupMember> builder)
    {
        builder.ToTable("GroupMembers", table =>
            table.HasCheckConstraint("CK_GroupMembers_Role", "\"Role\" IN ('Owner', 'Member')"));

        // A user is in a group at most once. Also serves lookups by group.
        builder.HasKey(m => new { m.GroupId, m.UserId });
        // "The groups of user X"
        builder.HasIndex(m => m.UserId);
        // At most one owner per group
        builder.HasIndex(m => m.GroupId).IsUnique().HasFilter("\"Role\" = 'Owner'")
            .HasDatabaseName("IX_GroupMembers_GroupId_Owner");

        builder.Property(m => m.Role).HasConversion<string>().HasMaxLength(16);
        builder.Property(m => m.JoinedAt).HasDefaultValueSql("now()");

        // Deleting an account removes it from its groups.
        builder.HasOne<User>().WithMany().HasForeignKey(m => m.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
