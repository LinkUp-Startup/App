import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

import { ColorSchemeProvider } from '@/features/appearance/color-scheme-context';
import { DarkModeSwitch } from '@/features/appearance/dark-mode-switch';

beforeEach(async () => {
  await AsyncStorage.clear();
  // A phone in dark mode
  jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');
});

describe('DarkModeSwitch', () => {
  it('starts in dark mode and switches to light mode, kept for next time', async () => {
    await render(
      <ColorSchemeProvider>
        <DarkModeSwitch />
      </ColorSchemeProvider>,
    );
    const toggle = screen.getByRole('switch', { name: 'Dark mode' });
    expect(toggle).toHaveProp('value', true);

    await fireEvent(toggle, 'valueChange', false);

    expect(screen.getByRole('switch', { name: 'Dark mode' })).toHaveProp('value', false);
    expect(screen.getByText('Light, for planning in daylight')).toBeOnTheScreen();
    await waitFor(async () =>
      expect(await AsyncStorage.getItem('linkup.colorScheme.v1')).toBe('light'),
    );
  });
});
