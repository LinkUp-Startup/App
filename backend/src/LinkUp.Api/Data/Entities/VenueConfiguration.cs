using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LinkUp.Api.Data.Entities;

public sealed class VenueConfiguration : IEntityTypeConfiguration<Venue>
{
    public void Configure(EntityTypeBuilder<Venue> builder)
    {
        builder.ToTable("Venues", table =>
        {
            table.HasCheckConstraint("CK_Venues_PriceLevel", "\"PriceLevel\" BETWEEN 1 AND 4");
            table.HasCheckConstraint("CK_Venues_Latitude", "\"Latitude\" BETWEEN -90 AND 90");
            table.HasCheckConstraint("CK_Venues_Longitude", "\"Longitude\" BETWEEN -180 AND 180");
            table.HasCheckConstraint("CK_Venues_EntranceFee", "\"EntranceFee\" IS NULL OR \"EntranceFee\" >= 0");
            table.HasCheckConstraint("CK_Venues_SpendRange",
                "\"MinSpend\" IS NULL OR \"MaxSpend\" IS NULL OR \"MinSpend\" <= \"MaxSpend\"");
        });

        builder.HasKey(v => v.Id);
        builder.Property(v => v.Id).ValueGeneratedNever();   // keep the dataset's ids

        builder.Property(v => v.Name).HasMaxLength(200);
        builder.Property(v => v.Address).HasMaxLength(300);
        builder.Property(v => v.Notes).HasMaxLength(1000);

        // Stored as text ("Restaurant"), so the database is readable and reordering the enum is safe.
        builder.Property(v => v.Category).HasConversion<string>().HasMaxLength(32);
        builder.Property(v => v.EntranceType).HasConversion<string>().HasMaxLength(32);

        builder.Property(v => v.EntranceFee).HasPrecision(8, 2);
        builder.Property(v => v.MinSpend).HasPrecision(8, 2);
        builder.Property(v => v.MaxSpend).HasPrecision(8, 2);

        builder.HasMany(v => v.OpeningHours)
            .WithOne()
            .HasForeignKey(h => h.VenueId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}