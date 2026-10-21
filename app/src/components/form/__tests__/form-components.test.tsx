import { render, screen, userEvent } from '@testing-library/react-native';

import { CheckboxList } from '@/components/form/checkbox-list';
import { ChipGroup } from '@/components/form/chip-group';
import { FormField } from '@/components/form/form-field';
import { Stepper } from '@/components/form/stepper';
import { TextField } from '@/components/form/text-field';

const options = { walking: 'Walking', bike: 'Bike' };

describe('FormField', () => {
  it('shows the hint, replaced by the error when there is one', async () => {
    const { rerender } = await render(
      <FormField label="Budget" hint="In euros">
        <TextField accessibilityLabel="Budget" />
      </FormField>,
    );
    expect(screen.getByText('In euros')).toBeOnTheScreen();

    await rerender(
      <FormField label="Budget" hint="In euros" error="Enter a budget">
        <TextField accessibilityLabel="Budget" invalid />
      </FormField>,
    );
    expect(screen.getByText('Enter a budget')).toBeOnTheScreen();
    expect(screen.queryByText('In euros')).toBeNull();
  });
});

describe('Stepper', () => {
  it('steps within its range and formats the value', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    await render(
      <Stepper
        label="Distance"
        value={2.5}
        onChange={onChange}
        min={0.5}
        max={3}
        step={0.5}
        format={(km) => `${km} km`}
      />,
    );

    expect(screen.getByText('2.5 km')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Increase distance' }));
    await user.press(screen.getByRole('button', { name: 'Decrease distance' }));

    expect(onChange.mock.calls).toEqual([[3], [2]]);
  });

  it('disables the buttons at the limits', async () => {
    await render(<Stepper label="Group size" value={1} onChange={jest.fn()} min={1} max={1} />);

    expect(screen.getByRole('button', { name: 'Decrease group size' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Increase group size' })).toBeDisabled();
  });

  it('supports screen reader increment and decrement actions', async () => {
    const onChange = jest.fn();
    await render(<Stepper label="Group size" value={2} onChange={onChange} min={1} max={5} />);
    const stepper = screen.getByRole('adjustable');

    stepper.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } });
    stepper.props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } });

    expect(onChange.mock.calls).toEqual([[3], [1]]);
  });
});

describe.each([
  ['ChipGroup', ChipGroup],
  ['CheckboxList', CheckboxList],
])('%s', (_name, Component) => {
  it('exposes options as checkboxes and reports toggles', async () => {
    const onToggle = jest.fn();
    const user = userEvent.setup();
    await render(
      <Component options={options} selected={['walking']} onToggle={onToggle} invalid />,
    );

    expect(screen.getByRole('checkbox', { name: 'Walking' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Bike' })).not.toBeChecked();

    await user.press(screen.getByRole('checkbox', { name: 'Bike' }));
    expect(onToggle).toHaveBeenCalledWith('bike');
  });
});
