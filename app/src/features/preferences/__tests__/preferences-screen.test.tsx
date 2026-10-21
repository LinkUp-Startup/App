import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import PreferencesScreen from '@/app/(tabs)/index';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/components/api-status', () => ({ ApiStatus: () => null }));

afterEach(() => jest.mocked(router.push).mockReset());

describe('PreferencesScreen', () => {
  it('shows field errors instead of submitting an incomplete form', async () => {
    const user = userEvent.setup();
    await render(<PreferencesScreen />);

    await user.press(screen.getByRole('button', { name: 'Generate plans' }));

    expect(screen.getByText('Pick at least one activity.')).toBeOnTheScreen();
    expect(screen.getByText('Fix the highlighted fields to continue.')).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('submits the selected preferences', async () => {
    const user = userEvent.setup();
    await render(<PreferencesScreen />);

    await user.press(screen.getByRole('checkbox', { name: 'Drinks' }));
    await user.press(screen.getByRole('checkbox', { name: 'Bike' }));
    await user.press(screen.getByRole('button', { name: 'Increase group size' }));
    await user.clear(screen.getByLabelText('Budget per person in euros'));
    await user.type(screen.getByLabelText('Budget per person in euros'), '25');
    await user.type(screen.getByLabelText('Additional preferences'), 'vegetarian');
    await user.press(screen.getByRole('button', { name: 'Generate plans' }));

    expect(router.push).toHaveBeenCalledTimes(1);
    const [href] = jest.mocked(router.push).mock.calls[0];
    expect(href).toMatchObject({ pathname: '/plans' });
    const { preferences } = (href as unknown as { params: { preferences: string } }).params;
    expect(JSON.parse(preferences)).toMatchObject({
      activities: ['drinks'],
      transport: ['walking', 'bike'],
      groupSize: 3,
      budgetPerPerson: 25,
      notes: 'vegetarian',
    });
  });
});
