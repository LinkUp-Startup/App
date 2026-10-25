import { getMe, login, register } from '@/api/auth';
import { apiRequest } from '@/api/client';

jest.mock('@/api/client', () => ({ apiRequest: jest.fn() }));

describe('auth endpoints', () => {
  afterEach(() => jest.mocked(apiRequest).mockReset());

  it('register posts the details to /api/auth/register', async () => {
    const request = {
      email: 'ann@example.com',
      password: 'correct-horse-battery',
      displayName: 'Ann',
    };

    await register(request);

    expect(apiRequest).toHaveBeenCalledWith('/api/auth/register', {
      method: 'POST',
      body: request,
      signal: undefined,
    });
  });

  it('login posts the credentials to /api/auth/login', async () => {
    const request = { email: 'ann@example.com', password: 'correct-horse-battery' };
    const controller = new AbortController();

    await login(request, controller.signal);

    expect(apiRequest).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      body: request,
      signal: controller.signal,
    });
  });

  it('getMe asks /api/auth/me for the account, sending the token as a bearer token', async () => {
    const controller = new AbortController();

    await getMe('the-token', controller.signal);

    expect(apiRequest).toHaveBeenCalledWith('/api/auth/me', {
      headers: { Authorization: 'Bearer the-token' },
      signal: controller.signal,
    });
  });

  it('getMe does not use a request body or change the method', async () => {
    await getMe('the-token');

    const [, options] = jest.mocked(apiRequest).mock.calls[0];
    expect(options).not.toHaveProperty('method');
    expect(options).not.toHaveProperty('body');
  });

  it('returns what the API answered', async () => {
    const response = {
      accessToken: 'token',
      expiresAt: '2026-10-30T20:00:00Z',
      user: { id: 'id', email: 'ann@example.com', displayName: 'Ann' },
    };
    jest.mocked(apiRequest).mockResolvedValue(response);

    await expect(login({ email: 'ann@example.com', password: 'x' })).resolves.toEqual(response);
  });
});
