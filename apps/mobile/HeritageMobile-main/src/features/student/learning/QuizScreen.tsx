import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, Card, Row, Stack, Icon, Button, Pill, ProgressBar, InfoBanner, ListRow } from '../../../components';
import { colors, spacing } from '../../../theme';
import type { RootScreenProps } from '../../../navigation/types';
import { ActivityShell } from './ActivityShell';
import { useLearningMutations, useSnapshot } from './useLearning';
import { Routes } from '../../../navigation/routes';
import { useAppNavigation } from '../../../navigation/hooks';
import { progressionPolicy } from '../../../config/progressionPolicy';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';

type Result = { score: number; passed: boolean; correct: number; total: number } | null;

/** Shared by the ungraded Practice Quiz and the graded Chapter Assessment. */
function QuizScreenBase({ programmeId, activityId, kind }: { programmeId: string; activityId: string; kind: 'practiceQuiz' | 'assessment' }) {
  const navigation = useAppNavigation();
  const m = useLearningMutations(programmeId);
  const snap = useSnapshot(programmeId);
  const [q, setQ] = useState(0);
  const [result, setResult] = useState<Result>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const answers = snap.data?.progress.quizAnswers[activityId] ?? {};
  const graded = kind === 'assessment';
  const best = graded ? snap.data?.progress.assessmentResults[activityId] : undefined;
  const bestPractice = !graded ? snap.data?.progress.quizBestScore[activityId] : undefined;
  const submitted = graded ? !!best : bestPractice !== undefined;

  return (
    <ActivityShell programmeId={programmeId} activityId={activityId} testID={graded ? 'assessment-screen' : 'quiz-screen'} readyToComplete={() => {
      if (graded) return best?.passed ? { ok: true } : { ok: false, reason: `Pass the chapter assessment (${progressionPolicy.passMark.assessment}%) to complete it.` };
      return submitted ? { ok: true } : { ok: false, reason: 'Submit the practice quiz to complete it.' };
    }} footerExtra={({ activity }) => {
      const questions = activity.quiz?.questions ?? [];
      const answered = questions.filter(x => answers[x.id] !== undefined).length;
      const allAnswered = answered === questions.length;
      if (showFeedback) return null;
      return (
        <Row>
          {q < questions.length - 1 ? (
            <Button title="Next question →" style={{ flex: 1 }} onPress={() => setQ(x => x + 1)} disabled={answers[questions[q].id] === undefined} disabledReason="Select an answer to continue" testID="quiz-next" />
          ) : (
            <Button title={graded ? 'Submit assessment' : 'Submit quiz'} variant="coral" style={{ flex: 1 }} disabled={!allAnswered} disabledReason={`${answered}/${questions.length} answered`} loading={m.submitQuiz.isPending} testID="quiz-submit" onPress={async () => {
              try {
                const r = await m.submitQuiz.mutateAsync({ activityId, kind });
                setResult(r);
                setShowFeedback(true);
              } catch (e) {
                toast(errorMessage(e), 'error');
              }
            }} />
          )}
        </Row>
      );
    }}>
      {({ activity }) => {
        const questions = activity.quiz?.questions ?? [];
        const answered = questions.filter(x => answers[x.id] !== undefined).length;
        const question = questions[q];
        if (showFeedback) {
          const r = result ?? (graded && best ? { score: best.score, passed: best.passed, correct: Math.round((best.score / 100) * questions.length), total: questions.length } : null);
          return (
            <Stack>
              <Card tone={r?.passed ?? true ? 'green' : 'coral'}>
                <Stack gap={spacing.sm}>
                  <Row gap={8}><Icon name={r?.passed ?? true ? 'CircleCheck' : 'CircleX'} size={22} color={r?.passed ?? true ? colors.success600 : colors.coral600} /><Text variant="displaySm">{graded ? (r?.passed ? 'Assessment passed' : 'Not passed yet') : 'Practice complete'}</Text></Row>
                  <Text variant="displayLg">{r?.score ?? 0}%</Text>
                  <Text variant="bodySm">{r?.correct ?? 0} of {r?.total ?? questions.length} correct{graded ? ` · pass mark ${progressionPolicy.passMark.assessment}%` : ' · ungraded practice'}{graded && best ? ` · attempt ${best.attempts}` : ''}</Text>
                  {!graded ? <Text variant="caption">Your highest practice score ({bestPractice ?? r?.score ?? 0}%) is saved automatically. Practice never affects grades.</Text> : null}
                </Stack>
              </Card>
              {questions.map((qq, i) => {
                const a = answers[qq.id];
                const ok = a === qq.correctIndex;
                return (
                  <Card key={qq.id} padding={spacing.md}>
                    <Row gap={6} align="flex-start"><Icon name={ok ? 'CircleCheck' : 'CircleX'} size={16} color={ok ? colors.success600 : colors.coral600} /><Text variant="bodyStrong" style={{ flex: 1 }}>{i + 1}. {qq.prompt}</Text></Row>
                    <Text variant="bodySm" style={{ marginTop: 4 }}>Your answer: {a !== undefined ? qq.options[a] : '—'}</Text>
                    {!ok ? <Text variant="bodySm" color={colors.success600}>Correct: {qq.options[qq.correctIndex]}</Text> : null}
                    <Text variant="caption" style={{ marginTop: 4 }}>{qq.explanation}</Text>
                  </Card>
                );
              })}
              <Button title={graded && !r?.passed ? 'Retry assessment' : 'Retry (clear answers)'} variant="outline" testID="quiz-retry" onPress={async () => { await m.resetQuiz.mutateAsync(activityId); setQ(0); setResult(null); setShowFeedback(false); }} />
            </Stack>
          );
        }
        if (!question) return null;
        return (
          <Stack>
            <InfoBanner tone={graded ? 'coral' : 'grey'} icon={graded ? 'ShieldAlert' : 'Lock'} title={graded ? 'Graded chapter assessment' : 'Ungraded practice'} text={graded ? `Score ${progressionPolicy.passMark.assessment}% or higher to unlock the next chapter. Attempts are recorded.` : 'Practice quiz helps you prepare for the graded chapter assessment. Complete all questions to advance.'} />
            <Card tone="dark">
              <Row justify="space-between"><Text variant="overline" color={colors.green100}>{graded ? 'Chapter assessment' : 'Practice quiz'}</Text><Text variant="label" color={colors.white}>{answered}/{questions.length} answered</Text></Row>
              <Text variant="bodySm" color={colors.green100}>{questions.length} questions · {graded ? 'graded' : 'ungraded'}</Text>
              <Text variant="caption" color={colors.green100}>{graded ? 'Pass to unlock the next chapter.' : 'Unlimited retries. Use this to prepare for the graded chapter assessment.'}</Text>
              <ProgressBar value={(answered / questions.length) * 100} color={colors.gold500} track={colors.green700} />
            </Card>
            <Card>
              <Row justify="space-between">
                <Pill label={`${q + 1} / ${questions.length}`} tone="dark" small />
                <Text variant="caption">Select one answer</Text>
                <Row gap={4}>{questions.map((qq, i) => <Pressable key={qq.id} accessibilityRole="button" accessibilityLabel={`Go to question ${i + 1}`} onPress={() => setQ(i)} hitSlop={6}><View style={[styles.dot, i === q ? styles.dotActive : answers[qq.id] !== undefined ? styles.dotDone : null]} /></Pressable>)}</Row>
              </Row>
              <Text variant="titleMd" style={{ marginVertical: spacing.md }}>{question.prompt}</Text>
              <Stack gap={spacing.sm}>
                {question.options.map((opt, i) => {
                  const selected = answers[question.id] === i;
                  return (
                    <Pressable key={opt} testID={`quiz-option-${i}`} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => m.saveAnswer.mutate({ activityId, questionId: question.id, optionIndex: i })} style={[styles.option, selected ? styles.optionSelected : null]}>
                      <View style={[styles.letter, selected ? styles.letterSelected : null]}><Text variant="label" color={selected ? colors.white : colors.green900}>{'ABCD'[i]}</Text></View>
                      <Text variant="body" color={colors.ink} style={{ flex: 1 }}>{opt}</Text>
                      {selected ? <Icon name="Check" size={18} color={colors.green900} /> : null}
                    </Pressable>
                  );
                })}
              </Stack>
              {q > 0 ? <Button title="← Previous question" variant="ghost" size="sm" onPress={() => setQ(x => x - 1)} style={{ marginTop: spacing.sm }} testID="quiz-prev" /> : null}
            </Card>
            <Card padding={spacing.md}><ListRow icon="Sparkles" title="Ask Coach about this question" subtitle="Get an instant guided hint without penalties" onPress={() => navigation.navigate(Routes.StudentAskCoach, { programmeId, activityId })} testID="quiz-ask-coach" /></Card>
            {!graded ? <Row gap={6}><Icon name="RefreshCw" size={14} color={colors.inkMuted} /><Text variant="caption">Your highest practice score will be saved automatically{bestPractice !== undefined ? ` · best so far ${bestPractice}%` : ''}</Text></Row> : best ? <Text variant="caption">Best attempt so far: {best.score}% ({best.passed ? 'passed' : 'not passed'})</Text> : null}
          </Stack>
        );
      }}
    </ActivityShell>
  );
}

export function PracticeQuizScreen({ route }: RootScreenProps<'StudentPracticeQuiz'>) {
  return <QuizScreenBase programmeId={route.params.programmeId} activityId={route.params.activityId} kind="practiceQuiz" />;
}

export function AssessmentScreen({ route }: RootScreenProps<'StudentAssessment'>) {
  return <QuizScreenBase programmeId={route.params.programmeId} activityId={route.params.activityId} kind="assessment" />;
}

const styles = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.green900 },
  dotDone: { backgroundColor: colors.success600 },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: 12, borderWidth: 1, borderColor: colors.border, minHeight: 52 },
  optionSelected: { backgroundColor: colors.green50, borderColor: colors.green900 },
  letter: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: colors.green900, alignItems: 'center', justifyContent: 'center' },
  letterSelected: { backgroundColor: colors.green900 },
});
