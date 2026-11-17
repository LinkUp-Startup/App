import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { searchUsers, sendFriendRequest } from '@/api/friends';
import { Button } from '@/components/button';
import { FormField } from '@/components/form/form-field';
import { TextField } from '@/components/form/text-field';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { describeFriendError, FriendSearchMinLength } from '@/features/friends/errors';
import { useTheme } from '@/hooks/use-theme';
import type { FriendRelation, UserSearchResult } from '@/types/api';

const RelationLabels: Record<Exclude<FriendRelation, 'none'>, string> = {
  requestSent: 'Request sent',
  requestReceived: 'Wants to be your friend',
  friends: 'Friends',
};

/* Find other users by display name and send them a friend request */
export default function AddFriendsScreen() {
  const { accessToken } = useAuth();
  const [query, setQuery] = useState('');
  const [searchedFor, setSearchedFor] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>();
  const [searching, setSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string>();
  const [error, setError] = useState<string>();
  const currentSearch = useRef<AbortController | null>(null);

  const text = query.trim();
  const canSearch = text.length >= FriendSearchMinLength && !searching;

  async function runSearch(value: string) {
    if (!accessToken) return;
    // A newer search replaces an older one, so a slow response never overwrites newer results
    currentSearch.current?.abort();
    const controller = new AbortController();
    currentSearch.current = controller;

    setSearching(true);
    setError(undefined);
    try {
      const { users } = await searchUsers(accessToken, value, controller.signal);
      setResults(users);
      setSearchedFor(value);
    } catch (caught) {
      if (!controller.signal.aborted) setError(describeFriendError(caught));
    } finally {
      if (currentSearch.current === controller) setSearching(false);
    }
  }

  async function sendRequest(user: UserSearchResult) {
    if (!accessToken) return;
    setSendingTo(user.id);
    setError(undefined);
    try {
      await sendFriendRequest(accessToken, user.id);
      setResults((current) =>
        current?.map((u) => (u.id === user.id ? { ...u, relation: 'requestSent' } : u)),
      );
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        // Already friends, or they asked you at the same time: search again to show the real state
        await runSearch(searchedFor);
      } else {
        setError(describeFriendError(caught));
      }
    } finally {
      setSendingTo(undefined);
    }
  }

  if (!accessToken) {
    return (
      <Screen edges={['bottom']}>
        <ThemedText themeColor="textSecondary">
          Log in to find friends and plan nights together.
        </ThemedText>
        <Button title="Log in" onPress={() => router.push('/login')} />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <FormField label="Search by name" hint={`At least ${FriendSearchMinLength} characters.`}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder="e.g. Ann"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => canSearch && runSearch(text)}
          accessibilityLabel="Search by name"
        />
      </FormField>
      <Button
        title={searching ? 'Searching…' : 'Search'}
        disabled={!canSearch}
        onPress={() => runSearch(text)}
      />

      {error && (
        <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      )}

      {results?.length === 0 && (
        <ThemedText themeColor="textSecondary">No one found for “{searchedFor}”.</ThemedText>
      )}
      {results?.map((user) => (
        <UserRow
          key={user.id}
          user={user}
          sending={sendingTo === user.id}
          onAdd={() => sendRequest(user)}
        />
      ))}
    </Screen>
  );
}

type UserRowProps = {
  user: UserSearchResult;
  sending: boolean;
  onAdd: () => void;
};

function UserRow({ user, sending, onAdd }: UserRowProps) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold" style={styles.name}>
        {user.displayName}
      </ThemedText>
      {user.relation === 'none' ? (
        <Button
          title={sending ? 'Sending…' : 'Add friend'}
          accessibilityLabel={`Add ${user.displayName} as a friend`}
          disabled={sending}
          onPress={onAdd}
        />
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {RelationLabels[user.relation]}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  name: {
    flex: 1,
  },
});
