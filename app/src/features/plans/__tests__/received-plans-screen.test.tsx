import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiError } from '@/api/client';
import { deleteReceivedPlan, listReceivedPlans } from '@/api/received-plans';
import ReceivedPlansScreen, { sentLine } from '@/app/received-plans';
import { savePlanFor } from '@/features/plans/saved-plans-sync';
import { savePlan } from '@/storage/saved-plans';
import type { ReceivedPlan } from '@/types/api';

import { tapasPlan } from './fixtures/plans';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (effect: () => void | (() => void)) =>
    jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));
jest.mock('@/api/received-plans');
jest.mock('@/features/plans/saved-plans-sync', () => ({ savePlanFor: jest.fn() }));
const mockAuth = { accessToken: 'token-1' as string | null };
jest.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({ accessToken: mockAuth.accessToken }),
}));

const fromAnn: ReceivedPlan = {
  id: 'r1',
  plan: tapasPlan,
  from: { userId: 'u1', displayName: 'Ann' },
  sentAt: '2026-11-06T18:00:00Z',
};

afterEach(() => {
  jest.clearAllMocks();
  mockAuth.accessToken = 'token-1';
});

describe('ReceivedPlansScreen', () => {
  it('asks guests to log in', async () => {
    mockAuth.accessToken = null;
    const user = userEvent.setup();
    await render(<ReceivedPlansScreen />);

    await user.press(screen.getByRole('button', { name: 'Log in' }));

    expect(router.push).toHaveBeenCalledWith('/login');
    expect(listReceivedPlans).not.toHaveBeenCalled();
  });

  it('shows loading until the plans arrive', async () => {
    jest.mocked(listReceivedPlans).mockReturnValue(new Promise(() => {}));

    await render(<ReceivedPlansScreen />);

    expect(screen.getByText('Loading…')).toBeOnTheScreen();
  });

  it('says when no friend has sent a plan', async () => {
    jest.mocked(listReceivedPlans).mockResolvedValue({ plans: [] });

    await render(<ReceivedPlansScreen />);

    expect(await screen.findByText(/No plans from friends right now/)).toBeOnTheScreen();
    expect(listReceivedPlans).toHaveBeenCalledWith('token-1', expect.any(AbortSignal));
  });

  it('shows each plan with who sent it', async () => {
    jest.mocked(listReceivedPlans).mockResolvedValue({ plans: [fromAnn] });

    await render(<ReceivedPlansScreen />);

    expect(await screen.findByText('Ann sent you this on Fri 6 Nov')).toBeOnTheScreen();
    expect(screen.getByText('Tapas and drinks')).toBeOnTheScreen();
  });

  it('says when the sender no longer has an account', () => {
    expect(sentLine({ ...fromAnn, from: null })).toBe('A former friend sent you this on Fri 6 Nov');
  });

  it('saves your own copy', async () => {
    jest.mocked(listReceivedPlans).mockResolvedValue({ plans: [fromAnn] });
    jest.mocked(savePlanFor).mockResolvedValue('account');
    const user = userEvent.setup();
    await render(<ReceivedPlansScreen />);

    await user.press(await screen.findByRole('button', { name: 'Save Tapas and drinks' }));

    expect(savePlanFor).toHaveBeenCalledWith(tapasPlan, 'token-1');
    expect(await screen.findByRole('button', { name: 'Tapas and drinks saved' })).toBeDisabled();
  });

  it('shows a plan you already saved as saved', async () => {
    await savePlan(tapasPlan);
    jest.mocked(listReceivedPlans).mockResolvedValue({ plans: [fromAnn] });

    await render(<ReceivedPlansScreen />);

    expect(await screen.findByRole('button', { name: 'Tapas and drinks saved' })).toBeOnTheScreen();
  });

  it('says so when saving fails', async () => {
    jest.mocked(listReceivedPlans).mockResolvedValue({ plans: [fromAnn] });
    jest.mocked(savePlanFor).mockRejectedValue(new Error('disk full'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<ReceivedPlansScreen />);

    await user.press(await screen.findByRole('button', { name: 'Save Tapas and drinks' }));

    expect(await screen.findByText("Couldn't save this plan. Try again.")).toBeOnTheScreen();
  });

  it('removes a plan', async () => {
    jest.mocked(listReceivedPlans).mockResolvedValue({ plans: [fromAnn] });
    jest.mocked(deleteReceivedPlan).mockResolvedValue(undefined);
    const user = userEvent.setup();
    await render(<ReceivedPlansScreen />);

    await user.press(await screen.findByRole('button', { name: 'Remove Tapas and drinks' }));

    expect(deleteReceivedPlan).toHaveBeenCalledWith('token-1', 'r1');
    expect(await screen.findByText(/No plans from friends right now/)).toBeOnTheScreen();
  });

  it('keeps the plan and says so when removing fails', async () => {
    jest.mocked(listReceivedPlans).mockResolvedValue({ plans: [fromAnn] });
    jest.mocked(deleteReceivedPlan).mockRejectedValue(new Error('offline'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<ReceivedPlansScreen />);

    await user.press(await screen.findByRole('button', { name: 'Remove Tapas and drinks' }));

    expect(await screen.findByText(/Couldn't remove this plan/)).toBeOnTheScreen();
    expect(screen.getByText('Tapas and drinks')).toBeOnTheScreen();
  });

  it('shows an error and loads again', async () => {
    jest
      .mocked(listReceivedPlans)
      .mockRejectedValueOnce(new ApiError(500, ''))
      .mockResolvedValueOnce({ plans: [fromAnn] });
    const user = userEvent.setup();
    await render(<ReceivedPlansScreen />);

    expect(await screen.findByText(/went wrong on our side/)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Ann sent you this on Fri 6 Nov')).toBeOnTheScreen();
  });
});
