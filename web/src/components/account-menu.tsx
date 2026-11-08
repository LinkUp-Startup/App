import Link from 'next/link';
import { logout } from '@/app/actions/auth';
import type { Session } from '@/lib/session';

/** Log in, or who is logged in with a way out. `here` is the page to come back to. */
export function AccountMenu({ session, here }: { session: Session | null; here: string }) {
  if (!session) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(here)}`}
        className="text-sm font-bold text-violet underline decoration-violet/40 underline-offset-4 hover:decoration-violet">
        Log in
      </Link>
    );
  }
  return (
    <form action={logout} className="flex items-center gap-3 text-sm">
      <span className="text-haze">{session.displayName || 'Logged in'}</span>
      <input type="hidden" name="next" value={here} />
      <button
        type="submit"
        className="font-bold text-violet underline decoration-violet/40 underline-offset-4 hover:decoration-violet">
        Log out
      </button>
    </form>
  );
}
