import Link from 'next/link';
import { logout } from '@/app/actions/auth';
import type { Session } from '@/lib/session';

const link =
  'font-bold text-butter underline decoration-butter/40 underline-offset-4 hover:decoration-butter';

/** Log in, or who is logged in with a way out. `here` is the page to come back to. */
export function AccountMenu({ session, here }: { session: Session | null; here: string }) {
  if (!session) {
    return (
      <Link href={`/login?next=${encodeURIComponent(here)}`} className={`text-sm ${link}`}>
        Log in
      </Link>
    );
  }
  return (
    <form action={logout} className="flex items-center gap-3 text-sm">
      <span className="text-mauve">{session.displayName || 'Logged in'}</span>
      <input type="hidden" name="next" value={here} />
      <button type="submit" className={link}>
        Log out
      </button>
    </form>
  );
}
