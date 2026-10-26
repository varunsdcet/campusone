import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, EmptyState, Icon, Select, Avatar, Input, ConfirmSheet, Screen, ScreenHeader, DemoLabel, InfoBanner } from '../../../components';
import { colors, spacing } from '../../../theme';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useAttendanceForDate, useAttendanceMutations, useRoster } from '../useInstructor';
import { useSessions, useSection } from '../../student/courses/useCourses';
import { useAppNavigation } from '../../../navigation/hooks';
import { useFileActions } from '../../shared/useFileActions';
import { toISODate, formatDate, formatDateTime } from '../../../utils/format';
import { clock } from '../../../utils/clock';
import type { AttendanceStatus } from '../../../domain/types';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';
import { useUnsavedChangesGuard } from '../../shared/hooks';
import { isMockMode } from '../../../config/appConfig';

export function AttendanceTab({ sectionId }: { sectionId: string }) {
  const navigation = useAppNavigation();
  const sessions = useSessions(sectionId);
  const files = useFileActions();
  const section = useSection(sectionId);
  const dates = useMemo(() => Array.from(new Set((sessions.data ?? []).map(s => s.date))).sort(), [sessions.data]);
  const [date, setDate] = useState<string>('');
  const effective = date || dates.filter(d => d <= toISODate(clock.nowDate())).slice(-1)[0] || dates[0] || toISODate(clock.nowDate());
  const data = useAttendanceForDate(effective, sectionId);
  const entry = data.data?.[0];
  const records = entry?.records ?? [];
  const submitted = records.filter(r => r.state === 'submitted');
  const present = submitted.filter(r => r.status === 'present').length;
  const printRoster = () => {
    const s = section.data!;
    const rows = (entry?.roster ?? []).map(u => `"${u.lastName}, ${u.firstName}",${u.student?.studentNumber},${records.find(r => r.studentId === u.id)?.status ?? ''}`);
    void files.exportText(`${s.course.code.replace(/\s/g, '')}-roster-${effective}${isMockMode() ? '-DEMO' : ''}.csv`, ['Name,Student number,Status', ...rows].join('\n'));
  };
  return (
    <Stack>
      <Text variant="displaySm">Attendance</Text>
      <Row><View style={{ flex: 1 }}><Select compact value={effective} onChange={setDate} options={dates.map(d => ({ value: d, label: d }))} testID="att-date" sheetTitle="Session date" /></View><Button title="Mark attendance" fullWidth={false} onPress={() => navigation.navigate(Routes.InstructorMarkAttendance, { sectionId, date: effective })} testID="att-mark" /></Row>
      <Button title="Print roster" variant="outline" size="sm" icon={<Icon name="Printer" size={14} color={colors.green900} />} onPress={printRoster} testID="att-print" />
      {data.isLoading ? <LoadingState /> : data.error ? <ErrorState error={data.error} onRetry={() => data.refetch()} /> : (
        <>
          <Text variant="bodySm">{effective} · Present {present} · Absent {submitted.filter(r => r.status === 'absent').length} · Late {submitted.filter(r => r.status === 'late').length} · Total {entry?.roster.length ?? 0}</Text>
          {records.some(r => r.state === 'draft') ? <InfoBanner tone="gold" icon="Save" text="A draft exists for this date. Open Mark attendance to review and submit it." /> : null}
          {!submitted.length ? <EmptyState icon="CalendarCheck" title="Not taken yet" message="Attendance for this date has not been submitted." action={{ label: 'Mark attendance', onPress: () => navigation.navigate(Routes.InstructorMarkAttendance, { sectionId, date: effective }) }} /> : (entry?.roster ?? []).map(u => {
            const r = submitted.find(x => x.studentId === u.id);
            return (
              <Card key={u.id} padding={spacing.md} testID={`att-row-${u.id}`}>
                <Row gap={spacing.md}><Avatar initials={u.avatarInitials} bg={colors.green50} fg={colors.green900} size={36} /><View style={{ flex: 1 }}><Text variant="bodyStrong">{u.displayName}</Text><Text variant="caption">{u.student?.studentNumber} · {effective}</Text>{r?.note ? <Text variant="caption">Note: {r.note}</Text> : null}</View><Pill label={r?.status ?? 'unmarked'} tone={r?.status === 'present' ? 'green' : r?.status === 'late' ? 'yellow' : r?.status === 'absent' ? 'red' : 'grey'} small dot /></Row>
              </Card>
            );
          })}
        </>
      )}
      <DemoLabel text="Totals refresh from submitted records" />
    </Stack>
  );
}

/** Marking screen shared by the workspace tab and Course Attendance. */
export function MarkAttendanceScreen({ navigation, route }: RootScreenProps<'InstructorMarkAttendance'>) {
  const { sectionId, date } = route.params;
  const section = useSection(sectionId);
  const roster = useRoster(sectionId);
  const data = useAttendanceForDate(date, sectionId);
  const m = useAttendanceMutations();
  const existing = data.data?.[0]?.records ?? [];
  const alreadySubmitted = existing.some(r => r.state === 'submitted');
  const draftRecords = existing.filter(r => r.state === 'draft');
  const latestDraftAt = draftRecords.map(r => r.recordedAt).sort().slice(-1)[0];
  const [entries, setEntries] = useState<Record<string, { status: AttendanceStatus; note?: string }>>({});
  const [initialised, setInitialised] = useState(false);
  const [review, setReview] = useState(false);
  if (!initialised && data.data) {
    const init: typeof entries = {};
    existing.forEach(r => { init[r.studentId] = { status: r.status, note: r.note }; });
    setEntries(init); setInitialised(true);
  }
  const dirty = initialised && JSON.stringify(entries) !== JSON.stringify(Object.fromEntries(existing.map(r => [r.studentId, { status: r.status, note: r.note }])));
  const { allowLeave } = useUnsavedChangesGuard(dirty, 'Unsaved attendance will be lost. Save a draft first?');
  const list = roster.data ?? [];
  const missing = list.filter(u => !entries[u.id]).length;
  const payload = () => ({ sectionId, date, entries: Object.entries(entries).map(([studentId, e]) => ({ studentId, ...e })) });
  const saveDraft = async () => { try { await m.saveDraft.mutateAsync(payload()); allowLeave(); toast('Draft saved (not submitted)', 'success'); navigation.goBack(); } catch (e) { toast(errorMessage(e), 'error'); } };
  const submit = async () => { try { await m.submit.mutateAsync(payload()); allowLeave(); setReview(false); toast('Attendance submitted · student records updated', 'success'); navigation.goBack(); } catch (e) { toast(errorMessage(e), 'error'); } };
  const setAll = (status: AttendanceStatus) => setEntries(e => Object.fromEntries(list.map(u => [u.id, { ...(e[u.id] ?? {}), status }])));
  return (
    <Screen testID="mark-attendance" header={<ScreenHeader title="Mark attendance" subtitle={`${section.data?.course.code ?? ''} · ${formatDate(date)}`} />} footer={<Row><Button title="Cancel" variant="ghost" style={{ flex: 0.7 }} onPress={() => navigation.goBack()} testID="mark-cancel" /><Button title="Save Draft" variant="outline" style={{ flex: 1 }} onPress={saveDraft} loading={m.saveDraft.isPending} disabled={!Object.keys(entries).length} testID="mark-save-draft" /><Button title="Review & Submit" style={{ flex: 1.2 }} onPress={() => setReview(true)} disabled={missing > 0} disabledReason={missing ? `${missing} student(s) unmarked` : undefined} testID="mark-submit" /></Row>}>
      {roster.isLoading || data.isLoading ? <LoadingState /> : (
        <Stack>
          {alreadySubmitted ? <InfoBanner tone="gold" icon="Info" text="Attendance was already submitted for this date. Submitting again updates the recorded statuses." /> : draftRecords.length ? (
            <View testID="mark-draft-loaded"><InfoBanner tone="teal" icon="Save" title="Draft loaded" text={`Restored ${draftRecords.length} saved mark(s)${isMockMode() && latestDraftAt ? ` from ${formatDateTime(latestDraftAt)}` : ''}. Review and submit when ready — drafts do not update student records.`} /></View>
          ) : null}
          <Row><Button title="All present" variant="subtle" size="sm" fullWidth={false} onPress={() => setAll('present')} testID="mark-all-present" /><Button title="Clear" variant="ghost" size="sm" fullWidth={false} onPress={() => setEntries({})} /></Row>
          {list.map(u => {
            const e = entries[u.id];
            return (
              <Card key={u.id} padding={spacing.md} testID={`mark-${u.id}`}>
                <Row gap={spacing.md}><Avatar initials={u.avatarInitials} bg={colors.green50} fg={colors.green900} size={36} /><View style={{ flex: 1 }}><Text variant="bodyStrong">{u.displayName}</Text><Text variant="caption">{u.student?.studentNumber}</Text></View></Row>
                <Row style={{ marginTop: spacing.sm }}>
                  {(['present', 'absent', 'late'] as AttendanceStatus[]).map(st => <Button key={st} title={st[0].toUpperCase() + st.slice(1)} size="sm" style={{ flex: 1 }} variant={e?.status === st ? (st === 'absent' ? 'danger' : st === 'late' ? 'gold' : 'primary') : 'outline'} onPress={() => setEntries(x => ({ ...x, [u.id]: { ...(x[u.id] ?? {}), status: st } }))} testID={`mark-${u.id}-${st}`} />)}
                </Row>
                <Input placeholder="Note (optional)" value={e?.note ?? ''} onChangeText={t => setEntries(x => ({ ...x, [u.id]: { status: x[u.id]?.status ?? 'present', note: t } }))} containerStyle={{ marginTop: spacing.sm }} testID={`mark-${u.id}-note`} />
              </Card>
            );
          })}
          <DemoLabel text="Draft saves do not update student attendance; submit does" />
        </Stack>
      )}
      <ConfirmSheet visible={review} onClose={() => setReview(false)} onConfirm={submit} loading={m.submit.isPending} title="Submit attendance?" icon="ClipboardCheck" confirmLabel="Submit attendance" testID="mark-review-sheet" message={<Stack gap={4}><Text variant="body" align="center">{formatDate(date)} · {list.length} students</Text><Text variant="bodySm" align="center">Present {Object.values(entries).filter(e => e.status === 'present').length} · Absent {Object.values(entries).filter(e => e.status === 'absent').length} · Late {Object.values(entries).filter(e => e.status === 'late').length}</Text><Text variant="caption" align="center">Submitting refreshes course summaries and each student's attendance view.</Text></Stack>} />
    </Screen>
  );
}

export const attendanceStyles = StyleSheet.create({});
