using System.Diagnostics.CodeAnalysis;
using System.Text.Json;

namespace LinkUp.Api.Planning;

/// <summary>
/// The JSON the AI must return, enforced with OpenAI Structured Outputs (strict), and its parser (issue #66).
/// Strict mode requires every property to be listed in "required" and "additionalProperties": false.
/// Limits like "2 or 3 plans" are left to <see cref="PlanValidator"/>, which repairs instead of rejecting.
/// </summary>
public static class PlanSchema
{
    public const string Name = "night_plans";

    public static readonly JsonElement Schema = JsonDocument.Parse("""
        {
          "type": "object",
          "properties": {
            "plans": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "title": { "type": "string" },
                  "summary": { "type": "string" },
                  "stops": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "venueId": { "type": "integer", "description": "id of a venue from the input" },
                        "startTime": { "type": "string", "description": "ISO 8601 with offset" },
                        "endTime": { "type": "string", "description": "ISO 8601 with offset" }
                      },
                      "required": ["venueId", "startTime", "endTime"],
                      "additionalProperties": false
                    }
                  }
                },
                "required": ["title", "summary", "stops"],
                "additionalProperties": false
              }
            }
          },
          "required": ["plans"],
          "additionalProperties": false
        }
        """).RootElement.Clone();

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>Parses the AI's JSON. Returns false with a reason instead of throwing when it doesn't match.</summary>
    public static bool TryParse(
        string json, [NotNullWhen(true)] out IReadOnlyList<AiPlan>? plans, [NotNullWhen(false)] out string? error)
    {
        plans = null;
        try
        {
            var result = JsonSerializer.Deserialize<AiPlansResult>(json, Json);
            if (result?.Plans is null)
            {
                error = "The response has no \"plans\" array.";
                return false;
            }

            plans = result.Plans;
            error = null;
            return true;
        }
        catch (JsonException ex)
        {
            error = $"The response is not valid plan JSON: {ex.Message}";
            return false;
        }
    }

    private sealed record AiPlansResult(IReadOnlyList<AiPlan>? Plans);
}

/// <summary>A plan as the AI returned it: unchecked, see <see cref="PlanValidator"/>.</summary>
public sealed record AiPlan(string? Title, string? Summary, IReadOnlyList<AiStop>? Stops);

/// <summary>Times are kept as text so one malformed time drops one stop, not the whole response.</summary>
public sealed record AiStop(int VenueId, string? StartTime, string? EndTime);
