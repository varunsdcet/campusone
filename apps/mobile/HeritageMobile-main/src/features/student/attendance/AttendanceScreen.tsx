import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, EmptyState, Icon, StatTile, ProgressBar, InfoBanner, KeyValueRow, BottomSheet, Input, ChipRow, DemoLabel } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useStudentAttendance, useCorrections, useCurrentTermLabel } from '../courses/useCourses';
import { formatDateTime } from '../../../utils/format';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';
import { useSettings } from '../../auth/useAuth';
import { attendanceCounts } from './attendanceMath';

const TONE = { present: 'green', absent: 'red', late: 'yellow', excused: 'blue' } as const;

export function AttendanceScreen({ navigation, route }: RootScreenProps<'StudentAttendance'>) {
  const termLabel = useCurrentTermLabel();
  const records = useStudentAttendance();
  const corrections = useCorrections();
  const settings = useSettings();
  const [course, setCourse] = useState<string>(route.params?.sectionId ?? '');
  const [selected, setSelected] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const data = useMemo(() => records.data ?? [], [records.data]);
  const tz = settings.data?.timeZone;
  const totals = useMemo(() => attendanceCounts(data.map(r => r.status)), [data]);
  const bySection = useMemo(() => {
    const map = new Map<string, typeof data>();
    data.forEach(r => map.set(r.sectionId, [...(map.get(r.sectionId) ?? []), r]));
    return Array.from(map.entries()).map(([id, recs]) => ({ id, section: recs[0].section, recs, ...attendanceCounts(recs.map(r => r.status)) }));
  }, [data]);
  const active = bySection.find(b => b.id === course) ?? bySection[0];
  const sessions = (active?.recs ?? []).slice().sort((a, b) => b.session.date.localeCompare(a.session.date));
  const detail = sessions.find(r => r.id === selected) ?? null;
  const pendingFor = (recordId: string) => corrections.list.data?.find(c => c.recordId === recordId && c.status === 'pending');
  const submitCorrection = async () => {
    if (!reasonFor) return;
    try {
      await corrections.request.mutateAsync({ recordId: reasonFor, reason });
      toast(isMockMode() ? 'Correction request submitted to the Department Registrar (demo)' : 'Correction request submitted to the Department Registrar', 'success');
      setReasonFor(null);
      setReason('');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  return (
    <Screen testID="attendance-screen" header={<ScreenHeader backLabel="Back" actions={[{ icon: 'CalendarDays', accessibilityLabel: 'Open calendar', onPress: () => navigation.navigate(Routes.StudentTabs, { screen: Routes.StudentScheduleTab }), testID: 'attendance-calendar' }]} />}>
      {records.isLoading ? <LoadingState /> : records.error ? <ErrorState error={records.error} onRetry={() => records.refetch()} /> : (
        <Stack>
          <Row justify="space-between"><Text variant="displayLg">Attendance</Text>{termLabel ? <Pill label={termLabel} tone="green" small /> : null}</Row>
          <Text variant="body">View your attendance records, course breakdowns, and recorded session status.</Text>
          <Row>
            <StatTile label="Present" value={`${totals.present} Sessions`} sub={<Pill label={`${totals.onTime}% on-time`} tone="green" small />} icon="CircleDot" accent={colors.success600} />
            <StatTile label="Absent" value={`${totals.absent} Sessions`} sub={totals.absent ? <Pill label={`${bySection.find(b => b.absent)?.section.course.code ?? ''} entry`} tone="red" small /> : undefined} icon="CircleDot" accent={colors.danger600} />
          </Row>
          <Row>
            <StatTile label="Late" value={`${totals.late} Sessions`} sub={totals.late ? <Pill label={`${bySection.find(b => b.late)?.section.course.code ?? ''} entry`} tone="yellow" small /> : undefined} icon="CircleDot" accent={colors.warning600} />
            <StatTile label="Rate" value={`${totals.rate}%`} sub={<View style={{ gap: 4 }}><Text variant="caption">{totals.counted} counted{totals.excused ? ` · ${totals.excused} excused` : ''}</Text><ProgressBar value={totals.rate} height={5} /></View>} icon="Gauge" />
          </Row>
          <InfoBanner tone="gold" icon="TriangleAlert" text="Corrections are not self-serve. Request a correction below and the Department Registrar reviews it; records are never edited directly by students." />
          {!bySection.length ? <EmptyState icon="CalendarX" title="No attendance recorded" message="Submitted attendance from your instructors will appear here." /> : (
            <>
              <Row justify="space-between"><Text variant="titleSm">By course</Text><Text variant="caption">{bySection.length} with records</Text></Row>
              <Text variant="caption">Select a course to filter sessions</Text>
              <ChipRow options={bySection.map(b => ({ value: b.id, label: `${b.section.course.code} ${b.rate}%` }))} value={active?.id ?? ''} onChange={setCourse} testID="attendance-course" />
              {active ? (
                <Card>
                  <Row justify="space-between" wrap><View style={{ flex: 1, minWidth: 180 }}><Text variant="titleSm">{active.section.course.code} · {active.section.course.title}</Text><Text variant="caption">Instructor: {active.section.instructorName}</Text></View><Pill label={`${active.rate}% attendance`} tone={active.rate >= 80 ? 'green' : 'yellow'} small /></Row>
                  <View style={styles.stack}>
                    <View style={[styles.seg, { flex: active.present || 0.0001, backgroundColor: colors.success600 }]} />
                    <View style={[styles.seg, { flex: active.late || 0.0001, backgroundColor: colors.warning600 }]} />
                    <View style={[styles.seg, { flex: active.absent || 0.0001, backgroundColor: colors.coral500 }]} />
                    <View style={[styles.seg, { flex: active.excused || 0.0001, backgroundColor: colors.info600 }]} />
                  </View>
                  <Row justify="space-between" wrap><Text variant="caption">{active.present} present · {active.absent} absent · {active.late} late{active.excused ? ` · ${active.excused} excused` : ''}</Text><Text variant="caption">{active.recs.length} sessions total</Text></Row>
                </Card>
              ) : null}
              <Row justify="space-between"><Text variant="titleSm">{active?.section.course.code} Sessions</Text><Text variant="caption">Sorted by newest</Text></Row>
              <Text variant="caption">{sessions.length} recorded session{sessions.length === 1 ? '' : 's'} — tap for detail</Text>
              {sessions.map(r => (
                <Pressable key={r.id} testID={`attendance-session-${r.sessionId}`} accessibilityRole="button" accessibilityLabel={`${r.session.topic}, ${r.status}`} onPress={() => setSelected(r.id)} style={[styles.sessionCard, selected === r.id ? styles.sessionSelected : null]}>
                  <Row justify="space-between">
                    <Row gap={8} style={{ flex: 1 }}><View style={[styles.dot, { backgroundColor: r.status === 'present' ? colors.success600 : r.status === 'late' ? colors.warning600 : r.status === 'excused' ? colors.info600 : colors.danger600 }]} /><Text variant="bodyStrong" style={{ flexShrink: 1 }}>{r.section.course.code} · {r.session.topic}</Text></Row>
                    <Row gap={6}><Pill label={r.status} tone={TONE[r.status]} small /><Icon name="ChevronDown" size={16} color={colors.inkMuted} /></Row>
                  </Row>
                  <Text variant="caption" style={{ marginTop: 4 }}>{formatDateTime(r.recordedAt, tz)}</Text>
                  {selected === r.id ? <Row justify="space-between" style={styles.selFooter}><Text variant="caption" color={colors.success600}>✓ Details displayed below</Text><Text variant="caption">ID: {r.sessionId.toUpperCase().slice(-8)}</Text></Row> : null}
                </Pressable>
              ))}
              {detail ? (
                <Card testID="attendance-detail">
                  <Row justify="space-between" style={{ marginBottom: spacing.sm }}><Text variant="overline">Session detail</Text><Pill label={detail.state === 'submitted' ? 'Submitted' : 'Draft'} tone="green" small /></Row>
                  <Text variant="displaySm">{detail.section.course.code} · {detail.session.topic}</Text>
                  <View style={styles.statusBar}><Text variant="caption">• Recorded Status: {detail.status} | {detail.section.delivery}</Text></View>
                  <KeyValueRow label="Course" value={detail.section.course.code} />
                  <KeyValueRow label="Recorded" value={formatDateTime(detail.recordedAt, tz)} />
                  <KeyValueRow label="Meeting" value={`${detail.section.course.code} · ${detail.session.topic}`} />
                  <KeyValueRow label="Status" value={detail.status[0].toUpperCase() + detail.status.slice(1)} border={false} />
                  {detail.note ? <KeyValueRow label="Instructor note" value={detail.note} border={false} /> : null}
                  {pendingFor(detail.id) ? <InfoBanner tone="gold" icon="Clock" title="Correction request pending" text={`Submitted ${formatDateTime(pendingFor(detail.id)!.createdAt, tz)} · routed to Department Registrar`} /> : null}
                  <Row style={{ marginTop: spacing.md }}>
                    <Button title="Request correction" variant="outline" style={{ flex: 1 }} icon={<Icon name="PencilLine" size={16} color={colors.green900} />} onPress={() => setReasonFor(detail.id)} disabled={!!pendingFor(detail.id)} disabledReason="A request is already pending" testID="attendance-request-correction" />
                    <Button title="Open calendar" variant="outline" style={{ flex: 1 }} onPress={() => navigation.navigate(Routes.StudentCourseInfo, { sectionId: detail.sectionId, view: 'calendar' })} testID="attendance-open-calendar" />
                  </Row>
                  <Text variant="caption" align="center" style={{ marginTop: spacing.sm }}>{isMockMode() ? 'Request ticket automatically routed to Department Registrar (demo workflow).' : 'Request ticket automatically routed to Department Registrar.'}</Text>
                </Card>
              ) : null}
            </>
          )}
          <DemoLabel text="Totals derived from submitted attendance records" />
        </Stack>
      )}
      <BottomSheet visible={!!reasonFor} onClose={() => setReasonFor(null)} title="Request correction" subtitle="Reviewed by the Department Registrar" testID="correction-sheet">
        <Input label="What was recorded incorrectly?" placeholder="e.g. I was present but marked absent — I signed the paper roll." multiline value={reason} onChangeText={setReason} maxLength={300} counter={reason.length} testID="correction-reason" />
        <Button title="Submit request" onPress={submitCorrection} loading={corrections.request.isPending} disabled={!reason.trim()} disabledReason="Describe the issue to submit" testID="correction-submit" />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginVertical: spacing.sm, backgroundColor: colors.border },
  seg: { height: 8 },
  sessionCard: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  sessionSelected: { borderColor: colors.green900 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  selFooter: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  statusBar: { backgroundColor: colors.surfaceMuted, borderRadius: 8, padding: spacing.sm, marginVertical: spacing.sm },
});
