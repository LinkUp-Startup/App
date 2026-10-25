// Runs before each test file.
process.env.EXPO_PUBLIC_API_URL = 'http://api.test/';

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

// The map is native code. Stand-ins render plain views with the props, so tests can press the map and read the
// marker and circle; `animateToRegion` is a mock so tests can check the map follows the start point.
jest.mock('react-native-maps', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const animateToRegion = jest.fn();
  const MapView = React.forwardRef((props: object, ref) => {
    React.useImperativeHandle(ref, () => ({ animateToRegion }));
    return React.createElement(View, props);
  });
  const Marker = (props: object) => React.createElement(View, { testID: 'map-marker', ...props });
  const Circle = (props: object) => React.createElement(View, { testID: 'map-circle', ...props });
  return { __esModule: true, default: MapView, Marker, Circle, __animateToRegion: animateToRegion };
});
