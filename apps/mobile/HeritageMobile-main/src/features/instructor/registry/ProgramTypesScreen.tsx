import React, { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View, Pressable } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, Input, Select, LoadingState, ErrorState, EmptyState, Icon, BottomSheet, ConfirmSheet, DemoLabel, InfoBanner } from '../../../components';
import { colors, spacing } from '../../../theme';
import type { RootScreenProps } from '../../../navigation/types';
import { useProgramTypes, useRegistry } from '../useInstructor';
import { useDebounced } from '../../shared/hooks';
import type { ProgramType } from '../../../domain/types';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';

const ROW_H = 118;

export function ProgramTypesScreen(_props: RootScreenProps<'InstructorProgramTypes'>) {
  const [query, setQuery] = useState('');
  const q = useDebounced(query);
  const types = useProgramTypes(q);
  const r = useRegistry();
  const [order, setOrder] = useState<ProgramType[]>([]);
  const [editing, setEditing] = useState<Partial<ProgramType> | null>(null);
  const [deleting, setDeleting] = useState<ProgramType | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const dragging = useRef<{ from: number; to: number } | null>(null);
  useEffect(() => { if (types.data) setOrder(types.data); }, [types.data]);
  const canReorder = !q;
  const commit = async (from: number, to: number) => {
    if (from === to) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setOrder(next);
    try { await r.reorderProgramTypes.mutateAsync(next.map(t => t.id)); toast('Order saved', 'success'); } catch (e) { toast(errorMessage(e), 'error'); }
  };
  const makeResponder = (index: number) => PanResponder.create({
    onStartShouldSetPanResponder: () => canReorder,
    onMoveShouldSetPanResponder: () => canReorder,
    onPanResponderGrant: () => { setDragIndex(index); dragging.current = { from: index, to: index }; dragY.setValue(0); },
    onPanResponderMove: (_, g) => { dragY.setValue(g.dy); const to = Math.max(0, Math.min(order.length - 1, index + Math.round(g.dy / ROW_H))); if (dragging.current) dragging.current.to = to; },
    onPanResponderRelease: () => { const d = dragging.current; setDragIndex(null); dragY.setValue(0); if (d) void commit(d.from, d.to); dragging.current = null; },
    onPanResponderTerminate: () => { setDragIndex(null); dragY.setValue(0); dragging.current = null; },
  });
  const save = async () => {
    if (!editing) return;
    try { await r.saveProgramType.mutateAsync({ id: editing.id, name: editing.name ?? '', abbreviation: editing.abbreviation ?? '', status: editing.status ?? 'active' }); toast('Program type saved', 'success'); setEditing(null); } catch (e) { toast(errorMessage(e), 'error'); }
  };
  const del = async () => {
    if (!deleting) return;
    try { const res = await r.deleteProgramType.mutateAsync(deleting.id); if (res.blockedBy) setBlocked(res.blockedBy); else toast('Program type deleted', 'success'); } catch (e) { toast(errorMessage(e), 'error'); }
    setDeleting(null);
  };
  return (
    <Screen testID="program-types" header={<ScreenHeader backLabel="Back" actions={[{ label: 'Create Program Type', icon: 'Plus', accessibilityLabel: 'Create program type', variant: 'primary', onPress: () => setEditing({ status: 'active' }), testID: 'pt-create' }]} />}>
      <Stack>
        <Text variant="displayLg">Program Types</Text>
        <Text variant="body">Configure and prioritize academic credential tiers and study categories.</Text>
        <Card padding={spacing.md}>
          <Row justify="space-between"><Text variant="overline">Filter</Text><Pill label="All Types" tone="grey" small /></Row>
          <Input placeholder="Enter Search Filter Here" leftIcon="Search" value={query} onChangeText={setQuery} containerStyle={{ marginTop: spacing.sm }} testID="pt-search" />
        </Card>
        <Row justify="space-between"><Text variant="bodySm">{order.length} Program Types</Text><Row gap={4}><Icon name="GripVertical" size={14} color={colors.inkMuted} /><Text variant="caption">{canReorder ? 'Hold & Drag to sort' : 'Clear search to sort'}</Text></Row></Row>
        {types.isLoading ? <LoadingState /> : types.error ? <ErrorState error={types.error} onRetry={() => types.refetch()} /> : !order.length ? <EmptyState icon="Layers" title="No program types match" /> : (
          <View>
            {order.map((t, i) => {
              const isDrag = dragIndex === i;
              const responder = makeResponder(i);
              return (
                <Animated.View key={t.id} style={[styles.rowWrap, isDrag ? { transform: [{ translateY: dragY }], zIndex: 10, elevation: 10 } : null]} testID={`pt-${t.id}`}>
                  <Card padding={spacing.md} style={isDrag ? styles.dragging : undefined}>
                    <Row justify="space-between">
                      <View style={{ flex: 1 }}><Text variant="titleMd">{t.name}</Text><Row gap={6}><Text variant="bodySm">Abbr:</Text><View style={styles.mono}><Text variant="mono">{t.abbreviation}</Text></View></Row></View>
                      <Pill label={t.status === 'active' ? 'Active' : 'Inactive'} tone={t.status === 'active' ? 'green' : 'grey'} small dot />
                      <View {...responder.panHandlers} style={styles.handle} accessibilityLabel={`Drag handle for ${t.name}`} accessibilityRole="adjustable" accessibilityActions={[{ name: 'increment', label: 'Move down' }, { name: 'decrement', label: 'Move up' }]} onAccessibilityAction={e => commit(i, e.nativeEvent.actionName === 'increment' ? Math.min(order.length - 1, i + 1) : Math.max(0, i - 1))} testID={`pt-handle-${t.id}`}><Icon name="GripVertical" size={20} color={colors.inkMuted} /></View>
                    </Row>
                    <View style={styles.divider} />
                    <Row justify="flex-end" gap={spacing.lg}>
                      <Pressable accessibilityRole="button" onPress={() => setEditing(t)} style={styles.action} testID={`pt-edit-${t.id}`}><Text variant="label" color={colors.info600}>EDIT</Text></Pressable>
                      <View style={styles.vdiv} />
                      <Pressable accessibilityRole="button" onPress={() => setDeleting(t)} style={styles.action} testID={`pt-delete-${t.id}`}><Text variant="label" color={colors.danger600}>DELETE</Text></Pressable>
                    </Row>
                  </Card>
                </Animated.View>
              );
            })}
          </View>
        )}
        <DemoLabel text="Order persists in the demo repository" />
      </Stack>
      <BottomSheet visible={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Program Type' : 'Create Program Type'} subtitle="Campus One Registry" testID="pt-sheet">
        <Input label="Program type name" required placeholder="Enter program type name" value={editing?.name ?? ''} onChangeText={t => setEditing(e => ({ ...e, name: t }))} testID="pt-name" />
        <Input label="Abbreviation" required placeholder="ENTER ABBREVIATION (E.G., C, D, B)" autoCapitalize="characters" value={editing?.abbreviation ?? ''} onChangeText={t => setEditing(e => ({ ...e, abbreviation: t }))} testID="pt-abbr" />
        <Select label="Active / Inactive status" value={editing?.status ?? 'active'} onChange={v => setEditing(e => ({ ...e, status: v as ProgramType['status'] }))} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} testID="pt-status" />
        <Button title="Save Program Type" onPress={save} loading={r.saveProgramType.isPending} disabled={!editing?.name?.trim() || !editing?.abbreviation?.trim()} disabledReason="Name and abbreviation are required" testID="pt-save" />
        <Button title="Cancel" variant="ghost" onPress={() => setEditing(null)} />
      </BottomSheet>
      <ConfirmSheet visible={!!deleting} onClose={() => setDeleting(null)} onConfirm={del} destructive loading={r.deleteProgramType.isPending} title="Delete Program Type?" message={<Text variant="body" align="center">Are you sure you want to delete <Text variant="bodyStrong">{deleting?.name}</Text>? This may affect associated programs and student records. Deletion is blocked while programs reference it.</Text>} confirmLabel="Delete Program Type" testID="pt-delete-sheet" />
      <ConfirmSheet visible={!!blocked} onClose={() => setBlocked(null)} onConfirm={() => setBlocked(null)} title="Deletion blocked" icon="ShieldAlert" message={blocked ?? ''} confirmLabel="Understood" cancelLabel="Close" testID="pt-blocked" />
      <InfoBanner tone="grey" icon="Info" text="Reordering also works with VoiceOver: focus the drag handle and swipe up/down." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowWrap: { marginBottom: spacing.md },
  dragging: { borderColor: colors.green900, shadowOpacity: 0.2, shadowRadius: 12 },
  mono: { backgroundColor: colors.surfaceMuted, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  handle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  vdiv: { width: 1, height: 20, backgroundColor: colors.border },
  action: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 6 },
});
