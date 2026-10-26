import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, DateField, ErrorState, Icon, InlineError, Input, LoadingState, Pill, ProgressBar, Row, Screen, ScreenHeader, Stack, StatTile, Text } from '../../../components';
import { colors, radius, spacing } from '../../../theme';
import { useServices } from '../../../app/ServicesProvider';
import { qk } from '../../../app/queryKeys';
import { useCurrentUser } from '../../../state/sessionStore';
import { toISODate } from '../../../utils/format';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import type { PlannerDraft, PlannerStudySession } from '../../../services/contracts/planner';

type SectionKey = 'classes' | 'due' | 'study';

const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

export function MyDayScreen({ navigation }: RootScreenProps<'StudentMyDay'>) {
  const services = useServices();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const contentTop = useRef(0);
  const sectionTop = useRef<Partial<Record<SectionKey, number>>>({});
  const scrollTo = (section: SectionKey) => {
    const y = sectionTop.current[section];
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, contentTop.current + y - spacing.md), animated: true });
  };
  const trackSection = (section: SectionKey) => (e: { nativeEvent: { layout: { y: number } } }) => { sectionTop.current[section] = e.nativeEvent.layout.y; };
  const user = useCurrentUser();
  const qc = useQueryClient();
  const [date, setDate] = useState(toISODate(new Date()));
  const [goal, setGoal] = useState('Balance my next deadlines and help me study consistently.');
  const [dailyMinutes, setDailyMinutes] = useState('120');
  const [manualTitle, setManualTitle] = useState('Review course notes');
  const [manualMinutes, setManualMinutes] = useState('50');
  const [draft, setDraft] = useState<PlannerDraft | null>(null);
  const [saved, setSaved] = useState(false);
  const key = qk.plannerDay(user.id, date);
  const day = useQuery({ queryKey: key, queryFn: () => services.planner.myDay(date) });
  useEffect(() => { if (day.data && !day.data.offline) services.planner.syncReminders().catch(() => undefined); }, [day.data, services.planner]);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const generate = useMutation({
    mutationFn: () => services.planner.generate({ startDate: date, days: 7, dailyMinutes: Number(dailyMinutes), goal }),
    onSuccess: value => { setDraft(value); setSaved(false); },
  });
  const replan = useMutation({
    mutationFn: () => services.planner.generate({ startDate: date, days: 7, dailyMinutes: Number(dailyMinutes), goal: 'Replan my missed study work around my remaining classes and deadlines.', mode: 'replan' }),
    onSuccess: value => { setDraft(value); setSaved(false); },
  });
  const save = useMutation({
    mutationFn: () => services.planner.saveDraft(draft!),
    onSuccess: async () => { setSaved(true); setDraft(null); await refresh(); },
  });
  const add = useMutation({
    mutationFn: () => services.planner.addSession({
      title: manualTitle.trim(),
      scheduledAt: new Date(`${date}T18:00:00`).toISOString(),
      durationMinutes: Number(manualMinutes),
    }),
    onSuccess: async () => { setManualTitle('Review course notes'); await refresh(); },
  });
  const status = useMutation({
    mutationFn: ({ id, value }: { id: string; value: PlannerStudySession['status'] }) => services.planner.setSessionStatus(id, value),
    onSuccess: refresh,
  });
  const [focusPreset, setFocusPreset] = useState<25 | 50>(25);
  const [activeFocus, setActiveFocus] = useState<{ id: string; title: string; minutes: number; endsAt: number } | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const startFocus = useMutation({
    mutationFn: (session?: PlannerStudySession) => services.planner.startFocus({ title: session?.title ?? 'Focus session', durationMinutes: session?.durationMinutes ?? focusPreset, studySessionId: session?.id }),
    onSuccess: (focus, session) => {
      const minutes = session?.durationMinutes ?? focusPreset;
      setActiveFocus({ id: focus.id, title: session?.title ?? 'Focus session', minutes, endsAt: Date.now() + minutes * 60_000 });
      setRemainingSeconds(minutes * 60);
    },
  });
  const completeFocus = useMutation({
    mutationFn: () => services.planner.completeFocus(activeFocus!.id),
    onSuccess: () => setActiveFocus(null),
  });
  useEffect(() => {
    if (!activeFocus) return;
    const update = () => setRemainingSeconds(Math.max(0, Math.ceil((activeFocus.endsAt - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [activeFocus]);
  const countdown = `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`;

  const attendanceRisk = useMemo(() => (day.data?.attendance ?? []).filter(row => row.rate < row.targetPercent), [day.data?.attendance]);
  const editDraftSession = (index: number, patch: Partial<PlannerDraft['draft']['sessions'][number]>) => setDraft(current => current ? {
    ...current,
    draft: { ...current.draft, sessions: current.draft.sessions.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row) },
  } : current);
  const removeDraftSession = (index: number) => setDraft(current => current ? {
    ...current,
    draft: { ...current.draft, sessions: current.draft.sessions.filter((_, rowIndex) => rowIndex !== index) },
  } : current);

  return (
    <Screen testID="student-my-day" scrollRef={scrollRef}>
      <ScreenHeader backLabel="Back" />
      <Row justify="space-between" align="flex-end">
        <View style={{ flex: 1 }}>
          <Text variant="overline" color={colors.coral600}>SMART STUDENT PLANNER</Text>
          <Text variant="displayLg">My Day</Text>
          <Text variant="bodySm">Official college activity and your private study plan, together.</Text>
        </View>
        <View style={styles.aiMark}><Icon name="Sparkles" size={22} color={colors.gold600} /></View>
      </Row>

      <DateField label="Plan date" value={date} onChange={setDate} testID="my-day-date" />
      {day.isLoading ? <LoadingState /> : day.error ? <ErrorState error={day.error} onRetry={() => day.refetch()} /> : day.data ? (
        <View onLayout={e => { contentTop.current = e.nativeEvent.layout.y; }}>
        <Stack>
          <Row align="stretch" style={styles.summaryRow}>
            <StatTile style={styles.summaryTile} label="CLASSES" value={day.data.summary.classes} icon="BookOpen" onPress={() => scrollTo('classes')} testID="my-day-tile-classes" />
            <StatTile style={styles.summaryTile} label="DUE" value={day.data.summary.assignments + day.data.summary.tasks} icon="Clock" onPress={() => scrollTo('due')} testID="my-day-tile-due" />
            <StatTile style={styles.summaryTile} label="STUDY" value={day.data.summary.studySessions} icon="Brain" onPress={() => scrollTo('study')} testID="my-day-tile-study" />
          </Row>
          {day.data.offline ? <Card tone="warning"><Text variant="bodyStrong">Offline view · showing the last synced planner data from {day.data.cachedAt ? new Date(day.data.cachedAt).toLocaleString() : 'this device'}.</Text></Card> : null}

          {activeFocus ? (
            <Card tone="dark" testID="active-focus-card">
              <Stack gap={spacing.sm}>
                <Row justify="space-between"><Pill label="FOCUS ACTIVE" tone="gold" small /><Icon name="Timer" color={colors.gold500} /></Row>
                <Text variant="displaySm" color={colors.white}>{activeFocus.title}</Text>
                <Text variant="displayLg" color={colors.gold500}>{countdown}</Text>
                <Text variant="bodySm" color={colors.green100}>{activeFocus.minutes}-minute private productivity session</Text>
                <Button title="Finish Focus Session" variant="gold" loading={completeFocus.isPending} onPress={() => completeFocus.mutate()} testID="finish-focus" />
              </Stack>
            </Card>
          ) : (
            <Card tone="dark">
              <Stack gap={spacing.sm}>
                <Text variant="overline" color={colors.gold500}>DEEP WORK</Text>
                <Text variant="displaySm" color={colors.white}>Ready for a focused 25 minutes?</Text>
                <Text variant="bodySm" color={colors.green100}>Focus activity is private and never changes your academic grade.</Text>
                <Row><Button title="25 min" size="sm" fullWidth={false} variant={focusPreset === 25 ? 'gold' : 'outline'} onPress={() => setFocusPreset(25)} /><Button title="50 min" size="sm" fullWidth={false} variant={focusPreset === 50 ? 'gold' : 'outline'} onPress={() => setFocusPreset(50)} /></Row>
                <Button title="Start Focus Session" variant="gold" loading={startFocus.isPending} onPress={() => startFocus.mutate(undefined)} testID="start-focus" />
              </Stack>
            </Card>
          )}

          <View onLayout={trackSection('classes')}>
          <AgendaCard title="Today’s classes" icon="CalendarDays" empty="No classes scheduled.">
            {day.data.classes.map(row => <AgendaRow key={row.id} title={row.title} meta={`${row.courseCode} · ${timeLabel(row.startsAt)}${row.location ? ` · ${row.location}` : ''}`} tone="green" />)}
          </AgendaCard>
          </View>
          <View onLayout={trackSection('due')}>
          <AgendaCard title="Deadlines & required tasks" icon="ListChecks" empty="Nothing due today.">
            {day.data.assignments.map(row => <AgendaRow key={row.id} title={row.title} meta={`${row.courseCode} · due ${timeLabel(row.dueAt)}`} tone="coral" onPress={() => navigation.navigate(Routes.StudentAssignmentDetails, { assignmentId: row.id })} testID={`my-day-assignment-${row.id}`} />)}
            {day.data.tasks.map(row => <AgendaRow key={row.id} title={row.title} meta={row.detail ?? 'Required task'} tone="gold" />)}
          </AgendaCard>
          </View>

          <View onLayout={trackSection('study')}>
          <AgendaCard title="Planned study" icon="Brain" empty="No study blocks yet. Add one or ask AI below.">
            {day.data.studySessions.map(row => (
              <Card key={row.id} tone={row.status === 'completed' ? 'green' : row.status === 'missed' ? 'danger' : 'muted'} padding={spacing.md}>
                <Stack gap={spacing.sm}>
                  <Row justify="space-between">
                    <View style={{ flex: 1 }}><Text variant="bodyStrong">{row.title}</Text><Text variant="caption">{timeLabel(row.scheduledAt)} · {row.durationMinutes} min · {row.source === 'ai_reviewed' ? 'AI reviewed' : 'Manual'}</Text></View>
                    <Pill label={row.status} tone={row.status === 'completed' ? 'green' : row.status === 'missed' ? 'red' : 'grey'} small />
                  </Row>
                  {row.status === 'planned' ? <Row>
                    <Button title="Focus" size="sm" fullWidth={false} variant="outline" onPress={() => startFocus.mutate(row)} />
                    <Button title="Done" size="sm" fullWidth={false} onPress={() => status.mutate({ id: row.id, value: 'completed' })} />
                    <Button title="Missed" size="sm" fullWidth={false} variant="ghost" onPress={() => status.mutate({ id: row.id, value: 'missed' })} />
                  </Row> : null}
                </Stack>
              </Card>
            ))}
          </AgendaCard>
          </View>

          <Card tone={attendanceRisk.length ? 'warning' : 'green'}>
            <Stack gap={spacing.sm}>
              <Row><Icon name="CalendarCheck" color={attendanceRisk.length ? colors.warning600 : colors.success600} /><Text variant="titleSm">Attendance predictor</Text></Row>
              {day.data.attendance.length ? day.data.attendance.map(row => (
                <View key={row.sectionId} style={{ gap: spacing.xs }}>
                  <Row justify="space-between"><Text variant="bodyStrong">{row.courseCode}</Text><Text variant="bodyStrong">{row.rate}%</Text></Row>
                  <ProgressBar value={row.rate} color={row.rate < row.targetPercent ? colors.warning600 : colors.success600} />
                  <Text variant="caption">Target {row.targetPercent}% · safely miss {row.canMiss} · recovery attendance {row.neededConsecutive}</Text>
                </View>
              )) : <Text variant="bodySm">Attendance records will appear after your teacher submits them.</Text>}
              <Text variant="caption">Official attendance remains unchanged; this is a mathematical planning estimate.</Text>
            </Stack>
          </Card>

          <Card tone="coral">
            <Stack>
              <Row><View style={styles.spark}><Icon name="Sparkles" color={colors.coral600} /></View><View style={{ flex: 1 }}><Text variant="titleSm">AI Study Planner</Text><Text variant="caption">Uses official classes, deadlines and tasks. You review before saving.</Text></View></Row>
              <Input label="Your goal" value={goal} onChangeText={setGoal} multiline maxLength={500} counter={goal.length} testID="planner-goal" />
              <Input label="Minutes available per day" value={dailyMinutes} onChangeText={setDailyMinutes} keyboardType="number-pad" testID="planner-minutes" />
              <InlineError error={generate.error} />
              <Button title="Plan My Week with AI" icon={<Icon name="Wand" color={colors.white} />} loading={generate.isPending} disabled={!goal.trim() || Number(dailyMinutes) < 30 || Number(dailyMinutes) > 480} onPress={() => generate.mutate()} testID="generate-study-plan" />
              <InlineError error={replan.error} />
              <Button title="Replan Missed Work" variant="outline" loading={replan.isPending} disabled={Number(dailyMinutes) < 30 || Number(dailyMinutes) > 480} onPress={() => replan.mutate()} testID="replan-missed-work" />
            </Stack>
          </Card>

          {draft ? (
            <Card tone="surface" selected testID="planner-draft-review">
              <Stack>
                <Row justify="space-between"><View style={{ flex: 1 }}><Text variant="overline">REVIEW BEFORE SAVE</Text><Text variant="displaySm">{draft.draft.title}</Text></View><Pill label="AI DRAFT" tone="coral" small /></Row>
                <Text variant="bodySm">{draft.draft.rationale}</Text>
                {draft.draft.sessions.map((row, index) => (
                  <Card key={`${row.scheduledAt}-${index}`} tone="muted" padding={spacing.md}>
                    <Stack gap={spacing.sm}>
                      <Input label={`Session ${index + 1}`} value={row.title} maxLength={140} onChangeText={title => editDraftSession(index, { title })} />
                      <Text variant="caption">{dayLabel(row.scheduledAt)} · {timeLabel(row.scheduledAt)} · {row.durationMinutes} min</Text>
                      <Row>
                        <Button title="−15 min" size="sm" fullWidth={false} variant="outline" disabled={row.durationMinutes <= 15} onPress={() => editDraftSession(index, { durationMinutes: Math.max(15, row.durationMinutes - 15) })} />
                        <Button title="+15 min" size="sm" fullWidth={false} variant="outline" disabled={row.durationMinutes >= 180} onPress={() => editDraftSession(index, { durationMinutes: Math.min(180, row.durationMinutes + 15) })} />
                        <Button title="Remove" size="sm" fullWidth={false} variant="ghost" onPress={() => removeDraftSession(index)} />
                      </Row>
                    </Stack>
                  </Card>
                ))}
                <InlineError error={save.error} />
                <Row><Button title="Discard" variant="ghost" onPress={() => setDraft(null)} /><Button title="Save Reviewed Plan" loading={save.isPending} disabled={!draft.draft.sessions.length || draft.draft.sessions.some(row => !row.title.trim())} onPress={() => save.mutate()} testID="save-study-plan" /></Row>
              </Stack>
            </Card>
          ) : null}
          {saved ? <Card tone="green"><Text variant="bodyStrong" color={colors.success600}>Study plan saved. Your My Day blocks are now synced.</Text></Card> : null}

          <Card>
            <Stack>
              <Text variant="titleSm">Quick add study block</Text>
              <Text variant="caption">Adds a private block at 6:00 PM on the selected date.</Text>
              <Input label="Study topic" value={manualTitle} onChangeText={setManualTitle} maxLength={140} testID="manual-study-title" />
              <Input label="Duration (minutes)" value={manualMinutes} onChangeText={setManualMinutes} keyboardType="number-pad" testID="manual-study-minutes" />
              <InlineError error={add.error} />
              <Button title="Add to My Day" variant="outline" loading={add.isPending} disabled={!manualTitle.trim() || Number(manualMinutes) < 15 || Number(manualMinutes) > 180} onPress={() => add.mutate()} testID="add-study-session" />
            </Stack>
          </Card>
        </Stack>
        </View>
      ) : null}
    </Screen>
  );
}

function AgendaCard({ title, icon, empty, children }: { title: string; icon: React.ComponentProps<typeof Icon>['name']; empty: string; children: React.ReactNode }) {
  const count = React.Children.count(children);
  return <Card><Stack gap={spacing.sm}><Row><Icon name={icon} color={colors.green700} /><Text variant="titleSm">{title}</Text></Row>{count ? children : <Text variant="bodySm">{empty}</Text>}</Stack></Card>;
}

function AgendaRow({ title, meta, tone, onPress, testID }: { title: string; meta: string; tone: 'green' | 'coral' | 'gold'; onPress?: () => void; testID?: string }) {
  const color = tone === 'coral' ? colors.coral500 : tone === 'gold' ? colors.gold500 : colors.green500;
  const content = <><View style={[styles.line, { backgroundColor: color }]} /><View style={{ flex: 1 }}><Text variant="bodyStrong">{title}</Text><Text variant="caption">{meta}</Text></View>{onPress ? <Icon name="ChevronRight" size={18} color={colors.green700} /> : null}</>;
  if (!onPress) return <View style={styles.agenda} testID={testID}>{content}</View>;
  return <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}, ${meta}`} style={({ pressed }) => [styles.agenda, pressed ? { opacity: 0.6 } : null]}>{content}</Pressable>;
}

const styles = StyleSheet.create({
  aiMark: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gold100 },
  summaryRow: { width: '100%', justifyContent: 'center' },
  summaryTile: { flex: 1, minWidth: 0, alignItems: 'center' },
  spark: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  agenda: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.md, paddingVertical: spacing.sm },
  line: { width: 4, borderRadius: 2 },
});
