import { router } from 'expo-router';

import { Button } from '@/components/button';
import { FormField } from '@/components/form/form-field';
import { TextField } from '@/components/form/text-field';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { closeAuthScreen } from '@/features/auth/navigation';
import { useAuthForm } from '@/features/auth/use-auth-form';

export default function LoginScreen() {
  const { form, errors, serverError, submitting, setField, submit } = useAuthForm('login');

  const onSubmit = async () => {
    if (await submit()) closeAuthScreen();
  };

  return (
    <Screen edges={['bottom']}>
      <ThemedText themeColor="textSecondary">
        Log in to use your account. You can keep planning nights without one.
      </ThemedText>

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

      <FormField label="Password" error={errors.password}>
        <TextField
          accessibilityLabel="Password"
          value={form.password}
          onChangeText={(password) => setField('password', password)}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
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
        title={submitting ? 'Logging in…' : 'Log in'}
        onPress={onSubmit}
        disabled={submitting}
      />
      <Button
        title="Create an account"
        variant="secondary"
        onPress={() => router.replace('/register')}
        disabled={submitting}
      />
    </Screen>
  );
}
