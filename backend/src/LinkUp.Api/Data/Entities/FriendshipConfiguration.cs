using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LinkUp.Api.Data.Entities;

public sealed class FriendshipConfiguration : IEntityTypeConfiguration<Friendship>
{
    public void Configure(EntityTypeBuilder<Friendship> builder)
    {
        builder.ToTable("Friendships", table =>
        {
            // Fixed order also rules out befriending yourself
            table.HasCheckConstraint("CK_Friendships_OrderedPair", "\"UserAId\" < \"UserBId\"");
            table.HasCheckConstraint("CK_Friendships_RequestedBy",
                "\"RequestedById\" = \"UserAId\" OR \"RequestedById\" = \"UserBId\"");
            table.HasCheckConstraint("CK_Friendships_Status",
                "\"Status\" IN ('Pending', 'Accepted', 'Declined')");
            // Answered requests have a response time. Pending ones don't.
            table.HasCheckConstraint("CK_Friendships_RespondedAt",
                "(\"Status\" = 'Pending') = (\"RespondedAt\" IS NULL)");
        });

        builder.HasKey(f => f.Id);

        // One row per pair of users. Also serves lookups by UserAId.
        builder.HasIndex(f => new { f.UserAId, f.UserBId }).IsUnique();
        // Lookups by the other side ("all friendships of user X" checks both columns).
        builder.HasIndex(f => f.UserBId);

        builder.Property(f => f.Status).HasConversion<string>().HasMaxLength(16);

        // Filled by PostgreSQL if the app doesn't set it.
        builder.Property(f => f.CreatedAt).HasDefaultValueSql("now()");
        // PostgreSQL only stores UTC
        builder.Property(f => f.RespondedAt).HasConversion(t => t!.Value.ToUniversalTime(), t => t);

        builder.Ignore(f => f.AddresseeId);

        // Deleting an account deletes its requests and friendships.
        builder.HasOne<User>().WithMany().HasForeignKey(f => f.UserAId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<User>().WithMany().HasForeignKey(f => f.UserBId).OnDelete(DeleteBehavior.Cascade);
    }
}