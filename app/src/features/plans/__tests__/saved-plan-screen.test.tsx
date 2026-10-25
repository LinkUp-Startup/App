import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import SavedPlanScreen from '@/app/saved-plan/[id]';
import { getSavedPlans, savePlan } from '@/storage/saved-plans';

import { tapasPlan } from './fixtures/plans';

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

beforeEach(() => jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'p1' }));

describe('SavedPlanScreen', () => {
  it('shows the saved plan', async () => {
    await savePlan(tapasPlan);
    await render(<SavedPlanScreen />);

    expect(await screen.findByRole('header', { name: 'Tapas and drinks' })).toBeOnTheScreen();
    expect(screen.getByText(/^Saved on /)).toBeOnTheScreen();
  });

  it('deletes the plan after confirming', async () => {
    await savePlan(tapasPlan);
    const alert = jest.spyOn(Alert, 'alert');
    const user = userEvent.setup();
    await render(<SavedPlanScreen />);

    await user.press(await screen.findByRole('button', { name: 'Delete plan' }));
    const buttons = alert.mock.calls[0][2]!;
    buttons.find((button) => button.text === 'Delete')!.onPress!();

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await getSavedPlans()).toEqual([]);
  });

  it('keeps the plan when deleting is cancelled', async () => {
    await savePlan(tapasPlan);
    const alert = jest.spyOn(Alert, 'alert');
    const user = userEvent.setup();
    await render(<SavedPlanScreen />);

    await user.press(await screen.findByRole('button', { name: 'Delete plan' }));

    expect(alert.mock.calls[0][2]!.find((button) => button.text === 'Cancel')?.style).toBe(
      'cancel',
    );
    expect(await getSavedPlans()).toHaveLength(1);
  });

  it('explains when the plan is no longer saved', async () => {
    const user = userEvent.setup();
    await render(<SavedPlanScreen />);

    expect(await screen.findByText('This plan is no longer saved.')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Back to saved plans' }));
    expect(router.back).toHaveBeenCalled();
  });
});
