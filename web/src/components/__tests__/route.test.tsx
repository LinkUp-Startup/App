import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Route, type RouteStop } from '../route';

const stop = (overrides: Partial<RouteStop>): RouteStop => ({
  name: 'Cantamanyanes',
  activity: 'dinner',
  address: 'Carrer de Jaume II, 55',
  latitude: 41.62,
  longitude: 0.62,
  startTime: '2026-11-06T19:30:00Z',
  endTime: '2026-11-06T21:15:00Z',
  costPerPerson: 18,
  distanceKm: 0,
  ...overrides,
});

const night = [
  stop({}),
  stop({
    name: 'Traganits',
    activity: 'club',
    address: 'Carrer Darrera Sant Martí, 57',
    startTime: '2026-11-06T23:30:00Z',
    endTime: '2026-11-07T03:00:00Z',
    costPerPerson: null,
    distanceKm: 1.9,
  }),
];

describe('Route', () => {
  it('lists the stops in order with their times, activity, address and price', () => {
    render(<Route stops={night} />);

    const [first, second] = screen.getAllByRole('listitem');
    expect(within(first).getByRole('heading', { name: 'Cantamanyanes' })).toBeInTheDocument();
    expect(within(first).getByText('20:30')).toBeInTheDocument();
    expect(within(first).getByText('until 22:15')).toBeInTheDocument();
    expect(within(first).getByText('Dinner, Carrer de Jaume II, 55')).toBeInTheDocument();
    expect(within(first).getByText('About €18 per person')).toBeInTheDocument();
    expect(within(second).getByText('00:30')).toBeInTheDocument();
    expect(within(second).getByText('Price not known')).toBeInTheDocument();
  });

  it('shows the distance from the previous stop, not before the first one', () => {
    render(<Route stops={night} />);

    const [first, second] = screen.getAllByRole('listitem');
    expect(within(first).queryByText(/to here/)).not.toBeInTheDocument();
    expect(within(second).getByText('1.9 km to here')).toBeInTheDocument();
  });

  it('links every stop to directions in Google Maps', () => {
    render(<Route stops={night} />);

    const link = screen.getByRole('link', { name: 'Directions to Traganits (opens Google Maps)' });
    expect(link).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=41.62,0.62',
    );
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('leaves out directions for the example on the home page', () => {
    render(<Route stops={night} withDirections={false} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
