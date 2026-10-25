import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import SavedPlansScreen from '@/app/(tabs)/saved';
import { savePlan } from '@/storage/saved-plans';

import { tapasPlan } from './fixtures/plans';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    router: { navigate: jest.fn(), push: jest.fn() },
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  };
});

describe('SavedPlansScreen', () => {
  it('explains how to save a plan when there are none', async () => {
    const user = userEvent.setup();
    await render(<SavedPlansScreen />);

    expect(await screen.findByText(/No saved plans yet/)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Plan a night' }));
    expect(router.navigate).toHaveBeenCalledWith('/');
  });

  it('lists saved plans and opens one', async () => {
    await savePlan(tapasPlan);
    const user = userEvent.setup();
    await render(<SavedPlansScreen />);

    await user.press(await screen.findByRole('button', { name: 'Open Tapas and drinks' }));

    expect(
      screen.getByText('Fri 30 Oct · 2 stops · estimated €25.50 per person · 910 m'),
    ).toBeOnTheScreen();
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/saved-plan/[id]',
      params: { id: 'p1' },
    });
  });
});
