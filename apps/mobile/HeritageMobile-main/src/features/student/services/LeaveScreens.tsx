import React, { useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, EmptyState, Icon, Input, DateField, Chip, InfoBanner, DemoLabel, KeyValueRow, BottomSheet, ConfirmSheet, ListRow } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useRequests, useRecordMutations, useRequest } from '../records/useRecords';
import { formatDate, formatDateTime, toISODate, parseISODate } from '../../../utils/format';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';
import { clock, DAY_MS } from '../../../utils/clock';
import { useUnsavedChangesGuard } from '../../shared/hooks';
import type { ChangeRequest } from '../../../domain/types';
import type { IconName } from '../../../components/Icon';
import { useCurrentUser } from '../../../state/sessionStore';

const schema = z.object({
  reason: z.string().trim().min(10, 'Describe your reason (at least 10 characters)').max(250),
  startDate: z.string().min(1, 'Choose a start date'),
  endDate: z.string().min(1, 'Choose an end date'),
}).refine(v => !v.startDate || !v.endDate || v.endDate >= v.startDate, { message: 'End date must be on or after the start date', path: ['endDate'] });
type FormValues = z.infer<typeof schema>;

export function LeaveScreen({ navigation }: RootScreenProps<'StudentLeave'>) {
  const user = useCurrentUser();
  const requests = useRequests('leave');
  const m = useRecordMutations();
  const [review, setReview] = useState<FormValues | null>(null);
  const [history, setHistory] = useState(false);
  const { control, handleSubmit, setValue, watch, reset, formState: { errors, isDirty } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { reason: '', startDate: '', endDate: '' } });
  const { allowLeave } = useUnsavedChangesGuard(isDirty && !review, 'Your leave request is not submitted. Discard it?');
  const start = watch('startDate');
  const preset = (days: number | 'term') => {
    const s = start ? parseISODate(start) : new Date(clock.now() + 7 * DAY_MS);
    setValue('startDate', toISODate(s), { shouldDirty: true });
    const e = days === 'term' ? new Date(2026, 11, 18) : new Date(s.getTime() + (days - 1) * DAY_MS);
    setValue('endDate', toISODate(e), { shouldDirty: true });
  };
  const submit = async () => {
    if (!review) return;
    try {
      const r = await m.submitLeave.mutateAsync(review);
      toast('Leave request submitted · pending registrar review', 'success');
      setReview(null); reset(); allowLeave();
      navigation.navigate(Routes.StudentRequestDetails, { requestId: r.id });
    } catch (e) { toast(errorMessage(e), 'error'); }
  };
  const list = requests.data ?? [];
  const active = list.filter(r => r.status === 'pending');
  const shown = history ? list : active;
  return (
    <Screen testID="leave-screen" header={<ScreenHeader />}>
      <Stack>
        <Row justify="space-between"><Text variant="titleLg" style={{ fontSize: 24 }}>Leave of Absence</Text><Pill label="AY 2026-27" tone="grey" small /></Row>
        <Text variant="body">Submit requests for temporary academic pauses or monitor pending application reviews with the registrar.</Text>
        <Card>
          <Row justify="space-between"><Row gap={6}><Icon name="CalendarPlus" size={18} color={colors.green900} /><Text variant="titleSm">New Request</Text></Row>{isMockMode() ? <Pill label="Review time: demo estimate" tone="grey" small icon={<Icon name="Clock" size={11} color={colors.inkSecondary} />} /> : null}</Row>
          <Controller control={control} name="reason" render={({ field }) => <Input label="Reason for Absence" placeholder="Describe why you need a leave of absence (e.g. medical procedure, family emergency, academic pause)..." multiline maxLength={250} counter={field.value.length} value={field.value} onChangeText={field.onChange} error={errors.reason?.message} containerStyle={{ marginTop: spacing.sm }} testID="leave-reason" />} />
          <Row style={{ marginTop: spacing.sm }}>
            <View style={{ flex: 1 }}><Controller control={control} name="startDate" render={({ field }) => <DateField label="Start date" value={field.value || undefined} onChange={field.onChange} minimumDate={new Date(clock.now())} error={errors.startDate?.message} testID="leave-start" />} /></View>
            <View style={{ flex: 1 }}><Controller control={control} name="endDate" render={({ field }) => <DateField label="End date" value={field.value || undefined} onChange={field.onChange} minimumDate={start ? parseISODate(start) : new Date(clock.now())} error={errors.endDate?.message} testID="leave-end" />} /></View>
          </Row>
          <Text variant="caption" style={{ marginTop: spacing.sm }}>Quick duration presets</Text>
          <Row style={{ marginTop: 4 }}><Chip label="1 Week" icon="Clock" onPress={() => preset(7)} testID="leave-preset-1w" /><Chip label="2 Weeks" icon="Calendar" onPress={() => preset(14)} testID="leave-preset-2w" /><Chip label="Full Term" icon="GraduationCap" onPress={() => preset('term')} testID="leave-preset-term" /></Row>
          <Button title="Submit for review ➤" style={{ marginTop: spacing.md }} onPress={handleSubmit(v => setReview(v))} testID="leave-review" />
        </Card>
        <Row justify="space-between"><Row gap={6}><Text variant="titleSm">Your Requests</Text><Pill label={`${active.length} Active`} tone="green" small /></Row><Pressable accessibilityRole="button" onPress={() => setHistory(h => !h)} testID="leave-history"><Row gap={4}><Icon name="History" size={14} color={colors.green900} /><Text variant="label" color={colors.green900}>{history ? 'Active only' : 'History'}</Text></Row></Pressable></Row>
        {requests.isLoading ? <LoadingState /> : requests.error ? <ErrorState error={requests.error} onRetry={() => requests.refetch()} /> : !shown.length ? <EmptyState icon="CalendarOff" title={history ? 'No leave history' : 'No active requests'} /> : shown.map(r => (
          <Card key={r.id} style={styles.reqCard} testID={`leave-${r.id}`}>
            <Row justify="space-between"><Row gap={6}><Icon name="Calendar" size={14} color={colors.green900} /><Text variant="label">{formatDate(String(r.payload.startDate))} → {formatDate(String(r.payload.endDate))}</Text></Row><Pill label={r.status} tone={r.status === 'pending' ? 'coral' : r.status === 'approved' ? 'green' : 'grey'} small dot /></Row>
            <Text variant="caption" style={{ marginTop: 2 }}>{String(r.payload.days)} Days • {String(r.payload.termLabel ?? '')}</Text>
            <View style={styles.reasonBox}><Text variant="bodySm" style={{ fontStyle: 'italic' }}>{String(r.payload.reason)}</Text></View>
            <Row justify="space-between" style={{ marginTop: spacing.sm }}><Row gap={4}><Icon name="ShieldCheck" size={12} color={colors.inkMuted} /><Text variant="caption">{r.reviewer} • {formatDate(r.createdAt)}</Text></Row><Pressable accessibilityRole="button" onPress={() => navigation.navigate(Routes.StudentRequestDetails, { requestId: r.id })} testID={`leave-details-${r.id}`}><Text variant="label" color={colors.coral600}>View Details ›</Text></Pressable></Row>
          </Card>
        ))}
        <Card tone="muted">
          <Text variant="overline" style={{ marginBottom: 4 }}>{isMockMode() ? 'Academic policy guidelines (demo text — not confirmed college policy)' : 'Academic policy guidelines'}</Text>
          <Text variant="caption">{isMockMode() ? 'Longer leaves may affect course progression, prerequisite clearances, and financial aid eligibility. Confirm thresholds with Academic Advising; the figures in the reference design are not treated as approved rules here.' : 'Longer leaves may affect course progression, prerequisite clearances, and financial aid eligibility. Confirm thresholds with Academic Advising.'}</Text>
          {isMockMode() ? <Button title="Read full attendance & leave policy →" variant="ghost" size="sm" onPress={() => navigation.navigate(Routes.FileViewer, { asset: 'syllabus', title: 'Policy excerpt (sample)' })} testID="leave-policy" /> : null}
        </Card>
        <Card padding={spacing.md}><ListRow icon="MessageCircle" title="Questions on Leave of Absence?" subtitle="Speak with a Student Affairs advisor (campus mail)" onPress={() => navigation.navigate(Routes.MailCompose, isMockMode() ? { toId: 'c_advising', subject: 'Leave of absence question' } : { toRole: 'staff', toName: user.student?.advisorName, subject: 'Leave of absence question' })} testID="leave-advisor" /></Card>
        <DemoLabel text="Requests are pending until a reviewer decides · never auto-approved" />
      </Stack>
      <BottomSheet visible={!!review} onClose={() => setReview(null)} title="Review your request" subtitle="Submit to the Academic Registrar" testID="leave-review-sheet">
        {review ? (<>
          <KeyValueRow label="Dates" value={`${formatDate(review.startDate)} → ${formatDate(review.endDate)}`} />
          <KeyValueRow label="Duration" value={`${Math.round((parseISODate(review.endDate).getTime() - parseISODate(review.startDate).getTime()) / DAY_MS) + 1} days`} />
          <KeyValueRow label="Reason" value={review.reason} border={false} />
          <InfoBanner tone="gold" icon="Info" text="Submitting creates a pending request. It is not approved until a reviewer decides." />
          <Button title="Confirm & submit" onPress={submit} loading={m.submitLeave.isPending} testID="leave-submit" />
          <Button title="Edit" variant="ghost" onPress={() => setReview(null)} />
        </>) : null}
      </BottomSheet>
    </Screen>
  );
}

/** Generic request detail (leave, personal details, transcript, letter, English test). */
export function RequestDetailsScreen({ route, navigation }: RootScreenProps<'StudentRequestDetails'>) {
  const q = useRequest(route.params.requestId);
  const mutations = useRecordMutations();
  const r = q.data;
  const [withdraw, setWithdraw] = useState(false);
  const labels: Record<string, string> = { leave: 'Leave of absence', personalDetails: 'Personal details update', transcript: 'Official transcript', specialLetter: 'Special verification letter', englishTest: 'English test registration', attendanceCorrection: 'Attendance correction' };
  return (
    <Screen testID="request-details" header={<ScreenHeader title="Request details" />}>
      {q.isLoading ? <LoadingState /> : !r ? <ErrorState error={q.error} /> : (
        <Stack>
          <Card>
            <Row justify="space-between"><Text variant="overline">{labels[r.kind] ?? r.kind}</Text><Pill label={r.status} tone={r.status === 'pending' ? 'coral' : r.status === 'approved' ? 'green' : 'grey'} dot small /></Row>
            <Text variant="displaySm" style={{ marginVertical: 4 }}>{r.summary}</Text>
            <KeyValueRow label="Submitted" value={formatDateTime(r.createdAt)} />
            <KeyValueRow label="Reviewer" value={r.reviewer} />
            <KeyValueRow label="Reference" value={r.id} border={false} />
          </Card>
          <Card testID="request-timeline">
            <Text variant="overline" style={{ marginBottom: spacing.sm }}>Status timeline</Text>
            <StatusTimeline status={r.status} createdAt={r.createdAt} decidedAt={r.decidedAt} reviewer={r.reviewer} />
          </Card>
          {r.decisionNote ? (
            <Card tone="muted" testID="request-decision-note">
              <Text variant="overline" style={{ marginBottom: 4 }}>Reviewer note</Text>
              <Text variant="body">{r.decisionNote}</Text>
            </Card>
          ) : null}
          <Card>
            <Text variant="overline" style={{ marginBottom: 4 }}>Submitted details</Text>
            {Object.entries(r.payload).map(([k, v], i, arr) => <KeyValueRow key={k} label={k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())} value={typeof v === 'object' ? JSON.stringify(v) : String(v)} border={i < arr.length - 1} />)}
          </Card>
          {r.status === 'pending' ? <InfoBanner tone="gold" icon="Clock" title="Pending review" text={isMockMode() ? 'Submitting a request is not approval. Official records are updated only after the reviewer approves (not simulated in this demo).' : 'Submitting a request is not approval. Official records are updated only after the reviewer approves.'} /> : null}
          {r.status === 'pending' && r.kind === 'leave' ? <Button title="Withdraw request" variant="outline" onPress={() => setWithdraw(true)} testID="request-withdraw" /> : null}
          <Button title="Back" variant="ghost" onPress={() => navigation.goBack()} />
        </Stack>
      )}
      <ConfirmSheet
        visible={withdraw}
        onClose={() => setWithdraw(false)}
        destructive
        title="Withdraw request?"
        message="This pending leave request will be cancelled. A cancelled request cannot be reopened; submit a new request if your dates change."
        confirmLabel="Withdraw request"
        loading={mutations.cancelRequest.isPending}
        onConfirm={async () => {
          try {
            await mutations.cancelRequest.mutateAsync(route.params.requestId);
            setWithdraw(false);
            toast('Leave request withdrawn', 'success');
          } catch (error) {
            toast(errorMessage(error), 'error');
          }
        }}
      />
    </Screen>
  );
}

function StatusTimeline({ status, createdAt, decidedAt, reviewer }: { status: ChangeRequest['status']; createdAt: string; decidedAt?: string; reviewer: string }) {
  const decided = status !== 'pending';
  const steps: { key: string; label: string; detail: string; done: boolean; current: boolean; tone: string; icon: IconName }[] = [
    { key: 'submitted', label: 'Submitted', detail: formatDateTime(createdAt), done: true, current: false, tone: colors.green700, icon: 'Send' },
    { key: 'review', label: 'Under review', detail: decided ? `Reviewed by ${reviewer}` : `With ${reviewer}`, done: decided, current: !decided, tone: colors.gold600, icon: 'Hourglass' },
    decided
      ? { key: 'decision', label: status === 'approved' ? 'Approved' : status === 'cancelled' ? 'Withdrawn' : 'Rejected', detail: decidedAt ? formatDateTime(decidedAt) : 'Decision date not recorded', done: true, current: true, tone: status === 'approved' ? colors.green700 : status === 'cancelled' ? colors.inkMuted : colors.danger600, icon: status === 'approved' ? 'CircleCheck' : 'CircleX' }
      : { key: 'decision', label: 'Approved / Rejected', detail: 'Awaiting decision', done: false, current: false, tone: colors.inkFaint, icon: 'Circle' },
  ];
  return (
    <View>
      {steps.map((s, i) => (
        <View key={s.key} style={styles.step} testID={`request-step-${s.key}`} accessible accessibilityLabel={`${s.label}. ${s.detail}`}>
          <View style={styles.stepRail}>
            <View style={[styles.stepDot, { borderColor: s.done || s.current ? s.tone : colors.border, backgroundColor: s.done ? s.tone : colors.surface }]}>
              <Icon name={s.icon} size={12} color={s.done ? colors.white : s.current ? s.tone : colors.inkFaint} />
            </View>
            {i < steps.length - 1 ? <View style={[styles.stepLine, { backgroundColor: steps[i + 1].done || steps[i + 1].current ? colors.green700 : colors.border }]} /> : null}
          </View>
          <View style={styles.stepBody}>
            <Text variant="bodyStrong" color={s.done || s.current ? colors.ink : colors.inkMuted}>{s.label}</Text>
            <Text variant="caption">{s.detail}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  stepRail: { alignItems: 'center', width: 24 },
  stepDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepLine: { width: 2, flex: 1, minHeight: 18, marginVertical: 2 },
  stepBody: { flex: 1, paddingBottom: spacing.md },
  reqCard: { borderLeftWidth: 4, borderLeftColor: colors.coral500 },
  reasonBox: { backgroundColor: colors.green50, borderRadius: 10, padding: spacing.sm, marginTop: spacing.sm },
});
