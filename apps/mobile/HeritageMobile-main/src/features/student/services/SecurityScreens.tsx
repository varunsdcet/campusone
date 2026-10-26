import React, { useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Icon, Input, InlineError, DemoLabel, ListRow, Toggle } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useVerifyPassword, useChangePassword, useSettings, useUpdateSettings } from '../../auth/useAuth';
import { ServiceError } from '../../../services/errors';
import { PasswordStrength } from '../../auth/PasswordStrength';
import { toast } from '../../../state/uiStore';
import { useSessionStore } from '../../../state/sessionStore';

export function SecurityScreen({ navigation, route }: RootScreenProps<'StudentSecurity'>) {
  const verify = useVerifyPassword();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const next = route.params?.next ?? 'changePassword';
  const continueNext = async () => {
    setError(null);
    try {
      await verify.mutateAsync(password);
      navigation.replace(next === 'personalDetails' ? Routes.StudentPersonalDetails : Routes.StudentChangePassword);
    } catch (e) {
      setError(ServiceError.is(e) ? e.message : 'Verification failed');
    }
  };
  return (
    <Screen testID="security-screen" header={<ScreenHeader backLabel="Back" title="Account Verification" actions={[{ icon: 'ShieldCheck', accessibilityLabel: 'Security', onPress: () => undefined }]} />}>
      <Stack>
        <View style={styles.center}>
          <View style={styles.lock}><Icon name="Lock" size={30} color={colors.green900} /></View>
          <Text variant="displayMd" align="center">Account verification required</Text>
          <Text variant="body" align="center">To continue, first verify that it's you.</Text>
        </View>
        <Card>
          <Input label="Current password" leftIcon="Lock" secure placeholder="Enter your current password" value={password} onChangeText={setPassword} error={error ?? undefined} textContentType="oneTimeCode" testID="security-password" onSubmitEditing={() => continueNext()} />
          <Row gap={6} style={{ marginVertical: spacing.sm }}><Icon name="Info" size={14} color={colors.inkMuted} /><Text variant="caption" style={{ flex: 1 }}>For your security, please verify your current password before continuing to {next === 'personalDetails' ? 'personal details' : 'security settings'}.</Text></Row>
          <Button title="Continue →" onPress={continueNext} loading={verify.isPending} disabled={!password} disabledReason="Enter your current password" testID="security-continue" />
          <Pressable accessibilityRole="link" onPress={() => navigation.navigate(Routes.ResetPassword)} style={styles.link} testID="security-forgot"><Text variant="label" color={colors.coral600}>Forgot password?</Text></Pressable>
        </Card>
        <Card tone="green"><Row gap={8}><Icon name="CircleCheck" size={18} color={colors.success600} /><View style={{ flex: 1 }}><Text variant="label">Campus One</Text><Text variant="caption">{isMockMode() ? 'Demo identity check against local mock credentials · no compliance claim' : 'Your password is verified with Campus One before continuing.'}</Text></View></Row></Card>
        <DemoLabel text="Verification uses demo credentials only" />
      </Stack>
    </Screen>
  );
}

const pwSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: z.string().min(8, 'Use at least 8 characters').regex(/[A-Z]/, 'Include an uppercase letter').regex(/\d/, 'Include a number'),
  confirm: z.string(),
}).refine(v => v.newPassword === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });
type PwValues = z.infer<typeof pwSchema>;

/** Inferred security-settings destination after verification. */
export function ChangePasswordScreen({ navigation }: RootScreenProps<'StudentChangePassword'>) {
  const change = useChangePassword();
  const settings = useSettings();
  const update = useUpdateSettings();
  const isStudent = useSessionStore(s => s.user?.role) === 'student';
  const { control, handleSubmit, setError, formState: { errors } } = useForm<PwValues>({ resolver: zodResolver(pwSchema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } });
  const onSubmit = handleSubmit(async v => {
    try {
      await change.mutateAsync({ currentPassword: v.currentPassword, newPassword: v.newPassword });
      toast(isMockMode() ? 'Demo password updated for this device' : 'Password updated', 'success');
      navigation.goBack();
    } catch (e) {
      if (ServiceError.is(e, 'UNAUTHENTICATED')) setError('currentPassword', { message: e.message });
    }
  });
  return (
    <Screen testID="change-password" header={<ScreenHeader title="Security settings" />}>
      <Stack>
        <DemoLabel text="Inferred security-settings screen" />
        <Card>
          <Text variant="titleSm" style={{ marginBottom: spacing.sm }}>Change password</Text>
          <Stack gap={spacing.sm}>
            <Controller control={control} name="currentPassword" render={({ field }) => <Input label="Current password" secure textContentType="oneTimeCode" value={field.value} onChangeText={field.onChange} error={errors.currentPassword?.message} testID="cp-current" />} />
            <Controller control={control} name="newPassword" render={({ field }) => (
              <>
                <Input label="New password" secure textContentType="oneTimeCode" value={field.value} onChangeText={field.onChange} error={errors.newPassword?.message} testID="cp-new" />
                <PasswordStrength password={field.value} />
              </>
            )} />
            <Controller control={control} name="confirm" render={({ field }) => <Input label="Confirm new password" secure textContentType="oneTimeCode" value={field.value} onChangeText={field.onChange} error={errors.confirm?.message} testID="cp-confirm" />} />
            <InlineError error={change.error && !ServiceError.is(change.error, 'UNAUTHENTICATED') ? change.error : null} />
            <Button title="Update password" onPress={onSubmit} loading={change.isPending} testID="cp-submit" />
          </Stack>
        </Card>
        <Card>
          <Text variant="titleSm" style={{ marginBottom: spacing.sm }}>Preferences</Text>
          <Toggle label="In-app notifications" value={settings.data?.notificationsEnabled ?? true} onChange={v => update.mutate({ notificationsEnabled: v })} testID="cp-notifications" />
          <ListRow icon="Globe" title="Time zone" subtitle={settings.data?.timeZone ?? '—'} onPress={() => navigation.navigate(Routes.TimeZone)} />
          {isStudent ? <ListRow icon="UserPen" title="Update personal details" subtitle="Creates a change request" onPress={() => navigation.navigate(Routes.StudentPersonalDetails)} /> : null}
        </Card>
        {isMockMode() ? <Card tone="muted"><Text variant="caption">Demo passwords live only in local demo storage. No real credentials, tokens or production records are stored.</Text></Card> : null}
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  lock: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.green50, alignItems: 'center', justifyContent: 'center' },
  link: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', marginTop: spacing.xs },
});
