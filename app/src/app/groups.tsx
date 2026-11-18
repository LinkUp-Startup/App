import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable } from 'react-native';

import { listGroups } from '@/api/groups';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/features/auth/auth-context';
import { describeGroupError } from '@/features/groups/errors';
import { groupSummaryLine } from '@/features/groups/format';
import { Row, Section } from '@/features/groups/group-row';
import type { GroupSummary } from '@/types/api';

/* Your groups: open one to see its members, or create a new one */
export default function GroupsScreen() {
  const { accessToken } = useAuth();
  const [groups, setGroups] = useState<GroupSummary[]>();
  const [error, setError] = useState<string>();

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!accessToken) return;
      setError(undefined);
      try {
        setGroups((await listGroups(accessToken, signal)).groups);
      } catch (caught) {
        if (!signal?.aborted) setError(describeGroupError(caught));
      }
    },
    [accessToken],
  );

  // Reload whenever the screen is shown, e.g. after creating a group
  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      load(controller.signal);
      return () => controller.abort();
    }, [load]),
  );

  if (!accessToken) {
    return (
      <Screen edges={['bottom']}>
        <ThemedText themeColor="textSecondary">Log in to plan nights with a group.</ThemedText>
        <Button title="Log in" onPress={() => router.push('/login')} />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <Button title="Create a group" onPress={() => router.push('/new-group')} />

      {error && (
        <>
          <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
            {error}
          </ThemedText>
          <Button title="Try again" variant="secondary" onPress={() => load()} />
        </>
      )}

      {!groups && !error && <ThemedText themeColor="textSecondary">Loading…</ThemedText>}

      {groups && (
        <Section title="Your groups">
          {groups.length === 0 ? (
            <ThemedText themeColor="textSecondary">
              You aren&apos;t in any group yet. Create one with your friends to plan a night
              together.
            </ThemedText>
          ) : (
            groups.map((group) => (
              <Pressable
                key={group.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${group.name}`}
                onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })}>
                <Row name={group.name} detail={groupSummaryLine(group)} />
              </Pressable>
            ))
          )}
        </Section>
      )}
    </Screen>
  );
}
