import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, EmptyState, Icon, ProgressBar, ChipRow, BottomSheet, KeyValueRow, DemoLabel } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useBadges, useCredentials } from './useRecords';
import { formatDate } from '../../../utils/format';
import type { BadgeWithProgress } from '../../../services/contracts/records';

export function BadgesScreen({ navigation }: RootScreenProps<'StudentBadges'>) {
  const badges = useBadges();
  const [filter, setFilter] = useState<'all' | 'earned' | 'available'>('all');
  const [detail, setDetail] = useState<BadgeWithProgress | null>(null);
  const data = badges.data ?? [];
  const earned = data.filter(b => b.earned).length;
  const list = data.filter(b => filter === 'all' || (filter === 'earned' ? b.earned : !b.earned));
  return (
    <Screen testID="badges-screen" header={<ScreenHeader />}>
      {badges.isLoading ? <LoadingState /> : badges.error ? <ErrorState error={badges.error} onRetry={() => badges.refetch()} /> : (
        <Stack>
          <Text variant="displayLg">My Accomplishments & Badges</Text>
          <Text variant="body">Celebrate your achievements, completed milestones, and badges earned throughout your learning journey.</Text>
          <Card>
            <Row>
              {[['Total badges', data.length, colors.green900], ['Earned', earned, colors.gold600], ['In progress', data.length - earned, colors.green900]].map(([l, v, c]) => <View key={String(l)} style={styles.stat}><Text variant="displayMd" color={String(c)}>{v}</Text><Text variant="caption">{l}</Text></View>)}
            </Row>
            <Row justify="space-between" style={{ marginTop: spacing.sm }}><Text variant="label">Milestone progression</Text><Text variant="caption">{data.length ? Math.round((earned / data.length) * 100) : 0}% completed</Text></Row>
            <ProgressBar value={data.length ? (earned / data.length) * 100 : 0} color={colors.green700} gradient />
          </Card>
          <ChipRow options={[{ value: 'all', label: 'All', count: data.length }, { value: 'earned', label: 'Earned', count: earned }, { value: 'available', label: 'Available', count: data.length - earned }]} value={filter} onChange={setFilter} testID="badges-filter" />
          {!list.length ? <EmptyState icon="Award" title="No badges here" /> : list.map(b => (
            <Card key={b.id} testID={`badge-${b.code}`}>
              <Row gap={spacing.md} align="flex-start">
                <View style={[styles.tile, b.earned ? styles.tileEarned : styles.tileAvail]}><Icon name={b.requirement.type === 'workshops' ? 'Users' : 'Award'} size={24} color={b.earned ? colors.gold600 : colors.inkMuted} /></View>
                <View style={{ flex: 1 }}>
                  <Text variant="displayXs">{b.title}</Text>
                  <Text variant="bodySm">{b.description}</Text>
                  <Row style={{ marginTop: 6 }}><Pill label={`CODE: ${b.code}`} tone="grey" small /><Pill label={b.earned ? 'Earned' : 'Available'} tone={b.earned ? 'green' : 'yellow'} small dot={!b.earned} icon={b.earned ? <Icon name="Check" size={11} color={colors.success600} /> : undefined} /></Row>
                </View>
              </Row>
              {!b.earned && b.requirement.type === 'workshops' ? <View style={{ marginTop: spacing.sm, gap: 4 }}><Row justify="space-between"><Text variant="caption">Attendance progress</Text><Text variant="caption">{b.progress.current} of {b.progress.target} workshops</Text></Row><ProgressBar value={(b.progress.current / b.progress.target) * 100} height={6} /></View> : null}
              {!b.earned && b.requirement.type === 'manual' ? <Text variant="caption" style={{ marginTop: spacing.sm }}>Awarded by your instructor or program when the requirement is met.</Text> : null}
              <Row justify="space-between" style={{ marginTop: spacing.sm }}>
                <Text variant="caption">Earned: {b.award?.earnedAt ? formatDate(b.award.earnedAt) : '—'}</Text>
                {b.earned ? <Button title="View credential ›" variant="ghost" size="sm" fullWidth={false} onPress={() => setDetail(b)} testID={`badge-view-${b.code}`} /> : b.requirement.type === 'workshops' ? <Button title="View Workshops →" variant="outline" size="sm" fullWidth={false} onPress={() => navigation.navigate(Routes.StudentWorkshops, { view: 'available' })} testID={`badge-workshops-${b.code}`} /> : null}
              </Row>
            </Card>
          ))}
          <CredentialsSection />
          {isMockMode() ? <Card tone="muted"><Text variant="overline" style={{ marginBottom: 4 }}>Micro-credentialing (demo)</Text><Text variant="caption">Badges in this demo are local records issued by the instructor demo account. They are not cryptographically signed or verified by any registrar.</Text></Card> : null}
          <DemoLabel text="Badge progress derived from completed workshop enrolments" />
        </Stack>
      )}
      <BottomSheet visible={!!detail} onClose={() => setDetail(null)} title={detail?.title} subtitle={isMockMode() ? 'Demo credential record' : 'Credential record'} testID="badge-detail">
        {detail ? (<>
          <KeyValueRow label="Code" value={detail.code} />
          <KeyValueRow label="Earned" value={detail.award?.earnedAt ? formatDate(detail.award.earnedAt) : '—'} />
          {isMockMode() || detail.award?.issuedBy ? <KeyValueRow label="Issued by" value={isMockMode() ? 'Instructor demo account' : detail.award?.issuedBy ?? ''} border={isMockMode()} /> : null}
          {isMockMode() ? <KeyValueRow label="Verification" value="None (demo)" border={false} /> : null}
        </>) : null}
      </BottomSheet>
    </Screen>
  );
}

/** Program credentials (GET /student/credentials). */
function CredentialsSection() {
  const creds = useCredentials();
  if (!creds.supported) return null;
  if (creds.isLoading) return <LoadingState />;
  if (creds.error) return <ErrorState error={creds.error} onRetry={() => creds.refetch()} />;
  const list = creds.data?.credentials ?? [];
  return (
    <Card testID="credentials">
      <Row justify="space-between" style={{ marginBottom: spacing.sm }}><Text variant="titleSm">Credentials</Text><Pill label={`${list.filter(c => c.status === 'earned').length} earned`} tone="green" small /></Row>
      {!list.length ? <Text variant="bodySm">No credentials on record yet.</Text> : list.map(c => (
        <Row key={c.id} gap={spacing.md} align="flex-start" style={styles.credRow}>
          <Icon name={c.status === 'earned' ? 'BadgeCheck' : c.status === 'revoked' ? 'BadgeX' : 'Hourglass'} size={20} color={c.status === 'earned' ? colors.success600 : c.status === 'revoked' ? colors.danger600 : colors.gold600} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{c.title}</Text>
            {c.detail ? <Text variant="caption">{c.detail}</Text> : null}
            {c.earnedAt ? <Text variant="caption">Earned {formatDate(c.earnedAt)}</Text> : null}
          </View>
          <Pill label={c.status === 'earned' ? 'Earned' : c.status === 'revoked' ? 'Revoked' : 'In progress'} tone={c.status === 'earned' ? 'green' : c.status === 'revoked' ? 'red' : 'yellow'} small />
        </Row>
      ))}
      {creds.data && !creds.data.issuanceEnabled && list.some(c => c.status === 'earned') ? <Text variant="caption" style={{ marginTop: spacing.sm }}>Official certificates are issued by the Registrar.</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  credRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  stat: { flex: 1, alignItems: 'center' },
  tile: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tileEarned: { backgroundColor: colors.gold100 },
  tileAvail: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderStrong },
});
