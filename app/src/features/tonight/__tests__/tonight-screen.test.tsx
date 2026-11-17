import { act, render, screen, userEvent, within } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppState, Linking } from 'react-native';

import TonightScreen from '@/app/tonight/[id]';
import { tapasPlan } from '@/features/plans/__tests__/fixtures/plans';
import * as storage from '@/storage/saved-plans';
import type { Plan } from '@/types/api';

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

// Teresa Carles 19:30-21:00 UTC, Pub Legend 21:15-22:45 UTC (0.91 km), and a club for the "Later" mark.
const threeStops: Plan = {
  ...tapasPlan,
  items: [
    ...tapasPlan.items,
    {
      ...tapasPlan.items[1],
      venue: { ...tapasPlan.items[1].venue, id: '9', name: 'Club Nit' },
      startTime: '2026-10-30T23:00:00Z',
      endTime: '2026-10-31T02:00:00Z',
      distanceKm: 0,
    },
  ],
};

function at(iso: string) {
  jest.useFakeTimers({ now: new Date(iso), doNotFake: ['nextTick', 'setImmediate'] });
}

async function open(plan: Plan = tapasPlan) {
  await storage.savePlan(plan);
  await render(<TonightScreen />);
  await screen.findByText(plan.title);
}

const rowLabels = () =>
  within(screen.getByLabelText('All stops tonight'))
    .getAllByText(/^(Done|Now|Next|Later)$/)
    .map((node) => node.props.children);

beforeEach(() => jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'p1' }));

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('TonightScreen', () => {
  it('counts down to the first stop and gives directions to it', async () => {
    at('2026-10-30T18:00:00Z');
    const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await open();

    expect(screen.getByText('First stop')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Teresa Carles' })).toBeOnTheScreen();
    expect(screen.getByText('In 1 h 30 min')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Directions to Teresa Carles' }));
    expect(openUrl).toHaveBeenCalledWith(
      'https://www.google.com/maps/search/?api=1&query=41.6,0.6',
    );
  });

  it('shows the current stop, the time left and the next stop', async () => {
    at('2026-10-30T20:35:00Z');
    await open(threeStops);

    expect(screen.getByText("You're at")).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Teresa Carles' })).toBeOnTheScreen();
    expect(screen.getByText(/25 min left$/)).toBeOnTheScreen();
    expect(screen.getByText(/, 910 m from here$/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Directions to Pub Legend' })).toBeOnTheScreen();
    expect(rowLabels()).toEqual(['Now', 'Next', 'Later']);
  });

  it('shows the way to the next stop between two stops', async () => {
    at('2026-10-30T21:05:00Z');
    await open(threeStops);

    expect(screen.getByText('On the way to')).toBeOnTheScreen();
    expect(screen.getByText('In 10 min')).toBeOnTheScreen();
    expect(rowLabels()).toEqual(['Done', 'Next', 'Later']);
  });

  it('gives directions to the last stop while there', async () => {
    at('2026-10-30T22:00:00Z');
    await open();

    expect(screen.queryByText(/from here$/)).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Directions to Pub Legend' })).toBeOnTheScreen();
    expect(rowLabels()).toEqual(['Done', 'Now']);
  });

  it('says the night is over after the last stop', async () => {
    at('2026-10-30T23:00:00Z');
    await open();

    expect(screen.getByText("That's the night.")).toBeOnTheScreen();
    expect(screen.queryByLabelText('All stops tonight')).not.toBeOnTheScreen();
  });

  it('moves on as time passes', async () => {
    at('2026-10-30T20:59:50Z');
    await open();
    expect(screen.getByText(/1 min left$/)).toBeOnTheScreen();

    await act(async () => {
      jest.advanceTimersByTime(15_000);
    });

    expect(screen.getByText('On the way to')).toBeOnTheScreen();
  });

  it('catches up when the app comes back to the front', async () => {
    at('2026-10-30T18:00:00Z');
    const listen = jest.spyOn(AppState, 'addEventListener');
    await open();
    const onChange = listen.mock.calls.at(-1)![1] as (state: string) => void;

    jest.setSystemTime(new Date('2026-10-30T23:00:00Z'));
    await act(async () => onChange('background'));
    expect(screen.queryByText("That's the night.")).not.toBeOnTheScreen();
    await act(async () => onChange('active'));

    expect(screen.getByText("That's the night.")).toBeOnTheScreen();
  });

  it('explains when the plan is no longer saved', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'gone' });
    const user = userEvent.setup();
    await render(<TonightScreen />);

    await user.press(await screen.findByRole('button', { name: 'Back' }));
    expect(screen.getByText('This plan is no longer saved.')).toBeOnTheScreen();
    expect(router.back).toHaveBeenCalled();
  });

  it('explains when the plan cannot be read', async () => {
    jest.spyOn(storage, 'getSavedPlan').mockRejectedValue(new Error('broken'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await render(<TonightScreen />);

    expect(await screen.findByText('This plan is no longer saved.')).toBeOnTheScreen();
  });
});
