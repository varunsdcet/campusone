import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, Input, ChipRow, LoadingState, ErrorState, EmptyState, Icon, BottomSheet, ListRow } from '../../../components';
import { colors, spacing } from '../../../theme';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useAssignments, useCurrentTermLabel } from '../courses/useCourses';
import { formatDateTime } from '../../../utils/format';
import type { AssignmentWithContext } from '../../../services/contracts/academics';
import { useSettings } from '../../auth/useAuth';

type Filter = 'all' | 'upcoming' | 'graded' | 'draft';

export const STATUS_TONE: Record<AssignmentWithContext['derivedStatus'], { tone: 'coral' | 'green' | 'purple' | 'blue' | 'red' | 'gold'; label: string }> = {
  upcoming: { tone: 'coral', label: 'Upcoming' },
  graded: { tone: 'green', label: 'Graded' },
  draft: { tone: 'purple', label: 'Draft' },
  submitted: { tone: 'blue', label: 'Submitted' },
  late: { tone: 'red', label: 'Late' },
  returned: { tone: 'gold', label: 'Returned' },
};

/** Status pill; unsubmitted work whose submission window has closed shows as overdue (live rules). */
export function statusBadge(a: AssignmentWithContext): { tone: 'coral' | 'green' | 'purple' | 'blue' | 'red' | 'gold'; label: string } {
  if (a.rules && !a.rules.open && (a.derivedStatus === 'upcoming' || a.derivedStatus === 'draft')) {
    const notYet = a.rules.availableFrom && new Date(a.rules.availableFrom).getTime() > Date.now();
    return notYet ? { tone: 'gold', label: 'Not open yet' } : { tone: 'red', label: a.derivedStatus === 'draft' ? 'Closed · not submitted' : 'Overdue' };
  }
  return STATUS_TONE[a.derivedStatus];
}

export function AssignmentsScreen({ navigation, route }: RootScreenProps<'StudentAssignments'>) {
  const termLabel = useCurrentTermLabel();
  const assignments = useAssignments();
  const settings = useSettings();
  const [filter, setFilter] = useState<Filter>(route.params?.filter ?? 'all');
  const [query, setQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [menu, setMenu] = useState(false);
  const data = useMemo(() => assignments.data ?? [], [assignments.data]);
  const counts = { upcoming: data.filter(a => a.derivedStatus === 'upcoming').length, graded: data.filter(a => a.derivedStatus === 'graded').length, draft: data.filter(a => a.derivedStatus === 'draft').length };
  const filtered = useMemo(() => data.filter(a => {
    if (filter !== 'all' && a.derivedStatus !== filter) return false;
    const q = query.trim().toLowerCase();
    return !q || a.title.toLowerCase().includes(q) || a.section.course.code.toLowerCase().includes(q) || a.section.course.title.toLowerCase().includes(q);
  }).sort((a, b) => (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9')), [data, filter, query]);
  const tz = settings.data?.timeZone;
  const header = (
    <Stack gap={spacing.sm} style={{ marginBottom: spacing.md }}>
      <Row justify="space-between"><Text variant="displayLg">Assignments</Text>{termLabel ? <Pill label={termLabel} tone="green" small /> : null}</Row>
      <Text variant="body">View upcoming, graded, and draft assignments across your courses.</Text>
      {showSearch ? <Input testID="assignments-search" placeholder="Search by course or assignment..." leftIcon="Search" value={query} onChangeText={setQuery} autoFocus /> : null}
      <ChipRow options={[{ value: 'all', label: 'All' }, { value: 'upcoming', label: 'Upcoming', count: counts.upcoming }, { value: 'graded', label: 'Graded', count: counts.graded }, { value: 'draft', label: 'Draft', count: counts.draft }]} value={filter} onChange={setFilter} testID="assignments-filter" />
      <Row justify="space-between"><Text variant="bodySm">Showing {filtered.length} assignment{filtered.length === 1 ? '' : 's'}</Text><Text variant="caption">{counts.upcoming} upcoming · {counts.graded} graded · {counts.draft} draft</Text></Row>
    </Stack>
  );
  return (
    <Screen scroll={false} padded={false} testID="assignments-screen" header={<ScreenHeader actions={[{ icon: 'Search', accessibilityLabel: 'Search assignments', onPress: () => setShowSearch(v => !v), testID: 'assignments-search-toggle' }, { icon: 'EllipsisVertical', accessibilityLabel: 'More', onPress: () => setMenu(true) }]} />}>
      {assignments.isLoading ? <LoadingState /> : assignments.error ? <ErrorState error={assignments.error} onRetry={() => assignments.refetch()} /> : (
        <FlatList data={filtered} keyExtractor={a => a.id} contentContainerStyle={styles.list} ListHeaderComponent={header} keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<EmptyState icon="ClipboardX" title="No assignments here" message={filter === 'all' ? 'Nothing has been assigned yet.' : `No ${filter} assignments.`} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item: a }) => {
            const st = statusBadge(a);
            const closed = a.rules ? !a.rules.open : false;
            return (
              <Card testID={`assignment-${a.id}`} onPress={() => navigation.navigate(Routes.StudentAssignmentDetails, { assignmentId: a.id })}>
                <Stack gap={spacing.sm}>
                  <Row justify="space-between"><Text variant="titleMd" style={{ flex: 1 }}>{a.title}</Text><Pill label={st.label} tone={st.tone} small /></Row>
                  <Row gap={6}><Icon name="BookOpen" size={14} color={colors.inkMuted} /><Text variant="bodySm">{a.section.course.code} · {a.section.course.title}</Text></Row>
                  <Row gap={6}><Icon name="Calendar" size={14} color={colors.inkMuted} /><Text variant="bodySm">{a.dueAt ? `Due ${formatDateTime(a.dueAt, tz)}` : 'Due date not set'}</Text></Row>
                  <View style={styles.divider} />
                  <Row justify="space-between">
                    <View style={{ flex: 1 }}>{a.derivedStatus === 'graded' && a.mark ? <Pill label={`Score: ${a.mark.score} / ${a.points}`} tone="green" small /> : a.derivedStatus === 'draft' ? <Pill label="Unsubmitted submission" tone="purple" small /> : (a.derivedStatus === 'submitted' || a.derivedStatus === 'late') && a.submission?.receiptId ? <Pill label={`Receipt ${a.submission.receiptId}`} tone="blue" small /> : a.description ? <Text variant="caption" style={{ fontStyle: 'italic' }} numberOfLines={2}>{a.description.split('.')[0]}</Text> : null}</View>
                    <Button title={a.derivedStatus === 'graded' ? 'View Grade →' : a.derivedStatus === 'draft' && !closed ? 'Edit Draft →' : 'Open →'} variant={a.derivedStatus === 'graded' ? 'outline' : 'primary'} size="sm" fullWidth={false} onPress={() => navigation.navigate(Routes.StudentAssignmentDetails, { assignmentId: a.id })} />
                  </Row>
                </Stack>
              </Card>
            );
          }}
        />
      )}
      <BottomSheet visible={menu} onClose={() => setMenu(false)} title="Assignments">
        <ListRow icon="BookOpen" title="My Courses" onPress={() => { setMenu(false); navigation.navigate(Routes.StudentMyCourses); }} />
        <ListRow icon="CalendarDays" title="Schedule" onPress={() => { setMenu(false); navigation.navigate(Routes.StudentTabs, { screen: Routes.StudentScheduleTab }); }} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({ list: { paddingHorizontal: spacing.lg, paddingBottom: 60 }, divider: { height: 1, backgroundColor: colors.border } });
