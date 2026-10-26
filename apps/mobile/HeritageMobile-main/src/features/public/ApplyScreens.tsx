import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Card, Icon, InfoBanner, InlineError, KeyValueRow, Row, Screen, ScreenHeader, Stack, Text } from '../../components';
import { colors, spacing } from '../../theme';
import { Routes } from '../../navigation/routes';
import type { RootScreenProps } from '../../navigation/types';
import { ServiceError } from '../../services/errors';
import { formatDate } from '../../utils/format';
import { useLogin } from '../auth/useAuth';
import { useApply } from './usePublicFlows';
import { CheckField, DateInputField, SelectField, TextField } from './fields';
import { applyDefaults, applySchema, toApplyPayload, type ApplyFormValues, CAMPUSES, GENDERS, INTAKE_TERMS, PROGRAM_CATEGORIES, PROGRAMS, RESIDENCY } from './forms';

const STEPS: { title: string; fields: (keyof ApplyFormValues)[] }[] = [
  { title: 'Personal', fields: ['givenName', 'middleName', 'familyName', 'dateOfBirth', 'gender', 'residency'] },
  { title: 'Contact', fields: ['email', 'phone', 'country', 'addressLine1', 'addressLine2', 'city', 'region', 'postalCode'] },
  { title: 'Program', fields: ['programCategory', 'programName', 'intakeTerm', 'campus'] },
  { title: 'Account', fields: ['password', 'confirm', 'consent'] },
  { title: 'Review', fields: [] },
];

export function PublicApplyScreen({ navigation }: RootScreenProps<'PublicApply'>) {
  const [step, setStep] = useState(0);
  const apply = useApply();
  const login = useLogin();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const { control, trigger, getValues } = useForm<ApplyFormValues>({ resolver: zodResolver(applySchema), defaultValues: applyDefaults, mode: 'onTouched' });
  const values = useWatch({ control });

  const next = async () => {
    if (await trigger(STEPS[step].fields)) setStep(s => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => (step === 0 ? navigation.goBack() : setStep(s => s - 1));

  const submit = async () => {
    setSubmitError(null);
    if (!(await trigger())) {
      const issues = applySchema.safeParse(getValues()).error?.issues ?? [];
      const firstInvalid = STEPS.findIndex(s => s.fields.some(f => issues.some(i => i.path[0] === f)));
      if (firstInvalid >= 0) setStep(firstInvalid);
      return;
    }
    const payload = toApplyPayload(getValues());
    try {
      await apply.mutateAsync(payload);
    } catch (e) {
      setSubmitError(e);
      return;
    }
    try {
      await login.mutateAsync({ loginId: payload.email, password: payload.password, rememberMe: true });
    } catch {
      navigation.replace(Routes.PublicApplySuccess, { email: payload.email });
    }
  };

  const busy = apply.isPending || login.isPending;
  const conflict = ServiceError.is(submitError, 'CONFLICT');
  return (
    <Screen
      testID="public-apply"
      header={<ScreenHeader title="Apply now" subtitle={`Step ${step + 1} of ${STEPS.length} · ${STEPS[step].title}`} onBack={back} />}
      footer={
        <Row>
          {step > 0 ? <View style={{ flex: 1 }}><Button title="Back" variant="outline" onPress={back} disabled={busy} testID="apply-back" /></View> : null}
          <View style={{ flex: 2 }}>
            {step < STEPS.length - 1
              ? <Button title="Continue" onPress={next} testID="apply-next" />
              : <Button title={login.isPending ? 'Signing you in…' : 'Submit application'} onPress={submit} loading={busy} testID="apply-submit" />}
          </View>
        </Row>
      }
    >
      <Stack>
        <Text variant="overline" color={colors.coral600}>Campus One admissions</Text>
        <Text variant="displayLg">Apply with confidence.</Text>
        <StepDots step={step} onPress={i => i < step && setStep(i)} />

        {step === 0 ? (
          <Card><Stack gap={spacing.sm}>
            <Text variant="overline">Personal details</Text>
            <TextField control={control} name="givenName" label="First name" required autoComplete="given-name" testID="apply-given" />
            <TextField control={control} name="middleName" label="Middle name" autoComplete="additional-name" testID="apply-middle" />
            <TextField control={control} name="familyName" label="Last name" required autoComplete="family-name" testID="apply-family" />
            <DateInputField control={control} name="dateOfBirth" label="Date of birth" required testID="apply-dob" />
            <SelectField control={control} name="gender" label="Gender" options={GENDERS} required testID="apply-gender" />
            <SelectField control={control} name="residency" label="Visa / residency status" options={RESIDENCY} required testID="apply-residency" />
          </Stack></Card>
        ) : null}

        {step === 1 ? (
          <Card><Stack gap={spacing.sm}>
            <Text variant="overline">Contact & address</Text>
            <TextField control={control} name="email" label="Email" required keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" helper="You will sign in to your application with this email." testID="apply-email" />
            <TextField control={control} name="phone" label="Phone" required keyboardType="phone-pad" autoComplete="tel" testID="apply-phone" />
            <TextField control={control} name="country" label="Country" required testID="apply-country" />
            <TextField control={control} name="addressLine1" label="Address line 1" required autoComplete="street-address" testID="apply-address1" />
            <TextField control={control} name="addressLine2" label="Address line 2" testID="apply-address2" />
            <TextField control={control} name="city" label="City" required testID="apply-city" />
            <TextField control={control} name="region" label="Province / state" testID="apply-region" />
            <TextField control={control} name="postalCode" label="Postal code" autoCapitalize="characters" autoComplete="postal-code" testID="apply-postal" />
          </Stack></Card>
        ) : null}

        {step === 2 ? (
          <Card><Stack gap={spacing.sm}>
            <Text variant="overline">Program selection</Text>
            <SelectField control={control} name="programCategory" label="Program category" options={PROGRAM_CATEGORIES} required testID="apply-category" />
            <SelectField control={control} name="programName" label="Program" options={PROGRAMS} required testID="apply-program" />
            <SelectField control={control} name="intakeTerm" label="Admission term" options={INTAKE_TERMS} required testID="apply-intake" />
            <SelectField control={control} name="campus" label="Campus" options={CAMPUSES} required testID="apply-campus" />
          </Stack></Card>
        ) : null}

        {step === 3 ? (
          <Card><Stack gap={spacing.sm}>
            <Text variant="overline">Account & declaration</Text>
            <Text variant="bodySm">Create a password for your applicant account. You will use it to track your application and upload documents.</Text>
            <TextField control={control} name="password" label="Create password" required secure textContentType="newPassword" autoComplete="new-password" helper="At least 8 characters." testID="apply-password" />
            <TextField control={control} name="confirm" label="Confirm password" required secure textContentType="newPassword" autoComplete="new-password" testID="apply-confirm" />
            <CheckField control={control} name="consent" label="I confirm the information is complete and correct, and I agree to the Campus One privacy notice." testID="apply-consent" />
          </Stack></Card>
        ) : null}

        {step === 4 ? (
          <>
            <ReviewSection title="Personal" onEdit={() => setStep(0)} rows={[
              ['Name', [values.givenName, values.middleName, values.familyName].filter(Boolean).join(' ')],
              ['Date of birth', values.dateOfBirth ? formatDate(values.dateOfBirth) : ''],
              ['Gender', values.gender],
              ['Residency', values.residency],
            ]} />
            <ReviewSection title="Contact & address" onEdit={() => setStep(1)} rows={[
              ['Email', values.email],
              ['Phone', values.phone],
              ['Address', [values.addressLine1, values.addressLine2].filter(Boolean).join(', ')],
              ['City', [values.city, values.region, values.postalCode].filter(Boolean).join(', ')],
              ['Country', values.country],
            ]} />
            <ReviewSection title="Program" onEdit={() => setStep(2)} rows={[
              ['Category', values.programCategory],
              ['Program', values.programName],
              ['Admission term', values.intakeTerm],
              ['Campus', values.campus],
            ]} />
            <InfoBanner tone="grey" icon="FileText" text="After your account is created, sign in to upload your required documents (Grade 10 and Grade 12 transcripts, post-secondary documents and a language proficiency report)." />
          </>
        ) : null}

        {submitError ? (
          conflict ? (
            <Card tone="coral" testID="apply-conflict">
              <Stack gap={spacing.sm}>
                <Text variant="bodyStrong">{(submitError as ServiceError).message}</Text>
                <Button title="Sign in instead" onPress={() => navigation.navigate(Routes.Login)} testID="apply-conflict-signin" />
                <Button title="Use a different email" variant="outline" onPress={() => { setSubmitError(null); setStep(1); }} />
              </Stack>
            </Card>
          ) : <InlineError error={submitError} />
        ) : null}
      </Stack>
    </Screen>
  );
}

function StepDots({ step, onPress }: { step: number; onPress: (i: number) => void }) {
  return (
    <Card padding={spacing.md}>
      <Row justify="space-between">
        {STEPS.map((s, i) => (
          <Pressable key={s.title} style={styles.step} onPress={() => onPress(i)} disabled={i >= step} accessibilityRole="button" accessibilityLabel={`Step ${i + 1}: ${s.title}`} accessibilityState={{ selected: i === step }}>
            <View style={[styles.dot, i <= step ? styles.dotActive : null]}>
              {i < step ? <Icon name="Check" size={14} color={colors.white} /> : <Text variant="label" color={i <= step ? colors.white : colors.inkMuted}>{i + 1}</Text>}
            </View>
            <Text variant="caption" align="center" style={{ fontSize: 10 }}>{s.title}</Text>
          </Pressable>
        ))}
      </Row>
    </Card>
  );
}

function ReviewSection({ title, rows, onEdit }: { title: string; rows: [string, string | undefined][]; onEdit: () => void }) {
  const shown = rows.filter(([, v]) => !!v);
  return (
    <Card>
      <Row justify="space-between">
        <Text variant="overline">{title}</Text>
        <Pressable onPress={onEdit} accessibilityRole="button" hitSlop={8}><Text variant="label" color={colors.coral600}>Edit</Text></Pressable>
      </Row>
      {shown.map(([k, v], i) => <KeyValueRow key={k} label={k} value={v ?? ''} border={i < shown.length - 1} />)}
    </Card>
  );
}

export function PublicApplySuccessScreen({ navigation, route }: RootScreenProps<'PublicApplySuccess'>) {
  return (
    <Screen testID="public-apply-success" header={<ScreenHeader title="Application started" hideBack />} footer={<Button title="Go to sign in" onPress={() => navigation.popToTop()} testID="apply-success-signin" />}>
      <Stack>
        <View style={styles.badge}><Icon name="CircleCheck" size={36} color={colors.green700} /></View>
        <Text variant="displayLg" align="center">Your application account was created</Text>
        <Text variant="body" align="center">We saved your application details for <Text variant="bodyStrong">{route.params.email}</Text>.</Text>
        <Card tone="gold">
          <Stack gap={spacing.sm}>
            <Text variant="titleSm">Next steps</Text>
            {[
              'Sign in with your email and the password you just created.',
              'Upload your required documents to complete the application.',
              'Admissions reviews your application and contacts you by email.',
            ].map((t, i) => (
              <Row key={t} gap={8} align="flex-start"><Text variant="label" color={colors.inkMuted}>{i + 1}.</Text><Text variant="body" style={{ flex: 1 }}>{t}</Text></Row>
            ))}
          </Stack>
        </Card>
        <Text variant="caption" align="center">If the mobile app cannot open your application yet, sign in on the Campus One website to continue.</Text>
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { flex: 1, alignItems: 'center', gap: 4 },
  dot: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  dotActive: { backgroundColor: colors.green900 },
  badge: { alignSelf: 'center', width: 72, height: 72, borderRadius: 36, backgroundColor: colors.green50, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
});
