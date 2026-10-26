import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Pill, Select, LoadingState, ErrorState, EmptyState, Icon, KeyValue, DemoLabel } from '../../../components';
import { colors, spacing } from '../../../theme';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps, InstructorTabProps } from '../../../navigation/types';
import { useInstructorSections, useAttendanceSummary } from '../useInstructor';
import { formatDate } from '../../../utils/format';
import type { SectionWithCourse } from '../../../services/contracts/academics';
import { useAppNavigation } from '../../../navigation/hooks';

export function InstructorMyCoursesScreen(_props: RootScreenProps<'InstructorMyCourses'> | InstructorTabProps<'InstructorCoursesTab'>) {
  const navigation = useAppNavigation();
  const sections = useInstructorSections();
  const [term, setTerm] = useState('all');
  const [status, setStatus] = useState('activeUpcoming');
  const terms = useMemo(() => Array.from(new Map((sections.data ?? []).map(s => [s.term.id, s.term])).values()), [sections.data]);
  const list = useMemo(() => (sections.data ?? []).filter(s => (term === 'all' || s.term.id === term) && (status === 'all' || (status === 'activeUpcoming' ? s.status !== 'Completed' : status === 'inProgress' ? s.status === 'In Progress' : status === 'upcoming' ? s.status === 'Upcoming' : s.status === 'Completed'))), [sections.data, term, status]);
  return (
    <Screen testID="instructor-my-courses" header={<ScreenHeader backLabel="My Courses" />} bottomInset={false}>
      <Stack>
        <Card padding={spacing.md}>
          <Select compact label="Filter term" value={term} onChange={setTerm} options={[{ value: 'all', label: 'All Terms' }, ...terms.map(t => ({ value: t.id, label: t.name }))]} testID="icourses-term" />
          <View style={{ height: spacing.sm }} />
          <Select compact label="Filter status" value={status} onChange={setStatus} options={[{ value: 'activeUpcoming', label: 'Active & Upcoming Courses' }, { value: 'inProgress', label: 'In Progress' }, { value: 'upcoming', label: 'Upcoming' }, { value: 'completed', label: 'Completed' }, { value: 'all', label: 'All' }]} testID="icourses-status" />
        </Card>
        {sections.isLoading ? <LoadingState /> : sections.error ? <ErrorState error={sections.error} onRetry={() => sections.refetch()} /> : !list.length ? <EmptyState icon="BookX" title="No courses match" /> : list.map(s => <SectionCard key={s.id} s={s} onOpen={() => navigation.navigate(Routes.InstructorCourseWorkspace, { sectionId: s.id })} />)}
        <DemoLabel text="Attendance & enrolment summaries derived from records" />
      </Stack>
    </Screen>
  );
}

function SectionCard({ s, onOpen }: { s: SectionWithCourse; onOpen: () => void }) {
  const att = useAttendanceSummary(s.id);
  return (
    <Card onPress={onOpen} testID={`isection-${s.id}`}>
      <Stack gap={spacing.sm}>
        <Row gap={4}><Text variant="overline" color={colors.green900} style={styles.courseCode}>{s.course.code} ({s.sectionCode})</Text><Icon name="ArrowUpRight" size={14} color={colors.green900} /></Row>
        <Text variant="titleMd">{s.course.title}</Text>
        <Row gap={6}><Icon name="IdCard" size={14} color={colors.inkMuted} /><Text variant="bodySm">Role: Instructor</Text></Row>
        <View style={styles.divider} />
        <Row wrap gap={spacing.md}>
          <KeyValue label="Delivery method" value={s.delivery} style={styles.kv} />
          <KeyValue label="Students" value={`Enrolled: ${s.enrolledCount}`} style={styles.kv} />
          <KeyValue label="Status" value={<Pill label={s.status} tone={s.status === 'In Progress' ? 'teal' : s.status === 'Upcoming' ? 'gold' : 'grey'} small />} style={styles.kv} />
          <KeyValue label="Location" value={s.location} style={styles.kv} />
        </Row>
        <View style={[styles.attendance, att.data?.lastTaken ? styles.attendanceTaken : styles.attendancePending]}>
          <View style={[styles.attendanceIcon, att.data?.lastTaken ? styles.attendanceIconTaken : styles.attendanceIconPending]}>
            <Icon name={att.data?.lastTaken ? 'Check' : 'Calendar'} size={16} color={att.data?.lastTaken ? colors.success600 : colors.warning600} />
          </View>
          <View style={styles.attendanceCopy}>
            <Text variant="overline" color={att.data?.lastTaken ? colors.success600 : colors.warning600}>Attendance</Text>
            <Text variant="bodyStrong">{att.data?.lastTaken ? `Recorded through ${formatDate(att.data.lastTaken)}` : 'Not taken yet'}</Text>
            <Text variant="caption">{att.data?.lastTaken ? `${att.data.present}/${att.data.total} cumulative present · ${att.data.sessionsTaken} session${att.data.sessionsTaken === 1 ? '' : 's'}` : 'Attendance can be submitted after the first class.'}</Text>
          </View>
        </View>
        <View style={styles.schedule}><Row gap={6}><Icon name="Calendar" size={14} color={colors.green900} /><Text variant="label">{s.startDate || s.endDate ? `${formatDate(s.startDate)} - ${formatDate(s.endDate)}` : 'Dates TBA'}</Text></Row><Row gap={6}><Icon name="Clock" size={14} color={colors.green900} /><Text variant="bodySm">{s.scheduleLabel}</Text></Row></View>
      </Stack>
    </Card>
  );
}

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: colors.border },
  courseCode: { fontSize: 13 },
  kv: { width: '46%', minWidth: 0 },
  attendance: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: 14, borderWidth: 1, padding: spacing.md },
  attendanceTaken: { backgroundColor: colors.green50, borderColor: colors.success100 },
  attendancePending: { backgroundColor: colors.warning100, borderColor: colors.warning100 },
  attendanceIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  attendanceIconTaken: { backgroundColor: colors.success100 },
  attendanceIconPending: { backgroundColor: colors.surface },
  attendanceCopy: { flex: 1, minWidth: 0, gap: 2 },
  schedule: { backgroundColor: colors.surfaceMuted, borderRadius: 14, padding: spacing.md, gap: spacing.xs },
});
