import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { getSession, safeNext } from '@/lib/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Log in', robots: { index: false } };

type Props = { searchParams: Promise<{ next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const next = safeNext((await searchParams).next);
  if (await getSession()) redirect(next);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 pt-16 sm:px-8 sm:pt-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_26rem] lg:gap-20">
          <div>
            <h1 className="font-display text-7xl leading-none font-black text-butter uppercase sm:text-8xl">
              Log in
            </h1>
            <p className="mt-6 max-w-prose text-lg leading-relaxed text-mauve">
              Use your LinkUp account to save shared plans to your plans. No account yet? Create one
              in the LinkUp app.
            </p>
          </div>
          <LoginForm next={next} />
        </div>
      </main>
    </>
  );
}
