using System.ComponentModel.DataAnnotations;

namespace LinkUp.Api.Options;

/// <summary>The external LLM that combines venues into plans (OpenAI GPT-6 Luna, see the Sprint 0 documentation).</summary>
public sealed class AiOptions
{
    public const string SectionName = "Ai";

    /// <summary>
    /// OpenAI API key. Never commit it and never send it to the app: set the Ai__ApiKey environment variable on
    /// the server, or user-secrets locally. Without a key the API runs without AI.
    /// </summary>
    public string? ApiKey { get; init; }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ApiKey);

    [Required]
    public Uri BaseUrl { get; init; } = new("https://api.openai.com/v1/");

    [Required]
    public string Model { get; init; } = "gpt-6-luna";

    /// <summary>none, low, medium, high, xhigh or max. Higher costs more output tokens and time.</summary>
    [Required, RegularExpression("^(none|low|medium|high|xhigh|max)$")]
    public string ReasoningEffort { get; init; } = "low";

    /// <summary>Caps the cost of one request. Reasoning tokens count towards it.</summary>
    [Range(256, 32_000)]
    public int MaxOutputTokens { get; init; } = 4000;

    /// <summary>One attempt. The app gives up after 60 s, so attempts and retries stay under that in total.</summary>
    [Range(1, 300)]
    public double AttemptTimeoutSeconds { get; init; } = 25;

    [Range(1, 300)]
    public double TotalTimeoutSeconds { get; init; } = 55;

    /// <summary>Retries on 429, 5xx and timeouts.</summary>
    [Range(0, 5)]
    public int MaxRetries { get; init; } = 2;

    [Range(0, 60)]
    public double RetryDelaySeconds { get; init; } = 1;

    /// <summary>List prices in USD per 1M tokens, only used to log an estimated cost per request.</summary>
    [Range(0, 1000)]
    public decimal InputPricePerMillionTokens { get; init; } = 0.10m;

    [Range(0, 1000)]
    public decimal OutputPricePerMillionTokens { get; init; } = 0.50m;
}
