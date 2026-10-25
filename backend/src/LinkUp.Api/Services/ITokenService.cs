using LinkUp.Api.Dtos;

namespace LinkUp.Api.Services;

public sealed record AccessToken(string Value, DateTimeOffset ExpiresAt);

public interface ITokenService
{
    AccessToken Create(UserDto user);
}
