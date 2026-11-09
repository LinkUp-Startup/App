namespace LinkUp.Api.Dtos;

public static class FriendLimits
{
    public const int SearchMinLength = 2;
    public const int SearchMaxLength = 50;
    public const int MaxSearchResults = 20;
}

// How the signed-in user relates to another user. Declined requests show as None to both sides.
public enum FriendRelation
{
    None,
    Friends,
    RequestSent,
    RequestReceived,
}

// A user found by search. Only the id and the public display name.
public sealed record UserSearchResultDto(Guid Id, string DisplayName, FriendRelation Relation);

public sealed record UserSearchResponse(IReadOnlyList<UserSearchResultDto> Users);

public sealed record FriendDto(Guid UserId, string DisplayName, DateTimeOffset Since);

public sealed record FriendRequestDto(Guid UserId, string DisplayName, DateTimeOffset SentAt);

// Friends (by name), and pending requests received and sent (newest first)
public sealed record FriendsResponse(
    IReadOnlyList<FriendDto> Friends,
    IReadOnlyList<FriendRequestDto> Incoming,
    IReadOnlyList<FriendRequestDto> Outgoing);