import AsyncStorage from '@react-native-async-storage/async-storage';

import { emptyDefaults } from '@/features/preferences/defaults-form';
import { loadGuestPreferences, saveGuestPreferences } from '@/storage/guest-preferences';

const key = 'linkup.guestPreferences.v1';
afterEach(() => jest.restoreAllMocks());

it('starts unspecified and persists updated values for a fresh reader', async () => {
  expect(await loadGuestPreferences()).toEqual(emptyDefaults());
  const values = { ...emptyDefaults(), budgetPerPerson: 0, groupSize: 2, maxDistanceKm: 0.5 };
  await saveGuestPreferences(values);
  expect(JSON.parse((await AsyncStorage.getItem(key))!)).toEqual({
    version: 1,
    preferences: values,
  });
  // The reader has no in-memory cache; a fresh module instance sees the same persisted record.
  let freshReader: typeof loadGuestPreferences = loadGuestPreferences;
  jest.isolateModules(() => {
    freshReader = jest.requireActual<typeof import('@/storage/guest-preferences')>(
      '@/storage/guest-preferences',
    ).loadGuestPreferences;
  });
  expect(await freshReader()).toEqual(values);
  await saveGuestPreferences({ ...values, budgetPerPerson: 20 });
  expect(await freshReader()).toEqual({ ...values, budgetPerPerson: 20 });
  await saveGuestPreferences(emptyDefaults());
  expect(await freshReader()).toEqual(emptyDefaults());
});

it.each([
  '{bad',
  'null',
  '[]',
  '{}',
  '{"version":2,"preferences":{}}',
  '{"version":1}',
  '{"version":1,"preferences":{"budgetPerPerson":-1}}',
])('handles corrupted or outdated data: %s', async (raw) => {
  await AsyncStorage.setItem(key, raw);
  expect(await loadGuestPreferences()).toEqual(emptyDefaults());
  await saveGuestPreferences(emptyDefaults());
  expect(JSON.parse((await AsyncStorage.getItem(key))!).version).toBe(1);
});

it('propagates storage failures so the UI can offer a retry', async () => {
  jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('unavailable'));
  await expect(loadGuestPreferences()).rejects.toThrow('unavailable');
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
  await expect(saveGuestPreferences(emptyDefaults())).rejects.toThrow('full');
});
