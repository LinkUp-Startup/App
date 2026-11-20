import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { removeGroupMember } from '@/api/groups';
import { Button } from '@/components/button';
import { ErrorNote } from '@/components/error-note';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { describeGroupError } from '@/features/groups/errors';
import { memberCount, roundLine } from '@/features/groups/format';
import { Section } from '@/features/groups/group-row';
import { LeaveGroup } from '@/features/groups/leave-group';
import { MemberRow } from '@/features/groups/member-row';
import { useGroup } from '@/features/groups/use-group';
import { PlanCard } from '@/features/plans/plan-card';

/* A group: its plans, newest first, and its members, the owner first. The owner can remove members; anyone can leave. */
export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { accessToken, user } = useAuth();
  const { group, rounds, error, reload, refresh } = useGroup(accessToken, id);
  // The member the owner is asked to confirm removing, the one being removed, and why a removal failed
  const [confirming, setConfirming] = useState<string>();
  const [removing, setRemoving] = useState<string>();
  const [removeError, setRemoveError] = useState<string>();

  async function remove(memberId: string) {
    if (!accessToken || !id) return;
    setRemoving(memberId);
    setRemoveError(undefined);
    try {
      await removeGroupMember(accessToken, id, memberId);
      setConfirming(undefined);
      await refresh();
    } catch (caught) {
      setConfirming(undefined);
      setRemoveError(describeGroupError(caught));
    } finally {
      setRemoving(undefined);
    }
  }

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
        <Button title="Try again" variant="secondary" onPress={reload} />
      </Screen>
    );
  }

  if (!group || !rounds) {
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

      <Button
        title="Plan a night together"
        onPress={() =>
          router.push({
            pathname: '/group-plan',
            params: { groupId: group.id, groupSize: String(group.members.length) },
          })
        }
      />

      <Button
        title="Vote on the plans"
        variant="secondary"
        onPress={() => router.push({ pathname: '/group-vote', params: { groupId: group.id } })}
      />

      <Section title="Plans">
        {rounds.length === 0 ? (
          <ThemedText themeColor="textSecondary">
            No plans yet. Plan a night and everyone in the group will see the plans here.
          </ThemedText>
        ) : (
          rounds.map((round) => (
            <View key={round.id} style={styles.round}>
              <ThemedText type="small" themeColor="textSecondary">
                {roundLine(round, user?.id)}
              </ThemedText>
              {round.plans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
            </View>
          ))
        )}
      </Section>

      <Section title="Members">
        {removeError && <ErrorNote>{removeError}</ErrorNote>}
        {group.members.map((member) => {
          const isMe = member.userId === user?.id;
          return (
            <MemberRow
              key={member.userId}
              name={isMe ? `${member.displayName} (you)` : member.displayName}
              detail={member.role === 'owner' ? 'Owner' : undefined}
              // Only the owner removes members, and never themselves: leaving is a different thing
              removal={
                group.myRole === 'owner' && !isMe
                  ? {
                      confirming: confirming === member.userId,
                      removing: removing === member.userId,
                      onAsk: () => {
                        setRemoveError(undefined);
                        setConfirming(member.userId);
                      },
                      onConfirm: () => remove(member.userId),
                      onCancel: () => setConfirming(undefined),
                    }
                  : undefined
              }
            />
          );
        })}
        <Button
          title="Add friends to the group"
          variant="secondary"
          icon="person-add-outline"
          onPress={() =>
            router.push({ pathname: '/add-group-members', params: { groupId: group.id } })
          }
        />
      </Section>

      {user && id && (
        <LeaveGroup
          groupName={group.name}
          members={group.members.length}
          isOwner={group.myRole === 'owner'}
          onLeave={async () => {
            await removeGroupMember(accessToken, id, user.id);
            // Replace the group with the list, so Back does not return to a group you are no longer in
            router.replace('/groups');
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  round: {
    gap: Spacing.two,
  },
});
