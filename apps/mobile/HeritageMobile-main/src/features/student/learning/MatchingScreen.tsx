import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, Card, Row, Stack, Icon, Button, Pill, ProgressBar, InfoBanner, BottomSheet, RadioRow } from '../../../components';
import { colors, spacing } from '../../../theme';
import type { RootScreenProps } from '../../../navigation/types';
import { ActivityShell } from './ActivityShell';
import { useLearningMutations, useSnapshot } from './useLearning';
import { Routes } from '../../../navigation/routes';
import { useAppNavigation } from '../../../navigation/hooks';
import { progressionPolicy } from '../../../config/progressionPolicy';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';

export function MatchingScreen({ route }: RootScreenProps<'StudentMatching'>) {
  const { programmeId, activityId } = route.params;
  const navigation = useAppNavigation();
  const m = useLearningMutations(programmeId);
  const snap = useSnapshot(programmeId);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; passed: boolean; correct: number; total: number; wrongPairIds: string[] } | null>(null);
  const assignments = snap.data?.progress.matchingAssignments[activityId] ?? {};
  const saved = snap.data?.progress.matchingResult[activityId];

  return (
    <ActivityShell programmeId={programmeId} activityId={activityId} testID="matching-screen" readyToComplete={() => (saved?.passed ? { ok: true } : { ok: false, reason: `Pass the drill (${progressionPolicy.passMark.matching}%) to complete it.` })} footerExtra={({ activity }) => {
      const pairs = activity.matching?.pairs ?? [];
      const matched = pairs.filter(p => assignments[p.id]).length;
      if (saved?.passed) return null;
      return (
        <Button title={result ? 'Verify again' : 'Verify & submit drill'} variant="coral" disabled={matched < pairs.length} disabledReason={`Complete all ${pairs.length} matches to verify and submit drill`} loading={m.submitMatching.isPending} testID="matching-submit" onPress={async () => {
          try {
            const r = await m.submitMatching.mutateAsync(activityId);
            setResult(r);
            toast(r.passed ? `Passed · ${r.score}%` : `Not passed · ${r.score}%`, r.passed ? 'success' : 'error');
          } catch (e) {
            toast(errorMessage(e), 'error');
          }
        }} />
      );
    }}>
      {({ activity }) => {
        const pairs = activity.matching?.pairs ?? [];
        // Shuffle definitions deterministically so the order differs from the terms.
        const defs = [...pairs].sort((a, b) => a.definition.length - b.definition.length);
        const matched = pairs.filter(p => assignments[p.id]).length;
        const current = selecting ? pairs.find(p => p.id === selecting) : null;
        return (
          <Stack>
            <InfoBanner tone="gold" icon="Shuffle" text={`Match each term on the left with the correct definition. Pass mark ${progressionPolicy.passMark.matching}%. Selecting a match is not proof it is correct — verify to check.`} />
            <Card>
              <Row justify="space-between"><Text variant="titleSm">Drill Progress</Text><Text variant="label">{matched} of {pairs.length} matched</Text></Row>
              <ProgressBar value={(matched / pairs.length) * 100} color={colors.green700} />
              <Row gap={6} style={{ marginTop: spacing.sm }}><Icon name="Info" size={14} color={colors.inkMuted} /><Text variant="caption">Tap any card to select or update its matching definition.</Text></Row>
            </Card>
            {saved ? <InfoBanner tone={saved.passed ? 'green' : 'coral'} icon={saved.passed ? 'CircleCheck' : 'CircleX'} title={saved.passed ? `Drill passed · ${saved.score}%` : `Last attempt ${saved.score}% · not passed`} text={saved.passed ? 'You can continue to the next activity.' : 'Review the highlighted terms and reassign their definitions.'} /> : null}
            {pairs.map(p => {
              const defId = assignments[p.id];
              const def = pairs.find(x => x.id === defId)?.definition;
              const wrong = result?.wrongPairIds.includes(p.id);
              const isSel = selecting === p.id;
              return (
                <Pressable key={p.id} testID={`match-term-${p.id}`} accessibilityRole="button" accessibilityLabel={`${p.term}: ${def ?? 'choose definition'}`} onPress={() => { setSelecting(p.id); setDraft(defId ?? null); }} style={[styles.term, wrong ? styles.termWrong : def ? styles.termDone : null]}>
                  <Row justify="space-between">
                    <Text variant="titleSm">{p.term}</Text>
                    <Pill label={isSel ? 'Selecting…' : wrong ? 'Incorrect' : def ? 'Matched' : 'Needs match'} tone={isSel ? 'grey' : wrong ? 'red' : def ? 'green' : 'yellow'} small icon={def && !wrong ? <Icon name="Check" size={11} color={colors.success600} /> : undefined} />
                  </Row>
                  <View style={styles.defBox}>
                    <Text variant="bodySm" color={def ? colors.ink : colors.inkFaint} style={def ? null : { fontStyle: 'italic' }} numberOfLines={2}>{def ?? 'Choose definition...'}</Text>
                    <Icon name="ChevronDown" size={16} color={colors.inkMuted} />
                  </View>
                </Pressable>
              );
            })}
            <Pressable accessibilityRole="button" accessibilityLabel="Ask coach" onPress={() => navigation.navigate(Routes.StudentAskCoach, { programmeId, activityId })} style={styles.fab} testID="matching-ask-coach"><Icon name="Sparkles" size={16} color={colors.white} /><Text variant="label" color={colors.white}>Ask coach</Text></Pressable>
            <BottomSheet visible={!!selecting} onClose={() => setSelecting(null)} overline="Assign definition" title={current?.term} testID="matching-sheet">
              {defs.map(d => {
                const takenBy = Object.entries(assignments).find(([k, v]) => v === d.id && k !== selecting)?.[0];
                const takenTerm = takenBy ? pairs.find(x => x.id === takenBy)?.term : undefined;
                return <RadioRow key={d.id} testID={`match-def-${d.id}`} selected={draft === d.id} onPress={() => setDraft(d.id)} label={d.definition} disabled={!!takenTerm} disabledReason={takenTerm ? `Already assigned to ${takenTerm}` : undefined} />;
              })}
              <Button title="Confirm Match" disabled={!draft} disabledReason="Select a definition" testID="matching-confirm" onPress={() => { if (selecting && draft) { m.saveMatching.mutate({ activityId, pairId: selecting, definitionPairId: draft }); setResult(null); } setSelecting(null); }} />
              {assignments[selecting ?? ''] ? <Button title="Clear match" variant="ghost" onPress={() => { if (selecting) m.saveMatching.mutate({ activityId, pairId: selecting, definitionPairId: null }); setSelecting(null); setResult(null); }} /> : null}
            </BottomSheet>
          </Stack>
        );
      }}
    </ActivityShell>
  );
}

const styles = StyleSheet.create({
  term: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  termDone: { borderColor: colors.success600 },
  termWrong: { borderColor: colors.danger600, backgroundColor: colors.danger100 },
  defBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: spacing.sm, backgroundColor: colors.surfaceSubtle, minHeight: 44 },
  fab: { alignSelf: 'flex-end', flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: colors.green900, paddingHorizontal: 16, minHeight: 44, borderRadius: 999 },
});
