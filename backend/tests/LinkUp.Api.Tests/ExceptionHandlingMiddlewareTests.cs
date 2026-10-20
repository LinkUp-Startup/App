using System.Text.Json;
using LinkUp.Api.Middleware;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;

namespace LinkUp.Api.Tests;

public sealed class ExceptionHandlingMiddlewareTests
{
    private static ExceptionHandlingMiddleware Create(RequestDelegate next) =>
        new(next, NullLogger<ExceptionHandlingMiddleware>.Instance);

    [Fact]
    public async Task Unhandled_exception_becomes_a_500_problem_details_response()
    {
        var context = new DefaultHttpContext { Response = { Body = new MemoryStream() } };
        var middleware = Create(_ => throw new InvalidOperationException("boom"));

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status500InternalServerError, context.Response.StatusCode);
        Assert.Equal("application/problem+json", context.Response.ContentType);

        context.Response.Body.Position = 0;
        using var body = await JsonDocument.ParseAsync(context.Response.Body);
        Assert.Equal("An unexpected error occurred.", body.RootElement.GetProperty("title").GetString());
        Assert.DoesNotContain("boom", body.RootElement.GetRawText());
    }

    [Fact]
    public async Task Client_disconnect_is_not_reported_as_an_error()
    {
        using var aborted = new CancellationTokenSource();
        await aborted.CancelAsync();
        var context = new DefaultHttpContext { RequestAborted = aborted.Token };
        var middleware = Create(_ => throw new OperationCanceledException());

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
    }

    [Fact]
    public async Task Successful_requests_pass_through()
    {
        var context = new DefaultHttpContext();
        var middleware = Create(ctx =>
        {
            ctx.Response.StatusCode = StatusCodes.Status204NoContent;
            return Task.CompletedTask;
        });

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status204NoContent, context.Response.StatusCode);
    }
}
