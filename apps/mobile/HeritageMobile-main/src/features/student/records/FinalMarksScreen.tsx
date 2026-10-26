import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, EmptyState, Icon, StatTile, Select, BottomSheet, KeyValueRow, DemoLabel } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import type { RootScreenProps } from '../../../navigation/types';
import { useFinalMarks, useRecordMutations } from './useRecords';
import { useCurrentUser } from '../../../state/sessionStore';
import { formatDate } from '../../../utils/format';
import type { FinalMark } from '../../../domain/types';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';
import { useFileActions } from '../../shared/useFileActions';
import { useQuery } from '@tanstack/react-query';
import { useServices } from '../../../app/ServicesProvider';
import { qk } from '../../../app/queryKeys';

const GRADE_TONE: Record<FinalMark['grade'], 'green' | 'dark' | 'grey' | 'red' | 'blue'> = { A: 'dark', 'A-': 'dark', 'B+': 'green', B: 'green', 'B-': 'green', 'C+': 'blue', C: 'blue', D: 'red', F: 'red', IP: 'green', W: 'grey', I: 'red' };

export function FinalMarksScreen(_props: RootScreenProps<'StudentFinalMarks'>) {
  const user = useCurrentUser();
  const marks = useFinalMarks();
  const s = useServices();
  const terms = useQuery({ queryKey: qk.terms(), queryFn: () => s.courses.listTerms() });
  const m = useRecordMutations();
  const files = useFileActions();
  const [term, setTerm] = useState('all');
  const [sort, setSort] = useState<'latest' | 'oldest' | 'code'>('latest');
  const [detail, setDetail] = useState<FinalMark | null>(null);
  const [filters, setFilters] = useState(false);
  const data = useMemo(() => marks.data ?? [], [marks.data]);
  const list = useMemo(() => data.filter(f => term === 'all' || f.termId === term).sort((a, b) => sort === 'latest' ? b.startDate.localeCompare(a.startDate) : sort === 'oldest' ? a.startDate.localeCompare(b.startDate) : a.courseCode.localeCompare(b.courseCode)), [data, term, sort]);
  const summary = useMemo(() => {
    const graded = data.filter(f => f.gradePoints !== undefined && f.scorePct !== undefined);
    const credits = graded.reduce((a, f) => a + f.credits, 0);
    const avg = graded.length ? graded.reduce((a, f) => a + f.scorePct!, 0) / graded.length : 0;
    const cgpa = credits ? graded.reduce((a, f) => a + f.gradePoints! * f.credits, 0) / credits : 0;
    return { credits, avg, cgpa };
  }, [data]);
  const enrolledTerms = Array.from(new Set(data.map(f => f.termId))).map(id => terms.data?.find(t => t.id === id)).filter(Boolean);
  return (
    <Screen testID="final-marks" header={<ScreenHeader backLabel="Back" actions={[{ icon: 'SlidersHorizontal', accessibilityLabel: 'Filters', onPress: () => setFilters(f => !f), testID: 'marks-filters' }]} />}>
      {marks.isLoading ? <LoadingState /> : marks.error ? <ErrorState error={marks.error} onRetry={() => marks.refetch()} /> : (
        <Stack>
          <Select label="Filter program" leftIcon="GraduationCap" value={user.student?.programId ?? ''} onChange={() => undefined} options={[{ value: user.student?.programId ?? '', label: user.student?.programName ?? '' }]} testID="marks-program" />
          <Select label="Filter term" value={term} onChange={setTerm} options={[{ value: 'all', label: 'All Enrolled Terms' }, ...enrolledTerms.map(t => ({ value: t!.id, label: t!.name }))]} testID="marks-term" />
          {filters ? <Select label="Sort" value={sort} onChange={setSort} options={[{ value: 'latest', label: 'Latest first' }, { value: 'oldest', label: 'Oldest first' }, { value: 'code', label: 'Course code' }]} testID="marks-sort" /> : null}
          <Card>
            <Row justify="space-between"><Text variant="overline">Active program record</Text><Pill label="Active" tone="green" small dot /></Row>
            <Text variant="displaySm" style={{ marginVertical: 4 }}>{user.student?.programName}</Text>
            <Row wrap align="stretch">
              <StatTile label="Earned credits" value={summary.credits.toFixed(2)} style={styles.summaryTile} />
              <StatTile label="Average score" value={`${summary.avg.toFixed(2)}%`} style={styles.summaryTile} />
              <StatTile label="CGPA" value={summary.cgpa.toFixed(2)} dark style={styles.summaryTile} />
            </Row>
            <Text variant="caption" style={{ marginTop: spacing.sm }}>Good Standing · In-progress credits excluded from cumulative calculations until official grade audit{isMockMode() ? ' (demo rule)' : ''}.</Text>
          </Card>
          <Row justify="space-between" wrap><Text variant="displaySm">Course Results</Text><Row wrap><Pill label={`${list.length} Courses`} tone="grey" small /><Button title={sort === 'latest' ? '⇅ Latest' : sort === 'oldest' ? '⇅ Oldest' : '⇅ Code'} variant="outline" size="sm" fullWidth={false} onPress={() => setSort(s0 => (s0 === 'latest' ? 'oldest' : s0 === 'oldest' ? 'code' : 'latest'))} testID="marks-sort-toggle" /></Row></Row>
          {!list.length ? <EmptyState icon="GraduationCap" title="No results for this term" /> : list.map(f => (
            <Card key={f.id} padding={spacing.md} onPress={() => setDetail(f)} testID={`final-mark-${f.id}`}>
              <Row justify="space-between" wrap>
                <Row gap={6} wrap style={{ flexShrink: 1 }}><Text variant="titleMd">{f.courseCode}</Text>{f.honors ? <Pill label="Honors" tone="gold" small /> : null}</Row>
                <Pill label={f.grade} tone={GRADE_TONE[f.grade]} small />
              </Row>
              <Text variant="bodySm" numberOfLines={1}>{f.courseTitle}</Text>
              <Row gap={6} style={{ marginTop: 4 }}><Icon name="Calendar" size={12} color={colors.inkMuted} /><Text variant="caption" style={{ flexShrink: 1 }}>{formatDate(f.startDate, { dot: true })} – {formatDate(f.endDate, { dot: true })}</Text></Row>
              <Row wrap style={styles.tiles}>
                <View style={styles.tile}><Text variant="overline">Credits</Text><Text variant="label">{f.credits.toFixed(2)}</Text></View>
                <View style={styles.tile}><Text variant="overline">Grade pts</Text><Text variant="label">{f.gradePoints?.toFixed(2) ?? '—'}</Text></View>
                <View style={styles.tile}><Text variant="overline">Score</Text><Text variant="label">{f.scorePct !== undefined ? `${f.scorePct.toFixed(2)}%` : '—'}</Text></View>
              </Row>
              <Row justify="space-between" wrap style={{ marginTop: 6 }}><Text variant="caption" style={{ flexShrink: 1 }} color={f.status === 'Withdrawn' ? colors.inkMuted : f.status === 'Incomplete Extension' ? colors.danger600 : f.status === 'Distinction' ? colors.gold600 : colors.success600}>{f.status === 'In Progress' ? '• In Progress' : f.status === 'Completed' ? '✓ Completed' : f.status === 'Withdrawn' ? 'ⓘ Course Withdrawn' : f.status === 'Distinction' ? '🏆 Distinction' : 'Incomplete Extension'}</Text><Text variant="label" color={colors.green900}>Details ›</Text></Row>
            </Card>
          ))}
          <Card>
            <Text variant="titleSm" style={{ marginBottom: spacing.sm }}>Grading Key & Designations</Text>
            <Row wrap>{[['IP', 'In Progress'], ['W', 'Withdrawn'], ['I', 'Incomplete']].map(([k, v]) => <View key={k} style={styles.key}><Text variant="titleSm">{k}</Text><Text variant="caption">{v}</Text></View>)}</Row>
            <Text variant="caption" style={{ marginVertical: spacing.sm }}>IP, W and I are status designations, not numeric zeroes; they are excluded from the average and CGPA. Official sealed transcripts and formal grade dispute petitions are requested through Registrar Services.</Text>
            <Button title={isMockMode() ? 'Request Official Transcript (mock request)' : 'Request Official Transcript'} icon={<Icon name="Download" size={16} color={colors.white} />} loading={m.requestTranscript.isPending} testID="marks-request-transcript" onPress={async () => { try { const r = await m.requestTranscript.mutateAsync(); toast(`Transcript request ${r.id} recorded (pending)`, 'success'); } catch (e) { toast(errorMessage(e), 'error'); } }} />
            {isMockMode() ? <Button title="Open unofficial sample transcript (PDF)" variant="outline" onPress={() => files.view('transcript')} style={{ marginTop: spacing.sm }} testID="marks-sample-transcript" /> : null}
          </Card>
          <DemoLabel text="Credits, average and CGPA derived from final-mark fixtures" />
        </Stack>
      )}
      <BottomSheet visible={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.courseCode} · ${detail.courseTitle}` : ''} testID="mark-detail">
        {detail ? (
          <>
            <KeyValueRow label="Grade" value={detail.grade} />
            <KeyValueRow label="Status" value={detail.status} />
            <KeyValueRow label="Credits" value={detail.credits.toFixed(2)} />
            <KeyValueRow label="Grade points" value={detail.gradePoints?.toFixed(2) ?? 'Not applicable'} />
            <KeyValueRow label="Score" value={detail.scorePct !== undefined ? `${detail.scorePct}%` : 'Not applicable'} />
            <KeyValueRow label="Dates" value={`${formatDate(detail.startDate)} – ${formatDate(detail.endDate)}`} border={false} />
          </>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { marginTop: spacing.sm, backgroundColor: colors.surfaceMuted, borderRadius: 10, padding: spacing.sm },
  tile: { flexGrow: 1, flexBasis: 76, minWidth: 76, alignItems: 'center' },
  summaryTile: { flexGrow: 1, flexBasis: 112, minWidth: 0 },
  key: { flexGrow: 1, flexBasis: 90, minWidth: 90, backgroundColor: colors.surfaceMuted, borderRadius: 10, padding: spacing.sm, alignItems: 'center' },
});
