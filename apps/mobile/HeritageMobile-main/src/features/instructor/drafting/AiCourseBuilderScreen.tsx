import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, Icon, Input, Select, LoadingState, ErrorState, EmptyState, InfoBanner, ConfirmSheet, BottomSheet, Accordion, ProgressBar, InlineError } from '../../../components';
import { colors, spacing } from '../../../theme';
import type { RootScreenProps } from '../../../navigation/types';
import { useServices } from '../../../app/ServicesProvider';
import { aiCourseBusy, useAiCourse, useAiCourseItem, useAiCourseMutations, useAiDraftCourses } from '../useInstructor';
import { errorMessage } from '../../../services/errors';
import { formatDateTime } from '../../../utils/format';
import { HtmlView } from '../../shared/HtmlView';
import type { AiCourseAssessment, AiCourseBlueprint, AiCourseBrief, AiCourseDelivery, AiCourseItemStatus, AiCourseState } from '../../../services/contracts/instructor';

const DEFAULT_BRIEF: AiCourseBrief = { hours: 120, modules: 12, lessonsPerModule: 4, delivery: 'synchronous', deliveryMethod: 'Distance / online', breakdown: '100% online', audience: '', includeCase: true, quizQuestions: 10, outline: '', notes: '' };
const STATUS_LABEL: Record<AiCourseItemStatus, string> = { pending: 'Waiting', running: 'Writing…', done: 'Ready', failed: 'Failed' };
const STEPS = ['Course brief', 'Review blueprint', 'Generate & publish'];
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const num = (t: string) => Number(t) || 0;

export function AiCourseBuilderScreen({ route }: RootScreenProps<'InstructorAiCourse'>) {
  const hasAi = !!useServices().instructor.ai;
  const fixed = route.params?.sectionId;
  const courses = useAiDraftCourses();
  const [sectionId, setSectionId] = useState(fixed ?? '');
  useEffect(() => { if (!sectionId && courses.data?.length) setSectionId(courses.data[0].sectionId); }, [courses.data, sectionId]);
  return (
    <Screen testID="ai-course-builder" header={<ScreenHeader title="AI course builder" />}>
      {!hasAi ? <EmptyState icon="Sparkles" title="AI course builder is not available" message="Sign in to Campus One to build courses with AI." /> : (
        <Stack>
          <Text variant="body">Design a full course from a brief: the AI drafts a blueprint for your approval, then writes every lesson, module quiz and assessment, and publishes them into this course section.</Text>
          {fixed ? null : courses.isLoading ? <LoadingState /> : courses.error ? <ErrorState error={courses.error} onRetry={() => courses.refetch()} /> : !courses.data?.length ? <EmptyState icon="BookOpen" title="You are not assigned to any active course sections." /> : (
            <Select label="Course" value={sectionId} onChange={setSectionId} options={courses.data.map(c => ({ value: c.sectionId, label: `${c.code} · ${c.title}`, description: [c.section, c.dates].filter(Boolean).join(' · ') }))} testID="ai-course-section" />
          )}
          {sectionId ? <AiCourseBuilder key={sectionId} sectionId={sectionId} /> : null}
        </Stack>
      )}
    </Screen>
  );
}

function AiCourseBuilder({ sectionId }: { sectionId: string }) {
  const q = useAiCourse(sectionId);
  const m = useAiCourseMutations(sectionId);
  const state = q.data;
  const job = state?.job ?? null;
  const [brief, setBrief] = useState<AiCourseBrief>(DEFAULT_BRIEF);
  const briefLoaded = useRef(false);
  const [edit, setEdit] = useState<AiCourseBlueprint | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState<'blueprint' | 'publish' | 'discard' | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const preview = useAiCourseItem(sectionId, previewKey);

  useEffect(() => {
    if (!state || briefLoaded.current) return;
    briefLoaded.current = true;
    if (state.job?.brief) setBrief(state.job.brief);
    else if (state.course.totalHours) setBrief(b => ({ ...b, hours: state.course.totalHours! }));
  }, [state]);
  useEffect(() => { if (!dirty) setEdit(job?.stage === 'blueprint' && job.blueprint ? clone(job.blueprint) : null); }, [job?.blueprint, job?.stage, dirty]);

  if (q.isLoading) return <LoadingState />;
  if (!state) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  const blueprintRunning = job?.stage === 'blueprint' && job.blueprintTask.status === 'running';
  const generating = job?.stage === 'approved' && aiCourseBusy(state);
  const act = async (label: string, run: () => Promise<AiCourseState>, done?: string) => {
    setBusy(label); setError(''); setNotice('');
    try { const next = await run(); if (done) setNotice(done); return next; } catch (e) { setError(errorMessage(e)); return null; } finally { setBusy(''); }
  };
  const lessons = brief.modules * brief.lessonsPerModule;
  const lessonMinutes = lessons ? Math.round((brief.hours * 60) / lessons) : 0;
  const briefError = lessons > 96 ? 'Keep modules × lessons per module at or below 96.' : lessonMinutes < 20 ? 'Each lesson needs at least 20 minutes.' : '';
  const startBlueprint = () => { setConfirm(null); setDirty(false); void act('blueprint', () => m.blueprint.mutateAsync(brief)); };
  const saveEdits = async () => {
    if (!edit) return null;
    const next = await act('save', () => m.save.mutateAsync({
      description: edit.course.description,
      outcomes: edit.outcomes.map(o => o.text),
      modules: edit.modules.map(x => ({ title: x.title, purpose: x.purpose, milestone: x.milestone, lessons: x.lessons.map(l => ({ title: l.title, focus: l.focus })) })),
      quizWeight: edit.quizWeight,
      assessments: edit.assessments.map(a => ({ title: a.title, mode: a.mode, weight: a.weight, dueModule: a.dueModule, summary: a.summary })),
    }));
    if (next) setDirty(false);
    return next;
  };
  const approve = async () => { if (dirty && !(await saveEdits())) return; await act('approve', () => m.approve.mutateAsync()); };
  const publish = async () => {
    setConfirm(null);
    const next = await act('publish', () => m.publish.mutateAsync());
    if (next?.publishedSummary) setNotice(`Published ${next.publishedSummary.topics} topics, ${next.publishedSummary.activities} activities and ${next.publishedSummary.assignments} gradebook assignments.`);
  };
  const discard = () => { setConfirm(null); briefLoaded.current = true; setDirty(false); void act('discard', () => m.discard.mutateAsync()); };
  const patch = (fn: (bp: AiCourseBlueprint) => void) => { if (!edit) return; const next = clone(edit); fn(next); setEdit(next); setDirty(true); };

  const weightTotal = edit ? edit.quizWeight + edit.assessments.reduce((a, x) => a + (Number(x.weight) || 0), 0) : 0;
  const done = state.items.filter(i => i.status === 'done').length;
  const failed = state.items.filter(i => i.status === 'failed');
  const total = state.items.length;
  const canPublish = job?.stage !== 'blueprint' && total > 0 && done === total && !state.running && state.checks.every(c => c.ok);
  const step = !job || (job.stage === 'blueprint' && !job.blueprint && job.blueprintTask.status !== 'running') ? 1 : job.stage === 'blueprint' ? 2 : 3;
  const setB = <K extends keyof AiCourseBrief>(k: K, v: AiCourseBrief[K]) => setBrief(b => ({ ...b, [k]: v }));

  return (
    <Stack>
      <Text variant="titleMd">{state.course.code} · {state.course.title}</Text>
      <Row wrap gap={6}>{STEPS.map((label, i) => <Pill key={label} label={`${i + 1}. ${label}`} tone={step === i + 1 ? 'green' : step > i + 1 ? 'teal' : 'grey'} small dot={step === i + 1} />)}</Row>
      {error ? <InlineError error={new Error(error)} /> : null}
      {notice ? <InfoBanner tone="green" icon="CircleCheck" text={notice} /> : null}
      {job?.published ? <Text variant="caption">Last published {formatDateTime(job.published.at)}. Publishing again replaces that content; graded work is kept.</Text> : null}

      {step === 1 ? (
        <Card padding={spacing.md}>
          <Stack gap={spacing.sm}>
            {job?.blueprintTask.status === 'failed' && job.blueprintTask.error !== 'Discarded' ? <InlineError error={new Error(`Blueprint failed: ${job.blueprintTask.error ?? ''}`)} /> : null}
            <Row align="flex-start">
              <View style={{ flex: 1 }}><Input label="Total hours" keyboardType="number-pad" value={String(brief.hours)} onChangeText={t => setB('hours', num(t))} testID="brief-hours" /></View>
              <View style={{ flex: 1 }}><Input label="Modules" keyboardType="number-pad" value={String(brief.modules)} onChangeText={t => setB('modules', num(t))} testID="brief-modules" /></View>
            </Row>
            <Row align="flex-start">
              <View style={{ flex: 1 }}><Input label="Lessons per module" keyboardType="number-pad" value={String(brief.lessonsPerModule)} onChangeText={t => setB('lessonsPerModule', num(t))} testID="brief-lessons" /></View>
              <View style={{ flex: 1 }}><Input label="Questions per quiz" keyboardType="number-pad" value={String(brief.quizQuestions)} onChangeText={t => setB('quizQuestions', num(t))} testID="brief-quiz" /></View>
            </Row>
            <Select<AiCourseDelivery> label="Delivery format" value={brief.delivery} onChange={v => setB('delivery', v)} options={[{ value: 'synchronous', label: 'Synchronous (live sessions)' }, { value: 'self_paced', label: 'Self-paced (study units)' }]} testID="brief-delivery" />
            <Input label="Delivery method" value={brief.deliveryMethod} maxLength={120} onChangeText={t => setB('deliveryMethod', t)} testID="brief-method" />
            <Input label="Breakdown" value={brief.breakdown} maxLength={200} onChangeText={t => setB('breakdown', t)} testID="brief-breakdown" />
            <Select label="Shared business case" value={brief.includeCase ? 'yes' : 'no'} onChange={v => setB('includeCase', v === 'yes')} options={[{ value: 'yes', label: 'Create one fictional case' }, { value: 'no', label: 'No shared case' }]} testID="brief-case" />
            <Input label="Audience and prerequisites" value={brief.audience} maxLength={600} placeholder="e.g. Final-term business diploma students" onChangeText={t => setB('audience', t)} testID="brief-audience" />
            <Input label="Approved outline or source material (optional)" helper="The AI treats this as authoritative." value={brief.outline} maxLength={40000} multiline style={{ minHeight: 140, textAlignVertical: 'top' }} placeholder="Paste the program outline: description, outcomes, module hours, assessment plan and weights…" onChangeText={t => setB('outline', t)} testID="brief-outline" />
            <Input label="Notes for the AI (optional)" value={brief.notes} maxLength={4000} multiline style={{ minHeight: 60, textAlignVertical: 'top' }} onChangeText={t => setB('notes', t)} testID="brief-notes" />
            <Text variant="caption">{lessons} {brief.delivery === 'synchronous' ? 'sessions' : 'study units'} of about {lessonMinutes} minutes each. Each lesson gets core reading, a worked example, a timed plan, a workshop and a self-check. {brief.delivery === 'self_paced' ? 'Self-paced lessons also get a course-specific narrated AI video lecture for admin/SME review. ' : 'Synchronous/offline lessons stay text-led without generated video or audio. '}Each module gets an auto-graded quiz, and assessments get rubrics out of 100. Instructor guides with answer keys stay hidden from students.</Text>
            {briefError ? <InlineError error={new Error(briefError)} /> : null}
          </Stack>
        </Card>
      ) : null}

      {blueprintRunning ? <InfoBanner tone="gold" icon="LoaderCircle" text="Designing the blueprint (modules, outcomes, assessment plan)… usually 1–3 minutes." /> : null}

      {step === 2 && edit ? (
        <Stack gap={spacing.sm}>
          <Input label="Course description" value={edit.course.description} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} onChangeText={t => patch(bp => void (bp.course.description = t))} testID="bp-description" />
          <Text variant="titleSm">Course learning outcomes</Text>
          {edit.outcomes.map((o, i) => <Input key={o.id} label={o.id} value={o.text} multiline onChangeText={t => patch(bp => void (bp.outcomes[i]!.text = t))} testID={`bp-outcome-${o.id}`} />)}
          <Text variant="titleSm">Modules and lessons</Text>
          {edit.modules.map((x, mi) => (
            <Accordion key={x.id} title={`${x.id} · ${x.title}`} subtitle={`${Math.round(x.minutes / 6) / 10} h · ${x.lessons.length} lessons · ${x.outcomes.join(', ')}`} testID={`bp-module-${x.id}`}>
              <Stack gap={spacing.sm}>
                <Input label="Module title" value={x.title} onChangeText={t => patch(bp => void (bp.modules[mi]!.title = t))} />
                <Input label="Purpose" value={x.purpose} multiline onChangeText={t => patch(bp => void (bp.modules[mi]!.purpose = t))} />
                <Input label="Milestone" value={x.milestone} multiline onChangeText={t => patch(bp => void (bp.modules[mi]!.milestone = t))} />
                {x.lessons.map((l, li) => <Input key={l.id} label={`${l.id} · ${l.minutes} min`} value={l.title} onChangeText={t => patch(bp => void (bp.modules[mi]!.lessons[li]!.title = t))} />)}
              </Stack>
            </Accordion>
          ))}
          <Text variant="titleSm">Assessment plan</Text>
          <Card padding={spacing.md}>
            <Stack gap={spacing.sm}>
              <Row align="flex-end">
                <View style={{ flex: 1 }}><Text variant="bodyStrong">Q · Module quizzes</Text><Text variant="caption">{edit.modules.length} × {edit.quizQuestions} questions · Individual · Each module</Text></View>
                <View style={{ width: 90 }}><Input label="Weight %" keyboardType="number-pad" value={String(edit.quizWeight)} onChangeText={t => patch(bp => void (bp.quizWeight = num(t)))} testID="bp-quiz-weight" /></View>
              </Row>
              {edit.assessments.map((a, ai) => (
                <View key={a.id} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: spacing.sm }}>
                  <Input label={a.id} value={a.title} onChangeText={t => patch(bp => void (bp.assessments[ai]!.title = t))} testID={`bp-assessment-${a.id}`} />
                  <Row align="flex-start">
                    <View style={{ flex: 1 }}><Select<AiCourseAssessment['mode']> label="Mode" compact value={a.mode} onChange={v => patch(bp => void (bp.assessments[ai]!.mode = v))} options={[{ value: 'Individual', label: 'Individual' }, { value: 'Team', label: 'Team' }]} /></View>
                    <View style={{ flex: 1 }}><Select label="Due" compact value={a.dueModule} onChange={v => patch(bp => void (bp.assessments[ai]!.dueModule = v))} options={edit.modules.map(x => ({ value: x.id, label: x.id }))} /></View>
                    <View style={{ width: 90 }}><Input label="Weight %" keyboardType="number-pad" value={String(a.weight)} onChangeText={t => patch(bp => void (bp.assessments[ai]!.weight = num(t)))} /></View>
                  </Row>
                </View>
              ))}
              <Row justify="space-between" style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm }}><Text variant="bodyStrong">Total</Text><Text variant="bodyStrong" color={weightTotal === 100 ? colors.success600 : colors.danger600} testID="bp-weight-total">{weightTotal}%</Text></Row>
            </Stack>
          </Card>
          {edit.flags.length || edit.approvalRequired.length ? (
            <Card tone="warning" padding={spacing.md}>
              <Text variant="label" style={{ marginBottom: 4 }}>Needs your attention</Text>
              {[...edit.flags, ...edit.approvalRequired].map(f => <Text key={f} variant="bodySm">• {f}</Text>)}
            </Card>
          ) : null}
        </Stack>
      ) : null}

      {step >= 2 && state.checks.length ? (
        <Card padding={spacing.md} testID="ai-course-checks">
          {state.checks.map(c => <Row key={c.label} align="flex-start" gap={6} style={{ paddingVertical: 3 }}><Icon name={c.ok ? 'CircleCheck' : 'CircleX'} size={16} color={c.ok ? colors.success600 : colors.danger600} /><Text variant="bodySm" style={{ flex: 1 }}><Text variant="label">{c.label}: </Text>{c.detail}</Text></Row>)}
        </Card>
      ) : null}

      {step === 3 ? (
        <Stack gap={spacing.sm}>
          <Text variant="bodySm" testID="ai-course-progress">{done} of {total} items ready{generating ? ' — generation continues on the server, you can leave this screen and come back.' : '.'}</Text>
          <ProgressBar value={total ? (done / total) * 100 : 0} />
          {state.items.map(i => (
            <Card key={i.key} padding={spacing.md} testID={`ai-item-${i.key}`}>
              <Text variant="bodyStrong">{i.label}</Text>
              <Text variant="caption" color={i.status === 'failed' ? colors.danger600 : undefined}>{STATUS_LABEL[i.status]}{i.flags ? ` · ${i.flags} flag(s)` : ''}</Text>
              {i.error ? <Text variant="caption" color={colors.danger600}>{i.error}</Text> : null}
              {i.status === 'done' || i.status === 'failed' ? (
                <Row style={{ marginTop: spacing.sm }}>
                  {i.status === 'done' ? <Button title="Preview" variant="outline" size="sm" fullWidth={false} disabled={!!busy} onPress={() => setPreviewKey(i.key)} testID={`ai-item-preview-${i.key}`} /> : null}
                  <Button title={i.status === 'failed' ? 'Retry' : 'Regenerate'} variant="subtle" size="sm" fullWidth={false} disabled={!!busy} loading={busy === `run:${i.key}`} onPress={() => void act(`run:${i.key}`, () => m.run.mutateAsync(i.key))} testID={`ai-item-run-${i.key}`} />
                </Row>
              ) : null}
            </Card>
          ))}
        </Stack>
      ) : null}

      <Stack gap={spacing.sm}>
        {step === 1 ? <Button title={busy === 'blueprint' ? 'Starting…' : 'Generate blueprint'} icon={<Icon name="Sparkles" size={16} color={colors.white} />} disabled={!!busy || !!briefError} loading={busy === 'blueprint'} onPress={() => (job?.published ? setConfirm('blueprint') : startBlueprint())} testID="ai-course-blueprint" /> : null}
        {step === 2 && edit ? (
          <>
            <Button title={busy === 'approve' ? 'Approving…' : 'Approve & generate content'} disabled={!!busy || weightTotal !== 100} disabledReason="Assessment weights must total 100%" loading={busy === 'approve'} onPress={() => void approve()} testID="ai-course-approve" />
            <Row>
              <Button title={busy === 'save' ? 'Saving…' : 'Save changes'} variant="outline" style={{ flex: 1 }} disabled={!!busy || !dirty} onPress={() => void saveEdits()} testID="ai-course-save" />
              <Button title="Regenerate" variant="outline" style={{ flex: 1 }} disabled={!!busy} onPress={() => (job?.published ? setConfirm('blueprint') : startBlueprint())} testID="ai-course-regenerate" />
            </Row>
          </>
        ) : null}
        {step === 3 ? (
          <>
            <Button title={busy === 'publish' ? 'Publishing…' : job?.stage === 'published' ? 'Publish again' : 'Publish to course'} disabled={!!busy || !canPublish} loading={busy === 'publish'} onPress={() => setConfirm('publish')} testID="ai-course-publish" />
            <Row>
              <Button title="Edit blueprint" variant="outline" style={{ flex: 1 }} disabled={!!busy || !!generating} onPress={() => void act('reopen', () => m.reopen.mutateAsync())} testID="ai-course-reopen" />
              {failed.length && !generating ? <Button title={`Retry ${failed.length} failed`} variant="outline" style={{ flex: 1 }} disabled={!!busy} onPress={() => void act('run', () => m.run.mutateAsync(undefined))} testID="ai-course-retry" /> : null}
            </Row>
          </>
        ) : null}
        {job && !blueprintRunning ? <Button title="Discard draft" variant="ghost" disabled={!!busy || !!generating} loading={busy === 'discard'} onPress={() => setConfirm('discard')} testID="ai-course-discard" /> : null}
      </Stack>

      <ConfirmSheet visible={confirm === 'blueprint'} onClose={() => setConfirm(null)} onConfirm={startBlueprint} title="Generate a new blueprint?" message="This course already has AI-generated content. Generating a new blueprint will replace it when you publish again." confirmLabel="Continue" icon="Sparkles" testID="ai-course-confirm-blueprint" />
      <ConfirmSheet visible={confirm === 'publish'} onClose={() => setConfirm(null)} onConfirm={() => void publish()} title="Publish to this section?" message="Lesson pages, quizzes and assignments become visible to enrolled students. Instructor guides stay hidden." confirmLabel="Publish" icon="Send" loading={busy === 'publish'} testID="ai-course-confirm-publish" />
      <ConfirmSheet visible={confirm === 'discard'} onClose={() => setConfirm(null)} onConfirm={discard} title="Discard this AI course draft?" message="Published content stays in the course." confirmLabel="Discard" destructive icon="Trash2" testID="ai-course-confirm-discard" />
      <BottomSheet visible={!!previewKey} onClose={() => setPreviewKey(null)} title={preview.data?.label ?? 'Preview'} testID="ai-item-preview">
        {preview.isLoading ? <LoadingState /> : preview.error ? <ErrorState error={preview.error} onRetry={() => preview.refetch()} /> : preview.data ? (
          <Stack gap={spacing.sm}>
            {preview.data.flags.map(f => <Row key={f} align="flex-start" gap={6}><Icon name="Flag" size={14} color={colors.warning600} /><Text variant="bodySm" style={{ flex: 1 }}>{f}</Text></Row>)}
            <HtmlView html={preview.data.html} testID="ai-item-preview-html" />
          </Stack>
        ) : null}
      </BottomSheet>
    </Stack>
  );
}
