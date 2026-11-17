import { ApiError, NetworkError } from '@/api/client';
import { describeFriendError, FriendSearchMinLength } from '@/features/friends/errors';

describe('describeFriendError', () => {
  it('asks to log in again when the session expired', () => {
    expect(describeFriendError(new ApiError(401, ''))).toBe(
      'Your session has expired. Log in again to add friends.',
    );
  });

  it('says the user is gone on 404', () => {
    expect(describeFriendError(new ApiError(404, '{"title":"User not found."}'))).toBe(
      'This user no longer exists.',
    );
  });

  it.each([400, 409])('shows the server title for %i', (status) => {
    const body = JSON.stringify({ title: 'You are already friends.', status });

    expect(describeFriendError(new ApiError(status, body))).toBe('You are already friends.');
  });

  it.each([
    ['an empty body', ''],
    ['a body that is not JSON', '<html>Bad gateway</html>'],
    ['a JSON null body', 'null'],
    ['a title that is not text', '{"title":42}'],
    ['a problem without a title', '{"status":409}'],
  ])('falls back to a generic message for %s', (_, body) => {
    expect(describeFriendError(new ApiError(409, body))).toBe(
      'That didn’t work. Search again and try once more.',
    );
  });

  it('uses the general API messages for other failures', () => {
    expect(describeFriendError(new NetworkError('offline'))).toMatch(/Can't reach LinkUp/);
    expect(describeFriendError(new ApiError(500, ''))).toMatch(/went wrong on our side/);
    expect(describeFriendError(new ApiError(429, ''))).toMatch(/Too many requests/);
    expect(describeFriendError(new Error('boom'))).toMatch(/unexpected/);
  });
});

describe('FriendSearchMinLength', () => {
  it('matches the server limit', () => {
    expect(FriendSearchMinLength).toBe(2);
  });
});
