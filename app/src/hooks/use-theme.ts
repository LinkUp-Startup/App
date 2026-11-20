/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  // Dark is the design's default; only an explicit light preference switches to the daytime theme.
  const theme = useColorScheme() === 'light' ? 'light' : 'dark';

  return Colors[theme];
}
