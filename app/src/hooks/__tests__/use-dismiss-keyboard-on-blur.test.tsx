import { render } from '@testing-library/react-native';
import { Keyboard, Text } from 'react-native';

import { useDismissKeyboardOnBlur } from '@/hooks/use-dismiss-keyboard-on-blur';

// The test setup switches this hook off for every screen test; this file tests the real one.
jest.unmock('@/hooks/use-dismiss-keyboard-on-blur');

// Runs a screen's focus effect when it mounts and its cleanup when the screen is left, like a navigator does.
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  };
});

function Probe() {
  useDismissKeyboardOnBlur();
  return <Text>Screen</Text>;
}

const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);

// Each test starts from zero calls: the previous test's automatic cleanup also closes the keyboard.
beforeEach(() => dismiss.mockClear());

describe('useDismissKeyboardOnBlur', () => {
  it('leaves the keyboard alone while the screen is shown', async () => {
    await render(<Probe />);

    expect(dismiss).not.toHaveBeenCalled();
  });

  it('closes the keyboard when the screen is left, so it does not stay over the next tab', async () => {
    const view = await render(<Probe />);

    await view.unmount();

    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
