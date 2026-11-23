import AsyncStorage from '@react-native-async-storage/async-storage';

export type ColorSchemeChoice = 'light' | 'dark';

const KEY = 'linkup.colorScheme.v1';

/** The light or dark mode picked in the app, or null to follow the phone. */
export async function loadColorScheme(): Promise<ColorSchemeChoice | null> {
  const stored = await AsyncStorage.getItem(KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
}

export function saveColorScheme(choice: ColorSchemeChoice): Promise<void> {
  return AsyncStorage.setItem(KEY, choice);
}
