import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { memberCount, roundLine } from '@/features/groups/format';
import { Row, Section } from '@/features/groups/group-row';
import { useGroup } from '@/features/groups/use-group';
import { PlanCard } from '@/features/plans/plan-card';

/* A group: its plans, newest first, and its members, the owner first */
export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { accessToken, user } = useAuth();
  const { group, rounds, error, reload } = useGroup(accessToken, id);

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
        {group.members.map((member) => (
          <Row
            key={member.userId}
            name={member.userId === user?.id ? `${member.displayName} (you)` : member.displayName}
            detail={member.role === 'owner' ? 'Owner' : undefined}
          />
        ))}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  round: {
    gap: Spacing.two,
  },
});
