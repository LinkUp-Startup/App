import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSharedPlan, hasSavedPlan, SessionExpiredError } from '@/lib/api';
import { getSession } from '@/lib/session';
import { samplePlan } from '@/lib/__tests__/sample-plan';
import PlanError from '../error';
import PlanNotFound from '../not-found';
import SharedPlanPage, { generateMetadata } from '../page';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  getSharedPlan: vi.fn(),
  hasSavedPlan: vi.fn(),
}));
vi.mock('@/app/actions/plans', () => ({ saveSharedPlan: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/app/actions/auth', () => ({ login: vi.fn(), logout: vi.fn() }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const params = Promise.resolve({ token: 'abc' });

beforeEach(() => {
  vi.mocked(getSharedPlan).mockReset();
  vi.mocked(getSession).mockResolvedValue(null);
});

describe('shared plan page', () => {
  it('shows the plan with when, prices, distance and every stop', async () => {
    vi.mocked(getSharedPlan).mockResolvedValue(samplePlan);

    render(await SharedPlanPage({ params }));

    expect(getSharedPlan).toHaveBeenCalledWith('abc');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Tapas and a late club' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Friday 6 November, 20:30 to 04:00')).toBeInTheDocument();
    expect(screen.getByText(samplePlan.summary)).toBeInTheDocument();
    expect(screen.getByText('About €38')).toBeInTheDocument();
    expect(screen.getByText('About €76')).toBeInTheDocument();
    expect(screen.getByText('3.5 km')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cantamanyanes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      '/login?next=%2Fplan%2Fabc',
    );
    expect(
      screen.getByRole('link', { name: 'Directions to Traganits (opens Google Maps)' }),
    ).toBeInTheDocument();
  });

  it('leaves out unknown prices and a zero distance', async () => {
    vi.mocked(getSharedPlan).mockResolvedValue({
      ...samplePlan,
      summary: '',
      estimatedCostPerPerson: null,
      estimatedTotalCost: null,
      totalDistanceKm: 0,
    });

    render(await SharedPlanPage({ params }));

    expect(screen.getByText('Not known')).toBeInTheDocument();
    expect(screen.queryByText('For the group')).not.toBeInTheDocument();
    expect(screen.queryByText('Distance')).not.toBeInTheDocument();
  });

  it('is a 404 when the link is not shared', async () => {
    vi.mocked(getSharedPlan).mockResolvedValue(null);

    await expect(SharedPlanPage({ params })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('gives link previews the plan title and keeps the page out of search engines', async () => {
    vi.mocked(getSharedPlan).mockResolvedValue(samplePlan);

    const metadata = await generateMetadata({ params });

    expect(metadata.title).toBe('Tapas and a late club');
    expect(metadata.description).toBe(`Friday 6 November, 20:30 to 04:00. ${samplePlan.summary}`);
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.openGraph).toMatchObject({ title: 'Tapas and a late club' });
  });

  it('titles a missing plan', async () => {
    vi.mocked(getSharedPlan).mockResolvedValue(null);

    expect((await generateMetadata({ params })).title).toBe('Plan not found');
  });
});

describe('saving a shared plan', () => {
  it('offers a guest to log in to save', async () => {
    vi.mocked(getSharedPlan).mockResolvedValue(samplePlan);

    render(await SharedPlanPage({ params }));

    expect(screen.getByRole('link', { name: 'Log in to save this plan' })).toBeInTheDocument();
    expect(hasSavedPlan).not.toHaveBeenCalled();
  });

  it('offers to save when logged in and not saved yet', async () => {
    vi.mocked(getSharedPlan).mockResolvedValue(samplePlan);
    vi.mocked(getSession).mockResolvedValue({ accessToken: 'jwt', displayName: 'Ann' });
    vi.mocked(hasSavedPlan).mockResolvedValue(false);

    render(await SharedPlanPage({ params }));

    expect(hasSavedPlan).toHaveBeenCalledWith('jwt', samplePlan.id);
    expect(screen.getByRole('button', { name: 'Save to my plans' })).toBeInTheDocument();
    expect(screen.getByText('Ann')).toBeInTheDocument();
  });

  it('says when the plan is already saved', async () => {
    vi.mocked(getSharedPlan).mockResolvedValue(samplePlan);
    vi.mocked(getSession).mockResolvedValue({ accessToken: 'jwt', displayName: 'Ann' });
    vi.mocked(hasSavedPlan).mockResolvedValue(true);

    render(await SharedPlanPage({ params }));

    expect(screen.getByRole('status')).toHaveTextContent('This plan is in your saved plans.');
  });

  it.each([
    ['an expired session', new SessionExpiredError()],
    ['an API failure', new Error('500')],
  ])('still offers to save after %s', async (_case, error) => {
    vi.mocked(getSharedPlan).mockResolvedValue(samplePlan);
    vi.mocked(getSession).mockResolvedValue({ accessToken: 'jwt', displayName: 'Ann' });
    vi.mocked(hasSavedPlan).mockRejectedValue(error);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(await SharedPlanPage({ params }));

    expect(screen.getByRole('button', { name: 'Save to my plans' })).toBeInTheDocument();
  });
});

describe('shared plan not found', () => {
  it('explains why the link may not work', () => {
    render(<PlanNotFound />);

    expect(screen.getByRole('heading', { name: 'This plan isn’t shared.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See what LinkUp is' })).toHaveAttribute('href', '/');
  });
});

describe('shared plan error', () => {
  it('offers to try again', () => {
    const reset = vi.fn();
    render(<PlanError error={new Error('down')} reset={reset} />);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalled();
  });
});
