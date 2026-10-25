import { ApiError, NetworkError } from '@/api/client';
import { describeAuthError } from '@/features/auth/errors';

describe('describeAuthError', () => {
  it('explains a network failure', () => {
    expect(describeAuthError(new NetworkError('timed out'), 'login')).toMatch(
      /can't reach linkup/i,
    );
    expect(describeAuthError(new NetworkError('timed out'), 'register')).toMatch(
      /can't reach linkup/i,
    );
  });

  it('says "wrong email or password" for a failed login, without saying which', () => {
    const message = describeAuthError(new ApiError(401, 'Unauthorized'), 'login');
    expect(message).toBe('Wrong email or password.');
  });

  it('does not treat a 401 while registering as a wrong password', () => {
    expect(describeAuthError(new ApiError(401, ''), 'register')).not.toMatch(/wrong email/i);
  });

  it('points to logging in when the email is already registered', () => {
    expect(describeAuthError(new ApiError(409, ''), 'register')).toMatch(
      /already exists.*logging in/i,
    );
  });

  it('lists the details the server rejected', () => {
    const body = JSON.stringify({
      title: 'One or more validation errors occurred.',
      errors: {
        Email: ['The Email field is not a valid e-mail address.'],
        Password: ['Too short.'],
      },
    });

    const message = describeAuthError(new ApiError(400, body), 'register');

    expect(message).toContain('The Email field is not a valid e-mail address.');
    expect(message).toContain('Too short.');
  });

  it('still gives a message when a 400 body cannot be read', () => {
    expect(describeAuthError(new ApiError(400, 'not json'), 'login')).toMatch(/weren't accepted/i);
  });

  it('blames the server for 5xx errors', () => {
    expect(describeAuthError(new ApiError(503, ''), 'login')).toMatch(/our side/i);
  });

  it('has a fallback for anything else', () => {
    expect(describeAuthError(new ApiError(404, ''), 'login')).toMatch(/unexpected/i);
    expect(describeAuthError('boom', 'login')).toMatch(/unexpected/i);
  });
});
