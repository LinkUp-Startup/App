import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { listFriends } from '@/api/friends';
import { createGroup } from '@/api/groups';
import { Button } from '@/components/button';
import { CheckboxList } from '@/components/form/checkbox-list';
import { FormField } from '@/components/form/form-field';
import { TextField } from '@/components/form/text-field';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/features/auth/auth-context';
import { describeGroupError, GroupNameMaxLength } from '@/features/groups/errors';
import { toggle } from '@/features/preferences/use-preferences-form';
import type { Friend } from '@/types/api';

/* Name a new group and pick the friends to add. You become its owner. */
export default function NewGroupScreen() {
  const { accessToken } = useAuth();
  const [name, setName] = useState('');
  const [friends, setFriends] = useState<Friend[]>();
  const [friendsError, setFriendsError] = useState<string>();
  const [selected, setSelected] = useState<string[]>([]);
  const [nameError, setNameError] = useState<string>();
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    listFriends(accessToken, controller.signal)
      .then((response) => setFriends(response.friends))
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setFriendsError(describeGroupError(caught));
      });
    return () => controller.abort();
  }, [accessToken]);

  async function create() {
    if (!accessToken) return;
    const trimmed = name.trim();
    if (trimmed.length === 0) return setNameError('Give the group a name.');
    if (trimmed.length > GroupNameMaxLength) {
      return setNameError(`A group name is at most ${GroupNameMaxLength} characters.`);
    }
    setNameError(undefined);
    setError(undefined);
    setCreating(true);
    try {
      const group = await createGroup(accessToken, { name: trimmed, memberIds: selected });
      // Replace this screen, so Back from the group goes to the list rather than to this form
      router.replace({ pathname: '/group/[id]', params: { id: group.id } });
    } catch (caught) {
      setError(describeGroupError(caught));
      setCreating(false);
    }
  }

  if (!accessToken) {
    return (
      <Screen edges={['bottom']}>
        <ThemedText themeColor="textSecondary">Log in to create a group.</ThemedText>
        <Button title="Log in" onPress={() => router.push('/login')} />
      </Screen>
    );
  }

  const options = Object.fromEntries((friends ?? []).map((f) => [f.userId, f.displayName]));

  return (
    <Screen edges={['bottom']}>
      <FormField label="Group name" error={nameError}>
        <TextField
          accessibilityLabel="Group name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Friday crew"
          maxLength={GroupNameMaxLength + 10}
          invalid={!!nameError}
        />
      </FormField>

      <FormField label="Friends to add">
        {friendsError ? (
          <ThemedText type="small" themeColor="danger">
            {friendsError}
          </ThemedText>
        ) : !friends ? (
          <ThemedText themeColor="textSecondary">Loading your friends…</ThemedText>
        ) : friends.length === 0 ? (
          <>
            <ThemedText themeColor="textSecondary">
              You don&apos;t have friends on LinkUp yet. You can still create the group just for
              you.
            </ThemedText>
            <Button
              title="Add friends"
              variant="secondary"
              onPress={() => router.push('/friends')}
            />
          </>
        ) : (
          <CheckboxList
            options={options}
            selected={selected}
            onToggle={(id) => setSelected((current) => toggle(current, id))}
          />
        )}
      </FormField>

      {error && (
        <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      )}
      <Button
        title={creating ? 'Creating…' : 'Create group'}
        disabled={creating}
        onPress={create}
      />
    </Screen>
  );
}
