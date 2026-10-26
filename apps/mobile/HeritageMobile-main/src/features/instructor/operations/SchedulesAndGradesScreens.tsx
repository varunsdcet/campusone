import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, Select, LoadingState, ErrorState, EmptyState, Icon, KeyValueRow, Input, ConfirmSheet, DemoLabel, InfoBanner, KeyValue, StatTile, ProgressBar } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useScheduleChanges, useDecideSchedule, useGradeOverview, useInstructorSections, useHistory, useHistoryGradeDistribution } from '../useInstructor';
import { formatDate, formatDateTime } from '../../../utils/format';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';
import { useFileActions } from '../../shared/useFileActions';

export function PendingSchedulesScreen({ navigation }: RootScreenProps<'InstructorPendingSchedules'>) {
  const [type, setType] = useState('Schedule Change');
  const [applied, setApplied] = useState('Schedule Change');
  const q = useScheduleChanges(applied);
  const pending = (q.data ?? []).filter(c => c.status === 'pending');
  const decided = (q.data ?? []).filter(c => c.status !== 'pending');
  return (
    <Screen testID="pending-schedules" header={<ScreenHeader backLabel="Courses" />}>
      <Stack>
        <Text variant="displayMd">Pending Course Schedules</Text>
        <Text variant="body">Review requested schedule changes and resolve timetabling conflicts across assigned courses.</Text>
        <Card padding={spacing.md}>
          <Select label="Change type" value={type} onChange={setType} options={[{ value: 'Schedule Change', label: 'Schedule Change' }, { value: 'Room Change', label: 'Room Change' }, { value: 'Instructor Change', label: 'Instructor Change' }, { value: 'All', label: 'All change types' }]} testID="ps-type" />
          <Button title="Show Courses" style={{ marginTop: spacing.sm }} onPress={() => setApplied(type)} testID="ps-show" />
        </Card>
        <InfoBanner tone="grey" icon="ShieldCheck" text={isMockMode() ? 'Assumed permission: the instructor may accept or reject changes to their own sections (demo). Production authorisation must be confirmed by the backend.' : 'You may accept or reject changes to your own sections.'} />
        <Text variant="bodySm">Results: <Text variant="bodyStrong">{pending.length}</Text></Text>
        {q.isLoading ? <LoadingState /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !pending.length ? <EmptyState icon="CalendarCheck" title="No pending requests" message="Decided requests are listed below." /> : pending.map(c => (
          <Card key={c.id} testID={`ps-${c.id}`}>
            <Row justify="space-between"><Text variant="titleMd" style={{ flex: 1 }}>{c.section.course.code} ({c.section.sectionCode})</Text><Pill label={c.changeType} tone="grey" small /></Row>
            <Text variant="bodyStrong">{c.section.course.title}</Text>
            <Text variant="bodySm">{/TBA|TBD/i.test(c.section.location) ? 'TBA' : c.section.location}</Text>
            <View style={styles.divider} />
            <Row gap={6}><Icon name="Calendar" size={14} color={colors.green900} /><Text variant="label">{formatDate(c.proposed.startDate)} – {formatDate(c.proposed.endDate)}</Text></Row>
            <Text variant="bodySm" style={{ marginLeft: 20 }}>{c.proposed.scheduleLabel}</Text>
            <View style={styles.divider} />
            {c.conflict ? <Pill label="Conflict Detected" tone="coral" small dot /> : <Pill label="No conflict" tone="green" small dot />}
            <Row justify="space-between" style={{ marginTop: 6 }}><Text variant="caption">Requested {formatDate(c.requestedAt)}</Text><Text variant="caption">{c.requestedBy}</Text></Row>
            <Button title="Review →" variant="subtle" style={{ marginTop: spacing.sm }} onPress={() => navigation.navigate(Routes.InstructorScheduleReview, { requestId: c.id })} testID={`ps-review-${c.id}`} />
          </Card>
        ))}
        {decided.length ? (<><Text variant="overline">Decided ({decided.length})</Text>{decided.map(c => <Card key={c.id} padding={spacing.md} onPress={() => navigation.navigate(Routes.InstructorScheduleReview, { requestId: c.id })}><Row justify="space-between"><Text variant="bodyStrong">{c.section.course.code} · {c.changeType}</Text><Pill label={c.status} tone={c.status === 'accepted' ? 'green' : 'red'} small /></Row><Text variant="caption">{c.decidedAt ? formatDateTime(c.decidedAt) : ''}{c.decisionNote ? ` · ${c.decisionNote}` : ''}</Text></Card>)}</>) : null}
        <DemoLabel text="Accepted changes update the mock schedule · rejected stay traceable" />
      </Stack>
    </Screen>
  );
}

export function ScheduleReviewScreen({ navigation, route }: RootScreenProps<'InstructorScheduleReview'>) {
  const q = useScheduleChanges('All');
  const c = q.data?.find(x => x.id === route.params.requestId);
  const decide = useDecideSchedule();
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState<'accepted' | 'rejected' | null>(null);
  const run = async () => {
    if (!confirm) return;
    try { await decide.mutateAsync({ id: route.params.requestId, decision: confirm, note }); toast(confirm === 'accepted' ? 'Change accepted · section schedule updated' : 'Change rejected (kept for traceability)', 'success'); navigation.goBack(); } catch (e) { toast(errorMessage(e), 'error'); }
    setConfirm(null);
  };
  return (
    <Screen testID="schedule-review" header={<ScreenHeader title="Review change" />}>
      {q.isLoading ? <LoadingState /> : !c ? <ErrorState error={q.error ?? new Error('Request not found')} /> : (
        <Stack>
          <Card>
            <Row justify="space-between"><Text variant="titleMd">{c.section.course.code} ({c.section.sectionCode})</Text><Pill label={c.status} tone={c.status === 'pending' ? 'yellow' : c.status === 'accepted' ? 'green' : 'red'} small /></Row>
            <Text variant="bodySm">{c.section.course.title} · {c.changeType}</Text>
          </Card>
          <Row>
            <Card style={{ flex: 1 }} padding={spacing.md}><Text variant="overline" style={{ marginBottom: 4 }}>Current</Text><KeyValue label="Dates" value={`${formatDate(c.section.startDate)} – ${formatDate(c.section.endDate)}`} /><KeyValue label="Schedule" value={c.section.scheduleLabel} style={{ marginTop: 6 }} /><KeyValue label="Location" value={c.section.location} style={{ marginTop: 6 }} /></Card>
            <Card style={{ flex: 1 }} padding={spacing.md} tone="green"><Text variant="overline" style={{ marginBottom: 4 }}>Proposed</Text><KeyValue label="Dates" value={`${formatDate(c.proposed.startDate)} – ${formatDate(c.proposed.endDate)}`} /><KeyValue label="Schedule" value={c.proposed.scheduleLabel} style={{ marginTop: 6 }} /><KeyValue label="Location" value={c.proposed.location ?? c.section.location} style={{ marginTop: 6 }} /></Card>
          </Row>
          {c.conflict ? <InfoBanner tone="coral" icon="TriangleAlert" title="Conflict details" text={c.conflict} /> : <InfoBanner tone="green" icon="CircleCheck" text="No timetable conflict detected." />}
          <KeyValueRow label="Requested" value={`${formatDate(c.requestedAt)} · ${c.requestedBy}`} border={false} />
          {c.status === 'pending' ? (<>
            <Input label="Decision note (optional)" value={note} onChangeText={setNote} placeholder="e.g. Accepting; room confirmed with facilities" testID="sr-note" />
            <Row><Button title="Reject" variant="danger" style={{ flex: 1 }} onPress={() => setConfirm('rejected')} testID="sr-reject" /><Button title="Accept change" style={{ flex: 1 }} onPress={() => setConfirm('accepted')} testID="sr-accept" /></Row>
          </>) : <Card tone="muted"><Text variant="bodySm">Decided {c.decidedAt ? formatDateTime(c.decidedAt) : ''}{c.decisionNote ? ` — ${c.decisionNote}` : ''}</Text></Card>}
          <DemoLabel text="Demo permission: instructors decide on their own sections" />
        </Stack>
      )}
      <ConfirmSheet visible={!!confirm} onClose={() => setConfirm(null)} onConfirm={run} loading={decide.isPending} destructive={confirm === 'rejected'} title={confirm === 'accepted' ? 'Accept this change?' : 'Reject this change?'} message={confirm === 'accepted' ? 'The section schedule will be updated to the proposed values.' : 'The request stays on record as rejected; the schedule is unchanged.'} confirmLabel={confirm === 'accepted' ? 'Accept' : 'Reject'} testID="sr-confirm" />
    </Screen>
  );
}

export function GradesSubmissionScreen({ navigation, route }: RootScreenProps<'InstructorGradesSubmission'> | { navigation: RootScreenProps<'InstructorGradesSubmission'>['navigation']; route: { params?: { sectionId?: string } } }) {
  const sections = useInstructorSections();
  const [sectionId, setSectionId] = useState(route.params?.sectionId ?? 'all');
  const [status, setStatus] = useState<'required' | 'submitted' | 'released' | 'all'>('required');
  const [applied, setApplied] = useState<{ sectionId?: string; status: typeof status }>({ sectionId: route.params?.sectionId, status: 'required' });
  const q = useGradeOverview(applied);
  return (
    <Screen testID="grades-submission" header={<ScreenHeader backLabel="Courses" />} bottomInset={false}>
      <Stack>
        <Text variant="displayMd">Grades Submission</Text>
        <Text variant="body">Review courses requiring final grades submission and manage outstanding student marks.</Text>
        <Card padding={spacing.md}>
          <Select label="Course" value={sectionId} onChange={setSectionId} options={[{ value: 'all', label: 'All Courses' }, ...(sections.data ?? []).map(s => ({ value: s.id, label: `${s.course.code} (${s.sectionCode})` }))]} testID="gs-course" />
          <Select label="Submission status" value={status} onChange={setStatus} options={[{ value: 'required', label: 'Submission Required' }, { value: 'submitted', label: 'Submitted (not released)' }, { value: 'released', label: 'Released' }, { value: 'all', label: 'All' }]} testID="gs-status" />
          <Button title="Search Courses" icon={<Icon name="Search" size={16} color={colors.white} />} style={{ marginTop: spacing.sm }} onPress={() => setApplied({ sectionId: sectionId === 'all' ? undefined : sectionId, status })} testID="gs-search" />
        </Card>
        {q.isLoading ? <LoadingState /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (<>
          <Row justify="space-between"><Text variant="bodyStrong">{q.data?.length ?? 0} course{(q.data?.length ?? 0) === 1 ? '' : 's'} {applied.status === 'required' ? 'require submission' : applied.status === 'all' ? 'listed' : applied.status}</Text>{applied.status === 'required' && q.data?.length ? <Pill label="Pending Action" tone="gold" small dot /> : null}</Row>
          {!q.data?.length ? <EmptyState icon="ClipboardCheck" title="Nothing here" message="No sections match the selected status." /> : q.data.map(x => (
            <Card key={x.section.id} testID={`gs-${x.section.id}`}>
              <Row justify="space-between"><Text variant="titleMd" style={{ flex: 1 }}>{x.section.course.code} ({x.section.sectionCode})</Text><Pill label={x.status === 'required' ? 'Submission Required' : x.status === 'submitted' ? 'Submitted' : 'Released'} tone={x.status === 'required' ? 'warning' : x.status === 'submitted' ? 'blue' : 'green'} small /></Row>
              <Text variant="bodyStrong">{x.section.course.title}</Text>
              <View style={styles.box}>
                <KeyValueRow label="Grading Type" value={`Final Grades · ${x.studentCount} student(s)`} />
                <KeyValueRow label="Missing Grades" value={<Pill label={`${x.missing} missing`} tone={x.missing ? 'red' : 'green'} small />} />
                <KeyValueRow label="Course dates" value={x.section.endDate ? 'Continuous' : 'TBA'} border={false} />
              </View>
              <Button title={x.status === 'required' ? 'Submit Grades →' : x.status === 'submitted' ? 'Review & release →' : 'View grades →'} variant="outline" style={{ marginTop: spacing.sm }} onPress={() => navigation.navigate(Routes.InstructorCourseWorkspace, { sectionId: x.section.id, tab: 'grades' })} testID={`gs-open-${x.section.id}`} />
            </Card>
          ))}
        </>)}
        <DemoLabel text="Missing counts = grade items × roster minus entered marks" />
      </Stack>
    </Screen>
  );
}

export function CourseHistoryScreen({ navigation }: RootScreenProps<'InstructorCourseHistory'>) {
  const q = useHistory();
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <Screen testID="course-history" header={<ScreenHeader backLabel="Courses" />}>
      <Stack>
        <Text variant="displayMd">Course History</Text>
        <Text variant="body">Historical record of previously scheduled and completed course offerings.</Text>
        {q.isLoading ? <LoadingState /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? <EmptyState icon="History" title="No past offerings" /> : q.data.map(h => (
          <Card key={h.id} selected={selected === h.id} tone={selected === h.id ? 'green' : 'surface'} onPress={() => { setSelected(h.id); navigation.navigate(Routes.InstructorCourseHistoryDetails, { offeringId: h.id }); }} testID={`hist-${h.id}`}>
            <Text variant="overline">{h.termLabel}</Text>
            <Text variant="titleMd">{h.code} ({h.sectionCode})</Text>
            <Text variant="bodySm">{h.title}</Text>
            <View style={styles.divider} />
            <Row><KeyValue label="Room" value={h.room} style={{ flex: 1 }} /><KeyValue label="Schedule" value={h.schedule} style={{ flex: 1 }} /></Row>
            <KeyValue label="Instructor(s)" value={h.instructorName} style={{ marginTop: 6 }} />
            <KeyValue label="Dates" value={`${h.startDate} – ${h.endDate}`} style={{ marginTop: 6 }} />
          </Card>
        ))}
      </Stack>
    </Screen>
  );
}

export function CourseHistoryDetailsScreen({ route }: RootScreenProps<'InstructorCourseHistoryDetails'>) {
  const q = useHistory();
  const files = useFileActions();
  const h = q.data?.find(x => x.id === route.params.offeringId);
  const dist = useHistoryGradeDistribution(route.params.offeringId);
  const enrolled = dist.data?.enrolled ?? h?.enrolled ?? 0;
  const maxBand = Math.max(1, ...(dist.data?.bands ?? []).map(b => b.count));
  return (
    <Screen testID="course-history-details" header={<ScreenHeader backLabel="History" />}>
      {q.isLoading ? <LoadingState /> : !h ? <ErrorState error={new Error('Offering not found')} /> : (
        <Stack>
          <Text variant="overline">{h.termLabel}</Text>
          <Text variant="displayMd">{h.code} ({h.sectionCode})</Text>
          <Text variant="body">{h.title}</Text>
          <Card>
            <KeyValueRow label="Room" value={h.room} /><KeyValueRow label="Schedule" value={h.schedule} /><KeyValueRow label="Instructor(s)" value={h.instructorName} /><KeyValueRow label="Dates" value={`${h.startDate} – ${h.endDate}`} border={false} />
          </Card>
          <Row>
            <StatTile label="Enrolled" value={enrolled} sub="students" style={{ flex: 1 }} />
            {dist.data ? <StatTile label="Final grades" value={dist.data.graded} sub={`of ${dist.data.enrolled} released`} style={{ flex: 1 }} /> : null}
          </Row>
          {dist.isLoading ? <LoadingState /> : dist.data ? (
            <Card testID="history-grade-distribution">
              <Text variant="overline" style={{ marginBottom: spacing.sm }}>Grade distribution</Text>
              {dist.data.bands.map(b => (
                <Row key={b.label} gap={spacing.sm} style={{ marginBottom: 6 }}>
                  <Text variant="label" style={{ width: 28 }}>{b.label}</Text>
                  <View style={{ flex: 1 }}><ProgressBar value={(b.count / maxBand) * 100} height={10} /></View>
                  <Text variant="caption" style={{ width: 28, textAlign: 'right' }}>{b.count}</Text>
                </Row>
              ))}
              <Text variant="caption" style={{ marginTop: 4 }}>Weighted from released marks, using the institution's letter scale.</Text>
            </Card>
          ) : null}
          {h.resources.length ? <Card>
            <Text variant="overline" style={{ marginBottom: 4 }}>Archived resources (read-only)</Text>
            {h.resources.map(r => <Row key={r.title} justify="space-between" style={styles.res}><Text variant="bodyStrong" style={{ flex: 1 }}>{r.title}</Text>{isMockMode() ? <Button title="Open" size="sm" variant="outline" fullWidth={false} onPress={() => files.view(r.sampleAsset)} /> : null}</Row>)}
          </Card> : null}
          <InfoBanner tone="grey" icon="Lock" text="Historical offerings are read-only. Grades and attendance for past terms cannot be edited here." />
          <DemoLabel text="Archived sample resources · synthetic grade distribution" />
        </Stack>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }, box: { backgroundColor: colors.surfaceMuted, borderRadius: 10, paddingHorizontal: spacing.md, marginTop: spacing.sm }, res: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border } });
