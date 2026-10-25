using LinkUp.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace LinkUp.Api.Tests;

// Native numeric scale and constraints require PostgreSQL (provided by CI).
public sealed class VenuePricePostgresTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>
{
    [Fact]
    public async Task Native_numeric_rounds_to_cents_and_preserves_unknown_prices()
    {
        await factory.WithDbAsync(async db =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync();
            db.Venues.AddRange(
                new Venue
                {
                    Id = 9001, Name = "Priced", Address = "Test address", PriceLevel = 2,
                    EntranceFee = 4.255m, MinSpend = 10.255m, MaxSpend = 20.755m,
                },
                new Venue { Id = 9002, Name = "Unknown", Address = "Test address" });
            await db.SaveChangesAsync();
            db.ChangeTracker.Clear();

            var priced = await db.Venues.AsNoTracking().SingleAsync(v => v.Id == 9001);
            Assert.Equal(4.26m, priced.EntranceFee);
            Assert.Equal(10.26m, priced.MinSpend);
            Assert.Equal(20.76m, priced.MaxSpend);
            Assert.Equal(15.51m, priced.EstimatedSpendPerPerson);
            var unknown = await db.Venues.AsNoTracking().SingleAsync(v => v.Id == 9002);
            Assert.Null(unknown.MinSpend);
            Assert.Null(unknown.MaxSpend);
            Assert.Null(unknown.EntranceFee);
            Assert.Null(unknown.PriceLevel);
            Assert.Null(unknown.EstimatedSpendPerPerson);
            return 0; // Transaction disposal rolls back test rows.
        });
    }

    [Theory]
    [InlineData(true, "CK_Venues_MinSpend")]
    [InlineData(false, "CK_Venues_MaxSpend")]
    public async Task Native_database_rejects_negative_spend(bool minimum, string constraint)
    {
        await factory.WithDbAsync(async db =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync();
            db.Venues.Add(new Venue
            {
                Id = 9001, Name = "Invalid", Address = "Test address",
                MinSpend = minimum ? -0.01m : null,
                MaxSpend = minimum ? null : -0.01m,
            });

            var error = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());

            var postgres = Assert.IsType<PostgresException>(error.InnerException);
            Assert.Equal(PostgresErrorCodes.CheckViolation, postgres.SqlState);
            Assert.Equal(constraint, postgres.ConstraintName);
            return 0;
        });
    }
}
