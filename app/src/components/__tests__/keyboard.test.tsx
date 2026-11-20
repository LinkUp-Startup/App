import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { Keyboard, Platform, Text } from 'react-native';

import { TextField } from '@/components/form/text-field';
import { Screen } from '@/components/screen';

// KeyboardAvoidingView only measures the keyboard on a device. This stand-in renders a plain view that keeps the
// props the screen gave it, so the test can read how the screen set it up.
jest.mock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const KeyboardAvoidingView = (props: object) => React.createElement(View, props);
  return { __esModule: true, default: KeyboardAvoidingView };
});

describe('keyboard handling on a screen', () => {
  it('moves the focused field above the keyboard by itself on iOS, and lets the keyboard be dragged away', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await render(
      <Screen>
        <Text>Content</Text>
      </Screen>,
    );

    const scroll = screen.getByTestId('screen-scroll');
    expect(scroll.props.automaticallyAdjustKeyboardInsets).toBe(true);
    expect(scroll.props.keyboardDismissMode).toBe('interactive');
    // A tap outside a field closes the keyboard, but a tap on a button still reaches the button.
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    expect(screen.getByTestId('screen-keyboard-avoiding').props.enabled).toBe(false);
  });

  it('pads the bottom for the keyboard on Android, where the window no longer resizes', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await render(
      <Screen>
        <Text>Content</Text>
      </Screen>,
    );

    const avoiding = screen.getByTestId('screen-keyboard-avoiding');
    expect(avoiding.props.enabled).toBe(true);
    expect(avoiding.props.behavior).toBe('padding');
    expect(screen.getByTestId('screen-scroll').props.keyboardDismissMode).toBe('on-drag');
  });
});

describe('TextField Done button', () => {
  const done = () => screen.queryByRole('button', { name: 'Done' });

  it('appears on a number pad while it is open, and closes the keyboard', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    const user = userEvent.setup();
    await render(<TextField accessibilityLabel="Budget" keyboardType="decimal-pad" />);
    expect(done()).toBeNull();

    await act(async () => fireEvent(screen.getByLabelText('Budget'), 'focus'));
    expect(done()).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Done' }));
    expect(dismiss).toHaveBeenCalledTimes(1);

    await act(async () => fireEvent(screen.getByLabelText('Budget'), 'blur'));
    expect(done()).toBeNull();
  });

  it('appears on the euro-prefixed number field too', async () => {
    await render(<TextField accessibilityLabel="Budget" prefix="€" keyboardType="decimal-pad" />);

    await act(async () => fireEvent(screen.getByLabelText('Budget'), 'focus'));

    expect(done()).toBeOnTheScreen();
  });

  it('appears on a multi-line field, whose return key adds a new line', async () => {
    await render(<TextField accessibilityLabel="Notes" multiline />);

    await act(async () => fireEvent(screen.getByLabelText('Notes'), 'focus'));

    expect(done()).toBeOnTheScreen();
  });

  it('is left out on an ordinary text field, which has a return key', async () => {
    await render(<TextField accessibilityLabel="Email" keyboardType="email-address" />);

    await act(async () => fireEvent(screen.getByLabelText('Email'), 'focus'));

    expect(done()).toBeNull();
  });

  it('keeps the field focused-state and typing working while the button is showing', async () => {
    const onChangeText = jest.fn();
    await render(
      <TextField
        accessibilityLabel="Budget"
        keyboardType="number-pad"
        onChangeText={onChangeText}
      />,
    );

    await act(async () => fireEvent(screen.getByLabelText('Budget'), 'focus'));
    await fireEvent.changeText(screen.getByLabelText('Budget'), '25');

    expect(onChangeText).toHaveBeenCalledWith('25');
    expect(done()).toBeOnTheScreen();
  });
});
