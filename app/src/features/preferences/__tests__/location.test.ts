import * as Location from 'expo-location';

import {
  describePlace,
  distanceKm,
  getDeviceLocation,
  LleidaCentre,
  regionFor,
} from '@/features/preferences/location';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}));

const location = jest.mocked(Location);

beforeEach(() => jest.clearAllMocks());

describe('location helpers', () => {
  it('measures straight-line distances like the API', () => {
    // Lleida to Barcelona (Plaça de Catalunya) is about 132 km in a straight line.
    expect(distanceKm(LleidaCentre, { latitude: 41.387, longitude: 2.17 })).toBeCloseTo(132, -1);
    expect(distanceKm(LleidaCentre, LleidaCentre)).toBe(0);
  });

  it('frames the whole radius', () => {
    const region = regionFor(LleidaCentre, 3);

    expect(region.latitude).toBe(LleidaCentre.latitude);
    expect(region.latitudeDelta * 111).toBeCloseTo(7.8); // 3 km each side plus 30%
    expect(region.longitudeDelta).toBeGreaterThan(region.latitudeDelta); // degrees of longitude are shorter
  });
});

describe('getDeviceLocation', () => {
  it('returns the position once permission is granted', async () => {
    location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    location.getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 41.61, longitude: 0.62 },
    } as never);

    await expect(getDeviceLocation()).resolves.toEqual({
      point: { latitude: 41.61, longitude: 0.62 },
    });
  });

  it('explains a denied permission', async () => {
    location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);

    await expect(getDeviceLocation()).resolves.toEqual({
      error: expect.stringMatching(/not allowed/),
    });
    expect(location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('explains a failed lookup', async () => {
    location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    location.getCurrentPositionAsync.mockRejectedValue(new Error('GPS off'));

    await expect(getDeviceLocation()).resolves.toEqual({
      error: expect.stringMatching(/Couldn't get your location/),
    });
  });
});

describe('describePlace', () => {
  it('names the street and number', async () => {
    location.reverseGeocodeAsync.mockResolvedValue([
      { street: 'Carrer Major', streetNumber: '31', name: '31' },
    ] as never);

    await expect(describePlace(LleidaCentre)).resolves.toBe('Carrer Major, 31');
  });

  it('falls back to the place name, or nothing', async () => {
    location.reverseGeocodeAsync.mockResolvedValueOnce([
      { street: null, name: 'Plaça de Sant Joan' },
    ] as never);
    await expect(describePlace(LleidaCentre)).resolves.toBe('Plaça de Sant Joan');

    location.reverseGeocodeAsync.mockResolvedValueOnce([] as never);
    await expect(describePlace(LleidaCentre)).resolves.toBeUndefined();

    location.reverseGeocodeAsync.mockRejectedValueOnce(new Error('offline'));
    await expect(describePlace(LleidaCentre)).resolves.toBeUndefined();
  });
});
