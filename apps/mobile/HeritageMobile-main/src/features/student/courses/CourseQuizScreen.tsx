import React, { useState } from 'react';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, Icon, DemoLabel, InfoBanner, RadioRow, Checkbox, LoadingState, ErrorState, EmptyState, ConfirmSheet, KeyValueRow, Input } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import type { RootScreenProps } from '../../../navigation/types';
import { useSection } from './useCourses';
import { useCourseLms, useSubmitChoice, useSubmitQuiz } from './useCourseLearning';
import { Routes } from '../../../navigation/routes';
import { HtmlView } from '../../shared/HtmlView';
import { formatDate, formatDateTime } from '../../../utils/format';
import { clock } from '../../../utils/clock';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';
import type { CourseActivity, CourseChoice } from '../../../services/contracts';

type Props = RootScreenProps<'StudentCourseQuiz'>;

export function CourseQuizScreen(props: Props) {
  return isMockMode() ? <DemoCourseQuiz {...props} /> : <CourseActivityScreen {...props} />;
}

const hasHtml = (s: string) => /<[a-z][^>]*>/i.test(s);
const Body = ({ text }: { text?: string }) => (!text?.trim() ? null : hasHtml(text) ? <HtmlView html={text} /> : <Text variant="body">{text}</Text>);

/** In-course LMS activity (quiz, choice/poll, page, forum notice) from GET /student/courses/:id/lms. */
function CourseActivityScreen({ navigation, route }: Props) {
  const { sectionId, materialId } = route.params;
  const lms = useCourseLms(sectionId);
  const activity = lms.data?.topics.flatMap(t => t.activities).find(a => a.id === materialId);
  return (
    <Screen testID="course-quiz" header={<ScreenHeader backLabel="Course" />} refreshing={lms.isRefetching} onRefresh={() => lms.refetch()}>
      {lms.isLoading ? <LoadingState /> : !lms.data ? <ErrorState error={lms.error} onRetry={() => lms.refetch()} /> : !activity ? (
        <EmptyState icon="FileQuestion" title="Activity not available" message="Your instructor may have hidden or removed this activity." />
      ) : (
        <Stack>
          <Text variant="caption" testID="cq-course">{lms.data.courseCode} · {lms.data.courseTitle}</Text>
          <Text variant="displayMd">{activity.name}</Text>
          <Row wrap><Pill label={lms.data.courseCode} tone="grey" small /><Pill label={activity.type === 'CHOICE' ? 'Poll' : activity.type === 'QUIZ' ? (activity.gradable ? 'Graded quiz' : 'Quiz') : activity.type.charAt(0) + activity.type.slice(1).toLowerCase()} tone="coral" small /></Row>
          {activity.type === 'QUIZ' ? <QuizBody sectionId={sectionId} activity={activity} /> : activity.type === 'CHOICE' && activity.choice ? <ChoiceBody sectionId={sectionId} activity={activity} choice={activity.choice} /> : (
            <Card>
              <Stack gap={spacing.sm}>
                <Body text={activity.body ?? activity.description} />
                {activity.note ? <Text variant="caption">{activity.note}</Text> : null}
                {!activity.body && !activity.description && !activity.note ? <Text variant="bodySm">Your instructor has not added content to this activity yet.</Text> : null}
              </Stack>
            </Card>
          )}
          <Button title="Back to course" variant="outline" onPress={() => navigation.navigate(Routes.StudentCourseDetails, { sectionId })} />
        </Stack>
      )}
    </Screen>
  );
}

function QuizBody({ sectionId, activity }: { sectionId: string; activity: CourseActivity }) {
  const submit = useSubmitQuiz(sectionId);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const questions = activity.questions ?? [];
  const result = submit.data;
  const attempt = result ?? activity.quizAttempt ?? null;
  const locked = Boolean(attempt) || !activity.gradable;
  const [confirming, setConfirming] = useState(false);
  const correct = (qid: string) => result?.results.find(r => r.id === qid)?.correct;
  const markedPoints = questions.every(q => q.points !== undefined) ? questions.reduce((sum, q) => sum + (q.points ?? 0), 0) : undefined;
  const totalPoints = attempt?.maxScore ?? markedPoints;
  const closed = activity.closesAt ? new Date(activity.closesAt).getTime() < clock.now() : false;
  const answered = Object.keys(answers).length;
  const onSubmit = async () => {
    try {
      const r = await submit.mutateAsync({ activityId: activity.id, answers });
      setConfirming(false);
      toast(`Quiz submitted · ${r.score} / ${r.maxScore}`, 'success');
    } catch (e) {
      setConfirming(false);
      toast(errorMessage(e), 'error');
    }
  };
  return (
    <>
      {activity.closesAt || (activity.gradable && totalPoints !== undefined) ? (
        <Card padding={spacing.md} testID="cq-meta">
          {activity.closesAt ? <KeyValueRow label="Due" value={`${formatDateTime(activity.closesAt)}${closed ? ' · closed' : ''}`} border={activity.gradable && totalPoints !== undefined} /> : null}
          {activity.gradable && totalPoints !== undefined ? <KeyValueRow label="Points" value={String(totalPoints)} border={false} /> : null}
        </Card>
      ) : null}
      <Body text={activity.body} />
      {activity.gradable ? (
        <InfoBanner tone="grey" icon="Info" text={`${questions.length} question${questions.length === 1 ? '' : 's'}${activity.quizMinutes ? ` · ${activity.quizMinutes} minutes` : ''} · one attempt, graded automatically.`} />
      ) : (
        <InfoBanner tone="gold" icon="Info" text="This quiz is not graded in the app. Your instructor records its mark, which appears under Grades & Progress when released." />
      )}
      {attempt ? (
        <Card tone="green" testID="cq-result">
          <Row gap={8}><Icon name="CircleCheck" size={20} color={colors.success600} /><Text variant="titleSm">Score: {attempt.score} / {attempt.maxScore}</Text></Row>
          <Text variant="caption" style={{ marginTop: 4 }}>Submitted {formatDate(attempt.submittedAt)}{result ? ` · incorrect: ${result.results.map((r, i) => (r.correct ? null : i + 1)).filter(Boolean).join(', ') || 'none'}` : ''}</Text>
        </Card>
      ) : null}
      {!questions.length ? <EmptyState icon="FileQuestion" title="No questions published for this quiz yet." /> : questions.map((q, i) => (
        <Card key={q.id} padding={spacing.md}>
          <Row justify="space-between" align="flex-start">
            <Text variant="bodyStrong" style={{ flex: 1, marginBottom: spacing.sm }}>{i + 1}. {q.text}</Text>
            {activity.gradable && q.points !== undefined ? <Text variant="caption">{q.points} pt{q.points === 1 ? '' : 's'}</Text> : null}
            {correct(q.id) === undefined ? null : <Icon name={correct(q.id) ? 'CircleCheck' : 'CircleX'} size={18} color={correct(q.id) ? colors.success600 : colors.danger600} />}
          </Row>
          <Stack gap={spacing.sm}>
            {q.answers.map((o, j) => <RadioRow key={`${q.id}-${j}`} selected={answers[q.id] === j} onPress={() => !locked && setAnswers(a => ({ ...a, [q.id]: j }))} disabled={locked} label={o} testID={`cq-${i}-${j}`} />)}
          </Stack>
        </Card>
      ))}
      {activity.gradable && !attempt && questions.length ? (
        <Button title="Submit all and finish" onPress={() => setConfirming(true)} loading={submit.isPending} disabled={answered < questions.length} disabledReason="Answer every question first" testID="cq-submit" />
      ) : null}
      <ConfirmSheet visible={confirming} onClose={() => setConfirming(false)} onConfirm={onSubmit} loading={submit.isPending} icon="ClipboardCheck" title="Submit quiz?" message={`You answered ${answered} of ${questions.length} question${questions.length === 1 ? '' : 's'}. Only one attempt is graded and answers cannot be changed after you submit.`} confirmLabel="Submit quiz" testID="cq-confirm" />
    </>
  );
}

function ChoiceBody({ sectionId, activity, choice }: { sectionId: string; activity: CourseActivity; choice: CourseChoice }) {
  const submit = useSubmitChoice(sectionId);
  const [selected, setSelected] = useState<string[]>(choice.response?.selected ?? []);
  const toggle = (o: string) => setSelected(s => (choice.multiple ? (s.includes(o) ? s.filter(x => x !== o) : [...s, o]) : [o]));
  const onSubmit = async () => {
    try {
      await submit.mutateAsync({ activityId: activity.id, selected });
      toast('Your response was saved', 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const saved = submit.data ?? choice.response;
  return (
    <>
      <Body text={activity.body ?? activity.description} />
      <Card padding={spacing.md}>
        <Text variant="label" style={{ marginBottom: spacing.sm }}>{choice.multiple ? 'Select all that apply' : 'Select one'}</Text>
        <Stack gap={spacing.sm}>
          {choice.options.map((o, i) => (choice.multiple
            ? <Checkbox key={o} checked={selected.includes(o)} onChange={() => toggle(o)} label={o} testID={`choice-${i}`} />
            : <RadioRow key={o} selected={selected.includes(o)} onPress={() => toggle(o)} label={o} testID={`choice-${i}`} />))}
        </Stack>
      </Card>
      {saved ? <Text variant="caption">Your response ({saved.selected.join(', ')}) was saved {formatDate(saved.submittedAt)}. You can update it.</Text> : null}
      <Button title={saved ? 'Update response' : 'Save my choice'} onPress={onSubmit} loading={submit.isPending} disabled={!selected.length} disabledReason="Select an option first" testID="choice-submit" />
    </>
  );
}

/** Mock-mode in-course quiz: local demo practice, not graded. */
function DemoCourseQuiz({ navigation, route }: Props) {
  const { sectionId, materialId } = route.params;
  const section = useSection(sectionId);
  const material = section.data?.days.flatMap(d => d.materials).find(m => m.id === materialId);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [written, setWritten] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dueAt] = useState(() => new Date(clock.now() + 7 * 86_400_000).toISOString());
  const questions = [
    { q: 'A genogram primarily maps…', opts: ['Family relationships across generations', 'Course grades', 'Room bookings'], a: 0 },
    { q: 'Recovery-oriented care emphasises…', opts: ['Punishment', 'Strengths and relational support', 'Isolation'], a: 1 },
    { q: 'Triangulation in a family system means…', opts: ['Three-sided debate', 'A third person is drawn into a two-person conflict', 'A seating plan'], a: 1 },
  ];
  const writtenPoints = 2;
  const totalPoints = questions.length + writtenPoints;
  const score = Object.entries(answers).filter(([i, v]) => questions[Number(i)].a === v).length;
  const complete = Object.keys(answers).length === questions.length && written.trim().length > 0;
  return (
    <Screen testID="course-quiz" header={<ScreenHeader backLabel="Course" />}>
      <Stack>
        <Text variant="caption" testID="cq-course">{section.data ? `${section.data.course.code} · ${section.data.course.title}` : ''}</Text>
        <Text variant="displayMd">{material?.title ?? 'Quiz'}</Text>
        <Row><Pill label={section.data?.course.code ?? ''} tone="grey" small /><Pill label="In-course quiz · demo" tone="coral" small /></Row>
        <Card padding={spacing.md} testID="cq-meta">
          <KeyValueRow label="Due" value={`${formatDateTime(dueAt)} (demo)`} />
          <KeyValueRow label="Points" value={`${totalPoints} (${questions.length} auto-graded · ${writtenPoints} instructor-graded)`} border={false} />
        </Card>
        <InfoBanner tone="grey" icon="Info" text="This demo quiz is practice only. Official marks for Quiz 1 are entered and released by your instructor under Grades & Progress." />
        {questions.map((item, i) => (
          <Card key={item.q} padding={spacing.md}>
            <Row justify="space-between" align="flex-start"><Text variant="bodyStrong" style={{ flex: 1, marginBottom: spacing.sm }}>{i + 1}. {item.q}</Text><Text variant="caption">1 pt</Text></Row>
            <Stack gap={spacing.sm}>
              {item.opts.map((o, j) => <RadioRow key={o} selected={answers[i] === j} onPress={() => !submitted && setAnswers(a => ({ ...a, [i]: j }))} label={o} description={submitted ? (j === item.a ? 'Correct answer' : undefined) : undefined} testID={`cq-${i}-${j}`} />)}
            </Stack>
          </Card>
        ))}
        <Card padding={spacing.md}>
          <Row justify="space-between" align="flex-start"><Text variant="bodyStrong" style={{ flex: 1, marginBottom: spacing.sm }}>{questions.length + 1}. In two or three sentences, explain how a genogram can support recovery-oriented practice.</Text><Text variant="caption">{writtenPoints} pts</Text></Row>
          <Input multiline value={written} onChangeText={setWritten} editable={!submitted} placeholder="Your answer" testID="cq-written" />
          <Text variant="caption">Graded manually by your instructor.</Text>
        </Card>
        {submitted ? (
          <Stack>
            <Card tone="green"><Row gap={8}><Icon name="CircleCheck" size={20} color={colors.success600} /><Text variant="titleSm">Auto-graded: {score} / {questions.length} (practice)</Text></Row></Card>
            <Card padding={spacing.md} testID="cq-pending">
              <Row gap={8}><Icon name="Hourglass" size={20} color={colors.gold500} /><Text variant="titleSm">Pending grading</Text><Pill label="Submitted" tone="grey" small /></Row>
              <Text variant="bodySm" style={{ marginTop: 4 }}>Your written response ({writtenPoints} pts) is waiting for your instructor. Your final score out of {totalPoints} appears under Grades & Progress once it is released.</Text>
            </Card>
          </Stack>
        ) : (
          <Button title="Submit practice attempt" onPress={() => setConfirming(true)} disabled={!complete} disabledReason="Answer every question first" testID="cq-submit" />
        )}
        <ConfirmSheet visible={confirming} onClose={() => setConfirming(false)} onConfirm={() => { setSubmitted(true); setConfirming(false); }} icon="ClipboardCheck" title="Submit quiz?" message={`You answered all ${questions.length + 1} questions. Answers cannot be changed after you submit; the written response will be graded by your instructor.`} confirmLabel="Submit quiz" testID="cq-confirm" />
        <Button title="Back to course" variant="outline" onPress={() => navigation.navigate(Routes.StudentCourseDetails, { sectionId })} />
        <DemoLabel text="Inferred supporting screen" />
      </Stack>
    </Screen>
  );
}
