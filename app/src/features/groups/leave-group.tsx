import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ErrorNote } from '@/components/error-note';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { describeGroupError } from '@/features/groups/errors';

type LeaveGroupProps = {
  groupName: string;
  /** How many members the group has, the person leaving included. */
  members: number;
  /** The person leaving owns the group. */
  isOwner: boolean;
  /** Leaves the group. When it throws, the reason is shown and the person stays. */
  onLeave: () => Promise<void>;
};

/** What happens to the group when this person leaves, said before they confirm. */
export function leaveExplanation(members: number, isOwner: boolean) {
  if (members <= 1) {
    return 'You are the only member, so the group and its plans will be deleted.';
  }
  if (isOwner) {
    return 'You own this group. When you leave, the member who has been in it the longest becomes the owner.';
  }
  return 'You will no longer see its plans or vote. A friend in the group can add you back.';
}

/** Leave the group: a button that asks to confirm, and says what happens, before anything is done. */
export function LeaveGroup({ groupName, members, isOwner, onLeave }: LeaveGroupProps) {
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string>();

  async function leave() {
    setLeaving(true);
    setError(undefined);
    try {
      await onLeave();
      // On success the screen is replaced, so there is nothing left to update here
    } catch (caught) {
      setError(describeGroupError(caught));
      setConfirming(false);
      setLeaving(false);
    }
  }

  return (
    <View style={styles.container}>
      {error && <ErrorNote>{error}</ErrorNote>}
      {confirming ? (
        // Read out when it appears, so it is clear that the next press leaves the group
        <Card accessibilityLiveRegion="polite" style={styles.confirm}>
          <ThemedText type="smallBold">Leave {groupName}?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {leaveExplanation(members, isOwner)}
          </ThemedText>
          <Button
            title={leaving ? 'Leaving…' : 'Yes, leave'}
            variant="secondary"
            destructive
            icon="log-out-outline"
            accessibilityLabel={`Yes, leave ${groupName}`}
            disabled={leaving}
            onPress={leave}
          />
          <Button
            title="Stay in the group"
            variant="secondary"
            disabled={leaving}
            onPress={() => setConfirming(false)}
          />
        </Card>
      ) : (
        <Button
          title="Leave group"
          variant="secondary"
          destructive
          icon="log-out-outline"
          onPress={() => {
            setError(undefined);
            setConfirming(true);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  confirm: {
    gap: Spacing.two,
  },
});
