namespace LinkUp.Api.Ai;

public interface IAiClient
{
    /// <summary>
    /// Sends a prompt and returns the model's JSON, which follows <see cref="AiJsonRequest.Schema"/>.
    /// Throws <see cref="AiException"/> when the API fails, refuses or returns incomplete output.
    /// </summary>
    Task<AiJsonResponse> CompleteJsonAsync(AiJsonRequest request, CancellationToken cancellationToken);
}
