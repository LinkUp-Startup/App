using LinkUp.Api.Dtos;

namespace LinkUp.Api.Services;

public interface IFriendService
{
    // Users whose display name contains the text (case-insensitive), excluding the user
    Task<IReadOnlyList<UserSearchResultDto>> SearchUsersAsync(Guid userId, string query, CancellationToken cancellationToken);

    Task<FriendsResponse> ListAsync(Guid userId, CancellationToken cancellationToken);

    Task<FriendActionResult> SendRequestAsync(Guid userId, Guid otherUserId, CancellationToken cancellationToken);

    // Accepts the pending request otherUserId sent to userId. Only the receiver can.
    Task<FriendActionResult> AcceptAsync(Guid userId, Guid otherUserId, CancellationToken cancellationToken);

    // Declines the pending request otherUserId sent to userId. Only the receiver can.
    Task<FriendActionResult> DeclineAsync(Guid userId, Guid otherUserId, CancellationToken cancellationToken);

    // Removes the friendship, or cancels the user's own pending request. Does nothing otherwise.
    Task RemoveAsync(Guid userId, Guid otherUserId, CancellationToken cancellationToken);
}

public enum FriendActionResult
{
    Done,
    // The token is valid but its account has been deleted
    UnknownAccount,
    UserNotFound,
    CannotBefriendYourself,
    AlreadyFriends,
    // The other user already sent this user a request: accept it instead
    RequestAlreadyReceived,
    NoPendingRequest,
    // Only the user who received a request can accept or decline it
    NotTheReceiver,
    // Both users sent a request at the same moment
    ChangedConcurrently,
}