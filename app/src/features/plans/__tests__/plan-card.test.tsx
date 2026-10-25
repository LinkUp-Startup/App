import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  formatDistance,
  formatEuros,
  formatNightDate,
  formatTimeRange,
} from '@/features/plans/format';
import { PlanCard } from '@/features/plans/plan-card';

import { tapasPlan } from './fixtures/plans';

describe('PlanCard', () => {
  it.each([
    [12.5, 12.5], // One participant.
    [42, 168], // Four participants: use the API total, not another multiplication.
    [0, 0],
  ])('shows backend per-person %s and group total %s with cents', async (perPerson, total) => {
    await render(
      <PlanCard
        plan={{ ...tapasPlan, estimatedCostPerPerson: perPerson, estimatedTotalCost: total }}
      />,
    );
    expect(
      screen.getByText(`Estimated total for the group: €${total.toFixed(2)}`),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(`2 stops · estimated €${perPerson.toFixed(2)} per person · 910 m`),
    ).toBeOnTheScreen();
  });

  it('shows a single free stop and a free total', async () => {
    await render(
      <PlanCard
        plan={{
          ...tapasPlan,
          items: [{ ...tapasPlan.items[0], estimatedCostPerPerson: 0 }],
          estimatedCostPerPerson: 0,
          estimatedTotalCost: 0,
        }}
      />,
    );
    expect(screen.getByText('Estimated €0.00 per person')).toBeOnTheScreen();
    expect(screen.getByText('1 stop · estimated €0.00 per person · 910 m')).toBeOnTheScreen();
    expect(screen.getByText('Estimated total for the group: €0.00')).toBeOnTheScreen();
  });

  it('updates the prices when a different plan is shown', async () => {
    const view = await render(<PlanCard plan={tapasPlan} />);
    expect(screen.getByText('Estimated total for the group: €102.00')).toBeOnTheScreen();
    await view.rerender(
      <PlanCard
        plan={{
          ...tapasPlan,
          title: 'Another night',
          estimatedTotalCost: 49.99,
          items: [{ ...tapasPlan.items[0], estimatedCostPerPerson: 12.49 }],
        }}
      />,
    );
    expect(screen.getByText('Estimated total for the group: €49.99')).toBeOnTheScreen();
    expect(screen.getByText('Estimated €12.49 per person')).toBeOnTheScreen();
    expect(screen.queryByText('Estimated total for the group: €102.00')).toBeNull();
    expect(screen.getByRole('header', { name: 'Another night' })).toBeOnTheScreen();
  });

  it('handles legacy responses without pricing fields without inventing a total', async () => {
    const legacy = JSON.parse(JSON.stringify(tapasPlan));
    delete legacy.estimatedCostPerPerson;
    delete legacy.estimatedTotalCost;
    delete legacy.items[0].estimatedCostPerPerson;
    await render(<PlanCard plan={legacy} />);
    expect(screen.getByText('Estimated total for the group: price unavailable')).toBeOnTheScreen();
    expect(screen.getByText('Price unknown')).toBeOnTheScreen();
    expect(
      screen.getByText('Estimated €5.50 per person · 910 m from the previous stop'),
    ).toBeOnTheScreen();
  });

  it('shows the plan with its stops in order', async () => {
    await render(<PlanCard plan={tapasPlan} footer={<Text>Footer</Text>} />);

    expect(screen.getByRole('header', { name: 'Tapas and drinks' })).toBeOnTheScreen();
    expect(screen.getByText('Dinner in the old town, then a cocktail bar.')).toBeOnTheScreen();
    expect(screen.getByText('2 stops · estimated €25.50 per person · 910 m')).toBeOnTheScreen();

    const stops = screen.getAllByLabelText(/^Stop \d/);
    expect(stops.map((stop) => stop.props.accessibilityLabel)).toEqual([
      'Stop 1: Teresa Carles, Dinner, 20:30-22:00, Estimated €20.00 per person',
      'Stop 2: Pub Legend, Drinks, 22:15-23:45, Estimated €5.50 per person',
    ]);
    expect(screen.getByText('Carrer Major 1, Lleida')).toBeOnTheScreen();
    expect(screen.getByText('Estimated €20.00 per person')).toBeOnTheScreen();
    expect(
      screen.getByText('Estimated €5.50 per person · 910 m from the previous stop'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Footer')).toBeOnTheScreen();
  });

  it('says when a price is unknown instead of showing €0', async () => {
    const [dinner, drinks] = tapasPlan.items;
    await render(
      <PlanCard
        plan={{
          ...tapasPlan,
          items: [dinner, { ...drinks, estimatedCostPerPerson: null }],
          estimatedCostPerPerson: null,
          estimatedTotalCost: null,
        }}
      />,
    );

    expect(screen.getByText('2 stops · price unknown · 910 m')).toBeOnTheScreen();
    expect(screen.getByText('Estimated total for the group: price unavailable')).toBeOnTheScreen();
    expect(screen.getByText('Estimated €20.00 per person')).toBeOnTheScreen();
    expect(screen.getByText('Price unknown · 910 m from the previous stop')).toBeOnTheScreen();
  });

  it('leaves out an empty summary', async () => {
    await render(<PlanCard plan={{ ...tapasPlan, summary: '', items: [] }} />);

    expect(screen.getByText('0 stops · estimated €25.50 per person · 910 m')).toBeOnTheScreen();
    expect(screen.queryByText('Dinner in the old town, then a cocktail bar.')).toBeNull();
  });
});

describe('plan formatting', () => {
  it('formats times, prices, distances and dates', () => {
    expect(formatTimeRange('2026-10-30T19:30:00Z', '2026-10-30T23:05:00Z')).toBe('20:30-00:05');
    expect(formatEuros(25.5)).toBe('€25.50');
    expect(formatEuros(null)).toBe('price unknown');
    expect(formatDistance(0.4)).toBe('400 m');
    expect(formatDistance(1.25)).toBe('1.3 km');
    expect(formatNightDate('2026-10-30T19:30:00Z')).toBe('Fri 30 Oct');
  });
});
