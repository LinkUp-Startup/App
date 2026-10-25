import { apiRequest } from '@/api/client';
import type { AuthResponse, LoginRequest, RegisterRequest, User } from '@/types/api';

export function register(request: RegisterRequest, signal?: AbortSignal) {
  return apiRequest<AuthResponse>('/api/auth/register', { method: 'POST', body: request, signal });
}

export function login(request: LoginRequest, signal?: AbortSignal) {
  return apiRequest<AuthResponse>('/api/auth/login', { method: 'POST', body: request, signal });
}

/** The account a token belongs to. A 401 means the token is expired, invalid, or its account is gone. */
export function getMe(accessToken: string, signal?: AbortSignal) {
  return apiRequest<User>('/api/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal,
  });
}
