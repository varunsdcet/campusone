import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, Icon, Input, InfoBanner, DemoLabel, KeyValueRow, BottomSheet } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useCurrentUser } from '../../../state/sessionStore';
import { useRecordMutations } from '../records/useRecords';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';
import { useUnsavedChangesGuard } from '../../shared/hooks';

const phone = z.string().trim().regex(/^[()\d\s+-]{7,20}$/, 'Enter a valid phone number');
const schema = z.object({
  lastName: z.string().trim().min(1, 'Last name is required'),
  firstName: z.string().trim().min(1, 'First name is required'),
  middleName: z.string().trim().optional(),
  preferredName: z.string().trim().optional(),
  phone,
  email: z.string().trim().email('Enter a valid email'),
  /** Masked synthetic identifier – real identifiers are rejected. */
  sensitiveId: z.string().trim().refine(v => !isMockMode() || /^[•*\-\s0-9]*$/.test(v) && !/^\d{9}$/.test(v.replace(/\D/g, '')), 'Do not enter a real identifier in this demo. Leave the masked demo value.'),
  emergencyName: z.string().trim().min(1, 'Emergency contact name is required'),
  emergencyPhone: phone,
});
type FormValues = z.infer<typeof schema>;

export function PersonalDetailsScreen({ navigation }: RootScreenProps<'StudentPersonalDetails'>) {
  const user = useCurrentUser();
  const st = user.student!;
  const m = useRecordMutations();
  const [review, setReview] = useState<FormValues | null>(null);
  const [showId, setShowId] = useState(false);
  const { control, handleSubmit, formState: { errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { lastName: user.lastName, firstName: user.firstName, middleName: st.middleName ?? '', preferredName: user.preferredName ?? '', phone: st.phone, email: user.email, sensitiveId: st.sensitiveIdMasked, emergencyName: st.emergencyContactName, emergencyPhone: st.emergencyContactPhone },
  });
  const { allowLeave } = useUnsavedChangesGuard(isDirty && !review);
  const submit = async () => {
    if (!review) return;
    try {
      const { sensitiveId, ...safe } = review;
      void sensitiveId; // never persisted – masked demo value only
      const r = await m.submitPersonalDetails.mutateAsync({ ...safe, sensitiveId: 'masked (not stored)' });
      toast('Change request submitted for registrar approval', 'success');
      setReview(null); allowLeave();
      navigation.replace(Routes.StudentRequestDetails, { requestId: r.id });
    } catch (e) { toast(errorMessage(e), 'error'); }
  };
  const field = (name: keyof FormValues, label: string, opts: Partial<React.ComponentProps<typeof Input>> & { required?: boolean } = {}) => (
    <Controller key={name} control={control} name={name} render={({ field: f }) => <Input label={label} value={f.value ?? ''} onChangeText={f.onChange} onBlur={f.onBlur} error={errors[name]?.message as string | undefined} testID={`pd-${name}`} {...opts} />} />
  );
  return (
    <Screen testID="personal-details" header={<ScreenHeader actions={[{ icon: 'CircleHelp', accessibilityLabel: 'Help', onPress: () => navigation.navigate(Routes.StudentSupport) }]} />} footer={<Stack gap={4}><Button title="Continue →" onPress={handleSubmit(v => setReview(v))} testID="pd-continue" /><Text variant="caption" align="center">Changes require registrar approval before updating official records.</Text></Stack>}>
      <Stack>
        <Pill label="Institutional student record" tone="grey" small icon={<Icon name="Lock" size={11} color={colors.inkSecondary} />} />
        <Text variant="displayLg">Request to Update Personal Details</Text>
        <Text variant="body">Review and update your contact information and emergency contact details for Campus One records.</Text>
        {isMockMode() ? <InfoBanner tone="green" icon="ShieldCheck" title="Demo privacy note" text="This demo stores synthetic values only. It does not encrypt or transmit data and makes no PIPEDA compliance claim." /> : null}
        <Card>
          <Row gap={spacing.sm} style={{ marginBottom: 4 }}><View style={styles.tile}><Icon name="UserRound" size={18} color={colors.green900} /></View><Text variant="titleSm">Contact Information</Text></Row>
          <Text variant="caption" style={{ marginBottom: spacing.sm }}>Keep your personal information up to date for official college correspondence.</Text>
          <Stack gap={spacing.sm}>
            {field('lastName', 'Last Name', { required: true })}
            {field('firstName', 'First Name', { required: true })}
            {field('middleName', 'Middle Name (Optional)')}
            {field('preferredName', 'Preferred Name (Optional)')}
            {field('phone', 'Phone Number', { required: true, prefix: 'CA +1 |', keyboardType: 'phone-pad' })}
            {field('email', 'E-mail Address', { required: true, leftIcon: 'Mail', keyboardType: 'email-address', autoCapitalize: 'none', helper: 'Official institutional email address for notices.' })}
            {isMockMode() ? <Controller control={control} name="sensitiveId" render={({ field: f }) => <Input label="Sensitive ID (masked demo value)" required rightLabel="Demo only" leftIcon="ShieldCheck" value={f.value} onChangeText={f.onChange} secureTextEntry={!showId} rightIcon={showId ? 'EyeOff' : 'Eye'} onRightIconPress={() => setShowId(s => !s)} error={errors.sensitiveId?.message} helper="Never enter a real SIN here. The demo keeps a masked synthetic value and does not persist this field." testID="pd-sensitiveId" />} /> : null}
          </Stack>
        </Card>
        <Card>
          <Row gap={spacing.sm} style={{ marginBottom: 4 }}><View style={[styles.tile, { backgroundColor: colors.coral100 }]}><Icon name="TriangleAlert" size={18} color={colors.coral600} /></View><Text variant="titleSm">Emergency Contact</Text></Row>
          <Text variant="caption" style={{ marginBottom: spacing.sm }}>Add someone we can contact in the event of an urgent situation.</Text>
          <Stack gap={spacing.sm}>
            {field('emergencyName', 'Emergency Contact Name', { required: true })}
            {field('emergencyPhone', 'Emergency Contact Phone Number', { required: true, leftIcon: 'Phone', keyboardType: 'phone-pad' })}
          </Stack>
        </Card>
        <DemoLabel text="Synthetic identity · official record is not rewritten directly" />
      </Stack>
      <BottomSheet visible={!!review} onClose={() => setReview(null)} title="Review changes" subtitle="A pending request will be created" testID="pd-review">
        {review ? (<>
          {(['firstName', 'lastName', 'preferredName', 'phone', 'email', 'emergencyName', 'emergencyPhone'] as const).map((k, i, arr) => <KeyValueRow key={k} label={k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())} value={review[k] || '—'} border={i < arr.length - 1} />)}
          <InfoBanner tone="gold" icon="Info" text="Submitting creates a pending change request. Your official record stays unchanged until the registrar approves." />
          <Button title="Submit request" onPress={submit} loading={m.submitPersonalDetails.isPending} testID="pd-submit" />
          <Button title="Back to editing" variant="ghost" onPress={() => setReview(null)} />
        </>) : null}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({ tile: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.green50, alignItems: 'center', justifyContent: 'center' } });
