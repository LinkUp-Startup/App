import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { LinkRow } from '@/components/link-row';
import { PageHeader } from '@/components/page-header';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { DarkModeSwitch } from '@/features/appearance/dark-mode-switch';
import { useAuth } from '@/features/auth/auth-context';

export default function AccountScreen() {
  const { user, signOut } = useAuth();

  return (
    <Screen gap={Spacing.four}>
      <PageHeader icon="person-circle-outline" title="Account" />

      {user ? (
        <Card style={styles.profile}>
          <Avatar name={user.displayName} size={48} />
          <View style={styles.profileText}>
            <ThemedText type="smallBold">Signed in as {user.displayName}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {user.email}
            </ThemedText>
          </View>
        </Card>
      ) : (
        <Card style={styles.guest}>
          <View style={styles.guestText}>
            <Icon name="person-outline" size={22} color="highlight" />
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              You are using LinkUp as a guest. Everything works without an account; log in or create
              one to keep your plans with you.
            </ThemedText>
          </View>
          <Button title="Log in" icon="log-in-outline" onPress={() => router.push('/login')} />
          <Button
            title="Create account"
            icon="person-add-outline"
            variant="secondary"
            onPress={() => router.push('/register')}
          />
        </Card>
      )}

      <View style={styles.links}>
        <LinkRow
          title="Default preferences"
          icon="options-outline"
          description="Your usual budget, group, activities and transport"
          onPress={() => router.push('/default-preferences')}
        />
        {user && (
          <LinkRow
            title="Friends"
            icon="people-outline"
            iconColor="accent"
            description="Requests, and people to plan nights with"
            onPress={() => router.push('/my-friends')}
          />
        )}
        {user && (
          <LinkRow
            title="Groups"
            icon="people-circle-outline"
            iconColor="highlight"
            description="Plan a night together with your friends"
            onPress={() => router.push('/groups')}
          />
        )}
      </View>

      <DarkModeSwitch />

      {user && (
        <Button
          title="Log out"
          icon="log-out-outline"
          variant="secondary"
          destructive
          onPress={signOut}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
  },
  profileText: {
    flex: 1,
    gap: 2,
  },
  guest: {
    gap: Spacing.three,
  },
  guestText: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  links: {
    gap: Spacing.two,
  },
});
