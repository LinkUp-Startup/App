using System.Text.Json;

namespace LinkUp.Api.Ai;

/// <param name="Instructions">System-level instructions (the prompt).</param>
/// <param name="Input">The data the instructions apply to.</param>
/// <param name="SchemaName">Name of the JSON schema, e.g. "night_plans".</param>
/// <param name="Schema">JSON schema in OpenAI strict mode: every property required, no additional properties.</param>
public sealed record AiJsonRequest(string Instructions, string Input, string SchemaName, JsonElement Schema);

public sealed record AiJsonResponse(string Json, AiUsage Usage);

public sealed record AiUsage(int InputTokens, int OutputTokens, int ReasoningTokens, TimeSpan Latency);

public class AiException(string message, Exception? innerException = null) : Exception(message, innerException);
