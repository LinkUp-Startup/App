import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Keyboard } from 'react-native';

/**
 * Closes the keyboard when the screen loses focus, for example when another tab is tapped. Otherwise the keyboard
 * stays up over the new screen, and the room kept for it moves that screen's content as well.
 */
export function useDismissKeyboardOnBlur() {
  useFocusEffect(
    useCallback(
      () => () => {
        Keyboard.dismiss();
      },
      [],
    ),
  );
}
