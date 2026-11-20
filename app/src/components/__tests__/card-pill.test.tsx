import { render, screen } from '@testing-library/react-native';

import { Card } from '@/components/card';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

// The test renderer reports the light scheme; the design's default is dark.
jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => 'dark' }));

describe('Card', () => {
  it('draws the solid card surface with a perimeter stroke by default', async () => {
    await render(
      <Card testID="card">
        <ThemedText>Plan</ThemedText>
      </Card>,
    );

    expect(screen.getByTestId('card')).toHaveStyle({
      backgroundColor: Colors.dark.backgroundElement,
      borderColor: Colors.dark.border,
      borderWidth: 1,
    });
    expect(screen.getByText('Plan')).toBeOnTheScreen();
  });

  it('draws the frosted surface when glass', async () => {
    await render(<Card glass testID="card" />);

    expect(screen.getByTestId('card')).toHaveStyle({ backgroundColor: Colors.dark.glass });
  });
});

describe('Pill', () => {
  it('shows its label in the chosen tone', async () => {
    await render(<Pill label="24 spots active" tone="accent" />);

    expect(screen.getByText('24 spots active')).toHaveStyle({ color: Colors.dark.accent });
  });

  it('defaults to the secondary tone', async () => {
    await render(<Pill label="Peak" />);

    expect(screen.getByText('Peak')).toHaveStyle({ color: Colors.dark.textSecondary });
  });

  it('renders a status dot only when asked to', async () => {
    await render(<Pill label="Tonight" tone="accent" dot testID="pill" />);

    expect(screen.getByTestId('pill').children).toHaveLength(2);

    await screen.rerender(<Pill label="Tonight" tone="accent" testID="pill" />);

    expect(screen.getByTestId('pill').children).toHaveLength(1);
  });
});
