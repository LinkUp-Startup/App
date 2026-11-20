import { render, screen, userEvent } from '@testing-library/react-native';
import { useState } from 'react';

import { describePlace, getDeviceLocation } from '@/features/preferences/location';
import { StartLocationField } from '@/features/preferences/start-location-field.web';
import type { GeoPoint } from '@/types/api';

// The browser version of the start point field: no map (react-native-maps cannot load in a browser), just buttons.
jest.mock('@/features/preferences/location', () => ({
  ...jest.requireActual('@/features/preferences/location'),
  getDeviceLocation: jest.fn(),
  describePlace: jest.fn(),
}));

function Field({ initial, radiusKm = 3 }: { initial?: GeoPoint; radiusKm?: number }) {
  const [value, setValue] = useState(initial);
  return <StartLocationField value={value} onChange={setValue} radiusKm={radiusKm} />;
}

const plaza = { latitude: 41.6164, longitude: 0.6236 };
const madrid = { latitude: 40.4168, longitude: -3.7038 };

beforeEach(() => {
  jest.mocked(describePlace).mockResolvedValue(undefined);
});

describe('StartLocationField in the browser', () => {
  it('explains that the map is in the mobile app and offers the two ways to set a start', async () => {
    await render(<Field />);

    expect(screen.getByText(/The map is only available in the mobile app/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Use my location' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Lleida centre' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('starts at the city centre, names the place and can be cleared again', async () => {
    jest.mocked(describePlace).mockResolvedValue('Plaça de Sant Joan');
    const user = userEvent.setup();
    await render(<Field radiusKm={2.5} />);

    await user.press(screen.getByRole('button', { name: 'Lleida centre' }));

    expect(
      await screen.findByText('Starting at Plaça de Sant Joan. Venues within 2.5 km.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/far from Lleida/)).toBeNull();

    await user.press(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.getByText(/The map is only available in the mobile app/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('shows the coordinates while the place has no name', async () => {
    await render(<Field initial={plaza} />);

    expect(
      await screen.findByText('Starting at 41.6164, 0.6236. Venues within 3 km.'),
    ).toBeOnTheScreen();
  });

  it('uses the location of the browser and shows that it is looking', async () => {
    let finish!: (value: Awaited<ReturnType<typeof getDeviceLocation>>) => void;
    jest.mocked(getDeviceLocation).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const user = userEvent.setup();
    await render(<Field />);

    await user.press(screen.getByRole('button', { name: 'Use my location' }));
    expect(screen.getByRole('button', { name: 'Finding you…' })).toBeDisabled();

    finish({ point: { latitude: 41.62, longitude: 0.63 } });

    expect(
      await screen.findByText('Starting at 41.6200, 0.6300. Venues within 3 km.'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Use my location' })).toBeEnabled();
  });

  it('says why the location could not be used, and clears the message once a start is chosen', async () => {
    jest.mocked(getDeviceLocation).mockResolvedValue({ error: 'Location access was not allowed.' });
    const user = userEvent.setup();
    await render(<Field />);

    await user.press(screen.getByRole('button', { name: 'Use my location' }));
    expect(await screen.findByText('Location access was not allowed.')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Lleida centre' }));

    expect(screen.queryByText('Location access was not allowed.')).toBeNull();
  });

  it('warns when the start is far from Lleida', async () => {
    await render(<Field initial={madrid} />);

    expect(await screen.findByText(/That's far from Lleida/)).toBeOnTheScreen();
  });
});
