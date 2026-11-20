import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { castVote, closeVote, getGroup, getVoteResults, listGroupRounds } from '@/api/groups';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ErrorNote } from '@/components/error-note';
import { Icon, type IconName } from '@/components/icon';
import { Pill } from '@/components/pill';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { describeGroupError } from '@/features/groups/errors';
import { turnout, voteCount } from '@/features/groups/format';
import { PlanCard } from '@/features/plans/plan-card';
import type { Group, GroupPlanRound, GroupVoteResults, Plan } from '@/types/api';

type Loaded = { group: Group; round?: GroupPlanRound; results?: GroupVoteResults };

/** What a vote or the closing is about. */
type VoteTarget = { accessToken: string; groupId: string; roundId: string };

/**
 * Members vote for one of the plans of the group's newest round (#175). Everyone sees how the vote stands and which
 * plan they voted for; the owner can close the vote.
 */
export default function GroupVoteScreen() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const { accessToken } = useAuth();
  const [loaded, setLoaded] = useState<Loaded>();
  const [error, setError] = useState<string>();
  // A vote or the closing is on its way: the buttons wait for it
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const [confirmingClose, setConfirmingClose] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!accessToken || !groupId) return;
      setError(undefined);
      try {
        const [group, { rounds }] = await Promise.all([
          getGroup(accessToken, groupId, signal),
          listGroupRounds(accessToken, groupId, signal),
        ]);
        const round = rounds[0];
        const results = round
          ? await getVoteResults(accessToken, groupId, round.id, signal)
          : undefined;
        setLoaded({ group, round, results });
      } catch (caught) {
        if (!signal?.aborted) setError(describeGroupError(caught));
      }
    },
    [accessToken, groupId],
  );

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      load(controller.signal);
      return () => controller.abort();
    }, [load]),
  );

  // Casts a vote or closes the vote, then shows how it stands. When the vote was closed in the meantime (409),
  // the screen is reloaded to show that.
  async function run(action: (target: VoteTarget) => Promise<GroupVoteResults>) {
    const round = loaded?.round;
    if (!accessToken || !groupId || !round) return;
    setBusy(true);
    setActionError(undefined);
    try {
      const results = await action({ accessToken, groupId, roundId: round.id });
      setLoaded((current) => current && { ...current, results });
      setConfirmingClose(false);
    } catch (caught) {
      setActionError(describeGroupError(caught));
      if (caught instanceof ApiError && caught.status === 409) {
        setConfirmingClose(false);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!accessToken) {
    return (
      <Screen edges={['bottom']} gap={Spacing.four}>
        <Message icon="lock-closed-outline">Log in to vote on your group&apos;s plans.</Message>
        <Button title="Log in" icon="log-in-outline" onPress={() => router.push('/login')} />
      </Screen>
    );
  }

  if (!groupId) {
    return (
      <Screen edges={['bottom']} gap={Spacing.four}>
        <Message icon="people-outline">Open a group to vote on its plans.</Message>
        <Button title="Go to your groups" onPress={() => router.replace('/groups')} />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen edges={['bottom']}>
        <ErrorNote>{error}</ErrorNote>
        <Button title="Try again" variant="secondary" onPress={() => load()} />
      </Screen>
    );
  }

  if (!loaded) {
    return (
      <Screen edges={['bottom']}>
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      </Screen>
    );
  }

  const { group, round, results } = loaded;

  if (!round || !results) {
    return (
      <Screen edges={['bottom']} gap={Spacing.four}>
        <Message icon="sparkles-outline">
          No plans to vote on yet. Plan a night together first, then everyone can vote.
        </Message>
        <Button
          title="Plan a night together"
          icon="sparkles-outline"
          onPress={() =>
            router.push({
              pathname: '/group-plan',
              params: { groupId: group.id, groupSize: String(group.members.length) },
            })
          }
        />
      </Screen>
    );
  }

  const closed = results.closedAt != null;
  const isOwner = group.myRole === 'owner';
  const hasVoted = results.myVotePlanId != null;

  return (
    <Screen edges={['bottom']}>
      <Card style={styles.header}>
        <ThemedText type="subtitle" accessibilityRole="header">
          {closed ? 'Voting is closed' : "Vote for the night's plan"}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {closed
            ? 'The owner closed the vote, so nobody can vote or change their vote any more.'
            : 'Pick the plan you like most. You can change your vote until the owner closes the vote.'}
        </ThemedText>
        <View style={styles.pills}>
          <Pill
            icon="people-outline"
            tone="accent"
            label={turnout(results.votesCast, results.memberCount)}
          />
          {closed && <Pill icon="lock-closed-outline" tone="highlight" label="Closed" />}
        </View>
      </Card>

      {actionError && <ErrorNote>{actionError}</ErrorNote>}

      {round.plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          footer={
            <VoteFooter
              plan={plan}
              votes={results.plans.find((p) => p.planId === plan.id)?.votes ?? 0}
              mine={results.myVotePlanId === plan.id}
              hasVoted={hasVoted}
              closed={closed}
              busy={busy}
              onVote={() => run((t) => castVote(t.accessToken, t.groupId, t.roundId, plan.id))}
            />
          }
        />
      ))}

      {isOwner && !closed && (
        <Card style={styles.close}>
          {confirmingClose ? (
            <>
              <ThemedText type="smallBold">Close the vote for everyone?</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Nobody can vote or change their vote afterwards.
              </ThemedText>
              <Button
                title="Yes, close the vote"
                icon="lock-closed-outline"
                disabled={busy}
                onPress={() => run((t) => closeVote(t.accessToken, t.groupId, t.roundId))}
              />
              <Button
                title="Keep voting open"
                variant="secondary"
                disabled={busy}
                onPress={() => setConfirmingClose(false)}
              />
            </>
          ) : (
            <Button
              title="Close the vote"
              variant="secondary"
              icon="lock-closed-outline"
              onPress={() => setConfirmingClose(true)}
            />
          )}
        </Card>
      )}

      <Button
        title="Refresh the results"
        variant="secondary"
        icon="refresh"
        onPress={() => load()}
      />
    </Screen>
  );
}

type VoteFooterProps = {
  plan: Plan;
  votes: number;
  mine: boolean;
  hasVoted: boolean;
  closed: boolean;
  busy: boolean;
  onVote: () => void;
};

/** Under a plan: its votes, whether it is yours, and the button to vote for it while the vote is open. */
function VoteFooter({ plan, votes, mine, hasVoted, closed, busy, onVote }: VoteFooterProps) {
  return (
    <View style={styles.footer}>
      <View style={styles.tally}>
        <Icon name="people-outline" size={18} color="accent" />
        <ThemedText type="smallBold">{voteCount(votes)}</ThemedText>
        {mine && <Pill icon="checkmark-circle" tone="success" label="Your vote" />}
      </View>
      {!closed &&
        (mine ? (
          <Button
            title="You voted for this plan"
            variant="secondary"
            icon="checkmark"
            disabled
            accessibilityLabel={`You voted for ${plan.title}`}
          />
        ) : (
          <Button
            title={hasVoted ? 'Change my vote to this plan' : 'Vote for this plan'}
            icon="thumbs-up-outline"
            disabled={busy}
            accessibilityLabel={`${hasVoted ? 'Change my vote to' : 'Vote for'} ${plan.title}`}
            onPress={onVote}
          />
        ))}
    </View>
  );
}

function Message({ icon, children }: { icon: IconName; children: string }) {
  return (
    <Card style={styles.message}>
      <Icon name={icon} size={22} color="highlight" />
      <ThemedText themeColor="textSecondary" style={styles.messageText}>
        {children}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  footer: {
    gap: Spacing.two,
  },
  tally: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  close: {
    gap: Spacing.two,
  },
  message: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  messageText: {
    flex: 1,
  },
});
