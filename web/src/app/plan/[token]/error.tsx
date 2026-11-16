'use client';

import { buttonClass } from '@/components/button';
import { SiteHeader } from '@/components/site-header';

// The API could not be reached or failed; the link itself may be fine.
export default function PlanError({ reset }: { error: Error; reset: () => void }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 pt-16 sm:px-8 sm:pt-24">
        <h1 className="max-w-4xl font-display text-6xl leading-none font-black text-butter uppercase text-balance sm:text-8xl">
          This plan didn’t load.
        </h1>
        <p className="mt-6 max-w-prose text-lg leading-relaxed text-mauve">
          LinkUp’s server didn’t answer. The link is probably fine: try again in a moment.
        </p>
        <button type="button" onClick={reset} className={`mt-8 ${buttonClass}`}>
          Try again
        </button>
      </main>
    </>
  );
}
