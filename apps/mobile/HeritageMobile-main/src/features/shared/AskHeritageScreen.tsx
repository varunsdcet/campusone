import React, { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View, Share } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Row, Stack, Icon, Button, Pill, Input, Chip, DemoLabel, Card, LoadingState } from '../../components';
import { colors, spacing } from '../../theme';
import { isMockMode } from '../../config/appConfig';
import type { RootScreenProps } from '../../navigation/types';
import { useAskHeritage } from './useShared';
import type { AskHeritageAnswer } from '../../services/contracts/records';
import { formatDateTime } from '../../utils/format';
import { navigateTo } from '../../navigation/hooks';
import { useSessionStore } from '../../state/sessionStore';
import { errorMessage } from '../../services/errors';
import { toast } from '../../state/uiStore';

const KIND_TONE = { FACT: 'grey', INFERENCE: 'grey', CONFLICT: 'red', UNCERTAINTY: 'yellow' } as const;

/** Ask Heritage – READ-ONLY assistant grounded in local demo records. It never modifies anything. */
export function AskHeritageScreen({ navigation }: RootScreenProps<'AskHeritage'>) {
  const { suggestions, history, ask, feedback } = useAskHeritage();
  const role = useSessionStore(s => s.user?.role);
  const user = useSessionStore(s => s.user);
  const [text, setText] = useState('');
  const [failed, setFailed] = useState<string | null>(null);
  const [pendingQ, setPendingQ] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<AskHeritageAnswer>>(null);
  const items = history.data ?? [];
  const send = async (q: string) => {
    const clean = q.trim();
    if (!clean) return;
    setText(''); setFailed(null); setPendingQ(clean);
    try { await ask.mutateAsync(clean); setTimeout(() => list.current?.scrollToEnd({ animated: true }), 80); }
    catch (e) { setFailed(errorMessage(e)); }
    finally { setPendingQ(null); }
  };
  return (
    <SafeAreaView edges={['top']} style={styles.root} testID="ask-heritage">
      <View style={styles.header}>
        <Row gap={10} align="flex-start">
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => navigation.goBack()} style={styles.back} testID="ask-back"><Icon name="ChevronLeft" size={22} /></Pressable>
          <View style={styles.tile}><Icon name="Sparkles" size={18} color={colors.white} /></View>
          <View style={styles.headerCopy}>
            <Text variant="titleMd">Ask Campus One</Text>
            <Text variant="caption">{isMockMode() ? 'Grounded campus records · demo' : 'Grounded in your campus records'}</Text>
            <View style={styles.readOnly}><Icon name="Lock" size={11} color={colors.success600} /><Text variant="caption" color={colors.success600}>Read-only</Text></View>
          </View>
        </Row>
      </View>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <FlatList ref={list} data={items} keyExtractor={a => a.id} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          ListHeaderComponent={
            <Card>
              <Row gap={6} align="flex-start"><Icon name="Sparkle" size={16} color={colors.green900} /><Text variant="titleSm" style={styles.flexText}>{role === 'student' ? 'Academic Ledger Assistant' : role === 'applicant' ? 'Admissions Assistant' : 'Instructor Records Assistant'}</Text></Row>
              <Text variant="bodySm" style={{ marginVertical: 4 }}>{role === 'applicant' ? 'Ask about your application status, missing documents and offers. Answers are built from your Campus One records.' : role === 'student' ? `Ask questions regarding degree progress, prerequisites, and graduation requirements.${isMockMode() ? ' Answers are built only from the local demo records on this device.' : ' Answers are built from your Campus One records.'}` : `Ask about grading status, workshop requests and scheduling across your sections.${isMockMode() ? ' Answers are built only from local demo records.' : ' Answers are built from your Campus One records.'}`}</Text>
              <Row gap={6} align="flex-start"><View style={styles.greenDot} /><Text variant="caption" style={styles.flexText}>{isMockMode() ? 'Demo records loaded locally · no SIS audit is performed' : 'Live records · read-only'}</Text></Row>
            </Card>
          }
          renderItem={({ item }) => <AnswerCard a={item} onAction={(route, params) => navigateTo(navigation, route, params)} onFeedback={v => feedback.mutate({ id: item.id, value: v })} onCopy={() => Share.share({ message: `${item.assessment}\n\n${item.facts.map(f => `${f.kind}: ${f.text}`).join('\n')}` })} context={item.context} />}
          ListFooterComponent={<Stack gap={spacing.sm}>
            {pendingQ ? <><View style={styles.userRow}><View style={styles.userBubble}><Text variant="body" color={colors.white}>{pendingQ}</Text></View></View><LoadingState label="Checking local records…" /></> : null}
            {failed ? <Row gap={8} style={styles.errorRow}><Icon name="TriangleAlert" size={16} color={colors.danger600} /><Text variant="bodySm" color={colors.danger600} style={{ flex: 1 }}>{failed}</Text><Button title="Retry" size="sm" variant="outline" fullWidth={false} onPress={() => { const last = items[items.length - 1]?.question ?? suggestions.data?.[0]; if (last) void send(last); }} testID="ask-retry" /></Row> : null}
            <Text variant="caption" align="center" style={{ marginTop: spacing.sm }}>Ask Campus One provides read-only informational guidance from {isMockMode() ? 'local demo records' : 'your Campus One records'}. It does not modify grades, transcripts, enrolment, registration holds, or fees.</Text>
          </Stack>}
        />
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <FlatList horizontal data={suggestions.data ?? []} keyExtractor={s => s} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }} renderItem={({ item, index }) => <Chip label={item} onPress={() => send(item)} testID={`ask-suggestion-${index}`} />} keyboardShouldPersistTaps="handled" />
          <Row align="flex-end">
            <Pressable accessibilityRole="button" accessibilityLabel="Attachments are not supported in read-only mode" onPress={() => toast('Attachments are disabled: Ask Campus One is read-only', 'info')} style={styles.plus}><Icon name="Plus" size={20} /></Pressable>
            <View style={styles.inputWrap}><Input placeholder="Message Ask Campus One..." value={text} onChangeText={setText} multiline maxLength={500} blurOnSubmit submitBehavior="submit" onSubmitEditing={() => send(text)} style={styles.input} testID="ask-input" /></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Send" onPress={() => send(text)} disabled={!text.trim() || ask.isPending} style={[styles.send, !text.trim() ? { opacity: 0.5 } : null]} testID="ask-send"><Icon name="ArrowRight" size={20} color={colors.white} /></Pressable>
          </Row>
          <DemoLabel text={`Scoped to ${user?.displayName} · deterministic demo answers`} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AnswerCard({ a, onAction, onFeedback, onCopy, context }: { a: AskHeritageAnswer; onAction: (route: string, params?: Record<string, string>) => void; onFeedback: (v: 'up' | 'down') => void; onCopy: () => void; context: string }) {
  return (
    <Stack gap={spacing.sm} style={{ marginBottom: spacing.md }}>
      <Text variant="caption" align="center">{formatDateTime(a.createdAt)}</Text>
      <View style={styles.userRow}><View style={styles.userBubble}><Text variant="body" color={colors.white}>{a.question}</Text></View><Text variant="caption">Delivered</Text></View>
      <Card testID={`ask-answer-${a.id}`}>
        <Row justify="space-between" wrap align="flex-start"><Row gap={6} wrap style={styles.answerIdentity}><View style={styles.hTile}><Text variant="label">C</Text></View><Text variant="titleSm">Ask Campus One</Text><Text variant="caption">Record check</Text></Row><Pill label={context} tone="green" small /></Row>
        <View style={styles.assessment}><Text variant="body"><Text variant="bodyStrong">Assessment: </Text>{a.assessment}</Text></View>
        <View style={styles.facts}>{a.facts.map((f, i) => <Row key={i} gap={8} align="flex-start"><Pill label={f.kind} tone={KIND_TONE[f.kind]} small /><Text variant="bodySm" style={styles.flexText} color={f.kind === 'CONFLICT' ? colors.danger600 : colors.inkSecondary}>{f.text}</Text></Row>)}</View>
        {a.requirements?.length ? (<>
          <Row justify="space-between" wrap style={{ marginTop: spacing.sm }}><Text variant="overline">Open requirements</Text><Pill label={`${a.requirements.length} Remaining`} tone="grey" small /></Row>
          {a.requirements.map(r => <Row key={r.code} justify="space-between" wrap align="flex-start" style={[styles.req, r.status === 'blocked' ? styles.reqBlocked : null]}><View style={styles.requirementCopy}><Text variant="bodyStrong">{r.code} · {r.title}</Text><Text variant="caption" color={r.status === 'blocked' ? colors.coral600 : undefined}>{r.meta}</Text></View><Pill label={r.status === 'inProgress' ? 'In progress' : r.status === 'blocked' ? `Blocked by ${r.blockedBy}` : r.status === 'missing' ? 'Missing' : 'Done'} tone={r.status === 'inProgress' ? 'green' : r.status === 'blocked' ? 'red' : r.status === 'missing' ? 'yellow' : 'grey'} small /></Row>)}
        </>) : null}
        <Text variant="overline" style={{ marginTop: spacing.sm }}>Suggested next steps</Text>
        {a.actions.map((act, i) => <Button key={act.label} title={act.label} variant={i === 0 ? 'primary' : 'outline'} size="sm" onPress={() => onAction(act.route, act.params)} testID={`ask-action-${i}`} />)}
        <Row gap={6} style={{ marginTop: spacing.sm }}><Icon name="FileText" size={14} color={colors.inkMuted} /><Text variant="overline">{isMockMode() ? 'Sources (local demo records)' : 'Sources'}</Text></Row>
        <Row wrap>{a.sources.map(s => <Pressable key={s.label} accessibilityRole="button" accessibilityLabel={`Source ${s.label}`} onPress={() => s.route && onAction(s.route, s.params)} style={styles.source}><Text variant="mono">{s.label}</Text></Pressable>)}</Row>
        <Row justify="space-between" wrap style={{ marginTop: spacing.sm }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Copy answer" onPress={onCopy} style={styles.iconBtn} testID="ask-copy"><Row gap={4}><Icon name="Copy" size={14} color={colors.inkMuted} /><Text variant="caption">Copy / share</Text></Row></Pressable>
          <Row wrap><Text variant="caption">{isMockMode() ? 'Demo ' : ''}{formatDateTime(a.createdAt).split(', ')[1]}</Text><Pressable accessibilityRole="button" accessibilityLabel="Helpful" onPress={() => onFeedback('up')} style={styles.iconBtn} testID="ask-up"><Icon name="ThumbsUp" size={16} color={a.feedback === 'up' ? colors.success600 : colors.inkMuted} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Not helpful" onPress={() => onFeedback('down')} style={styles.iconBtn} testID="ask-down"><Icon name="ThumbsDown" size={16} color={a.feedback === 'down' ? colors.danger600 : colors.inkMuted} /></Pressable></Row>
        </Row>
      </Card>
    </Stack>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  root: { flex: 1, backgroundColor: colors.cream },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  readOnly: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, backgroundColor: colors.success100, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginTop: 3 },
  back: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  tile: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.green900, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.md },
  greenDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success600, marginTop: 5 },
  flexText: { flex: 1, minWidth: 0 },
  userRow: { alignItems: 'flex-end', gap: 2 },
  userBubble: { backgroundColor: colors.green900, borderRadius: 18, borderBottomRightRadius: 4, padding: spacing.md, maxWidth: '85%' },
  answerIdentity: { flex: 1, minWidth: 180 },
  hTile: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  assessment: { borderLeftWidth: 4, borderLeftColor: colors.green900, backgroundColor: colors.surfaceMuted, padding: spacing.md, borderRadius: 8, marginVertical: spacing.sm },
  facts: { gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: spacing.sm },
  req: { padding: spacing.sm, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginTop: 6 },
  requirementCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 180, minWidth: 0 },
  reqBlocked: { backgroundColor: colors.danger100, borderColor: colors.danger100 },
  source: { backgroundColor: colors.surfaceMuted, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, minHeight: 32, justifyContent: 'center' },
  iconBtn: { minHeight: 36, minWidth: 36, alignItems: 'center', justifyContent: 'center' },
  errorRow: { backgroundColor: colors.danger100, padding: spacing.sm, borderRadius: 10 },
  composer: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md, gap: spacing.sm },
  inputWrap: { flex: 1, minWidth: 0 },
  input: { minHeight: 24, maxHeight: 88, paddingVertical: 6 },
  plus: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.green900, alignItems: 'center', justifyContent: 'center' },
});
