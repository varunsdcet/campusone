import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, EmptyState, Icon, Select, Input, BottomSheet, KeyValueRow, DemoLabel } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useAcademicProfile, useCalendars, usePlan, usePracticum } from './useRecords';
import { formatDate } from '../../../utils/format';
import type { PlanCourse } from '../../../domain/types';
import type { CalendarPeriod } from '../../../services/contracts/records';
import { useFileActions } from '../../shared/useFileActions';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';

const STATUS: Record<PlanCourse['status'], { label: string; tone: 'green' | 'coral' | 'grey' | 'yellow'; color: string }> = {
  completed: { label: '✓ Completed', tone: 'green', color: colors.success600 },
  dropped: { label: 'Dropped Course', tone: 'coral', color: colors.coral500 },
  notStarted: { label: 'Not Started', tone: 'grey', color: colors.inkFaint },
  inProgress: { label: '• In Progress', tone: 'yellow', color: colors.gold500 },
};

export function ProgramPlanScreen({ navigation }: RootScreenProps<'StudentProgramPlan'>) {
  const plan = usePlan();
  const academic = useAcademicProfile();
  const files = useFileActions();
  const [status, setStatus] = useState<'all' | PlanCourse['status']>('all');
  const [query, setQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [detail, setDetail] = useState<PlanCourse | null>(null);
  const data = useMemo(() => plan.data ?? [], [plan.data]);
  const counts = { inProgress: data.filter(c => c.status === 'inProgress').length, completed: data.filter(c => c.status === 'completed').length, dropped: data.filter(c => c.status === 'dropped').length, notStarted: data.filter(c => c.status === 'notStarted').length };
  const list = useMemo(() => data.filter(c => (status === 'all' || c.status === status) && (!query.trim() || `${c.code} ${c.title}`.toLowerCase().includes(query.toLowerCase()))), [data, status, query]);
  const completion = data.length ? Math.round((counts.completed / data.length) * 100) : 0;
  const active = data.length ? Math.round(((counts.completed + counts.inProgress) / data.length) * 100) : 0;
  return (
    <Screen testID="program-plan" header={<ScreenHeader actions={[{ icon: 'Search', accessibilityLabel: 'Search courses', onPress: () => setShowSearch(v => !v), testID: 'plan-search-toggle' }]} />}>
      {plan.isLoading ? <LoadingState /> : plan.error ? <ErrorState error={plan.error} onRetry={() => plan.refetch()} /> : (
        <Stack>
          <Text variant="displayLg">Program Plan</Text>
          <Text variant="body">Track your required courses, schedules, academic progression, and term milestones.</Text>
          {academic.data?.cohort ? <Card tone="green">
            <Text variant="overline">Assigned cohort</Text>
            <Text variant="titleMd">{academic.data.cohort.code} · {academic.data.cohort.label}</Text>
            <Text variant="bodySm">Intake {academic.data.cohort.intakeMonth}/{academic.data.cohort.intakeYear} · Section {academic.data.cohort.sectionLabel}</Text>
          </Card> : null}
          {academic.data?.transferCredits.length ? <Card>
            <Text variant="titleSm">Transfer Credits</Text>
            <Text variant="caption">Accepted credits count toward your degree progress.</Text>
            {academic.data.transferCredits.map(credit => <View key={credit.id} style={styles.transferRow}>
              <View style={{ flex: 1 }}><Text variant="bodyStrong">{credit.externalCode} · {credit.externalTitle}</Text><Text variant="caption">{credit.equivalentCourse ? `Equivalent: ${credit.equivalentCourse.code} · ${credit.equivalentCourse.title}` : 'No internal equivalent selected'} · {credit.credits} credits</Text></View>
              <Pill label={credit.status} tone={credit.status === 'accepted' ? 'green' : credit.status === 'rejected' ? 'red' : 'yellow'} small />
            </View>)}
          </Card> : null}
          <Card>
            <Row justify="space-between"><Row gap={6}><View style={styles.dot} /><Text variant="overline">Curriculum pathway</Text></Row><Pill label={`${data.length} Total Courses`} tone="grey" small /></Row>
            <Row style={{ marginTop: spacing.sm }}>
              {[['In Progress', counts.inProgress, colors.gold500], ['Completed', counts.completed, colors.success600], ['Dropped', counts.dropped, colors.coral500], ['Upcoming', counts.notStarted, colors.inkFaint]].map(([l, v, c]) => <View key={String(l)} style={styles.stat}><Text variant="displaySm" color={String(c)}>{v}</Text><Text variant="caption">{l}</Text></View>)}
            </Row>
            <View style={styles.segBar}>
              {[counts.completed, counts.inProgress, counts.dropped, counts.notStarted].map((n, i) => <View key={i} style={{ flex: n || 0.001, backgroundColor: [colors.success600, colors.gold500, colors.coral500, colors.border][i] }} />)}
            </View>
            <Row justify="space-between"><Text variant="caption">Overall Completion: {completion}% ({counts.completed}/{data.length})</Text><Text variant="caption">Active: {active}%</Text></Row>
          </Card>
          <Card padding={spacing.md}>
            <Select compact label="Filter status" value={status} onChange={setStatus} testID="plan-status" options={[{ value: 'all', label: `All Statuses (${data.length})` }, { value: 'inProgress', label: `In Progress (${counts.inProgress})` }, { value: 'completed', label: `Completed (${counts.completed})` }, { value: 'dropped', label: `Dropped (${counts.dropped})` }, { value: 'notStarted', label: `Not Started (${counts.notStarted})` }]} />
            {showSearch || query ? <Input label="Search course" placeholder="Code or title (e.g. CS201, Algorithms)" value={query} onChangeText={setQuery} containerStyle={{ marginTop: spacing.sm }} testID="plan-search" /> : null}
            <Row justify="space-between" style={{ marginTop: spacing.sm }}><Text variant="bodySm">Showing {list.length === data.length ? 'all ' : ''}{list.length} courses</Text><Pressable accessibilityRole="button" onPress={() => { setStatus('all'); setQuery(''); }} testID="plan-reset"><Text variant="label" color={colors.coral600}>Reset</Text></Pressable></Row>
          </Card>
          {!list.length ? <EmptyState icon="Route" title="No courses match" /> : list.map(c => (
            <Card key={c.id} onPress={() => setDetail(c)} testID={`plan-${c.id}`}>
              <Row justify="space-between"><Text variant="titleMd">({String(c.order).padStart(2, '0')}) {c.code}</Text><Pill label={STATUS[c.status].label} tone={STATUS[c.status].tone} small /></Row>
              <Text variant="bodyStrong" style={{ marginTop: 2 }}>{c.title}</Text>
              {c.startDate ? <Row gap={6} style={{ marginTop: 6 }}><Icon name="Calendar" size={13} color={colors.inkMuted} /><Text variant="caption">{formatDate(c.startDate, { dot: true, weekday: true })}{c.endDate ? ` - ${formatDate(c.endDate, { dot: true, weekday: true })}` : ''}</Text></Row> : null}
              {c.scheduleLabel ? <Row gap={6}><Icon name="Clock" size={13} color={colors.inkMuted} /><Text variant="caption">{c.scheduleLabel}</Text></Row> : null}
              <Text variant="label" color={c.status === 'dropped' ? colors.coral600 : colors.green900} style={{ marginTop: 6 }}>{c.status === 'dropped' ? 'Retake options / History →' : c.status === 'notStarted' && isMockMode() ? (c.campusRoom === 'TBD' && c.scheduleLabel.includes('Placement') ? 'Placement guidelines →' : 'Syllabus preview →') : 'View course details →'}</Text>
            </Card>
          ))}
          <PracticumCard />
          <CalendarCard />
          <Card tone="gold">
            <Text variant="overline" style={{ marginBottom: 4 }}>{isMockMode() ? 'Office of the Registrar (demo)' : 'Office of the Registrar'}</Text>
            <Text variant="caption">{isMockMode() ? 'Any schedule modification requires formal department approval and degree audit sync. The export below is a sample academic audit generated locally, not an official document.' : 'Any schedule modification requires formal department approval and degree audit sync.'}</Text>
            {isMockMode() ? <Button title="Download sample academic audit (PDF)" icon={<Icon name="Download" size={16} color={colors.white} />} style={{ marginTop: spacing.sm }} loading={files.busy === 'download:audit'} onPress={() => files.download('audit', 'academic-audit-SAMPLE.pdf')} testID="plan-export" /> : null}
          </Card>
          <DemoLabel text="Summaries derived from plan fixtures" />
        </Stack>
      )}
      <BottomSheet visible={!!detail} onClose={() => setDetail(null)} title={detail ? `(${String(detail.order).padStart(2, '0')}) ${detail.code}` : ''} subtitle={detail?.title} testID="plan-detail">
        {detail ? (<>
          <KeyValueRow label="Enrollment Status" value={STATUS[detail.status].label.replace(/^[•✓] /, '')} />
          <KeyValueRow label="Dates" value={detail.startDate ? `${formatDate(detail.startDate, { dot: true })}${detail.endDate ? ` - ${formatDate(detail.endDate, { dot: true })}` : ''}` : 'Not scheduled yet'} />
          <KeyValueRow label="Schedule" value={detail.scheduleLabel || 'Not scheduled yet'} border={Boolean(detail.campusRoom)} />
          {detail.campusRoom ? <KeyValueRow label="Campus & Room" value={detail.campusRoom} border={false} /> : null}
          {detail.retakeSectionCode ? <Text variant="caption" style={{ marginBottom: spacing.sm }}>Retake section: {detail.retakeSectionCode}{detail.status === 'dropped' && isMockMode() ? ' · history: dropped Nov 2025, retake in progress (07)' : ''}</Text> : null}
          <Row>
            <Button title="Go to Course" style={{ flex: 1 }} disabled={!detail.sectionId} disabledReason={detail.sectionId ? undefined : 'Not enrolled in a section yet'} onPress={() => { setDetail(null); navigation.navigate(Routes.StudentCourseDetails, { sectionId: detail.sectionId! }); }} testID="plan-go-course" />
            {isMockMode() ? <Button title="View Syllabus" variant="subtle" style={{ flex: 1 }} onPress={() => { files.view('syllabus'); }} testID="plan-syllabus" /> : null}
          </Row>
          {detail.status === 'dropped' ? <Button title="Retake options / History" variant="ghost" onPress={() => { setDetail(null); const retake = data.find(x => x.code === detail.code && x.id !== detail.id); if (retake) setTimeout(() => setDetail(retake), 300); else toast('No retake section found', 'info'); }} testID="plan-retake" /> : null}
        </>) : null}
      </BottomSheet>
    </Screen>
  );
}

/** Practicum placements and logged hours (GET /student/practicum, POST /student/practicum/hours). */
function PracticumCard() {
  const { supported, list, logHours } = usePracticum();
  const [placementId, setPlacementId] = useState<string | null>(null);
  const [week, setWeek] = useState('');
  const [hours, setHours] = useState('');
  if (!supported || !list.data?.length) return null;
  const num = Number(hours);
  const valid = week.trim().length > 0 && num > 0 && num <= 80;
  const save = async () => {
    if (!placementId) return;
    try {
      await logHours.mutateAsync({ placementId, weekLabel: week, hours: num });
      toast('Hours logged · awaiting approval', 'success');
      setPlacementId(null); setWeek(''); setHours('');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  return (
    <>
      <Text variant="overline">Practicum</Text>
      {list.data.map(p => {
        const approved = p.hours.filter(h => h.status === 'approved').reduce((n, h) => n + h.hours, 0);
        const pendingHours = p.hours.filter(h => h.status === 'pending').reduce((n, h) => n + h.hours, 0);
        return (
          <Card key={p.id} testID={`practicum-${p.id}`}>
            <Row justify="space-between" align="flex-start"><Text variant="titleMd" style={{ flex: 1 }}>{p.siteName}</Text><Pill label={p.status[0].toUpperCase() + p.status.slice(1)} tone={p.status === 'active' ? 'green' : 'grey'} small /></Row>
            <Text variant="bodySm">{p.programName}</Text>
            <KeyValueRow label="Employer" value={p.employerName} />
            {p.siteAddress ? <KeyValueRow label="Site address" value={p.siteAddress} /> : null}
            {p.supervisorName ? <KeyValueRow label="Faculty supervisor" value={`${p.supervisorName}${p.supervisorEmail ? ` · ${p.supervisorEmail}` : ''}`} /> : null}
            {p.startsOn ? <Row gap={6} style={{ marginTop: 6 }}><Icon name="Calendar" size={13} color={colors.inkMuted} /><Text variant="caption">{formatDate(p.startsOn, { dot: true })}{p.endsOn ? ` - ${formatDate(p.endsOn, { dot: true })}` : ''}</Text></Row> : null}
            <KeyValueRow label="Approved hours" value={String(approved)} />
            <KeyValueRow label="Pending approval" value={String(pendingHours)} border={!p.hours.length} />
            {p.hours.map(h => <KeyValueRow key={h.id} label={h.weekLabel} value={<Pill label={`${h.hours} h · ${h.status}`} tone={h.status === 'approved' ? 'green' : h.status === 'rejected' ? 'red' : 'yellow'} small />} />)}
            {p.evaluations.map(e => <KeyValueRow key={e.id} label="Evaluation" value={<Pill label={`${e.status}${e.score ? ` · ${e.score}/5` : ''}`} tone={e.status === 'reviewed' ? 'green' : 'yellow'} small />} />)}
            {p.incidents.map(i => <KeyValueRow key={i.id} label={`${i.category} incident`} value={<Pill label={`${i.severity} · ${i.status}`} tone={i.status === 'Closed' || i.status === 'Resolved' ? 'green' : 'red'} small />} />)}
            {p.status === 'active' ? <Button title="Log hours" variant="outline" size="sm" style={{ marginTop: spacing.sm }} onPress={() => { setPlacementId(p.id); setWeek(''); setHours(''); }} testID={`practicum-log-${p.id}`} /> : null}
          </Card>
        );
      })}
      <BottomSheet visible={!!placementId} onClose={() => setPlacementId(null)} title="Log practicum hours" subtitle="Your supervisor approves logged hours" testID="practicum-sheet">
        <Input label="Week" placeholder="e.g. Week of Oct 5" value={week} onChangeText={setWeek} maxLength={80} testID="practicum-week" />
        <Input label="Hours" placeholder="0" keyboardType="decimal-pad" value={hours} onChangeText={setHours} error={hours && !(num > 0 && num <= 80) ? 'Enter between 0.5 and 80 hours' : undefined} testID="practicum-hours" />
        <Button title="Submit hours" onPress={save} disabled={!valid} disabledReason="Enter the week and hours" loading={logHours.isPending} testID="practicum-submit" />
      </BottomSheet>
    </>
  );
}

/** Academic blocks and financial terms (GET /student/calendars). */
function CalendarCard() {
  const cal = useCalendars();
  if (!cal.supported || !cal.data || (!cal.data.academicBlocks.length && !cal.data.financialTerms.length)) return null;
  const today = new Date().toISOString().slice(0, 10);
  const row = (p: CalendarPeriod) => {
    const current = p.startsOn <= today && (!p.endsOn || p.endsOn >= today);
    return <KeyValueRow key={p.id} label={p.name} value={<Text variant="caption" color={current ? colors.green900 : colors.inkMuted}>{p.startsOn ? formatDate(p.startsOn, { dot: true }) : ''}{p.endsOn ? ` - ${formatDate(p.endsOn, { dot: true })}` : ''}{current ? ' · now' : ''}</Text>} />;
  };
  return (
    <Card testID="plan-calendars">
      <Row gap={6} style={{ marginBottom: spacing.sm }}><Icon name="CalendarRange" size={16} color={colors.green900} /><Text variant="overline">Academic calendar</Text></Row>
      {cal.data.academicBlocks.length ? <Text variant="label">Academic blocks</Text> : null}
      {cal.data.academicBlocks.map(row)}
      {cal.data.financialTerms.length ? <Text variant="label" style={{ marginTop: spacing.sm }}>Terms</Text> : null}
      {cal.data.financialTerms.map(row)}
    </Card>
  );
}

const styles = StyleSheet.create({
  transferRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green900 },
  stat: { flex: 1, alignItems: 'center' },
  segBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginVertical: spacing.sm },
});
