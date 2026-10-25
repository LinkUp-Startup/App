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
  it('shows the plan with its stops in order', async () => {
    await render(<PlanCard plan={tapasPlan} footer={<Text>Footer</Text>} />);

    expect(screen.getByRole('header', { name: 'Tapas and drinks' })).toBeOnTheScreen();
    expect(screen.getByText('Dinner in the old town, then a cocktail bar.')).toBeOnTheScreen();
    expect(screen.getByText('2 stops · ~€26 per person · 910 m')).toBeOnTheScreen();

    const stops = screen.getAllByLabelText(/^Stop \d/);
    expect(stops.map((stop) => stop.props.accessibilityLabel)).toEqual([
      'Stop 1: Teresa Carles, Dinner, 20:30–22:00',
      'Stop 2: Pub Legend, Drinks, 22:15–23:45',
    ]);
    expect(screen.getByText('Carrer Major 1, Lleida')).toBeOnTheScreen();
    expect(screen.getByText('~€20 per person')).toBeOnTheScreen();
    expect(screen.getByText('~€6 per person · 910 m from the previous stop')).toBeOnTheScreen();
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
    expect(screen.getByText('~€20 per person')).toBeOnTheScreen();
    expect(screen.getByText('Price unknown · 910 m from the previous stop')).toBeOnTheScreen();
  });

  it('shows how far the first stop is from the start', async () => {
    const [dinner, drinks] = tapasPlan.items;
    await render(
      <PlanCard plan={{ ...tapasPlan, items: [{ ...dinner, distanceKm: 1.2 }, drinks] }} />,
    );

    expect(screen.getByText('~€20 per person · 1.2 km from your start')).toBeOnTheScreen();
  });

  it('leaves out an empty summary', async () => {
    await render(<PlanCard plan={{ ...tapasPlan, summary: '', items: [] }} />);

    expect(screen.getByText('0 stops · ~€26 per person · 910 m')).toBeOnTheScreen();
    expect(screen.queryByText('Dinner in the old town, then a cocktail bar.')).toBeNull();
  });
});

describe('plan formatting', () => {
  it('formats times, prices, distances and dates', () => {
    expect(formatTimeRange('2026-10-30T19:30:00Z', '2026-10-30T23:05:00Z')).toBe('20:30–00:05');
    expect(formatEuros(25.5)).toBe('~€26');
    expect(formatEuros(null)).toBe('price unknown');
    expect(formatDistance(0.4)).toBe('400 m');
    expect(formatDistance(1.25)).toBe('1.3 km');
    expect(formatNightDate('2026-10-30T19:30:00Z')).toBe('Fri 30 Oct');
  });
});
