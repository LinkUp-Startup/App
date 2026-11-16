import Link from 'next/link';
import { buttonClass } from '@/components/button';
import { SiteHeader } from '@/components/site-header';

export default function PlanNotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 pt-16 sm:px-8 sm:pt-24">
        <h1 className="max-w-4xl font-display text-6xl leading-none font-black text-butter uppercase text-balance sm:text-8xl">
          This plan isn’t shared.
        </h1>
        <p className="mt-6 max-w-prose text-lg leading-relaxed text-mauve">
          The link is wrong, or the person who shared it stopped sharing it or deleted the plan. Ask
          them for a new link.
        </p>
        <Link href="/" className={`mt-8 ${buttonClass}`}>
          See what LinkUp is
        </Link>
      </main>
    </>
  );
}
