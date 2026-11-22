import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Platform, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { listFriends } from '@/api/friends';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { describeFriendError } from '@/features/friends/errors';
import { sendToFriend } from '@/features/plans/share-plan';
import { useTheme } from '@/hooks/use-theme';
import type { SavedPlan } from '@/storage/saved-plans';
import type { Friend } from '@/types/api';

/** How long iOS takes to slide the popup away before another sheet can open. */
export const IosDismissMs = 500;

type Props = {
  plan: SavedPlan;
  accessToken: string;
  visible: boolean;
  /** Shares the public link with the phone's share sheet, as before (#154). */
  onShareLink: () => void;
  onClose: () => void;
};

type Friends =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; friends: Friend[] };

/**
 * The share popup: send the plan to a LinkUp friend (#207), who finds it in their app with your name, or share
 * its link with anyone. Only friends are listed, so only friends can be picked. Give it a new `key` each time it
 * opens, so it starts from a fresh friends list.
 */
export function ShareSheet({ plan, accessToken, visible, onShareLink, onClose }: Props) {
  const theme = useTheme();
  const [friends, setFriends] = useState<Friends>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // Per friend: sending, sent, or why it failed
  const [sends, setSends] = useState<Record<string, 'sending' | 'sent' | { error: string }>>({});

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    listFriends(accessToken, controller.signal)
      .then((response) => setFriends({ status: 'ready', friends: response.friends }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setFriends({ status: 'error', message: describeFriendError(error) });
      });
    return () => controller.abort();
  }, [visible, accessToken, attempt]);

  async function send(friend: Friend) {
    setSends((current) => ({ ...current, [friend.userId]: 'sending' }));
    try {
      await sendToFriend(plan, friend.userId, accessToken);
      setSends((current) => ({ ...current, [friend.userId]: 'sent' }));
    } catch (error) {
      console.warn('Could not send plan', error);
      const message =
        error instanceof ApiError && error.status === 403
          ? `You and ${friend.displayName} are no longer friends.`
          : `Couldn't send it to ${friend.displayName}. Check your connection and try again.`;
      setSends((current) => ({ ...current, [friend.userId]: { error: message } }));
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <Screen>
        <ThemedText type="subtitle" accessibilityRole="header">
          Share {plan.title}
        </ThemedText>

        <View style={styles.section}>
          <ThemedText type="smallBold" accessibilityRole="header">
            Send to a friend
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            It shows up in their LinkUp app with your name, and they can save their own copy.
          </ThemedText>
          {friends.status === 'loading' && (
            <View style={styles.center} accessibilityLiveRegion="polite">
              <ActivityIndicator color={theme.tint} />
            </View>
          )}
          {friends.status === 'error' && (
            <>
              <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
                {friends.message}
              </ThemedText>
              <Button
                title="Try again"
                variant="secondary"
                onPress={() => {
                  setFriends({ status: 'loading' });
                  setAttempt((value) => value + 1);
                }}
              />
            </>
          )}
          {friends.status === 'ready' && friends.friends.length === 0 && (
            <>
              <ThemedText themeColor="textSecondary">
                You haven&apos;t added any friends yet.
              </ThemedText>
              <Button
                title="Add friends"
                variant="secondary"
                onPress={() => {
                  onClose();
                  router.push('/friends');
                }}
              />
            </>
          )}
          {friends.status === 'ready' &&
            friends.friends.map((friend) => {
              const state = sends[friend.userId];
              return (
                <View
                  key={friend.userId}
                  style={[styles.friend, { backgroundColor: theme.backgroundElement }]}>
                  <View style={styles.friendRow}>
                    <ThemedText type="smallBold" style={styles.name}>
                      {friend.displayName}
                    </ThemedText>
                    <Button
                      title={state === 'sent' ? 'Sent' : state === 'sending' ? 'Sending…' : 'Send'}
                      variant={state === 'sent' ? 'secondary' : 'primary'}
                      accessibilityLabel={
                        state === 'sent'
                          ? `Sent to ${friend.displayName}`
                          : `Send to ${friend.displayName}`
                      }
                      disabled={state === 'sending' || state === 'sent'}
                      onPress={() => send(friend)}
                    />
                  </View>
                  {typeof state === 'object' && (
                    <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
                      {state.error}
                    </ThemedText>
                  )}
                </View>
              );
            })}
        </View>

        <View style={styles.section}>
          <ThemedText type="smallBold" accessibilityRole="header">
            Share a link
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Anyone with the link can see the plan on the LinkUp website, no account needed.
          </ThemedText>
          <Button
            title="Share a link"
            icon="link-outline"
            variant="secondary"
            onPress={() => {
              onClose();
              // iOS can't open the share sheet while this popup is still sliding away
              setTimeout(onShareLink, Platform.OS === 'ios' ? IosDismissMs : 0);
            }}
          />
        </View>

        <Button title="Done" variant="secondary" onPress={onClose} />
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  center: { alignItems: 'center', paddingVertical: Spacing.three },
  friend: { borderRadius: Radius.default, gap: Spacing.one, padding: Spacing.three },
  friendRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  name: { flex: 1 },
});
