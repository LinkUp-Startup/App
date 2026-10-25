import { apiRequest } from '@/api/client';
import type { AuthResponse, LoginRequest, RegisterRequest } from '@/types/api';

export function register(request: RegisterRequest, signal?: AbortSignal) {
  return apiRequest<AuthResponse>('/api/auth/register', { method: 'POST', body: request, signal });
}

export function login(request: LoginRequest, signal?: AbortSignal) {
  return apiRequest<AuthResponse>('/api/auth/login', { method: 'POST', body: request, signal });
}
