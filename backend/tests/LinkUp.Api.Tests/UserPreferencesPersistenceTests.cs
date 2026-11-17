using LinkUp.Api.Data;
using LinkUp.Api.Data.Entities;
using LinkUp.Api.Dtos;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace LinkUp.Api.Tests;

// The same persistence contract runs against SQLite and the actual PostgreSQL migrations.
public abstract class UserPreferencesPersistenceContract
{
    protected abstract Task WithDb(Func<AppDbContext, Task> action);

    protected static User NewUser() => new()
    {
        Id = Guid.NewGuid(), Email = $"{Guid.NewGuid():N}@example.com",
        PasswordHash = "existing-hash", DisplayName = "Preferences test", CreatedAt = DateTimeOffset.UtcNow,
    };

    protected static void AssertUnspecified(User user)
    {
        Assert.Null(user.DefaultBudgetPerPerson);
        Assert.Null(user.DefaultGroupSize);
        Assert.Null(user.DefaultMaxDistanceKm);
        Assert.Null(user.DefaultTransport);
        Assert.Null(user.DefaultActivities);
    }

    [Theory]
    [InlineData(nameof(User.DefaultBudgetPerPerson))]
    [InlineData(nameof(User.DefaultGroupSize))]
    [InlineData(nameof(User.DefaultMaxDistanceKm))]
    [InlineData(nameof(User.DefaultTransport))]
    [InlineData(nameof(User.DefaultActivities))]
    public Task Each_default_can_be_saved_and_cleared_without_setting_other_defaults(string field) => WithDb(async db =>
    {
        var user = NewUser();
        object value = field switch
        {
            nameof(User.DefaultBudgetPerPerson) => 12.34m,
            nameof(User.DefaultGroupSize) => 3,
            nameof(User.DefaultMaxDistanceKm) => 2.75,
            nameof(User.DefaultTransport) => new[] { Transport.Bike, Transport.Taxi },
            nameof(User.DefaultActivities) => new[] { Activity.Dinner, Activity.Cinema },
            _ => throw new ArgumentOutOfRangeException(nameof(field)),
        };
        var property = typeof(User).GetProperty(field)!;
        property.SetValue(user, value);
        db.Users.Add(user);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var saved = await db.Users.SingleAsync(u => u.Id == user.Id);
        Assert.Equal(value, property.GetValue(saved));
        property.SetValue(saved, null);
        // Every other field must still be unspecified after independently saving this one.
        AssertUnspecified(saved);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        AssertUnspecified(await db.Users.SingleAsync(u => u.Id == user.Id));
    });

    [Fact]
    public Task User_without_preferences_remains_valid() => WithDb(async db =>
    {
        var user = NewUser();
        AssertUnspecified(user);
        db.Users.Add(user);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var saved = await db.Users.SingleAsync(u => u.Id == user.Id);
        AssertUnspecified(saved);
        Assert.Equal(user.Email, saved.Email);
        Assert.Equal(user.PasswordHash, saved.PasswordHash);
        Assert.Equal(user.DisplayName, saved.DisplayName);
    });

    [Theory]
    [InlineData(0, 1, 0.5)]
    [InlineData(25.75, 4, 5.25)]
    [InlineData(500, 20, 30)]
    public Task All_preferences_round_trip_and_fit_the_plan_model(decimal budget, int size, double radius) => WithDb(async db =>
    {
        var user = NewUser();
        user.DefaultBudgetPerPerson = budget;
        user.DefaultGroupSize = size;
        user.DefaultMaxDistanceKm = radius;
        user.DefaultTransport = Enum.GetValues<Transport>();
        user.DefaultActivities = Enum.GetValues<Activity>();
        db.Users.Add(user);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var saved = await db.Users.AsNoTracking().SingleAsync(u => u.Id == user.Id);
        Assert.Equal(budget, saved.DefaultBudgetPerPerson);
        Assert.Equal(size, saved.DefaultGroupSize);
        Assert.Equal(radius, saved.DefaultMaxDistanceKm);
        Assert.Equal(user.DefaultTransport, saved.DefaultTransport);
        Assert.Equal(user.DefaultActivities, saved.DefaultActivities);

        var start = DateTimeOffset.UtcNow;
        var plan = new NightPreferencesDto(saved.DefaultBudgetPerPerson!.Value, saved.DefaultGroupSize!.Value,
            saved.DefaultActivities!, start, start.AddHours(3), saved.DefaultMaxDistanceKm!.Value, saved.DefaultTransport!);
        var results = new List<System.ComponentModel.DataAnnotations.ValidationResult>();
        Assert.True(System.ComponentModel.DataAnnotations.Validator.TryValidateObject(plan,
            new System.ComponentModel.DataAnnotations.ValidationContext(plan), results, true));
    });

    [Fact]
    public Task Updates_and_in_place_collection_changes_are_persisted_independently() => WithDb(async db =>
    {
        var first = NewUser();
        var second = NewUser();
        first.DefaultBudgetPerPerson = 0;
        first.DefaultActivities = [Activity.Dinner, Activity.Drinks];
        first.DefaultTransport = [Transport.Walking, Transport.Bike];
        second.DefaultBudgetPerPerson = 100;
        second.DefaultGroupSize = 10;
        second.DefaultMaxDistanceKm = 20;
        second.DefaultActivities = [Activity.Cinema];
        second.DefaultTransport = [Transport.Car];
        db.Users.AddRange(first, second);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var saved = await db.Users.SingleAsync(u => u.Id == first.Id);
        saved.DefaultBudgetPerPerson = 12.34m;
        saved.DefaultGroupSize = 3;
        saved.DefaultMaxDistanceKm = 2;
        saved.DefaultActivities![0] = Activity.Outdoor;
        saved.DefaultTransport![0] = Transport.Taxi;
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        saved = await db.Users.SingleAsync(u => u.Id == first.Id);
        Assert.Equal(12.34m, saved.DefaultBudgetPerPerson);
        Assert.Equal(3, saved.DefaultGroupSize);
        Assert.Equal(2, saved.DefaultMaxDistanceKm);
        Assert.Equal([Activity.Outdoor, Activity.Drinks], saved.DefaultActivities);
        Assert.Equal([Transport.Taxi, Transport.Bike], saved.DefaultTransport);
        var other = await db.Users.SingleAsync(u => u.Id == second.Id);
        Assert.Equal(100m, other.DefaultBudgetPerPerson);
        Assert.Equal(10, other.DefaultGroupSize);
        Assert.Equal(20, other.DefaultMaxDistanceKm);
        Assert.Equal([Activity.Cinema], other.DefaultActivities);
        Assert.Equal([Transport.Car], other.DefaultTransport);
    });

    [Fact]
    public Task Optional_preferences_can_be_cleared_and_empty_collections_round_trip() => WithDb(async db =>
    {
        var user = NewUser();
        user.DefaultBudgetPerPerson = 10;
        user.DefaultGroupSize = 2;
        user.DefaultMaxDistanceKm = 1;
        user.DefaultActivities = [Activity.Dinner];
        user.DefaultTransport = [Transport.Car];
        db.Users.Add(user);
        await db.SaveChangesAsync();
        user.DefaultActivities = [];
        user.DefaultTransport = [];
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        user = await db.Users.SingleAsync(u => u.Id == user.Id);
        Assert.Empty(user.DefaultActivities!);
        Assert.Empty(user.DefaultTransport!);
        user.DefaultBudgetPerPerson = null;
        user.DefaultGroupSize = null;
        user.DefaultMaxDistanceKm = null;
        user.DefaultActivities = null;
        user.DefaultTransport = null;
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        AssertUnspecified(await db.Users.SingleAsync(u => u.Id == user.Id));
    });

    [Theory]
    [InlineData(-1.0, null, null)]
    [InlineData(501.0, null, null)]
    [InlineData(null, 0, null)]
    [InlineData(null, -1, null)]
    [InlineData(null, 21, null)]
    [InlineData(null, null, -1.0)]
    [InlineData(null, null, 0.0)]
    [InlineData(null, null, 0.49)]
    [InlineData(null, null, 30.01)]
    [InlineData(null, null, double.NaN)]
    [InlineData(null, null, double.PositiveInfinity)]
    [InlineData(null, null, double.NegativeInfinity)]
    public Task Database_rejects_values_outside_existing_planning_limits(double? budget, int? size, double? radius) => WithDb(async db =>
    {
        var user = NewUser();
        user.DefaultBudgetPerPerson = (decimal?)budget;
        user.DefaultGroupSize = size;
        user.DefaultMaxDistanceKm = radius;
        db.Users.Add(user);
        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    });
}

public sealed class UserPreferencesPersistenceTests : UserPreferencesPersistenceContract, IAsyncLifetime
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private AppDbContext CreateContext() => new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options);

    public async Task InitializeAsync()
    {
        await _connection.OpenAsync();
        await using var db = CreateContext();
        await db.Database.EnsureCreatedAsync();
    }

    public Task DisposeAsync() => _connection.DisposeAsync().AsTask();

    protected override async Task WithDb(Func<AppDbContext, Task> action)
    {
        await using var db = CreateContext();
        await action(db);
    }
}

public sealed class UserPreferencesPostgresTests(AuthApiFactory factory)
    : UserPreferencesPersistenceContract, IClassFixture<AuthApiFactory>
{
    [Fact]
    public async Task Preferences_survive_a_new_context_and_connection()
    {
        var user = NewUser();
        user.DefaultBudgetPerPerson = 42.50m;
        user.DefaultActivities = [Activity.Dinner, Activity.Games];
        user.DefaultTransport = [Transport.Bike, Transport.PublicTransport];
        await factory.WithDbAsync(async db =>
        {
            db.Users.Add(user);
            return await db.SaveChangesAsync();
        });
        await using var restarted = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(factory.TestConnectionString).Options);
        var saved = await restarted.Users.SingleAsync(u => u.Id == user.Id);
        Assert.Equal(42.50m, saved.DefaultBudgetPerPerson);
        Assert.Equal(user.DefaultActivities, saved.DefaultActivities);
        Assert.Equal(user.DefaultTransport, saved.DefaultTransport);
    }

    protected override Task WithDb(Func<AppDbContext, Task> action) => factory.WithDbAsync(async db =>
    {
        await using var transaction = await db.Database.BeginTransactionAsync();
        await action(db);
        return 0;
    });
}

public sealed class UserPreferencesMigrationTests
{
    [Fact]
    public async Task Upgrade_preserves_existing_accounts_with_unspecified_preferences()
    {
        using var factory = new AuthApiFactory();
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(factory.TestConnectionString).Options;
        var id = Guid.NewGuid();
        await using (var old = new AppDbContext(options))
        {
            var migrations = old.Database.GetMigrations().ToList();
            var target = migrations.FindIndex(m => m.EndsWith("_AddUserDefaultPreferences"));
            Assert.True(target > 0);
            await old.GetService<IMigrator>().MigrateAsync(migrations[target - 1]);
            await old.Database.ExecuteSqlAsync($"""
                INSERT INTO users ("Id", "Email", "PasswordHash", "DisplayName")
                VALUES ({id}, 'existing@example.com', 'existing-hash', 'Existing');
                """);
        }

        // Startup applies the real migration only to this factory's disposable database.
        await factory.WithDbAsync(async db =>
        {
            Assert.Empty(await db.Database.GetPendingMigrationsAsync());
            var user = await db.Users.SingleAsync(u => u.Id == id);
            Assert.Equal("existing@example.com", user.Email);
            Assert.Equal("existing-hash", user.PasswordHash);
            Assert.Equal("Existing", user.DisplayName);
            Assert.Null(user.DefaultBudgetPerPerson);
            Assert.Null(user.DefaultGroupSize);
            Assert.Null(user.DefaultMaxDistanceKm);
            Assert.Null(user.DefaultActivities);
            Assert.Null(user.DefaultTransport);
            user.DefaultBudgetPerPerson = 0m;
            user.DefaultActivities = [Activity.Dinner];
            await db.SaveChangesAsync();
            db.ChangeTracker.Clear();
            Assert.Equal(0m, (await db.Users.SingleAsync(u => u.Id == id)).DefaultBudgetPerPerson);
            return 0;
        });
    }
}
