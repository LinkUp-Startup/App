using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LinkUp.Api.Data.Entities;

public sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public const int EmailMaxLength = 254; // RFC 5321 maximum address length
    public const int DisplayNameMaxLength = 50;

    public void Configure(EntityTypeBuilder<User> builder)
    {
        // Match NightPreferencesDto's existing form limits; null leaves a preference unspecified.
        builder.ToTable("users", table =>
        {
            table.HasCheckConstraint("CK_users_DefaultBudgetPerPerson", "CAST(\"DefaultBudgetPerPerson\" AS numeric) BETWEEN 0 AND 500");
            table.HasCheckConstraint("CK_users_DefaultGroupSize", "\"DefaultGroupSize\" BETWEEN 1 AND 20");
            table.HasCheckConstraint("CK_users_DefaultMaxDistanceKm", "\"DefaultMaxDistanceKm\" BETWEEN 0.5 AND 30");
        });
        builder.HasKey(u => u.Id);

        builder.Property(u => u.Email).HasMaxLength(EmailMaxLength);
        builder.HasIndex(u => u.Email).IsUnique();

        builder.Property(u => u.PasswordHash);
        builder.Property(u => u.DisplayName).HasMaxLength(DisplayNameMaxLength);

        builder.Property(u => u.DefaultBudgetPerPerson).HasPrecision(8, 2);
        // EF primitive collections use native integer[] columns with PostgreSQL and JSON with SQLite.
        builder.PrimitiveCollection(u => u.DefaultTransport);
        builder.PrimitiveCollection(u => u.DefaultActivities);

        // Filled by PostgreSQL if the app doesn't set it.
        builder.Property(u => u.CreatedAt).HasDefaultValueSql("now()");
    }
}
