import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSession } from '@/lib/session';
import { login } from '@/app/actions/auth';
import { AccountMenu } from '@/components/account-menu';
import LoginPage from '../page';
import { LoginForm } from '../login-form';

vi.mock('@/lib/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/session')>()),
  getSession: vi.fn(),
}));
vi.mock('@/app/actions/auth', () => ({ login: vi.fn(), logout: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));

beforeEach(() => vi.clearAllMocks());

describe('login page', () => {
  it('shows the form, keeping where to go back to', async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const { container } = render(
      await LoginPage({ searchParams: Promise.resolve({ next: '/plan/abc' }) }),
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByText(/Create one in the LinkUp app/)).toBeInTheDocument();
    expect(container.querySelector('input[name="next"]')).toHaveValue('/plan/abc');
  });

  it('sends someone who is already logged in straight on', async () => {
    vi.mocked(getSession).mockResolvedValue({ accessToken: 'jwt', displayName: 'Ann' });

    await expect(
      LoginPage({ searchParams: Promise.resolve({ next: '/plan/abc' }) }),
    ).rejects.toThrow('REDIRECT /plan/abc');
  });

  it('ignores a next that points to another site', async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const { container } = render(
      await LoginPage({ searchParams: Promise.resolve({ next: '//evil.example' }) }),
    );

    expect(container.querySelector('input[name="next"]')).toHaveValue('/');
  });
});

describe('login form', () => {
  it('shows the error from logging in and keeps the email', async () => {
    vi.mocked(login).mockResolvedValue({
      error: 'That email and password don’t match a LinkUp account.',
      email: 'ann@example.com',
    });
    render(<LoginForm next="/" />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ann@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('don’t match a LinkUp account');
    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveValue('ann@example.com'));
    expect(vi.mocked(login).mock.calls[0][1].get('password')).toBe('wrong');
  });
});

describe('account menu', () => {
  it('links to log in and back', () => {
    render(<AccountMenu session={null} here="/plan/abc" />);

    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      '/login?next=%2Fplan%2Fabc',
    );
  });

  it('shows who is logged in with a way to log out', () => {
    render(<AccountMenu session={{ accessToken: 'jwt', displayName: 'Ann' }} here="/plan/abc" />);

    expect(screen.getByText('Ann')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('falls back when the name is missing', () => {
    render(<AccountMenu session={{ accessToken: 'jwt', displayName: '' }} here="/" />);

    expect(screen.getByText('Logged in')).toBeInTheDocument();
  });
});
