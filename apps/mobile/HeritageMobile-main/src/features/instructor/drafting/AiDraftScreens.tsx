import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, Icon, Input, Select, LoadingState, ErrorState, EmptyState, ChipRow, DemoLabel, InfoBanner, ConfirmSheet, InlineError } from '../../../components';
import { colors, spacing, fonts } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useLessonCourses, useLessonPlans, useLessonPlan, useLessonMutations, useAiDraftCourses, useAiDraftTopics, useAiDraftMutations } from '../useInstructor';
import { useFileActions } from '../../shared/useFileActions';
import { useUnsavedChangesGuard } from '../../shared/hooks';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';
import type { LessonPlan } from '../../../domain/types';
import type { AiDraftQuizItem, AiDraftResult } from '../../../services/contracts/instructor';
import { useServices } from '../../../app/ServicesProvider';
import { MarkdownText } from '../../shared/MarkdownText';
import { HtmlView } from '../../shared/HtmlView';
import { AvatarVideoPlayer } from '../../shared/AvatarVideoPlayer';
import { formatDateTime } from '../../../utils/format';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const quizHtml = (quiz: AiDraftQuizItem[]) => (quiz.length ? `<h3>Check your understanding</h3><ol>${quiz.map(q => `<li><p>${esc(q.question)}</p><ol>${q.options.map(o => `<li>${esc(o)}</li>`).join('')}</ol><details><summary>Show answer</summary><p>${esc(q.options[q.answer] ?? '')}</p></details></li>`).join('')}</ol>` : '');

export function AiDraftScreen(props: RootScreenProps<'InstructorAiDraft'>) {
  return useServices().instructor.ai ? <LiveAiDraftScreen {...props} /> : <MockAiDraftScreen {...props} />;
}

function LiveAiDraftScreen({ navigation, route }: RootScreenProps<'InstructorAiDraft'>) {
  const courses = useAiDraftCourses();
  const [sectionId, setSectionId] = useState(route.params?.sectionId ?? '');
  useEffect(() => { if (!sectionId && courses.data?.length) setSectionId(courses.data[0].sectionId); }, [courses.data, sectionId]);
  const topics = useAiDraftTopics(sectionId);
  const [topicId, setTopicId] = useState(route.params?.topicId ?? '');
  const topic = topics.data?.find(t => t.id === topicId);
  useEffect(() => { if (!topic && topics.data?.length) setTopicId(topics.data[0].id); }, [topic, topics.data]);
  const m = useAiDraftMutations(sectionId);
  const [lessonTitle, setLessonTitle] = useState('');
  const [minutes, setMinutes] = useState('20');
  const [slides, setSlides] = useState('6');
  const [withQuiz, setWithQuiz] = useState(true);
  const [draft, setDraft] = useState<AiDraftResult | null>(null);
  const course = courses.data?.find(c => c.sectionId === sectionId);
  const pickCourse = (id: string) => { setSectionId(id); setTopicId(''); setDraft(null); m.generate.reset(); };
  const generate = async () => {
    if (!topic) return;
    const r = await m.generate.mutateAsync({ topic, lessonTitle, minutes: Number(minutes) || 20, slides: Number(slides) || 6 }).catch(() => null);
    if (!r) return;
    setDraft(r);
    if (!lessonTitle.trim()) setLessonTitle(r.lessonTitle);
  };
  const add = async () => {
    if (!draft || !topic) return;
    try {
      await m.add.mutateAsync({ topicId: topic.id, name: lessonTitle.trim() || draft.lessonTitle, html: draft.lessonHtml + (withQuiz ? quizHtml(draft.quiz) : ''), storyboard: draft.storyboard });
      toast(`Added to ${topic.title}`, 'success');
      setDraft(null);
      setLessonTitle('');
      navigation.navigate(Routes.InstructorCourseWorkspace, { sectionId });
    } catch (e) { toast(errorMessage(e), 'error'); }
  };
  return (
    <Screen testID="ai-draft" header={<ScreenHeader />}>
      <Stack>
        <Text variant="overline">Teacher · Curriculum AI</Text>
        <Text variant="titleLg" style={{ fontSize: 24 }}>AI Draft</Text>
        <Text variant="body">Pick one of your courses. AI Draft writes a lesson, a practice quiz and a narrated video slideshow from that course's catalogue record and topics, and adds it to the topic you choose — students see it on their course page.</Text>
        {courses.isLoading ? <LoadingState label="Loading your courses…" /> : courses.error ? <ErrorState error={courses.error} onRetry={() => courses.refetch()} /> : !courses.data?.length ? <EmptyState icon="BookOpen" title="You are not assigned to any active course sections." /> : (
          <Stack gap={spacing.sm}>
            <Select label="Course" value={sectionId} onChange={pickCourse} options={courses.data.map(c => ({ value: c.sectionId, label: `${c.code} · ${c.title}`, description: [c.section, c.dates, c.enrolment].filter(Boolean).join(' · ') }))} testID="draft-course" />
            {course ? <Row><Button title="AI course builder" variant="outline" size="sm" fullWidth={false} icon={<Icon name="Wand" size={14} color={colors.green900} />} onPress={() => navigation.navigate(Routes.InstructorAiCourse, { sectionId })} testID="draft-course-builder" /><Button title="Open course" variant="ghost" size="sm" fullWidth={false} onPress={() => navigation.navigate(Routes.InstructorCourseWorkspace, { sectionId })} testID="draft-open-course" /></Row> : null}
            {topics.isLoading ? <LoadingState /> : topics.error ? <ErrorState error={topics.error} onRetry={() => topics.refetch()} /> : !topics.data?.length ? <EmptyState icon="FileText" title="This course has no topics yet" /> : (
              <Card padding={spacing.md}>
                <Stack gap={spacing.sm}>
                  <Select label="Topic" value={topicId} onChange={v => { setTopicId(v); setDraft(null); }} options={topics.data.map(t => ({ value: t.id, label: t.title }))} testID="draft-topic" />
                  <Input label="Lesson title" value={lessonTitle} placeholder={topic ? `e.g. ${topic.title} — key concepts` : 'Lesson title'} onChangeText={setLessonTitle} testID="draft-lesson-title" />
                  <Row align="flex-start">
                    <View style={{ flex: 1 }}><Input label="Minutes of study" keyboardType="number-pad" value={minutes} onChangeText={setMinutes} testID="draft-minutes" /></View>
                    <View style={{ flex: 1 }}><Input label="Video slides" keyboardType="number-pad" value={slides} onChangeText={setSlides} testID="draft-slides" /></View>
                  </Row>
                  <Select label="Practice quiz" value={withQuiz ? 'yes' : 'no'} onChange={v => setWithQuiz(v === 'yes')} options={[{ value: 'yes', label: 'Include in lesson' }, { value: 'no', label: 'Leave out' }]} testID="draft-quiz" />
                  <Text variant="caption">The AI writes from this course's catalogue record (code, title, description, hours), the selected topic and its existing activities. Review the draft before adding it — it is added to the topic as a page with a narrated video slideshow that students can play.</Text>
                  <Button title={m.generate.isPending ? 'Generating with AI… (about 10–30 s)' : draft ? 'Regenerate' : 'Generate with AI'} variant="gold" icon={<Icon name="Sparkles" size={16} color={colors.green900} />} loading={m.generate.isPending} disabled={!topic || m.generate.isPending} onPress={() => void generate()} testID="draft-generate" />
                  {m.generate.error ? <InlineError error={m.generate.error} /> : null}
                </Stack>
              </Card>
            )}
            {draft ? (
              <Stack gap={spacing.sm}>
                <Row justify="space-between" wrap>
                  <Text variant="caption" style={{ flex: 1 }}>{draft.grounding.course}{draft.grounding.term ? ` · ${draft.grounding.term}` : ''}</Text>
                  <Pill label={`${draft.storyboard.slides.length} slides · ~${Math.max(1, Math.round(draft.storyboard.estimated_duration_sec / 60))} min · ${draft.quiz.length} quiz questions`} tone="gold" small />
                </Row>
                <AvatarVideoPlayer key={draft.storyboard.slides.map(s => s.heading).join('|')} storyboard={draft.storyboard} testID="draft-video" />
                <Card padding={0} style={{ overflow: 'hidden' }}><HtmlView html={draft.lessonHtml + (withQuiz ? quizHtml(draft.quiz) : '')} testID="draft-lesson-html" /></Card>
                {!draft.grounding.hasDescription ? <Text variant="caption">This course has no description in Course Management yet, so the draft is based on the course title and topic only.</Text> : null}
                <Button title={m.add.isPending ? 'Adding…' : `Add to ${topic?.title ?? 'topic'}`} loading={m.add.isPending} disabled={!topic || m.add.isPending} onPress={() => void add()} testID="draft-add" />
              </Stack>
            ) : null}
          </Stack>
        )}
      </Stack>
    </Screen>
  );
}

function MockAiDraftScreen({ navigation, route }: RootScreenProps<'InstructorAiDraft'>) {
  const courses = useLessonCourses();
  const [courseId, setCourseId] = useState(route.params?.courseId ?? '');
  useEffect(() => { if (!courseId && courses.data?.length) setCourseId(courses.data[0].id); }, [courses.data, courseId]);
  const lessons = useLessonPlans(courseId);
  const course = courses.data?.find(c => c.id === courseId);
  return (
    <Screen testID="ai-draft" header={<ScreenHeader />}>
      <Stack>
        <Text variant="overline">Teacher · Curriculum AI</Text>
        <Text variant="titleLg" style={{ fontSize: 24 }}>AI Draft</Text>
        <Text variant="body">{isMockMode() ? 'Generate lesson plans and quizzes from editable local templates. Samples are local — no external lesson AI API calls, and no generated avatar video or voice.' : 'Draft lesson plans and quizzes for your courses. Lesson authoring and publishing are available on the Campus One website.'}</Text>
        {courses.isLoading ? <LoadingState /> : <ChipRow options={(courses.data ?? []).map(c => ({ value: c.id, label: c.title }))} value={courseId} onChange={setCourseId} testID="draft-course" />}
        {course ? <Text variant="titleMd">{course.title}</Text> : null}
        {lessons.isLoading ? <LoadingState /> : lessons.error ? <ErrorState error={lessons.error} onRetry={() => lessons.refetch()} /> : !lessons.data?.length ? <EmptyState icon="FileText" title="No lessons yet" /> : lessons.data.map(l => (
          <Card key={l.id} padding={spacing.md} testID={`lesson-${l.id}`}>
            <Row justify="space-between">
              <View style={{ flex: 1 }}><Text variant="bodyStrong">{l.title}</Text><Row gap={6}><Text variant="caption">{l.contentType.toLowerCase()} · {l.readMinutes} min read</Text>{l.published ? <Pill label={l.published.content === l.content ? 'Published' : 'Draft differs'} tone={l.published.content === l.content ? 'green' : 'yellow'} small /> : <Pill label="Draft only" tone="grey" small />}</Row></View>
              <Button title="Edit lesson" size="sm" fullWidth={false} onPress={() => navigation.navigate(Routes.InstructorEditLesson, { lessonId: l.id })} testID={`lesson-edit-${l.id}`} />
            </Row>
          </Card>
        ))}
        <Text variant="caption">{isMockMode() ? `${lessons.data?.length ?? 0} sample lessons ready · local drafts only` : `${lessons.data?.length ?? 0} lessons`}</Text>
        <DemoLabel text="Deterministic templates · simulated generation" />
      </Stack>
    </Screen>
  );
}

const CONTENT_TYPES: LessonPlan['contentType'][] = ['Text article', 'Video', 'Slides', 'PDF'];

export function EditLessonScreen({ navigation, route }: RootScreenProps<'InstructorEditLesson'>) {
  const { lessonId } = route.params;
  const q = useLessonPlan(lessonId);
  const m = useLessonMutations(q.data?.courseId);
  const files = useFileActions();
  const [form, setForm] = useState<LessonPlan | null>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [generating, setGenerating] = useState<'lesson' | 'quiz' | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const inputRef = useRef<React.ElementRef<typeof TextInput>>(null);
  useEffect(() => { if (q.data && !form) setForm(q.data); }, [q.data, form]);
  const dirty = !!form && !!q.data && JSON.stringify(form) !== JSON.stringify(q.data);
  const { allowLeave } = useUnsavedChangesGuard(dirty);
  if (q.isLoading || !form) return <Screen header={<ScreenHeader title="Edit lesson plan" />}><LoadingState /></Screen>;
  if (q.error) return <Screen header={<ScreenHeader title="Edit lesson plan" />}><ErrorState error={q.error} /></Screen>;
  const set = <K extends keyof LessonPlan>(k: K, v: LessonPlan[K]) => setForm(f => (f ? { ...f, [k]: v } : f));
  /** Formatting controls operate on the current selection with markdown markers (native editor, no WebView). */
  const wrap = (before: string, after = before) => {
    const { start, end } = selection;
    const c = form.content;
    const sel = c.slice(start, end) || 'text';
    set('content', c.slice(0, start) + before + sel + after + c.slice(end));
    inputRef.current?.focus();
  };
  const prefixLine = (prefix: string) => {
    const { start } = selection;
    const c = form.content;
    const lineStart = c.lastIndexOf('\n', start - 1) + 1;
    set('content', c.slice(0, lineStart) + prefix + c.slice(lineStart));
    inputRef.current?.focus();
  };
  const generate = async (kind: 'lesson' | 'quiz') => {
    setGenerating(kind);
    try {
      const r = await m.generate.mutateAsync({ lessonId, kind });
      set('content', kind === 'quiz' ? `${form.content}\n\n${r.content}` : r.content);
      toast('Template inserted — review before saving/publishing', 'success');
    } catch (e) { toast(errorMessage(e), 'error'); } finally { setGenerating(null); }
  };
  const save = async () => {
    try { await m.save.mutateAsync(form); allowLeave(); toast('Lesson plan saved (draft)', 'success'); navigation.goBack(); } catch (e) { toast(errorMessage(e), 'error'); }
  };
  const publish = async () => {
    try { await m.save.mutateAsync(form); await m.publish.mutateAsync(lessonId); allowLeave(); setPublishOpen(false); toast(isMockMode() ? 'Draft published to students (demo boundary)' : 'Draft published to students', 'success'); navigation.replace(Routes.InstructorLessonPreview, { lessonId }); } catch (e) { toast(errorMessage(e), 'error'); }
  };
  return (
    <Screen testID="edit-lesson" header={<ScreenHeader backLabel="Edit lesson plan" actions={[{ icon: 'Eye', accessibilityLabel: 'Preview published version', onPress: () => navigation.navigate(Routes.InstructorLessonPreview, { lessonId }), testID: 'lesson-preview' }]} />} footer={<Row><Button title="Cancel" variant="subtle" style={{ flex: 1 }} onPress={() => navigation.goBack()} testID="lesson-cancel" /><Button title="Save lesson plan" style={{ flex: 1.4 }} onPress={save} loading={m.save.isPending} testID="lesson-save" /></Row>}>
      <Stack>
        <Input label="Lesson title" value={form.title} onChangeText={t => set('title', t)} testID="lesson-title" />
        <Row>
          <View style={{ flex: 1.4 }}><Select label="Content type" value={form.contentType} onChange={v => set('contentType', v)} options={CONTENT_TYPES.map(t => ({ value: t, label: t }))} testID="lesson-type" /></View>
          <View style={{ flex: 0.6 }}><Input label="Order" keyboardType="number-pad" value={String(form.order)} onChangeText={t => set('order', Number(t) || 0)} testID="lesson-order" /></View>
        </Row>
        <Text variant="overline" color={colors.warning600}>Required for diploma programs</Text>
        <Input label="Minutes allotted" placeholder="e.g. 45" keyboardType="number-pad" value={form.minutes ? String(form.minutes) : ''} onChangeText={t => set('minutes', t ? Number(t) : undefined)} helper={isMockMode() ? 'Estimated focused study time for this lesson. The demo chapter time-gate uses the sum of all lesson minutes within a chapter to determine when the next chapter unlocks (demo policy, not an approved rule).' : 'Estimated focused study time for this lesson.'} testID="lesson-minutes" />
        <Text variant="label">Lesson plan content</Text>
        <View style={styles.editor}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbar} keyboardShouldPersistTaps="always">
            {([['H2', () => prefixLine('## ')], ['H3', () => prefixLine('### ')], ['B', () => wrap('**')], ['I', () => wrap('_')], ['U', () => wrap('__')], ['•', () => prefixLine('- ')], ['1.', () => prefixLine('1. ')]] as const).map(([label, fn]) => (
              <Pressable key={label} accessibilityRole="button" accessibilityLabel={`Format ${label}`} onPress={fn} style={styles.tool} testID={`fmt-${label}`}><Text variant="label" style={label === 'I' ? { fontStyle: 'italic' } : label === 'U' ? { textDecorationLine: 'underline' } : null}>{label}</Text></Pressable>
            ))}
            <Pressable accessibilityRole="button" accessibilityLabel="Insert link" onPress={() => wrap('[', '](https://example.edu)')} style={styles.tool} testID="fmt-link"><Icon name="Link" size={16} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Insert image placeholder" onPress={() => wrap('![', '](image.png)')} style={styles.tool} testID="fmt-image"><Icon name="Image" size={16} /></Pressable>
          </ScrollView>
          <Row style={{ padding: spacing.sm }} wrap>
            <Button title={generating === 'lesson' ? 'Generating…' : 'AI: Generate lesson plan'} variant="outline" size="sm" fullWidth={false} icon={<Icon name="Sparkles" size={14} color={colors.coral600} />} onPress={() => generate('lesson')} loading={generating === 'lesson'} disabled={!!generating} testID="ai-lesson" />
            <Button title={generating === 'quiz' ? 'Generating…' : 'AI: Create quiz'} variant="outline" size="sm" fullWidth={false} icon={<Icon name="Sparkles" size={14} color={colors.coral600} />} onPress={() => generate('quiz')} loading={generating === 'quiz'} disabled={!!generating} testID="ai-quiz" />
          </Row>
          {generating ? <InfoBanner tone="gold" icon="LoaderCircle" text={isMockMode() ? 'Simulated generation in progress — a local template is being prepared. No external AI service is contacted.' : 'Generating a draft…'} /> : null}
          <TextInput ref={inputRef} testID="lesson-content" accessibilityLabel="Lesson plan content" multiline value={form.content} onChangeText={t => set('content', t)} onSelectionChange={e => setSelection(e.nativeEvent.selection)} placeholder={form.attachment ? 'This lesson is currently shown as the original PDF. Convert it to editable text or type content here.' : 'Write the lesson content…'} placeholderTextColor={colors.inkFaint} style={styles.textarea} />
        </View>
        {form.attachment ? (
          <Card padding={spacing.md}>
            <Row gap={spacing.sm}><View style={styles.pdf}><Icon name="FileText" size={18} color={colors.coral600} /></View><View style={{ flex: 1 }}><Text variant="bodyStrong" numberOfLines={1}>{form.attachment.name}</Text><Text variant="caption">{form.attachment.pages} pages · {form.attachment.sizeLabel} · Original textbook PDF{isMockMode() ? ' (sample)' : ''}</Text></View>{isMockMode() ? <Button title="Open PDF" size="sm" fullWidth={false} onPress={() => files.view(form.attachment!.sampleAsset)} testID="lesson-open-pdf" /> : null}</Row>
            <Text variant="caption" style={{ marginTop: spacing.sm, fontStyle: 'italic' }}>This lesson is currently shown as the original PDF. Use "AI: Generate lesson plan" to create editable text from a local template (the demo has no PDF conversion service).</Text>
            <Button title="Remove attachment" variant="ghost" size="sm" onPress={() => set('attachment', undefined)} />
          </Card>
        ) : null}
        <Card tone="muted" padding={spacing.md}>
          <Row justify="space-between"><View style={{ flex: 1 }}><Text variant="label">Publish boundary</Text><Text variant="caption">{form.published ? `Published ${formatDateTime(form.published.publishedAt)}${form.published.content !== form.content || form.published.title !== form.title ? ' · draft has unpublished changes' : ' · up to date'}` : 'Never published — students see nothing yet'}</Text></View><Button title="Publish…" variant="outline" size="sm" fullWidth={false} onPress={() => setPublishOpen(true)} testID="lesson-publish" /></Row>
        </Card>
        <DemoLabel text="Native markdown editor · no WebView" />
      </Stack>
      <ConfirmSheet visible={publishOpen} onClose={() => setPublishOpen(false)} onConfirm={publish} title="Publish this draft?" message="The current draft will be saved and copied to the student-visible version. Review the content first — AI templates are not verified." confirmLabel="Save & publish" icon="Send" loading={m.publish.isPending || m.save.isPending} testID="lesson-publish-sheet" />
    </Screen>
  );
}

/** Inferred: shows what students see (published version) vs the current draft. */
export function LessonPreviewScreen({ navigation, route }: RootScreenProps<'InstructorLessonPreview'>) {
  const q = useLessonPlan(route.params.lessonId);
  const l = q.data;
  return (
    <Screen testID="lesson-preview" header={<ScreenHeader title="Preview" subtitle="Student-visible version" />}>
      {q.isLoading ? <LoadingState /> : !l ? <ErrorState error={q.error} /> : (
        <Stack>
          <DemoLabel text="Inferred preview screen" />
          <Row><Pill label={l.published ? 'Published' : 'Not published'} tone={l.published ? 'green' : 'grey'} small />{l.published && (l.published.content !== l.content || l.published.title !== l.title) ? <Pill label="Draft differs" tone="yellow" small /> : null}</Row>
          <Card>
            <Text variant="displaySm">{l.published?.title ?? l.title}</Text>
            <Text variant="caption" style={{ marginBottom: spacing.sm }}>{l.published ? `Published ${formatDateTime(l.published.publishedAt)}` : 'Students cannot see this lesson yet.'}</Text>
            {l.published ? <MarkdownText text={l.published.content || '_(empty)_'} /> : <Text variant="bodySm">Publish from the editor to make it visible.</Text>}
          </Card>
          {l.published && l.published.content !== l.content ? <Card tone="gold"><Text variant="overline" style={{ marginBottom: 4 }}>Unpublished draft</Text><MarkdownText text={l.content} /></Card> : null}
          <Button title="Back to editor" variant="outline" onPress={() => navigation.goBack()} />
        </Stack>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  editor: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, overflow: 'hidden' },
  toolbar: { flexDirection: 'row', gap: 4, padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  tool: { minWidth: 40, height: 40, borderRadius: 8, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  textarea: { minHeight: 180, padding: spacing.md, fontFamily: fonts.sans, fontSize: 15, color: colors.ink, textAlignVertical: 'top' },
  pdf: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.coral50, alignItems: 'center', justifyContent: 'center' },
});
