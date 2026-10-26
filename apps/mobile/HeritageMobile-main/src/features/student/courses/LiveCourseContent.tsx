import React, { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, Icon, Accordion, ProgressBar, EmptyState, type IconName } from '../../../components';
import { colors, spacing } from '../../../theme';
import { appConfig } from '../../../config/appConfig';
import { Routes } from '../../../navigation/routes';
import { useAppNavigation } from '../../../navigation/hooks';
import { formatDate } from '../../../utils/format';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';
import type { CourseActivity } from '../../../services/contracts';
import type { SectionWithCourse } from '../../../services/contracts';
import type { AiDraftStoryboard } from '../../../domain/types';
import { viewFile } from '../../shared/files';
import { AvatarVideoModal } from '../../shared/AvatarVideoPlayer';
import { useCourseAssessments, useCourseContent, useCourseLearning, useCourseLms, useLiveRoom, useMarkComplete, useSyllabus } from './useCourseLearning';

/** Absolute URL for an API-provided https or site-relative web link. */
function linkUrl(href?: string): string | undefined {
  if (!href) return undefined;
  if (/^https:\/\//i.test(href)) return href;
  return href.startsWith('/') && !href.startsWith('//') && appConfig.webOrigin ? `${appConfig.webOrigin}${href}` : undefined;
}

const openLink = (url: string) => void Linking.openURL(url).catch(() => toast('Could not open this link.', 'error'));

const TYPE_ICON: Record<string, IconName> = { QUIZ: 'FileQuestion', CHOICE: 'ListChecks', FILE: 'FileDown', RESOURCE: 'FileDown', FOLDER: 'Folder', URL: 'Link', BIGBLUEBUTTON: 'Video', ASSIGN: 'ClipboardList', FORUM: 'MessagesSquare', PAGE: 'FileText' };

/** Live-mode course content for an enrolled section (LMS + content progress endpoints). */
export function LiveCourseContent({ section: s }: { section: SectionWithCourse }) {
  const sectionId = s.id;
  const navigation = useAppNavigation();
  const cl = useCourseLearning();
  const lms = useCourseLms(sectionId);
  const content = useCourseContent(sectionId);
  const syllabus = useSyllabus(sectionId);
  const assessments = useCourseAssessments(sectionId).list;
  const live = useLiveRoom(sectionId, Boolean(lms.data?.liveSectionId)).status;
  const complete = useMarkComplete(sectionId);
  const [busy, setBusy] = useState<string | null>(null);
  const [video, setVideo] = useState<AiDraftStoryboard | null>(null);

  const download = async (key: string, fetchFile: () => Promise<{ path: string; name: string; mime: string }>) => {
    setBusy(key);
    try {
      const f = await fetchFile();
      await viewFile(f.path, f.mime, f.name);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };
  const markDone = async (itemId: string) => {
    try {
      await complete.mutateAsync(itemId);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  if (lms.isLoading) return <LoadingState />;
  const d = lms.data;
  if (!d) return <ErrorState error={lms.error} onRetry={() => lms.refetch()} />;

  const liveId = d.liveSectionId;
  const liveSt = live.data;
  const description = syllabus.data?.description || s.description;
  const labs = (content.data?.items ?? []).filter(i => i.kind === 'lab');
  const resources: { id: string; title: string; sub: string; icon: IconName; action: () => void; cta: string; primary?: boolean; loading?: boolean }[] = [
    ...(description ? [{ id: 'desc', title: 'Brief Course Description', sub: description, icon: 'FileText' as const, cta: 'Open', action: () => navigation.navigate(Routes.StudentLearningObjectives, { sectionId }) }] : []),
    ...(d.syllabus.length ? [{ id: 'obj', title: 'Learning Objectives', sub: `${d.syllabus.length} topic${d.syllabus.length === 1 ? '' : 's'}`, icon: 'Target' as const, cta: 'Open', action: () => navigation.navigate(Routes.StudentLearningObjectives, { sectionId }) }] : []),
    ...(syllabus.data?.available ? [{ id: 'syl', title: 'Course Syllabus', sub: syllabus.data.name || 'Syllabus', icon: 'FileDown' as const, cta: 'Download', loading: busy === 'syllabus', action: () => void download('syllabus', () => cl.downloadSyllabus(sectionId)) }] : []),
    ...(liveId ? [{ id: 'live', title: 'Live Class', sub: !liveSt ? 'BigBlueButton classroom' : !liveSt.canJoin ? 'Closed · recordings available' : liveSt.running ? 'Live now · Tap to join' : liveSt.running === null ? 'Online classroom' : 'Room not open', icon: 'Video' as const, cta: 'Join', primary: true, action: () => navigation.navigate(Routes.StudentLiveRoom, { sectionId: liveId, roomId: 'main' }) }] : []),
    ...(assessments.data?.length ? [{ id: 'assess', title: 'Assessments', sub: `${assessments.data.length} timed quiz/exam${assessments.data.length === 1 ? '' : 's'}`, icon: 'ClipboardCheck' as const, cta: 'Open', action: () => navigation.navigate(Routes.StudentCourseAssessments, { sectionId }) }] : []),
    ...(labs.length ? [{ id: 'notes', title: 'My Lab Notes', sub: `${labs.length} lab notebook${labs.length === 1 ? '' : 's'}`, icon: 'NotebookPen' as const, cta: 'Open', action: () => navigation.navigate(Routes.StudentCourseNotes, { sectionId }) }] : []),
  ];

  const activityAction = (a: CourseActivity): { cta: string; run: () => void } | null => {
    if (a.storyboard) return { cta: 'Play video', run: () => setVideo(a.storyboard!) };
    if (a.type === 'QUIZ') return { cta: a.quizAttempt ? 'View result' : a.gradable ? 'Start Quiz' : 'View', run: () => navigation.navigate(Routes.StudentCourseQuiz, { sectionId, materialId: a.id }) };
    if (a.type === 'CHOICE' && a.choice) return { cta: a.choice.response ? 'View' : 'Respond', run: () => navigation.navigate(Routes.StudentCourseQuiz, { sectionId, materialId: a.id }) };
    if (a.type === 'BIGBLUEBUTTON') {
      const target = a.liveSectionId ?? liveId;
      if (target) return { cta: 'Join', run: () => navigation.navigate(Routes.StudentLiveRoom, { sectionId: target, roomId: a.id }) };
      const url = linkUrl(a.joinUrl);
      return url ? { cta: 'Join', run: () => openLink(url) } : null;
    }
    if (a.assignmentId) return { cta: 'Open', run: () => navigation.navigate(Routes.StudentAssignmentDetails, { assignmentId: a.assignmentId! }) };
    if (a.fileId) return { cta: 'Download', run: () => void download(a.id, () => cl.downloadFile(sectionId, a.fileId!)) };
    if (a.url) return { cta: 'Open', run: () => openLink(a.url!) };
    if (a.body || a.description || a.note) return { cta: 'Open', run: () => navigation.navigate(Routes.StudentCourseQuiz, { sectionId, materialId: a.id }) };
    return null;
  };

  const topics = d.topics.filter(t => t.activities.length);
  const items = content.data?.items ?? [];
  return (
    <Stack>
      {content.data && content.data.totalCount ? (
        <Card padding={spacing.md} testID="course-progress">
          <Row justify="space-between"><Text variant="label">Course progress</Text><Text variant="mono">{content.data.completedCount} / {content.data.totalCount} · {content.data.progressPct}%</Text></Row>
          <View style={{ marginTop: 6 }}><ProgressBar value={content.data.progressPct} /></View>
        </Card>
      ) : null}
      {resources.length ? (
        <Accordion title="Resources" subtitle={`${resources.length} item${resources.length === 1 ? '' : 's'}`} dot initiallyOpen testID="course-resources" titleVariant="overline">
          {resources.map(r => (
            <Row key={r.id} gap={spacing.md} style={styles.row}>
              <Tile icon={r.icon} />
              <View style={{ flex: 1 }}><Text variant="bodyStrong">{r.title}</Text><Row gap={4}>{r.id === 'live' && liveSt?.running ? <View style={styles.greenDot} /> : null}<Text variant="caption" numberOfLines={1} style={{ flex: 1 }}>{r.sub}</Text></Row></View>
              <Button title={r.cta} variant={r.primary ? 'primary' : 'outline'} size="sm" fullWidth={false} onPress={r.action} loading={r.loading} testID={`resource-${r.id}`} />
            </Row>
          ))}
        </Accordion>
      ) : null}
      {d.gradeScheme.length ? (
        <Accordion title="Evaluation criteria" dot initiallyOpen testID="course-eval" titleVariant="overline">
          {d.gradeScheme.map(g => <Row key={g.title} justify="space-between" style={styles.row}><Text variant="bodySm" style={{ flex: 1 }}>{g.title}</Text><Text variant="label">{g.weightPercent}%</Text></Row>)}
          <Row justify="space-between" style={styles.row}><Text variant="label">Total course weight</Text><Text variant="label">{d.gradeScheme.reduce((a, g) => a + g.weightPercent, 0)}%</Text></Row>
        </Accordion>
      ) : null}
      {items.length ? (
        <Accordion title="Classes & coursework" subtitle={`${items.length} item${items.length === 1 ? '' : 's'}`} dot initiallyOpen testID="course-items" titleVariant="overline">
          {items.map(i => (
            <Row key={i.id} gap={spacing.md} style={styles.row}>
              <Tile icon={i.kind === 'lab' ? 'FlaskConical' : i.kind === 'lecture' ? 'Presentation' : 'ClipboardList'} done={i.completed} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" numberOfLines={2}>{i.title}</Text>
                <Text variant="caption" numberOfLines={1}>{i.startsAt ? `${formatDate(i.startsAt)}${i.location ? ` · ${i.location}` : ''}` : i.dueAt ? `Due ${formatDate(i.dueAt)}` : ''}{i.completed ? ' · Completed' : ''}</Text>
              </View>
              {i.sessionId ? <Button title="Open" variant="outline" size="sm" fullWidth={false} onPress={() => navigation.navigate(Routes.StudentCourseLecture, { sectionId, sessionId: i.sessionId! })} testID={`item-${i.id}`} />
                : i.assignmentId ? <Button title="Open" variant="outline" size="sm" fullWidth={false} onPress={() => navigation.navigate(Routes.StudentAssignmentDetails, { assignmentId: i.assignmentId! })} testID={`item-${i.id}`} />
                  : null}
              {!i.completed ? <CompleteButton onPress={() => markDone(i.id)} loading={complete.isPending && complete.variables === i.id} testID={`complete-${i.id}`} /> : null}
            </Row>
          ))}
        </Accordion>
      ) : null}
      {d.dayBlocks.map(b => (
        <Accordion key={b.id} title={`${b.label.toUpperCase()}${b.title ? ` • ${b.title}` : ''}`} subtitle={`${b.lessons.length} lesson${b.lessons.length === 1 ? '' : 's'}`} dot initiallyOpen testID={`course-day-${b.id}`} titleVariant="overline">
          {b.lessons.map(l => {
            const url = linkUrl(l.href);
            const itemId = `lesson:${l.id}`;
            return (
              <Row key={l.id} gap={spacing.md} style={styles.row} align="flex-start">
                <Tile icon="BookOpen" done={l.completed} />
                <View style={{ flex: 1 }}><Text variant="bodyStrong">{l.title}</Text>{l.body ? <Text variant="caption">{l.body}</Text> : null}</View>
                {url ? <Button title="Open" variant="outline" size="sm" fullWidth={false} onPress={() => openLink(url)} testID={`lesson-${l.id}`} /> : null}
                {!l.completed ? <CompleteButton onPress={() => markDone(itemId)} loading={complete.isPending && complete.variables === itemId} testID={`complete-${itemId}`} /> : null}
              </Row>
            );
          })}
        </Accordion>
      ))}
      {d.folders.map(f => (
        <Accordion key={f.id} title={f.name.toUpperCase()} subtitle={`${f.items.length} file${f.items.length === 1 ? '' : 's'}`} dot testID={`course-folder-${f.id}`} titleVariant="overline">
          {f.items.map(it => {
            const url = linkUrl(it.href);
            return (
              <Row key={it.id} gap={spacing.md} style={styles.row}>
                <Tile icon={it.kind === 'folder' ? 'Folder' : 'FileText'} />
                <View style={{ flex: 1 }}><Text variant="bodyStrong" numberOfLines={2}>{it.title}</Text>{it.sizeLabel ? <Text variant="caption">{it.sizeLabel}</Text> : null}</View>
                {url ? <Button title="Open" variant="outline" size="sm" fullWidth={false} onPress={() => openLink(url)} testID={`folder-item-${it.id}`} /> : null}
              </Row>
            );
          })}
        </Accordion>
      ))}
      {topics.map((t, ti) => (
        <Accordion key={t.id} title={t.title.toUpperCase()} subtitle={t.summary || `${t.activities.length} activit${t.activities.length === 1 ? 'y' : 'ies'}`} dot initiallyOpen={ti < 3} testID={`course-topic-${t.id}`} titleVariant="overline">
          {t.activities.map(a => {
            const act = activityAction(a);
            return (
              <Row key={a.id} gap={spacing.md} style={styles.row}>
                <Tile icon={TYPE_ICON[a.type] ?? 'FileText'} coral={a.type === 'QUIZ'} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" numberOfLines={2}>{a.name}</Text>
                  <Row gap={4} wrap>
                    <Text variant="caption">{a.type === 'BIGBLUEBUTTON' ? 'Online class' : a.type.charAt(0) + a.type.slice(1).toLowerCase()}{a.fileName ? ` · ${a.fileName}` : ''}</Text>
                    {a.quizAttempt ? <Pill label={`${a.quizAttempt.score}/${a.quizAttempt.maxScore}`} tone="green" small /> : null}
                    {a.choice?.response ? <Pill label="Responded" tone="green" small /> : null}
                  </Row>
                </View>
                {act ? <Button title={act.cta} variant={a.type === 'QUIZ' ? 'coral' : a.type === 'BIGBLUEBUTTON' ? 'primary' : 'outline'} size="sm" fullWidth={false} onPress={act.run} loading={busy === a.id} testID={`activity-${a.id}`} /> : null}
              </Row>
            );
          })}
        </Accordion>
      ))}
      {!items.length && !d.dayBlocks.length && !d.folders.length && !topics.length ? <EmptyState icon="CalendarOff" title="No course content yet" message="Your instructor has not published materials for this section yet." /> : null}
      <AvatarVideoModal storyboard={video} onClose={() => setVideo(null)} />
    </Stack>
  );
}

function Tile({ icon, done, coral }: { icon: IconName; done?: boolean; coral?: boolean }) {
  return (
    <View style={[styles.tile, { backgroundColor: done ? colors.green100 : coral ? colors.coral100 : colors.info100 }]}>
      <Icon name={done ? 'CircleCheck' : icon} size={18} color={done ? colors.success600 : coral ? colors.coral600 : colors.green900} />
    </View>
  );
}

function CompleteButton({ onPress, loading, testID }: { onPress: () => void; loading?: boolean; testID?: string }) {
  return <Button title="Done" accessibilityLabel="Mark complete" variant="ghost" size="sm" fullWidth={false} onPress={onPress} loading={loading} icon={<Icon name="Check" size={14} color={colors.green900} />} testID={testID} />;
}

const styles = StyleSheet.create({
  row: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  tile: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  greenDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success600 },
});
