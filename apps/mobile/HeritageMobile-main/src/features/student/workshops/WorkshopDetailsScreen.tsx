import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, Icon, KeyValue, InfoBanner, ConfirmSheet, ProgressBar, ListRow, DemoLabel } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import type { RootScreenProps } from '../../../navigation/types';
import { useWorkshop, useWorkshopMutations } from '../courses/useCourses';
import { formatDate } from '../../../utils/format';
import { workshopDisplayTitle, workshopScheduleLabel, workshopTiming } from './workshopPresentation';
import { useFileActions } from '../../shared/useFileActions';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';
import { useClockTick } from '../../shared/hooks';

export function WorkshopDetailsScreen({ route }: RootScreenProps<'StudentWorkshopDetails'>) {
  const { workshopId } = route.params;
  const q = useWorkshop(workshopId);
  const m = useWorkshopMutations();
  const files = useFileActions();
  const [drop, setDrop] = useState(false);
  const [joined, setJoined] = useState(false);
  useClockTick(15000);
  const w = q.data;
  const t = w ? workshopTiming(w) : null;
  const status = w?.myEnrolment?.status;
  const canAccessMaterials = status === 'approved' || status === 'completed';
  return (
    <Screen testID="workshop-details" header={<ScreenHeader backLabel="Back" />}>
      {q.isLoading ? <LoadingState /> : !w || !t ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <Stack>
          <Row justify="space-between"><Text variant="overline" color={colors.coral600}>Workshops • {w.code}</Text><Row gap={4}><Icon name={w.mode === 'Online' ? 'Globe' : 'Building2'} size={14} color={colors.inkMuted} /><Text variant="caption">{w.mode === 'Online' ? 'Remote' : 'On campus'}</Text></Row></Row>
          <Text variant="displayLg">{workshopDisplayTitle(w)}</Text>
          <Card>
            <Row wrap gap={spacing.md}>
              {w.instructor ? <KeyValue label="Instructor(s)" value={w.instructor} style={styles.kv} /> : null}
              <KeyValue label="Status" value={<Pill label={status ?? 'not registered'} tone={status === 'approved' ? 'green' : status === 'pending' ? 'yellow' : 'grey'} small dot />} style={styles.kv} />
              <KeyValue label="Length" value={w.durationHours ? `${w.ceu} CEU · ${w.durationHours} h` : `${w.ceu} CEU`} style={styles.kv} />
              <KeyValue label="Dates" value={`${formatDate(w.date)} – ${formatDate(w.endDate ?? w.date)}`} style={styles.kv} />
              <KeyValue label="Schedule" value={workshopScheduleLabel(w)} style={styles.kv} />
              {w.location ? <KeyValue label="Location" value={w.location} style={styles.kv} /> : null}
              <KeyValue label="Seats" value={<View style={{ gap: 4, minWidth: 120 }}><Text variant="bodyStrong">{w.registeredCount} / {w.capacity} registered</Text><ProgressBar value={(w.registeredCount / w.capacity) * 100} height={5} /></View>} style={styles.kv} />
            </Row>
          </Card>
          {w.description ? <Card><Text variant="overline" style={{ marginBottom: 4 }}>About this session</Text><Text variant="body">{w.description}</Text></Card> : null}
          {w.agenda.length ? <Card>
            <Text variant="titleSm" style={{ marginBottom: spacing.sm }}>Agenda</Text>
            {w.agenda.map((a, i) => <Row key={a} gap={8} style={{ paddingVertical: 4 }}><Text variant="label" color={colors.inkMuted}>{i + 1}.</Text><Text variant="body">{a}</Text></Row>)}
          </Card> : null}
          {w.materials.length ? <Card>
            <Text variant="titleSm" style={{ marginBottom: spacing.sm }}>Materials</Text>
            {w.materials.map(mat => <ListRow key={mat.id} icon="FileText" title={mat.title} subtitle={canAccessMaterials ? mat.type : 'Available after registration is approved'} onPress={canAccessMaterials ? () => files.view(mat.sampleAsset) : undefined} testID={`workshop-material-${mat.id}`} right={!canAccessMaterials ? <Icon name="Lock" size={16} color={colors.inkMuted} /> : undefined} />)}
          </Card> : null}
          {status === 'pending' ? <InfoBanner tone="gold" icon="Clock" title="Awaiting approval" text="Your request is pending. The workshop coordinator will approve or decline it." /> : null}
          {status === 'approved' && !t.isPast && isMockMode() ? (
            t.isLive ? (
              joined ? (isMockMode() ? <InfoBanner tone="green" icon="Video" title="Joined demo room" text="No conferencing backend is connected; this confirms the join state only." /> : <InfoBanner tone="green" icon="Video" title={w.mode === 'Online' ? 'Joined' : 'Checked in'} text="Your join has been confirmed on this device." />) : <Button title={isMockMode() ? (w.mode === 'Online' ? 'Join demo online room' : 'Check in (demo)') : w.mode === 'Online' ? 'Join online room' : 'Check in'} variant="coral" onPress={() => { setJoined(true); toast(isMockMode() ? 'Joined demo room' : w.mode === 'Online' ? 'Joined' : 'Checked in', 'success'); }} testID="workshop-join" />
            ) : <Button title={`${w.mode === 'Online' ? 'Join' : 'Check in'} opens 15 min before start`} disabled disabledReason={`Starts ${formatDate(w.date)} at ${w.startTime}${isMockMode() ? ' · use the developer clock to simulate session time' : ''}`} />
          ) : null}
          {status === 'approved' && !t.isPast && !isMockMode() && t.isLive && (w.mode === 'In person' || w.joinUrl) ? (
            <Button title={w.mode === 'Online' ? 'Join online room' : 'Check in'} variant="coral" loading={m.join.isPending} onPress={async () => { try { const result = await m.join.mutateAsync(w.id); if (result.joinUrl) await files.openUrl(result.joinUrl); else { setJoined(true); toast('Checked in', 'success'); } } catch (e) { toast(errorMessage(e), 'error'); } }} testID="workshop-join" />
          ) : null}
          {!status && !t.isPast ? <Button title={w.registeredCount >= w.capacity ? 'Workshop full' : w.requiresApproval ? 'Request registration' : 'Register'} disabled={w.registeredCount >= w.capacity} disabledReason="No seats remaining" loading={m.register.isPending} testID="workshop-register" onPress={async () => { try { const r = await m.register.mutateAsync(w.id); toast(r.status === 'pending' ? 'Request sent for approval' : 'Registered', 'success'); } catch (e) { toast(errorMessage(e), 'error'); } }} /> : null}
          {status === 'approved' && !t.isPast && !isMockMode() ? <InfoBanner tone="green" icon="CircleCheck" title={joined ? 'Checked in' : "You're registered"} text={joined ? 'Your attendance check-in was recorded.' : w.mode === 'Online' ? (w.joinUrl ? 'The Join button opens 15 minutes before the session.' : 'Joining details are shared by the workshop coordinator before the session.') : w.location ? `Attend in person at ${w.location}. Check-in opens 15 minutes before start.` : 'The workshop coordinator will share the location before the session.'} /> : null}
          {(status === 'approved' || status === 'pending') && !t.isPast ? <Button title="Drop registration" variant="outline" onPress={() => setDrop(true)} testID="workshop-drop" /> : null}
          {status === 'completed' || (status === 'approved' && t.isPast) ? <InfoBanner tone="green" icon="CircleCheck" title="Completed" text="This workshop counts toward workshop-linked badges." /> : null}
          {isMockMode() ? <DemoLabel text="Demo room · no real conferencing" /> : null}
        </Stack>
      )}
      <ConfirmSheet visible={drop} onClose={() => setDrop(false)} destructive title="Drop this workshop?" message="Your registration will be withdrawn and the seat released." confirmLabel="Drop registration" loading={m.drop.isPending} testID="workshop-drop-sheet" onConfirm={async () => { try { await m.drop.mutateAsync(workshopId); toast('Registration dropped', 'success'); } catch (e) { toast(errorMessage(e), 'error'); } setDrop(false); }} />
    </Screen>
  );
}

const styles = StyleSheet.create({ kv: { width: '46%' } });
