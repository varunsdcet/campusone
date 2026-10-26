import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, Icon, Input, DateField, InfoBanner, DemoLabel, KeyValueRow, BottomSheet, LoadingState, Select, ChipRow, Checkbox } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useCurrentUser } from '../../../state/sessionStore';
import { useEnglishTests, useRecordMutations } from '../records/useRecords';
import { formatDate, formatDateTime, formatMoney } from '../../../utils/format';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';
import { clock, DAY_MS } from '../../../utils/clock';

const STEPS = ['Register profile', 'Registrar review', 'Take the test', 'Receive result'];

export function EnglishTestScreen({ navigation }: RootScreenProps<'StudentEnglishTest'>) {
  const tests = useEnglishTests();
  const [instructions, setInstructions] = useState(false);
  const current = tests.data?.[0];
  const step = current ? (current.status === 'pending-review' ? 1 : current.status === 'scheduled' ? 2 : 3) : 0;
  return (
    <Screen testID="english-test" header={<ScreenHeader title="HCC English Test" center />}>
      {tests.isLoading ? <LoadingState /> : (
        <Stack>
          <Text variant="overline" color={colors.coral600}>HCC English test · placement</Text>
          <Text variant="displayLg">Know your starting point.</Text>
          <Text variant="body">The English placement process checks reading, writing and language use so Campus One can recommend the right academic pathway. Registration is reviewed by the registrar before test credentials are issued.</Text>
          <View style={styles.photo}><Icon name="BookOpen" size={28} color={colors.cream} /><Text variant="overline" color={colors.cream}>{isMockMode() ? 'Institutional placement assessment (demo)' : 'Institutional placement assessment'}</Text></View>
          <Card tone="dark">
            <Text variant="overline" color={colors.coral500}>What to expect</Text>
            <Text variant="displaySm" color={colors.white} style={{ marginVertical: 4 }}>Three focused sections. One clear next step.</Text>
            {[['01', 'Reading', 'Comprehension, inference and vocabulary in context.'], ['02', 'Writing', 'Sentence structure, expression and revision choices.'], ['03', 'Language use', 'Grammar, usage and effective communication.']].map(([n, t, d]) => (
              <View key={n} style={styles.section}><Text variant="overline" color={colors.gold500}>{n}</Text><Text variant="titleSm" color={colors.white}>{t}</Text><Text variant="caption" color={colors.green100}>{d}</Text></View>
            ))}
          </Card>
          <Text variant="overline" color={colors.coral600}>Registration flow</Text>
          <Card padding={spacing.md}>
            <Row justify="space-between">
              {STEPS.map((label, i) => (
                <View key={label} style={styles.step}>
                  <View style={[styles.stepDot, i <= step ? styles.stepActive : null]}><Text variant="label" color={i <= step ? colors.white : colors.inkMuted}>{i + 1}</Text></View>
                  <Text variant="caption" align="center" style={{ fontSize: 10 }}>{label}</Text>
                </View>
              ))}
            </Row>
          </Card>
          {current ? (
            <Card tone="gold">
              <Row justify="space-between"><Text variant="titleSm">Registration status</Text><Pill label={current.status === 'pending-review' ? 'Pending review' : current.status} tone={current.status === 'pending-review' ? 'coral' : 'green'} small dot /></Row>
              <KeyValueRow label="Submitted" value={formatDateTime(current.createdAt)} />
              <KeyValueRow label="Preferred date" value={formatDate(current.preferredDate)} border={false} />
              <Text variant="caption" style={{ marginTop: 4 }}>{isMockMode() ? 'Next step: the registrar reviews your profile and issues demo test credentials. No official ACCUPLACER account, credential or certified score is created.' : 'Next step: the registrar reviews your profile and contacts you with test credentials.'}</Text>
            </Card>
          ) : (
            <Button title="Register for the English Test →" onPress={() => navigation.navigate(Routes.StudentEnglishTestRegister)} testID="et-register" />
          )}
          <Button title="Student instructions" variant="outline" onPress={() => setInstructions(true)} testID="et-instructions" />
          <DemoLabel text="No official test integration · demo registration only" />
        </Stack>
      )}
      <BottomSheet visible={instructions} onClose={() => setInstructions(false)} title="Student instructions" subtitle={isMockMode() ? 'Demo guidance' : undefined} testID="et-instructions-sheet">
        {(isMockMode() ? ['Bring photo identification on test day.', 'Arrive 15 minutes early; the demo test window is 2 hours.', 'The placement result recommends a pathway; it is not a pass/fail certificate.', 'Any practice questions provided in this demo are labelled practice/demo and are not official items.'] : ['Bring photo identification on test day.', 'Arrive 15 minutes early.', 'The placement result recommends a pathway; it is not a pass/fail certificate.']).map((t, i) => <Row key={t} gap={8} align="flex-start"><Text variant="label" color={colors.inkMuted}>{i + 1}.</Text><Text variant="body" style={{ flex: 1 }}>{t}</Text></Row>)}
      </BottomSheet>
    </Screen>
  );
}

const TEST_TYPES = [{ value: 'Placement test', label: 'Placement test' }, { value: 'Placement retest', label: 'Retest' }];
/** Live mode has no published slot list, so students state a preferred session and the registrar confirms the slot. */
const sessionOptions = () => isMockMode()
  ? [{ value: '9:00 AM (demo slot)', label: '9:00 AM' }, { value: '1:00 PM (demo slot)', label: '1:00 PM' }, { value: '5:30 PM (demo slot)', label: '5:30 PM' }]
  : [{ value: 'Morning', label: 'Morning' }, { value: 'Afternoon', label: 'Afternoon' }, { value: 'Evening', label: 'Evening' }];
const DEMO_CAMPUSES = ['Main campus (demo)', 'Downtown campus (demo)'];
const DEMO_FEE = 50;

const schema = z.object({
  testType: z.string().min(1, 'Choose a test type'),
  fullName: z.string().trim().min(2, 'Enter your full name'),
  email: z.string().trim().email('Enter a valid email'),
  phone: z.string().trim().min(7, 'Enter a phone number'),
  preferredDate: z.string().min(1, 'Choose a preferred date'),
  preferredSession: z.string().min(1, 'Choose a session'),
  campus: z.string().optional(),
  firstLanguage: z.string().trim().min(1, 'Select your first language'),
  accommodation: z.string().trim().optional(),
  consent: z.boolean().refine(v => v, 'You must agree before submitting'),
}).refine(v => !isMockMode() || !!v.campus, { message: 'Choose a campus', path: ['campus'] });
type FormValues = z.infer<typeof schema>;

export function EnglishTestRegisterScreen({ navigation }: RootScreenProps<'StudentEnglishTestRegister'>) {
  const user = useCurrentUser();
  const m = useRecordMutations();
  const [review, setReview] = useState<FormValues | null>(null);
  const [confirmed, setConfirmed] = useState<{ id: string; createdAt: string } | null>(null);
  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { testType: TEST_TYPES[0].value, fullName: user.displayName, email: user.email, phone: user.student?.phone ?? '', preferredDate: '', preferredSession: '', campus: '', firstLanguage: '', accommodation: '', consent: false } });
  const submit = async () => {
    if (!review) return;
    const { consent, campus, ...rest } = review;
    try {
      const reg = await m.registerEnglishTest.mutateAsync({ ...rest, consentAccepted: consent, ...(isMockMode() ? { campus, fee: DEMO_FEE } : {}) });
      setReview(null);
      setConfirmed({ id: reg.id, createdAt: reg.createdAt });
    } catch (e) { toast(errorMessage(e), 'error'); }
  };
  return (
    <Screen testID="english-test-register" header={<ScreenHeader title="Register profile" />} footer={<Button title="Review registration" onPress={handleSubmit(v => setReview(v))} testID="et-review" />}>
      <Stack>
        <InfoBanner tone="grey" icon="Info" text={isMockMode() ? 'Registration creates a pending review record. Test credentials are only issued after registrar approval (not simulated).' : 'Registration creates a pending review record. Test credentials are only issued after registrar approval.'} />
        <Card testID="et-test-card">
          <Stack gap={spacing.sm}>
            <Text variant="overline">Test & schedule</Text>
            <Controller control={control} name="testType" render={({ field }) => <Select label="Test type" required value={field.value || undefined} onChange={field.onChange} options={TEST_TYPES} error={errors.testType?.message} testID="et-type" />} />
            <Controller control={control} name="preferredDate" render={({ field }) => <DateField label="Preferred test date" required value={field.value || undefined} onChange={field.onChange} minimumDate={new Date(clock.now() + 3 * DAY_MS)} error={errors.preferredDate?.message} testID="et-date" />} />
            <Controller control={control} name="preferredSession" render={({ field }) => (
              <View>
                <Text variant="label">{isMockMode() ? 'Test slot' : 'Preferred session'} *</Text>
                <ChipRow options={sessionOptions()} value={field.value} onChange={field.onChange} testID="et-slot" />
                {errors.preferredSession?.message ? <Text variant="caption" color={colors.danger600}>{errors.preferredSession.message}</Text> : <Text variant="caption">{isMockMode() ? 'Demo slots for the selected date.' : 'The registrar confirms your exact test slot after review.'}</Text>}
              </View>
            )} />
            {isMockMode() ? <Controller control={control} name="campus" render={({ field }) => <Select label="Campus" required value={field.value || undefined} onChange={field.onChange} options={DEMO_CAMPUSES.map(c => ({ value: c, label: c }))} error={errors.campus?.message} testID="et-campus" />} /> : null}
            {isMockMode() ? <KeyValueRow label="Test fee" value={`${formatMoney(DEMO_FEE)} (demo)`} border={false} /> : <Text variant="caption" testID="et-fee-note">Test location and any fee are confirmed by the registrar with your test credentials.</Text>}
          </Stack>
        </Card>
        <Card>
          <Stack gap={spacing.sm}>
            <Text variant="overline">Your details</Text>
            <Controller control={control} name="fullName" render={({ field }) => <Input label="Full name" required value={field.value} onChangeText={field.onChange} error={errors.fullName?.message} testID="et-name" />} />
            <Controller control={control} name="email" render={({ field }) => <Input label="Email" required keyboardType="email-address" autoCapitalize="none" value={field.value} onChangeText={field.onChange} error={errors.email?.message} testID="et-email" />} />
            <Controller control={control} name="phone" render={({ field }) => <Input label="Phone" required keyboardType="phone-pad" value={field.value} onChangeText={field.onChange} error={errors.phone?.message} testID="et-phone" />} />
            <Controller control={control} name="firstLanguage" render={({ field }) => <Select label="First language" required value={field.value || undefined} onChange={field.onChange} options={['English', 'Punjabi', 'Mandarin', 'Tagalog', 'Spanish', 'Other'].map(l => ({ value: l, label: l }))} error={errors.firstLanguage?.message} testID="et-language" />} />
            <Controller control={control} name="accommodation" render={({ field }) => <Input label="Accessibility accommodation (optional)" multiline value={field.value ?? ''} onChangeText={field.onChange} testID="et-accommodation" />} />
          </Stack>
        </Card>
        <Card padding={spacing.md}>
          <Controller control={control} name="consent" render={({ field }) => <Checkbox checked={field.value} onChange={field.onChange} label="I confirm these details are accurate and agree that Campus One may share them with the registrar to schedule my English placement test." testID="et-consent" />} />
          {errors.consent?.message ? <Text variant="caption" color={colors.danger600}>{errors.consent.message}</Text> : null}
        </Card>
        <DemoLabel text="Synthetic registration" />
      </Stack>
      <BottomSheet visible={!!review} onClose={() => setReview(null)} title="Review registration" testID="et-review-sheet">
        {review ? (<>
          <KeyValueRow label="Test type" value={review.testType} />
          {(['fullName', 'email', 'phone', 'firstLanguage'] as const).map(k => <KeyValueRow key={k} label={k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())} value={review[k]} />)}
          <KeyValueRow label="Preferred date" value={formatDate(review.preferredDate)} />
          <KeyValueRow label={isMockMode() ? 'Test slot' : 'Preferred session'} value={review.preferredSession} border={isMockMode()} />
          {isMockMode() && review.campus ? <KeyValueRow label="Campus" value={review.campus} /> : null}
          {isMockMode() ? <KeyValueRow label="Test fee" value={`${formatMoney(DEMO_FEE)} (demo)`} border={false} /> : null}
          <Button title="Submit registration" onPress={submit} loading={m.registerEnglishTest.isPending} testID="et-submit" />
          <Button title="Edit" variant="ghost" onPress={() => setReview(null)} />
        </>) : null}
      </BottomSheet>
      <BottomSheet visible={!!confirmed} onClose={() => { setConfirmed(null); navigation.goBack(); }} title="Registration received" subtitle="Pending registrar review" testID="et-confirmation">
        {confirmed ? (<>
          <Row gap={8}><Icon name="CircleCheck" size={22} color={colors.green700} /><Text variant="bodyStrong" style={{ flex: 1 }}>Your English test registration was submitted.</Text></Row>
          <KeyValueRow label="Reference" value={confirmed.id} />
          <KeyValueRow label="Submitted" value={formatDateTime(confirmed.createdAt)} border={false} />
          <Text variant="caption">The registrar reviews your registration and contacts you with your confirmed slot and test credentials.</Text>
          <Button title="Done" onPress={() => { setConfirmed(null); navigation.goBack(); }} testID="et-confirm-done" />
        </>) : null}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { height: 120, borderRadius: 16, backgroundColor: colors.green700, alignItems: 'center', justifyContent: 'center', gap: 6 },
  section: { backgroundColor: colors.green800, borderRadius: 10, padding: spacing.sm, marginTop: spacing.sm },
  step: { flex: 1, alignItems: 'center', gap: 4 },
  stepDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  stepActive: { backgroundColor: colors.green900 },
});
