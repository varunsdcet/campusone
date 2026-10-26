import React from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Accordion, Button, Card, Icon, InfoBanner, InlineError, KeyValueRow, Row, Screen, ScreenHeader, Stack, Text } from '../../components';
import { colors, spacing } from '../../theme';
import { appConfig } from '../../config/appConfig';
import { Routes } from '../../navigation/routes';
import type { RootScreenProps } from '../../navigation/types';
import { formatDateTime } from '../../utils/format';
import { toast } from '../../state/uiStore';
import { useRegisterEnglishTest } from './usePublicFlows';
import { CheckField, DateInputField, SelectField, TextField } from './fields';
import { englishTestDefaults, englishTestSchema, toEnglishTestPayload, type EnglishTestFormValues, GENDERS, PROVINCES, YES_NO } from './forms';

const OFFICIAL_PRIVACY_PDF = 'https://hccbconline.com/pdf/privacy-policy.pdf';
const INSTRUCTIONS = [
  'Enter your legal identity and current contact details exactly as they appear on your records. If you already have a Campus One Student ID, enter it twice so the registrar can safely link the profile.',
  'Saving this form registers your profile for review. It does not start a test, approve admission, or enrol you in a programme. The registrar will contact you with the scheduled test details and credentials.',
  'Use the institutions field only for organisations you authorize to receive the reviewed result.',
];

const open = (url: string) => Linking.openURL(url).catch(() => toast('Could not open the link.', 'error'));

export function PublicEnglishTestScreen({ navigation }: RootScreenProps<'PublicEnglishTest'>) {
  const register = useRegisterEnglishTest();
  const { control, handleSubmit } = useForm<EnglishTestFormValues>({ resolver: zodResolver(englishTestSchema), defaultValues: englishTestDefaults, mode: 'onTouched' });
  const province = useWatch({ control, name: 'province' });

  const onSubmit = handleSubmit(async values => {
    const payload = toEnglishTestPayload(values);
    try {
      const r = await register.mutateAsync(payload);
      navigation.replace(Routes.PublicEnglishTestDone, { reference: r.reference, submittedAt: r.submittedAt, email: payload.email });
    } catch {
      // Shown inline below.
    }
  }, () => toast('Check the highlighted fields.', 'error'));

  return (
    <Screen
      testID="public-english-test"
      header={<ScreenHeader title="HCC English Test" subtitle="Student information" />}
      footer={<Button title="Save registration" onPress={onSubmit} loading={register.isPending} testID="pet-submit" />}
    >
      <Stack>
        <Text variant="overline" color={colors.coral600}>HCC English Test</Text>
        <Text variant="displayLg">Register for the English Test</Text>
        <Text variant="body">Register your profile for registrar review. Test scheduling and credentials are sent after review.</Text>
        <InfoBanner tone="gold" icon="Info" title="Before you begin" text="Fields marked * are required. Keep your Student ID handy." />
        <Accordion title="Student instructions" subtitle="Read before you register" testID="pet-instructions">
          {INSTRUCTIONS.map(t => <Text key={t} variant="bodySm">{t}</Text>)}
        </Accordion>

        <Section n={1} title="Institution context">
          <TextField control={control} name="institutionName" label="Institution name" required testID="pet-institution" />
          <TextField control={control} name="branchProfile" label="Branching profile" testID="pet-branch" />
          <TextField control={control} name="siteName" label="Site name" testID="pet-site" />
          <TextField control={control} name="voucherCode" label="Voucher code" autoCapitalize="characters" autoCorrect={false} testID="pet-voucher" />
        </Section>

        <Section n={2} title="Identity">
          <TextField control={control} name="firstName" label="First name" required autoComplete="given-name" testID="pet-first" />
          <TextField control={control} name="middleName" label="Middle name" autoComplete="additional-name" testID="pet-middle" />
          <TextField control={control} name="lastName" label="Last name" required autoComplete="family-name" testID="pet-last" />
          <DateInputField control={control} name="dateOfBirth" label="Date of birth" required testID="pet-dob" />
          <SelectField control={control} name="gender" label="Gender" options={GENDERS} required testID="pet-gender" />
          <SelectField control={control} name="highSchoolEnrolled" label="Currently enrolled in high school?" options={YES_NO} required testID="pet-highschool" />
        </Section>

        <Section n={3} title="Address and contact">
          <TextField control={control} name="address1" label="Address 1" required autoComplete="street-address" testID="pet-address1" />
          <TextField control={control} name="address2" label="Address 2" testID="pet-address2" />
          <TextField control={control} name="country" label="Country" required testID="pet-country" />
          <SelectField control={control} name="province" label="Province / state" options={PROVINCES} required testID="pet-province" />
          {province === 'Other' ? <TextField control={control} name="otherProvince" label="If other, specify" required testID="pet-other-province" /> : null}
          <TextField control={control} name="city" label="City" required testID="pet-city" />
          <TextField control={control} name="postalCode" label="ZIP / postal code" required autoCapitalize="characters" autoComplete="postal-code" testID="pet-postal" />
          <TextField control={control} name="email" label="Email" required keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" testID="pet-email" />
          <TextField control={control} name="homePhone" label="Home phone" keyboardType="phone-pad" testID="pet-home-phone" />
          <TextField control={control} name="mobilePhone" label="Mobile phone" required keyboardType="phone-pad" autoComplete="tel" testID="pet-mobile-phone" />
        </Section>

        <Section n={4} title="Student references">
          <TextField control={control} name="studentId" label="Student ID" required autoCapitalize="characters" autoCorrect={false} testID="pet-student-id" />
          <TextField control={control} name="confirmStudentId" label="Confirm Student ID" required autoCapitalize="characters" autoCorrect={false} testID="pet-confirm-student-id" />
          <TextField control={control} name="supplementalStudentId" label="Supplemental Student ID" autoCapitalize="characters" autoCorrect={false} testID="pet-supplemental-id" />
        </Section>

        <Section n={5} title="Preferences">
          <TextField control={control} name="resultInstitutions" label="Institutions allowed to receive results" helper="Separate institutions with commas." testID="pet-result-institutions" />
          <CheckField control={control} name="optOutCollegePlanningEmail" label="Opt out of college-planning email" testID="pet-opt-out" />
        </Section>

        <Card padding={spacing.md}>
          <Stack gap={spacing.sm}>
            <CheckField control={control} name="privacyAccepted" label="I have read the privacy policy and confirm the information is accurate. *" testID="pet-privacy" />
            <Row wrap gap={spacing.md}>
              {appConfig.webOrigin ? <LinkText label="Privacy policy" onPress={() => open(`${appConfig.webOrigin!.replace(/\/$/, '')}/privacy`)} /> : null}
              <LinkText label="Official privacy policy (PDF)" onPress={() => open(OFFICIAL_PRIVACY_PDF)} />
            </Row>
          </Stack>
        </Card>
        {register.error ? <InlineError error={register.error} /> : null}
      </Stack>
    </Screen>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <Stack gap={spacing.sm}>
        <Row gap={8}><Text variant="overline" color={colors.coral600}>{String(n).padStart(2, '0')}</Text><Text variant="overline">{title}</Text></Row>
        {children}
      </Stack>
    </Card>
  );
}

function LinkText({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={8} style={{ minHeight: 32, justifyContent: 'center' }}>
      <Text variant="label" color={colors.green900} style={{ textDecorationLine: 'underline' }}>{label}</Text>
    </Pressable>
  );
}

export function PublicEnglishTestDoneScreen({ navigation, route }: RootScreenProps<'PublicEnglishTestDone'>) {
  const { reference, submittedAt, email } = route.params;
  return (
    <Screen testID="public-english-test-done" header={<ScreenHeader title="Registration received" hideBack />} footer={<Button title="Back to sign in" onPress={() => navigation.popToTop()} testID="pet-done" />}>
      <Stack>
        <View style={styles.badge}><Icon name="CircleCheck" size={36} color={colors.green700} /></View>
        <Text variant="overline" align="center" color={colors.coral600}>Registration received</Text>
        <Text variant="displayLg" align="center">Thank you for registering</Text>
        <Text variant="body" align="center">The registrar will review your profile and contact you at {email} with test details and credentials. This registration does not create programme enrolment or admission approval.</Text>
        <Card tone="gold" testID="pet-receipt">
          <KeyValueRow label="Reference" value={reference} />
          <KeyValueRow label="Submitted" value={formatDateTime(submittedAt)} border={false} />
        </Card>
        <Text variant="caption" align="center">Keep your reference number for any questions about this registration.</Text>
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'center', width: 72, height: 72, borderRadius: 36, backgroundColor: colors.green50, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
});
