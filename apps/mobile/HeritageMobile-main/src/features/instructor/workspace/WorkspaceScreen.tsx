import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, LoadingState, ErrorState, Icon, UnderlineTabs, Checkbox, Accordion, Input, Avatar, ListRow, DemoLabel, EmptyState } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import type { RootScreenProps, WorkspaceTab } from '../../../navigation/types';
import { useSection } from '../../student/courses/useCourses';
import { useRoster } from '../useInstructor';
import { formatDate } from '../../../utils/format';
import { useFileActions } from '../../shared/useFileActions';
import { useServices } from '../../../app/ServicesProvider';
import { useQueryClient } from '@tanstack/react-query';
import { qk } from '../../../app/queryKeys';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';
import type { Section, Material, AiDraftStoryboard } from '../../../domain/types';
import { AvatarVideoModal } from '../../shared/AvatarVideoPlayer';
import { Routes } from '../../../navigation/routes';
import { useAppNavigation } from '../../../navigation/hooks';
import { AttendanceTab } from './AttendanceTab';
import { GradesTab } from './GradesTab';
import { BadgesTab, CompetencyTab } from './BadgesCompetencyTabs';
import { LogsTab } from './LogsTab';
import { useLiveRoom } from '../../student/courses/useCourseLearning';
import { liveSectionIdOf } from '../../../services/api/courseLearning';

const TABS: { value: WorkspaceTab; label: string }[] = [
  { value: 'course', label: 'Course' }, { value: 'classList', label: 'Class List' }, { value: 'attendance', label: 'Attendance' }, { value: 'grades', label: 'Grades' }, { value: 'badges', label: 'Badges' }, { value: 'competency', label: 'Competency Breakdown' }, { value: 'logs', label: 'Logs' },
];

/** Instructor course workspace – all seven supplied horizontal tabs share section context. */
export function WorkspaceScreen({ route }: RootScreenProps<'InstructorCourseWorkspace'>) {
  const { sectionId } = route.params;
  const section = useSection(sectionId);
  const [tab, setTab] = useState<WorkspaceTab>(route.params.tab ?? 'course');
  const [editMode, setEditMode] = useState(false);
  useEffect(() => { if (route.params.tab) setTab(route.params.tab); }, [route.params.tab]);
  const s = section.data;
  return (
    <Screen padded={false} testID="course-workspace" header={<ScreenHeader actions={tab === 'course' && isMockMode() ? [{ label: editMode ? 'Edit mode ✓' : 'Edit mode', accessibilityLabel: 'Toggle edit mode', onPress: () => setEditMode(e => !e), testID: 'ws-edit-mode' }] : []} />}>
      {section.isLoading ? <LoadingState /> : !s ? <ErrorState error={section.error} onRetry={() => section.refetch()} /> : (
        <Stack style={{ paddingHorizontal: spacing.lg }}>
          <Text variant="displayMd">{s.course.code}: {s.course.title}</Text>
          <Text variant="bodySm">Session: {s.sectionCode} · {s.startDate || s.endDate ? `${formatDate(s.startDate, { dot: true })} – ${formatDate(s.endDate, { dot: true })}` : 'Dates TBA'}</Text>
          <Row gap={6}><Icon name="MapPin" size={14} color={colors.inkMuted} /><Text variant="bodySm">{s.location}</Text></Row>
          <UnderlineTabs options={TABS} value={tab} onChange={setTab} testID="ws-tab" />
          {tab === 'course' ? <CourseTab section={s} editMode={editMode} /> : tab === 'classList' ? <ClassListTab sectionId={sectionId} /> : tab === 'attendance' ? <AttendanceTab sectionId={sectionId} /> : tab === 'grades' ? <GradesTab sectionId={sectionId} /> : tab === 'badges' ? <BadgesTab sectionId={sectionId} /> : tab === 'competency' ? <CompetencyTab sectionId={sectionId} /> : <LogsTab sectionId={sectionId} />}
        </Stack>
      )}
    </Screen>
  );
}

function CourseTab({ section: s, editMode }: { section: Section & { course: { code: string; title: string }; enrolledCount: number }; editMode: boolean }) {
  const navigation = useAppNavigation();
  const files = useFileActions();
  const services = useServices();
  const qc = useQueryClient();
  const [allOpen, setAllOpen] = useState<boolean | undefined>(undefined);
  const [objectives, setObjectives] = useState(s.objectives);
  const [description, setDescription] = useState(s.description);
  const [days, setDays] = useState(s.days);
  const [saving, setSaving] = useState(false);
  const [video, setVideo] = useState<AiDraftStoryboard | null>(null);
  useEffect(() => { setObjectives(s.objectives); setDescription(s.description); setDays(s.days); }, [s.objectives, s.description, s.days]);
  const dirty = objectives !== s.objectives || description !== s.description || JSON.stringify(days) !== JSON.stringify(s.days);
  const save = async () => {
    setSaving(true);
    try { await services.courses.updateSectionContent(s.id, { objectives, description, days }); qc.invalidateQueries({ queryKey: qk.section(s.id) }); qc.invalidateQueries({ queryKey: ['logs'] }); toast('Course content saved', 'success'); } catch (e) { toast(errorMessage(e), 'error'); } finally { setSaving(false); }
  };
  const mock = isMockMode();
  const open = (m: Material) => { const liveId = liveSectionIdOf(m.url); if (liveId) navigation.navigate(Routes.InstructorLiveRoom, { sectionId: liveId, roomId: m.id }); else if (m.url) void files.openUrl(m.url); else if (m.kind === 'quiz') toast(`${m.title}: quiz authoring opens in the Grades tab${mock ? ' (demo)' : ''}`, 'info'); else if (mock && m.sampleAsset) void files.view(m.sampleAsset); };
  const canOpen = (m: Material) => Boolean(m.url) || m.kind === 'quiz' || (mock && Boolean(m.sampleAsset));
  const tile = (kind: string) => ({ page: ['PAGE', colors.info100, colors.info600], file: ['FILE', colors.green100, colors.green900], folder: ['FOLDER', colors.gold100, colors.gold600], quiz: ['QUIZ', colors.danger100, colors.danger600], live: ['BIGBLUEBUTTON', colors.green900, colors.white] } as Record<string, [string, string, string]>)[kind];
  const Chip = ({ kind }: { kind: string }) => { const [l, bg, fg] = tile(kind); return <View style={[styles.kindChip, { backgroundColor: bg }]}><Text variant="caption" color={fg} style={{ fontSize: 9, fontFamily: 'Inter-Bold' }}>{l}</Text></View>; };
  return (
    <Stack>
      <Row justify="flex-end" wrap>
        {services.instructor.ai ? <Button title="AI draft" variant="outline" size="sm" fullWidth={false} icon={<Icon name="Sparkles" size={14} color={colors.coral600} />} onPress={() => navigation.navigate(Routes.InstructorAiDraft, { sectionId: s.id })} testID="ws-ai-draft" /> : null}
        {services.instructor.ai ? <Button title="AI course builder" variant="outline" size="sm" fullWidth={false} icon={<Icon name="Wand" size={14} color={colors.coral600} />} onPress={() => navigation.navigate(Routes.InstructorAiCourse, { sectionId: s.id })} testID="ws-ai-course" /> : null}
        <Button title={allOpen === false ? 'Expand all' : 'Collapse all'} variant="ghost" size="sm" fullWidth={false} onPress={() => setAllOpen(o => (o === false ? true : false))} testID="ws-collapse-all" />
      </Row>
      {editMode ? <Card tone="gold"><Row gap={8}><Icon name="PencilLine" size={16} color={colors.gold600} /><Text variant="label">Edit mode — change text, toggle materials, then Save.</Text></Row></Card> : null}
      <Accordion title="Resources" dot open={allOpen} initiallyOpen testID="ws-resources" titleVariant="overline">
        {mock || s.description ? <Row gap={spacing.sm} style={styles.res}><Chip kind="page" /><View style={{ flex: 1 }}><Text variant="bodyStrong">Brief Course Description</Text>{editMode ? <Input value={description} onChangeText={setDescription} multiline testID="ws-description" /> : <Text variant="caption" numberOfLines={2}>{s.description}</Text>}</View></Row> : null}
        {mock || s.objectives ? <Row gap={spacing.sm} style={styles.res}><Chip kind="page" /><View style={{ flex: 1 }}><Text variant="bodyStrong">Learning Objectives</Text>{editMode ? <Input value={objectives} onChangeText={setObjectives} multiline testID="ws-objectives" /> : <Text variant="caption" numberOfLines={3}>{s.objectives}</Text>}</View></Row> : null}
        {mock ? <Row gap={spacing.sm} style={styles.res}><Chip kind="live" /><View style={{ flex: 1 }}><Text variant="bodyStrong">Online Class Link (demo room)</Text><Row gap={4}><View style={[styles.dot, { backgroundColor: s.liveRoomReady ? colors.success600 : colors.inkFaint }]} /><Text variant="caption">{s.liveRoomReady ? 'This room is ready. You can join the demo session now.' : 'Room not open'}</Text></Row></View><Button title="Join" size="sm" fullWidth={false} onPress={() => navigation.navigate(Routes.InstructorLiveRoom, { sectionId: s.id, roomId: 'main' })} testID="ws-join-room" /></Row> : <LiveClassRow sectionId={s.id} chip={<Chip kind="live" />} />}
        {mock ? <Row gap={spacing.sm} style={styles.res}><Chip kind="file" /><View style={{ flex: 1 }}><Text variant="bodyStrong">Course Syllabus</Text><Text variant="caption">{s.syllabusFile}</Text></View><Button title="Open" variant="outline" size="sm" fullWidth={false} onPress={() => files.view('syllabus')} testID="ws-syllabus" /></Row> : null}
        {mock ? ['Room 1', 'Breakout'].map(r => <Row key={r} gap={spacing.sm} style={styles.res}><Chip kind="live" /><View style={{ flex: 1 }}><Text variant="bodyStrong">Online Class Link ({r})</Text><Text variant="caption">Published · {s.enrolledCount} student(s) notified (demo).</Text></View><Button title="Join" variant="outline" size="sm" fullWidth={false} onPress={() => navigation.navigate(Routes.InstructorLiveRoom, { sectionId: s.id, roomId: r.toLowerCase().replace(' ', '') })} /></Row>) : null}
      </Accordion>
      {mock || s.evaluation.length ? <Accordion title="Evaluation criteria" dot open={allOpen} initiallyOpen testID="ws-eval" titleVariant="overline">
        <View style={styles.table}>
          <Row style={[styles.tr, styles.th]}><Text variant="overline" color={colors.white} style={{ flex: 1 }}>Component</Text><Text variant="overline" color={colors.white}>Weight</Text></Row>
          {s.evaluation.map(e => <Row key={e.label} style={styles.tr}><Text variant="bodySm" style={{ flex: 1 }}>{e.label}</Text><Text variant="label">{e.weight}%</Text></Row>)}
          <Row style={styles.tr}><Text variant="displayXs" style={{ flex: 1 }}>Total</Text><Text variant="displayXs">{s.evaluation.reduce((a, e) => a + e.weight, 0)}%</Text></Row>
        </View>
        {mock ? <Row gap={spacing.sm} style={styles.res}><Chip kind="page" /><Text variant="bodyStrong">Evaluation</Text></Row> : null}
      </Accordion> : null}
      {days.length ? days.map((d, di) => (
        <Accordion key={d.id} title={`${d.label}${d.note ? ` • ${d.note}` : ''}`} dot open={allOpen} initiallyOpen={di < 3} testID={`ws-day-${d.index}`} titleVariant="overline">
          {d.materials.map((m, mi) => (
            <Row key={m.id} gap={spacing.sm} style={styles.res}>
              <Chip kind={m.kind} />
              <View style={{ flex: 1 }}>{editMode ? <Input value={m.title} onChangeText={t => setDays(ds => ds.map((dd, i) => (i === di ? { ...dd, materials: dd.materials.map((mm, j) => (j === mi ? { ...mm, title: t } : mm)) } : dd)))} testID={`ws-material-${m.id}`} /> : <Text variant="bodyStrong">{m.title}</Text>}{m.fileName ? <Text variant="caption">{m.fileName}</Text> : null}</View>
              {editMode ? <Button title="Remove" variant="ghost" size="sm" fullWidth={false} onPress={() => setDays(ds => ds.map((dd, i) => (i === di ? { ...dd, materials: dd.materials.filter((_, j) => j !== mi) } : dd)))} /> : m.storyboard ? <Button title="Play video" variant="outline" size="sm" fullWidth={false} icon={<Icon name="Play" size={14} color={colors.green900} />} onPress={() => setVideo(m.storyboard!)} testID={`ws-video-${m.id}`} /> : canOpen(m) ? <Button title="Open" variant="outline" size="sm" fullWidth={false} onPress={() => open(m)} testID={`ws-open-${m.id}`} /> : null}
            </Row>
          ))}
          {editMode ? <Button title="+ Add material" variant="subtle" size="sm" onPress={() => setDays(ds => ds.map((dd, i) => (i === di ? { ...dd, materials: [...dd.materials, { id: `${dd.id}_m${Date.now()}`, kind: 'file', title: 'New material', fileName: 'sample.pdf', sampleAsset: 'manual' }] } : dd)))} /> : null}
        </Accordion>
      )) : <EmptyState icon="CalendarOff" title={mock ? 'No day sections' : 'No course topics published yet'} />}
      {editMode ? <Row><Button title="Discard" variant="outline" style={{ flex: 1 }} onPress={() => { setObjectives(s.objectives); setDescription(s.description); setDays(s.days); }} disabled={!dirty} /><Button title="Save changes" style={{ flex: 1 }} onPress={save} loading={saving} disabled={!dirty} disabledReason="No changes yet" testID="ws-save" /></Row> : null}
      <DemoLabel text="Materials open bundled sample files" />
      <AvatarVideoModal storyboard={video} onClose={() => setVideo(null)} />
    </Stack>
  );
}

/** BigBlueButton room for the section: live status from GET /live/sections/:id; opens the instructor room screen. */
function LiveClassRow({ sectionId, chip }: { sectionId: string; chip: React.ReactNode }) {
  const navigation = useAppNavigation();
  const st = useLiveRoom(sectionId).status.data;
  const running = st?.running === true;
  return (
    <Row gap={spacing.sm} style={styles.res}>
      {chip}
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">Online Class Link</Text>
        <Row gap={4}><View style={[styles.dot, { backgroundColor: running ? colors.success600 : colors.inkFaint }]} /><Text variant="caption">{!st ? 'Checking room…' : running ? `Live now${st.participantCount ? ` · ${st.participantCount} in the room` : ''}` : 'Not started · start the class to open the room'}</Text></Row>
      </View>
      <Button title={running ? 'Join' : 'Start'} size="sm" fullWidth={false} onPress={() => navigation.navigate(Routes.InstructorLiveRoom, { sectionId, roomId: 'main' })} testID="ws-join-room" />
    </Row>
  );
}

function ClassListTab({ sectionId }: { sectionId: string }) {
  const navigation = useAppNavigation();
  const roster = useRoster(sectionId);
  const section = useSection(sectionId);
  const files = useFileActions();
  const exportRoster = () => {
    const s = section.data!;
    const rows = (roster.data ?? []).map(u => `"${u.lastName}, ${u.firstName}",${u.student?.studentNumber},"${u.student?.programName}",${u.email}`);
    void files.exportText(`${s.course.code.replace(/\s/g, '')}-${s.sectionCode}-class-list${isMockMode() ? '-DEMO' : ''}.csv`, ['Name,Student number,Program,Email', ...rows].join('\n'));
  };
  return (
    <Stack>
      <Row justify="space-between"><Text variant="displaySm">Class List</Text><Button title="Print Class List" variant="outline" size="sm" fullWidth={false} icon={<Icon name="Printer" size={14} color={colors.green900} />} onPress={exportRoster} testID="ws-print-roster" /></Row>
      {roster.isLoading ? <LoadingState /> : roster.error ? <ErrorState error={roster.error} onRetry={() => roster.refetch()} /> : !roster.data?.length ? <EmptyState icon="Users" title="No students are currently registered in this course offering." /> : roster.data.map(u => (
        <Card key={u.id} padding={spacing.md} onPress={() => navigation.navigate(Routes.InstructorStudentProfile, { studentId: u.id })} testID={`roster-${u.id}`}>
          <Row gap={spacing.md}><Avatar initials={u.avatarInitials} bg={colors.green50} fg={colors.green900} /><View style={{ flex: 1 }}><Text variant="bodyStrong">{u.displayName}</Text><Text variant="caption">{u.student?.studentNumber} · {u.student?.programName}</Text><Text variant="caption" numberOfLines={1}>{u.email}</Text></View><Icon name="ChevronRight" size={18} color={colors.inkMuted} /></Row>
        </Card>
      ))}
      <Text variant="caption">Print opens the iOS share sheet with a generated CSV (AirPrint is available from the share sheet).</Text>
    </Stack>
  );
}

const styles = StyleSheet.create({
  res: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
  kindChip: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, minWidth: 44, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  table: { borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  tr: { paddingHorizontal: spacing.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  th: { backgroundColor: colors.green900 },
});
export { ListRow, Checkbox };
