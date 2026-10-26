import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, Input, LoadingState, ErrorState, EmptyState, Icon, InfoBanner, KeyValueRow, ListRow } from '../../../components';
import { colors, spacing } from '../../../theme';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useEvaluation, usePendingEvaluations } from './useRecords';
import { formatDate, formatDateTime } from '../../../utils/format';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';
import type { CourseEvaluationInput } from '../../../services/contracts/records';

type RatingKey = Exclude<keyof CourseEvaluationInput, 'comments'>;

const QUESTIONS: { key: RatingKey; label: string; hint: string }[] = [
  { key: 'overallRating', label: 'Overall experience', hint: 'How would you rate this course overall?' },
  { key: 'teachingQuality', label: 'Teaching quality', hint: 'Clarity, preparation and support from your instructor' },
  { key: 'courseMaterials', label: 'Course materials', hint: 'Readings, slides, labs and other resources' },
  { key: 'workload', label: 'Workload', hint: 'Was the amount of work appropriate for the course?' },
];

/** Course evaluation survey (GET/POST /student/evaluations/:id). Without an id it lists pending evaluations. */
export function EvaluationScreen({ navigation, route }: RootScreenProps<'StudentCourseEvaluation'>) {
  const evaluationId = route.params?.evaluationId;
  if (!evaluationId) return <PendingEvaluations onOpen={id => navigation.push(Routes.StudentCourseEvaluation, { evaluationId: id })} />;
  return <EvaluationForm evaluationId={evaluationId} onDone={() => navigation.goBack()} />;
}

function PendingEvaluations({ onOpen }: { onOpen: (id: string) => void }) {
  const list = usePendingEvaluations();
  return (
    <Screen testID="evaluations-pending" header={<ScreenHeader backLabel="Back" />}>
      <Stack>
        <Text variant="displayLg">Course Evaluations</Text>
        <Text variant="body">Share anonymous feedback on your courses. Your instructor only sees aggregated results.</Text>
        {!list.supported ? <EmptyState icon="MessageSquareText" title="Course evaluations are not available" /> : list.isLoading ? <LoadingState /> : list.error ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : !list.data?.length ? (
          <EmptyState icon="CircleCheck" title="All caught up" message="You have no course evaluations waiting for feedback." />
        ) : (
          <Card padding={spacing.md}>
            {list.data.map(e => (
              <ListRow key={e.id} icon="MessageSquareText" title={`${e.courseCode} · ${e.courseTitle}`} subtitle={e.dueAt ? `Due ${formatDate(e.dueAt)}` : 'No due date'} onPress={() => onOpen(e.id)} testID={`evaluation-${e.id}`} />
            ))}
          </Card>
        )}
      </Stack>
    </Screen>
  );
}

function EvaluationForm({ evaluationId, onDone }: { evaluationId: string; onDone: () => void }) {
  const { query, submit } = useEvaluation(evaluationId);
  const ev = query.data;
  const [ratings, setRatings] = useState<Partial<Record<RatingKey, number>>>({});
  const [comments, setComments] = useState('');
  useEffect(() => {
    if (!ev) return;
    setRatings({ overallRating: ev.overallRating, teachingQuality: ev.responses?.teachingQuality, courseMaterials: ev.responses?.courseMaterials, workload: ev.responses?.workload });
    setComments(ev.responses?.comments ?? '');
  }, [ev]);
  const submitted = ev?.status === 'submitted';
  const complete = QUESTIONS.every(q => (ratings[q.key] ?? 0) >= 1);
  const send = async () => {
    try {
      await submit.mutateAsync({ overallRating: ratings.overallRating!, teachingQuality: ratings.teachingQuality!, courseMaterials: ratings.courseMaterials!, workload: ratings.workload!, comments });
      toast('Thank you — your evaluation was submitted', 'success');
      onDone();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  return (
    <Screen testID="evaluation-form" header={<ScreenHeader backLabel="Back" />}>
      {query.isLoading ? <LoadingState /> : !ev ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : (
        <Stack>
          <Row justify="space-between"><Text variant="overline">Course evaluation</Text><Pill label={submitted ? 'Submitted' : 'Pending'} tone={submitted ? 'green' : 'yellow'} small dot={!submitted} /></Row>
          <Text variant="displayMd">{ev.courseCode} · {ev.courseTitle}</Text>
          {ev.dueAt && !submitted ? <Text variant="bodySm">Please submit by {formatDateTime(ev.dueAt)}.</Text> : null}
          {submitted ? <InfoBanner tone="green" icon="CircleCheck" title="Evaluation submitted" text={ev.submittedAt ? `Submitted ${formatDateTime(ev.submittedAt)}. Responses can no longer be changed.` : 'Responses can no longer be changed.'} /> : null}
          <Card>
            {QUESTIONS.map((q, i) => (
              <View key={q.key} style={[styles.question, i === QUESTIONS.length - 1 ? null : styles.questionBorder]}>
                <Text variant="titleSm">{q.label}</Text>
                <Text variant="caption">{q.hint}</Text>
                <Row gap={spacing.sm} style={{ marginTop: 6 }}>
                  {[1, 2, 3, 4, 5].map(n => {
                    const on = (ratings[q.key] ?? 0) >= n;
                    return (
                      <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${q.label}: ${n} of 5`} accessibilityState={{ selected: ratings[q.key] === n, disabled: submitted }} disabled={submitted} onPress={() => setRatings(r => ({ ...r, [q.key]: n }))} style={styles.star} testID={`evaluation-${q.key}-${n}`}>
                        <Icon name="Star" size={26} color={on ? colors.gold500 : colors.inkFaint} />
                      </Pressable>
                    );
                  })}
                  <Text variant="caption" style={{ alignSelf: 'center' }}>{ratings[q.key] ? `${ratings[q.key]} / 5` : 'Not rated'}</Text>
                </Row>
              </View>
            ))}
          </Card>
          {submitted ? (
            ev.responses?.comments ? <Card><KeyValueRow label="Comments" value={ev.responses.comments} border={false} /></Card> : null
          ) : (
            <>
              <Input label="Comments (optional)" placeholder="What worked well? What could be improved?" value={comments} onChangeText={setComments} multiline maxLength={2000} style={{ minHeight: 100, textAlignVertical: 'top' }} testID="evaluation-comments" />
              <Button title="Submit evaluation" onPress={send} disabled={!complete} disabledReason="Rate all four categories to submit" loading={submit.isPending} testID="evaluation-submit" />
            </>
          )}
        </Stack>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  question: { paddingVertical: spacing.sm },
  questionBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  star: { minWidth: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
