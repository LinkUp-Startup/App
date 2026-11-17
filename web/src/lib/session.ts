import { cookies } from 'next/headers';

/**
 * The website's login session (#205): the API access token and the account's name, each in a cookie that
 * scripts in the page can't read (HttpOnly), only sent over HTTPS (Secure) and not on requests from other
 * sites (SameSite=Lax). The cookies expire with the token, so an expired session simply isn't there.
 */
const TOKEN = 'linkup_token';
const NAME = 'linkup_name';

export type Session = { accessToken: string; displayName: string };

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const accessToken = jar.get(TOKEN)?.value;
  if (!accessToken) return null;
  return { accessToken, displayName: jar.get(NAME)?.value ?? '' };
}

export async function startSession(session: Session, expiresAt: string) {
  const jar = await cookies();
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires: new Date(expiresAt),
  };
  jar.set(TOKEN, session.accessToken, options);
  jar.set(NAME, session.displayName, options);
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(TOKEN);
  jar.delete(NAME);
}

/** Where to go after logging in: only a path on this site, never another site (an open redirect). */
export function safeNext(next: unknown): string {
  return typeof next === 'string' &&
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !next.includes('\\')
    ? next
    : '/';
}
