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
      <main className="mx-auto max-w-5xl px-5 pt-16 sm:px-8">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Log in</h1>
        <p className="mt-4 max-w-prose text-lg text-haze">
          Use your LinkUp account to save shared plans to your plans. No account yet? Create one in
          the LinkUp app.
        </p>
        <LoginForm next={next} />
      </main>
    </>
  );
}
