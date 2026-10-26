import React from 'react';
import { Linking } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, KeyValueRow, InfoBanner } from '../../../components';
import { spacing } from '../../../theme';
import type { RootScreenProps } from '../../../navigation/types';
import { Routes } from '../../../navigation/routes';
import { useCourseContent, useCourseLearning, useCourseSession, useLabAccess, useMarkComplete } from './useCourseLearning';
import { useSettings } from '../../auth/useAuth';
import { formatDate, formatDateTime } from '../../../utils/format';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';

/** Scheduled lecture or lab session of an enrolled course (GET /student/lectures/:id). */
export function CourseLectureScreen({ navigation, route }: RootScreenProps<'StudentCourseLecture'>) {
  const { sectionId, sessionId } = route.params;
  const session = useCourseSession(sessionId);
  const content = useCourseContent(sectionId);
  const complete = useMarkComplete(sectionId);
  const courseLearning = useCourseLearning();
  const labAccess = useLabAccess(Boolean(session.data?.sessionKind === 'lab'));
  const tz = useSettings().data?.timeZone;
  const s = session.data;
  const itemId = `session:${sessionId}`;
  const done = content.data?.items.find(i => i.id === itemId)?.completed ?? false;
  const lab = s?.sessionKind === 'lab';
  const join = () => {
    if (!s) return;
    if (s.liveSectionId) navigation.navigate(Routes.StudentLiveRoom, { sectionId: s.liveSectionId, roomId: s.title });
    else if (s.joinUrl && /^https:\/\//i.test(s.joinUrl)) void Linking.openURL(s.joinUrl).catch(() => toast('Could not open the class link.', 'error'));
  };
  const markDone = async () => {
    try {
      await complete.mutateAsync(itemId);
      toast('Marked complete', 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const launchVirtual = async (id: string) => {
    try {
      const result = await courseLearning.launchVirtualLab(id);
      await Linking.openURL(result.url);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  return (
    <Screen testID="course-lecture" header={<ScreenHeader backLabel="Course" />} refreshing={session.isRefetching} onRefresh={() => { void session.refetch(); void content.refetch(); }}>
      {session.isLoading ? <LoadingState /> : !s ? <ErrorState error={session.error} onRetry={() => session.refetch()} /> : (
        <Stack>
          <Row wrap><Pill label={s.courseCode} tone="grey" small /><Pill label={lab ? 'Lab' : 'Lecture'} tone={lab ? 'purple' : 'blue'} small />{done ? <Pill label="Completed" tone="green" small dot /> : null}</Row>
          <Text variant="displayMd">{s.title}</Text>
          <Card padding={spacing.md}>
            <KeyValueRow label="Date" value={formatDate(s.startsAt, { weekday: true })} />
            <KeyValueRow label="Starts" value={formatDateTime(s.startsAt, tz)} />
            {s.endsAt ? <KeyValueRow label="Ends" value={formatDateTime(s.endsAt, tz)} /> : null}
            <KeyValueRow label="Location" value={s.location || 'To be announced'} />
            <KeyValueRow label="Delivery" value={s.deliveryMode ? s.deliveryMode.replace(/_/g, ' ') : '—'} border={false} />
          </Card>
          {s.liveSectionId || (s.joinUrl && /^https:\/\//i.test(s.joinUrl)) ? <Button title="Join live class" variant="coral" onPress={join} testID="lecture-join" /> : null}
          {lab ? <Card padding={spacing.md}>
            <Row justify="space-between" wrap><Text variant="titleSm">Lab eligibility</Text><Pill label={labAccess.data?.accessStatus || (labAccess.isLoading ? 'Loading' : 'Not configured')} tone={labAccess.data?.accessStatus === 'Cleared' ? 'green' : 'gold'} small dot /></Row>
            {labAccess.data?.eligibility.map(item => <KeyValueRow key={item.id} label={item.training || item.equipment || 'General access'} value={[item.status, item.expiresOn ? `expires ${item.expiresOn}` : ''].filter(Boolean).join(' · ')} />)}
            {labAccess.data?.virtualLabs.map(item => <Stack key={item.id} gap={spacing.xs} style={{ marginTop: spacing.sm }}><Text variant="label">{item.name}</Text><Text variant="caption">{item.course}{item.provider ? ` · ${item.provider}` : ''}</Text><Button title={item.canLaunch ? 'Launch virtual lab' : 'Eligibility required'} variant="outline" disabled={!item.canLaunch} onPress={() => void launchVirtual(item.id)} /></Stack>)}
          </Card> : null}
          {lab ? <Button title="Open my lab notes" variant="outline" onPress={() => navigation.navigate(Routes.StudentCourseNotes, { sectionId, sessionId })} testID="lecture-notes" /> : null}
          {done ? <InfoBanner tone="green" icon="CircleCheck" text="You marked this session complete." /> : (
            <Button title="Mark as complete" variant="outline" onPress={markDone} loading={complete.isPending} disabled={content.isLoading} testID="lecture-complete" />
          )}
        </Stack>
      )}
    </Screen>
  );
}
