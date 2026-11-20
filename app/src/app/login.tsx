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
import { closeAuthScreen } from '@/features/auth/navigation';
import { useAuthForm } from '@/features/auth/use-auth-form';

export default function LoginScreen() {
  const { form, errors, serverError, submitting, setField, submit } = useAuthForm('login');

  const onSubmit = async () => {
    if (await submit()) closeAuthScreen();
  };

  return (
    <Screen edges={['bottom']} gap={Spacing.four}>
      <PageHeader
        icon="log-in-outline"
        title="Welcome back"
        description="Log in to use your account. You can keep planning nights without one."
      />

      <Card style={styles.form}>
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
      </Card>

      {serverError && <ErrorNote>{serverError}</ErrorNote>}

      <View style={styles.actions}>
        <Button
          title={submitting ? 'Logging in…' : 'Log in'}
          size="large"
          icon="log-in-outline"
          onPress={onSubmit}
          disabled={submitting}
        />
        <Button
          title="Create an account"
          variant="secondary"
          onPress={() => router.replace('/register')}
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
