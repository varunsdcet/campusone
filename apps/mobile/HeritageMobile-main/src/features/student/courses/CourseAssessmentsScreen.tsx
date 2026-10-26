import React, { useState } from 'react';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, EmptyState, KeyValueRow, InfoBanner, ConfirmSheet } from '../../../components';
import { spacing } from '../../../theme';
import type { RootScreenProps } from '../../../navigation/types';
import type { CourseAssessment } from '../../../services/contracts';
import { useCourseAssessments } from './useCourseLearning';
import { useSettings } from '../../auth/useAuth';
import { useClockTick } from '../../shared/hooks';
import { formatCountdown, formatDateTime } from '../../../utils/format';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';

const STATE: Record<CourseAssessment['state'], { label: string; tone: 'green' | 'grey' | 'coral' | 'blue' | 'gold' }> = {
  upcoming: { label: 'Upcoming', tone: 'blue' },
  open: { label: 'Open', tone: 'green' },
  in_progress: { label: 'In progress', tone: 'coral' },
  submitted: { label: 'Submitted', tone: 'grey' },
  closed: { label: 'Closed', tone: 'grey' },
};

/** Timed quizzes/exams for one enrolled section (GET /student/assessments, start, submit). */
export function CourseAssessmentsScreen({ route }: RootScreenProps<'StudentCourseAssessments'>) {
  const { sectionId } = route.params;
  const { list, start, submit } = useCourseAssessments(sectionId);
  const tz = useSettings().data?.timeZone;
  const now = useClockTick(1000);
  const [expires, setExpires] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<CourseAssessment | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});

  const onStart = async (a: CourseAssessment) => {
    try {
      const r = await start.mutateAsync(a.id);
      setExpires(e => ({ ...e, [a.id]: r.expiresAt }));
      toast(`Attempt started. Submit before ${formatDateTime(r.expiresAt, tz)}.`, 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const onSubmit = async () => {
    const a = confirm;
    if (!a?.openAttemptId) return;
    try {
      const r = await submit.mutateAsync(a.openAttemptId);
      setDone(d => ({ ...d, [a.id]: r.submittedAt }));
      toast('Assessment submitted', 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setConfirm(null);
    }
  };

  return (
    <Screen testID="course-assessments" header={<ScreenHeader title="Assessments" backLabel="Course" />} refreshing={list.isRefetching} onRefresh={() => list.refetch()}>
      {list.isLoading ? <LoadingState /> : list.error ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : !list.data?.length ? (
        <EmptyState icon="ClipboardCheck" title="No published assessments" message="When your instructor publishes a timed quiz or exam for this course, it will appear here." testID="assessments-empty" />
      ) : (
        <Stack>
          <Text variant="bodySm">Timed quizzes and exams for this course. Each attempt has a time limit — submit before it runs out.</Text>
          {list.data.map(a => {
            const st = STATE[a.state];
            const expiresAt = expires[a.id];
            const left = expiresAt ? Math.max(0, Math.round((new Date(expiresAt).getTime() - now) / 1000)) : null;
            return (
              <Card key={a.id} padding={spacing.md} testID={`assessment-${a.id}`}>
                <Row justify="space-between" align="flex-start"><Text variant="titleSm" style={{ flex: 1 }}>{a.title}</Text><Pill label={st.label} tone={st.tone} small dot /></Row>
                <KeyValueRow label="Opens" value={formatDateTime(a.opensAt, tz)} />
                <KeyValueRow label="Closes" value={formatDateTime(a.closesAt, tz)} />
                <KeyValueRow label="Time limit" value={`${a.durationMinutes} min`} />
                <KeyValueRow label="Attempts" value={`${a.attemptCount} of ${a.maxAttempts}`} border={false} />
                {done[a.id] ? <InfoBanner tone="green" icon="CircleCheck" text={`Submitted ${formatDateTime(done[a.id], tz)}. Your instructor releases the mark under Grades & Progress.`} /> : null}
                {a.state === 'in_progress' ? (
                  <Stack gap={spacing.sm}>
                    {left !== null ? <Text variant="label">Time left: {formatCountdown(left)}</Text> : null}
                    <Button title="Submit attempt" variant="coral" onPress={() => setConfirm(a)} disabled={!a.openAttemptId} testID={`assessment-submit-${a.id}`} />
                  </Stack>
                ) : a.state === 'open' ? (
                  <Button title={a.attemptCount ? 'Start new attempt' : 'Start attempt'} onPress={() => onStart(a)} loading={start.isPending && start.variables === a.id} testID={`assessment-start-${a.id}`} />
                ) : null}
              </Card>
            );
          })}
        </Stack>
      )}
      <ConfirmSheet visible={Boolean(confirm)} onClose={() => setConfirm(null)} onConfirm={onSubmit} title="Submit this attempt?" message="You cannot change your attempt after submitting." confirmLabel="Submit" loading={submit.isPending} />
    </Screen>
  );
}
