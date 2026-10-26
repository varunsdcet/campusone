import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen, ScreenHeader, Text, Row, Pill, Button, Icon, LoadingState, ErrorState, Stack } from '../../../components';
import { colors, spacing } from '../../../theme';
import { Routes } from '../../../navigation/routes';
import { useAppNavigation } from '../../../navigation/hooks';
import { useProgramme } from '../catalogue/useCatalogue';
import { useSnapshot, findActivity, useActivityTimer, useCompleteActivity } from './useLearning';
import { ACTIVITY_LABEL, ACTIVITY_ROUTE } from './activityMeta';
import { formatCountdown } from '../../../utils/format';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';
import type { Activity, Chapter, Programme } from '../../../domain/types';
import type { ProgressSnapshot } from '../../../services/contracts/learning';

export interface ActivityContext {
  programme: Programme;
  chapter: Chapter;
  activity: Activity;
  index: number;
  all: Activity[];
  snapshot: ProgressSnapshot;
  remaining: number;
  need: number;
  goNext: () => void;
}

interface Props {
  programmeId: string;
  activityId: string;
  children: (ctx: ActivityContext) => React.ReactNode;
  /** Whether the activity's own completion rule is satisfied (read to bottom, quiz submitted, …). */
  readyToComplete: (ctx: ActivityContext) => { ok: boolean; reason?: string };
  footerExtra?: (ctx: ActivityContext) => React.ReactNode;
  onScrollEnd?: () => void;
  testID?: string;
}

/** Shared frame for every learning activity: header, pacing timer, sticky completion footer. */
export function ActivityShell({ programmeId, activityId, children, readyToComplete, footerExtra, onScrollEnd, testID }: Props) {
  const navigation = useAppNavigation();
  const programme = useProgramme(programmeId);
  const snapshot = useSnapshot(programmeId);
  const found = findActivity(programme.data, activityId);
  const timer = useActivityTimer(programmeId, found?.activity, snapshot.data?.progress.secondsSpent[activityId] ?? 0);
  const complete = useCompleteActivity(programmeId);
  if (programme.isLoading || snapshot.isLoading) return <Screen header={<ScreenHeader backLabel="Back to course" />}><LoadingState /></Screen>;
  if (!programme.data || !found || !snapshot.data) return <Screen header={<ScreenHeader backLabel="Back to course" />}><ErrorState error={programme.error ?? snapshot.error ?? new Error('Activity not found')} onRetry={() => { programme.refetch(); snapshot.refetch(); }} /></Screen>;
  const { chapter, activity, index, all } = found;
  const gate = snapshot.data.gates[activity.id];
  const next = all[index + 1];
  const goNext = () => {
    if (!next) {
      navigation.replace(Routes.StudentCourseComplete, { programmeId });
      return;
    }
    const nextGate = snapshot.data!.gates[next.id];
    if (next.chapterId !== activity.chapterId && !nextGate?.chapterReleased) {
      toast(nextGate?.reason ?? 'The next chapter is not open yet.', 'info');
      navigation.replace(Routes.StudentOutline, { programmeId });
      return;
    }
    navigation.replace(ACTIVITY_ROUTE[next.type], { programmeId, activityId: next.id });
  };
  const ctx: ActivityContext = { programme: programme.data, chapter, activity, index, all, snapshot: snapshot.data, remaining: timer.remaining, need: timer.need, goNext };
  const ready = readyToComplete(ctx);
  const locked = !gate?.unlocked;
  const timeGated = timer.remaining > 0;
  const completed = gate?.completed;
  const onComplete = async () => {
    try {
      await complete.mutateAsync(activity.id);
      toast('Activity completed', 'success');
      goNext();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const footer = (
    <Stack gap={spacing.sm}>
      {footerExtra?.(ctx)}
      {locked ? (
        <Button title="Locked" disabled disabledReason={gate?.reason ?? 'Complete the previous activity first.'} icon={<Icon name="Lock" size={16} color={colors.inkMuted} />} testID="activity-locked" />
      ) : completed ? (
        <Button title={next ? 'Continue to next activity →' : 'View course completion →'} variant="coral" onPress={goNext} testID="activity-next" />
      ) : timeGated ? (
        <Button title={`Wait ${formatCountdown(timer.remaining)}`} disabled disabledReason={`${ACTIVITY_LABEL[activity.type]} timer active · Proceed to next activity once unlocked`} icon={<Icon name="Lock" size={16} color={colors.inkMuted} />} testID="activity-wait" />
      ) : !ready.ok ? (
        <Button title="Mark complete" disabled disabledReason={ready.reason} testID="activity-complete-disabled" />
      ) : (
        <Button title={next ? 'Mark complete & continue →' : 'Mark complete →'} variant="coral" onPress={onComplete} loading={complete.isPending} testID="activity-complete" />
      )}
    </Stack>
  );
  return (
    <Screen testID={testID} header={<ScreenHeader backLabel="Back to course" onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate(Routes.StudentOutline, { programmeId }))} actions={[{ label: ACTIVITY_LABEL[activity.type].toUpperCase(), accessibilityLabel: `Activity type ${ACTIVITY_LABEL[activity.type]}`, onPress: () => undefined }]} />} footer={footer} onScrollEnd={onScrollEnd}>
      <Text variant="overline" color={colors.coral600}>Chapter {chapter.index} · {chapter.title}</Text>
      <Text variant="displayMd" style={{ marginVertical: spacing.xs }}>{activity.title}</Text>
      <Row justify="space-between" style={{ marginBottom: spacing.md }}>
        <Row gap={6}><Icon name="Clock" size={14} color={colors.inkMuted} /><Text variant="bodySm">{activity.minutes} minutes • Activity {activity.index} of {chapter.activities.length}</Text></Row>
        <Button title="Ask coach" variant="outline" size="sm" fullWidth={false} onPress={() => navigation.navigate(Routes.StudentAskCoach, { programmeId, activityId })} testID="activity-ask-coach" />
      </Row>
      {!completed && !locked ? (
        <View style={[styles.banner, timeGated ? styles.bannerGreen : styles.bannerDone]}>
          <Row gap={6}><Icon name={timeGated ? 'Timer' : 'CircleCheck'} size={16} color={timeGated ? colors.green900 : colors.success600} /><Text variant="label" color={timeGated ? colors.green900 : colors.success600}>{timeGated ? `Complete unlocks in ${formatCountdown(timer.remaining)}` : 'Pacing requirement met'}</Text></Row>
          <Pill label={timeGated ? 'In progress' : 'Ready'} tone={timeGated ? 'green' : 'green'} small dot />
        </View>
      ) : completed ? (
        <View style={[styles.banner, styles.bannerDone]}><Row gap={6}><Icon name="CircleCheck" size={16} color={colors.success600} /><Text variant="label" color={colors.success600}>Completed</Text></Row></View>
      ) : null}
      {children(ctx)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderRadius: 12, marginBottom: spacing.md },
  bannerGreen: { backgroundColor: colors.green50 },
  bannerDone: { backgroundColor: colors.success100 },
});
