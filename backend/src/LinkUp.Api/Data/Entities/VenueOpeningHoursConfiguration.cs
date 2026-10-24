using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LinkUp.Api.Data.Entities;

public sealed class VenueOpeningHoursConfiguration : IEntityTypeConfiguration<VenueOpeningHours>
{
    public void Configure(EntityTypeBuilder<VenueOpeningHours> builder)
    {
        builder.ToTable("VenueOpeningHours");
        builder.HasKey(h => h.Id);
    }
}