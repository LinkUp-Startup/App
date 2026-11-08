import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';

import { ApiError, NetworkError } from '@/api/client';
import { putSavedPlan } from '@/api/saved-plans';
import { getSharedPlan } from '@/api/shared-plans';
import SharedPlanScreen from '@/app/shared-plan';
import { getSavedPlans, savePlan } from '@/storage/saved-plans';

import { tapasPlan } from './fixtures/plans';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn() }));
jest.mock('@/api/shared-plans');
jest.mock('@/api/saved-plans');
const mockAuth = { accessToken: null as string | null };
jest.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({ accessToken: mockAuth.accessToken }),
}));

const token = 'AbC_dEf-0123456789xyzQ';
const link = `https://linkup.th7bo.dev/plan/${token}`;

afterEach(() => {
  jest.clearAllMocks();
  mockAuth.accessToken = null;
});

async function openLink(text = link) {
  const user = userEvent.setup();
  await render(<SharedPlanScreen />);
  await user.type(screen.getByLabelText('Share link'), text);
  await user.press(screen.getByRole('button', { name: 'Open plan' }));
  return user;
}

describe('SharedPlanScreen', () => {
  it('opens the plan behind a pasted link', async () => {
    jest.mocked(Clipboard.getStringAsync).mockResolvedValue(`Tapas, Fri 30 Oct\n${link}`);
    jest.mocked(getSharedPlan).mockResolvedValue({ plan: tapasPlan });
    const user = userEvent.setup();
    await render(<SharedPlanScreen />);

    await user.press(screen.getByRole('button', { name: 'Paste' }));
    await user.press(screen.getByRole('button', { name: 'Open plan' }));

    expect(await screen.findByRole('header', { name: 'Tapas and drinks' })).toBeOnTheScreen();
    expect(getSharedPlan).toHaveBeenCalledWith(token);
  });

  it('says when the text is not a share link, without asking the server', async () => {
    await openLink('https://example.com/hello');

    expect(await screen.findByText(/isn’t a LinkUp share link/)).toBeOnTheScreen();
    expect(getSharedPlan).not.toHaveBeenCalled();
  });

  it('says when the plan is no longer shared', async () => {
    jest.mocked(getSharedPlan).mockRejectedValue(new ApiError(404, 'gone'));

    await openLink();

    expect(await screen.findByText(/isn’t shared anymore/)).toBeOnTheScreen();
  });

  it('says when the server cannot be reached', async () => {
    jest.mocked(getSharedPlan).mockRejectedValue(new NetworkError('offline'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await openLink();

    expect(await screen.findByText(/Couldn’t open the plan/)).toBeOnTheScreen();
  });

  it('saves a guest copy on the phone and opens it from saved plans', async () => {
    jest.mocked(getSharedPlan).mockResolvedValue({ plan: tapasPlan });
    const user = await openLink();

    await user.press(await screen.findByRole('button', { name: 'Save to my plans' }));

    expect(await screen.findByText(/Saved on this phone/)).toBeOnTheScreen();
    expect((await getSavedPlans()).map((p) => p.id)).toEqual([tapasPlan.id]);
    await user.press(screen.getByRole('button', { name: 'Open in saved plans' }));
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/saved-plan/[id]',
      params: { id: tapasPlan.id },
    });
  });

  it('saves a copy to the account when signed in', async () => {
    mockAuth.accessToken = 'token-1';
    jest.mocked(getSharedPlan).mockResolvedValue({ plan: tapasPlan });
    jest.mocked(putSavedPlan).mockResolvedValue({
      plan: tapasPlan,
      savedAt: '2026-11-08T10:00:00.000Z',
      shareUrl: null,
    });
    const user = await openLink();

    await user.press(await screen.findByRole('button', { name: 'Save to my plans' }));

    expect(await screen.findByText(/Saved to your plans/)).toBeOnTheScreen();
    expect(putSavedPlan).toHaveBeenCalledWith('token-1', tapasPlan);
    await waitFor(async () => expect((await getSavedPlans())[0].synced).toBe(true));
  });

  it('says when the plan is already saved', async () => {
    await savePlan(tapasPlan);
    jest.mocked(getSharedPlan).mockResolvedValue({ plan: tapasPlan });

    await openLink();

    expect(await screen.findByText('This plan is already in your saved plans.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Save to my plans' })).not.toBeOnTheScreen();
  });
});
