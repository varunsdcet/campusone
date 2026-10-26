import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Screen, Text, Card, Row, Stack, Button, Pill, Icon, Avatar, ProgressBar, DemoLabel, ListRow } from '../../../components';
import { colors, spacing } from '../../../theme';
import { useCurrentUser } from '../../../state/sessionStore';
import { useServices } from '../../../app/ServicesProvider';
import { qk } from '../../../app/queryKeys';
import { Routes } from '../../../navigation/routes';
import type { StudentTabProps } from '../../../navigation/types';
import { useEnrolments } from '../catalogue/useCatalogue';
import { useSnapshot } from '../learning/useLearning';
import { formatDate, daysUntil } from '../../../utils/format';
import { useUnreadBadges } from '../../shared/useUnreadBadges';
import { Wordmark } from '../../auth/Brand';
import { activeCourseCount } from '../courses/useCourses';

/** Inferred supporting screen: student Home connects the supplied modules. */
export function StudentHomeScreen({ navigation }: StudentTabProps<'StudentHomeTab'>) {
  const user = useCurrentUser();
  const s = useServices();
  const badges = useUnreadBadges();
  const enrolments = useEnrolments();
  const sections = useQuery({ queryKey: qk.studentSections(user.id), queryFn: () => s.courses.listStudentSections(user.id) });
  const assignments = useQuery({ queryKey: qk.assignments(user.id), queryFn: () => s.assignments.listForStudent(user.id) });
  const tasks = useQuery({ queryKey: qk.tasks(user.id), queryFn: () => s.tasks.list(user.id) });
  const activeEnrolment = enrolments.data?.[0];
  const open = (assignments.data ?? []).filter(a => a.derivedStatus === 'upcoming' && (!a.dueAt || daysUntil(a.dueAt) >= 0));
  const upcoming = open.filter(a => a.dueAt).sort((a, b) => a.dueAt!.localeCompare(b.dueAt!)).slice(0, 3);
  const pendingTasks = (tasks.data ?? []).filter(t => t.status === 'pending').length;
  return (
    <Screen testID="student-home" bottomInset={false}>
      <Row justify="space-between" style={{ marginBottom: spacing.md }}>
        <Wordmark compact />
        <Row>
          <Pressable testID="home-notifications" accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => navigation.navigate(Routes.Notifications)} style={styles.iconBtn}>
            <Icon name="Bell" size={22} />
            {badges.notifications ? <View style={styles.dot} /> : null}
          </Pressable>
          <Pressable testID="home-profile" accessibilityRole="button" accessibilityLabel="Profile" onPress={() => navigation.navigate(Routes.StudentProfileTab)}>
            <Avatar initials={user.avatarInitials} />
          </Pressable>
        </Row>
      </Row>
      <Text variant="displayMd">Hello, {user.preferredName ?? user.firstName}</Text>
      <Text variant="body" style={{ marginBottom: spacing.md }}>{user.student?.programName} · {user.student?.studentNumber}</Text>
      <DemoLabel text="Inferred Home screen · synthetic data" style={{ marginBottom: spacing.md }} />
      <Stack>
        <Card tone="green" onPress={() => navigation.navigate(Routes.StudentMyDay)} testID="home-my-day">
          <Row justify="space-between">
            <View style={{ flex: 1 }}>
              <Text variant="overline" color={colors.coral600}>SMART STUDENT PLANNER</Text>
              <Text variant="displaySm">My Day</Text>
              <Text variant="bodySm">Classes, deadlines, attendance and AI study plan</Text>
            </View>
            <Icon name="Sparkles" size={28} color={colors.gold600} />
          </Row>
        </Card>
        {activeEnrolment ? <ContinueLearningCard programmeId={activeEnrolment.programmeId} onPress={() => navigation.navigate(Routes.StudentOutline, { programmeId: activeEnrolment.programmeId })} /> : (
          <Card tone="dark">
            <Stack gap={spacing.sm}>
              <Text variant="overline" color={colors.coral500}>Self-paced learning</Text>
              <Text variant="displaySm" color={colors.white}>Browse current programs</Text>
              <Button title="Open catalogue" variant="coral" onPress={() => navigation.navigate(Routes.StudentCatalogue)} />
            </Stack>
          </Card>
        )}
        <Row>
          <QuickTile icon="BookOpen" label="My Courses" value={`${activeCourseCount(sections.data) ?? '—'}`} onPress={() => navigation.navigate(Routes.StudentMyCourses)} testID="home-mycourses" />
          <QuickTile icon="ClipboardList" label="Assignments" value={`${open.length}`} sub="upcoming" onPress={() => navigation.navigate(Routes.StudentAssignments)} testID="home-assignments" />
        </Row>
        <Row>
          <QuickTile icon="ListChecks" label="Required Tasks" value={`${pendingTasks}`} sub="pending" onPress={() => navigation.navigate(Routes.StudentRequiredTasks)} testID="home-tasks" />
          <QuickTile icon="CalendarCheck" label="Attendance" value="View" onPress={() => navigation.navigate(Routes.StudentAttendance)} testID="home-attendance" />
        </Row>
        <Card>
          <Row justify="space-between" style={{ marginBottom: spacing.sm }}>
            <Text variant="titleSm">Upcoming deadlines</Text>
            <Button title="All" variant="ghost" size="sm" fullWidth={false} onPress={() => navigation.navigate(Routes.StudentAssignments)} />
          </Row>
          {upcoming.length ? upcoming.map(a => (
            <ListRow key={a.id} title={a.title} subtitle={`${a.section.course.code} · due ${formatDate(a.dueAt!)} · ${daysUntil(a.dueAt!)} days left`} icon="Clock" onPress={() => navigation.navigate(Routes.StudentAssignmentDetails, { assignmentId: a.id })} testID={`home-deadline-${a.id}`} />
          )) : <Text variant="bodySm">No upcoming deadlines.</Text>}
        </Card>
        <Card>
          <Text variant="titleSm" style={{ marginBottom: spacing.sm }}>Campus assistance</Text>
          <ListRow title="Ask Campus One" subtitle="Read-only records assistant" icon="Sparkles" onPress={() => navigation.navigate(Routes.AskHeritage)} testID="home-askheritage" />
          <ListRow title="My Workshops" subtitle="Register & join sessions" icon="Users" onPress={() => navigation.navigate(Routes.StudentWorkshops)} testID="home-workshops" />
          <ListRow title="Program Plan" subtitle="Curriculum pathway" icon="Route" onPress={() => navigation.navigate(Routes.StudentProgramPlan)} testID="home-plan" />
        </Card>
      </Stack>
    </Screen>
  );
}

function ContinueLearningCard({ programmeId, onPress }: { programmeId: string; onPress: () => void }) {
  const snap = useSnapshot(programmeId);
  const s = useServices();
  const programme = useQuery({ queryKey: qk.programme(programmeId), queryFn: () => s.catalogue.getProgramme(programmeId) });
  const next = snap.data?.nextActivityId ? programme.data?.chapters.flatMap(c => c.activities).find(a => a.id === snap.data!.nextActivityId) : undefined;
  const nextRelease = Object.values(snap.data?.gates ?? {}).find(g => g.releasesAt && !g.chapterReleased)?.releasesAt;
  return (
    <Card tone="dark" onPress={onPress} testID="home-continue">
      <Stack gap={spacing.sm}>
        <Row justify="space-between">
          <Pill label="Self-paced" tone="coral" small />
          <Text variant="caption" color={colors.green100}>{snap.data ? `${snap.data.completedCount}/${snap.data.totalCount} activities` : ''}</Text>
        </Row>
        <Text variant="displaySm" color={colors.white}>{programme.data?.title ?? 'Your programme'}</Text>
        <ProgressBar value={snap.data?.percent ?? 0} color={colors.gold500} track={colors.green700} />
        <Row justify="space-between">
          <Text variant="bodySm" color={colors.green100} style={{ flex: 1 }} numberOfLines={1}>{snap.data?.completedAll ? 'Course complete 🎉' : next ? `Continue: ${next.title}` : nextRelease ? `Next chapter opens ${formatDate(nextRelease)}` : 'Open outline'}</Text>
          <Icon name="ChevronRight" color={colors.white} />
        </Row>
      </Stack>
    </Card>
  );
}

function QuickTile({ icon, label, value, sub, onPress, testID }: { icon: React.ComponentProps<typeof Icon>['name']; label: string; value: string; sub?: string; onPress: () => void; testID?: string }) {
  return (
    <Card style={{ flex: 1 }} padding={spacing.md} onPress={onPress} testID={testID}>
      <Icon name={icon} size={20} color={colors.green700} />
      <Text variant="displaySm" style={{ marginTop: spacing.sm }}>{value}{sub ? <Text variant="caption"> {sub}</Text> : null}</Text>
      <Text variant="bodySm">{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 8, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.coral500 },
});
