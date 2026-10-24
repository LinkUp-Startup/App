using LinkUp.Api.Dtos;

namespace LinkUp.Api.Services;

public interface IAuthService
{
    /// <summary>Creates an account. Returns null when the email is already registered.</summary>
    Task<UserDto?> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken);

    /// <summary>Returns the account when the credentials are right, otherwise null.</summary>
    Task<UserDto?> LoginAsync(LoginRequest request, CancellationToken cancellationToken);
}
