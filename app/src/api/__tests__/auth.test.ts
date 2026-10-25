import { login, register } from '@/api/auth';
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
