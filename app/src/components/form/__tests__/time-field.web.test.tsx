import { fireEvent, render, screen } from '@testing-library/react-native';

import { formatTime, withTime } from '@/components/form/format-time';
import { TimeField } from '@/components/form/time-field.web';

const eight = new Date(2026, 9, 30, 20, 0);

describe('withTime', () => {
  it('replaces the time of day and keeps the date', () => {
    expect(withTime(eight, '07:45')).toEqual(new Date(2026, 9, 30, 7, 45));
  });

  it('does not change the date it is given', () => {
    withTime(eight, '07:45');
    expect(eight).toEqual(new Date(2026, 9, 30, 20, 0));
  });

  it.each(['', '7:45', '24:00', '12:60', 'ab:cd', '12:30:15'])('rejects "%s"', (time) => {
    expect(withTime(eight, time)).toBeUndefined();
  });
});

describe('TimeField on the web', () => {
  it('shows the current time in the input', async () => {
    await render(<TimeField label="Start time" value={eight} onChange={jest.fn()} />);

    expect(screen.getByLabelText('Start time').props.value).toBe(formatTime(eight));
  });

  it('reports the time the user typed', async () => {
    const onChange = jest.fn();
    await render(<TimeField label="Start time" value={eight} onChange={onChange} />);

    await fireEvent(screen.getByLabelText('Start time'), 'change', { target: { value: '22:15' } });

    expect(onChange).toHaveBeenCalledWith(new Date(2026, 9, 30, 22, 15));
  });

  it('ignores a cleared input instead of resetting the time', async () => {
    const onChange = jest.fn();
    await render(<TimeField label="End time" value={eight} onChange={onChange} invalid />);

    await fireEvent(screen.getByLabelText('End time'), 'change', { target: { value: '' } });

    expect(onChange).not.toHaveBeenCalled();
  });
});
