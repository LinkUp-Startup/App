import { describe, expect, it, vi } from 'vitest';
import { getSharedPlan } from '@/lib/api';
import { samplePlan } from '@/lib/__tests__/sample-plan';
import { GET } from '../calendar/route';

vi.mock('@/lib/api', () => ({ getSharedPlan: vi.fn() }));

const context = { params: Promise.resolve({ token: 'abc' }) };
const request = new Request('https://linkup.th7bo.dev/plan/abc/calendar');

describe('calendar download', () => {
  it('sends the shared plan as a calendar file', async () => {
    vi.mocked(getSharedPlan).mockResolvedValue(samplePlan);

    const response = await GET(request, context);

    expect(getSharedPlan).toHaveBeenCalledWith('abc');
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/calendar; charset=utf-8');
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="tapas-and-a-late-club.ics"',
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.text()).toContain('SUMMARY:Traganits');
  });

  it('answers 404 when the plan is not shared', async () => {
    vi.mocked(getSharedPlan).mockResolvedValue(null);

    const response = await GET(request, context);

    expect(response.status).toBe(404);
  });
});
