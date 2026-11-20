import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { voteCount } from '@/features/groups/format';
import { joinNames, type VoteOutcome } from '@/features/groups/vote-outcome';

type OutcomeCardProps = {
  outcome: VoteOutcome;
  /** The owner closed the vote: the outcome is final. */
  closed: boolean;
  /** Starts another round of plans, for a vote that has no winner. */
  onPlanAgain: () => void;
};

/** How the vote came out: the winner, a tie and what happens next, or that nobody voted. Nothing before an outcome. */
export function OutcomeCard({ outcome, closed, onPlanAgain }: OutcomeCardProps) {
  if (outcome.kind === 'pending') return null;

  const { icon, title, text } = describe(outcome, closed);
  // A closed vote that nobody won leaves the group without a plan, so it is offered another round.
  const planAgain = closed && outcome.kind !== 'winner';

  return (
    // Read out when the outcome appears or changes, e.g. after the last member votes
    <Card accessibilityLiveRegion="polite" style={styles.card}>
      <View style={styles.title}>
        <Icon name={icon} size={22} color="highlight" />
        <ThemedText type="subtitle" accessibilityRole="header" style={styles.titleText}>
          {title}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {text}
      </ThemedText>
      {planAgain && (
        <Button title="Plan another night" icon="sparkles-outline" onPress={onPlanAgain} />
      )}
    </Card>
  );
}

function describe(
  outcome: Exclude<VoteOutcome, { kind: 'pending' }>,
  closed: boolean,
): { icon: IconName; title: string; text: string } {
  switch (outcome.kind) {
    case 'winner':
      return {
        icon: 'trophy',
        title: `Winner: ${outcome.plan.title}`,
        text: closed
          ? `The group chose it with ${voteCount(outcome.votes)}.`
          : `Everyone has voted and it leads with ${voteCount(outcome.votes)}. It is final once the owner closes the vote. Until then, votes can change.`,
      };
    case 'tie':
      return {
        icon: 'trophy',
        title: "It's a tie",
        text: `${joinNames(outcome.plans.map((plan) => plan.title))} each have ${voteCount(outcome.votes)}. ${
          closed
            ? "There is no deciding vote, so it's up to the group: talk it over, or plan another night."
            : 'Change a vote to break the tie. The owner can also close the vote as it is, and the group then decides.'
        }`,
      };
    case 'nobody':
      return {
        icon: 'remove-circle-outline',
        title: 'No winner',
        text: 'The vote was closed before anyone voted.',
      };
  }
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  title: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  titleText: {
    flex: 1,
  },
});
