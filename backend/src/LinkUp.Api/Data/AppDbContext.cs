using LinkUp.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace LinkUp.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Venue> Venues => Set<Venue>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Plan> Plans => Set<Plan>();
    public DbSet<Friendship> Friendships => Set<Friendship>();
    public DbSet<Group> Groups => Set<Group>();
    public DbSet<GroupMember> GroupMembers => Set<GroupMember>();
    public DbSet<GroupPlanRound> GroupPlanRounds => Set<GroupPlanRound>();
    public DbSet<GroupPlanVote> GroupPlanVotes => Set<GroupPlanVote>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Entity configurations live next to their entities as IEntityTypeConfiguration<T> classes.
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}