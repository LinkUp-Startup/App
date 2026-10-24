using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LinkUp.Api.Data.Entities;

public sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public const int EmailMaxLength = 254; // RFC 5321 maximum address length
    public const int DisplayNameMaxLength = 50;

    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");
        builder.HasKey(u => u.Id);

        builder.Property(u => u.Email).HasMaxLength(EmailMaxLength);
        builder.HasIndex(u => u.Email).IsUnique();

        builder.Property(u => u.PasswordHash);
        builder.Property(u => u.DisplayName).HasMaxLength(DisplayNameMaxLength);

        // Filled by PostgreSQL if the app doesn't set it.
        builder.Property(u => u.CreatedAt).HasDefaultValueSql("now()");
    }
}
