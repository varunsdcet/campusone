import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Row, Stack, Button, Card, Icon } from '../../components';
import { colors, spacing } from '../../theme';
import { appConfig } from '../../config/appConfig';
import type { AiDraftStoryboard } from '../../domain/types';

type Gender = 'female' | 'male';
type HostMessage = { type?: string; id?: number; message?: string };

const BRIDGE = "(function(){window.addEventListener('message',function(e){var d=e.data;if(d&&typeof d==='object'&&/^th-(ready|error|speak-done)$/.test(d.type)&&window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify(d));}});})();true;";

export function AvatarVideoPlayer({ storyboard, testID = 'avatar-video' }: { storyboard: AiDraftStoryboard; testID?: string }) {
  const webRef = useRef<WebView<object>>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [gender, setGender] = useState<Gender>('female');
  const [status, setStatus] = useState('Loading avatar…');
  const playingRef = useRef(false);
  const waitRef = useRef<{ id: number; resolve: () => void } | null>(null);
  const speakId = useRef(0);
  const slides = storyboard.slides;
  const slide = slides[slideIndex];
  const mins = Math.max(1, Math.round((storyboard.estimated_duration_sec || 360) / 60));

  const send = useCallback((msg: Record<string, unknown>) => { webRef.current?.injectJavaScript(`window.postMessage(${JSON.stringify(msg)},'*');true;`); }, []);
  const release = useCallback(() => { const w = waitRef.current; if (w) { waitRef.current = null; w.resolve(); } }, []);

  useEffect(() => () => { playingRef.current = false; send({ type: 'th-stop' }); release(); }, [send, release]);
  useEffect(() => {
    if (ready) return;
    send({ type: 'th-ping' });
    const t = setInterval(() => send({ type: 'th-ping' }), 1000);
    return () => clearInterval(t);
  }, [ready, gender, send]);

  const onMessage = (e: WebViewMessageEvent) => {
    let d: HostMessage;
    try { d = JSON.parse(e.nativeEvent.data) as HostMessage; } catch { return; }
    if (d.type === 'th-ready') { setReady(true); setStatus('Avatar ready — press Play'); }
    if (d.type === 'th-error') { setStatus(`Avatar error: ${d.message || 'failed'}`); setReady(false); }
    if (d.type === 'th-speak-done' && waitRef.current?.id === d.id) release();
  };

  const speak = useCallback((text: string) => new Promise<void>(resolve => {
    const id = ++speakId.current;
    waitRef.current = { id, resolve };
    send({ type: 'th-resume' });
    send({ type: 'th-speak-text', text, id });
    setTimeout(() => { if (waitRef.current?.id === id) { waitRef.current = null; resolve(); } }, Math.min(90000, Math.max(8000, text.length * 80)));
  }), [send]);

  const stop = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    setStatus('Paused');
    send({ type: 'th-stop' });
    release();
  }, [send, release]);

  const playFrom = async (start: number) => {
    webRef.current?.injectJavaScript('window.thUnlockAudio && window.thUnlockAudio(); true;');
    send({ type: 'th-resume' });
    playingRef.current = true;
    setPlaying(true);
    for (let i = start; i < slides.length; i++) {
      if (!playingRef.current) return;
      setSlideIndex(i);
      setStatus(`Playing slide ${i + 1} / ${slides.length}`);
      await speak(slides[i].narration);
      if (!playingRef.current) return;
      await new Promise<void>(r => setTimeout(r, 350));
    }
    playingRef.current = false;
    setPlaying(false);
    setStatus('Finished');
    send({ type: 'th-idle' });
  };

  const switchGender = (next: Gender) => {
    if (next === gender) return;
    stop();
    setReady(false);
    setGender(next);
    setStatus(`Loading ${next} avatar…`);
  };

  return (
    <Card padding={spacing.md} testID={testID}>
      <Stack gap={spacing.sm}>
        <View>
          <Text variant="overline">AI video · {mins} min · {slides.length} slides · {gender === 'male' ? 'Male' : 'Female'}</Text>
          <Text variant="titleMd">{storyboard.title}</Text>
          <Text variant="caption" testID={`${testID}-status`}>{status}</Text>
        </View>
        <Row>
          {(['female', 'male'] as const).map(g => <Button key={g} title={g === 'female' ? 'Female' : 'Male'} size="sm" variant={gender === g ? 'primary' : 'outline'} fullWidth={false} disabled={playing} onPress={() => switchGender(g)} testID={`${testID}-${g}`} />)}
        </Row>
        <View style={styles.avatar}>
          <WebView
            key={gender}
            ref={webRef}
            source={{ uri: `${appConfig.webOrigin ?? ''}/ai-draft/talkinghead-host.html?gender=${gender}` }}
            javaScriptEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            originWhitelist={['*']}
            injectedJavaScriptBeforeContentLoaded={BRIDGE}
            onMessage={onMessage}
            onError={e => { setReady(false); setStatus(`Avatar error: ${e.nativeEvent.description || 'failed to load'}`); }}
            onContentProcessDidTerminate={() => { stop(); setReady(false); webRef.current?.reload(); }}
            scrollEnabled={false}
            style={styles.web}
            testID={`${testID}-webview`}
          />
        </View>
        {slide ? (
          <View style={styles.slide}>
            <Text variant="caption">Slide {slide.number} / {slides.length}</Text>
            <Text variant="titleSm">{slide.heading}</Text>
            {slide.bullets.map(b => <Row key={b} gap={6} align="flex-start"><Text variant="bodySm">•</Text><Text variant="bodySm" style={{ flex: 1 }}>{b}</Text></Row>)}
            <Text variant="bodySm" style={styles.narration}>{slide.narration}</Text>
          </View>
        ) : null}
        <Row>
          <Button title="Prev" variant="outline" size="sm" style={{ flex: 1 }} disabled={slideIndex === 0 || playing} onPress={() => { stop(); setSlideIndex(i => Math.max(0, i - 1)); }} testID={`${testID}-prev`} />
          {playing
            ? <Button title="Pause" size="sm" style={{ flex: 1.4 }} icon={<Icon name="Pause" size={14} color={colors.white} />} onPress={stop} testID={`${testID}-pause`} />
            : <Button title={slideIndex > 0 && slideIndex < slides.length ? 'Resume' : 'Play slideshow'} size="sm" style={{ flex: 1.4 }} icon={<Icon name="Play" size={14} color={colors.white} />} disabled={!ready} onPress={() => void playFrom(slideIndex)} testID={`${testID}-play`} />}
          <Button title="Next" variant="outline" size="sm" style={{ flex: 1 }} disabled={slideIndex >= slides.length - 1 || playing} onPress={() => { stop(); setSlideIndex(i => Math.min(slides.length - 1, i + 1)); }} testID={`${testID}-next`} />
        </Row>
      </Stack>
    </Card>
  );
}

export function AvatarVideoModal({ storyboard, onClose }: { storyboard: AiDraftStoryboard | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!storyboard} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
        <Row justify="space-between" style={styles.sheetHead}>
          <Text variant="titleMd" style={{ flex: 1 }} numberOfLines={1}>AI lesson video</Text>
          <Button title="Close" variant="ghost" size="sm" fullWidth={false} onPress={onClose} testID="avatar-video-close" />
        </Row>
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>{storyboard ? <AvatarVideoPlayer storyboard={storyboard} /> : null}</ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  avatar: { height: 280, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.green900 },
  web: { flex: 1, backgroundColor: 'transparent' },
  slide: { padding: spacing.md, borderRadius: 12, backgroundColor: colors.surfaceMuted, gap: 4 },
  narration: { marginTop: spacing.xs, fontStyle: 'italic' },
  sheet: { flex: 1, backgroundColor: colors.cream },
  sheetHead: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
});
