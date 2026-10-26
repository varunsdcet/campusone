import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, Icon, Accordion, SegmentedTabs, KeyValue, ProgressBar, BottomSheet, ListRow, DemoLabel, EmptyState } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useSection, useGradeItems, useStudentMarks, useAssignments } from './useCourses';
import { useFileActions } from '../../shared/useFileActions';
import { formatDate } from '../../../utils/format';
import type { Material, AiDraftStoryboard } from '../../../domain/types';
import { useAppNavigation } from '../../../navigation/hooks';
import { AvatarVideoModal } from '../../shared/AvatarVideoPlayer';
import { LiveCourseContent } from './LiveCourseContent';

export function CourseDetailsScreen({ route }: RootScreenProps<'StudentCourseDetails'>) {
  const { sectionId } = route.params;
  const navigation = useAppNavigation();
  const section = useSection(sectionId);
  const [tab, setTab] = useState<'content' | 'grades'>(route.params.tab ?? 'content');
  const [menu, setMenu] = useState(false);
  const s = section.data;
  return (
    <Screen padded={false} testID="course-details" header={<ScreenHeader backLabel="Back" actions={[{ icon: 'EllipsisVertical', accessibilityLabel: 'Course options', onPress: () => setMenu(true), testID: 'course-menu' }]} />}>
      {section.isLoading ? <LoadingState /> : !s ? <ErrorState error={section.error} onRetry={() => section.refetch()} /> : (
        <Stack style={{ paddingHorizontal: spacing.lg }}>
          <Card>
            <Stack gap={spacing.sm}>
              <Row><Pill label={s.status} tone="green" small dot /><Pill label={s.sectionCode} tone="grey" small /></Row>
              <Text variant="displayMd">{s.course.code} · {s.course.title}</Text>
              <Text variant="bodySm">{s.course.department ? `Campus One • ${s.course.department}` : 'Campus One'}</Text>
              <Row wrap gap={spacing.md}>
                <KeyValue label="Delivery" value={s.delivery} style={styles.kv} />
                <KeyValue label="Instructor" value={s.instructorName} style={styles.kv} />
                <KeyValue label="Location" value={s.location} style={styles.kv} />
                <KeyValue label="Schedule" value={`${formatDate(s.startDate)} – ${formatDate(s.endDate)}`} style={styles.kv} />
              </Row>
            </Stack>
          </Card>
          <SegmentedTabs options={[{ value: 'content', label: 'Course Content' }, { value: 'grades', label: 'Grades & Progress' }]} value={tab} onChange={setTab} testID="course-tab" />
          {tab === 'grades' ? <GradesTab sectionId={sectionId} /> : isMockMode() ? <ContentTab sectionId={sectionId} /> : <LiveCourseContent section={s} />}
        </Stack>
      )}
      <Pressable accessibilityRole="button" accessibilityLabel="Ask Campus One" onPress={() => navigation.navigate(Routes.AskHeritage)} style={styles.fab}><Icon name="Sparkles" size={16} color={colors.white} /><Text variant="label" color={colors.white}>Ask Campus One</Text></Pressable>
      <BottomSheet visible={menu} onClose={() => setMenu(false)} title="Course options">
        <ListRow icon="Info" title="All course information" subtitle="Weekly & calendar views" onPress={() => { setMenu(false); navigation.navigate(Routes.StudentCourseInfo, { sectionId }); }} />
        <ListRow icon="Target" title="Learning objectives" onPress={() => { setMenu(false); navigation.navigate(Routes.StudentLearningObjectives, { sectionId }); }} />
        <ListRow icon="ClipboardList" title="Assignments" onPress={() => { setMenu(false); navigation.navigate(Routes.StudentAssignments); }} />
        <ListRow icon="CalendarCheck" title="Attendance" onPress={() => { setMenu(false); navigation.navigate(Routes.StudentAttendance, { sectionId }); }} />
        {!isMockMode() ? <ListRow icon="NotebookPen" title="My notes" subtitle="Lab notebooks" onPress={() => { setMenu(false); navigation.navigate(Routes.StudentCourseNotes, { sectionId }); }} testID="course-menu-notes" /> : null}
        {!isMockMode() ? <ListRow icon="ClipboardCheck" title="Assessments" subtitle="Timed quizzes & exams" onPress={() => { setMenu(false); navigation.navigate(Routes.StudentCourseAssessments, { sectionId }); }} testID="course-menu-assessments" /> : null}
        {!isMockMode() ? <ListRow icon="Video" title="Live class" subtitle="Join, status & recordings" onPress={() => { setMenu(false); navigation.navigate(Routes.StudentLiveRoom, { sectionId, roomId: 'main' }); }} testID="course-menu-live" /> : null}
      </BottomSheet>
    </Screen>
  );
}

function ContentTab({ sectionId }: { sectionId: string }) {
  const navigation = useAppNavigation();
  const section = useSection(sectionId);
  const files = useFileActions();
  const [resourcesOpen, setResourcesOpen] = useState(true);
  const [evalOpen, setEvalOpen] = useState(true);
  const [video, setVideo] = useState<AiDraftStoryboard | null>(null);
  const s = section.data!;
  const mock = isMockMode();
  const assignmentId = (url?: string) => /\/student\/assignments\/([\w-]+)\/?$/.exec(url ?? '')?.[1];
  const openMaterial = (m: Material) => {
    const aid = assignmentId(m.url);
    if (aid) navigation.navigate(Routes.StudentAssignmentDetails, { assignmentId: aid });
    else if (m.url) void files.openUrl(m.url);
    else if (m.kind === 'quiz') navigation.navigate(Routes.StudentCourseQuiz, { sectionId, materialId: m.id });
    else if (m.sampleAsset) void files.view(m.sampleAsset);
  };
  const canOpen = (m: Material) => Boolean(m.url) || (mock && (m.kind === 'quiz' || Boolean(m.sampleAsset)));
  const resources = [
    ...(mock || s.description ? [{ id: 'desc', kind: 'page', title: 'Brief Course Description', sub: mock ? 'Official syllabus overview & policy' : s.description, icon: 'FileText', tile: colors.info100, action: () => navigation.navigate(Routes.StudentLearningObjectives, { sectionId }) }] : []),
    ...(mock || s.objectives ? [{ id: 'obj', kind: 'page', title: 'Learning Objectives', sub: mock ? 'Key learning outcomes & guidelines' : s.objectives.split('\n')[0], icon: 'Target', tile: colors.info100, action: () => navigation.navigate(Routes.StudentLearningObjectives, { sectionId }) }] : []),
    ...(mock || s.joinUrl ? [{ id: 'live', kind: 'live', title: mock ? 'Live Class (demo room)' : 'Live Class', sub: s.liveRoomReady ? (mock ? 'Room ready · Tap to join demo session' : 'Room ready · Tap to join session') : 'Room not open yet', icon: 'Video', tile: colors.info100, action: () => (mock ? navigation.navigate(Routes.StudentLiveRoom, { sectionId, roomId: 'main' }) : void files.openUrl(s.joinUrl!)) }] : []),
    ...(mock ? [
      { id: 'syl', kind: 'file', title: 'Course Syllabus', sub: s.syllabusFile, icon: 'FileDown', tile: colors.green100, action: () => files.view('syllabus') },
      { id: 'room1', kind: 'live', title: 'Online Class Link (Room 1)', sub: `Published · ${s.enrolledCount} students notified`, icon: 'Video', tile: colors.info100, action: () => navigation.navigate(Routes.StudentLiveRoom, { sectionId, roomId: 'room1' }) },
      { id: 'breakout', kind: 'live', title: 'Online Class Link (Breakout)', sub: 'Published · demo room', icon: 'Video', tile: colors.info100, action: () => navigation.navigate(Routes.StudentLiveRoom, { sectionId, roomId: 'breakout' }) },
    ] : []),
  ] as { id: string; kind: 'page' | 'live' | 'file'; title: string; sub: string; icon: 'FileText' | 'Target' | 'Video' | 'FileDown'; tile: string; action: () => void }[];
  return (
    <Stack>
      {resources.length ? <Accordion title="Resources" subtitle={`${resources.length} items`} dot open={resourcesOpen} onToggle={setResourcesOpen} testID="course-resources" titleVariant="overline">
        {resources.map(r => (
          <Row key={r.id} gap={spacing.md} style={styles.resRow}>
            <View style={[styles.tile, { backgroundColor: r.tile }]}><Icon name={r.icon} size={18} color={colors.green900} /></View>
            <View style={{ flex: 1 }}><Text variant="bodyStrong">{r.title}</Text><Row gap={4}>{r.kind === 'live' && s.liveRoomReady ? <View style={styles.greenDot} /> : null}<Text variant="caption" numberOfLines={1} style={{ flex: 1 }}>{r.sub}</Text></Row></View>
            <Button title={r.kind === 'live' ? 'Join' : 'Open'} variant={r.kind === 'live' ? 'primary' : 'outline'} size="sm" fullWidth={false} onPress={r.action} testID={`resource-${r.id}`} />
          </Row>
        ))}
      </Accordion> : null}
      {mock || s.evaluation.length ? <Accordion title="Evaluation criteria" dot open={evalOpen} onToggle={setEvalOpen} testID="course-eval" titleVariant="overline" right={<Text variant="caption">Details</Text>}>
        <Card tone="dark" padding={spacing.md}>
          <Row justify="space-between"><View><Text variant="overline" color={colors.green100}>Evaluation breakdown</Text><Text variant="caption" color={colors.green100}>Course Grade Distribution — Out of 100%</Text></View><Pill label={s.course.code.replace(/\s/g, '')} tone="grey" small /></Row>
          <View style={{ gap: 8, marginTop: spacing.sm }}>
            {s.evaluation.map(e => (
              <View key={e.label} style={{ gap: 4 }}>
                <Row justify="space-between"><Text variant="bodySm" color={colors.white}>{e.label}</Text><Text variant="label" color={colors.white}>{e.weight}%</Text></Row>
                <ProgressBar value={e.weight} color={e.color} track={colors.green700} height={6} />
              </View>
            ))}
          </View>
          {mock ? <Text variant="caption" color={colors.green100} style={{ marginTop: spacing.sm }}>Students must achieve a cumulative passing grade according to Campus One academic requirements (demo text).</Text> : null}
          <Row justify="space-between" style={styles.totalBar}><Text variant="label" color={colors.white}>Total course weight</Text><Text variant="label" color={colors.white}>{s.evaluation.reduce((a, e) => a + e.weight, 0)}%</Text></Row>
        </Card>
      </Accordion> : null}
      <Row justify="space-between"><Text variant="overline">Course schedule</Text><Text variant="caption">{s.days.length} days total</Text></Row>
      {s.days.length ? s.days.map(d => (
        <Accordion key={d.id} title={`${d.label.toUpperCase()}${d.note ? ` • ${d.note}` : d.date ? ` • ${formatDate(d.date)}` : ''}`} subtitle={`${d.materials.length} material${d.materials.length === 1 ? '' : 's'}`} dot initiallyOpen={d.index <= 2} testID={`course-day-${d.index}`} titleVariant="overline">
          {d.materials.map(m => (
            <Row key={m.id} gap={spacing.md} style={styles.resRow}>
              <View style={[styles.tile, { backgroundColor: m.kind === 'quiz' ? colors.coral100 : m.kind === 'folder' ? colors.green100 : colors.green50 }]}><Icon name={m.kind === 'quiz' ? 'FileQuestion' : m.kind === 'folder' ? 'Folder' : 'FileText'} size={18} color={m.kind === 'quiz' ? colors.coral600 : colors.green900} /></View>
              <View style={{ flex: 1 }}><Text variant="bodyStrong">{m.title}</Text><Text variant="caption" numberOfLines={1}>{m.fileName ?? m.status ?? ''}</Text></View>
              {m.storyboard ? <Button title="Play video" variant="outline" size="sm" fullWidth={false} icon={<Icon name="Play" size={14} color={colors.green900} />} onPress={() => setVideo(m.storyboard!)} testID={`material-video-${m.id}`} /> : canOpen(m) ? <Button title={m.kind === 'quiz' ? 'Start Quiz' : 'Open'} variant={m.kind === 'quiz' ? 'coral' : 'outline'} size="sm" fullWidth={false} onPress={() => openMaterial(m)} loading={files.busy === `view:${m.sampleAsset}`} testID={`material-${m.id}`} /> : null}
            </Row>
          ))}
        </Accordion>
      )) : <EmptyState icon="CalendarOff" title="No day-by-day materials" message={mock ? 'This section has no published daily materials in the demo fixtures.' : 'This section has no published daily materials yet.'} />}
      <DemoLabel text="Materials open bundled sample files" />
      <AvatarVideoModal storyboard={video} onClose={() => setVideo(null)} />
    </Stack>
  );
}

function GradesTab({ sectionId }: { sectionId: string }) {
  const navigation = useAppNavigation();
  const items = useGradeItems(sectionId);
  const marks = useStudentMarks();
  const assignments = useAssignments();
  const released = useMemo(() => (marks.data ?? []).filter(m => m.sectionId === sectionId), [marks.data, sectionId]);
  const anyReleased = released.length > 0;
  const totalWeight = (items.data ?? []).reduce((a, g) => a + g.weightPct, 0);
  const overall = useMemo(() => {
    const graded = (items.data ?? []).filter(g => released.find(m => m.gradeItemId === g.id && m.score !== undefined));
    if (!graded.length) return null;
    const w = graded.reduce((a, g) => a + g.weightPct, 0);
    const sum = graded.reduce((a, g) => a + (released.find(m => m.gradeItemId === g.id)!.score! / g.maxPoints) * g.weightPct, 0);
    return { pct: Math.round((sum / w) * 100), weightCovered: w };
  }, [items.data, released]);
  if (items.isLoading || marks.isLoading) return <LoadingState />;
  return (
    <Stack>
      <Card>
        <Row justify="space-between"><Text variant="displaySm">Course grades</Text><Pill label={anyReleased ? 'Published' : 'Pending release'} tone={anyReleased ? 'green' : 'coral'} small /></Row>
        <Text variant="bodySm" style={{ marginVertical: spacing.sm }}>Track your assignments, marks, feedback, and overall progress.</Text>
        {!anyReleased ? (
          <View style={styles.pending}><Icon name="PieChart" size={22} color={colors.inkMuted} /><Text variant="bodyStrong" align="center">No grades posted yet</Text><Text variant="caption" align="center">Your marks and grades will appear here when your instructor releases them.</Text></View>
        ) : null}
        <Row justify="space-between" style={{ marginTop: spacing.sm }}><Text variant="label">Overall Course Mark</Text><Text variant="mono">{overall ? `${overall.pct}% (of ${overall.weightCovered}% weight)` : '— / 100%'}</Text></Row>
      </Card>
      <Accordion title={`Grade distribution · ${totalWeight}% total`} dot initiallyOpen titleVariant="overline" testID="grades-distribution">
        {(items.data ?? []).map((g, i) => (
          <View key={g.id} style={{ gap: 4 }}>
            <Row justify="space-between"><Text variant="bodySm">{g.name}</Text><Text variant="label">{g.weightPct}%</Text></Row>
            <ProgressBar value={g.weightPct} color={[colors.info600, colors.info600, colors.success600, colors.coral500, colors.purple600][i % 5]} height={6} />
          </View>
        ))}
        <Row justify="space-between" style={{ marginTop: spacing.sm }}><Text variant="overline">Total weight</Text><Pill label={`${totalWeight}%`} tone="dark" small /></Row>
      </Accordion>
      <Row justify="space-between"><Text variant="overline">Assessments</Text><Text variant="caption">{items.data?.length ?? 0} items</Text></Row>
      <Text variant="caption">Tap an assessment to view grading rubric and submission details</Text>
      {(items.data ?? []).map(g => {
        const m = released.find(x => x.gradeItemId === g.id);
        const a = assignments.data?.find(x => x.gradeItemId === g.id);
        return (
          <Card key={g.id} padding={spacing.md} onPress={a ? () => navigation.navigate(Routes.StudentAssignmentDetails, { assignmentId: a.id }) : undefined} testID={`grade-item-${g.id}`}>
            <Row justify="space-between">
              <Text variant="titleSm" style={{ flex: 1 }}>{g.name}</Text>
              <Row gap={spacing.lg}><KeyValue label="Mark" value={m?.score !== undefined ? `${m.score} / ${g.maxPoints}` : '– / –'} mono align="right" /><KeyValue label="Grade" value={m?.score !== undefined ? letterGrade(m.score / g.maxPoints) : '–'} mono align="right" /></Row>
            </Row>
            <Text variant="mono" style={{ marginTop: 4 }}>Weight: {g.weightPct.toFixed(2)}%</Text>
            <Row justify="space-between" style={{ marginTop: 4 }}>
              <Text variant="caption" style={{ fontStyle: 'italic', flex: 1 }}>{m ? (m.feedback ?? 'Released by instructor.') : 'No grades have been posted.'}</Text>
              {a ? <Text variant="label" color={colors.green900}>Details ›</Text> : null}
            </Row>
          </Card>
        );
      })}
    </Stack>
  );
}

export function letterGrade(ratio: number): string {
  const p = ratio * 100;
  if (p >= 90) return 'A';
  if (p >= 85) return 'A-';
  if (p >= 80) return 'B+';
  if (p >= 75) return 'B';
  if (p >= 70) return 'B-';
  if (p >= 65) return 'C+';
  if (p >= 60) return 'C';
  if (p >= 50) return 'D';
  return 'F';
}

const styles = StyleSheet.create({
  kv: { width: '45%' },
  resRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  tile: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  greenDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success600 },
  totalBar: { backgroundColor: colors.green800, borderRadius: 8, padding: spacing.sm, marginTop: spacing.sm },
  pending: { alignItems: 'center', gap: 4, backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: spacing.lg },
  fab: { position: 'absolute', right: 16, bottom: 28, flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: colors.green900, paddingHorizontal: 16, minHeight: 46, borderRadius: 999 },
});
