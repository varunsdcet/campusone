import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Screen, Text, InlineError, Card, Icon, DemoLabel } from '../../components';
import { colors, spacing } from '../../theme';
import { isMockMode } from '../../config/appConfig';
import { Wordmark } from './Brand';
import { useRequestPasswordReset, useResetPassword } from './useAuth';
import { PasswordStrength, passwordMeetsRules } from './PasswordStrength';
import type { RootScreenProps } from '../../navigation/types';
import { useSessionStore } from '../../state/sessionStore';
import { formatDateTime } from '../../utils/format';

const schema = z.object({
  email: z.string().trim().email('Enter the email address registered to your account'),
  studentNumber: z.string().trim(),
});
type FormValues = z.infer<typeof schema>;

/** Accepts either the full link from the email or just the token. */
const tokenFrom = (input: string) => {
  const s = input.trim();
  const m = /[?&]token=([A-Za-z0-9]+)/.exec(s);
  return m ? m[1] : s;
};

export function ResetPasswordScreen({ navigation }: RootScreenProps<'ResetPassword'>) {
  const request = useRequestPasswordReset();
  const reset = useResetPassword();
  const [step, setStep] = useState<'request' | 'sent' | 'reset' | 'done'>('request');
  const [email, setEmail] = useState('');
  const [link, setLink] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', studentNumber: '' } });

  const onRequest = handleSubmit(async v => {
    const r = await request.mutateAsync({ email: v.email, studentNumber: v.studentNumber || undefined }).catch(() => null);
    if (!r) return;
    setEmail(v.email.trim());
    if (r.resetToken) setLink(r.resetToken);
    setStep('sent');
  });

  const token = tokenFrom(link);
  const tokenError = touched && token.length < 20 ? 'Paste the reset link from your email' : undefined;
  const pwError = touched && !passwordMeetsRules(password) ? 'Password does not meet the rules below' : undefined;
  const confirmError = touched && confirm !== password ? 'Passwords do not match' : undefined;
  const onReset = async () => {
    setTouched(true);
    if (token.length < 20 || !passwordMeetsRules(password) || confirm !== password) return;
    try {
      await reset.mutation.mutateAsync({ token, password });
      setStep('done');
    } catch {
      // shown inline
    }
  };

  const mock = isMockMode();
  const signedIn = useSessionStore(s => s.status) === 'signedIn';
  const subtitle = step === 'reset' ? 'Paste the link from your email and choose a new password.'
    : step === 'done' ? 'Your password has been changed.'
    : 'Enter the email registered to your Campus One account. Students and instructors use the same form.';

  return (
    <Screen testID="reset-screen" contentStyle={styles.content}>
      <View style={styles.brand}><Wordmark /></View>
      <Text variant="displayLg" align="center">{step === 'reset' ? 'New Password' : 'Reset Password'}</Text>
      <Text variant="body" align="center">{subtitle}</Text>

      {step === 'request' ? (
        <>
          <Controller control={control} name="email" render={({ field }) => (
            <Input testID="reset-email" label="Registered email" placeholder="name@college.edu" leftIcon="Mail" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.email?.message} />
          )} />
          <Controller control={control} name="studentNumber" render={({ field }) => (
            <Input testID="reset-student" label="Student number (students only)" placeholder="Leave blank if you are an instructor" leftIcon="IdCard" autoCapitalize="characters" autoCorrect={false} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} />
          )} />
          <InlineError error={request.error} />
          <Button testID="reset-submit" title="Send reset link" size="lg" onPress={onRequest} loading={request.isPending} />
        </>
      ) : null}

      {step === 'sent' ? (
        <Card tone="green" testID="reset-success">
          <View style={{ gap: spacing.sm }}>
            <Icon name="MailCheck" size={28} color={colors.green900} />
            <Text variant="titleSm">{mock ? 'Mock reset request recorded' : 'Check your email'}</Text>
            <Text variant="bodySm">{mock ? `No email was sent. This demo created a local request at ${formatDateTime(request.data?.createdAt ?? new Date())}.` : `If an account exists for ${email}, we've sent a password reset link. It's valid for 60 minutes.`}</Text>
            {!mock && reset.supported ? <Button title="I have the reset link →" onPress={() => setStep('reset')} testID="reset-have-link" /> : null}
            <Button title="Send again" variant="ghost" size="sm" onPress={() => setStep('request')} testID="reset-again" />
            <DemoLabel text="DEMO · no email sent" />
          </View>
        </Card>
      ) : null}

      {step === 'reset' ? (
        <>
          <Input testID="reset-link" label="Reset link" placeholder="Paste the link from the email" leftIcon="Link" autoCapitalize="none" autoCorrect={false} value={link} onChangeText={setLink} error={tokenError} />
          <Input testID="reset-new" label="New password" leftIcon="Lock" secure textContentType="newPassword" value={password} onChangeText={setPassword} error={pwError} />
          <PasswordStrength password={password} />
          <Input testID="reset-confirm" label="Confirm new password" leftIcon="Lock" secure textContentType="newPassword" value={confirm} onChangeText={setConfirm} error={confirmError} />
          <InlineError error={reset.mutation.error} />
          <Button testID="reset-update" title="Update password" size="lg" onPress={onReset} loading={reset.mutation.isPending} />
        </>
      ) : null}

      {step === 'done' ? (
        <Card tone="green" testID="reset-done">
          <View style={{ gap: spacing.sm }}>
            <Icon name="CircleCheck" size={28} color={colors.success600} />
            <Text variant="titleSm">Password updated</Text>
            <Text variant="bodySm">You've been signed out of other devices. Sign in with your new password.</Text>
            <Button title="Back to sign in" onPress={() => navigation.goBack()} testID="reset-signin" />
          </View>
        </Card>
      ) : null}

      {step !== 'done' ? (
        <Pressable accessibilityRole="link" onPress={() => navigation.goBack()} style={styles.back} testID="reset-back">
          <Text variant="label" color={colors.green900} style={{ textDecorationLine: 'underline' }}>{signedIn ? 'Back' : 'Back to sign in'}</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingTop: spacing.xxl },
  brand: { alignItems: 'center', marginBottom: spacing.sm },
  back: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
});
