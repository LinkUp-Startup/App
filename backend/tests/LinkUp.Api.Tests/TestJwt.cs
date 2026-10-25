namespace LinkUp.Api.Tests;

/// <summary>Token settings the test API runs with, and that tests use to forge or check tokens.</summary>
public static class TestJwt
{
    public const string SigningKey = "test-only-signing-key-0123456789-abcdefghij";
    public const string Issuer = "linkup-api";
    public const string Audience = "linkup-app";
}
