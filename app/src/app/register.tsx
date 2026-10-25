import { router } from 'expo-router';

import { Button } from '@/components/button';
import { FormField } from '@/components/form/form-field';
import { TextField } from '@/components/form/text-field';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { AuthLimits } from '@/features/auth/form';
import { closeAuthScreen } from '@/features/auth/navigation';
import { useAuthForm } from '@/features/auth/use-auth-form';

export default function RegisterScreen() {
  const { form, errors, serverError, submitting, setField, submit } = useAuthForm('register');

  const onSubmit = async () => {
    if (await submit()) closeAuthScreen();
  };

  return (
    <Screen edges={['bottom']}>
      <ThemedText themeColor="textSecondary">
        Create an account to keep your plans with you. You can keep planning nights without one.
      </ThemedText>

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

      {serverError && (
        <ThemedText themeColor="danger" accessibilityLiveRegion="polite">
          {serverError}
        </ThemedText>
      )}

      <Button
        title={submitting ? 'Creating account…' : 'Create account'}
        onPress={onSubmit}
        disabled={submitting}
      />
      <Button
        title="I already have an account"
        variant="secondary"
        onPress={() => router.replace('/login')}
        disabled={submitting}
      />
    </Screen>
  );
}
