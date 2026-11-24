import { useColorSchemeChoice } from '@/features/appearance/color-scheme-context';

/** The mode the app shows: picked in the app (Account), else the phone's. */
export function useColorScheme() {
  return useColorSchemeChoice().colorScheme;
}
