// Runs after the test framework is installed, so it can use hooks.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type * as SecureStore from 'expo-secure-store';

type FakeSecureStore = typeof SecureStore & {
  __store: Map<string, string>;
  __implementation: Pick<typeof SecureStore, 'getItemAsync' | 'setItemAsync' | 'deleteItemAsync'>;
};

// Every test starts with empty storage and working functions, whatever the last test did to them.
beforeEach(async () => {
  await AsyncStorage.clear();

  const secureStore = jest.requireMock<FakeSecureStore>('expo-secure-store');
  secureStore.__store.clear();
  jest
    .mocked(secureStore.getItemAsync)
    .mockReset()
    .mockImplementation(secureStore.__implementation.getItemAsync);
  jest
    .mocked(secureStore.setItemAsync)
    .mockReset()
    .mockImplementation(secureStore.__implementation.setItemAsync);
  jest
    .mocked(secureStore.deleteItemAsync)
    .mockReset()
    .mockImplementation(secureStore.__implementation.deleteItemAsync);
});
