using System.Net.Http.Headers;
using LinkUp.Api.Options;
using Microsoft.Extensions.Http.Resilience;
using Microsoft.Extensions.Options;

namespace LinkUp.Api.Ai;

public static class AiServiceCollectionExtensions
{
    /// <summary>Registers <see cref="IAiClient"/> as a typed HttpClient with timeouts and retries (issue #64).</summary>
    public static IServiceCollection AddAiClient(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<AiOptions>()
            .Bind(configuration.GetSection(AiOptions.SectionName))
            .ValidateDataAnnotations()
            .Validate(o => o.TotalTimeoutSeconds > o.AttemptTimeoutSeconds,
                "Ai:TotalTimeoutSeconds must be greater than Ai:AttemptTimeoutSeconds.")
            .ValidateOnStart();

        services.AddHttpClient<IAiClient, OpenAiClient>((provider, client) =>
            {
                var settings = provider.GetRequiredService<IOptions<AiOptions>>().Value;
                client.BaseAddress = settings.BaseUrl;
                client.Timeout = Timeout.InfiniteTimeSpan; // the resilience handler owns timeouts
                if (settings.IsConfigured)
                    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", settings.ApiKey);
            })
            .AddStandardResilienceHandler()
            .Configure((HttpStandardResilienceOptions resilience, IServiceProvider provider) =>
            {
                var settings = provider.GetRequiredService<IOptions<AiOptions>>().Value;
                resilience.AttemptTimeout.Timeout = TimeSpan.FromSeconds(settings.AttemptTimeoutSeconds);
                resilience.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(settings.TotalTimeoutSeconds);
                // Generation requests change nothing on OpenAI's side, so retrying a POST is safe.
                resilience.Retry.MaxRetryAttempts = settings.MaxRetries;
                resilience.Retry.Delay = TimeSpan.FromSeconds(settings.RetryDelaySeconds);
                // Polly requires the sampling window to be at least twice the attempt timeout.
                resilience.CircuitBreaker.SamplingDuration = resilience.AttemptTimeout.Timeout * 2;
            });

        return services;
    }
}
