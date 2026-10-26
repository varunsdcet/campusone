import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Pill, LoadingState, ErrorState, EmptyState, KeyValue, StatTile, DemoLabel, InfoBanner } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useEvaluations, useEvaluation } from '../useInstructor';
import { formatDate, formatDateTime } from '../../../utils/format';

export function EvaluationsScreen({ navigation }: RootScreenProps<'InstructorEvaluations'>) {
  const q = useEvaluations();
  return (
    <Screen testID="evaluations" header={<ScreenHeader backLabel="Course evaluations" />}>
      <Stack>
        <Text variant="displayMd" style={{ textTransform: 'uppercase' }}>Course Evaluation Results</Text>
        <Text variant="bodySm">{q.data?.length ?? 0} course evaluations</Text>
        {q.isLoading ? <LoadingState /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? <EmptyState icon="MessageSquareText" title="No evaluations" /> : q.data.map(ev => (
          <Card key={ev.id} onPress={() => navigation.navigate(Routes.InstructorEvaluationDetails, { sectionId: ev.sectionId })} testID={`eval-${ev.sectionId}`}>
            <Row justify="space-between"><Text variant="titleMd">{ev.section.course.code} ({ev.section.sectionCode})</Text>{ev.responses.length ? <Pill label={`${ev.responses.length} responses`} tone="green" small /> : <Pill label="No responses" tone="grey" small />}</Row>
            <Text variant="bodySm">{ev.section.course.title}</Text>
            <Row style={{ marginTop: spacing.sm }}><KeyValue label="Evaluation" value={ev.evaluationName} style={{ flex: 1.3 }} /><KeyValue label="Dates" value={ev.section.startDate ? formatDate(ev.section.startDate) : 'TBA'} style={{ flex: 1 }} /><KeyValue label="Schedule" value={ev.section.scheduleLabel.split(',')[0]} style={{ flex: 0.8 }} /></Row>
          </Card>
        ))}
        <DemoLabel text="Historical offerings have no responses; ACSW 500 has demo responses" />
      </Stack>
    </Screen>
  );
}

export function EvaluationDetailsScreen({ route }: RootScreenProps<'InstructorEvaluationDetails'>) {
  const q = useEvaluation(route.params.sectionId);
  const ev = q.data;
  const avg = ev?.responses.length ? ev.responses.reduce((a, r) => a + r.rating, 0) / ev.responses.length : null;
  const comments = ev?.responses.filter(r => r.comment.trim()) ?? [];
  return (
    <Screen testID="evaluation-details" header={<ScreenHeader backLabel="Back" />}>
      {q.isLoading ? <LoadingState /> : !ev ? <ErrorState error={q.error ?? new Error('Evaluation not found')} /> : (
        <Stack>
          <Text variant="displayMd">{ev.section.course.code} · Evaluation Results</Text>
          <Text variant="bodySm">{ev.section.course.code.replace(/\s/g, '')} · {ev.section.sectionCode}</Text>
          <Row><StatTile label="Overall rating" value={avg !== null ? avg.toFixed(1) : '—'} sub={avg !== null ? 'out of 5' : 'No submitted ratings yet'} /><StatTile label="Response rate" value={ev.invited ? `${Math.round((ev.responses.length / ev.invited) * 100)}%` : '0%'} sub={`${ev.responses.length}/${ev.invited} submitted`} /></Row>
          <Row><StatTile label="Pending" value={Math.max(0, ev.invited - ev.responses.length)} sub="Awaiting student response" /><StatTile label="Section" value={ev.section.sectionCode} sub={ev.section.course.code.replace(/\s/g, '')} /></Row>
          <InfoBanner tone="grey" icon="EyeOff" title={isMockMode() ? 'Anonymity policy (demo)' : 'Anonymity policy'} text="Responses are shown without student identities. Comments are only displayed when at least 3 responses exist, so individuals cannot be inferred." />
          <Card>
            <Text variant="titleSm" style={{ marginBottom: spacing.sm }}>Student Comments</Text>
            {!comments.length || ev.responses.length < 3 ? <View style={styles.empty}><Text variant="bodySm">{ev.responses.length < 3 && ev.responses.length ? 'Comments are hidden until 3 or more responses are submitted.' : 'No submitted comments yet.'}</Text><Text variant="caption">Results appear after students complete end-of-course evaluations.</Text></View> : comments.map(c => (
              <View key={c.id} style={styles.comment}><Row justify="space-between"><Pill label={`${c.rating} / 5`} tone="green" small /><Text variant="caption">{formatDateTime(c.submittedAt)}</Text></Row><Text variant="body" style={{ marginTop: 4 }}>{c.comment}</Text></View>
            ))}
          </Card>
          <DemoLabel text="Anonymous demo responses" />
        </Stack>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ empty: { backgroundColor: colors.surfaceMuted, borderRadius: 10, padding: spacing.md, gap: 2 }, comment: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border } });
