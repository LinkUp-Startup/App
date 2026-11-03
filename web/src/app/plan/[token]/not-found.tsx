import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';

export default function PlanNotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 pt-20 sm:px-8">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
          This plan isn’t shared.
        </h1>
        <p className="mt-4 max-w-prose text-lg text-haze">
          The link is wrong, or the person who shared it stopped sharing it or deleted the plan. Ask
          them for a new link.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-full bg-violet px-6 py-3 font-bold text-night hover:bg-lavender">
          See what LinkUp is
        </Link>
      </main>
    </>
  );
}
