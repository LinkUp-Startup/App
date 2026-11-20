import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { listFriends } from '@/api/friends';
import { addGroupMember, getGroup } from '@/api/groups';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ErrorNote } from '@/components/error-note';
import { Icon, type IconName } from '@/components/icon';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { describeGroupError } from '@/features/groups/errors';
import { memberCount } from '@/features/groups/format';
import type { Friend, Group } from '@/types/api';

type Loaded = { group: Group; friends: Friend[] };

/**
 * Adds friends to a group that already exists (#273). Any member can add their own friends, so the list is the
 * friends of the person looking who are not in the group yet.
 */
export default function AddGroupMembersScreen() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const { accessToken } = useAuth();
  const [loaded, setLoaded] = useState<Loaded>();
  const [error, setError] = useState<string>();
  // The friend being added right now, and the ones added on this screen
  const [adding, setAdding] = useState<string>();
  const [added, setAdded] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string>();

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!accessToken || !groupId) return;
      try {
        const [group, { friends }] = await Promise.all([
          getGroup(accessToken, groupId, signal),
          listFriends(accessToken, signal),
        ]);
        setLoaded({ group, friends });
        setError(undefined);
      } catch (caught) {
        if (!signal?.aborted) setError(describeGroupError(caught));
      }
    },
    [accessToken, groupId],
  );

  // Loaded whenever the screen is shown, so coming back from finding friends shows the new ones
  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      // Not awaited on purpose: load shows its own failures
      void load(controller.signal);
      return () => controller.abort();
    }, [load]),
  );

  async function add(friend: Friend) {
    if (!accessToken || !groupId) return;
    setAdding(friend.userId);
    setActionError(undefined);
    try {
      await addGroupMember(accessToken, groupId, friend.userId);
      setAdded((current) => [...current, friend.userId]);
    } catch (caught) {
      setActionError(describeGroupError(caught));
    } finally {
      setAdding(undefined);
    }
  }

  if (!accessToken) {
    return (
      <Screen edges={['bottom']} gap={Spacing.four}>
        <Message icon="lock-closed-outline">Log in to add friends to a group.</Message>
        <Button title="Log in" icon="log-in-outline" onPress={() => router.push('/login')} />
      </Screen>
    );
  }

  if (!groupId) {
    return (
      <Screen edges={['bottom']} gap={Spacing.four}>
        <Message icon="people-outline">Open a group to add friends to it.</Message>
        <Button title="Go to your groups" onPress={() => router.replace('/groups')} />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen edges={['bottom']}>
        <ErrorNote>{error}</ErrorNote>
        <Button
          title="Try again"
          variant="secondary"
          onPress={() => {
            setError(undefined);
            void load();
          }}
        />
      </Screen>
    );
  }

  if (!loaded) {
    return (
      <Screen edges={['bottom']}>
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      </Screen>
    );
  }

  const { group, friends } = loaded;
  const memberIds = new Set(group.members.map((member) => member.userId));
  const candidates = friends.filter((friend) => !memberIds.has(friend.userId));
  const total = group.members.length + added.length;

  return (
    <Screen edges={['bottom']}>
      <Card style={styles.header}>
        <ThemedText type="subtitle" accessibilityRole="header">
          {group.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
          {memberCount(total)}. Any member can add their own friends.
        </ThemedText>
      </Card>

      {actionError && <ErrorNote>{actionError}</ErrorNote>}

      {friends.length === 0 && (
        <Message icon="person-add-outline">
          You don&apos;t have friends on LinkUp yet. Add some, then come back to add them here.
        </Message>
      )}
      {friends.length > 0 && candidates.length === 0 && (
        <Message icon="checkmark-circle-outline">
          All your friends are already in this group.
        </Message>
      )}

      {candidates.map((friend) => (
        <Card key={friend.userId} style={styles.row}>
          <Avatar name={friend.displayName} />
          <ThemedText type="smallBold" style={styles.name}>
            {friend.displayName}
          </ThemedText>
          {added.includes(friend.userId) ? (
            <View style={styles.done}>
              <Icon name="checkmark-circle" size={18} color="success" />
              <ThemedText type="caption" themeColor="success">
                Added
              </ThemedText>
            </View>
          ) : (
            <Button
              title={adding === friend.userId ? 'Adding…' : 'Add'}
              icon="person-add-outline"
              accessibilityLabel={`Add ${friend.displayName} to the group`}
              disabled={adding !== undefined}
              onPress={() => add(friend)}
            />
          )}
        </Card>
      ))}

      {(friends.length === 0 || candidates.length === 0) && (
        <Button
          title="Find friends"
          variant="secondary"
          icon="search-outline"
          onPress={() => router.push('/friends')}
        />
      )}
      <Button
        title="Done"
        variant={added.length > 0 ? 'primary' : 'secondary'}
        onPress={() => router.back()}
      />
    </Screen>
  );
}

function Message({ icon, children }: { icon: IconName; children: string }) {
  return (
    <Card style={styles.message}>
      <Icon name={icon} size={22} color="highlight" />
      <ThemedText themeColor="textSecondary" style={styles.name}>
        {children}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
  },
  name: {
    flex: 1,
  },
  done: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.one,
  },
  message: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
