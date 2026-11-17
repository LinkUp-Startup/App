namespace LinkUp.Api.Middleware;

/// <summary>
/// Security headers on every response (#186, from the OWASP ZAP scan). The API only returns JSON, so it allows
/// nothing to load, run or frame it. Set when the response starts, so error and rate-limit responses get them too.
/// </summary>
public sealed class SecurityHeadersMiddleware(RequestDelegate next, IHostEnvironment environment)
{
    // HTTPS only from now on, for a year. Not in development, which runs on plain HTTP.
    private const string StrictTransportSecurity = "max-age=31536000; includeSubDomains";

    public Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;
            headers.XContentTypeOptions = "nosniff";
            headers.XFrameOptions = "DENY";
            headers["Referrer-Policy"] = "no-referrer";
            headers["Cross-Origin-Resource-Policy"] = "same-origin";
            // Swagger UI (development only) needs its own scripts and styles; everything else is JSON.
            if (!context.Request.Path.StartsWithSegments("/swagger"))
                headers.ContentSecurityPolicy = "default-src 'none'; frame-ancestors 'none'";
            if (!environment.IsDevelopment())
                headers.StrictTransportSecurity = StrictTransportSecurity;
            return Task.CompletedTask;
        });
        return next(context);
    }
}
