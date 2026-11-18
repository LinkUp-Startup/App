import { router } from 'expo-router';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/features/auth/auth-context';

export default function AccountScreen() {
  const { user, signOut } = useAuth();

  return (
    <Screen>
      <ThemedText type="subtitle">Account</ThemedText>
      <Button
        title="Default preferences"
        variant="secondary"
        onPress={() => router.push('/default-preferences')}
      />

      {user ? (
        <>
          <ThemedText>Signed in as {user.displayName}</ThemedText>
          <ThemedText themeColor="textSecondary">{user.email}</ThemedText>
          <Button title="Friends" onPress={() => router.push('/my-friends')} />
          <Button title="Groups" onPress={() => router.push('/groups')} />
          <Button title="Log out" variant="secondary" onPress={signOut} />
        </>
      ) : (
        <>
          <ThemedText themeColor="textSecondary">
            You are using LinkUp as a guest. Everything works without an account; log in or create
            one to keep your plans with you.
          </ThemedText>
          <Button title="Log in" onPress={() => router.push('/login')} />
          <Button
            title="Create account"
            variant="secondary"
            onPress={() => router.push('/register')}
          />
        </>
      )}
    </Screen>
  );
}
