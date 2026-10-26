import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, Card, Row, Stack, Icon } from '../../../components';
import { colors, spacing } from '../../../theme';
import type { RootScreenProps } from '../../../navigation/types';
import { ActivityShell } from './ActivityShell';
import { useLearningMutations, useSnapshot } from './useLearning';

export function ReadingScreen({ route }: RootScreenProps<'StudentReading'>) {
  const { programmeId, activityId } = route.params;
  const m = useLearningMutations(programmeId);
  const snap = useSnapshot(programmeId);
  const [reachedBottom, setReachedBottom] = useState(false);
  const readToBottom = reachedBottom || !!snap.data?.progress.readToBottom[activityId];
  const onScrollEnd = () => {
    if (!readToBottom) {
      setReachedBottom(true);
      m.markReadToBottom.mutate(activityId);
    }
  };
  return (
    <ActivityShell programmeId={programmeId} activityId={activityId} testID="reading-screen" onScrollEnd={onScrollEnd} readyToComplete={() => (readToBottom ? { ok: true } : { ok: false, reason: 'Read to the bottom to satisfy completion requirements.' })}>
      {({ activity }) => {
        const r = activity.reading!;
        return (
          <Card>
            <Stack gap={spacing.md}>
              <Text variant="body">{r.intro}</Text>
              <Section title="Learning objectives" color={colors.coral500}>
                {r.objectives.map(o => <Row key={o} align="flex-start" gap={6}><Text variant="body">•</Text><Text variant="body" style={{ flex: 1 }}>{o}</Text></Row>)}
              </Section>
              <Section title="Why this matters" color={colors.green700}><Text variant="body">{r.whyItMatters}</Text></Section>
              <Section title="Core concepts" color={colors.green700}>
                <Text variant="body">{r.coreConcepts}</Text>
                {r.steps.map((s, i) => (
                  <View key={s.title} style={styles.step}>
                    <View style={styles.num}><Text variant="label" color={colors.white}>{i + 1}</Text></View>
                    <View style={{ flex: 1 }}><Text variant="bodyStrong">{s.title}</Text><Text variant="bodySm">{s.body}</Text></View>
                  </View>
                ))}
              </Section>
              <View style={styles.example}>
                <Row gap={6}><Icon name="BookOpen" size={16} color={colors.green900} /><Text variant="label" color={colors.green900}>Worked example</Text></Row>
                <Text variant="body" style={{ fontStyle: 'italic' }}>{r.workedExample}</Text>
              </View>
              <Row justify="space-between" style={styles.footer}>
                <Text variant="caption">Read to the bottom to satisfy completion requirements</Text>
                <Text variant="label" color={readToBottom ? colors.success600 : colors.inkMuted}>{readToBottom ? '100% read' : 'Keep reading'}</Text>
              </Row>
            </Stack>
          </Card>
        );
      }}
    </ActivityShell>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Row gap={8}><View style={[styles.bar, { backgroundColor: color }]} /><Text variant="titleSm">{title}</Text></Row>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { width: 4, height: 18, borderRadius: 2 },
  step: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.surfaceMuted, padding: spacing.md, borderRadius: 12, alignItems: 'flex-start' },
  num: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.green900, alignItems: 'center', justifyContent: 'center' },
  example: { borderLeftWidth: 4, borderLeftColor: colors.green700, backgroundColor: colors.green50, padding: spacing.md, borderRadius: 10, gap: 6 },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
});
