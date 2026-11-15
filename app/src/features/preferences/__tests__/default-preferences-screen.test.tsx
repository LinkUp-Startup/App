import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { StrictMode } from 'react';

import DefaultPreferencesScreen from '@/app/default-preferences';
import { emptyDefaults } from '@/features/preferences/defaults-form';
import { loadGuestPreferences, saveGuestPreferences } from '@/storage/guest-preferences';
import type { User, UserPreferences } from '@/types/api';

const mockAuth = { status: 'ready', user: null as User | null, accessToken: null as string | null };
jest.mock('@/features/auth/auth-context', () => ({ useAuth: () => mockAuth }));
const mockFetch = jest.fn();
const originalFetch = globalThis.fetch;
const budgetLabel = 'Default budget per person in euros';
const radiusLabel = 'Default maximum distance in kilometres';
const saved: UserPreferences = {
  budgetPerPerson: 25.75,
  groupSize: 4,
  maxDistanceKm: 5.25,
  activities: ['dinner', 'drinks'],
  transport: ['walking', 'bike'],
};
const response = (values: unknown = saved, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => values,
  text: async () => JSON.stringify(values),
});
function signedIn(id = 'a') {
  mockAuth.user = { id, email: `${id}@example.com`, displayName: id };
  mockAuth.accessToken = `token-${id}`;
}
async function ready() {
  return screen.findByLabelText(budgetLabel);
}
async function editAll() {
  await ready();
  await fireEvent.changeText(screen.getByLabelText(budgetLabel), '25,75');
  await fireEvent.changeText(screen.getByLabelText('Default group size'), '4');
  await fireEvent.changeText(screen.getByLabelText(radiusLabel), '5.25');
  const user = userEvent.setup();
  for (const name of ['Dinner', 'Drinks', 'Walking', 'Bike'])
    await user.press(screen.getByRole('checkbox', { name }));
}
async function save() {
  await userEvent.setup().press(screen.getByRole('button', { name: 'Save preferences' }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.status = 'ready';
  mockAuth.user = null;
  mockAuth.accessToken = null;
  mockFetch.mockReset().mockResolvedValue(response());
  globalThis.fetch = mockFetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
});

it('waits for session restoration without reading guest or account data', async () => {
  mockAuth.status = 'loading';
  const read = jest.spyOn(AsyncStorage, 'getItem');
  await render(<DefaultPreferencesScreen />);
  expect(screen.getByText('Loading preferences…')).toBeOnTheScreen();
  expect(read).not.toHaveBeenCalled();
  expect(mockFetch).not.toHaveBeenCalled();
});

it('shows five optional fields for guests without assuming any choices', async () => {
  await render(<DefaultPreferencesScreen />);
  expect(await ready()).toHaveDisplayValue('');
  expect(screen.getByLabelText('Default group size')).toHaveDisplayValue('');
  expect(screen.getByLabelText(radiusLabel)).toHaveDisplayValue('');
  expect(screen.getByText(/Saved only on this phone/)).toBeOnTheScreen();
  expect(screen.getByText('Activities')).toBeOnTheScreen();
  expect(screen.getByText('Transport')).toBeOnTheScreen();
  expect(screen.getByRole('checkbox', { name: 'Walking' })).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'Save preferences' })).toBeDisabled();
  expect(mockFetch).not.toHaveBeenCalled();
});

it('saves all guest fields and restores them after unmount and reopening', async () => {
  const view = await render(<DefaultPreferencesScreen />);
  await editAll();
  expect(screen.getByText(/Unsaved changes/)).toBeOnTheScreen();
  await save();
  expect(await screen.findByText('Preferences saved on this phone.')).toBeOnTheScreen();
  expect(await loadGuestPreferences()).toEqual(saved);
  expect(screen.queryByText(/Unsaved changes/)).not.toBeOnTheScreen();
  await view.unmount();
  await render(<DefaultPreferencesScreen />);
  expect(await ready()).toHaveDisplayValue('25.75');
  expect(screen.getByLabelText('Default group size')).toHaveDisplayValue('4');
  expect(screen.getByLabelText(radiusLabel)).toHaveDisplayValue('5.25');
  expect(screen.getByRole('checkbox', { name: 'Dinner' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Bike' })).toBeChecked();
  expect(mockFetch).not.toHaveBeenCalled();
});

it('updates guest defaults and can clear optional fields without turning zero into null', async () => {
  await saveGuestPreferences(saved);
  await render(<DefaultPreferencesScreen />);
  await ready();
  await fireEvent.changeText(screen.getByLabelText(budgetLabel), '0');
  await fireEvent.changeText(screen.getByLabelText('Default group size'), '');
  await fireEvent.changeText(screen.getByLabelText(radiusLabel), '');
  const user = userEvent.setup();
  for (const name of ['Dinner', 'Drinks', 'Walking', 'Bike'])
    await user.press(screen.getByRole('checkbox', { name }));
  await save();
  await screen.findByText('Preferences saved on this phone.');
  expect(await loadGuestPreferences()).toEqual({ ...emptyDefaults(), budgetPerPerson: 0 });
});

it('discards unsaved edits on reopening, following the existing back navigation behavior', async () => {
  await saveGuestPreferences(saved);
  const view = await render(<DefaultPreferencesScreen />);
  await ready();
  await fireEvent.changeText(screen.getByLabelText(budgetLabel), '99');
  await view.unmount();
  await render(<DefaultPreferencesScreen />);
  expect(await ready()).toHaveDisplayValue('25.75');
});

it('keeps guest edits after local save failure and succeeds on retry', async () => {
  await render(<DefaultPreferencesScreen />);
  await editAll();
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
  await save();
  await screen.findByText(/Could not access preferences on this phone/);
  expect(screen.getByLabelText(budgetLabel)).toHaveDisplayValue('25,75');
  expect(screen.queryByText('Preferences saved on this phone.')).not.toBeOnTheScreen();
  await save();
  await screen.findByText('Preferences saved on this phone.');
  expect(await loadGuestPreferences()).toEqual(saved);
});

it('offers a load retry and prevents overwriting unread defaults on storage failure', async () => {
  await saveGuestPreferences(saved);
  jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('unavailable'));
  await render(<DefaultPreferencesScreen />);
  await screen.findByText(/Could not access preferences on this phone/);
  expect(screen.queryByLabelText(budgetLabel)).not.toBeOnTheScreen();
  await userEvent.setup().press(screen.getByRole('button', { name: 'Retry loading preferences' }));
  expect(await ready()).toHaveDisplayValue('25.75');
});

it('rejects invalid numeric input next to the fields without writing to storage', async () => {
  await render(<DefaultPreferencesScreen />);
  await ready();
  const write = jest.spyOn(AsyncStorage, 'setItem');
  await fireEvent.changeText(screen.getByLabelText(budgetLabel), '-1');
  await fireEvent.changeText(screen.getByLabelText('Default group size'), '1.5');
  await fireEvent.changeText(screen.getByLabelText(radiusLabel), '31');
  await save();
  expect(screen.getByText(/Enter a budget from/)).toBeOnTheScreen();
  expect(screen.getByText('Enter a whole number from 1 to 20.')).toBeOnTheScreen();
  expect(screen.getByText(/Enter a distance from/)).toBeOnTheScreen();
  expect(write).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText(budgetLabel), '0');
  expect(screen.queryByText(/Enter a budget from/)).not.toBeOnTheScreen();
});

it('loads account preferences using bearer authentication and replaces all five fields on save', async () => {
  signedIn();
  mockFetch.mockResolvedValueOnce(response(emptyDefaults())).mockResolvedValueOnce(response(saved));
  await render(<DefaultPreferencesScreen />);
  await editAll();
  expect(mockFetch).toHaveBeenNthCalledWith(
    1,
    'http://api.test/api/users/me/preferences',
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer token-a' }),
    }),
  );
  await save();
  await screen.findByText('Preferences saved to your account.');
  const [, options] = mockFetch.mock.calls[1];
  expect(options.method).toBe('PUT');
  expect(JSON.parse(options.body)).toEqual(saved);
  expect(await loadGuestPreferences()).toEqual(emptyDefaults());
});

it('uses returned monetary rounding and loads the account again when reopened', async () => {
  signedIn();
  const view = await render(<DefaultPreferencesScreen />);
  expect(await ready()).toHaveDisplayValue('25.75');
  await fireEvent.changeText(screen.getByLabelText(budgetLabel), '26');
  mockFetch.mockResolvedValueOnce(response({ ...saved, budgetPerPerson: 26 }));
  await save();
  await screen.findByText('Preferences saved to your account.');
  mockFetch.mockResolvedValueOnce(response({ ...saved, budgetPerPerson: 26 }));
  await view.unmount();
  await render(<DefaultPreferencesScreen />);
  expect(await ready()).toHaveDisplayValue('26');
});

it.each([400, 401, 500])('preserves account edits and explains save failure %s', async (status) => {
  signedIn();
  await render(<DefaultPreferencesScreen />);
  await ready();
  await fireEvent.changeText(screen.getByLabelText(budgetLabel), '33');
  mockFetch.mockResolvedValueOnce(
    response({ errors: { BudgetPerPerson: ['Budget rejected.'] } }, status),
  );
  await save();
  const message =
    status === 400
      ? /Budget rejected/
      : status === 401
        ? /session is no longer valid/
        : /Something went wrong on our side/;
  await screen.findByText(message);
  expect(screen.getByLabelText(budgetLabel)).toHaveDisplayValue('33');
  expect(screen.queryByText('Preferences saved to your account.')).not.toBeOnTheScreen();
});

it('explains offline loading and retries without enabling an empty replacement', async () => {
  signedIn();
  mockFetch.mockRejectedValueOnce(new Error('offline'));
  await render(<DefaultPreferencesScreen />);
  await screen.findByText(/Can't reach LinkUp/);
  expect(screen.queryByLabelText(budgetLabel)).not.toBeOnTheScreen();
  await userEvent.setup().press(screen.getByRole('button', { name: 'Retry loading preferences' }));
  expect(await ready()).toHaveDisplayValue('25.75');
});

it('blocks editing until loading finishes so a late response cannot overwrite edits', async () => {
  signedIn();
  let finish!: (value: unknown) => void;
  mockFetch.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await render(<DefaultPreferencesScreen />);
  expect(screen.getByText('Loading preferences…')).toBeOnTheScreen();
  expect(screen.queryByLabelText(budgetLabel)).not.toBeOnTheScreen();
  await act(async () => {
    finish(response());
  });
  expect(await ready()).toHaveDisplayValue('25.75');
});

it('never mixes guest/account defaults, including a late response from a previous account', async () => {
  await saveGuestPreferences({ ...saved, budgetPerPerson: 10 });
  signedIn('a');
  let finish!: (value: unknown) => void;
  mockFetch.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const view = await render(<DefaultPreferencesScreen />);
  signedIn('b');
  mockFetch.mockResolvedValueOnce(response({ ...saved, budgetPerPerson: 50 }));
  await view.rerender(<DefaultPreferencesScreen />);
  expect(await ready()).toHaveDisplayValue('50');
  await act(async () => {
    finish(response({ ...saved, budgetPerPerson: 99 }));
  });
  expect(screen.getByLabelText(budgetLabel)).toHaveDisplayValue('50');
  mockAuth.user = null;
  mockAuth.accessToken = null;
  await view.rerender(<DefaultPreferencesScreen />);
  expect(await ready()).toHaveDisplayValue('10');
  expect(await loadGuestPreferences()).toEqual({ ...saved, budgetPerPerson: 10 });
  expect(mockFetch).toHaveBeenCalledTimes(2);
});

it('prevents duplicate saves and edits while a save is pending', async () => {
  signedIn();
  await render(<DefaultPreferencesScreen />);
  await ready();
  await fireEvent.changeText(screen.getByLabelText(budgetLabel), '30');
  let finish!: (value: unknown) => void;
  mockFetch.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await save();
  expect(screen.getByRole('button', { name: 'Saving preferences…' })).toBeDisabled();
  await userEvent.setup().press(screen.getByRole('button', { name: 'Saving preferences…' }));
  await fireEvent.changeText(screen.getByLabelText(budgetLabel), '88');
  expect(screen.getByLabelText(budgetLabel)).toHaveDisplayValue('30');
  expect(mockFetch).toHaveBeenCalledTimes(2);
  await act(async () => {
    finish(response({ ...saved, budgetPerPerson: 30 }));
  });
  await screen.findByText('Preferences saved to your account.');
});

it('ignores completed or failed saves after leaving the screen', async () => {
  signedIn();
  const view = await render(<DefaultPreferencesScreen />);
  await ready();
  await fireEvent.changeText(screen.getByLabelText(budgetLabel), '30');
  let fail!: (reason: Error) => void;
  mockFetch.mockReturnValueOnce(
    new Promise((_, reject) => {
      fail = reject;
    }),
  );
  await save();
  await view.unmount();
  await act(async () => {
    fail(new Error('offline'));
  });
  expect(await loadGuestPreferences()).toEqual(emptyDefaults());
});

it('works when React remounts effects in strict mode', async () => {
  await render(
    <StrictMode>
      <DefaultPreferencesScreen />
    </StrictMode>,
  );
  await ready();
  await fireEvent.changeText(screen.getByLabelText(budgetLabel), '0');
  await save();
  await screen.findByText('Preferences saved on this phone.');
});
