import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type MemberRowProps = {
  /** What is shown, e.g. "Bob" or "Ann (you)". */
  name: string;
  /** "Owner" for the group's owner. */
  detail?: string;
  /** Only given for a member the person looking may remove: the owner looking at someone else. */
  removal?: {
    /** The remove button was pressed and the row asks "Remove Bob from the group?". */
    confirming: boolean;
    /** The removal is on its way. */
    removing: boolean;
    onAsk: () => void;
    onConfirm: () => void;
    onCancel: () => void;
  };
};

/** A member of a group. For the owner it has a Remove button, which asks to confirm before anything is removed. */
export function MemberRow({ name, detail, removal }: MemberRowProps) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.top}>
        <View style={styles.text}>
          <ThemedText type="smallBold">{name}</ThemedText>
          {detail ? (
            <ThemedText type="small" themeColor="textSecondary">
              {detail}
            </ThemedText>
          ) : null}
        </View>
        {removal && !removal.confirming && (
          <Button
            title="Remove"
            variant="secondary"
            destructive
            icon="person-remove-outline"
            accessibilityLabel={`Remove ${name} from the group`}
            onPress={removal.onAsk}
          />
        )}
      </View>

      {removal?.confirming && (
        // Read out when it appears, so it is clear that the next press removes someone
        <View accessibilityLiveRegion="polite" style={styles.confirm}>
          <ThemedText type="smallBold">Remove {name} from the group?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            They will no longer see its plans or vote. You can add them back later.
          </ThemedText>
          <Button
            title={removal.removing ? 'Removing…' : 'Yes, remove'}
            variant="secondary"
            destructive
            icon="person-remove-outline"
            accessibilityLabel={`Yes, remove ${name}`}
            disabled={removal.removing}
            onPress={removal.onConfirm}
          />
          <Button
            title="Keep in the group"
            variant="secondary"
            accessibilityLabel={`Keep ${name} in the group`}
            disabled={removal.removing}
            onPress={removal.onCancel}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: Radius.md,
    gap: Spacing.three,
    padding: Spacing.three,
  },
  top: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
  },
  text: {
    flex: 1,
    gap: Spacing.one,
  },
  confirm: {
    gap: Spacing.two,
  },
});
