import * as Location from 'expo-location';

import type { GeoPoint } from '@/types/api';

/** Plaça de Sant Joan: where the map opens before a start point is chosen. Never sent as a default. */
export const LleidaCentre: GeoPoint = { latitude: 41.6164, longitude: 0.6236 };

/** Venues only exist in Lleida; a start point further away than this gets a warning. */
export const FarFromLleidaKm = 25;

/** Map region that shows the whole radius around `point`, with a little margin. */
export function regionFor(point: GeoPoint, radiusKm: number) {
  const latitudeDelta = (radiusKm * 2 * 1.3) / 111;
  return {
    ...point,
    latitudeDelta,
    longitudeDelta: latitudeDelta / Math.cos((point.latitude * Math.PI) / 180),
  };
}

/** Straight-line distance in km (Haversine), the same formula the API uses. */
export function distanceKm(a: GeoPoint, b: GeoPoint) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type DeviceLocationResult = { point: GeoPoint } | { error: string };

/** The phone's location, asking for permission first. Errors are messages for the user. */
export async function getDeviceLocation(): Promise<DeviceLocationResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { error: 'Location access was not allowed. Tap the map to set your start instead.' };
    }
    const { coords } = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { point: { latitude: coords.latitude, longitude: coords.longitude } };
  } catch {
    return { error: "Couldn't get your location. Tap the map to set your start instead." };
  }
}

/** "Carrer Major, 31" for a point, or undefined when the phone can't look it up. */
export async function describePlace(point: GeoPoint): Promise<string | undefined> {
  try {
    const [place] = await Location.reverseGeocodeAsync(point);
    if (!place) return undefined;
    const street = [place.street, place.streetNumber].filter(Boolean).join(', ');
    return street || place.name || place.district || undefined;
  } catch {
    return undefined;
  }
}
