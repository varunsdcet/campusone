import React, { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, Icon, DemoLabel, LoadingState, ErrorState, Toggle, ConfirmSheet, EmptyState, InfoBanner } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import type { RootScreenProps } from '../../../navigation/types';
import { useSection } from './useCourses';
import { useLiveRoom } from './useCourseLearning';
import { useClockTick } from '../../shared/hooks';
import { formatDate, formatTime } from '../../../utils/format';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';

type Props = RootScreenProps<'StudentLiveRoom'> | RootScreenProps<'InstructorLiveRoom'>;

export function LiveRoomScreen(props: Props) {
  return isMockMode() ? <DemoLiveRoom {...props} /> : <LiveClassRoom {...props} />;
}

/** BigBlueButton class room: status, join/start (opens the browser client), end (instructor) and recordings. */
function LiveClassRoom({ route }: Props) {
  const { sectionId } = route.params;
  const section = useSection(sectionId);
  const room = useLiveRoom(sectionId);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const st = room.status.data;
  const moderator = st?.role === 'moderator';
  const running = st?.running === true;
  const notOpen = !moderator && st?.running === false;

  const join = async () => {
    try {
      const r = await room.join.mutateAsync();
      if (r.status === 'waiting') {
        toast('The instructor has not opened this room yet.', 'info');
        return;
      }
      await Linking.openURL(r.url).catch(() => {
        throw new Error('Could not open the live class link.');
      });
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const end = async () => {
    try {
      const r = await room.end.mutateAsync();
      toast(r.ended ? 'Live class ended for everyone' : 'The room was not running', r.ended ? 'success' : 'info');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setConfirmEnd(false);
    }
  };

  const statusLabel = !st ? '' : !st.canJoin ? 'Closed' : running ? `Live now${st.participantCount ? ` · ${st.participantCount}` : ''}` : st.running === null ? 'Available' : moderator ? 'Not started' : 'Room not open';
  return (
    <Screen testID="live-room" header={<ScreenHeader title="Live class" subtitle={section.data ? `${section.data.course.code} · ${section.data.sectionCode}` : undefined} />} refreshing={room.status.isRefetching} onRefresh={() => { void room.status.refetch(); void room.recordings.refetch(); }}>
      {room.status.isLoading ? <LoadingState /> : !st ? <ErrorState error={room.status.error} onRetry={() => room.status.refetch()} /> : (
        <Stack>
          <Card tone="dark">
            <Stack gap={spacing.sm}>
              <Row justify="space-between"><Text variant="overline" color={colors.green100}>{st.provider === 'bigbluebutton' ? 'BigBlueButton' : 'Online class'} · {moderator ? 'Moderator' : 'Participant'}</Text><Pill label={statusLabel} tone={running ? 'green' : 'grey'} small dot testID="room-status" /></Row>
              <Text variant="displaySm" color={colors.white}>{st.meetingName}</Text>
              <View style={styles.stage}>
                <Icon name={running ? 'Users' : 'Video'} size={40} color={colors.green100} />
                <Text variant="bodySm" color={colors.green100} align="center">
                  {!st.canJoin
                    ? 'You have completed this course, so its live class is closed. Published recordings are still available below.'
                    : running
                      ? `Class in session${st.startedAt ? ` since ${formatTime(new Date(st.startedAt))}` : ''}${st.recording ? ' · recording' : ''}.`
                      : moderator
                        ? 'Start the class to open the room for your students.'
                        : st.running === null
                          ? 'Join to enter the online classroom.'
                          : 'Room not open. You can join as soon as your instructor starts the class.'}
                </Text>
              </View>
              {st.canJoin ? (
                <Button title={moderator ? (running ? 'Join class' : 'Start class') : 'Join class'} variant="coral" onPress={join} loading={room.join.isPending} disabled={notOpen} disabledReason="Room not open. The instructor has not started this class yet." testID="room-join" />
              ) : null}
              {moderator && running ? <Button title="End class for everyone" variant="danger" onPress={() => setConfirmEnd(true)} testID="room-end" /> : null}
            </Stack>
          </Card>
          <Text variant="caption">The class opens in your browser so your camera and microphone work with the conferencing client. Return to Campus One when you leave.</Text>
          <Row justify="space-between"><Text variant="overline">Recordings</Text>{room.recordings.data?.length ? <Text variant="caption">{room.recordings.data.length}</Text> : null}</Row>
          {room.recordings.isLoading ? <LoadingState /> : room.recordings.error ? <InfoBanner tone="grey" text={errorMessage(room.recordings.error)} /> : !room.recordings.data?.length ? (
            <EmptyState icon="Clapperboard" title="No recordings yet" message={moderator ? 'Recorded classes appear here after BigBlueButton finishes processing them.' : 'Recordings your instructor publishes will appear here.'} testID="recordings-empty" />
          ) : room.recordings.data.map(r => (
            <Card key={r.recordId} padding={spacing.md} testID={`recording-${r.recordId}`}>
              <Row gap={spacing.md}>
                <View style={styles.tile}><Icon name="PlayCircle" size={18} color={colors.green900} /></View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" numberOfLines={2}>{r.name}</Text>
                  <Text variant="caption">{[r.startTime ? formatDate(r.startTime) : null, r.lengthMinutes ? `${r.lengthMinutes} min` : null, r.participants ? `${r.participants} attended` : null].filter(Boolean).join(' · ')}</Text>
                  {moderator && !r.published ? <Pill label="Unpublished" tone="gold" small style={{ marginTop: 4 }} /> : null}
                </View>
                {r.playbackUrl ? <Button title="Watch" variant="outline" size="sm" fullWidth={false} onPress={() => void Linking.openURL(r.playbackUrl!).catch(() => toast('Could not open the recording.', 'error'))} /> : null}
              </Row>
            </Card>
          ))}
        </Stack>
      )}
      <ConfirmSheet visible={confirmEnd} onClose={() => setConfirmEnd(false)} onConfirm={end} title="End the live class?" message="Everyone in the room will be disconnected." confirmLabel="End class" destructive loading={room.end.isPending} />
    </Screen>
  );
}

/** Clearly marked DEMO live-class room (mock mode). No conferencing backend exists; nothing is joined. */
function DemoLiveRoom({ navigation, route }: Props) {
  const { sectionId, roomId } = route.params;
  const section = useSection(sectionId);
  const [joined, setJoined] = useState(false);
  const [mic, setMic] = useState(false);
  const [cam, setCam] = useState(false);
  const now = useClockTick(1000);
  const s = section.data;
  return (
    <Screen testID="live-room" header={<ScreenHeader title="Demo live room" subtitle={roomId} />}>
      {section.isLoading ? <LoadingState /> : (
        <Stack>
          <DemoLabel text="DEMO ROOM · no conferencing service · nothing is transmitted" />
          <Card tone="dark">
            <Stack gap={spacing.sm}>
              <Row justify="space-between"><Text variant="overline" color={colors.green100}>{s?.course.code} · {s?.sectionCode}</Text><Pill label={joined ? 'Joined (demo)' : s?.liveRoomReady ? 'Room ready' : 'Not open'} tone={joined ? 'green' : 'grey'} small dot /></Row>
              <Text variant="displaySm" color={colors.white}>{s?.course.title}</Text>
              <View style={styles.stage}>
                <Icon name={joined ? 'Users' : 'Video'} size={40} color={colors.green100} />
                <Text variant="bodySm" color={colors.green100} align="center">{joined ? `You are in the demo room · ${formatTime(new Date(now))}` : 'Join to enter the simulated classroom. No audio or video is captured.'}</Text>
              </View>
              {joined ? (
                <>
                  <Toggle label="Microphone (simulated)" value={mic} onChange={setMic} testID="room-mic" labelColor={colors.white} />
                  <Toggle label="Camera (simulated)" value={cam} onChange={setCam} testID="room-cam" labelColor={colors.white} />
                  <Button title="Leave demo room" variant="danger" onPress={() => { setJoined(false); navigation.goBack(); }} testID="room-leave" />
                </>
              ) : (
                <Button title="Join demo session" variant="coral" onPress={() => setJoined(true)} disabled={!s?.liveRoomReady} disabledReason="The instructor has not opened this room yet (demo state)." testID="room-join" />
              )}
            </Stack>
          </Card>
          <Text variant="caption">A production integration (e.g. BigBlueButton) would open the vendor's native or web client here. This screen only demonstrates the entry point and join state.</Text>
        </Stack>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stage: { backgroundColor: colors.green800, borderRadius: 14, minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  tile: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.info100 },
});
