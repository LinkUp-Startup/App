import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { acceptFriendRequest, declineFriendRequest, listFriends } from '@/api/friends';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { describeFriendError } from '@/features/friends/errors';
import { useTheme } from '@/hooks/use-theme';
import type { FriendRequest, FriendsResponse } from '@/types/api';

/* Your friends and pending friend requests: accept or decline the ones you received */
export default function FriendsScreen() {
  const { accessToken } = useAuth();
  const [friends, setFriends] = useState<FriendsResponse>();
  const [loadError, setLoadError] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [answering, setAnswering] = useState<string>();

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!accessToken) return;
      setLoadError(undefined);
      try {
        setFriends(await listFriends(accessToken, signal));
      } catch (caught) {
        if (!signal?.aborted) setLoadError(describeFriendError(caught));
      }
    },
    [accessToken],
  );

  // Reload whenever the screen is shown, e.g. after sending a request on the search screen
  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      load(controller.signal);
      return () => controller.abort();
    }, [load]),
  );

  async function answer(request: FriendRequest, accept: boolean) {
    if (!accessToken) return;
    setAnswering(request.userId);
    setActionError(undefined);
    try {
      if (accept) await acceptFriendRequest(accessToken, request.userId);
      else await declineFriendRequest(accessToken, request.userId);
    } catch (caught) {
      setActionError(
        caught instanceof ApiError && caught.status === 404
          ? 'This request is no longer pending.'
          : describeFriendError(caught),
      );
    } finally {
      setAnswering(undefined);
    }
    // Show what the server has now, whether the answer worked or not
    await load();
  }

  if (!accessToken) {
    return (
      <Screen edges={['bottom']}>
        <ThemedText themeColor="textSecondary">Log in to see your friends.</ThemedText>
        <Button title="Log in" onPress={() => router.push('/login')} />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <Button title="Add friends" onPress={() => router.push('/friends')} />

      {actionError && (
        <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
          {actionError}
        </ThemedText>
      )}

      {loadError && (
        <>
          <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
            {loadError}
          </ThemedText>
          <Button title="Try again" variant="secondary" onPress={() => load()} />
        </>
      )}

      {!friends && !loadError && <ThemedText themeColor="textSecondary">Loading…</ThemedText>}

      {friends && (
        <>
          {friends.incoming.length > 0 && (
            <Section title="Friend requests">
              {friends.incoming.map((request) => (
                <Row key={request.userId} name={request.displayName}>
                  <View style={styles.actions}>
                    <Button
                      title="Accept"
                      accessibilityLabel={`Accept friend request from ${request.displayName}`}
                      disabled={answering === request.userId}
                      onPress={() => answer(request, true)}
                      style={styles.action}
                    />
                    <Button
                      title="Decline"
                      variant="secondary"
                      accessibilityLabel={`Decline friend request from ${request.displayName}`}
                      disabled={answering === request.userId}
                      onPress={() => answer(request, false)}
                      style={styles.action}
                    />
                  </View>
                </Row>
              ))}
            </Section>
          )}

          <Section title="Friends">
            {friends.friends.length === 0 ? (
              <ThemedText themeColor="textSecondary">
                You haven&apos;t added any friends yet. Search for people you know to plan nights
                together.
              </ThemedText>
            ) : (
              friends.friends.map((friend) => <Row key={friend.userId} name={friend.displayName} />)
            )}
          </Section>

          {friends.outgoing.length > 0 && (
            <Section title="Sent requests">
              {friends.outgoing.map((request) => (
                <Row key={request.userId} name={request.displayName}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Waiting for an answer
                  </ThemedText>
                </Row>
              ))}
            </Section>
          )}
        </>
      )}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" accessibilityRole="header">
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function Row({ name, children }: { name: string; children?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">{name}</ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  row: {
    borderRadius: 12,
    gap: Spacing.two,
    padding: Spacing.three,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  action: {
    flex: 1,
  },
});
