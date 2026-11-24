import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import * as ReactNative from 'react-native';

import { Colors } from '@/constants/theme';
import {
  ColorSchemeProvider,
  useColorSchemeChoice,
} from '@/features/appearance/color-scheme-context';
import { useTheme } from '@/hooks/use-theme';

const phoneScheme = jest.spyOn(ReactNative, 'useColorScheme');
const wrapper = ({ children }: { children: ReactNode }) => (
  <ColorSchemeProvider>{children}</ColorSchemeProvider>
);

beforeEach(async () => {
  await AsyncStorage.clear();
  phoneScheme.mockReturnValue('dark');
});

describe('useTheme', () => {
  it.each([
    ['dark', Colors.dark],
    [null, Colors.dark],
    ['light', Colors.light],
  ] as const)('follows a %s phone until a mode is picked in the app', async (scheme, palette) => {
    phoneScheme.mockReturnValue(scheme);

    const { result } = await renderHook(() => useTheme(), { wrapper });

    expect(result.current).toBe(palette);
  });

  it('switches to the mode picked in the app and keeps it on the phone', async () => {
    const { result } = await renderHook(() => ({ theme: useTheme(), ...useColorSchemeChoice() }), {
      wrapper,
    });

    await act(() => result.current.setColorScheme('light'));

    expect(result.current.theme).toBe(Colors.light);
    expect(result.current.colorScheme).toBe('light');
    await waitFor(async () =>
      expect(await AsyncStorage.getItem('linkup.colorScheme.v1')).toBe('light'),
    );
  });

  it('uses the mode picked earlier, whatever the phone says', async () => {
    await AsyncStorage.setItem('linkup.colorScheme.v1', 'light');

    const { result } = await renderHook(() => useTheme(), { wrapper });

    await waitFor(() => expect(result.current).toBe(Colors.light));
  });

  it('ignores a stored value it does not know', async () => {
    await AsyncStorage.setItem('linkup.colorScheme.v1', 'sepia');

    const { result } = await renderHook(() => useTheme(), { wrapper });

    await act(async () => {});
    expect(result.current).toBe(Colors.dark);
  });

  it('follows the phone outside the provider', async () => {
    phoneScheme.mockReturnValue('light');

    const { result } = await renderHook(() => useTheme());

    expect(result.current).toBe(Colors.light);
  });
});
