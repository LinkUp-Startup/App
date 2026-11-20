import { render, screen, userEvent } from '@testing-library/react-native';

import { Button } from '@/components/button';
import { CheckboxList } from '@/components/form/checkbox-list';
import { ChipGroup } from '@/components/form/chip-group';
import { Stepper } from '@/components/form/stepper';
import { TextField } from '@/components/form/text-field';
import { SectionHeader } from '@/components/section-header';

describe('Button', () => {
  it('is named by its title, not by the icons beside it', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(
      <Button
        title="Generate plans"
        icon="sparkles"
        trailingIcon="arrow-forward"
        onPress={onPress}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Generate plans' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('SectionHeader', () => {
  it('shows the title as a heading and a text note on the right', async () => {
    await render(
      <SectionHeader title="Transport mode" icon="bus-outline" right="Select all that apply" />,
    );

    expect(screen.getByRole('header', { name: 'Transport mode' })).toBeOnTheScreen();
    expect(screen.getByText('Select all that apply')).toBeOnTheScreen();
  });

  it('shows a control on the right as it is', async () => {
    await render(
      <SectionHeader
        title="Radius"
        icon="locate-outline"
        right={
          <Stepper label="Distance" size="compact" value={2} onChange={jest.fn()} min={1} max={3} />
        }
      />,
    );

    expect(screen.getByLabelText('Distance')).toBeOnTheScreen();
  });
});

describe('ChipGroup emoji', () => {
  it('keeps the chip named by its label and shows the emoji beside it', async () => {
    await render(
      <ChipGroup
        options={{ dinner: 'Dinner', club: 'Club' }}
        emoji={{ dinner: '🍽️' }}
        selected={[]}
        onToggle={jest.fn()}
      />,
    );

    expect(screen.getByRole('checkbox', { name: 'Dinner' })).toBeOnTheScreen();
    expect(screen.getByText('🍽️', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'Club' })).toBeOnTheScreen();
  });
});

describe('CheckboxList grid', () => {
  it('toggles options shown as tiles with icons', async () => {
    const onToggle = jest.fn();
    const user = userEvent.setup();
    await render(
      <CheckboxList<'walking' | 'bike'>
        grid
        options={{ walking: 'Walking', bike: 'Bike' }}
        icons={{ walking: 'walk', bike: 'bicycle' }}
        selected={['walking']}
        onToggle={onToggle}
      />,
    );

    expect(screen.getByRole('checkbox', { name: 'Walking' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Bike' })).not.toBeChecked();

    await user.press(screen.getByRole('checkbox', { name: 'Bike' }));

    expect(onToggle).toHaveBeenCalledWith('bike');
  });
});

describe('Stepper sizes', () => {
  it('shows the large value as a number with its unit under it, and still steps', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    await render(
      <Stepper
        label="Group size"
        size="large"
        value={4}
        onChange={onChange}
        min={1}
        max={20}
        format={(n) => `${n} people`}
      />,
    );

    expect(screen.getByText('4')).toBeOnTheScreen();
    expect(screen.getByText('people')).toBeOnTheScreen();
    expect(screen.getByLabelText('Group size')).toHaveAccessibilityValue({
      now: 4,
      text: '4 people',
    });

    await user.press(screen.getByRole('button', { name: 'Increase group size' }));

    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('shows a large value without a unit as just the number', async () => {
    await render(
      <Stepper label="Count" size="large" value={3} onChange={jest.fn()} min={1} max={9} />,
    );

    expect(screen.getByText('3')).toBeOnTheScreen();
  });

  it('stops at its limits in the compact size too', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    await render(
      <Stepper
        label="Distance"
        size="compact"
        value={1}
        onChange={onChange}
        min={1}
        max={5}
        format={(n) => `${n} km`}
      />,
    );

    expect(screen.getByRole('button', { name: 'Decrease distance' })).toBeDisabled();

    await user.press(screen.getByRole('button', { name: 'Increase distance' }));

    expect(onChange).toHaveBeenCalledWith(2);
  });
});

describe('TextField prefix', () => {
  it('shows the symbol before the value and passes typing through', async () => {
    const onChangeText = jest.fn();
    const user = userEvent.setup();
    await render(
      <TextField accessibilityLabel="Budget" prefix="€" value="30" onChangeText={onChangeText} />,
    );

    expect(screen.getByText('€', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByLabelText('Budget')).toHaveDisplayValue('30');

    await user.type(screen.getByLabelText('Budget'), '5');

    expect(onChangeText).toHaveBeenCalled();
  });
});
