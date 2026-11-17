import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSharedPlan } from '@/lib/api';
import { samplePlan } from '@/lib/__tests__/sample-plan';
import { shareImage } from '@/lib/share-image';
import HomeImage, { size as homeSize } from '../opengraph-image';
import PlanImage from '../plan/[token]/opengraph-image';

vi.mock('@/lib/api', () => ({ getSharedPlan: vi.fn() }));
vi.mock('@/lib/share-image', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/share-image')>()),
  shareImage: vi.fn(),
}));

const params = Promise.resolve({ token: 'abc' });

beforeEach(() => vi.mocked(shareImage).mockClear());

const heading = () => vi.mocked(shareImage).mock.calls[0][0].heading;

describe('link preview images', () => {
  it('shows the example night on the home page preview', async () => {
    await HomeImage();

    expect(homeSize).toEqual({ width: 1200, height: 630 });
    expect(heading()).toBe('Your whole night, planned.');
  });

  it('shows the shared plan', async () => {
    vi.mocked(getSharedPlan).mockResolvedValue(samplePlan);

    await PlanImage({ params });

    expect(getSharedPlan).toHaveBeenCalledWith('abc');
    expect(heading()).toBe('Tapas and a late club');
  });

  it('falls back to the LinkUp preview for a link that is not shared', async () => {
    vi.mocked(getSharedPlan).mockResolvedValue(null);

    await PlanImage({ params });

    expect(heading()).toBe('Your whole night, planned.');
  });

  it('falls back to the LinkUp preview when the API fails', async () => {
    vi.mocked(getSharedPlan).mockRejectedValue(new Error('down'));

    await PlanImage({ params });

    expect(heading()).toBe('Your whole night, planned.');
  });
});
