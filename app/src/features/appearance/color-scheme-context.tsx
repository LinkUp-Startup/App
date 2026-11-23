import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme as usePhoneColorScheme } from 'react-native';

import { loadColorScheme, saveColorScheme, type ColorSchemeChoice } from '@/storage/color-scheme';

type ColorSchemeContextValue = {
  /** The mode the app shows: what was picked in the app, else the phone's (dark unless the phone is light). */
  colorScheme: ColorSchemeChoice;
  setColorScheme: (choice: ColorSchemeChoice) => void;
};

const ColorSchemeContext = createContext<ColorSchemeContextValue | null>(null);

/** Light or dark mode, picked in the app and kept on the phone; until then the phone's setting decides. */
export function ColorSchemeProvider({ children }: { children: ReactNode }) {
  const phone = usePhoneColorScheme();
  const [choice, setChoice] = useState<ColorSchemeChoice | null>(null);

  useEffect(() => {
    let active = true;
    loadColorScheme()
      .then((stored) => {
        // A choice made while the stored one was loading wins
        if (active && stored) setChoice((current) => current ?? stored);
      })
      .catch((error: unknown) => console.warn('Could not read the colour scheme', error));
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<ColorSchemeContextValue>(
    () => ({
      colorScheme: choice ?? (phone === 'light' ? 'light' : 'dark'),
      setColorScheme: (next) => {
        setChoice(next);
        saveColorScheme(next).catch((error: unknown) =>
          console.warn('Could not save the colour scheme', error),
        );
      },
    }),
    [choice, phone],
  );

  return <ColorSchemeContext.Provider value={value}>{children}</ColorSchemeContext.Provider>;
}

/** Outside the provider (e.g. a component rendered alone in a test) the phone's setting decides. */
export function useColorSchemeChoice(): ColorSchemeContextValue {
  const phone = usePhoneColorScheme();
  return (
    useContext(ColorSchemeContext) ?? {
      colorScheme: phone === 'light' ? 'light' : 'dark',
      setColorScheme: () => {},
    }
  );
}
