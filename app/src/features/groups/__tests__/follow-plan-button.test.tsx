import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { FollowPlanButton } from '@/features/groups/follow-plan-button';
import { tapasPlan } from '@/features/plans/__tests__/fixtures/plans';
import { savePlanFor } from '@/features/plans/saved-plans-sync';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/features/plans/saved-plans-sync');
const mockAuth = { accessToken: 'token-1' as string | null };
jest.mock('@/features/auth/auth-context', () => ({ useAuth: () => mockAuth }));

const follow = { name: 'Follow this plan' };

afterEach(() => {
  jest.resetAllMocks();
  mockAuth.accessToken = 'token-1';
});

describe('FollowPlanButton', () => {
  it('keeps the plan with the persons own plans and opens Tonight mode for it', async () => {
    jest.mocked(savePlanFor).mockResolvedValue('account');
    const user = userEvent.setup();
    await render(<FollowPlanButton plan={tapasPlan} />);

    await user.press(screen.getByRole('button', follow));

    expect(savePlanFor).toHaveBeenCalledWith(tapasPlan, 'token-1');
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/tonight/[id]',
        params: { id: tapasPlan.id },
      }),
    );
  });

  it('works for a guest too: the plan is then kept on this phone only', async () => {
    mockAuth.accessToken = null;
    jest.mocked(savePlanFor).mockResolvedValue('device');
    const user = userEvent.setup();
    await render(<FollowPlanButton plan={tapasPlan} />);

    await user.press(screen.getByRole('button', follow));

    expect(savePlanFor).toHaveBeenCalledWith(tapasPlan, null);
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
  });

  it('opens Tonight mode also when the account could not be reached', async () => {
    // The plan was kept on this phone, and Tonight mode reads it from there
    jest.mocked(savePlanFor).mockResolvedValue('device');
    const user = userEvent.setup();
    await render(<FollowPlanButton plan={tapasPlan} />);

    await user.press(screen.getByRole('button', follow));

    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Couldn.t keep this plan/)).toBeNull();
  });

  it('shows that it is working and does not save twice', async () => {
    let finish!: (outcome: 'account') => void;
    jest.mocked(savePlanFor).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const user = userEvent.setup();
    await render(<FollowPlanButton plan={tapasPlan} />);

    await user.press(screen.getByRole('button', follow));

    // While it works the button is called "Opening…" and cannot be pressed again
    expect(screen.getByRole('button', { name: 'Opening…' })).toBeDisabled();
    expect(router.push).not.toHaveBeenCalled();
    finish('account');
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    expect(savePlanFor).toHaveBeenCalledTimes(1);
  });

  it('says so, and stays on the screen, when the plan could not be kept on the phone', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.mocked(savePlanFor).mockRejectedValue(new Error('storage is full'));
    const user = userEvent.setup();
    await render(<FollowPlanButton plan={tapasPlan} />);

    await user.press(screen.getByRole('button', follow));

    expect(
      await screen.findByText("Couldn't keep this plan on your phone. Try again."),
    ).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByRole('button', follow)).toBeEnabled();
    warn.mockRestore();
  });

  it('clears the error when trying again works', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest
      .mocked(savePlanFor)
      .mockRejectedValueOnce(new Error('storage is full'))
      .mockResolvedValue('account');
    const user = userEvent.setup();
    await render(<FollowPlanButton plan={tapasPlan} />);
    await user.press(screen.getByRole('button', follow));
    expect(await screen.findByText(/Couldn.t keep this plan/)).toBeOnTheScreen();

    await user.press(screen.getByRole('button', follow));

    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Couldn.t keep this plan/)).toBeNull();
    warn.mockRestore();
  });
});
