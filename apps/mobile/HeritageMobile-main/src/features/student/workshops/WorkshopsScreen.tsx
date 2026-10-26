import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, EmptyState, Icon, SegmentedTabs, KeyValue, InfoBanner, ConfirmSheet, DemoLabel, ProgressBar } from '../../../components';
import { colors, spacing } from '../../../theme';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useWorkshops, useWorkshopMutations, useCurrentTermLabel } from '../courses/useCourses';
import { formatDate } from '../../../utils/format';
import type { WorkshopWithStatus } from '../../../services/contracts/academics';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';
import { isMockMode } from '../../../config/appConfig';
import { workshopBanner, workshopDisplayTitle, workshopScheduleLabel, workshopTiming } from './workshopPresentation';

export { workshopTiming } from './workshopPresentation';

type View3 = 'mine' | 'available' | 'completed';

export function WorkshopsScreen({ navigation, route }: RootScreenProps<'StudentWorkshops'>) {
  const termLabel = useCurrentTermLabel();
  const workshops = useWorkshops();
  const m = useWorkshopMutations();
  const [view, setView] = useState<View3>(route.params?.view ?? 'mine');
  const [dropId, setDropId] = useState<string | null>(null);
  const data = useMemo(() => workshops.data ?? [], [workshops.data]);
  const groups = useMemo(() => ({
    mine: data.filter(w => w.myEnrolment && (w.myEnrolment.status === 'approved' || w.myEnrolment.status === 'pending') && !workshopTiming(w).isPast),
    available: data.filter(w => !w.myEnrolment && !workshopTiming(w).isPast),
    completed: data.filter(w => w.myEnrolment?.status === 'completed' || (w.myEnrolment?.status === 'approved' && workshopTiming(w).isPast)),
  }), [data]);
  const list = groups[view];
  const nextMine = groups.mine.slice().sort((a, b) => a.date.localeCompare(b.date))[0];
  const nextBanner = nextMine ? workshopBanner(nextMine) : null;
  return (
    <Screen testID="workshops-screen" header={<ScreenHeader backLabel="Back" />}>
      {workshops.isLoading ? <LoadingState /> : workshops.error ? <ErrorState error={workshops.error} onRetry={() => workshops.refetch()} /> : (
        <Stack>
          <Row justify="space-between"><Text variant="displayLg">My Workshops</Text>{termLabel ? <Pill label={termLabel} tone="green" small /> : null}</Row>
          <Text variant="body">{isMockMode() ? 'Track enrolled sessions, access online rooms, and register for peer learning modules.' : 'Track your registered sessions and register for upcoming workshops.'}</Text>
          <SegmentedTabs options={[{ value: 'mine', label: 'Registered', count: groups.mine.length }, { value: 'available', label: 'Available', count: groups.available.length }, { value: 'completed', label: 'Completed', count: groups.completed.length }]} value={view} onChange={setView} testID="workshops-view" />
          {view === 'mine' && nextMine && nextBanner ? <InfoBanner tone={nextBanner.tone} icon={workshopTiming(nextMine).isLive ? 'Video' : 'Clock'} title={nextBanner.title} text={isMockMode() && nextMine.mode === 'Online' ? 'Online demo room link opens 15 minutes before start time.' : nextBanner.text} /> : null}
          {!list.length ? view === 'mine' && groups.available.length ? (
            <Card tone="green" style={styles.discoveryCard} testID="workshops-empty-discovery">
              <Stack gap={spacing.sm}>
                <View style={styles.discoveryIcon}><Icon name="Sparkles" size={22} color={colors.green900} /></View>
                <Text variant="overline" color={colors.success600}>Build your skills</Text>
                <Text variant="titleLg">Your workshop journey starts here</Text>
                <Text variant="bodySm">You have no registered sessions yet. {groups.available.length} workshop{groups.available.length === 1 ? ' is' : 's are'} available for this term.</Text>
                <Button title={`Browse ${groups.available.length} Available ${groups.available.length === 1 ? 'Workshop' : 'Workshops'} →`} onPress={() => setView('available')} testID="workshops-empty-browse" />
              </Stack>
            </Card>
          ) : (
            <Card tone="muted" padding={spacing.sm}>
              <EmptyState contained={false} icon={view === 'completed' ? 'Check' : 'Users'} title={view === 'available' ? 'No workshops available' : 'No completed workshops'} message={view === 'available' ? 'New workshop sessions will appear here when registration opens.' : 'Completed sessions and earned CEUs will appear here.'} />
            </Card>
          ) : list.map(w => <WorkshopCard key={w.id} w={w} onDetails={() => navigation.navigate(Routes.StudentWorkshopDetails, { workshopId: w.id })} onRegister={async () => { try { const r = await m.register.mutateAsync(w.id); toast(r.status === 'pending' ? 'Registration sent for instructor approval' : 'Registered', 'success'); } catch (e) { toast(errorMessage(e), 'error'); } }} onDrop={() => setDropId(w.id)} registering={m.register.isPending} />)}
          {view === 'mine' && groups.mine.length > 0 && groups.available.length ? (
            <Card tone="green"><Row justify="space-between"><View style={{ flex: 1 }}><Text variant="overline">Expand skills</Text><Text variant="titleSm">{groups.available.length} Available {groups.available.length === 1 ? 'Workshop' : 'Workshops'}</Text><Text variant="caption">{isMockMode() ? 'New learning sessions are' : 'Workshop sessions are'} open for registration.</Text></View><Button title="Browse" variant="outline" size="sm" fullWidth={false} onPress={() => setView('available')} testID="workshops-browse" /></Row></Card>
          ) : null}
          <DemoLabel text="Seats, counts and session timing derived from fixtures + demo clock" />
        </Stack>
      )}
      <ConfirmSheet visible={!!dropId} onClose={() => setDropId(null)} destructive title="Drop this workshop?" message="Your registration will be withdrawn and the seat released. You can register again if seats remain." confirmLabel="Drop registration" loading={m.drop.isPending} testID="workshop-drop-sheet" onConfirm={async () => { try { await m.drop.mutateAsync(dropId!); toast('Registration dropped', 'success'); } catch (e) { toast(errorMessage(e), 'error'); } setDropId(null); }} />
    </Screen>
  );
}

function WorkshopCard({ w, onDetails, onRegister, onDrop, registering }: { w: WorkshopWithStatus; onDetails: () => void; onRegister: () => void; onDrop?: () => void; registering: boolean }) {
  const t = workshopTiming(w);
  const status = w.myEnrolment?.status;
  const full = w.registeredCount >= w.capacity;
  return (
    <Card testID={`workshop-${w.id}`}>
      <Stack gap={spacing.sm}>
        <Row gap={spacing.md}>
          <View style={styles.tile}><Icon name={w.category.includes('Health') ? 'HeartPulse' : w.category.includes('Career') ? 'BriefcaseBusiness' : w.category.includes('Leader') ? 'Users' : w.category.includes('Tech') ? 'Map' : 'BookOpen'} size={22} color={colors.green900} /></View>
          <View style={{ flex: 1 }}><Text variant="overline" color={colors.coral600}>{w.category}</Text><Text variant="mono">CODE: {w.code}</Text></View>
          {status ? <Pill label={status === 'pending' ? 'Pending approval' : status === 'approved' ? 'Registered' : status} tone={status === 'pending' ? 'yellow' : 'green'} small dot /> : full ? <Pill label="Full" tone="red" small /> : <Pill label={w.requiresApproval ? 'Approval required' : 'Open'} tone="grey" small />}
        </Row>
        <Text variant="titleMd">{workshopDisplayTitle(w)}</Text>
        <Text variant="bodySm">{w.description}</Text>
        <Row wrap gap={spacing.md}>
          <KeyValue label="Date" value={w.endDate ? `${formatDate(w.date)} – ${formatDate(w.endDate)}` : `${formatDate(w.date)} · Single Day Session`} style={styles.kv} />
          <KeyValue label="Schedule" value={<Row gap={4} wrap><Text variant="bodyStrong">{workshopScheduleLabel(w)}</Text>{t.isLive ? <Pill label="LIVE" tone="red" small /> : null}</Row>} style={styles.kv} />
          <KeyValue label="Length & CEU" value={w.durationHours ? `${w.ceu} CEU / ${w.durationHours} Contact Hours` : `${w.ceu} CEU`} style={styles.kv} />
          {w.instructor ? <KeyValue label="Instructor(s)" value={w.instructor} style={styles.kv} /> : null}
        </Row>
        <View><ProgressBar value={(w.registeredCount / w.capacity) * 100} height={5} /><Text variant="caption">{w.registeredCount} / {w.capacity} seats taken</Text></View>
        <Row>
          <Button title="View Workshop Details →" style={{ flex: 1 }} onPress={onDetails} testID={`workshop-details-${w.id}`} />
          {status === 'approved' || status === 'pending' ? (
            !onDrop ? null : <Pressable accessibilityRole="button" accessibilityLabel="Drop workshop" onPress={onDrop} style={styles.sqBtn} testID={`workshop-drop-${w.id}`}><Icon name="LogOut" size={18} color={colors.danger600} /></Pressable>
          ) : !status && !t.isPast ? (
            <Button title={full ? 'Full' : 'Register'} variant="outline" fullWidth={false} onPress={onRegister} disabled={full} loading={registering} testID={`workshop-register-${w.id}`} />
          ) : null}
        </Row>
      </Stack>
    </Card>
  );
}

const styles = StyleSheet.create({
  discoveryCard: { overflow: 'hidden' },
  discoveryIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.success100, alignItems: 'center', justifyContent: 'center' },
  tile: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.coral50, alignItems: 'center', justifyContent: 'center' },
  kv: { width: '46%' },
  sqBtn: { width: 48, height: 48, borderRadius: 999, borderWidth: 1.5, borderColor: colors.danger600, alignItems: 'center', justifyContent: 'center' },
});
