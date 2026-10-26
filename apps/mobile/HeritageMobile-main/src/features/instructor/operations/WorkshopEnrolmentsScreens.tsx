import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, Input, Select, LoadingState, ErrorState, EmptyState, Icon, SegmentedTabs, AlphabetBar, ConfirmSheet, DemoLabel, ListRow, ProgressBar } from '../../../components';
import { colors, spacing } from '../../../theme';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useWorkshopEnrolments } from '../useInstructor';
import { useWorkshop } from '../../student/courses/useCourses';
import { useFileActions } from '../../shared/useFileActions';
import { formatDate } from '../../../utils/format';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';

type Tab = 'pending' | 'approved' | 'declined';

export function WorkshopEnrolmentsScreen({ navigation, route }: RootScreenProps<'InstructorWorkshopEnrolments'>) {
  const { list, decide } = useWorkshopEnrolments();
  const [tab, setTab] = useState<Tab>(route.params?.tab ?? 'pending');
  const [student, setStudent] = useState('');
  const [workshop, setWorkshop] = useState('all');
  const [letter, setLetter] = useState('ALL');
  const [applied, setApplied] = useState({ student: '', workshop: 'all' });
  const [confirm, setConfirm] = useState<{ id: string; decision: 'approved' | 'declined' | 'dropped'; label: string } | null>(null);
  const data = useMemo(() => list.data ?? [], [list.data]);
  const counts = { pending: data.filter(e => e.status === 'pending').length, approved: data.filter(e => e.status === 'approved').length, declined: data.filter(e => e.status === 'declined').length };
  const workshops = useMemo(() => Array.from(new Map(data.map(e => [e.workshop.id, e.workshop])).values()), [data]);
  const shown = useMemo(() => data.filter(e => e.status === tab && (applied.workshop === 'all' || e.workshop.id === applied.workshop) && (!applied.student || e.student.lastName.toLowerCase().includes(applied.student.toLowerCase()) || e.student.student?.studentNumber.toLowerCase().includes(applied.student.toLowerCase()) || e.student.loginId.toLowerCase().includes(applied.student.toLowerCase())) && (letter === 'ALL' || e.student.lastName.toUpperCase().startsWith(letter))).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)), [data, tab, applied, letter]);
  const run = async () => {
    if (!confirm) return;
    try { await decide.mutateAsync({ enrolmentId: confirm.id, decision: confirm.decision }); toast(`Request ${confirm.decision} · student view and seat count updated`, 'success'); } catch (e) { toast(errorMessage(e), 'error'); }
    setConfirm(null);
  };
  return (
    <Screen testID="workshop-enrolments" header={<ScreenHeader backLabel="More" />}>
      <Stack>
        <Text variant="displaySm">Workshop Enrolments</Text>
        <Text variant="body" style={styles.intro}>Manage student workshop enrolment requests and review approvals.</Text>
        <SegmentedTabs options={[{ value: 'pending', label: 'Pending', count: counts.pending, dot: colors.warning600 }, { value: 'approved', label: 'Approved', count: counts.approved, dot: colors.success600 }, { value: 'declined', label: 'Declined', count: counts.declined, dot: colors.danger600 }]} value={tab} onChange={setTab} testID="we-tab" />
        <Card padding={spacing.md}>
          <Stack gap={spacing.sm}>
            <Input label="Student filter" placeholder="Student #, login or last name" value={student} onChangeText={setStudent} testID="we-student" />
            <Select label="Workshop filter" value={workshop} onChange={setWorkshop} options={[{ value: 'all', label: 'All Workshops' }, ...workshops.map(w => ({ value: w.id, label: `${w.code} — ${w.title}` }))]} testID="we-workshop" />
            <Select label="Status filter" value={tab} onChange={setTab} options={[{ value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'declined', label: 'Declined' }]} testID="we-status" />
            <Button title="Search Workshops" icon={<Icon name="Search" size={16} color={colors.white} />} onPress={() => setApplied({ student, workshop })} testID="we-search" />
          </Stack>
        </Card>
        <AlphabetBar value={letter} onChange={setLetter} testID="we-letter" />
        <Row justify="space-between"><Text variant="overline">Showing {shown.length} {tab} requests</Text><Text variant="caption">Sorted by date</Text></Row>
        {list.isLoading ? <LoadingState /> : list.error ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : !shown.length ? <EmptyState icon="ClipboardCheck" title={`No ${tab} requests`} /> : shown.map(e => (
          <Card key={e.id} testID={`we-${e.id}`}>
            <Row justify="space-between"><View><Text variant="titleMd">{e.student.lastName}, {e.student.firstName}</Text><Text variant="mono">{e.student.student?.studentNumber}</Text></View><Pill label={e.status[0].toUpperCase() + e.status.slice(1)} tone={e.status === 'pending' ? 'yellow' : e.status === 'approved' ? 'grey' : 'red'} small /></Row>
            <Pressable accessibilityRole="button" accessibilityLabel={`Open workshop ${e.workshop.title}`} onPress={() => navigation.navigate(Routes.InstructorWorkshopDetails, { workshopId: e.workshop.id })} style={styles.box} testID={`we-open-${e.id}`}>
              <Text variant="overline">Workshop</Text>
              <Row gap={4}><Text variant="titleSm" color={colors.green900} style={{ textTransform: 'uppercase' }}>{e.workshop.code} — {e.workshop.title}</Text><Icon name="ExternalLink" size={14} color={colors.green900} /></Row>
              <Row justify="space-between" style={styles.enrolled}><Text variant="bodySm">Enrolled On</Text><Text variant="label">{e.requestedAt.slice(0, 10)}</Text></Row>
            </Pressable>
            <Row justify="flex-end" gap={spacing.lg} style={{ marginTop: spacing.sm }}>
              {e.status === 'pending' ? (<><Pressable accessibilityRole="button" onPress={() => setConfirm({ id: e.id, decision: 'approved', label: `${e.student.displayName} · ${e.workshop.code}` })} style={styles.action} testID={`we-approve-${e.id}`}><Text variant="label" color={colors.green900}>APPROVE</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setConfirm({ id: e.id, decision: 'declined', label: `${e.student.displayName} · ${e.workshop.code}` })} style={styles.action} testID={`we-decline-${e.id}`}><Text variant="label" color={colors.coral600}>DECLINE</Text></Pressable></>) : e.status === 'approved' ? <Pressable accessibilityRole="button" onPress={() => setConfirm({ id: e.id, decision: 'dropped', label: `${e.student.displayName} · ${e.workshop.code}` })} style={styles.action} testID={`we-drop-${e.id}`}><Text variant="label" color={colors.coral600}>DROP</Text></Pressable> : <Text variant="caption">Decided {e.decidedAt ? formatDate(e.decidedAt) : ''}</Text>}
            </Row>
          </Card>
        ))}
        <DemoLabel text="Decisions persist and refresh both role views · duplicates blocked" />
      </Stack>
      <ConfirmSheet visible={!!confirm} onClose={() => setConfirm(null)} onConfirm={run} loading={decide.isPending} destructive={confirm?.decision !== 'approved'} title={confirm?.decision === 'approved' ? 'Approve enrolment?' : confirm?.decision === 'declined' ? 'Decline request?' : 'Drop enrolment?'} message={`${confirm?.label ?? ''}. ${confirm?.decision === 'approved' ? 'A seat will be allocated and the student notified.' : confirm?.decision === 'declined' ? 'The student will be notified; the request stays on record.' : 'The seat is released and the student notified.'}`} confirmLabel={confirm?.decision === 'approved' ? 'Approve' : confirm?.decision === 'declined' ? 'Decline' : 'Drop'} testID="we-confirm" />
    </Screen>
  );
}

export function InstructorWorkshopDetailsScreen({ route }: RootScreenProps<'InstructorWorkshopDetails'>) {
  const q = useWorkshop(route.params.workshopId);
  const { list } = useWorkshopEnrolments();
  const files = useFileActions();
  const w = q.data;
  const hasCapacity = Boolean(w && w.capacity > 0);
  const remaining = w && hasCapacity ? w.capacity - w.registeredCount : 0;
  const enrolments = (list.data ?? []).filter(e => e.workshopId === route.params.workshopId);
  const count = (s: string) => enrolments.filter(e => e.status === s).length;
  return (
    <Screen testID="instructor-workshop-details" header={<ScreenHeader backLabel="Workshops" />}>
      {q.isLoading ? <LoadingState /> : !w ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <Stack>
          <Text variant="displayLg">{w.title}</Text>
          <Text variant="bodySm">{w.code}</Text>
          <Card>
            <Row justify="space-between"><Text variant="displaySm">{w.title}</Text>{hasCapacity ? <Pill label={remaining > 0 ? 'Open for Enrollment' : 'Full'} tone={remaining > 0 ? 'green' : 'red'} small /> : null}</Row>
            {w.date ? <Row gap={6} style={{ marginTop: spacing.sm }}><Icon name="Calendar" size={16} color={colors.green900} /><Text variant="body">{formatDate(w.date, { long: true })}{w.startTime ? ` at ${w.startTime}` : ''}</Text></Row> : null}
            {w.location || hasCapacity ? <Row gap={6}><Icon name="Building2" size={16} color={colors.green900} />{w.location ? <Text variant="body">{w.location}</Text> : null}{hasCapacity ? <Text variant="bodySm">{remaining} of {w.capacity} seats remaining</Text> : null}</Row> : null}
            {hasCapacity ? <ProgressBar value={(w.registeredCount / w.capacity) * 100} height={5} /> : null}
            {!hasCapacity ? <Row wrap gap={spacing.sm} style={{ marginTop: spacing.sm }}><Pill label={`${count('approved') + count('completed')} approved`} tone="green" small /><Pill label={`${count('pending')} pending`} tone="yellow" small /><Pill label={`${count('declined') + count('dropped')} declined / dropped`} tone="grey" small /></Row> : null}
            {w.description ? <Text variant="body" style={{ marginTop: spacing.sm }}>{w.description}</Text> : null}
            {w.agenda.length ? <Text variant="titleSm" style={{ marginTop: spacing.md }}>Agenda</Text> : null}
            {w.agenda.map((a, i) => <Row key={a} gap={8} style={{ paddingVertical: 4 }}><Text variant="label" color={colors.inkMuted}>{i + 1}.</Text><Text variant="body">{a}</Text></Row>)}
          </Card>
          {w.materials.length ? <Card>
            <Text variant="titleSm" style={{ marginBottom: spacing.sm }}>Materials</Text>
            {w.materials.map(m => <ListRow key={m.id} title={m.title} subtitle={m.type} icon="FileText" onPress={() => files.view(m.sampleAsset)} testID={`iw-material-${m.id}`} />)}
          </Card> : null}
          {enrolments.length ? <Card>
            <Text variant="titleSm" style={{ marginBottom: spacing.sm }}>Enrolments ({enrolments.length})</Text>
            {enrolments.map(e => <Row key={e.id} justify="space-between" style={styles.enrolRow}><View style={{ flex: 1 }}><Text variant="bodyStrong">{e.student.displayName}</Text><Text variant="caption">{e.student.student?.studentNumber} · {e.requestedAt.slice(0, 10)}</Text></View><Pill label={e.status[0].toUpperCase() + e.status.slice(1)} tone={e.status === 'pending' ? 'yellow' : e.status === 'approved' || e.status === 'completed' ? 'green' : 'grey'} small /></Row>)}
          </Card> : null}
          <DemoLabel text="Seat counts derived from approved enrolments" />
        </Stack>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ intro: { flexShrink: 1 }, box: { backgroundColor: colors.surfaceSubtle, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md, marginTop: spacing.sm }, enrolled: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6, marginTop: 6 }, action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }, enrolRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border } });
