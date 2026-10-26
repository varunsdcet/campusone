import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, EmptyState, Select, BottomSheet, KeyValueRow, DemoLabel, Avatar } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import { useLogs, useRoster } from '../useInstructor';
import { useSection } from '../../student/courses/useCourses';
import { formatDateTime } from '../../../utils/format';
import type { LogEntry } from '../../../domain/types';

export function LogsTab({ sectionId }: { sectionId: string }) {
  const section = useSection(sectionId);
  const roster = useRoster(sectionId);
  const [participant, setParticipant] = useState('all');
  const [date, setDate] = useState('all');
  const [activity, setActivity] = useState('all');
  const [action, setAction] = useState('all');
  const [source, setSource] = useState('all');
  const [event, setEvent] = useState('all');
  const [logType, setLogType] = useState('standard');
  const [applied, setApplied] = useState<Parameters<typeof useLogs>[0] | null>(null);
  const [detail, setDetail] = useState<LogEntry | null>(null);
  const allLogs = useLogs({ sectionId }, true);
  const logs = useLogs(applied ?? { sectionId }, !!applied);
  const opts = useMemo(() => {
    const l = allLogs.data ?? [];
    const uniq = (xs: string[]) => Array.from(new Set(xs));
    return { dates: uniq(l.map(x => x.at.slice(0, 10))), activities: uniq(l.map(x => x.activity)), events: uniq(l.map(x => x.event)) };
  }, [allLogs.data]);
  const sel = (label: string, value: string, onChange: (v: string) => void, items: { value: string; label: string }[], testID: string) => <Select compact label={label} value={value} onChange={onChange} options={items} testID={testID} />;
  return (
    <Stack>
      <Card>
        <Text variant="displaySm" style={{ marginBottom: spacing.sm }}>Logs</Text>
        <Stack gap={spacing.sm}>
          {sel('Course / context', sectionId, () => undefined, [{ value: sectionId, label: section.data ? `${section.data.course.code} · ${section.data.course.title}` : '…' }], 'logs-course')}
          {sel('Participants', participant, setParticipant, [{ value: 'all', label: 'All participants' }, ...(roster.data ?? []).map(u => ({ value: u.id, label: u.displayName })), { value: section.data?.instructorId ?? 'inst', label: 'Instructor' }], 'logs-participant')}
          {sel('Date', date, setDate, [{ value: 'all', label: 'All days' }, ...opts.dates.map(d => ({ value: d, label: d }))], 'logs-date')}
          {sel('Activities', activity, setActivity, [{ value: 'all', label: 'All activities' }, ...opts.activities.map(a => ({ value: a, label: a }))], 'logs-activity')}
          {sel('Actions', action, setAction, [{ value: 'all', label: 'All actions' }, ...['viewed', 'created', 'updated', 'deleted', 'submitted'].map(a => ({ value: a, label: a }))], 'logs-action')}
          {sel('Sources', source, setSource, [{ value: 'all', label: 'All sources' }, { value: 'app', label: 'Mobile app' }, { value: 'web', label: 'Web' }], 'logs-source')}
          {sel('Events', event, setEvent, [{ value: 'all', label: 'All events' }, ...opts.events.map(e => ({ value: e, label: e }))], 'logs-event')}
          {sel('Log type', logType, setLogType, [{ value: 'standard', label: 'Standard log' }, { value: 'detailed', label: 'Detailed log' }], 'logs-type')}
          <Button title="Get these logs" onPress={() => setApplied({ sectionId, participantId: participant, date, activity, action, source, event, logType })} testID="logs-get" />
        </Stack>
      </Card>
      {applied ? (logs.isLoading ? <LoadingState /> : logs.error ? <ErrorState error={logs.error} onRetry={() => logs.refetch()} /> : !logs.data?.length ? <EmptyState icon="ScrollText" title="No log entries match" /> : (
        <Card padding={spacing.md}>
          <Row justify="space-between" style={{ marginBottom: 4 }}><Text variant="overline">{logs.data.length} entries</Text>{isMockMode() ? <Pill label="Local demo log" tone="grey" small /> : null}</Row>
          {logs.data.map(l => (
            <Row key={l.id} gap={spacing.sm} style={styles.row}>
              <Avatar initials={l.actorName.split(' ').map(p => p[0]).join('').slice(0, 2)} size={30} bg={colors.green50} fg={colors.green900} />
              <View style={{ flex: 1 }}><Text variant="bodyStrong" numberOfLines={1}>{l.actorName} · {l.activity}</Text><Text variant="caption">{formatDateTime(l.at)} · {l.event} · {l.source}</Text>{logType === 'detailed' ? <Text variant="caption">{l.description}</Text> : null}</View>
              <Button title="Details" variant="ghost" size="sm" fullWidth={false} onPress={() => setDetail(l)} testID={`log-${l.id}`} />
            </Row>
          ))}
        </Card>
      )) : null}
      <DemoLabel text="Local demo activity log · not tamper-proof, not an audit system" />
      <BottomSheet visible={!!detail} onClose={() => setDetail(null)} title="Log entry" testID="log-detail">
        {detail ? (<>
          <KeyValueRow label="When" value={formatDateTime(detail.at)} />
          <KeyValueRow label="Actor" value={detail.actorName} />
          <KeyValueRow label="Activity" value={detail.activity} />
          <KeyValueRow label="Action" value={detail.action} />
          <KeyValueRow label="Event" value={detail.event} />
          <KeyValueRow label="Source" value={detail.source} />
          <KeyValueRow label="Description" value={detail.description} border={false} />
        </>) : null}
      </BottomSheet>
    </Stack>
  );
}

const styles = StyleSheet.create({ row: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' } });
