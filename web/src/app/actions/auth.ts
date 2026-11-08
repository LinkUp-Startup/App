'use server';

import type { components } from '@shared/api';
import { redirect } from 'next/navigation';
import { apiUrl } from '@/lib/api';
import { endSession, safeNext, startSession } from '@/lib/session';

type AuthResponse = components['schemas']['AuthResponse'];

export type LoginState = { error?: string; email?: string };

/** Logs in with a LinkUp account through the API and keeps the session in cookies. */
export async function login(_previous: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const next = safeNext(form.get('next'));
  if (!email || !password) return { error: 'Enter your email and password.', email };

  let response: Response;
  try {
    response = await fetch(`${apiUrl()}/api/auth/login`, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { error: 'Couldn’t reach LinkUp. Try again in a moment.', email };
  }

  if (response.status === 401 || response.status === 400) {
    return { error: 'That email and password don’t match a LinkUp account.', email };
  }
  if (response.status === 429) {
    return { error: 'Too many attempts. Wait a minute and try again.', email };
  }
  if (!response.ok) return { error: 'Couldn’t log in right now. Try again in a moment.', email };

  const auth = (await response.json()) as AuthResponse;
  await startSession(
    { accessToken: auth.accessToken, displayName: auth.user.displayName },
    auth.expiresAt,
  );
  redirect(next);
}

export async function logout(form: FormData) {
  await endSession();
  redirect(safeNext(form.get('next')));
}
