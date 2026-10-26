import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, ErrorState, Icon, InlineError, Input, LoadingState, Pill, ProgressBar, Row, Screen, ScreenHeader, Select, Stack, StatTile, Text } from '../../../components';
import { useServices } from '../../../app/ServicesProvider';
import { qk } from '../../../app/queryKeys';
import { useCurrentUser } from '../../../state/sessionStore';
import { colors, radius, spacing } from '../../../theme';
import type { PlannerInsights, StudyAidItem, StudyArtifact } from '../../../services/contracts/planner';
import type { DegreeScenarioResult } from '../../../services/contracts/records';
import { shareFile, writeTextFile } from '../../shared/files';
import { useFileActions } from '../../shared/useFileActions';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { webUrl } from '../../../services/api/util';
import { toast } from '../../../state/uiStore';

function Header({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return <><ScreenHeader backLabel="Back" /><Text variant="overline" color={colors.coral600}>{eyebrow}</Text><Text variant="displayLg">{title}</Text><Text variant="bodySm">{body}</Text></>;
}

export function StudyAnalyticsScreen() {
  const services = useServices();
  const user = useCurrentUser();
  const query = useQuery({ queryKey: qk.plannerInsights(user.id), queryFn: services.planner.insights });
  const qc = useQueryClient();
  const [goalTitle, setGoalTitle] = useState('Build a consistent weekly study routine');
  const [weeklyMinutes, setWeeklyMinutes] = useState('300');
  const insightKey = qk.plannerInsights(user.id);
  const addGoal = useMutation({
    mutationFn: () => services.planner.addGoal({ title: goalTitle.trim(), weeklyTargetMinutes: Number(weeklyMinutes) }),
    onSuccess: goal => {
      qc.setQueryData<PlannerInsights>(insightKey, current => current ? { ...current, goals: [goal, ...current.goals.filter(row => row.id !== goal.id)] } : current);
      toast('Weekly study goal saved.', 'success');
      qc.invalidateQueries({ queryKey: insightKey }).catch(() => undefined);
    },
  });
  if (query.isLoading) return <Screen><ScreenHeader backLabel="Back" /><LoadingState /></Screen>;
  if (query.error || !query.data) return <Screen><ScreenHeader backLabel="Back" /><ErrorState error={query.error} onRetry={() => query.refetch()} /></Screen>;
  const { analytics, risks, attendance } = query.data;
  const activeGoal = query.data.goals[0];
  const unchangedGoal = !!activeGoal && activeGoal.title === goalTitle.trim() && activeGoal.weeklyTargetMinutes === Number(weeklyMinutes);
  return <Screen testID="study-analytics"><Stack>
    <Header eyebrow="STUDY INTELLIGENCE" title="Study Analytics" body="Private productivity insights calculated from your plan and official records." />
    <Row align="stretch"><StatTile style={{ flex: 1 }} label="FOCUS" value={`${analytics.focusMinutes}m`} /><StatTile style={{ flex: 1 }} label="STREAK" value={`${analytics.streakDays}d`} /><StatTile style={{ flex: 1 }} label="DONE" value={`${analytics.completionPercent}%`} /></Row>
    <Card tone="green"><Stack gap={spacing.sm}><Text variant="titleSm">Planned vs completed</Text><ProgressBar value={analytics.completionPercent} /><Text variant="caption">{analytics.completedStudyMinutes} of {analytics.plannedMinutes} planned minutes completed · {analytics.focusSessions} focus sessions</Text></Stack></Card>
    <Card><Stack><Text variant="titleSm">Weekly study goal</Text>{query.data.goals.slice(0, 1).map(goal => <Text key={goal.id} variant="bodySm">Active: {goal.title} · {goal.weeklyTargetMinutes} minutes/week</Text>)}<Input label="Goal" value={goalTitle} onChangeText={setGoalTitle} maxLength={140} /><Input label="Weekly minutes" value={weeklyMinutes} onChangeText={setWeeklyMinutes} keyboardType="number-pad" /><InlineError error={addGoal.error} /><Button title={activeGoal ? 'Update Weekly Goal' : 'Save Weekly Goal'} variant="outline" loading={addGoal.isPending} disabled={!goalTitle.trim() || Number(weeklyMinutes) < 30 || Number(weeklyMinutes) > 10080 || unchangedGoal} disabledReason={unchangedGoal ? 'Change the goal or weekly minutes before saving.' : undefined} onPress={() => addGoal.mutate()} testID="save-study-goal" /></Stack></Card>
    <Text variant="titleLg">Smart deadline risk</Text>
    {risks.length ? risks.map(risk => <Card key={risk.id} tone={risk.level === 'high' ? 'danger' : risk.level === 'medium' ? 'warning' : 'muted'}><Row justify="space-between"><View style={{ flex: 1 }}><Text variant="bodyStrong">{risk.title}</Text><Text variant="caption">{risk.detail}</Text></View><Pill label={risk.level.toUpperCase()} tone={risk.level === 'high' ? 'red' : risk.level === 'medium' ? 'gold' : 'green'} small /></Row></Card>) : <Card tone="green"><Text variant="bodyStrong">No immediate study risks detected.</Text></Card>}
    <Text variant="titleLg">Attendance recovery</Text>
    {attendance.map(row => <Card key={row.sectionId} tone={row.recoveryPossible ? 'surface' : 'danger'}><Stack gap={spacing.sm}><Row justify="space-between"><Text variant="bodyStrong">{row.courseCode}</Text><Text variant="bodyStrong">{row.rate}%</Text></Row><ProgressBar value={row.rate} color={row.recoveryPossible ? colors.success600 : colors.danger600} /><Text variant="caption">Best possible {row.bestPossible}% · {row.remainingClasses} scheduled classes remain</Text><Text variant="bodySm">{row.recoveryPossible ? `${row.neededConsecutive} consecutive attendance needed for ${row.targetPercent}% target.` : `${row.targetPercent}% target is not mathematically recoverable from currently scheduled classes.`}</Text></Stack></Card>)}
  </Stack></Screen>;
}

export function GradeCalculatorScreen() {
  const services = useServices();
  const user = useCurrentUser();
  const query = useQuery({ queryKey: qk.plannerInsights(user.id), queryFn: services.planner.insights });
  const progress = useQuery({ queryKey: ['degree-progress-mobile', user.id], queryFn: () => services.records.getDegreeProgress!(), enabled: Boolean(services.records.getDegreeProgress) });
  const [dropCode, setDropCode] = useState('');
  const [scenario, setScenario] = useState<DegreeScenarioResult>();
  const runScenario = useMutation({
    mutationFn: (save: boolean) => services.records.runDegreeScenario!({ dropCourseCodes: [dropCode.trim().toUpperCase()], save, label: save ? `Saved drop ${dropCode.trim().toUpperCase()}` : undefined }),
    onSuccess: (result, save) => { setScenario(result); toast(save ? 'Draft scenario sent for Registrar review.' : 'What-if scenario calculated.', 'success'); },
  });
  if (query.isLoading) return <Screen><ScreenHeader backLabel="Back" /><LoadingState /></Screen>;
  if (query.error || !query.data) return <Screen><ScreenHeader backLabel="Back" /><ErrorState error={query.error} onRetry={() => query.refetch()} /></Screen>;
  return <Screen testID="grade-calculator"><Stack>
    <Header eyebrow="WHAT-IF PLANNER" title="Grade Calculator" body="Published marks only. Targets are estimates and never modify your official grade." />
    <Card tone="green"><Row justify="space-between"><View><Text variant="overline">OFFICIAL TRANSCRIPT</Text><Text variant="titleSm">Current cumulative GPA</Text></View><Text variant="displaySm">{query.data.cumulativeGpa ?? '—'}</Text></Row></Card>
    {services.records.runDegreeScenario && progress.data && progress.data.programAssigned !== false ? <Card>
      <Stack gap={spacing.sm}>
        <Text variant="overline">Degree scenario review</Text>
        <Text variant="titleSm">What if I drop a course?</Text>
        <Text variant="bodySm">Run an estimate first. Save Draft sends the scenario to Registrar → Degree Scenario Review; it never changes enrolment automatically.</Text>
        <Input label="Course code" placeholder="e.g. CS201" value={dropCode} onChangeText={value => { setDropCode(value); setScenario(undefined); }} autoCapitalize="characters" />
        <Row align="stretch"><Button title="Run Scenario" variant="outline" style={{ flex: 1 }} disabled={!dropCode.trim()} loading={runScenario.isPending && runScenario.variables === false} onPress={() => runScenario.mutate(false)} /><Button title="Save for Review" style={{ flex: 1 }} disabled={!dropCode.trim() || !scenario} disabledReason={!scenario ? 'Run the scenario first' : undefined} loading={runScenario.isPending && runScenario.variables === true} onPress={() => runScenario.mutate(true)} /></Row>
        <InlineError error={progress.error || runScenario.error} />
        {scenario ? <Card tone="muted" padding={spacing.md}><Text variant="bodyStrong">{scenario.label}</Text>{scenario.impactSummary.map(line => <Text key={line} variant="caption">• {line}</Text>)}{scenario.scenarioId ? <Pill label="SAVED FOR REVIEW" tone="green" small /> : null}</Card> : null}
      </Stack>
    </Card> : null}
    {query.data.grades.map(course => <Card key={course.sectionId}><Stack gap={spacing.md}>
      <Row justify="space-between"><View style={{ flex: 1 }}><Text variant="titleSm">{course.courseCode}</Text><Text variant="caption">{course.courseTitle} · {course.credits} credits</Text></View><Pill label={course.currentPercent == null ? 'No marks' : `${course.currentPercent}%`} tone="green" /></Row>
      <Text variant="caption">Published weight {course.completedWeight}% · remaining weight {course.remainingWeight}%</Text>
      {course.scenarios.map(row => {
        const impossible = row.requiredOnRemaining != null && row.requiredOnRemaining > 100;
        const already = row.requiredOnRemaining != null && row.requiredOnRemaining <= 0;
        return <Card key={`${row.letter}-${row.targetPercent}`} tone={impossible ? 'danger' : 'muted'} padding={spacing.md}><Row justify="space-between"><View><Text variant="bodyStrong">Target {row.letter} · {row.targetPercent}%</Text><Text variant="caption">Course grade point {row.gradePoint ?? '—'}</Text></View><Text variant="bodyStrong" color={impossible ? colors.danger600 : colors.green900}>{row.requiredOnRemaining == null ? 'Final' : already ? 'Already secured' : impossible ? 'Not possible' : `${Math.max(0, row.requiredOnRemaining)}% needed`}</Text></Row></Card>;
      })}
      <Text variant="caption">Letter labels follow the grading scheme configured for this section/course.</Text>
    </Stack></Card>)}
  </Stack></Screen>;
}

export function StudyToolsScreen() {
  const services = useServices();
  const user = useCurrentUser();
  const sources = useQuery({ queryKey: qk.plannerSources(user.id), queryFn: services.planner.studySources });
  const [sectionId, setSectionId] = useState<string>();
  const [sourceId, setSourceId] = useState<string>();
  const [kind, setKind] = useState<'summary' | 'flashcards' | 'quiz' | 'checklist'>('summary');
  const [notes, setNotes] = useState('');
  const [artifact, setArtifact] = useState<StudyArtifact>();
  const selectedCourse = sources.data?.courses.find(row => row.sectionId === sectionId);
  const generate = useMutation({ mutationFn: () => services.planner.generateStudyAid({ sectionId: sectionId!, sourceId, kind, notes }), onSuccess: setArtifact });
  return <Screen testID="study-tools"><Stack>
    <Header eyebrow="GROUNDED AI" title="Notes & Flashcards" body="Generate study aids from an official topic/resource or your own notes. Every item carries a source reference." />
    {sources.isLoading ? <LoadingState /> : sources.error ? <ErrorState error={sources.error} onRetry={() => sources.refetch()} /> : <>
      <Select label="Course" value={sectionId} onChange={value => { setSectionId(value); setSourceId(undefined); }} options={(sources.data?.courses ?? []).map(row => ({ value: row.sectionId, label: `${row.courseCode} · ${row.courseTitle}` }))} />
      <Select label="Output" value={kind} onChange={setKind} options={[{ value: 'summary', label: 'Summary' }, { value: 'flashcards', label: 'Flashcards' }, { value: 'quiz', label: 'Practice quiz' }, { value: 'checklist', label: 'Revision checklist' }]} />
      <Select label="Official source (optional)" value={sourceId} onChange={setSourceId} placeholder="Use my notes" options={(selectedCourse?.sources ?? []).map(row => ({ value: row.id, label: row.title, description: row.reference }))} />
      <Input label="Your notes (optional with official source)" value={notes} onChangeText={setNotes} multiline maxLength={12000} counter={notes.length} />
      <InlineError error={generate.error} />
      <Button title={`Generate ${kind}`} loading={generate.isPending} disabled={!sectionId || (!sourceId && !notes.trim())} onPress={() => generate.mutate()} />
    </>}
    {artifact ? <Card tone="surface" selected testID="study-artifact"><Stack>
      <Row justify="space-between"><Text variant="displaySm" style={{ flex: 1 }}>{artifact.title}</Text><Pill label={artifact.kind.toUpperCase()} tone="coral" small /></Row>
      {artifact.kind === 'flashcards' ? <FlashcardDeck key={artifact.id} items={artifact.items} />
        : artifact.kind === 'quiz' ? <PracticeQuiz key={artifact.id} items={artifact.items} />
          : artifact.kind === 'checklist' ? <RevisionChecklist key={artifact.id} items={artifact.items} />
            : artifact.items.map((item, index) => <Card key={`${item.front}-${index}`} tone="muted" padding={spacing.md}><Text variant="bodyStrong">{item.front}</Text><Text variant="bodySm">{item.back}</Text></Card>)}
      <Text variant="caption">Source: {artifact.sources[0]?.reference ?? artifact.items[0]?.source}</Text>
    </Stack></Card> : null}
  </Stack></Screen>;
}

function FlashcardDeck({ items }: { items: StudyAidItem[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = items[index];
  const go = (next: number) => { setIndex(next); setFlipped(false); };
  return <Stack gap={spacing.sm}>
    <Text variant="caption">Card {index + 1} of {items.length} · tap the card to flip</Text>
    <Pressable testID="flashcard" accessibilityRole="button" accessibilityLabel={flipped ? `Answer: ${card.back}` : `Question: ${card.front}. Tap to show the answer.`} onPress={() => setFlipped(value => !value)} style={[styles.flashcard, flipped ? styles.flashcardBack : null]}>
      <Text variant="overline" color={flipped ? colors.green100 : colors.coral600}>{flipped ? 'ANSWER' : 'QUESTION'}</Text>
      <Text variant={flipped ? 'body' : 'titleSm'} color={flipped ? colors.white : colors.ink} style={{ textAlign: 'center' }}>{flipped ? card.back : card.front}</Text>
    </Pressable>
    <Row>
      <Button title="Previous" variant="outline" size="sm" fullWidth={false} disabled={index === 0} onPress={() => go(index - 1)} />
      <Button title={flipped ? 'Show question' : 'Show answer'} variant="ghost" size="sm" fullWidth={false} onPress={() => setFlipped(value => !value)} />
      <Button title="Next" size="sm" fullWidth={false} disabled={index === items.length - 1} onPress={() => go(index + 1)} />
    </Row>
  </Stack>;
}

function PracticeQuiz({ items }: { items: StudyAidItem[] }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const gradable = items.filter(item => item.options?.length && item.answerIndex !== undefined);
  const answered = Object.keys(answers).length;
  const correct = items.reduce((sum, item, index) => sum + (answers[index] !== undefined && answers[index] === item.answerIndex ? 1 : 0), 0);
  return <Stack gap={spacing.sm}>
    {items.map((item, index) => {
      const picked = answers[index];
      const done = picked !== undefined;
      if (!item.options?.length || item.answerIndex === undefined) {
        return <Card key={`${item.front}-${index}`} tone="muted" padding={spacing.md}><Stack gap={spacing.xs}>
          <Text variant="bodyStrong">{index + 1}. {item.front}</Text>
          {revealed[index] ? <Text variant="bodySm">{item.back}</Text> : <Button title="Show answer" variant="outline" size="sm" fullWidth={false} onPress={() => setRevealed(value => ({ ...value, [index]: true }))} />}
        </Stack></Card>;
      }
      return <Card key={`${item.front}-${index}`} tone="muted" padding={spacing.md} testID={`quiz-question-${index}`}><Stack gap={spacing.xs}>
        <Text variant="bodyStrong">{index + 1}. {item.front}</Text>
        {item.options.map((option, optionIndex) => {
          const isAnswer = optionIndex === item.answerIndex;
          const tone = !done ? null : isAnswer ? styles.optionCorrect : optionIndex === picked ? styles.optionWrong : null;
          return <Pressable key={optionIndex} testID={`quiz-${index}-option-${optionIndex}`} accessibilityRole="button" accessibilityState={{ disabled: done, selected: picked === optionIndex }} disabled={done} onPress={() => setAnswers(value => ({ ...value, [index]: optionIndex }))} style={[styles.option, tone]}>
            <Text variant="bodySm" color={colors.ink} style={{ flex: 1 }}>{String.fromCharCode(65 + optionIndex)}. {option}</Text>
            {done && isAnswer ? <Icon name="CircleCheck" size={18} color={colors.success600} /> : done && optionIndex === picked ? <Icon name="CircleX" size={18} color={colors.danger600} /> : null}
          </Pressable>;
        })}
        {done ? <Text variant="caption" color={picked === item.answerIndex ? colors.success600 : colors.danger600}>{picked === item.answerIndex ? 'Correct. ' : 'Not quite. '}{item.back}</Text> : null}
      </Stack></Card>;
    })}
    {gradable.length ? <Card tone={answered === gradable.length ? 'green' : 'outline'} padding={spacing.md}><Row justify="space-between">
      <Text variant="bodyStrong">{answered === gradable.length ? `Score: ${correct} / ${gradable.length}` : `Answered ${answered} of ${gradable.length}`}</Text>
      {answered ? <Button title="Try again" variant="ghost" size="sm" fullWidth={false} onPress={() => setAnswers({})} /> : null}
    </Row></Card> : null}
  </Stack>;
}

function RevisionChecklist({ items }: { items: StudyAidItem[] }) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  const count = Object.values(done).filter(Boolean).length;
  return <Stack gap={spacing.sm}>
    <Text variant="caption">{count} of {items.length} checked</Text>
    {items.map((item, index) => <Pressable key={`${item.front}-${index}`} accessibilityRole="checkbox" accessibilityState={{ checked: !!done[index] }} onPress={() => setDone(value => ({ ...value, [index]: !value[index] }))} style={styles.checkRow}>
      <Icon name={done[index] ? 'SquareCheck' : 'Square'} size={20} color={done[index] ? colors.success600 : colors.inkMuted} />
      <View style={{ flex: 1 }}><Text variant="bodyStrong" style={done[index] ? { textDecorationLine: 'line-through', color: colors.inkMuted } : undefined}>{item.front}</Text><Text variant="caption">{item.back}</Text></View>
    </Pressable>)}
  </Stack>;
}

export function OpportunityMatcherScreen({ navigation }: RootScreenProps<'StudentOpportunityMatcher'>) {
  const services = useServices();
  const user = useCurrentUser();
  const qc = useQueryClient();
  const files = useFileActions();
  const key = qk.plannerOpportunities(user.id);
  const query = useQuery({ queryKey: key, queryFn: services.planner.opportunities });
  const bookmark = useMutation({ mutationFn: ({ id, value }: { id: string; value: boolean }) => services.planner.setOpportunityBookmark(id, value), onSuccess: () => qc.invalidateQueries({ queryKey: key }) });
  const openOpportunity = (href: string) => {
    const normalized = href.toLowerCase();
    if (normalized.includes('message')) navigation.navigate(Routes.StudentTabs, { screen: Routes.StudentMessagesTab });
    else if (normalized.includes('practicum')) navigation.navigate(Routes.StudentProgramPlan);
    else if (normalized.includes('/ask')) navigation.navigate(Routes.AskHeritage);
    else {
      const url = webUrl(href);
      if (url) files.openUrl(url);
    }
  };
  return <Screen testID="opportunity-matcher"><Stack>
    <Header eyebrow="CAREER MATCH" title="Opportunities" body={`Program and skill-aware matches${query.data?.programName ? ` for ${query.data.programName}` : ''}. Always review eligibility before applying.`} />
    {query.isLoading ? <LoadingState /> : query.error ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : query.data?.opportunities.map(row => <Card key={row.id}><Stack gap={spacing.sm}>
      <Row justify="space-between"><View style={{ flex: 1 }}><Text variant="titleSm">{row.title}</Text><Text variant="caption">{row.employerName}</Text></View><Pill label={`${row.matchPercent}% MATCH`} tone={row.matchPercent >= 80 ? 'green' : 'gold'} small /></Row>
      <Text variant="bodySm">{row.matchReason}</Text><Text variant="caption">{row.skills.join(' · ') || 'General opportunity'} · institution-managed · checked {new Date(row.lastCheckedAt).toLocaleDateString()}</Text>
      <Row align="stretch">
        <Button title={row.bookmarked ? 'Remove bookmark' : 'Bookmark'} size="sm" variant="outline" style={styles.opportunityAction} loading={bookmark.isPending && bookmark.variables?.id === row.id} onPress={() => bookmark.mutate({ id: row.id, value: !row.bookmarked })} />
        <Button title="Open opportunity" size="sm" style={styles.opportunityAction} onPress={() => openOpportunity(row.href)} />
      </Row>
    </Stack></Card>)}
  </Stack></Screen>;
}

export function PlannerCalendarScreen() {
  const services = useServices();
  const user = useCurrentUser();
  const query = useQuery({ queryKey: qk.plannerCalendar(user.id), queryFn: services.planner.calendarExport });
  const exportCalendar = useMutation({ mutationFn: async () => {
    if (!query.data) return;
    const path = await writeTextFile(query.data.filename, query.data.ics);
    await shareFile(path, 'Heritage Study Calendar');
  } });
  return <Screen testID="planner-calendar"><Stack>
    <Header eyebrow="READ-ONLY EXPORT" title="Study Calendar" body="Official classes, deadlines, registered workshops and personal study blocks in one feed." />
    {query.isLoading ? <LoadingState /> : query.error ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : <>
      <Card tone="green"><Stack><Row><Icon name="ShieldCheck" color={colors.success600} /><Text variant="titleSm">Safe calendar export</Text></Row><Text variant="bodySm">This export is read-only. Your phone calendar cannot modify official Heritage records.</Text><InlineError error={exportCalendar.error} /><Button title="Share .ICS Calendar" loading={exportCalendar.isPending} onPress={() => exportCalendar.mutate()} /></Stack></Card>
      {query.data?.events.map(event => <Card key={event.id} padding={spacing.md}><Row justify="space-between"><View style={{ flex: 1 }}><Text variant="bodyStrong">{event.title}</Text><Text variant="caption">{new Date(event.startsAt).toLocaleString()}{event.location ? ` · ${event.location}` : ''}</Text></View><Pill label={event.kind.toUpperCase()} tone={event.kind === 'deadline' ? 'coral' : event.kind === 'study' ? 'gold' : 'green'} small /></Row></Card>)}
    </>}
  </Stack></Screen>;
}

const styles = StyleSheet.create({
  opportunityAction: { flex: 1, minWidth: 0 },
  flashcard: { minHeight: 180, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.coral50, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
  flashcardBack: { backgroundColor: colors.green900, borderColor: colors.green900 },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  optionCorrect: { borderColor: colors.success600, backgroundColor: colors.success100 },
  optionWrong: { borderColor: colors.danger600, backgroundColor: colors.danger100 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.xs },
});
