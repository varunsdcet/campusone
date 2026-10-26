import React, { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, Icon, Accordion, ProgressBar, InfoBanner } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useProgramme, useBookmarks, useToggleBookmark } from '../catalogue/useCatalogue';
import { useSnapshot } from './useLearning';
import { ACTIVITY_LABEL, ACTIVITY_ROUTE } from './activityMeta';
import { formatDate } from '../../../utils/format';
import { toast } from '../../../state/uiStore';
import { BottomSheet, ListRow } from '../../../components';

export function OutlineScreen({ navigation, route }: RootScreenProps<'StudentOutline'>) {
  const { programmeId } = route.params;
  const programme = useProgramme(programmeId);
  const snap = useSnapshot(programmeId);
  const bookmarks = useBookmarks();
  const toggle = useToggleBookmark();
  const [expandAll, setExpandAll] = useState(false);
  const [menu, setMenu] = useState(false);
  const p = programme.data;
  const s = snap.data;
  const bookmarked = bookmarks.data?.some(b => b.programmeId === programmeId);
  const next = s?.nextActivityId ? p?.chapters.flatMap(c => c.activities).find(a => a.id === s.nextActivityId) : undefined;
  const openActivity = (a: NonNullable<typeof next>) => {
    const g = s?.gates[a.id];
    if (!g?.unlocked && !g?.completed) {
      toast(g?.reason ?? 'This activity is locked.', 'info');
      return;
    }
    navigation.navigate(ACTIVITY_ROUTE[a.type], { programmeId, activityId: a.id });
  };
  return (
    <Screen padded={false} testID="outline-screen" header={<ScreenHeader title={p?.title ?? 'Programme'} subtitle="Progression & Modules" actions={[
      { icon: bookmarked ? 'BookmarkCheck' : 'Bookmark', accessibilityLabel: 'Bookmark', onPress: () => toggle.mutate(programmeId), testID: 'outline-bookmark' },
      { icon: 'EllipsisVertical', accessibilityLabel: 'More options', onPress: () => setMenu(true), testID: 'outline-menu' },
    ]} />}>
      {programme.isLoading || snap.isLoading ? <LoadingState /> : !p || !s ? <ErrorState error={programme.error ?? snap.error} onRetry={() => { programme.refetch(); snap.refetch(); }} /> : (
        <Stack style={{ paddingHorizontal: spacing.lg }}>
          <Card tone="dark">
            <Stack gap={spacing.sm}>
              <Row><Pill label={p.subject} tone="coral" small /><Pill label="• Term 1 Active" tone="grey" small style={{ backgroundColor: colors.green700, borderColor: colors.green700 }} /></Row>
              <Text variant="displaySm" color={colors.white}>{p.title}</Text>
              <Text variant="caption" color={colors.green100}>Chapter path: Reading → Reading → Lecture → Practice quiz → Matching → Chapter assessment. Next chapter unlocks when passed.</Text>
              <View style={styles.inner}>
                <Row justify="space-between"><Text variant="caption" color={colors.green100}>{s.completedCount}/{s.totalCount} activities completed</Text><Text variant="label" color={colors.gold500}>{s.percent}% Completed</Text></Row>
                <ProgressBar value={s.percent} color={colors.gold500} track={colors.green900} />
                <Row justify="space-between"><Text variant="caption" color={colors.green100}>{s.chapterUnlockedCount} of {p.chapterCount} chapters unlocked</Text><Text variant="caption" color={colors.green100}>• {s.completedAll ? 'Complete' : 'On Track'}</Text></Row>
              </View>
              {s.completedAll ? (
                <Button title="View course completion →" variant="coral" onPress={() => navigation.navigate(Routes.StudentCourseComplete, { programmeId })} testID="outline-complete" />
              ) : next ? (
                <Pressable testID="outline-continue" accessibilityRole="button" accessibilityLabel={`Continue learning: ${next.title}`} onPress={() => openActivity(next)} style={styles.cta}>
                  <View style={styles.play}><Icon name="Play" size={16} color={colors.white} /></View>
                  <View style={{ flex: 1 }}>
                    <Text variant="overline" color={colors.white}>{s.progress.completedActivityIds.length ? 'Continue learning' : 'Start learning'}</Text>
                    <Text variant="label" color={colors.white} numberOfLines={1}>{ACTIVITY_LABEL[next.type]} · {next.title.split(' — ')[1] ?? next.title}</Text>
                  </View>
                  <Icon name="ChevronRight" color={colors.white} />
                </Pressable>
              ) : (
                <InfoBanner tone="gold" icon="Clock" title="Next chapter not open yet" text={`Chapter ${s.chapterUnlockedCount + 1} opens ${formatDate(Object.values(s.gates).find(g => g.releasesAt)?.releasesAt ?? '')}. Use the developer clock to test faster.`} />
              )}
            </Stack>
          </Card>
          <Row justify="space-between">
            <Text variant="overline">Curriculum</Text>
            <Pressable onPress={() => setExpandAll(e => !e)} accessibilityRole="button" testID="outline-expand-all"><Text variant="label" color={colors.coral600}>{expandAll ? 'Collapse all' : 'Expand all'}</Text></Pressable>
          </Row>
          <Text variant="titleMd">Full course outline</Text>
          <Text variant="bodySm">{p.chapterCount} chapters · {p.activityCount} learning items · Reading → lecture → practice → matching → graded assessment</Text>
          <InfoBanner tone="gold" icon="Sunrise" text={`One focused chapter a day: Pass the chapter assessment to open the next module. ${s.chapterUnlockedCount} of ${p.chapterCount} open${isMockMode() ? ' (demo policy)' : ''}.`} />
          {p.chapters.map((c, ci) => {
            const first = c.activities[0];
            const released = s.gates[first.id]?.chapterReleased;
            const releasesAt = s.gates[first.id]?.releasesAt;
            const done = c.activities.every(a => s.gates[a.id]?.completed);
            const isCurrent = c.activities.some(a => s.gates[a.id]?.current);
            return (
              <Accordion key={c.id} title={`Chapter ${c.index} · ${c.title}`} subtitle={released ? `${c.hours.toFixed(1)} hrs · ${c.activities.length} items` : `${c.activities.length} learning items${releasesAt ? ` · Opens ${formatDate(releasesAt)}` : ''}`} open={expandAll ? true : undefined} initiallyOpen={isCurrent || ci === 0} testID={`outline-chapter-${c.index}`} right={!released ? <Pill label="Locked" tone="grey" small icon={<Icon name="Lock" size={11} color={colors.inkSecondary} />} /> : done ? <Pill label="Done" tone="green" small /> : undefined}>
                <Text variant="bodySm">{c.description}</Text>
                {c.activities.map(a => {
                  const g = s.gates[a.id];
                  const state = g?.completed ? 'done' : g?.current ? 'current' : g?.unlocked ? 'open' : 'locked';
                  return (
                    <Pressable key={a.id} testID={`outline-activity-${a.id}`} accessibilityRole="button" accessibilityLabel={`${ACTIVITY_LABEL[a.type]} ${a.title}, ${state}`} onPress={() => openActivity(a)} style={[styles.actRow, state === 'current' ? styles.actCurrent : null]}>
                      <Pill label={ACTIVITY_LABEL[a.type]} tone="grey" small />
                      <Text variant="bodySm" style={{ flex: 1 }} numberOfLines={1}>{a.title.split(' — ')[1] ?? a.title}</Text>
                      <Text variant="caption">{a.minutes} min</Text>
                      {state === 'done' ? <Pill label="Done" tone="green" small icon={<Icon name="Check" size={11} color={colors.success600} />} /> : state === 'current' ? <Pill label="Current" tone="dark" small dot /> : state === 'locked' ? <Row gap={2}><Icon name="Lock" size={12} color={colors.inkMuted} /><Text variant="caption">Locked</Text></Row> : <Icon name="ChevronRight" size={14} color={colors.inkMuted} />}
                    </Pressable>
                  );
                })}
              </Accordion>
            );
          })}
        </Stack>
      )}
      <BottomSheet visible={menu} onClose={() => setMenu(false)} title="Programme options">
        <ListRow icon="Share2" title="Share programme" onPress={() => { setMenu(false); void Share.share({ message: `${p?.title} — ${isMockMode() ? 'Heritage demo programme' : 'Campus One'}` }); }} />
        <ListRow icon="ScrollText" title="Certificate" onPress={() => { setMenu(false); navigation.navigate(Routes.StudentCertificate, { programmeId }); }} />
        <ListRow icon="Info" title="Programme details" onPress={() => { setMenu(false); navigation.navigate(Routes.StudentProgrammeDetails, { programmeId }); }} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  inner: { backgroundColor: colors.green800, borderRadius: 12, padding: spacing.md, gap: 8 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.coral500, borderRadius: 14, padding: spacing.md, minHeight: 56 },
  play: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  actRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 10, minHeight: 44 },
  actCurrent: { borderWidth: 1.5, borderColor: colors.green900, backgroundColor: colors.green50 },
});
