import React, { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Row, Stack, Icon, Button, Pill, Input, Chip, DemoLabel, Card } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import type { RootScreenProps } from '../../../navigation/types';
import { useProgramme } from '../catalogue/useCatalogue';
import { findActivity, useCoach, useSnapshot } from './useLearning';
import type { CoachMessage } from '../../../domain/types';
import { errorMessage } from '../../../services/errors';
import { MarkdownText } from '../../shared/MarkdownText';

const PROMPTS = ['✨ Explain simply', '💼 Workplace example', '📝 Quiz me on this'];

export function AskCoachScreen({ navigation, route }: RootScreenProps<'StudentAskCoach'>) {
  const { programmeId, activityId } = route.params;
  const programme = useProgramme(programmeId);
  const snap = useSnapshot(programmeId);
  const found = findActivity(programme.data, activityId);
  const chapterId = found?.chapter.id ?? '';
  const coach = useCoach(programmeId, chapterId);
  const [text, setText] = useState('');
  const [failed, setFailed] = useState<string | null>(null);
  const list = useRef<FlatList<CoachMessage>>(null);
  const insets = useSafeAreaInsets();
  const messages = coach.conversation.data?.messages ?? [];
  useEffect(() => {
    if (messages.length) setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.length]);
  const send = async (prompt: string) => {
    const clean = prompt.replace(/^[^\w]+/, '').trim();
    if (!clean) return;
    setText('');
    setFailed(null);
    try {
      await coach.ask.mutateAsync({ activityId, prompt: clean });
    } catch (e) {
      setFailed(errorMessage(e));
    }
  };
  const unlockedChapters = snap.data?.chapterUnlockedCount ?? 0;
  return (
    <SafeAreaView edges={['top']} style={styles.root} testID="ask-coach">
      <View style={styles.header}>
        <Row justify="space-between">
          <Row gap={10} style={{ flex: 1 }}>
            <View style={styles.spark}><Icon name="Sparkles" size={18} color={colors.white} /></View>
            <View style={{ flex: 1 }}>
              <Text variant="titleMd" color={colors.white}>Ask coach</Text>
              <Text variant="caption" color={colors.green100} numberOfLines={1}>About: {found?.activity.title ?? '…'}</Text>
            </View>
          </Row>
          <Pressable accessibilityRole="button" accessibilityLabel="Hide coach and return to lesson" onPress={() => navigation.goBack()} style={styles.hide} testID="coach-hide"><Text variant="label" color={colors.white}>Hide</Text></Pressable>
        </Row>
        <Row gap={6} style={{ marginTop: spacing.sm }}><Icon name="Lock" size={12} color={colors.green100} /><Text variant="caption" color={colors.green100}>{programme.data?.title} · {unlockedChapters} ch open</Text></Row>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={list}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <Stack gap={spacing.sm}>
              <Row>{PROMPTS.map(p => <Chip key={p} label={p} onPress={() => send(p)} testID={`coach-prompt-${PROMPTS.indexOf(p)}`} />)}</Row>
              <View style={styles.info}><Icon name="Info" size={14} color={colors.green900} /><Text variant="caption" style={{ flex: 1 }}>Ask about your purchased programmes — answers use only chapters that are unlocked for you today ({programme.data?.title} · {unlockedChapters} ch open).{isMockMode() ? ' Responses are deterministic demo text, not a live AI service.' : ''}</Text></View>
              {!messages.length ? (
                <View style={styles.empty}>
                  <View style={styles.emptyIcon}><Icon name="GraduationCap" size={28} color={colors.green900} /></View>
                  <Text variant="titleSm" align="center">Ask me anything about your coursework</Text>
                  <Text variant="bodySm" align="center">I explain concepts, generate workplace scenarios, and create practice checks for Chapter {found?.chapter.index ?? 1}.</Text>
                </View>
              ) : null}
            </Stack>
          }
          renderItem={({ item }) => item.role === 'user' ? (
            <View style={styles.userRow}><View style={styles.userBubble}><Text variant="body" color={colors.white}>{item.text}</Text></View>{item.status === 'error' ? <Text variant="caption" color={colors.danger600}>Not delivered</Text> : null}</View>
          ) : (
            <View style={styles.coachWrap}>
              <Row gap={6}><Pill label="Academic coach · demo" tone="green" small /><Text variant="caption">Chapter {found?.chapter.index} material</Text></Row>
              <Card padding={spacing.md}><MarkdownText text={item.text} /></Card>
              <Row><Chip label="Quiz me on this" onPress={() => send('Quiz me on this')} /><Chip label="Show another example" onPress={() => send('Show another workplace example')} /></Row>
            </View>
          )}
          ListFooterComponent={
            <Stack gap={spacing.sm}>
              {coach.ask.isPending ? <Row gap={8} style={styles.coachWrap}><Icon name="LoaderCircle" size={16} color={colors.green700} /><Text variant="bodySm">{isMockMode() ? 'Coach is preparing a demo response…' : 'Coach is preparing a response…'}</Text></Row> : null}
              {failed ? <Row gap={8} style={styles.errorRow}><Icon name="TriangleAlert" size={16} color={colors.danger600} /><Text variant="bodySm" color={colors.danger600} style={{ flex: 1 }}>{failed}</Text><Button title="Retry" size="sm" variant="outline" fullWidth={false} onPress={() => { const last = [...messages].reverse().find(m => m.role === 'user'); if (last) void send(last.text); }} testID="coach-retry" /></Row> : null}
              {messages.length ? <Button title="Clear conversation" variant="ghost" size="sm" onPress={() => coach.clear.mutate()} testID="coach-clear" /> : null}
            </Stack>
          }
        />
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <Row gap={6}><Icon name="CircleCheck" size={12} color={colors.success600} /><Text variant="caption">{isMockMode() ? 'Demo responses limited to your unlocked chapters' : 'Responses limited to your unlocked chapters'}</Text></Row>
          <Row>
            <View style={{ flex: 1 }}><Input testID="coach-input" placeholder="Ask about your unlocked chapters.." value={text} onChangeText={setText} returnKeyType="send" onSubmitEditing={() => send(text)} /></View>
            <Button title="Send" fullWidth={false} onPress={() => send(text)} disabled={!text.trim() || coach.ask.isPending} icon={<Icon name="Send" size={16} color={colors.white} />} testID="coach-send" />
          </Row>
          <DemoLabel text="Deterministic demo coach · no model keys" />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.green900 },
  header: { backgroundColor: colors.green900, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, paddingTop: spacing.sm },
  spark: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.green700, alignItems: 'center', justifyContent: 'center' },
  hide: { paddingHorizontal: 14, minHeight: 36, borderRadius: 999, backgroundColor: colors.green700, justifyContent: 'center' },
  list: { backgroundColor: colors.cream, padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  info: { flexDirection: 'row', gap: 8, backgroundColor: colors.green50, padding: spacing.md, borderRadius: 12, alignItems: 'flex-start' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: spacing.xl },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.green50, alignItems: 'center', justifyContent: 'center' },
  userRow: { alignItems: 'flex-end', gap: 4 },
  userBubble: { backgroundColor: colors.green900, borderRadius: 18, borderBottomRightRadius: 4, padding: spacing.md, maxWidth: '85%' },
  coachWrap: { gap: spacing.sm },
  errorRow: { backgroundColor: colors.danger100, padding: spacing.sm, borderRadius: 10 },
  composer: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md, gap: spacing.sm },
});
