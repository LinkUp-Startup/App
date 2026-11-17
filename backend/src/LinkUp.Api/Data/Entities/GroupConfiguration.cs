using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LinkUp.Api.Data.Entities;

public sealed class GroupConfiguration : IEntityTypeConfiguration<Group>
{
    public const int NameMaxLength = 60;

    public void Configure(EntityTypeBuilder<Group> builder)
    {
        builder.ToTable("Groups", table =>
            table.HasCheckConstraint("CK_Groups_Name", "length(trim(\"Name\")) > 0"));
        builder.HasKey(g => g.Id);

        builder.Property(g => g.Name).HasMaxLength(NameMaxLength);
        // Filled by PostgreSQL if the app doesn't set it.
        builder.Property(g => g.CreatedAt).HasDefaultValueSql("now()");

        // Deleting a group deletes its memberships.
        builder.HasMany(g => g.Members).WithOne().HasForeignKey(m => m.GroupId).OnDelete(DeleteBehavior.Cascade);
    }
}
