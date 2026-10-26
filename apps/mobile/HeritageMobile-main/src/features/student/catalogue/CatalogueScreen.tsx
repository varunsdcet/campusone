import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, Input, Select, ChipRow, LoadingState, ErrorState, EmptyState, Icon } from '../../../components';
import { colors, spacing } from '../../../theme';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useProgrammes } from './useCatalogue';
import { useDebounced } from '../../shared/hooks';
import type { Programme } from '../../../domain/types';
import { formatMoney } from '../../../utils/format';

const SUBJECTS = ['All subjects', 'Business', 'Health', 'Red Seal Trades'];
const LEVELS = ['All levels', 'Beginner', 'Intermediate', 'Advanced'];
const CATEGORIES = ['All Programs', 'Red Seal Trades', 'Business', 'Pharmacy Assistant', 'Trades & Technical'];

export function CatalogueScreen({ navigation }: RootScreenProps<'StudentCatalogue'>) {
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [level, setLevel] = useState(LEVELS[0]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const q = useDebounced(query);
  const programmes = useProgrammes({ query: q, subject, level, category });
  const featured = useMemo(() => programmes.data?.filter(p => p.featured) ?? [], [programmes.data]);
  const regular = useMemo(() => programmes.data?.filter(p => !p.featured) ?? [], [programmes.data]);
  const open = (p: Programme) => navigation.navigate(Routes.StudentProgrammeDetails, { programmeId: p.id });

  const header = (
    <Stack gap={spacing.sm} style={{ marginBottom: spacing.md }}>
      <Text variant="overline" color={colors.coral600}>Catalog · Vocational & Trades</Text>
      <Text variant="displayLg">Current Programs</Text>
      <Input testID="catalogue-search" placeholder="Search by title, description, or subject..." leftIcon="Search" value={query} onChangeText={setQuery} returnKeyType="search" autoCorrect={false} />
      <Row>
        <View style={{ flex: 1 }}><Select compact value={subject} onChange={setSubject} options={SUBJECTS.map(v => ({ value: v, label: v }))} testID="catalogue-subject" sheetTitle="Subject" /></View>
        <View style={{ flex: 1 }}><Select compact value={level} onChange={setLevel} options={LEVELS.map(v => ({ value: v, label: v }))} testID="catalogue-level" sheetTitle="Level" /></View>
      </Row>
      <ChipRow options={CATEGORIES.map(c => ({ value: c, label: c }))} value={category} onChange={setCategory} testID="catalogue-cat" />
      {featured.map(p => <FeaturedCard key={p.id} p={p} onPress={() => open(p)} />)}
      <Row justify="space-between" style={{ marginTop: spacing.sm }}>
        <Text variant="overline">Available courses</Text>
        <Pill label={`${programmes.data?.length ?? 0} Programs`} tone="grey" small />
      </Row>
    </Stack>
  );

  return (
    <Screen scroll={false} padded={false} header={<ScreenHeader title="Current Programs" />} testID="catalogue-screen">
      {programmes.isLoading ? <LoadingState /> : programmes.error ? <ErrorState error={programmes.error} onRetry={() => programmes.refetch()} /> : (
        <FlatList
          data={regular}
          keyExtractor={p => p.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
          ListEmptyComponent={<EmptyState icon="SearchX" title="No programs match" message="Try a different search or clear the filters." action={{ label: 'Clear filters', onPress: () => { setQuery(''); setSubject(SUBJECTS[0]); setLevel(LEVELS[0]); setCategory(CATEGORIES[0]); } }} />}
          renderItem={({ item }) => <ProgrammeCard p={item} onPress={() => open(item)} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          keyboardShouldPersistTaps="handled"
          testID="catalogue-list"
        />
      )}
    </Screen>
  );
}

function FeaturedCard({ p, onPress }: { p: Programme; onPress: () => void }) {
  return (
    <Card tone="dark" onPress={onPress} testID={`programme-${p.id}`}>
      <Stack gap={spacing.sm}>
        <Row justify="space-between">
          <Row><Pill label={p.level} tone="green" small /><Pill label="Featured" tone="gold" small /></Row>
          <Text variant="overline" color={colors.green100}>{p.subject}</Text>
        </Row>
        <Text variant="displaySm" color={colors.white}>{p.title}</Text>
        <Text variant="bodySm" color={colors.green100} numberOfLines={2}>{p.description}</Text>
        <Text variant="bodySm" color={colors.white}>{p.hours.toFixed(1)} hrs • {p.chapterCount} chapters</Text>
        <Text variant="titleSm" color={colors.white}>{formatMoney(p.priceCad)} • {p.residency}</Text>
        <Button title="View curriculum →" variant="coral" onPress={onPress} />
      </Stack>
    </Card>
  );
}

function ProgrammeCard({ p, onPress }: { p: Programme; onPress: () => void }) {
  return (
    <Card onPress={onPress} testID={`programme-${p.id}`}>
      <Stack gap={spacing.sm}>
        <Row justify="space-between">
          <Pill label={p.level} tone={p.level === 'Advanced' ? 'dark' : 'outline'} small />
          <Pill label={p.category} tone="grey" small />
        </Row>
        <Text variant="titleMd">{p.title}</Text>
        <Text variant="bodySm" numberOfLines={3}>{p.description}</Text>
        {p.subPrograms ? (
          <Row>
            {p.subPrograms.map(sp => (
              <View key={sp.title} style={styles.sub}>
                <Text variant="label">{sp.title}</Text>
                <Text variant="caption">{sp.hours.toFixed(1)} hrs • {sp.chapters} chap.</Text>
                <Text variant="caption">{formatMoney(sp.priceCad)}</Text>
              </View>
            ))}
          </Row>
        ) : null}
        <View style={styles.divider} />
        <Row justify="space-between">
          <Text variant="bodySm">{p.hours.toFixed(1)} hrs • {p.chapterCount} chapters</Text>
          <Text variant="label">{formatMoney(p.priceCad)} / {p.residency}</Text>
        </Row>
        <Row gap={4}><Text variant="label" color={colors.coral600}>{p.subPrograms ? 'View trades catalog' : 'View curriculum'} →</Text><Icon name="ArrowRight" size={14} color={colors.coral600} /></Row>
      </Stack>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.huge },
  sub: { flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: spacing.sm, gap: 2 },
  divider: { height: 1, backgroundColor: colors.border },
});
