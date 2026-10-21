import { render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';

import { formatTime, TimeField } from '@/components/form/time-field';

type PickerProps = {
  value: Date;
  onValueChange: (event: unknown, date: Date) => void;
  onDismiss?: () => void;
  accessibilityLabel?: string;
};

// The native picker can't render in Jest; replace it with buttons that fire its callbacks.
jest.mock('@react-native-community/datetimepicker', () => {
  const { Pressable, Text, View } = jest.requireActual('react-native');
  function MockPicker({ value, onValueChange, onDismiss, accessibilityLabel }: PickerProps) {
    const later = new Date(value);
    later.setHours(value.getHours() + 2);
    return (
      <View accessibilityLabel={accessibilityLabel}>
        <Pressable accessibilityRole="button" onPress={() => onValueChange({}, later)}>
          <Text>Pick later time</Text>
        </Pressable>
        {onDismiss && (
          <Pressable accessibilityRole="button" onPress={onDismiss}>
            <Text>Cancel picker</Text>
          </Pressable>
        )}
      </View>
    ) as ReactNode;
  }
  return { __esModule: true, default: MockPicker };
});

const eight = new Date(2026, 9, 30, 20, 0);

describe('formatTime', () => {
  it('formats as 24-hour HH:mm', () => {
    expect(formatTime(new Date(2026, 9, 30, 7, 5))).toBe('07:05');
  });
});

describe('TimeField on Android', () => {
  beforeAll(() => {
    Platform.OS = 'android';
  });

  it('opens the picker on press and reports the chosen time', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    await render(<TimeField label="Start time" value={eight} onChange={onChange} />);

    expect(screen.queryByText('Pick later time')).toBeNull();
    await user.press(screen.getByRole('button', { name: 'Start time, 20:00' }));
    await user.press(screen.getByText('Pick later time'));

    expect(onChange).toHaveBeenCalledWith(new Date(2026, 9, 30, 22, 0));
    expect(screen.queryByText('Pick later time')).toBeNull();
  });

  it('closes without a change when dismissed', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    await render(<TimeField label="End time" value={eight} onChange={onChange} invalid />);

    await user.press(screen.getByRole('button', { name: 'End time, 20:00' }));
    await user.press(screen.getByText('Cancel picker'));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByText('Cancel picker')).toBeNull();
  });
});

describe('TimeField on iOS', () => {
  beforeAll(() => {
    Platform.OS = 'ios';
  });

  afterAll(() => {
    Platform.OS = 'android';
  });

  it('renders the inline picker directly', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    await render(<TimeField label="Start time" value={eight} onChange={onChange} />);

    await user.press(screen.getByText('Pick later time'));

    expect(onChange).toHaveBeenCalledWith(new Date(2026, 9, 30, 22, 0));
  });
});
