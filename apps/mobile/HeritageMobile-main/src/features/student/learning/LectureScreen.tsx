import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { isMockMode } from '../../../config/appConfig';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Card, Row, Stack, Icon, Button, Pill, ProgressBar, ListRow } from '../../../components';
import { colors, spacing } from '../../../theme';
import type { RootScreenProps } from '../../../navigation/types';
import { ActivityShell } from './ActivityShell';
import { Routes } from '../../../navigation/routes';
import { useAppNavigation } from '../../../navigation/hooks';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

const SLIDE_SECONDS = 24;

/** Lecture player with bundled slide content: play/pause, prev/next, progress, captions, full screen. */
export function LectureScreen({ route }: RootScreenProps<'StudentLecture'>) {
  const { programmeId, activityId } = route.params;
  const navigation = useAppNavigation();
  const [slide, setSlide] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [credited, setCredited] = useState<Set<number>>(new Set());
  const [elapsed, setElapsed] = useState(0);
  const [captions, setCaptions] = useState(true);
  const [fullScreen, setFullScreen] = useState(false);
  const slideCountRef = useRef(5);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setElapsed(e => {
        if (e + 1 >= SLIDE_SECONDS) {
          setCredited(c => new Set(c).add(slide));
          setSlide(s => {
            if (s + 1 >= slideCountRef.current) {
              setPlaying(false);
              return s;
            }
            return s + 1;
          });
          return 0;
        }
        return e + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [playing, slide]);

  return (
    <ActivityShell programmeId={programmeId} activityId={activityId} testID="lecture-screen" readyToComplete={({ activity }) => {
      const total = activity.lecture?.slides.length ?? 0;
      return credited.size >= total ? { ok: true } : { ok: false, reason: `Watch all slides (${credited.size}/${total} credited) to complete the lecture.` };
    }}>
      {({ activity }) => {
        const lec = activity.lecture!;
        slideCountRef.current = lec.slides.length;
        const current = lec.slides[slide];
        const player = (dark: boolean) => (
          <Stack gap={spacing.sm}>
            <Row justify="space-between">
              <Text variant="overline" color={colors.green100}>Instructor lecture · slides · {lec.slides.length} slides</Text>
              <Pill label={playing ? 'Playing' : 'Paused'} tone={playing ? 'green' : 'grey'} small dot />
            </Row>
            <Text variant="displayXs" color={colors.white}>{activity.title}</Text>
            <View style={styles.avatarWrap}>
              <PresenterIllustration size={dark ? 180 : 120} />
              <Text variant="caption" color={colors.green100}>{lec.presenter} · illustrated presenter (no generated video/voice)</Text>
            </View>
            <View style={styles.slide}>
              <Row justify="space-between"><Text variant="label" color={colors.gold500}>Slide {slide + 1} / {lec.slides.length}</Text><Text variant="caption" color={colors.green100}>{SLIDE_SECONDS - elapsed}s</Text></Row>
              <Text variant="titleSm" color={colors.white}>{current.title}</Text>
              {current.bullets.map(b => <Row key={b} gap={6} align="flex-start"><View style={styles.goldDot} /><Text variant="bodySm" color={colors.green100} style={{ flex: 1 }}>{b}</Text></Row>)}
              {captions ? <Text variant="bodySm" color={colors.white} style={{ fontStyle: 'italic', marginTop: 4 }}>“{current.transcript}”</Text> : null}
            </View>
            <ProgressBar value={((slide + elapsed / SLIDE_SECONDS) / lec.slides.length) * 100} color={colors.gold500} track={colors.green700} />
            <Row>
              <Button title="Prev" variant="outline" size="sm" style={{ flex: 1 }} onPress={() => { setSlide(s => Math.max(0, s - 1)); setElapsed(0); }} disabled={slide === 0} testID="lecture-prev" />
              <Button title={playing ? 'Pause' : 'Play lecture'} variant="coral" size="sm" style={{ flex: 1.6 }} icon={<Icon name={playing ? 'Pause' : 'Play'} size={16} color={colors.white} />} onPress={() => setPlaying(p => !p)} testID="lecture-play" />
              <Button title="Next" variant="outline" size="sm" style={{ flex: 1 }} onPress={() => { setCredited(c => new Set(c).add(slide)); setSlide(s => Math.min(lec.slides.length - 1, s + 1)); setElapsed(0); }} disabled={slide >= lec.slides.length - 1} testID="lecture-next" />
            </Row>
            <Row justify="space-between">
              <Text variant="caption" color={colors.green100}>Credited {credited.size}/{lec.slides.length} slides</Text>
              <Row>
                <Pressable accessibilityRole="button" accessibilityLabel={captions ? 'Hide captions' : 'Show captions'} onPress={() => setCaptions(c => !c)} style={styles.iconBtn} testID="lecture-captions"><Icon name={captions ? 'Captions' : 'CaptionsOff'} size={18} color={colors.white} /></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={fullScreen ? 'Exit full screen' : 'Full screen'} onPress={() => setFullScreen(f => !f)} style={styles.iconBtn} testID="lecture-fullscreen"><Icon name={fullScreen ? 'Minimize2' : 'Maximize2'} size={18} color={colors.white} /></Pressable>
              </Row>
            </Row>
          </Stack>
        );
        return (
          <>
            <Text variant="bodySm" style={{ marginBottom: spacing.md }}>Watch the lecture. Each slide is credited after {SLIDE_SECONDS}s of playback or when you advance manually. Credit all slides to mark the lecture complete.</Text>
            <Card tone="dark">{player(false)}</Card>
            <Card style={{ marginTop: spacing.md }} padding={spacing.md}>
              <Text variant="overline" style={{ marginBottom: 4 }}>Transcript</Text>
              {lec.slides.map((s, i) => <Text key={s.title} variant="bodySm" style={{ marginBottom: 6 }} color={i === slide ? colors.ink : colors.inkMuted}>{i + 1}. {s.transcript}</Text>)}
            </Card>
            <Card style={{ marginTop: spacing.md }} padding={spacing.md}>
              <Text variant="overline" style={{ marginBottom: 4 }}>Ask the instructor</Text>
              <ListRow icon="MessageCircleQuestion" title="Ask the instructor" subtitle={isMockMode() ? 'Demo coach grounded in this chapter' : 'Coach grounded in this chapter'} onPress={() => navigation.navigate(Routes.StudentAskCoach, { programmeId, activityId })} testID="lecture-ask" />
            </Card>
            <FullScreenModal visible={fullScreen} onClose={() => setFullScreen(false)}>{player(true)}</FullScreenModal>
          </>
        );
      }}
    </ActivityShell>
  );
}

function FullScreenModal({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View style={[styles.full, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8, paddingHorizontal: Math.max(16, (width - 640) / 2) }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close full screen" onPress={onClose} style={styles.close} testID="lecture-fullscreen-close"><Icon name="X" color={colors.white} /></Pressable>
        {children}
      </View>
    </Modal>
  );
}

function PresenterIllustration({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Circle cx="60" cy="60" r="58" fill={colors.green700} />
      <Rect x="30" y="76" width="60" height="44" rx="16" fill={colors.gold500} />
      <Circle cx="60" cy="48" r="24" fill="#F1D6C2" />
      <Path d="M36 44 C36 26 84 26 84 44 L84 40 C84 30 36 30 36 40 Z" fill={colors.green900} />
      <Circle cx="50" cy="50" r="7" fill="none" stroke={colors.green900} strokeWidth="2.5" />
      <Circle cx="70" cy="50" r="7" fill="none" stroke={colors.green900} strokeWidth="2.5" />
      <Path d="M57 50 H63" stroke={colors.green900} strokeWidth="2.5" />
      <Path d="M52 62 Q60 68 68 62" stroke={colors.green900} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  avatarWrap: { alignItems: 'center', gap: 6 },
  slide: { backgroundColor: colors.green800, borderRadius: 12, padding: spacing.md, gap: 6 },
  goldDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold500, marginTop: 7 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  full: { flex: 1, backgroundColor: colors.green900, justifyContent: 'center' },
  close: { position: 'absolute', top: 50, right: 16, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
});
