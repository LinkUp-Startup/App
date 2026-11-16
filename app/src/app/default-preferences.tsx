import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/features/auth/auth-context';
import { DefaultPreferencesEditor } from '@/features/preferences/default-preferences-editor';

export default function DefaultPreferencesScreen() {
  const { user, accessToken, status } = useAuth();
  if (status === 'loading')
    return (
      <Screen edges={[]}>
        <ThemedText>Loading preferences…</ThemedText>
      </Screen>
    );
  // Remount on identity/session changes so one account's values and async results cannot reach another.
  return (
    <DefaultPreferencesEditor
      key={`${user?.id ?? 'guest'}:${accessToken}`}
      accessToken={accessToken}
    />
  );
}
