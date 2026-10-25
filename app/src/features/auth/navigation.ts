import { router } from 'expo-router';

/**
 * Leaves the login or register screen after a successful sign-in, landing on the Account tab.
 *
 * `dismissTo` pops back to the Account tab when it is already underneath (the normal case: the screen was
 * opened from there) and otherwise navigates to it, e.g. when the screen was opened from a link or the page
 * was reloaded on web. `router.back()` and `router.canGoBack()` can't be used here: on web they follow the
 * browser's history and leave the user stuck on the form.
 */
export function closeAuthScreen() {
  router.dismissTo('/account');
}
