using Npgsql;

namespace LinkUp.Api.Data;

public static class PostgresConnectionString
{
    /// <summary>
    /// Validates and normalizes the configured connection string.
    /// </summary>
    /// <param name="allowMissing">
    /// Return a placeholder instead of failing when nothing is configured. Only for tooling that starts the
    /// app without using the database (build-time OpenAPI generation).
    /// </param>
    /// <exception cref="InvalidOperationException">Nothing configured and <paramref name="allowMissing"/> is false.</exception>
    public static string Resolve(string? configured, bool allowMissing = false)
    {
        if (!string.IsNullOrWhiteSpace(configured))
            return Normalize(configured);

        if (allowMissing)
            return "Host=localhost";

        throw new InvalidOperationException(
            "Connection string 'Default' is not configured. Set ConnectionStrings__Default (see backend/README.md).");
    }

    /// <summary>
    /// Accepts either an Npgsql connection string (<c>Host=...;Database=...</c>) or a
    /// <c>postgres://user:password@host:port/database</c> URL, as shown by Dokploy, and returns
    /// an Npgsql connection string.
    /// </summary>
    public static string Normalize(string value)
    {
        if (!value.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
            && !value.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
            return value;

        var uri = new Uri(value);
        var userInfo = uri.UserInfo.Split(':', 2);

        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.IsDefaultPort || uri.Port <= 0 ? 5432 : uri.Port,
            Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
            Username = Uri.UnescapeDataString(userInfo[0]),
            Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : null,
        };
        return builder.ConnectionString;
    }
}
