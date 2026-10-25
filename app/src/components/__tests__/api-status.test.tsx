import { render, screen, userEvent } from '@testing-library/react-native';

import { NetworkError } from '@/api/client';
import { getHealth } from '@/api/health';
import { ApiStatus } from '@/components/api-status';

jest.mock('@/api/health', () => ({ getHealth: jest.fn() }));
const getHealthMock = jest.mocked(getHealth);

const healthy = {
  status: 'healthy',
  timeUtc: '2026-10-20T00:00:00Z',
  checks: { database: 'healthy' },
};

afterEach(() => getHealthMock.mockReset());

describe('ApiStatus', () => {
  it('shows the API as online when /health succeeds', async () => {
    getHealthMock.mockResolvedValue(healthy);
    await render(<ApiStatus />);

    expect(await screen.findByText('API online')).toBeOnTheScreen();
    expect(screen.getByText('http://api.test')).toBeOnTheScreen();
  });

  it('shows the API as unreachable and retries on press', async () => {
    getHealthMock.mockRejectedValueOnce(new NetworkError('down'));
    getHealthMock.mockResolvedValueOnce(healthy);
    const user = userEvent.setup();
    await render(<ApiStatus />);

    await user.press(await screen.findByText('API unreachable. Tap to retry'));

    expect(await screen.findByText('API online')).toBeOnTheScreen();
    expect(getHealthMock).toHaveBeenCalledTimes(2);
  });
});
