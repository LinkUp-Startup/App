import { render, screen, userEvent } from '@testing-library/react-native';

import { NetworkError } from '@/api/client';
import { swapOptions } from '@/api/plans';
import { planChange, SwapStopSheet } from '@/features/plans/swap-stop';
import type { SavedPlan } from '@/storage/saved-plans';
import type { Plan } from '@/types/api';

import { tapasPlan } from './fixtures/plans';

jest.mock('@/api/plans', () => ({ swapOptions: jest.fn() }));

// Teresa Carles (dinner, €20) swapped for a cheaper place a bit further away.
const swapped: Plan = {
  ...tapasPlan,
  items: [
    {
      ...tapasPlan.items[0],
      venue: { ...tapasPlan.items[0].venue, id: '30', name: 'Casa Pepe', address: 'Plaça 3' },
      estimatedCostPerPerson: 15,
    },
    tapasPlan.items[1],
  ],
  estimatedCostPerPerson: 20.5,
  totalDistanceKm: 1.31,
};

afterEach(() => jest.clearAllMocks());

async function open(props: Partial<Parameters<typeof SwapStopSheet>[0]> = {}) {
  const onChoose = jest.fn();
  const onClose = jest.fn();
  const view = await render(
    <SwapStopSheet
      plan={tapasPlan}
      stopIndex={0}
      onChoose={onChoose}
      onClose={onClose}
      {...props}
    />,
  );
  return { onChoose, onClose, view };
}

describe('SwapStopSheet', () => {
  it('shows the other places with what they change, and swaps to the one picked', async () => {
    jest.mocked(swapOptions).mockResolvedValue({ options: [swapped] });
    const user = userEvent.setup();
    const { onChoose } = await open();

    expect(await screen.findByRole('header', { name: 'Swap Teresa Carles' })).toBeOnTheScreen();
    expect(await screen.findByText('Casa Pepe')).toBeOnTheScreen();
    expect(screen.getByText('Estimated €15.00 per person')).toBeOnTheScreen();
    expect(screen.getByText('Plan: €5.00 less per person, 0.4 km more in total')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Swap to Casa Pepe' }));
    expect(onChoose).toHaveBeenCalledWith(swapped);
  });

  it('sends only the plan fields, the stop and what the screen knows about the night', async () => {
    jest.mocked(swapOptions).mockResolvedValue({ options: [] });
    const saved: SavedPlan = { ...tapasPlan, savedAt: '2026-10-29T10:00:00Z', synced: true };
    await open({
      plan: saved,
      stopIndex: 1,
      context: { budgetPerPerson: 30, groupSize: 4 },
    });

    await screen.findByText(/No other place fits this stop/);
    expect(swapOptions).toHaveBeenCalledWith(
      { plan: tapasPlan, stopIndex: 1, budgetPerPerson: 30, groupSize: 4 },
      expect.any(AbortSignal),
    );
  });

  it('explains a failure and tries again', async () => {
    jest
      .mocked(swapOptions)
      .mockRejectedValueOnce(new NetworkError('offline'))
      .mockResolvedValueOnce({ options: [swapped] });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    await open();

    expect(await screen.findByText(/Can't reach LinkUp right now/)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Casa Pepe')).toBeOnTheScreen();
    expect(swapOptions).toHaveBeenCalledTimes(2);
  });

  it('says when the price of a place is not known', async () => {
    const unpriced = {
      ...swapped,
      items: [{ ...swapped.items[0], estimatedCostPerPerson: null }, swapped.items[1]],
      estimatedCostPerPerson: null,
    };
    jest.mocked(swapOptions).mockResolvedValue({ options: [unpriced] });
    await open();

    expect(await screen.findByText('Price unknown')).toBeOnTheScreen();
    expect(screen.getByText('Plan: 0.4 km more in total')).toBeOnTheScreen();
  });

  it('keeps the stop when closed', async () => {
    jest.mocked(swapOptions).mockResolvedValue({ options: [] });
    const user = userEvent.setup();
    const { onClose } = await open();

    await user.press(await screen.findByRole('button', { name: 'Keep this stop' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('stays closed and asks for nothing without a stop', async () => {
    await open({ stopIndex: null });

    expect(screen.queryByRole('header')).not.toBeOnTheScreen();
    expect(swapOptions).not.toHaveBeenCalled();
  });

  it('ignores an answer that comes after it was closed', async () => {
    let finish: (value: { options: Plan[] }) => void = () => {};
    jest.mocked(swapOptions).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { view } = await open();

    await view.unmount();
    finish({ options: [swapped] });
    // No state update after unmount: nothing to assert beyond not throwing.
    expect(swapOptions).toHaveBeenCalledTimes(1);
  });

  it('ignores a failure after it was closed', async () => {
    let fail: (error: Error) => void = () => {};
    jest.mocked(swapOptions).mockReturnValue(new Promise((_, reject) => (fail = reject)));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { view } = await open();

    await view.unmount();
    fail(new Error('aborted'));
    await Promise.resolve();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('planChange', () => {
  it('says what a swap does to the price and the distance', () => {
    expect(planChange(tapasPlan, swapped)).toBe(
      'Plan: €5.00 less per person, 0.4 km more in total',
    );
    expect(planChange(swapped, tapasPlan)).toBe(
      'Plan: €5.00 more per person, 0.4 km less in total',
    );
    expect(planChange(tapasPlan, tapasPlan)).toBe('Plan: same price, same distance');
  });

  it('leaves out the price when it is not known', () => {
    expect(planChange({ ...tapasPlan, estimatedCostPerPerson: null }, swapped)).toBe(
      'Plan: 0.4 km more in total',
    );
  });
});
