import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, EmptyState, Icon, ChipRow, BottomSheet, KeyValueRow, DemoLabel } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import type { RootScreenProps } from '../../../navigation/types';
import { useExtracurricular } from './useRecords';
import { useFileActions } from '../../shared/useFileActions';
import type { ExtracurricularRecord } from '../../../domain/types';

const CAT_ICON: Record<ExtracurricularRecord['category'], { icon: 'Star' | 'HandHeart' | 'Volleyball'; bg: string; fg: string }> = {
  'Student leadership': { icon: 'Star', bg: colors.green100, fg: colors.green900 },
  Volunteer: { icon: 'HandHeart', bg: colors.coral100, fg: colors.coral600 },
  Athletics: { icon: 'Volleyball', bg: colors.green100, fg: colors.green900 },
};

export function ExtracurricularScreen(_props: RootScreenProps<'StudentExtracurricular'>) {
  const q = useExtracurricular();
  const files = useFileActions();
  const [cat, setCat] = useState<string>('all');
  const [detail, setDetail] = useState<ExtracurricularRecord | null>(null);
  const data = q.data ?? [];
  const cats = Array.from(new Set(data.map(r => r.category)));
  const list = data.filter(r => cat === 'all' || r.category === cat);
  return (
    <Screen testID="extracurricular-screen" header={<ScreenHeader />}>
      {q.isLoading ? <LoadingState /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <Stack>
          <Text variant="displayLg">Extracurricular Records</Text>
          <Text variant="body">View your leadership, volunteer, athletics, and other campus activities.</Text>
          <Card><Row>{[['Total records', data.length], ['Recorded', data.filter(r => r.status === 'Recorded').length]].map(([l, v], i) => <View key={String(l)} style={styles.stat}><Text variant="displayMd" color={i ? colors.gold600 : colors.green900}>{v}{i ? ' ✓' : ''}</Text><Text variant="overline">{l}</Text></View>)}</Row></Card>
          <ChipRow options={[{ value: 'all', label: 'All Activities', count: data.length }, ...cats.map(c => ({ value: c, label: c, count: data.filter(r => r.category === c).length, icon: CAT_ICON[c].icon }))]} value={cat} onChange={setCat} testID="extra-filter" />
          {!list.length ? <EmptyState icon="Trophy" title="No records in this category" /> : list.map(r => (
            <Card key={r.id} onPress={() => setDetail(r)} testID={`extra-${r.id}`}>
              <Row gap={spacing.md}>
                <View style={[styles.circle, { backgroundColor: CAT_ICON[r.category].bg }]}><Icon name={CAT_ICON[r.category].icon} size={20} color={CAT_ICON[r.category].fg} /></View>
                <View style={{ flex: 1 }}><Text variant="titleSm">{r.title}</Text><Text variant="bodySm">{r.description}</Text></View>
                <Icon name="ChevronRight" size={18} color={colors.inkMuted} />
              </Row>
              <Row style={{ marginTop: spacing.sm }} wrap><Pill label={r.category} tone="grey" small /><Pill label={`Term: ${r.term}`} tone="grey" small /><Pill label="Recorded" tone="green" small icon={<Icon name="Check" size={11} color={colors.success600} />} /></Row>
            </Card>
          ))}
          {isMockMode() ? <Card tone="muted">
            <Text variant="overline" style={{ marginBottom: 4 }}>Co-curricular record (sample)</Text>
            <Text variant="caption">This demo generates a sample CCR PDF from local records. It is not verified or certified by Student Affairs.</Text>
            <Button title="Download sample CCR (PDF)" icon={<Icon name="Download" size={16} color={colors.white} />} style={{ marginTop: spacing.sm }} loading={files.busy === 'download:ccr'} onPress={() => files.download('ccr', 'co-curricular-record-SAMPLE.pdf')} testID="extra-download" />
          </Card> : null}
          <DemoLabel text="Synthetic records" />
        </Stack>
      )}
      <BottomSheet visible={!!detail} onClose={() => setDetail(null)} title={detail?.title} subtitle={detail?.category} testID="extra-detail">
        {detail ? (<>
          <Text variant="body" style={{ marginBottom: spacing.sm }}>{detail.details}</Text>
          <KeyValueRow label="Term" value={detail.term} />
          <KeyValueRow label="Status" value={detail.status} border={false} />
        </>) : null}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({ stat: { flex: 1, alignItems: 'center' }, circle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' } });
