import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Screen, Text, Card, Row, Stack, Button, Pill, Icon, Avatar, LoadingState, ErrorState, DemoLabel, StatTile } from '../../../components';
import { colors, spacing } from '../../../theme';
import { useCurrentUser } from '../../../state/sessionStore';
import { Routes } from '../../../navigation/routes';
import type { InstructorTabProps } from '../../../navigation/types';
import { useDashboard } from '../useInstructor';
import { navigateTo, useAppNavigation } from '../../../navigation/hooks';
import { useServices } from '../../../app/ServicesProvider';
import { useQueryClient } from '@tanstack/react-query';
import { qk } from '../../../app/queryKeys';
import { Logo } from '../../auth/Brand';
import { toISODate } from '../../../utils/format';
import { clock } from '../../../utils/clock';
import { isMockMode } from '../../../config/appConfig';

export function DashboardScreen(_props: InstructorTabProps<'InstructorHomeTab'>) {
  const user = useCurrentUser();
  const navigation = useAppNavigation();
  const dash = useDashboard();
  const s = useServices();
  const qc = useQueryClient();
  const d = dash.data;
  const mock = isMockMode();
  const hour = clock.nowDate().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return (
    <Screen testID="instructor-dashboard" bottomInset={false} refreshing={dash.isFetching} onRefresh={() => dash.refetch()}>
      <Row justify="space-between" style={{ marginBottom: spacing.md }}>
        <Logo size={40} />
        <Row>
          <Pressable testID="dash-notifications" accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => navigation.navigate(Routes.Notifications)} style={styles.iconBtn}><Icon name="Bell" size={22} />{d?.unreadNotifications ? <View style={styles.dot} /> : null}</Pressable>
          <Pressable testID="dash-profile" accessibilityRole="button" accessibilityLabel="My profile" onPress={() => navigation.navigate(Routes.InstructorProfile)}><Avatar initials={user.avatarInitials} /></Pressable>
        </Row>
      </Row>
      <Text variant="titleLg" style={{ fontSize: 24 }}>{greeting}, {user.firstName}</Text>
      <Text variant="body">Here's what's happening with your courses today.</Text>
      <Row style={{ marginVertical: spacing.sm }}><Pill label={`Instructor | ${user.email}`} tone="green" small dot /></Row>
      {dash.isLoading ? <LoadingState /> : dash.error || !d ? <ErrorState error={dash.error} onRetry={() => dash.refetch()} /> : (
        <Stack>
          {mock || s.instructor.ai ? <Card tone="dark" padding={spacing.md}>
            <Row gap={spacing.md}>
              <View style={styles.bolt}><Icon name="Zap" size={20} color={colors.gold500} /></View>
              <Text variant="bodyStrong" color={colors.white} style={{ flex: 1 }}>{mock ? 'Draft lesson reviews & feedback' : 'Draft lessons, narrated videos & full courses with AI'}</Text>
              <Button title="Draft Assistant" variant="gold" size="sm" fullWidth={false} onPress={() => navigation.navigate(Routes.InstructorAiDraft)} testID="dash-draft" />
            </Row>
            {s.instructor.ai ? <Row justify="flex-end" style={{ marginTop: spacing.sm }}><Button title="AI Course Builder" variant="outline" size="sm" fullWidth={false} onPress={() => navigation.navigate(Routes.InstructorAiCourse)} testID="dash-ai-course" /></Row> : null}
          </Card> : null}
          <Row gap={spacing.sm} align="stretch">
            <StatTile label="Students" value={d.studentCount} icon="Users" style={styles.metric} />
            <StatTile label="Courses" value={d.courseCount} icon="BookOpen" accent={colors.info600} style={styles.metric} />
            <StatTile label="Sections" value={d.sectionCount} icon="Layers" accent={colors.purple600} style={styles.metric} />
          </Row>
          <Text variant="overline">Instructor shortcuts</Text>
          <Row>
            <Shortcut icon="ClipboardCheck" title="Grade Submissions" sub="Review student work" badge={d.pendingGradeSections ? `${d.pendingGradeSections} pending` : undefined} onPress={() => navigation.navigate(Routes.InstructorGradesSubmission)} testID="dash-grades" />
            <Shortcut icon="CalendarCheck" title="Take Attendance" sub="Daily roll check" onPress={() => navigation.navigate(Routes.InstructorCourseAttendance, { date: toISODate(clock.nowDate()) })} testID="dash-attendance" />
          </Row>
          <Row>
            <Shortcut icon="CalendarDays" title="View Schedule" sub={mock ? 'Fall 2026 Calendar' : 'Pending schedule changes'} onPress={() => navigation.navigate(Routes.InstructorPendingSchedules)} testID="dash-schedule" />
            {mock && d.officeHours ? <Shortcut icon="Video" title="Office Hours" sub={d.officeHours.roomReady ? 'Virtual room ready' : 'Room closed'} badge={d.officeHours.label} badgeTone="green" onPress={() => navigation.navigate(Routes.InstructorLiveRoom, { sectionId: d.sections[0]?.id ?? '', roomId: 'office-hours' })} testID="dash-office" /> : d.officeHours ? <Shortcut icon="Clock" title="Office Hours" sub={[d.officeHours.label, d.officeHours.mode].filter(Boolean).join(' · ')} testID="dash-office" /> : <View style={{ flex: 1 }} />}
          </Row>
          <Card padding={spacing.md}>
            <Row justify="space-between" style={{ marginBottom: spacing.sm }}><Row gap={6}><Text variant="titleSm">To-do</Text><Pill label={`${d.todos.length} tasks`} tone="coral" small /></Row><Button title="View all" variant="ghost" size="sm" fullWidth={false} onPress={() => navigation.navigate(Routes.InstructorGradesSubmission)} /></Row>
            {d.todos.length ? d.todos.map(t => (
              <Row key={t.id} gap={spacing.sm} style={styles.todo}>
                <View style={[styles.prio, { backgroundColor: t.priority === 'high' ? colors.danger500 : t.priority === 'medium' ? colors.warning600 : colors.green900 }]} />
                <View style={{ flex: 1 }}><Text variant="bodyStrong">{t.title}</Text><Row gap={4} wrap>{t.tag ? <Pill label={t.tag} tone={t.tag === 'In review' ? 'yellow' : 'teal'} small /> : null}<Text variant="caption">{t.subtitle}</Text></Row></View>
                <Button title={t.action === 'open' ? 'Open' : t.action === 'review' ? 'Review' : 'Check'} variant="subtle" size="sm" fullWidth={false} onPress={() => navigateTo(navigation, t.link.route, t.link.params)} testID={`todo-${t.id}`} />
                {t.id.startsWith('notification:') ? <Pressable accessibilityRole="button" accessibilityLabel="Mark notification read" onPress={async () => { await s.instructor.completeTodo(t.id); qc.invalidateQueries({ queryKey: qk.dashboard(user.id) }); }} hitSlop={8} testID={`todo-done-${t.id}`}><Icon name="CircleCheck" size={18} color={colors.inkFaint} /></Pressable> : null}
              </Row>
            )) : <Text variant="bodySm">All caught up.</Text>}
          </Card>
          <Row justify="space-between"><Text variant="titleSm">My Sections ({d.sections.length} active)</Text><Button title="View all" variant="ghost" size="sm" fullWidth={false} onPress={() => navigation.navigate(Routes.InstructorMyCourses)} /></Row>
          {d.sections.map(sec => (
            <Card key={sec.id} padding={spacing.md} testID={`dash-section-${sec.id}`}>
              <Row justify="space-between"><Text variant="overline" color={colors.green900}>{sec.course.code}</Text><Pill label={sec.gradeStatus} tone={sec.gradeStatus === 'Submission required' ? 'yellow' : sec.gradeStatus === 'Submitted' ? 'blue' : 'green'} small /></Row>
              <Text variant="titleSm">{sec.course.title}</Text>
              <Text variant="caption">Section {sec.sectionCode} · Term {sec.term.code}</Text>
              <Row justify="space-between" style={{ marginTop: spacing.sm }}><Row gap={4}><View style={styles.greenDot} /><Text variant="bodySm">{sec.enrolledCount} enrolled</Text></Row><Button title="Open Section" size="sm" fullWidth={false} onPress={() => navigation.navigate(Routes.InstructorCourseWorkspace, { sectionId: sec.id })} testID={`dash-open-${sec.id}`} /></Row>
            </Card>
          ))}
          <DemoLabel text="Metrics derived from section/enrolment fixtures (design showed 2,171 students)" />
        </Stack>
      )}
    </Screen>
  );
}

function Shortcut({ icon, title, sub, badge, badgeTone = 'coral', onPress, testID }: { icon: React.ComponentProps<typeof Icon>['name']; title: string; sub: string; badge?: string; badgeTone?: 'coral' | 'green'; onPress?: () => void; testID?: string }) {
  return (
    <Card style={{ flex: 1 }} padding={spacing.md} onPress={onPress} testID={testID}>
      <Row justify="space-between"><Icon name={icon} size={20} color={colors.green700} />{badge ? <Pill label={badge} tone={badgeTone} small /> : null}</Row>
      <Text variant="bodyStrong" style={{ marginTop: spacing.sm }}>{title}</Text>
      <Text variant="caption">{sub}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 8, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.coral500 },
  bolt: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.green700, alignItems: 'center', justifyContent: 'center' },
  metric: { flex: 1, minWidth: 0, paddingHorizontal: spacing.sm },
  todo: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  prio: { width: 8, height: 8, borderRadius: 4 },
  greenDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success600 },
});
