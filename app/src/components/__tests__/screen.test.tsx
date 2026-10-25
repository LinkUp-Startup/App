import { render, screen } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';

import { Screen } from '@/components/screen';

function scrollView() {
  return screen.getByTestId('screen-scroll');
}

describe('Screen', () => {
  it('lets the scroll view inset itself below an iOS navigation header', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await render(
      <Screen edges={['bottom']}>
        <Text>Content</Text>
      </Screen>,
    );

    expect(screen.getByText('Content')).toBeOnTheScreen();
    expect(scrollView().props.contentInsetAdjustmentBehavior).toBe('automatic');
  });

  it('also insets tab screens on iOS, so content clears the glass tab bar', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await render(
      <Screen>
        <Text>Content</Text>
      </Screen>,
    );

    expect(scrollView().props.contentInsetAdjustmentBehavior).toBe('automatic');
  });

  it('pads the safe area under a header on Android, where the header is not drawn over the content', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await render(
      <Screen edges={['bottom']}>
        <Text>Content</Text>
      </Screen>,
    );

    expect(scrollView().props.contentInsetAdjustmentBehavior).toBe('never');
  });
});
