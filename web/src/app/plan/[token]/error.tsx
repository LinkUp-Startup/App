'use client';

import { SiteHeader } from '@/components/site-header';

// The API could not be reached or failed; the link itself may be fine.
export default function PlanError({ reset }: { error: Error; reset: () => void }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 pt-20 sm:px-8">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
          This plan didn’t load.
        </h1>
        <p className="mt-4 max-w-prose text-lg text-haze">
          LinkUp’s server didn’t answer. The link is probably fine: try again in a moment.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-8 rounded-full bg-violet px-6 py-3 font-bold text-night hover:bg-lavender">
          Try again
        </button>
      </main>
    </>
  );
}
