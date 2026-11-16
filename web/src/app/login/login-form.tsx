'use client';

import { useActionState } from 'react';
import { login, type LoginState } from '@/app/actions/auth';
import { buttonClass } from '@/components/button';

const field =
  'mt-2 block w-full rounded-xl border-2 border-mauve/40 bg-wine px-4 py-3 text-blush placeholder:text-mauve/70 focus-visible:border-butter';

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form
      action={action}
      className="grid gap-5 self-start rounded-3xl bg-plum p-6 sm:p-8"
      noValidate>
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
        <p role="alert" className="text-sm text-coral">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={`mt-2 ${buttonClass}`}>
        {pending ? 'Logging in…' : 'Log in'}
      </button>
    </form>
  );
}
