import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import { getGroup } from '@/api/groups';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/features/auth/auth-context';
import { describeGroupError } from '@/features/groups/errors';
import { memberCount } from '@/features/groups/format';
import { Row, Section } from '@/features/groups/group-row';
import type { Group } from '@/types/api';

/* A group and its members, the owner first */
export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { accessToken, user } = useAuth();
  const [group, setGroup] = useState<Group>();
  const [error, setError] = useState<string>();

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!accessToken || !id) return;
      setError(undefined);
      try {
        setGroup(await getGroup(accessToken, id, signal));
      } catch (caught) {
        if (!signal?.aborted) setError(describeGroupError(caught));
      }
    },
    [accessToken, id],
  );

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
        <ThemedText themeColor="textSecondary">Log in to see your groups.</ThemedText>
        <Button title="Log in" onPress={() => router.push('/login')} />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen edges={['bottom']}>
        <ThemedText themeColor="danger" accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
        <Button title="Try again" variant="secondary" onPress={() => load()} />
      </Screen>
    );
  }

  if (!group) {
    return (
      <Screen edges={['bottom']}>
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <ThemedText type="subtitle">{group.name}</ThemedText>
      <ThemedText themeColor="textSecondary">
        {memberCount(group.members.length)}
        {group.myRole === 'owner' ? ' · You own this group' : ''}
      </ThemedText>

      <Section title="Members">
        {group.members.map((member) => (
          <Row
            key={member.userId}
            name={member.userId === user?.id ? `${member.displayName} (you)` : member.displayName}
            detail={member.role === 'owner' ? 'Owner' : undefined}
          />
        ))}
      </Section>
    </Screen>
  );
}
