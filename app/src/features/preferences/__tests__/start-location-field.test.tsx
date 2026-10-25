import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { useState } from 'react';

import { getDeviceLocation, describePlace } from '@/features/preferences/location';
import { StartLocationField } from '@/features/preferences/start-location-field';
import type { GeoPoint } from '@/types/api';

jest.mock('@/features/preferences/location', () => ({
  ...jest.requireActual('@/features/preferences/location'),
  getDeviceLocation: jest.fn(),
  describePlace: jest.fn(),
}));

const animateToRegion = jest.requireMock<{ __animateToRegion: jest.Mock }>(
  'react-native-maps',
).__animateToRegion;

function Field({ initial, radiusKm = 3 }: { initial?: GeoPoint; radiusKm?: number }) {
  const [value, setValue] = useState(initial);
  return <StartLocationField value={value} onChange={setValue} radiusKm={radiusKm} />;
}

const plaza = { latitude: 41.6164, longitude: 0.6236 };

beforeEach(() => {
  jest.mocked(describePlace).mockResolvedValue(undefined);
  animateToRegion.mockClear();
});

describe('StartLocationField', () => {
  it('starts without a start point', async () => {
    await render(<Field />);

    expect(screen.getByText(/Tap the map to set where you start/)).toBeOnTheScreen();
    expect(screen.queryByTestId('map-marker')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('sets the start where the map is tapped and draws the radius', async () => {
    jest.mocked(describePlace).mockResolvedValue('Plaça de Sant Joan');
    await render(<Field radiusKm={2.5} />);

    await fireEvent.press(screen.getByTestId('start-location-map'), {
      nativeEvent: { coordinate: plaza },
    });

    expect(
      await screen.findByText('Starting at Plaça de Sant Joan. Venues within 2.5 km.'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('map-marker').props.coordinate).toEqual(plaza);
    expect(screen.getByTestId('map-circle').props.radius).toBe(2500);
    expect(animateToRegion).toHaveBeenCalledWith(expect.objectContaining(plaza), 300);
  });

  it('shows coordinates when the place has no name', async () => {
    await render(<Field initial={plaza} />);

    expect(
      await screen.findByText('Starting at 41.6164, 0.6236. Venues within 3 km.'),
    ).toBeOnTheScreen();
  });

  it('sets the start when a place icon on the map is tapped', async () => {
    await render(<Field />);

    await fireEvent(screen.getByTestId('start-location-map'), 'poiClick', {
      nativeEvent: { placeId: 'museum', name: 'Museu de Lleida', coordinate: plaza },
    });

    expect(await screen.findByText(/^Starting at/)).toBeOnTheScreen();
    expect(screen.getByTestId('map-marker').props.coordinate).toEqual(plaza);
  });

  it('redraws the circle when the start or the distance changes', async () => {
    const { rerender } = await render(<Field initial={plaza} radiusKm={3} />);
    await screen.findByText(/^Starting at/);
    const first = screen.getByTestId('map-circle');

    await rerender(<StartLocationField value={plaza} onChange={jest.fn()} radiusKm={0.5} />);

    const second = screen.getByTestId('map-circle');
    expect(second.props.radius).toBe(500);
    expect(second).not.toBe(first); // a new native circle, not an update of the old one
  });

  it('moves the start when the pin is dragged', async () => {
    await render(<Field initial={plaza} />);
    await screen.findByText(/^Starting at/);
    const moved = { latitude: 41.62, longitude: 0.63 };

    await fireEvent(screen.getByTestId('map-marker'), 'dragEnd', {
      nativeEvent: { coordinate: moved },
    });

    expect(await screen.findByText(/^Starting at 41.6200, 0.6300/)).toBeOnTheScreen();
    expect(screen.getByTestId('map-marker').props.coordinate).toEqual(moved);
  });

  it("uses the phone's location", async () => {
    jest.mocked(getDeviceLocation).mockResolvedValue({ point: plaza });
    const user = userEvent.setup();
    await render(<Field />);

    await user.press(screen.getByRole('button', { name: 'Use my location' }));

    expect(await screen.findByText(/^Starting at/)).toBeOnTheScreen();
    expect(screen.getByTestId('map-marker').props.coordinate).toEqual(plaza);
  });

  it('explains when the location is not available', async () => {
    jest.mocked(getDeviceLocation).mockResolvedValue({ error: 'Location access was not allowed.' });
    const user = userEvent.setup();
    await render(<Field />);

    await user.press(screen.getByRole('button', { name: 'Use my location' }));

    expect(screen.getByText('Location access was not allowed.')).toBeOnTheScreen();
    expect(screen.queryByTestId('map-marker')).toBeNull();
  });

  it('clears the location message once a point is chosen on the map', async () => {
    jest.mocked(getDeviceLocation).mockResolvedValue({ error: 'Location access was not allowed.' });
    const user = userEvent.setup();
    await render(<Field />);
    await user.press(screen.getByRole('button', { name: 'Use my location' }));

    await fireEvent.press(screen.getByTestId('start-location-map'), {
      nativeEvent: { coordinate: plaza },
    });

    await screen.findByText(/^Starting at/);
    expect(screen.queryByText('Location access was not allowed.')).toBeNull();
  });

  it('warns when the start is far from Lleida', async () => {
    await render(<Field initial={{ latitude: 50.85, longitude: 4.35 }} />); // Brussels

    expect(await screen.findByText(/^Starting at/)).toBeOnTheScreen();
    expect(screen.getByText(/far from Lleida/)).toBeOnTheScreen();
  });

  it('clears the start', async () => {
    const user = userEvent.setup();
    await render(<Field initial={plaza} />);
    await screen.findByText(/^Starting at/);

    await user.press(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.queryByTestId('map-marker')).toBeNull();
    expect(screen.getByText(/Tap the map to set where you start/)).toBeOnTheScreen();
  });
});
