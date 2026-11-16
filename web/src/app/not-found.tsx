import Link from 'next/link';
import { buttonClass } from '@/components/button';
import { SiteHeader } from '@/components/site-header';

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 pt-16 sm:px-8 sm:pt-24">
        <h1 className="max-w-4xl font-display text-6xl leading-none font-black text-butter uppercase text-balance sm:text-8xl">
          This page doesn’t exist.
        </h1>
        <p className="mt-6 max-w-prose text-lg leading-relaxed text-mauve">
          Check the link, or go to the home page.
        </p>
        <Link href="/" className={`mt-8 ${buttonClass}`}>
          Go to the home page
        </Link>
      </main>
    </>
  );
}
