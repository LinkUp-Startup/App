using LinkUp.Api.Data;
using Npgsql;

namespace LinkUp.Api.Tests;

public sealed class PostgresConnectionStringTests
{
    [Fact]
    public void Npgsql_format_is_returned_unchanged()
    {
        const string value = "Host=localhost;Port=5432;Database=linkup;Username=linkup;Password=linkup";

        Assert.Equal(value, PostgresConnectionString.Normalize(value));
    }

    [Theory]
    [InlineData("postgresql://user:secret@db.example.com:5431/project_dev")]
    [InlineData("postgres://user:secret@db.example.com:5431/project_dev")]
    [InlineData("POSTGRESQL://user:secret@db.example.com:5431/project_dev")]
    public void Url_format_is_converted(string url)
    {
        var builder = new NpgsqlConnectionStringBuilder(PostgresConnectionString.Normalize(url));

        Assert.Equal("db.example.com", builder.Host);
        Assert.Equal(5431, builder.Port);
        Assert.Equal("project_dev", builder.Database);
        Assert.Equal("user", builder.Username);
        Assert.Equal("secret", builder.Password);
    }

    [Fact]
    public void Url_without_port_uses_the_postgres_default()
    {
        var builder = new NpgsqlConnectionStringBuilder(
            PostgresConnectionString.Normalize("postgresql://user:secret@db.example.com/linkup"));

        Assert.Equal(5432, builder.Port);
    }

    [Fact]
    public void Url_encoded_credentials_are_decoded()
    {
        var builder = new NpgsqlConnectionStringBuilder(
            PostgresConnectionString.Normalize("postgresql://us%40er:p%3Ass%2Fword@localhost:5432/linkup"));

        Assert.Equal("us@er", builder.Username);
        Assert.Equal("p:ss/word", builder.Password);
    }

    [Fact]
    public void Url_without_password_has_no_password()
    {
        var builder = new NpgsqlConnectionStringBuilder(
            PostgresConnectionString.Normalize("postgresql://user@localhost:5432/linkup"));

        Assert.Equal("user", builder.Username);
        Assert.Null(builder.Password);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Resolve_fails_when_nothing_is_configured(string? configured)
    {
        var error = Assert.Throws<InvalidOperationException>(() => PostgresConnectionString.Resolve(configured));
        Assert.Contains("ConnectionStrings__Default", error.Message);
    }

    [Fact]
    public void Resolve_returns_a_placeholder_when_missing_is_allowed()
    {
        Assert.Equal("Host=localhost", PostgresConnectionString.Resolve(null, allowMissing: true));
    }

    [Fact]
    public void Resolve_normalizes_a_configured_url()
    {
        var builder = new NpgsqlConnectionStringBuilder(
            PostgresConnectionString.Resolve("postgresql://user:secret@db:5431/project_dev"));

        Assert.Equal("project_dev", builder.Database);
    }
}
