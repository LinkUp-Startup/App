import Link from 'next/link';
import type { ReactNode } from 'react';

/** `account` is the login state on pages that need it (shared plans); the home page stays static without it. */
export function SiteHeader({ account }: { account?: ReactNode }) {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 pt-6 sm:px-8">
      <Link
        href="/"
        className="font-display text-3xl leading-none font-black tracking-wide uppercase">
        LinkUp
      </Link>
      {account}
    </header>
  );
}
