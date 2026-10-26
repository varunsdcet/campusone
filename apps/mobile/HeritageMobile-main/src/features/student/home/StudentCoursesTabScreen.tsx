import React from 'react';
import { Screen, Text, Card, Stack, ListRow, DemoLabel, Row, Pill } from '../../../components';
import { spacing, colors } from '../../../theme';
import { Routes } from '../../../navigation/routes';
import type { StudentTabProps } from '../../../navigation/types';
import { useEnrolments } from '../catalogue/useCatalogue';
import { useQuery } from '@tanstack/react-query';
import { qk } from '../../../app/queryKeys';
import { useServices } from '../../../app/ServicesProvider';
import { useCurrentUserId } from '../../../state/sessionStore';
import { activeCourseCount, useCurrentTermLabel } from '../courses/useCourses';

/** Courses tab – clear entry points for Current Programs, My Courses and self-paced My Learning. */
export function StudentCoursesTabScreen({ navigation }: StudentTabProps<'StudentCoursesTab'>) {
  const termLabel = useCurrentTermLabel();
  const enrolments = useEnrolments();
  const s = useServices();
  const userId = useCurrentUserId();
  const sections = useQuery({ queryKey: qk.studentSections(userId), queryFn: () => s.courses.listStudentSections(userId) });
  return (
    <Screen testID="student-courses-tab" bottomInset={false}>
      <Text variant="displayLg" style={{ marginTop: spacing.sm }}>Courses</Text>
      <Text variant="body" style={{ marginBottom: spacing.md }}>Enrolled courses, the self-paced catalogue, and your learning.</Text>
      <DemoLabel text="Inferred hub screen" style={{ marginBottom: spacing.md }} />
      <Stack>
        <Card onPress={() => navigation.navigate(Routes.StudentMyCourses)} testID="courses-mycourses">
          <ListRow icon="BookOpen" title="My Courses" subtitle={`${activeCourseCount(sections.data) ?? '—'} active · timetables, instructors, materials`} right={termLabel ? <Pill label={termLabel} tone="green" small /> : undefined} onPress={() => navigation.navigate(Routes.StudentMyCourses)} />
        </Card>
        <Card onPress={() => navigation.navigate(Routes.StudentCatalogue)} testID="courses-catalogue">
          <ListRow icon="LibraryBig" title="Current Programs" subtitle="Vocational & trades catalogue · self-paced" onPress={() => navigation.navigate(Routes.StudentCatalogue)} />
        </Card>
        <Card onPress={() => navigation.navigate(Routes.StudentMyLearning)} testID="courses-mylearning">
          <ListRow icon="GraduationCap" title="My Learning" subtitle={`${enrolments.data?.length ?? 0} self-paced programme(s) · certificates`} onPress={() => navigation.navigate(Routes.StudentMyLearning)} />
        </Card>
        <Row>
          <Card style={{ flex: 1 }} padding={spacing.md} onPress={() => navigation.navigate(Routes.StudentAssignments)} testID="courses-assignments"><ListRow icon="ClipboardList" title="Assignments" chevron={false} /></Card>
          <Card style={{ flex: 1 }} padding={spacing.md} onPress={() => navigation.navigate(Routes.StudentAttendance)} testID="courses-attendance"><ListRow icon="CalendarCheck" title="Attendance" chevron={false} /></Card>
        </Row>
        <Row>
          <Card style={{ flex: 1 }} padding={spacing.md} onPress={() => navigation.navigate(Routes.StudentWorkshops)} testID="courses-workshops"><ListRow icon="Users" title="Workshops" chevron={false} /></Card>
          <Card style={{ flex: 1 }} padding={spacing.md} onPress={() => navigation.navigate(Routes.StudentProgramPlan)} testID="courses-plan"><ListRow icon="Route" title="Program Plan" chevron={false} /></Card>
        </Row>
        <Text variant="caption" color={colors.inkMuted}>Certificates for completed self-paced programmes live under My Learning.</Text>
      </Stack>
    </Screen>
  );
}
