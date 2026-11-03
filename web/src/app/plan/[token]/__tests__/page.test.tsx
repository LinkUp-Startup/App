import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSharedPlan } from '@/lib/api';
import { samplePlan } from '@/lib/__tests__/sample-plan';
import PlanError from '../error';
import PlanNotFound from '../not-found';
import SharedPlanPage, { generateMetadata } from '../page';

vi.mock('@/lib/api', () => ({ getSharedPlan: vi.fn() }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const params = Promise.resolve({ token: 'abc' });

beforeEach(() => vi.mocked(getSharedPlan).mockReset());

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
