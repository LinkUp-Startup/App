import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { acceptFriendRequest, declineFriendRequest, listFriends } from '@/api/friends';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ErrorNote } from '@/components/error-note';
import { Icon, type IconName } from '@/components/icon';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { describeFriendError } from '@/features/friends/errors';
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
      // Not awaited on purpose: load shows its own failures
      void load(controller.signal);
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
      <Screen edges={['bottom']} gap={Spacing.four}>
        <Card style={styles.message}>
          <Icon name="lock-closed-outline" size={22} color="highlight" />
          <ThemedText themeColor="textSecondary" style={styles.flex}>
            Log in to see your friends.
          </ThemedText>
        </Card>
        <Button title="Log in" icon="log-in-outline" onPress={() => router.push('/login')} />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']} gap={Spacing.four}>
      <Button
        title="Add friends"
        icon="person-add-outline"
        onPress={() => router.push('/friends')}
      />

      {actionError && <ErrorNote>{actionError}</ErrorNote>}

      {loadError && (
        <>
          <ErrorNote>{loadError}</ErrorNote>
          <Button title="Try again" variant="secondary" onPress={() => load()} />
        </>
      )}

      {!friends && !loadError && <ThemedText themeColor="textSecondary">Loading…</ThemedText>}

      {friends && (
        <>
          {friends.incoming.length > 0 && (
            <Section title="Friend requests" icon="mail-unread-outline" tone="highlight">
              {friends.incoming.map((request) => (
                <Row key={request.userId} name={request.displayName}>
                  <View style={styles.actions}>
                    <Button
                      title="Accept"
                      icon="checkmark"
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

          <Section title="Friends" icon="people-outline" tone="tint">
            {friends.friends.length === 0 ? (
              <Card style={styles.message}>
                <Icon name="happy-outline" size={22} color="accent" />
                <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                  You haven&apos;t added any friends yet. Search for people you know to plan nights
                  together.
                </ThemedText>
              </Card>
            ) : (
              friends.friends.map((friend) => <Row key={friend.userId} name={friend.displayName} />)
            )}
          </Section>

          {friends.outgoing.length > 0 && (
            <Section title="Sent requests" icon="paper-plane-outline" tone="accent">
              {friends.outgoing.map((request) => (
                <Row key={request.userId} name={request.displayName}>
                  <ThemedText type="caption" themeColor="textSecondary">
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

function Section({
  title,
  icon,
  tone,
  children,
}: {
  title: string;
  icon: IconName;
  tone: ThemeColor;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <SectionHeader title={title} icon={icon} iconColor={tone} />
      {children}
    </View>
  );
}

function Row({ name, children }: { name: string; children?: React.ReactNode }) {
  return (
    <Card style={styles.row}>
      <View style={styles.person}>
        <Avatar name={name} />
        <ThemedText type="smallBold" style={styles.flex}>
          {name}
        </ThemedText>
      </View>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  row: {
    gap: Spacing.three,
  },
  person: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
  },
  message: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  action: {
    flex: 1,
  },
});
