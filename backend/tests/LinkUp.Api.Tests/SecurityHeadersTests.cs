using System.Net;
using LinkUp.Api.Middleware;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Hosting.Internal;

namespace LinkUp.Api.Tests;

// From the OWASP ZAP scan (#186): every API response carries security headers, errors included.
public sealed class SecurityHeadersTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Theory]
    [InlineData("/health", HttpStatusCode.OK)]
    [InlineData("/api/saved-plans", HttpStatusCode.Unauthorized)]
    [InlineData("/does-not-exist", HttpStatusCode.NotFound)]
    public async Task Every_response_has_the_security_headers(string path, HttpStatusCode status)
    {
        using var response = await factory.CreateClient().GetAsync(path);

        Assert.Equal(status, response.StatusCode);
        Assert.Equal("nosniff", Header(response, "X-Content-Type-Options"));
        Assert.Equal("DENY", Header(response, "X-Frame-Options"));
        Assert.Equal("no-referrer", Header(response, "Referrer-Policy"));
        Assert.Equal("same-origin", Header(response, "Cross-Origin-Resource-Policy"));
        Assert.Equal("default-src 'none'; frame-ancestors 'none'", Header(response, "Content-Security-Policy"));
        // Outside development (tests run as "Testing") browsers are told to use HTTPS only.
        Assert.Equal("max-age=31536000; includeSubDomains", Header(response, "Strict-Transport-Security"));
        Assert.False(response.Headers.Contains("Server"));
    }

    [Theory]
    [InlineData("Development", "/health", false, true)]
    [InlineData("Development", "/swagger/index.html", false, false)]
    [InlineData("Production", "/health", true, true)]
    public async Task Https_only_and_the_content_policy_depend_on_where_it_runs(
        string environmentName, string path, bool expectHsts, bool expectCsp)
    {
        var environment = new HostingEnvironment { EnvironmentName = environmentName };
        var middleware = new SecurityHeadersMiddleware(_ => Task.CompletedTask, environment);
        var feature = new StartingResponseFeature();
        var context = new DefaultHttpContext();
        context.Features.Set<Microsoft.AspNetCore.Http.Features.IHttpResponseFeature>(feature);
        context.Request.Path = path;

        await middleware.InvokeAsync(context);
        await feature.StartAsync();

        Assert.Equal(expectHsts, context.Response.Headers.ContainsKey("Strict-Transport-Security"));
        Assert.Equal(expectCsp, context.Response.Headers.ContainsKey("Content-Security-Policy"));
        Assert.Equal("nosniff", context.Response.Headers.XContentTypeOptions);
    }

    private static string? Header(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues(name, out var values) ? string.Join(",", values)
        : response.Content.Headers.TryGetValues(name, out var content) ? string.Join(",", content)
        : null;

    // DefaultHttpContext never "starts" its response; this one runs the OnStarting callbacks when asked.
    private sealed class StartingResponseFeature : Microsoft.AspNetCore.Http.Features.HttpResponseFeature
    {
        private readonly List<(Func<object, Task> Callback, object State)> _starting = [];

        public override void OnStarting(Func<object, Task> callback, object state) => _starting.Add((callback, state));

        public async Task StartAsync()
        {
            foreach (var (callback, state) in _starting) await callback(state);
        }
    }
}
