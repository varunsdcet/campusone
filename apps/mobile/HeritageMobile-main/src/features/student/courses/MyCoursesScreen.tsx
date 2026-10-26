import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View, Pressable } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Pill, Input, Select, LoadingState, ErrorState, EmptyState, Icon, DemoLabel } from '../../../components';
import { colors, spacing } from '../../../theme';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useStudentSections, useCurrentTermLabel } from './useCourses';
import { formatDate } from '../../../utils/format';
import type { SectionWithCourse } from '../../../services/contracts/academics';
import { useAppNavigation } from '../../../navigation/hooks';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const STATUS_OPTIONS = [{ value: 'activeUpcoming', label: 'Active & Upcoming' }, { value: 'inProgress', label: 'In Progress' }, { value: 'upcoming', label: 'Upcoming' }, { value: 'completed', label: 'Completed' }, { value: 'all', label: 'All statuses' }];

export function MyCoursesScreen(_props: RootScreenProps<'StudentMyCourses'>) {
  const termLabel = useCurrentTermLabel();
  const navigation = useAppNavigation();
  const sections = useStudentSections();
  const [query, setQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [term, setTerm] = useState('all');
  const [status, setStatus] = useState('activeUpcoming');
  const terms = useMemo(() => Array.from(new Map((sections.data ?? []).map(s => [s.term.id, s.term])).values()), [sections.data]);
  const filtered = useMemo(() => (sections.data ?? []).filter(s => {
    if (term !== 'all' && s.term.id !== term) return false;
    if (status === 'activeUpcoming' && s.status === 'Completed') return false;
    if (status === 'inProgress' && s.status !== 'In Progress') return false;
    if (status === 'upcoming' && s.status !== 'Upcoming') return false;
    if (status === 'completed' && s.status !== 'Completed') return false;
    const q = query.trim().toLowerCase();
    if (q && !(s.course.code.toLowerCase().includes(q) || s.course.title.toLowerCase().includes(q) || s.instructorName.toLowerCase().includes(q))) return false;
    return true;
  }), [sections.data, term, status, query]);
  const header = (
    <Stack gap={spacing.sm} style={{ marginBottom: spacing.md }}>
      <Row justify="space-between"><Text variant="displayLg">My Courses</Text>{termLabel ? <Pill label={termLabel} tone="green" small /> : null}</Row>
      <Text variant="body">View your enrolled courses, class timetables, assigned instructors, and campus locations.</Text>
      {showSearch ? <Input testID="courses-search" placeholder="Search by code, title, or instructor..." leftIcon="Search" value={query} onChangeText={setQuery} autoFocus /> : null}
      <Card padding={spacing.md}>
        <Row>
          <View style={{ flex: 1 }}><Select compact label="Filter term" value={term} onChange={setTerm} testID="courses-term" options={[{ value: 'all', label: 'All Terms' }, ...terms.map(t => ({ value: t.id, label: t.name }))]} /></View>
          <View style={{ flex: 1 }}><Select compact label="Filter status" value={status} onChange={setStatus} testID="courses-status" options={STATUS_OPTIONS} /></View>
        </Row>
        <Row justify="space-between" style={{ marginTop: spacing.sm }}>
          <Text variant="bodySm">Showing {filtered.length} enrolled course{filtered.length === 1 ? '' : 's'}</Text>
          <Pressable accessibilityRole="button" onPress={() => { setQuery(''); setTerm('all'); setStatus('activeUpcoming'); }} testID="courses-reset"><Text variant="label" color={colors.coral600}>Reset Filters</Text></Pressable>
        </Row>
      </Card>
    </Stack>
  );
  return (
    <Screen scroll={false} padded={false} testID="my-courses" header={<ScreenHeader backLabel="Back" actions={[{ icon: 'Search', accessibilityLabel: 'Search courses', onPress: () => setShowSearch(v => !v), testID: 'courses-search-toggle' }]} />}>
      {sections.isLoading ? <LoadingState /> : sections.error ? <ErrorState error={sections.error} onRetry={() => sections.refetch()} /> : (
        <FlatList data={filtered} keyExtractor={s => s.id} contentContainerStyle={styles.list} ListHeaderComponent={header} keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<EmptyState icon="BookX" title="No courses match" message="Try another term or status filter." />}
          renderItem={({ item }) => <SectionCard s={item} onPress={() => navigation.navigate(Routes.StudentCourseDetails, { sectionId: item.id })} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListFooterComponent={<View style={{ marginTop: spacing.md }}><DemoLabel text="Course list derived from section enrolment fixtures" /></View>}
        />
      )}
      <Pressable accessibilityRole="button" accessibilityLabel="Ask Campus One" onPress={() => navigation.navigate(Routes.AskHeritage)} style={styles.fab} testID="courses-ask-heritage"><Icon name="Sparkles" size={16} color={colors.white} /><Text variant="label" color={colors.white}>Ask Campus One</Text></Pressable>
    </Screen>
  );
}

function SectionCard({ s, onPress }: { s: SectionWithCourse; onPress: () => void }) {
  const roomTba = /TBA|TBD/i.test(s.location);
  return (
    <Card onPress={onPress} testID={`section-${s.id}`}>
      <Stack gap={spacing.sm}>
        <Row justify="space-between" wrap>
          <Row><Text variant="titleMd">{s.course.code}</Text><Pill label={s.sectionCode} tone="grey" small /></Row>
          <Pill label={s.status} tone={s.status === 'In Progress' ? 'green' : s.status === 'Upcoming' ? 'gold' : 'grey'} small dot />
        </Row>
        <Text variant="titleSm" color={colors.green900}>{s.course.title}</Text>
        <Row gap={6}><Icon name="UserRound" size={14} color={colors.inkMuted} /><Text variant="bodySm">{s.instructorName} • Instructor</Text></Row>
        <Row gap={6}><Icon name="MapPin" size={14} color={colors.inkMuted} />{roomTba ? <Pill label="Room TBA" tone="coral" small /> : <Text variant="bodySm">{s.delivery} · {s.location}</Text>}</Row>
        <View style={styles.schedule}>
          <Row gap={6}><Icon name="Calendar" size={14} color={colors.green900} /><Text variant="label">{formatDate(s.startDate, { dot: true })} – {formatDate(s.endDate, { dot: true })}</Text></Row>
          {s.meetingDays.map(d => <Row key={d} justify="space-between"><Text variant="bodySm">{DAY_NAMES[d]}</Text><Text variant="bodySm">{s.scheduleLabel.split(', ')[1] ?? s.scheduleLabel}</Text></Row>)}
        </View>
        <Row justify="space-between">
          <Text variant="caption">{s.assessmentLabel}</Text>
          <Row gap={4}><Text variant="label" color={colors.green900}>View course details</Text><Icon name="ChevronRight" size={14} color={colors.green900} /></Row>
        </Row>
      </Stack>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  schedule: { backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: spacing.md, gap: 4 },
  fab: { position: 'absolute', right: 16, bottom: 28, flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: colors.green900, paddingHorizontal: 16, minHeight: 46, borderRadius: 999 },
});
