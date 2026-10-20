import { render, screen, userEvent } from '@testing-library/react-native';

import { Button } from '@/components/button';

describe('Button', () => {
  it('renders its title and handles presses', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<Button title="Generate plans" onPress={onPress} />);

    await user.press(screen.getByRole('button', { name: 'Generate plans' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<Button title="Save" variant="secondary" disabled onPress={onPress} />);

    await user.press(screen.getByRole('button', { name: 'Save' }));

    expect(onPress).not.toHaveBeenCalled();
  });
});
