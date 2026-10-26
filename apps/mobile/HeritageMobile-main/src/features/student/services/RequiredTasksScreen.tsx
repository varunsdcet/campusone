import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, EmptyState, Icon, UnderlineTabs, BottomSheet, KeyValueRow, Checkbox, DemoLabel, InfoBanner } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useTasks } from '../records/useRecords';
import { formatDate, formatDateTime, formatBytes } from '../../../utils/format';
import type { RequiredTask, SubmissionAttachment } from '../../../domain/types';
import { pickAttachment } from '../../shared/files';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';

export function RequiredTasksScreen({ route, navigation }: RootScreenProps<'StudentRequiredTasks'>) {
  const { list, complete } = useTasks();
  const mock = isMockMode();
  const [tab, setTab] = useState<'pending' | 'completed'>(route.params?.tab ?? 'pending');
  const [open, setOpen] = useState<RequiredTask | null>(null);
  const [evidence, setEvidence] = useState<SubmissionAttachment | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const data = list.data ?? [];
  const pending = data.filter(t => t.status === 'pending');
  const done = data.filter(t => t.status === 'completed');
  const shown = tab === 'pending' ? pending : done;
  const finish = async (t: RequiredTask) => {
    try {
      await complete.mutateAsync({ taskId: t.id, evidence: evidence ?? undefined, confirmation: confirmed });
      toast(t.requirement === 'upload' && mock ? 'Evidence submitted · awaiting institutional approval' : 'Task completed', 'success');
      setOpen(null); setEvidence(null); setConfirmed(false); setTab('completed');
    } catch (e) { toast(errorMessage(e), 'error'); }
  };
  const pick = async () => {
    const r = await pickAttachment();
    if (r.status === 'picked') setEvidence(r.attachment);
    else if (r.status === 'error') toast(r.message, 'error');
    else toast('Picker cancelled', 'info');
  };
  return (
    <Screen testID="required-tasks" header={<ScreenHeader />}>
      {list.isLoading ? <LoadingState /> : list.error ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (
        <Stack>
          <Text variant="displayLg">Required Tasks</Text>
          <Text variant="body">Complete the required tasks requested by Campus One.</Text>
          <Card>
            <Row>
              <Row gap={spacing.sm} style={{ flex: 1 }}><View style={[styles.num, { backgroundColor: colors.gold100 }]}><Text variant="displaySm" color={colors.gold600}>{pending.length}</Text></View><View><Text variant="label" color={colors.gold600}>• Pending</Text><Text variant="caption">Action required</Text></View></Row>
              <Row gap={spacing.sm} style={{ flex: 1 }}><View style={[styles.num, { backgroundColor: colors.success100 }]}><Text variant="displaySm" color={colors.success600}>{done.length}</Text></View><View><Text variant="label" color={colors.success600}>• Completed</Text><Text variant="caption">Submitted records</Text></View></Row>
            </Row>
          </Card>
          <UnderlineTabs options={[{ value: 'pending', label: `Pending Tasks (${pending.length})` }, { value: 'completed', label: `Completed Tasks (${done.length})` }]} value={tab} onChange={setTab} testID="tasks-tab" />
          {!shown.length ? <EmptyState icon="ListChecks" title={tab === 'pending' ? 'All caught up' : 'No completed tasks yet'} message={tab === 'pending' ? 'There are no pending required tasks.' : undefined} /> : shown.map(t => (
            <Card key={t.id} testID={`task-${t.id}`}>
              <Row gap={spacing.md} align="flex-start">
                <View style={[styles.tile, { backgroundColor: t.status === 'completed' ? colors.success100 : colors.gold100 }]}><Icon name={t.status === 'completed' ? 'CircleCheck' : t.requirement === 'upload' ? 'FileUp' : t.requirement === 'evaluation' ? 'MessageSquareText' : 'UserCheck'} size={20} color={t.status === 'completed' ? colors.success600 : colors.gold600} /></View>
                <View style={{ flex: 1 }}>
                  <Row justify="space-between"><Text variant="overline">{t.category}</Text><Pill label={t.status === 'completed' ? 'Completed' : 'Action required'} tone={t.status === 'completed' ? 'green' : 'yellow'} small dot={t.status !== 'completed'} /></Row>
                  <Text variant="titleSm">{t.title}</Text>
                  <Text variant="bodySm">{t.description}</Text>
                  <Text variant="caption" style={{ marginTop: 4 }}>Date requested: {formatDate(t.requestedAt, { dot: true, weekday: true })}</Text>
                  {t.dueNote && t.status === 'pending' ? <Row gap={4}><Icon name="Clock" size={12} color={colors.gold600} /><Text variant="caption" color={colors.gold600}>{t.dueNote}</Text></Row> : null}
                  {t.approval === 'pending' ? <Pill label="Evidence submitted · approval pending" tone="gold" small style={{ marginTop: 4 }} /> : null}
                </View>
              </Row>
              <Row style={{ marginTop: spacing.sm }}>
                {t.status === 'pending' ? (<><Button title="Open →" style={{ flex: 1 }} onPress={() => { setOpen(t); setEvidence(null); setConfirmed(false); }} testID={`task-open-${t.id}`} /><Button title="Mark done" variant="outline" style={{ flex: 1 }} icon={<Icon name="Check" size={14} color={colors.green900} />} onPress={() => (t.requirement === 'confirm' ? finish({ ...t }) : (setOpen(t), setEvidence(null), setConfirmed(false)))} disabled={t.requirement === 'upload'} disabledReason={t.requirement === 'upload' ? 'Upload required — open the task to attach evidence' : undefined} testID={`task-done-${t.id}`} /></>) : <Button title="View details →" variant="ghost" size="sm" fullWidth={false} onPress={() => setOpen(t)} testID={`task-view-${t.id}`} />}
              </Row>
            </Card>
          ))}
          <DemoLabel text="Counts update from the same task records" />
        </Stack>
      )}
      <BottomSheet visible={!!open} onClose={() => setOpen(null)} overline={open?.category} title={open?.title} testID="task-sheet">
        {open ? (<>
          <Text variant="body">{open.description}</Text>
          <KeyValueRow label="Requested" value={formatDate(open.requestedAt)} />
          <KeyValueRow label="Requirement" value={open.requirement === 'upload' ? 'Upload a document' : open.requirement === 'confirm' ? 'Confirm details' : 'Complete evaluation'} />
          {open.status === 'completed' ? (<>
            <KeyValueRow label="Completed" value={formatDateTime(open.completedAt!)} />
            {open.evidence ? <KeyValueRow label="Evidence" value={`${open.evidence.name} (${formatBytes(open.evidence.size)})`} /> : null}
            <KeyValueRow label="Institutional approval" value={open.approval === 'pending' ? 'Pending review' : open.approval === 'approved' ? 'Approved' : 'Not required'} border={false} />
          </>) : open.requirement === 'upload' && open.approval === 'pending' ? (<>
            <InfoBanner tone="gold" icon="Clock" text="Evidence submitted. Student Services must review and approve it before this task is completed." />
            {open.evidence ? <KeyValueRow label="Evidence" value={`${open.evidence.name} (${formatBytes(open.evidence.size)})`} border={false} /> : null}
          </>) : open.requirement === 'evaluation' && !mock ? (<>
            <InfoBanner tone="green" icon="MessageSquareText" text="Rate your course in the evaluation survey. The task completes when your evaluation is submitted." />
            <Button title="Open course evaluations" onPress={() => { setOpen(null); navigation.navigate(Routes.StudentCourseEvaluation); }} testID="task-open-evaluation" />
          </>) : open.requirement === 'upload' ? (<>
            <InfoBanner tone="gold" icon="FileUp" text={mock ? 'This task cannot be completed without an attached document. Submitting evidence does not mean it has been approved.' : 'Attach the requested document here. Student Services will review it before the task is completed.'} />
            {evidence ? <Row gap={8} style={styles.evidence}><Icon name="FileText" size={18} color={colors.green900} /><Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{evidence.name}</Text><Text variant="caption">{formatBytes(evidence.size)}</Text></Row> : null}
            <Button title={evidence ? 'Replace document' : 'Choose document'} variant="outline" onPress={pick} testID="task-pick" />
            <Button title="Submit evidence & complete" onPress={() => finish(open)} disabled={!evidence} disabledReason="Attach the required document first" loading={complete.isPending} testID="task-submit" />
          </>) : open.requirement === 'confirm' ? (<>
            <Checkbox checked={confirmed} onChange={setConfirmed} label="I confirm the details on file are correct." testID="task-confirm" />
            <Button title="Complete task" onPress={() => finish(open)} disabled={!confirmed} disabledReason="Tick the confirmation to continue" loading={complete.isPending} testID="task-submit" />
          </>) : (<>
            <Checkbox checked={confirmed} onChange={setConfirmed} label={isMockMode() ? 'I have completed the course evaluation (demo).' : 'I have completed the course evaluation.'} testID="task-confirm" />
            <Button title="Complete task" onPress={() => finish(open)} disabled={!confirmed} disabledReason="Confirm to continue" loading={complete.isPending} testID="task-submit" />
          </>)}
        </>) : null}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  num: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tile: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  evidence: { backgroundColor: colors.green50, padding: spacing.sm, borderRadius: 10 },
});
