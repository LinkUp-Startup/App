'use client';

import { useActionState } from 'react';
import { login, type LoginState } from '@/app/actions/auth';

const field =
  'mt-2 block w-full rounded-xl border border-transparent bg-dusk px-4 py-3 text-lavender placeholder:text-haze/70 focus-visible:border-violet';

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="mt-8 grid max-w-sm gap-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="text-sm font-bold">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          className={field}
        />
      </label>
      <label className="block">
        <span className="text-sm font-bold">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={field}
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-sodium">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-violet px-6 py-3 font-bold text-night hover:bg-lavender disabled:opacity-60">
        {pending ? 'Logging in…' : 'Log in'}
      </button>
    </form>
  );
}
