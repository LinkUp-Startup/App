// Runs before each test file.
process.env.EXPO_PUBLIC_API_URL = 'http://api.test/';
// Times are shown in the device's zone; pin it so tests read the same on every machine.
process.env.TZ = 'Europe/Madrid';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// A working in-memory stand-in for the device's secure storage (the real one is native code). The functions
// are jest mocks so tests can check the calls or make them fail; `jest.after-env.ts` empties it per test.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  const implementation = {
    getItemAsync: async (key: string) => store.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      store.set(key, value);
    },
    deleteItemAsync: async (key: string) => {
      store.delete(key);
    },
  };
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    getItemAsync: jest.fn(implementation.getItemAsync),
    setItemAsync: jest.fn(implementation.setItemAsync),
    deleteItemAsync: jest.fn(implementation.deleteItemAsync),
    __store: store,
    __implementation: implementation,
  };
});
