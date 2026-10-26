import React, { useMemo, useState } from 'react';
import { FlatList, Image, StyleSheet, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Accordion, Button, Card, EmptyState, ErrorState, Icon, InlineError, Input, LoadingState, Pill, Row, Screen, ScreenHeader, Select, Stack, StatTile, Text } from '../../components';
import { colors, spacing } from '../../theme';
import { Routes } from '../../navigation/routes';
import type { RootScreenProps } from '../../navigation/types';
import { ServiceError } from '../../services/errors';
import type { PublicProgram } from '../../services/contracts/publicFlows';
import { formatMoney } from '../../utils/format';
import { toast } from '../../state/uiStore';
import { useDebounced } from '../shared/hooks';
import { HeroImage } from '../student/catalogue/HeroImage';
import { useLogin } from '../auth/useAuth';
import { useRegisterSelfpaced, useSelfpacedProgram, useSelfpacedPrograms } from './usePublicFlows';
import { openProgrammeAfterSignIn } from './afterSignIn';
import { TextField } from './fields';
import { asOptions, selfpacedSignupSchema, type SelfpacedSignupValues } from './forms';

const ALL_SUBJECTS = 'All subjects';
const ALL_LEVELS = 'All levels';
const LEVELS = [ALL_LEVELS, 'Beginner', 'Intermediate', 'Advanced'];

const price = (cad: number) => (cad === 0 ? 'Free' : formatMoney(cad));
const heroKind = (p: PublicProgram) => {
  const lower = `${p.title} ${p.subject}`.toLowerCase();
  return /pharm/.test(lower) ? 'pharmacy' : /business|office|capstone/.test(lower) ? 'office' : 'trades';
};

function ProgramImage({ p, height, rounded }: { p: PublicProgram; height: number; rounded?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!p.imageUrl || failed) return <HeroImage kind={heroKind(p)} height={height} />;
  return <Image source={{ uri: p.imageUrl }} style={[styles.image, rounded ? styles.imageRounded : null, { height }]} resizeMode="cover" onError={() => setFailed(true)} accessibilityIgnoresInvertColors accessible={false} />;
}

export function PublicSelfPacedScreen({ navigation }: RootScreenProps<'PublicSelfPaced'>) {
  const programs = useSelfpacedPrograms();
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState(ALL_SUBJECTS);
  const [level, setLevel] = useState(ALL_LEVELS);
  const q = useDebounced(query);
  const subjects = useMemo(() => [ALL_SUBJECTS, ...Array.from(new Set((programs.data ?? []).map(p => p.subject)))], [programs.data]);
  const filtered = useMemo(() => (programs.data ?? []).filter(p => {
    if (q && !`${p.title} ${p.description} ${p.subject}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (subject !== ALL_SUBJECTS && p.subject !== subject) return false;
    if (level !== ALL_LEVELS && p.level !== level) return false;
    return true;
  }), [programs.data, q, subject, level]);
  const clear = () => { setQuery(''); setSubject(ALL_SUBJECTS); setLevel(ALL_LEVELS); };

  const header = (
    <Stack gap={spacing.sm} style={{ marginBottom: spacing.md }}>
      <Text variant="overline" color={colors.coral600}>Self-paced programs</Text>
      <Text variant="displayLg">Learn at your own pace.</Text>
      <Text variant="body">Enrol in instructor-designed programs aligned with Canadian standards, study on your schedule and earn a verifiable certificate.</Text>
      <Input testID="ps-search" placeholder="Search by title, description, or subject…" leftIcon="Search" value={query} onChangeText={setQuery} returnKeyType="search" autoCorrect={false} />
      <Row>
        <View style={{ flex: 1 }}><Select compact value={subject} onChange={setSubject} options={asOptions(subjects)} testID="ps-subject" sheetTitle="Subject" /></View>
        <View style={{ flex: 1 }}><Select compact value={level} onChange={setLevel} options={asOptions(LEVELS)} testID="ps-level" sheetTitle="Level" /></View>
      </Row>
      <Row justify="space-between" style={{ marginTop: spacing.xs }}>
        <Text variant="overline">Current programs</Text>
        <Pill label={`Showing ${filtered.length} of ${programs.data?.length ?? 0}`} tone="grey" small />
      </Row>
    </Stack>
  );

  return (
    <Screen scroll={false} padded={false} header={<ScreenHeader title="Self-paced programs" />} testID="public-selfpaced">
      {programs.isLoading ? <LoadingState /> : programs.error ? <ErrorState error={programs.error} onRetry={() => programs.refetch()} /> : (
        <FlatList
          data={filtered}
          keyExtractor={p => p.slug}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
          ListEmptyComponent={<EmptyState icon="SearchX" title="No programs match" message="Try a different search or clear the filters." action={{ label: 'Clear filters', onPress: clear }} />}
          ListFooterComponent={<Button title="I already have an account" variant="ghost" onPress={() => navigation.navigate(Routes.Login)} style={{ marginTop: spacing.lg }} testID="ps-signin" />}
          renderItem={({ item }) => <ProgramCard p={item} onPress={() => navigation.navigate(Routes.PublicSelfPacedDetails, { slug: item.slug })} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          keyboardShouldPersistTaps="handled"
          refreshing={programs.isRefetching}
          onRefresh={() => programs.refetch()}
          testID="ps-list"
        />
      )}
    </Screen>
  );
}

function ProgramCard({ p, onPress }: { p: PublicProgram; onPress: () => void }) {
  return (
    <Card onPress={onPress} padding={0} testID={`ps-program-${p.slug}`}>
      <ProgramImage p={p} height={140} />
      <Stack gap={spacing.sm} style={{ padding: spacing.lg }}>
        <Row wrap><Pill label={p.subject} tone="green" small /><Pill label={p.level} tone={p.level === 'Advanced' ? 'dark' : 'outline'} small /></Row>
        <Text variant="titleMd">{p.title}</Text>
        <Text variant="bodySm" numberOfLines={3}>{p.description}</Text>
        <Text variant="bodySm">{p.hours.toFixed(1)} hrs • {p.chapterCount} chapters</Text>
        <View style={styles.divider} />
        <Row justify="space-between" align="flex-end">
          <View>
            <Text variant="titleSm">{price(p.priceCad)}{p.priceCad > 0 ? <Text variant="caption"> · domestic</Text> : null}</Text>
            {p.internationalCad ? <Text variant="caption">{formatMoney(p.internationalCad)} · international</Text> : null}
          </View>
          <Row gap={4}><Text variant="label" color={colors.coral600}>View curriculum</Text><Icon name="ArrowRight" size={14} color={colors.coral600} /></Row>
        </Row>
      </Stack>
    </Card>
  );
}

export function PublicSelfPacedDetailsScreen({ navigation, route }: RootScreenProps<'PublicSelfPacedDetails'>) {
  const { slug } = route.params;
  const program = useSelfpacedProgram(slug);
  const [expandAll, setExpandAll] = useState(false);
  const p = program.data;
  return (
    <Screen padded={false} testID="public-selfpaced-details" header={<ScreenHeader title="Program details" center />}>
      {program.isLoading ? <LoadingState /> : program.error || !p ? <ErrorState error={program.error} onRetry={() => program.refetch()} /> : (
        <Stack style={{ paddingHorizontal: spacing.lg }}>
          <ProgramImage p={p} height={180} rounded />
          <Row wrap><Pill label={p.subject} tone="green" small /><Pill label={p.level} tone="outline" small /></Row>
          <Text variant="displayLg">{p.title}</Text>
          <Text variant="body">{p.description}</Text>
          <Row>
            <StatTile label="Hours" value={p.hours.toFixed(1)} />
            <StatTile label="Chapters" value={p.chapterCount} />
          </Row>
          <Card>
            <Stack gap={spacing.sm}>
              <Row justify="space-between"><Text variant="overline">Tuition & enrollment</Text><Pill label="Open enrollment" tone="grey" small /></Row>
              <Text variant="displayMd">{price(p.priceCad)}</Text>
              <Text variant="bodySm">{p.priceCad > 0 ? 'One-time payment · domestic' : 'No payment required'}</Text>
              {p.internationalCad ? <Text variant="bodySm">{formatMoney(p.internationalCad)} · international</Text> : null}
              {p.features.map(f => (
                <Row key={f} align="flex-start"><Icon name="CircleCheck" size={16} color={colors.success600} /><Text variant="bodySm" style={{ flex: 1 }}>{f}</Text></Row>
              ))}
              <Button title="Create account to enrol →" variant="coral" onPress={() => navigation.navigate(Routes.PublicSelfPacedRegister, { slug: p.slug })} testID="psd-create-account" />
              <Button title="I already have an account" variant="ghost" onPress={() => navigation.navigate(Routes.Login)} testID="psd-signin" />
              {p.priceCad > 0 ? <Row gap={6} style={{ alignSelf: 'center' }}><Icon name="ShieldCheck" size={14} color={colors.green700} /><Text variant="caption" color={colors.green700}>Secure card payment by Stripe after sign-up</Text></Row> : null}
            </Stack>
          </Card>
          {p.chapters.length ? (
            <>
              <Row justify="space-between">
                <Text variant="overline">Curriculum</Text>
                <Button title={expandAll ? 'Collapse all' : 'Expand all'} variant="ghost" size="sm" fullWidth={false} onPress={() => setExpandAll(e => !e)} testID="psd-expand-all" />
              </Row>
              <Stack gap={spacing.sm}>
                {p.chapters.map((c, i) => (
                  <Accordion key={c.id} title={`Chapter ${i + 1} · ${c.title}`} subtitle={`${c.hours.toFixed(1)} hrs · ${c.activityCount} items`} open={expandAll ? true : undefined} initiallyOpen={i === 0} testID={`psd-chapter-${i + 1}`}>
                    <Text variant="bodySm">{c.summary}</Text>
                  </Accordion>
                ))}
              </Stack>
            </>
          ) : null}
        </Stack>
      )}
    </Screen>
  );
}

export function PublicSelfPacedRegisterScreen({ navigation, route }: RootScreenProps<'PublicSelfPacedRegister'>) {
  const slug = route.params?.slug;
  const program = useSelfpacedPrograms();
  const title = program.data?.find(p => p.slug === slug)?.title;
  const register = useRegisterSelfpaced();
  const login = useLogin();
  const [error, setError] = useState<unknown>(null);
  const { control, handleSubmit } = useForm<SelfpacedSignupValues>({ resolver: zodResolver(selfpacedSignupSchema), defaultValues: { name: '', email: '', password: '', confirm: '' }, mode: 'onTouched' });

  const onSubmit = handleSubmit(async v => {
    setError(null);
    const email = v.email.trim().toLowerCase();
    try {
      await register.mutateAsync({ name: v.name, email, password: v.password });
    } catch (e) {
      setError(e);
      return;
    }
    const cancel = openProgrammeAfterSignIn(slug);
    try {
      await login.mutateAsync({ loginId: email, password: v.password, rememberMe: true });
    } catch {
      cancel();
      toast('Your account was created. Sign in with your email and password to continue.', 'success');
      navigation.navigate(Routes.Login);
    }
  });

  const busy = register.isPending || login.isPending;
  return (
    <Screen
      testID="public-selfpaced-register"
      header={<ScreenHeader title="Create your account" />}
      footer={<Button title={login.isPending ? 'Signing you in…' : 'Create account & continue'} onPress={onSubmit} loading={busy} testID="psr-submit" />}
    >
      <Stack>
        <Text variant="overline" color={colors.coral600}>Self-paced learning</Text>
        <Text variant="displayLg">Create your learner account</Text>
        <Text variant="body">{title ? `Create a Campus One account to enrol in ${title}. ` : 'Create a Campus One account to enrol in self-paced programs. '}You can pay securely and start learning right after sign-up.</Text>
        <Card>
          <Stack gap={spacing.sm}>
            <TextField control={control} name="name" label="Full name" required autoComplete="name" testID="psr-name" />
            <TextField control={control} name="email" label="Email" required keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" testID="psr-email" />
            <TextField control={control} name="password" label="Password" required secure textContentType="newPassword" autoComplete="new-password" helper="At least 8 characters." testID="psr-password" />
            <TextField control={control} name="confirm" label="Confirm password" required secure textContentType="newPassword" autoComplete="new-password" returnKeyType="go" onSubmitEditing={() => onSubmit()} testID="psr-confirm" />
          </Stack>
        </Card>
        {error ? (
          ServiceError.is(error, 'CONFLICT') ? (
            <Card tone="coral" testID="psr-conflict">
              <Stack gap={spacing.sm}>
                <Text variant="bodyStrong">{(error as ServiceError).message}</Text>
                <Button title="Sign in instead" onPress={() => navigation.navigate(Routes.Login)} testID="psr-conflict-signin" />
              </Stack>
            </Card>
          ) : <InlineError error={error} />
        ) : null}
        <Button title="I already have an account" variant="ghost" onPress={() => navigation.navigate(Routes.Login)} disabled={busy} testID="psr-signin" />
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.huge },
  image: { width: '100%', borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: colors.green800 },
  imageRounded: { borderRadius: 20, marginTop: 4 },
  divider: { height: 1, backgroundColor: colors.border },
});
