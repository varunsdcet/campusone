import React, { useState } from 'react';
import { Share, StyleSheet, Pressable } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, Icon, Accordion, DemoLabel, StatTile } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useProgramme, useBookmarks, useToggleBookmark, useEnrolments } from './useCatalogue';
import { formatMoney } from '../../../utils/format';
import { toast } from '../../../state/uiStore';
import { HeroImage } from './HeroImage';
import { ACTIVITY_LABEL } from '../learning/activityMeta';
import { useSnapshot } from '../learning/useLearning';

export function ProgrammeDetailsScreen({ navigation, route }: RootScreenProps<'StudentProgrammeDetails'>) {
  const { programmeId } = route.params;
  const programme = useProgramme(programmeId);
  const bookmarks = useBookmarks();
  const toggle = useToggleBookmark();
  const enrolments = useEnrolments();
  const enrolled = enrolments.data?.some(e => e.programmeId === programmeId);
  const [expandAll, setExpandAll] = useState(false);
  const bookmarked = bookmarks.data?.some(b => b.programmeId === programmeId);
  const p = programme.data;
  const share = async () => {
    if (!p) return;
    await Share.share({ message: `${p.title} — Campus One${isMockMode() ? ' (demo catalogue)' : ''}. ${p.hours} hrs · ${p.chapterCount} chapters · ${formatMoney(p.priceCad)}` });
  };
  return (
    <Screen padded={false} testID="programme-details" header={<ScreenHeader title="Course details" center actions={[
      { icon: 'Share2', accessibilityLabel: 'Share programme', onPress: share, testID: 'programme-share' },
      { icon: bookmarked ? 'BookmarkCheck' : 'Bookmark', accessibilityLabel: bookmarked ? 'Remove bookmark' : 'Bookmark programme', onPress: () => toggle.mutate(programmeId, { onSuccess: r => toast(r.bookmarked ? 'Bookmarked' : 'Bookmark removed', 'success') }), testID: 'programme-bookmark' },
    ]} />}>
      {programme.isLoading ? <LoadingState /> : programme.error || !p ? <ErrorState error={programme.error} onRetry={() => programme.refetch()} /> : (
        <Stack style={{ paddingHorizontal: spacing.lg }}>
          <HeroImage kind={p.heroImage} />
          <Row><Pill label={p.subject} tone="green" small /><Pill label={p.level} tone="outline" small /></Row>
          <Text variant="displayLg">{p.title}</Text>
          <Text variant="body">{p.description}</Text>
          <Row>
            <StatTile label="Hours" value={p.hours.toFixed(1)} />
            <StatTile label="Chapters" value={p.chapterCount} />
            <StatTile label="Activities" value={p.activityCount} />
          </Row>
          <Card>
            <Stack gap={spacing.sm}>
              <Row justify="space-between"><Text variant="overline">Tuition & enrollment</Text><Pill label={enrolled ? 'Enrolled' : 'Open Enrollment'} tone={enrolled ? 'green' : 'grey'} small /></Row>
              <Text variant="displayMd">{formatMoney(p.priceCad)}</Text>
              <Text variant="bodySm">{isMockMode() ? 'One-time demo payment' : p.priceCad > 0 ? 'One-time payment' : 'Free'} · 1 chapter unlocks daily</Text>
              {p.highlights.map(h => (
                <Row key={h} align="flex-start"><Icon name="CircleCheck" size={16} color={colors.success600} /><Text variant="bodySm" style={{ flex: 1 }}>{h}</Text></Row>
              ))}
              {enrolled ? (
                <Button title="Go to your learning →" variant="coral" onPress={() => navigation.navigate(Routes.StudentOutline, { programmeId })} testID="programme-go-learning" />
              ) : (
                <Button title="Start Learning Now →" variant="coral" onPress={() => navigation.navigate(Routes.StudentCheckout, { programmeId })} testID="programme-start" />
              )}
              {isMockMode() ? <Row gap={6} style={{ alignSelf: 'center' }}><Icon name="FlaskConical" size={14} color={colors.gold600} /><Text variant="caption" color={colors.gold600}>Demo checkout — no real payment processor</Text></Row> : p.priceCad > 0 ? <Row gap={6} style={{ alignSelf: 'center' }}><Icon name="ShieldCheck" size={14} color={colors.green700} /><Text variant="caption" color={colors.green700}>Secure card payment by Stripe</Text></Row> : null}
            </Stack>
          </Card>
          <Row justify="space-between">
            <Text variant="overline">Curriculum</Text>
            <Pressable onPress={() => setExpandAll(e => !e)} accessibilityRole="button" testID="programme-expand-all"><Text variant="label" color={colors.coral600}>{expandAll ? 'Collapse all' : 'Expand all'}</Text></Pressable>
          </Row>
          <Text variant="titleMd">Full course outline</Text>
          <Text variant="bodySm">{p.chapterCount} chapters · {p.activityCount} learning items · Reading → lecture → practice → matching → graded assessment</Text>
          <Text variant="caption" style={{ fontStyle: 'italic' }}>{isMockMode() ? 'Pass chapter assessment to unlock next (demo policy)' : 'Pass chapter assessment to unlock next'}</Text>
          <ChapterList programmeId={programmeId} chapters={p.chapters} expandAll={expandAll} enrolled={!!enrolled} />
          <DemoLabel text="Demo programme · synthetic content" />
        </Stack>
      )}
    </Screen>
  );
}

function ChapterList({ programmeId, chapters, expandAll, enrolled }: { programmeId: string; chapters: NonNullable<ReturnType<typeof useProgramme>['data']>['chapters']; expandAll: boolean; enrolled: boolean }) {
  const snap = useSnapshot(programmeId);
  const gates = enrolled ? snap.data?.gates : undefined;
  return (
    <Stack gap={spacing.sm}>
      {chapters.map((c, i) => {
        const locked = enrolled ? !gates?.[c.activities[0].id]?.chapterReleased : i > 0;
        return (
          <Accordion key={c.id} title={`Chapter ${c.index} · ${c.title}`} subtitle={`${c.hours.toFixed(1)} hrs · ${c.activities.length} items`} open={expandAll ? true : undefined} initiallyOpen={i === 0} testID={`chapter-${c.index}`} right={locked ? <Pill label="Locked" tone="grey" small icon={<Icon name="Lock" size={11} color={colors.inkSecondary} />} /> : undefined}>
            <Text variant="bodySm">{c.description}</Text>
            {c.activities.map(a => {
              const g = gates?.[a.id];
              return (
                <Row key={a.id} justify="space-between" style={styles.actRow}>
                  <Pill label={ACTIVITY_LABEL[a.type]} tone="grey" small />
                  <Text variant="bodySm" style={{ flex: 1 }} numberOfLines={1}>{a.title.split(' — ')[1] ?? a.title}</Text>
                  {g?.completed ? <Text variant="caption" color={colors.success600}>Done</Text> : g?.current ? <Text variant="caption" color={colors.coral600}>• Active</Text> : null}
                  <Text variant="caption">{a.minutes} min</Text>
                </Row>
              );
            })}
          </Accordion>
        );
      })}
    </Stack>
  );
}

const styles = StyleSheet.create({ actRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border } });
