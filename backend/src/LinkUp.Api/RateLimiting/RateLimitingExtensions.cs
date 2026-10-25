using System.Globalization;
using System.Threading.RateLimiting;
using LinkUp.Api.Options;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;

namespace LinkUp.Api.RateLimiting;

/// <summary>Marks an endpoint that spends AI credits, so the stricter generation limits apply to it.</summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public sealed class AiGenerationAttribute : Attribute;

public static class RateLimitingExtensions
{
    public static IServiceCollection AddApiRateLimiting(this IServiceCollection services, IConfiguration configuration)
    {
        var settings = configuration.GetSection(RateLimitingOptions.SectionName).Get<RateLimitingOptions>() ?? new();
        System.ComponentModel.DataAnnotations.Validator.ValidateObject(settings, new(settings), validateAllProperties: true);

        // Behind Traefik every request comes from the proxy; take the client IP from X-Forwarded-For, but only
        // when the request really came through a trusted proxy.
        services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            options.KnownIPNetworks.Clear();
            options.KnownProxies.Clear();
            foreach (var network in settings.TrustedProxyNetworks)
                options.KnownIPNetworks.Add(System.Net.IPNetwork.Parse(network));
        });

        services.AddRateLimiter(options =>
        {
            // Every request: per IP per minute.
            var general = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                RateLimitPartition.GetFixedWindowLimiter(ClientIp(context), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = settings.RequestsPerMinute,
                    Window = TimeSpan.FromMinutes(1),
                }));

            // AI endpoints only: per account or guest IP per minute and per hour, and everyone together per day.
            var generationBurst = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                IsAiGeneration(context)
                    ? RateLimitPartition.GetFixedWindowLimiter(Requester(context), _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = settings.GenerationsPerMinute,
                        Window = TimeSpan.FromMinutes(1),
                    })
                    : RateLimitPartition.GetNoLimiter("other"));
            var generationHourly = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                IsAiGeneration(context)
                    ? RateLimitPartition.GetSlidingWindowLimiter(Requester(context), _ => new SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = settings.GenerationsPerHour,
                        Window = TimeSpan.FromHours(1),
                        SegmentsPerWindow = 6,
                    })
                    : RateLimitPartition.GetNoLimiter("other"));
            var generationTotal = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                IsAiGeneration(context)
                    ? RateLimitPartition.GetFixedWindowLimiter("all", _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = settings.GenerationsPerDay,
                        Window = TimeSpan.FromDays(1),
                    })
                    : RateLimitPartition.GetNoLimiter("other"));

            options.GlobalLimiter = PartitionedRateLimiter.CreateChained(
                general, generationBurst, generationHourly, generationTotal);
            options.OnRejected = WriteRejectionAsync;
        });

        return services;
    }

    private static bool IsAiGeneration(HttpContext context) =>
        context.GetEndpoint()?.Metadata.GetMetadata<AiGenerationAttribute>() is not null;

    // Logged-in users count per account, so a room of demo accounts behind one Wi-Fi doesn't share a limit.
    private static string Requester(HttpContext context) =>
        context.User.FindFirst("sub")?.Value is { Length: > 0 } userId ? $"user:{userId}" : $"ip:{ClientIp(context)}";

    // Set by UseForwardedHeaders from X-Forwarded-For when the request came through a trusted proxy.
    private static string ClientIp(HttpContext context) =>
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    private static async ValueTask WriteRejectionAsync(
        Microsoft.AspNetCore.RateLimiting.OnRejectedContext context, CancellationToken cancellationToken)
    {
        var http = context.HttpContext;
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
            http.Response.Headers.RetryAfter = ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString(CultureInfo.InvariantCulture);

        http.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger(typeof(RateLimitingExtensions))
            .LogWarning("Rate limit hit by {ClientIp} on {Method} {Path}", ClientIp(http), http.Request.Method, http.Request.Path);

        http.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await http.Response.WriteAsJsonAsync(
            new ProblemDetails
            {
                Status = StatusCodes.Status429TooManyRequests,
                Title = "Too many requests.",
                Detail = IsAiGeneration(http)
                    ? "Too many plans were requested. Wait a while and try again."
                    : "Too many requests from this device. Wait a while and try again.",
            },
            options: null,
            contentType: "application/problem+json",
            cancellationToken: cancellationToken);
    }
}
