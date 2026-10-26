import React from 'react';
import { StyleSheet } from 'react-native';
import { Card, EmptyState, ErrorState, LoadingState, Pill, Row, Screen, ScreenHeader, Stack, StatTile, Text } from '../../../components';
import type { RootScreenProps } from '../../../navigation/types';
import { colors, spacing } from '../../../theme';
import { formatDate } from '../../../utils/format';
import { useCompliance } from '../records/useRecords';

function shownDate(value: string | null) {
  return value ? formatDate(value, { dot: true }) : '—';
}

function statusTone(status: string): 'green' | 'gold' | 'red' | 'grey' {
  if (['Fulfilled', 'Released', 'Rejected'].includes(status)) return 'green';
  if (['Active', 'Refused', 'Disposed'].includes(status)) return 'red';
  if (['Received', 'In Progress', 'Proposed', 'Approved'].includes(status)) return 'gold';
  return 'grey';
}

export function ComplianceScreen(_props: RootScreenProps<'StudentCompliance'>) {
  const query = useCompliance();
  const data = query.data;
  return (
    <Screen testID="student-compliance" header={<ScreenHeader backLabel="Profile" />} refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <Stack>
        <Text variant="overline" color={colors.coral600}>MY RECORDS</Text>
        <Text variant="displayLg">Privacy &amp; Record Status</Text>
        <Text variant="body">Track legal holds, privacy requests and approved record-retention activity linked to your student profile.</Text>

        {query.isLoading ? <LoadingState /> : query.error ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : !query.supported || !data ? (
          <EmptyState icon="ShieldCheck" title="Record status unavailable" message="This screen is available when connected to Campus One." />
        ) : <>
          <Row>
            <StatTile label="Active holds" value={data.summary.activeLegalHolds} icon="ShieldCheck" />
            <StatTile label="Privacy requests" value={data.summary.openPrivacyRequests} icon="FileText" />
          </Row>
          <Card tone="gold">
            <Text variant="overline">Pending disposal reviews</Text>
            <Text variant="displayMd">{data.summary.pendingDisposals}</Text>
            <Text variant="caption">A proposal cannot bypass an active legal hold.</Text>
          </Card>

          <Text variant="titleLg" style={{ marginTop: spacing.sm }}>Legal holds</Text>
          {!data.legalHolds.length ? <EmptyState icon="ShieldCheck" title="No legal holds" message="No legal holds are linked to your profile." /> : data.legalHolds.map(item => (
            <Card key={item.id} testID={`compliance-hold-${item.id}`}>
              <Row justify="space-between"><Text variant="titleSm" style={styles.flex}>{item.matter}</Text><Pill label={item.status} tone={statusTone(item.status)} small dot /></Row>
              <Text variant="bodySm" style={{ marginTop: spacing.xs }}>{item.scope}</Text>
              {item.reason ? <Text variant="caption" style={{ marginTop: spacing.xs }}>{item.reason}</Text> : null}
              <Text variant="caption" style={{ marginTop: spacing.sm }}>Placed {shownDate(item.placedOn)} · Released {shownDate(item.releasedOn)}</Text>
            </Card>
          ))}

          <Text variant="titleLg" style={{ marginTop: spacing.sm }}>Privacy requests</Text>
          {!data.privacyRequests.length ? <EmptyState icon="FileText" title="No privacy requests" message="No privacy requests are linked to your profile." /> : data.privacyRequests.map(item => (
            <Card key={item.id} testID={`compliance-privacy-${item.id}`}>
              <Row justify="space-between"><Text variant="titleSm" style={styles.flex}>{item.type}</Text><Pill label={item.status} tone={statusTone(item.status)} small dot /></Row>
              <Text variant="bodySm" style={{ marginTop: spacing.xs }}>{item.response || 'Campus staff have not added a response yet.'}</Text>
              <Text variant="caption" style={{ marginTop: spacing.sm }}>Received {shownDate(item.receivedOn)} · Due {shownDate(item.dueOn)}</Text>
            </Card>
          ))}

          <Text variant="titleLg" style={{ marginTop: spacing.sm }}>Record disposal history</Text>
          {!data.disposals.length ? <EmptyState icon="FileText" title="No disposal reviews" message="No disposal reviews are linked to your profile." /> : data.disposals.map(item => (
            <Card key={item.id} testID={`compliance-disposal-${item.id}`}>
              <Row justify="space-between"><Text variant="titleSm" style={styles.flex}>{item.records}</Text><Pill label={item.status} tone={statusTone(item.status)} small dot /></Row>
              <Text variant="caption" style={{ marginTop: spacing.sm }}>Eligible {shownDate(item.eligibleOn)} · Disposed {shownDate(item.disposedOn)}</Text>
            </Card>
          ))}
        </>}
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
