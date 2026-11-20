import { renderHook } from '@testing-library/react-native';

import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

jest.mock('@/hooks/use-color-scheme');

const mockScheme = jest.mocked(useColorScheme);

describe('useTheme', () => {
  it.each([
    ['dark', Colors.dark],
    [null, Colors.dark],
    ['light', Colors.light],
  ] as const)('maps the %s color scheme to the right palette', async (scheme, palette) => {
    mockScheme.mockReturnValue(scheme);

    const { result } = await renderHook(() => useTheme());

    expect(result.current).toBe(palette);
  });
});
