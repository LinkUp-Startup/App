import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ErrorNote } from '@/components/error-note';
import { FormField } from '@/components/form/form-field';
import { TextField } from '@/components/form/text-field';
import { PageHeader } from '@/components/page-header';
import { Screen } from '@/components/screen';
import { Spacing } from '@/constants/theme';
import { AuthLimits } from '@/features/auth/form';
import { closeAuthScreen } from '@/features/auth/navigation';
import { useAuthForm } from '@/features/auth/use-auth-form';

export default function RegisterScreen() {
  const { form, errors, serverError, submitting, setField, submit } = useAuthForm('register');

  const onSubmit = async () => {
    if (await submit()) closeAuthScreen();
  };

  return (
    <Screen edges={['bottom']} gap={Spacing.four}>
      <PageHeader
        icon="person-add-outline"
        title="Join LinkUp"
        description="Create an account to keep your plans with you. You can keep planning nights without one."
      />

      <Card style={styles.form}>
        <FormField label="Name" error={errors.displayName}>
          <TextField
            accessibilityLabel="Name"
            value={form.displayName}
            onChangeText={(displayName) => setField('displayName', displayName)}
            autoComplete="name"
            textContentType="name"
            maxLength={AuthLimits.displayNameMaxLength}
            invalid={!!errors.displayName}
          />
        </FormField>

        <FormField label="Email" error={errors.email}>
          <TextField
            accessibilityLabel="Email"
            value={form.email}
            onChangeText={(email) => setField('email', email)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            invalid={!!errors.email}
          />
        </FormField>

        <FormField
          label="Password"
          hint={`At least ${AuthLimits.passwordMinLength} characters`}
          error={errors.password}>
          <TextField
            accessibilityLabel="Password"
            value={form.password}
            onChangeText={(password) => setField('password', password)}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={onSubmit}
            invalid={!!errors.password}
          />
        </FormField>
      </Card>

      {serverError && <ErrorNote>{serverError}</ErrorNote>}

      <View style={styles.actions}>
        <Button
          title={submitting ? 'Creating account…' : 'Create account'}
          size="large"
          icon="person-add-outline"
          onPress={onSubmit}
          disabled={submitting}
        />
        <Button
          title="I already have an account"
          variant="secondary"
          onPress={() => router.replace('/login')}
          disabled={submitting}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
  actions: {
    gap: Spacing.two,
  },
});
