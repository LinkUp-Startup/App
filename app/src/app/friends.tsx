import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { ApiError } from '@/api/client';
import { searchUsers, sendFriendRequest } from '@/api/friends';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ErrorNote } from '@/components/error-note';
import { FormField } from '@/components/form/form-field';
import { TextField } from '@/components/form/text-field';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { describeFriendError, FriendSearchMinLength } from '@/features/friends/errors';
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
      <Screen edges={['bottom']} gap={Spacing.four}>
        <Card style={styles.message}>
          <Icon name="lock-closed-outline" size={22} color="highlight" />
          <ThemedText themeColor="textSecondary" style={styles.name}>
            Log in to find friends and plan nights together.
          </ThemedText>
        </Card>
        <Button title="Log in" icon="log-in-outline" onPress={() => router.push('/login')} />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']} gap={Spacing.three}>
      <Card style={styles.search}>
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
          icon="search-outline"
          disabled={!canSearch}
          onPress={() => runSearch(text)}
        />
      </Card>

      {error && <ErrorNote>{error}</ErrorNote>}

      {results?.length === 0 && (
        <Card style={styles.message}>
          <Icon name="search-outline" size={22} color="textSecondary" />
          <ThemedText type="small" themeColor="textSecondary" style={styles.name}>
            No one found for “{searchedFor}”.
          </ThemedText>
        </Card>
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
  return (
    <Card style={styles.row}>
      <Avatar name={user.displayName} />
      <ThemedText type="smallBold" style={styles.name}>
        {user.displayName}
      </ThemedText>
      {user.relation === 'none' ? (
        <Button
          title={sending ? 'Sending…' : 'Add friend'}
          icon="person-add-outline"
          accessibilityLabel={`Add ${user.displayName} as a friend`}
          disabled={sending}
          onPress={onAdd}
        />
      ) : (
        <ThemedText type="caption" themeColor="textSecondary">
          {RelationLabels[user.relation]}
        </ThemedText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  search: {
    gap: Spacing.three,
  },
  message: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
  },
  name: {
    flex: 1,
  },
});
