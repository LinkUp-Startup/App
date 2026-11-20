import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import PreferencesScreen from '@/app/(tabs)/index';
import DefaultPreferencesScreen from '@/app/default-preferences';
import { emptyDefaults } from '@/features/preferences/defaults-form';
import { loadGuestPreferences, saveGuestPreferences } from '@/storage/guest-preferences';
import type { NightPreferences, User, UserPreferences } from '@/types/api';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  type MockEffect = () => void | (() => void);
  const effects = new Map<MockEffect, { cleanup: void | (() => void) }>();
  return {
    router: { push: jest.fn() },
    useFocusEffect: (effect: MockEffect) =>
      useEffect(() => {
        const entry = { cleanup: effect() };
        effects.set(effect, entry);
        return () => {
          entry.cleanup?.();
          effects.delete(effect);
        };
      }, [effect]),
    __refocus: () =>
      effects.forEach((entry, effect) => {
        entry.cleanup?.();
        entry.cleanup = effect();
      }),
  };
});
jest.mock('@/components/api-status', () => ({ ApiStatus: () => null }));
jest.mock('expo-location', () => ({ reverseGeocodeAsync: jest.fn().mockResolvedValue([]) }));
const mockAuth = { status: 'ready', user: null as User | null, accessToken: null as string | null };
jest.mock('@/features/auth/auth-context', () => ({ useAuth: () => mockAuth }));
const mockFetch = jest.fn();
const originalFetch = globalThis.fetch;
const saved: UserPreferences = {
  budgetPerPerson: 0,
  groupSize: 4,
  maxDistanceKm: 5.25,
  activities: ['dinner', 'drinks'],
  transport: ['bike', 'car'],
};
const reply = (values: unknown = saved, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => values,
  text: async () => JSON.stringify(values),
});
const budget = () => screen.getByLabelText('Budget per person in euros');
const loading = /Loading saved defaults/;
async function loaded() {
  await screen.findByText(/Changes here only affect this plan/);
  await act(async () => {});
  expect(screen.queryByText(loading)).not.toBeOnTheScreen();
}
const refocus = () =>
  act(() => jest.requireMock<{ __refocus: () => void }>('expo-router').__refocus());
function signIn(id = 'a') {
  mockAuth.user = { id, email: `${id}@example.com`, displayName: id };
  mockAuth.accessToken = `token-${id}`;
}
function submitted(): NightPreferences {
  const [href] = jest.mocked(router.push).mock.calls.at(-1)!;
  return JSON.parse((href as unknown as { params: { preferences: string } }).params.preferences);
}
async function generate() {
  await userEvent.setup().press(screen.getByRole('button', { name: 'Generate plans' }));
}
async function overrideAll() {
  await fireEvent.changeText(budget(), '100');
  const user = userEvent.setup();
  await user.press(screen.getByRole('button', { name: 'Increase group size' }));
  await user.press(screen.getByRole('button', { name: 'Increase maximum distance' }));
  for (const name of ['Dinner', 'Cinema', 'Bike', 'Taxi'])
    await user.press(screen.getByRole('checkbox', { name }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.status = 'ready';
  mockAuth.user = null;
  mockAuth.accessToken = null;
  mockFetch.mockReset().mockResolvedValue(reply());
  globalThis.fetch = mockFetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
});

it.each(['guest', 'account'])(
  'saves through the %s editor, restores both screens and submits overrides without changing saved defaults',
  async (kind) => {
    let accountValues = emptyDefaults();
    if (kind === 'account') {
      signIn();
      mockFetch.mockImplementation(async (_url: string, request: RequestInit) => {
        expect(request.headers).toEqual(
          expect.objectContaining({ Authorization: 'Bearer token-a' }),
        );
        if (request.method === 'PUT') accountValues = JSON.parse(request.body as string);
        return reply(accountValues);
      });
    }
    const editor = await render(<DefaultPreferencesScreen />);
    await screen.findByLabelText('Default budget per person in euros');
    await fireEvent.changeText(screen.getByLabelText('Default budget per person in euros'), '0');
    await fireEvent.changeText(screen.getByLabelText('Default group size'), '4');
    await fireEvent.changeText(
      screen.getByLabelText('Default maximum distance in kilometres'),
      '5.25',
    );
    const user = userEvent.setup();
    for (const name of ['Dinner', 'Drinks', 'Bike', 'Car'])
      await user.press(screen.getByRole('checkbox', { name }));
    await user.press(screen.getByRole('button', { name: 'Save preferences' }));
    await screen.findByText(
      kind === 'guest' ? 'Preferences saved on this phone.' : 'Preferences saved to your account.',
    );
    await editor.unmount();

    const plan = await render(<PreferencesScreen />);
    await loaded();
    expect(budget()).toHaveDisplayValue('0');
    expect(screen.getByLabelText('Group size')).toHaveAccessibilityValue({ now: 4 });
    expect(screen.getByLabelText('Maximum distance')).toHaveAccessibilityValue({ now: 5.25 });
    for (const name of ['Dinner', 'Drinks', 'Bike', 'Car'])
      expect(screen.getByRole('checkbox', { name })).toBeChecked();
    await overrideAll();
    await generate();
    expect(submitted()).toMatchObject({
      budgetPerPerson: 100,
      groupSize: 5,
      maxDistanceKm: 5.75,
      activities: ['drinks', 'cinema'],
      transport: ['car', 'taxi'],
    });
    await plan.unmount();

    await render(<DefaultPreferencesScreen />);
    expect(await screen.findByLabelText('Default budget per person in euros')).toHaveDisplayValue(
      '0',
    );
    expect(screen.getByLabelText('Default group size')).toHaveDisplayValue('4');
    expect(screen.getByLabelText('Default maximum distance in kilometres')).toHaveDisplayValue(
      '5.25',
    );
    for (const name of ['Dinner', 'Drinks', 'Bike', 'Car'])
      expect(screen.getByRole('checkbox', { name })).toBeChecked();
    if (kind === 'guest') {
      expect(await loadGuestPreferences()).toEqual(saved);
      expect(mockFetch).not.toHaveBeenCalled();
    } else {
      expect(accountValues).toEqual(saved);
      expect(mockFetch.mock.calls.filter(([, request]) => request.method === 'PUT')).toHaveLength(
        1,
      );
      expect(await loadGuestPreferences()).toEqual(emptyDefaults());
    }
  },
);

it('waits for authentication restoration before loading any preferences', async () => {
  mockAuth.status = 'loading';
  const read = jest.spyOn(AsyncStorage, 'getItem');
  const view = await render(<PreferencesScreen />);
  expect(screen.getByText('Loading your session…')).toBeOnTheScreen();
  expect(read).not.toHaveBeenCalled();
  expect(mockFetch).not.toHaveBeenCalled();
  signIn();
  mockAuth.status = 'ready';
  await view.rerender(<PreferencesScreen />);
  await loaded();
  expect(budget()).toHaveDisplayValue('0');
});

it.each(['guest', 'account'])(
  'prefills all five categories for a %s and submits zero without conversion loss',
  async (kind) => {
    if (kind === 'guest') await saveGuestPreferences(saved);
    else signIn();
    await render(<PreferencesScreen />);
    await loaded();
    expect(budget()).toHaveDisplayValue('0');
    expect(screen.getByLabelText('Group size')).toHaveAccessibilityValue({ now: 4 });
    expect(screen.getByLabelText('Maximum distance')).toHaveAccessibilityValue({ now: 5.25 });
    for (const name of ['Dinner', 'Drinks', 'Bike', 'Car'])
      expect(screen.getByRole('checkbox', { name })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Walking' })).not.toBeChecked();
    await generate();
    expect(submitted()).toMatchObject({
      budgetPerPerson: 0,
      groupSize: 4,
      maxDistanceKm: 5.25,
      activities: ['dinner', 'drinks'],
      transport: ['bike', 'car'],
    });
    if (kind === 'guest') expect(mockFetch).not.toHaveBeenCalled();
    else
      expect(mockFetch).toHaveBeenCalledWith(
        'http://api.test/api/users/me/preferences',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token-a' }),
        }),
      );
  },
);

it.each(['guest', 'account'])(
  'lets a %s override every category without saving defaults',
  async (kind) => {
    if (kind === 'guest') await saveGuestPreferences(saved);
    else signIn();
    const write = jest.spyOn(AsyncStorage, 'setItem').mockClear();
    await render(<PreferencesScreen />);
    await loaded();
    await overrideAll();
    await generate();
    expect(submitted()).toMatchObject({
      budgetPerPerson: 100,
      groupSize: 5,
      maxDistanceKm: 5.75,
      activities: ['drinks', 'cinema'],
      transport: ['car', 'taxi'],
    });
    expect(write).not.toHaveBeenCalled();
    expect(await loadGuestPreferences()).toEqual(kind === 'guest' ? saved : emptyDefaults());
    expect(mockFetch).toHaveBeenCalledTimes(kind === 'guest' ? 0 : 1);
  },
);

it.each(['guest', 'account'])(
  'keeps normal defaults when a %s has saved no preferences',
  async (kind) => {
    if (kind === 'account') {
      signIn();
      mockFetch.mockResolvedValue(reply(emptyDefaults()));
    }
    await render(<PreferencesScreen />);
    await loaded();
    expect(budget()).toHaveDisplayValue('30');
    expect(screen.getByLabelText('Group size')).toHaveAccessibilityValue({ now: 2 });
    expect(screen.getByLabelText('Maximum distance')).toHaveAccessibilityValue({ now: 3 });
    expect(screen.getByRole('checkbox', { name: 'Walking' })).toBeChecked();
    await generate();
    expect(screen.getByText('Pick at least one activity.')).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();
  },
);

it('preserves normal defaults for individual unspecified fields and legacy empty lists', async () => {
  signIn();
  mockFetch.mockResolvedValue(
    reply({ ...emptyDefaults(), groupSize: 7, activities: [], transport: [] }),
  );
  await render(<PreferencesScreen />);
  await loaded();
  expect(budget()).toHaveDisplayValue('30');
  expect(screen.getByLabelText('Group size')).toHaveAccessibilityValue({ now: 7 });
  expect(screen.getByLabelText('Maximum distance')).toHaveAccessibilityValue({ now: 3 });
  expect(screen.getByRole('checkbox', { name: 'Walking' })).toBeChecked();
});

it('keeps the plan usable when the authenticated API fails without falling back to guest data', async () => {
  await saveGuestPreferences(saved);
  signIn();
  mockFetch.mockRejectedValueOnce(new Error('offline'));
  const read = jest.spyOn(AsyncStorage, 'getItem').mockClear();
  await render(<PreferencesScreen />);
  await screen.findByText(/Could not load your account defaults/);
  expect(budget()).toHaveDisplayValue('30');
  expect(read).not.toHaveBeenCalled();
  await userEvent.setup().press(screen.getByRole('checkbox', { name: 'Drinks' }));
  await generate();
  expect(submitted()).toMatchObject({ budgetPerPerson: 30, groupSize: 2, activities: ['drinks'] });
});

it('keeps guest planning usable after local read failure', async () => {
  jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('unavailable'));
  await render(<PreferencesScreen />);
  await screen.findByText(/Could not load defaults from this phone/);
  expect(budget()).toHaveDisplayValue('30');
  expect(mockFetch).not.toHaveBeenCalled();
});

it.each([
  '{broken',
  '{"version":2,"preferences":{}}',
  '{"version":1,"preferences":{"budgetPerPerson":-1}}',
])('handles corrupted or outdated guest storage safely: %s', async (raw) => {
  await AsyncStorage.setItem('linkup.guestPreferences.v1', raw);
  await render(<PreferencesScreen />);
  await loaded();
  expect(budget()).toHaveDisplayValue('30');
  expect(mockFetch).not.toHaveBeenCalled();
});

it.each([
  { ...saved, budgetPerPerson: -1 },
  { ...saved, groupSize: 1.5 },
  { ...saved, maxDistanceKm: 31 },
  { ...saved, activities: ['unknown'] },
  { ...saved, transport: ['spaceship'] },
  { ...saved, activities: ['dinner', 'dinner'] },
])(
  'rejects invalid/outdated API defaults rather than bypassing validation: %#',
  async (invalid) => {
    signIn();
    mockFetch.mockResolvedValue(reply(invalid));
    await render(<PreferencesScreen />);
    await screen.findByText(/Saved defaults are no longer valid/);
    expect(budget()).toHaveDisplayValue('30');
    await generate();
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByText('Pick at least one activity.')).toBeOnTheScreen();
  },
);

it('preserves edits made during loading and prefills only untouched fields', async () => {
  signIn();
  let finish!: (value: unknown) => void;
  mockFetch.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await render(<PreferencesScreen />);
  expect(screen.getByText(loading)).toBeOnTheScreen();
  await fireEvent.changeText(budget(), '77');
  // The optional notes start folded away; unfold them to type.
  await fireEvent.press(
    screen.getByRole('button', { name: 'Special vibe and dietary preferences' }),
  );
  await fireEvent.changeText(screen.getByLabelText('Additional preferences'), 'quiet places');
  await userEvent.setup().press(screen.getByRole('checkbox', { name: 'Cinema' }));
  await userEvent.setup().press(screen.getByRole('checkbox', { name: 'Walking' }));
  await act(async () => {
    finish(reply());
  });
  await loaded();
  expect(budget()).toHaveDisplayValue('77');
  expect(screen.getByRole('checkbox', { name: 'Cinema' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Dinner' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Walking' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Bike' })).not.toBeChecked();
  expect(screen.getByLabelText('Group size')).toHaveAccessibilityValue({ now: 4 });
  expect(screen.getByLabelText('Maximum distance')).toHaveAccessibilityValue({ now: 5.25 });
  expect(screen.getByLabelText('Additional preferences')).toHaveDisplayValue('quiet places');
  await generate();
  expect(screen.getByText('Pick at least one way to get around.')).toBeOnTheScreen();
});

it('does not initialize after generation has already used the current values', async () => {
  signIn();
  let finish!: (value: unknown) => void;
  mockFetch.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await render(<PreferencesScreen />);
  await userEvent.setup().press(screen.getByRole('checkbox', { name: 'Drinks' }));
  await generate();
  expect(submitted()).toMatchObject({ budgetPerPerson: 30, groupSize: 2, activities: ['drinks'] });
  await act(async () => {
    finish(reply());
  });
  await loaded();
  expect(budget()).toHaveDisplayValue('30');
  expect(screen.getByLabelText('Group size')).toHaveAccessibilityValue({ now: 2 });
});

it('preserves the active draft across rerenders and tab returns without duplicate requests', async () => {
  signIn();
  const view = await render(<PreferencesScreen />);
  await loaded();
  await overrideAll();
  await view.rerender(<PreferencesScreen />);
  await refocus();
  expect(budget()).toHaveDisplayValue('100');
  expect(screen.getByLabelText('Group size')).toHaveAccessibilityValue({ now: 5 });
  expect(mockFetch).toHaveBeenCalledTimes(1);
  await generate();
  await refocus();
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(submitted()).toMatchObject({ budgetPerPerson: 100, maxDistanceKm: 5.75 });
});

it('refreshes an untouched form on return, including defaults cleared in the account screen', async () => {
  signIn();
  await render(<PreferencesScreen />);
  await loaded();
  expect(budget()).toHaveDisplayValue('0');
  mockFetch.mockResolvedValueOnce(reply(emptyDefaults()));
  await refocus();
  await loaded();
  expect(budget()).toHaveDisplayValue('30');
  expect(screen.getByRole('checkbox', { name: 'Walking' })).toBeChecked();
  expect(mockFetch).toHaveBeenCalledTimes(2);
});

it('starts a new plan explicitly, reloading saved values without persisting plan overrides', async () => {
  await saveGuestPreferences(saved);
  const view = await render(<PreferencesScreen />);
  await loaded();
  await overrideAll();
  await userEvent.setup().press(screen.getByRole('button', { name: 'Start a new plan' }));
  await loaded();
  expect(budget()).toHaveDisplayValue('0');
  expect(screen.getByLabelText('Group size')).toHaveAccessibilityValue({ now: 4 });
  expect(await loadGuestPreferences()).toEqual(saved);
  await view.unmount();
  await render(<PreferencesScreen />);
  await loaded();
  expect(budget()).toHaveDisplayValue('0');
});

it('isolates accounts, logout and late results from a previous identity', async () => {
  await saveGuestPreferences({ ...saved, budgetPerPerson: 10 });
  signIn('a');
  let finish!: (value: unknown) => void;
  mockFetch.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const view = await render(<PreferencesScreen />);
  await fireEvent.changeText(budget(), '99');
  signIn('b');
  mockFetch.mockResolvedValueOnce(reply({ ...saved, budgetPerPerson: 50 }));
  await view.rerender(<PreferencesScreen />);
  await loaded();
  expect(budget()).toHaveDisplayValue('50');
  await act(async () => {
    finish(reply({ ...saved, budgetPerPerson: 200 }));
  });
  expect(budget()).toHaveDisplayValue('50');
  mockAuth.user = null;
  mockAuth.accessToken = null;
  await view.rerender(<PreferencesScreen />);
  await loaded();
  expect(budget()).toHaveDisplayValue('10');
  expect(mockFetch).toHaveBeenCalledTimes(2);
});

it('ignores failed loads after leaving and does not keep a cancelled request loading forever', async () => {
  signIn();
  let fail!: (reason: Error) => void;
  mockFetch.mockReturnValueOnce(
    new Promise((_, reject) => {
      fail = reject;
    }),
  );
  await render(<PreferencesScreen />);
  await fireEvent.changeText(budget(), '90');
  await refocus();
  expect(screen.queryByText(loading)).not.toBeOnTheScreen();
  await act(async () => {
    fail(new Error('offline'));
  });
  expect(screen.queryByText(/Could not load your account defaults/)).not.toBeOnTheScreen();
  expect(budget()).toHaveDisplayValue('90');
});

it('uses the existing manual validation for invalid overrides after prefilling', async () => {
  await saveGuestPreferences(saved);
  await render(<PreferencesScreen />);
  await loaded();
  await fireEvent.changeText(budget(), '-1');
  await generate();
  expect(screen.getByText('Enter an amount in euros, e.g. 25 or 12.50.')).toBeOnTheScreen();
  expect(router.push).not.toHaveBeenCalled();
  expect(await loadGuestPreferences()).toEqual(saved);
});
