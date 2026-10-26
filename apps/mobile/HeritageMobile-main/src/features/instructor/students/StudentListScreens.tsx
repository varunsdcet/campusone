import React, { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, Input, ChipRow, LoadingState, ErrorState, EmptyState, Avatar, AlphabetBar, Pager, BottomSheet, Select, KeyValueRow, DemoLabel, InfoBanner, ListRow, SegmentedTabs, StatTile } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import type { MarkStatus } from '../../../domain/types';
import { useStudents, useStudent, useStudentRecord, useStudentNotes } from '../useInstructor';
import { useDebounced } from '../../shared/hooks';
import { formatDateTime } from '../../../utils/format';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';

const STATUS_TONE: Record<string, 'teal' | 'grey' | 'blue' | 'red' | 'yellow' | 'green'> = { 'Active Student': 'teal', 'Former Student': 'grey' };

export function StudentListScreen({ navigation }: RootScreenProps<'InstructorStudentList'>) {
  const [category, setCategory] = useState<'all' | 'active' | 'former'>('all');
  const [query, setQuery] = useState('');
  const [letter, setLetter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(false);
  const [program, setProgram] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const q = useDebounced(query);
  const students = useStudents({ category, query: q, letter, page, pageSize, program: program || undefined });
  const all = useStudents({ category: 'all', page: 1, pageSize: 500 });
  const active = useStudents({ category: 'active', page: 1, pageSize: 500 });
  const former = useStudents({ category: 'former', page: 1, pageSize: 500 });
  const d = students.data;
  return (
    <Screen scroll={false} padded={false} testID="student-list" header={<ScreenHeader backLabel="Student List" />}>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <ChipRow options={[{ value: 'all', label: 'Browse All Students', count: all.data?.total }, { value: 'active', label: 'Active Student', count: active.data?.total }, { value: 'former', label: 'Former', count: former.data?.total }]} value={category} onChange={c => { setCategory(c); setPage(1); }} testID="students-category" />
        <Row style={{ marginVertical: spacing.sm }}><View style={{ flex: 1 }}><Input placeholder="Search Students..." leftIcon="Search" value={query} onChangeText={t => { setQuery(t); setPage(1); }} testID="students-search" /></View><Button title="Filters" variant="outline" fullWidth={false} icon={<Row gap={4}><View style={[styles.dot, program ? { backgroundColor: colors.coral500 } : null]} /></Row>} onPress={() => setFilters(true)} testID="students-filters" /></Row>
        <AlphabetBar value={letter} onChange={l => { setLetter(l); setPage(1); }} testID="students-letter" />
        <View style={{ marginVertical: spacing.sm }}><Pager page={page} pageCount={d?.pageCount ?? 1} onChange={setPage} total={d?.total} pageSize={pageSize} onPageSize={setPageSize} testID="students-pager" /></View>
        <InfoBanner tone="grey" icon="ShieldCheck" text="Directory limited to students enrolled in your sections (authorised fixture records). A broad directory in the reference does not establish production access rights." />
      </View>
      {students.isLoading ? <LoadingState /> : students.error ? <ErrorState error={students.error} onRetry={() => students.refetch()} /> : (
        <FlatList data={d?.items ?? []} keyExtractor={u => u.id} contentContainerStyle={styles.list} ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={<EmptyState icon="UserX" title="No students match" action={{ label: 'Clear filters', onPress: () => { setQuery(''); setLetter('ALL'); setProgram(''); setCategory('all'); } }} />}
          renderItem={({ item: u }) => (
            <Card padding={spacing.md} onPress={() => navigation.navigate(Routes.InstructorStudentProfile, { studentId: u.id })} testID={`student-${u.id}`}>
              <Row gap={spacing.md} align="flex-start">
                <Avatar initials={u.avatarInitials} bg={colors.surfaceMuted} fg={colors.green900} />
                <View style={{ flex: 1 }}>
                  <Row justify="space-between"><Text variant="titleSm">{u.lastName}, {u.firstName}</Text><Pill label={u.status} tone={STATUS_TONE[u.status] ?? 'grey'} small /></Row>
                  <Text variant="mono">ID: {u.student?.studentNumber}</Text>
                  <KeyValueRow label="Program" value={u.student?.programName ?? ''} border={false} />
                  <KeyValueRow label="Program Term" value={u.termLabel} border={false} />
                  <KeyValueRow label="Admission Term" value={u.admissionTerm} border={false} />
                  <KeyValueRow label="Advisor" value={u.student?.advisorName.split(' ').reverse().join(', ') ?? ''} border={false} />
                  <KeyValueRow label="Date" value={formatDateTime(u.updatedAt)} border={false} />
                  <View style={styles.dashed} />
                  <Text variant="label" color={colors.green900}>View profile & records ›</Text>
                </View>
              </Row>
            </Card>
          )}
          ListFooterComponent={<View style={{ marginTop: spacing.md }}><DemoLabel text="Status/term values are synthetic" /></View>}
        />
      )}
      <BottomSheet visible={filters} onClose={() => setFilters(false)} title="Filters" testID="students-filter-sheet">
        <Select label="Program" value={program} onChange={v => { setProgram(v); setPage(1); }} options={[{ value: '', label: 'All programs' }, { value: 'Computer Science (B.Sc.)', label: 'Computer Science (B.Sc.)' }, { value: 'Nursing', label: 'Nursing' }, { value: 'Business', label: 'Business' }]} testID="students-program" />
        <Select label="Per page" value={String(pageSize)} onChange={v => { setPageSize(Number(v)); setPage(1); }} options={[{ value: '2', label: isMockMode() ? '2 (demo paging)' : '2' }, { value: '10', label: '10' }, { value: '50', label: '50' }]} testID="students-pagesize" />
        <Button title="Apply" onPress={() => setFilters(false)} />
      </BottomSheet>
    </Screen>
  );
}

type ProfileTab = 'overview' | 'grades' | 'attendance' | 'notes';
const MARK_TONE: Record<MarkStatus, 'purple' | 'blue' | 'green'> = { draft: 'purple', submitted: 'blue', released: 'green' };
const ATT_TONE: Record<string, 'green' | 'yellow' | 'red' | 'blue'> = { present: 'green', late: 'yellow', absent: 'red', excused: 'blue' };

export function InstructorStudentProfileScreen({ navigation, route }: RootScreenProps<'InstructorStudentProfile'>) {
  const q = useStudent(route.params.studentId);
  const record = useStudentRecord(route.params.studentId);
  const notes = useStudentNotes(route.params.studentId);
  const [tab, setTab] = useState<ProfileTab>('overview');
  const [draft, setDraft] = useState('');
  const u = q.data;
  const r = record.data;
  const sectionLabel = (id: string) => { const s = u?.sections.find(x => x.id === id); return s ? `${s.course.code} · ${s.sectionCode}` : 'Section'; };
  const att = r?.attendance ?? [];
  const counted = att.filter(a => a.status !== 'excused');
  const attendancePct = counted.length ? Math.round((counted.filter(a => a.status !== 'absent').length / counted.length) * 100) : null;
  const tabs: { value: ProfileTab; label: string; count?: number }[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'grades', label: 'Grades' },
    { value: 'attendance', label: 'Attendance', count: r ? att.length : undefined },
    ...(notes.supported ? [{ value: 'notes' as const, label: 'Notes', count: notes.list.data?.length }] : []),
  ];
  const addNote = async () => { try { await notes.add.mutateAsync(draft); setDraft(''); toast(isMockMode() ? 'Note saved (local demo)' : 'Note saved', 'success'); } catch (e) { toast(errorMessage(e), 'error'); } };
  const recordBody = (body: React.ReactNode) => (record.isLoading ? <LoadingState /> : record.error ? <ErrorState error={record.error} onRetry={() => record.refetch()} /> : body);
  return (
    <Screen testID="instructor-student-profile" header={<ScreenHeader backLabel="Students" />}>
      {q.isLoading ? <LoadingState /> : !u ? <ErrorState error={q.error} /> : (
        <Stack>
          <Card tone="dark">
            <Row gap={spacing.md}>
              <Avatar initials={u.avatarInitials} size={52} bg={colors.gold500} fg={colors.green900} />
              <View style={{ flex: 1 }}>
                <Text variant="displaySm" color={colors.white}>{u.displayName}</Text>
                <Text variant="bodySm" color={colors.green100}>{[u.student?.studentNumber, u.student?.programName].filter(Boolean).join(' · ')}</Text>
                {r?.standing ? <View style={{ flexDirection: 'row', marginTop: 6 }}><Pill label={r.standing} tone="teal" small testID="profile-standing-pill" /></View> : null}
              </View>
            </Row>
          </Card>
          <SegmentedTabs options={tabs} value={tab} onChange={setTab} testID="profile-tab" />
          {tab === 'overview' ? (<>
            {recordBody(
              <Row>
                <StatTile label="Attendance" value={attendancePct !== null ? `${attendancePct}%` : '—'} sub={counted.length ? `${counted.length} session(s)` : 'No submitted sessions'} style={{ flex: 1 }} />
                {r?.standing ? <StatTile label="Academic standing" value={r.standing} style={{ flex: 1 }} /> : null}
              </Row>,
            )}
            <Card>
              <Text variant="overline" style={{ marginBottom: 4 }}>Records visible to you</Text>
              <KeyValueRow label="Email" value={u.email || '—'} />
              <KeyValueRow label="Advisor" value={u.student?.advisorName || '—'} />
              <KeyValueRow label="Catalog year" value={u.student?.catalogYear || '—'} border={false} />
            </Card>
            <Card>
              <Text variant="overline" style={{ marginBottom: 4 }}>Enrolled in your sections</Text>
              {u.sections.map(s => <ListRow key={s.id} icon="BookOpen" title={`${s.course.code} · ${s.course.title}`} subtitle={s.sectionCode} onPress={() => navigation.navigate(Routes.InstructorCourseWorkspace, { sectionId: s.id, tab: 'classList' })} />)}
            </Card>
            <InfoBanner tone="grey" icon="Lock" text={isMockMode() ? 'Personal contact details, sensitive identifiers and records outside your sections are not exposed to instructors in this demo.' : 'Personal contact details, sensitive identifiers and records outside your sections are not exposed to instructors.'} />
            <Button title="Message student" variant="outline" onPress={() => navigation.navigate(Routes.MailCompose, { toId: u.id })} testID="student-message" />
          </>) : null}
          {tab === 'grades' ? recordBody(!r?.grades.length ? <EmptyState icon="ClipboardList" title="No grade items" message="None of your sections have grade items for this student yet." /> : r.grades.map(g => (
            <Card key={g.sectionId} testID={`profile-grades-${g.sectionId}`}>
              <Text variant="overline" style={{ marginBottom: 4 }}>{sectionLabel(g.sectionId)}</Text>
              {g.items.map(i => (
                <View key={i.id} style={styles.item}>
                  <Row justify="space-between">
                    <Text variant="bodyStrong" style={{ flex: 1 }}>{i.name} <Text variant="caption">({i.weightPct}%)</Text></Text>
                    <Text variant="bodyStrong">{i.score !== undefined ? `${i.score} / ${i.maxPoints}` : `— / ${i.maxPoints}`}</Text>
                    <Pill label={i.status[0].toUpperCase() + i.status.slice(1)} tone={MARK_TONE[i.status]} small style={{ marginLeft: 6 }} />
                  </Row>
                  {i.feedback ? <Text variant="caption">Feedback: {i.feedback}</Text> : null}
                </View>
              ))}
            </Card>
          ))) : null}
          {tab === 'attendance' ? recordBody(!att.length ? <EmptyState icon="CalendarCheck" title="No attendance yet" message="No submitted attendance in your sections for this student." /> : (
            <Card testID="profile-attendance">
              {att.map((a, i) => (
                <Row key={`${a.sectionId}:${a.date}:${i}`} justify="space-between" style={styles.item}>
                  <View style={{ flex: 1 }}><Text variant="bodyStrong">{a.date}</Text><Text variant="caption">{sectionLabel(a.sectionId)}{a.note ? ` · ${a.note}` : ''}</Text></View>
                  <Pill label={a.status} tone={ATT_TONE[a.status] ?? 'grey'} small dot />
                </Row>
              ))}
            </Card>
          )) : null}
          {tab === 'notes' && notes.supported ? (<>
            <Card>
              <Input label="Add a note" value={draft} onChangeText={setDraft} placeholder="Visible to instructors only" multiline testID="profile-note-input" />
              <Button title="Save note" size="sm" style={{ marginTop: spacing.sm }} onPress={addNote} loading={notes.add.isPending} disabled={!draft.trim()} testID="profile-note-save" />
            </Card>
            {notes.list.isLoading ? <LoadingState /> : notes.list.error ? <ErrorState error={notes.list.error} onRetry={() => notes.list.refetch()} /> : !notes.list.data?.length ? <EmptyState icon="NotebookPen" title="No notes yet" /> : notes.list.data.map(n => (
              <Card key={n.id} padding={spacing.md} testID={`profile-note-${n.id}`}><Text variant="body">{n.text}</Text><Text variant="caption">{n.author} · {formatDateTime(n.at)}</Text></Card>
            ))}
            <DemoLabel text="Notes are kept in local demo state only" />
          </>) : null}
        </Stack>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ item: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }, list: { paddingHorizontal: spacing.lg, paddingBottom: 40 }, dashed: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.border, marginVertical: 6 }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border } });
