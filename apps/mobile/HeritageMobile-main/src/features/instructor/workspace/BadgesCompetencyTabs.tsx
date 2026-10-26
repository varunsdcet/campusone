import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, Icon, Input, BottomSheet, ConfirmSheet, Checkbox, Select, DemoLabel, Avatar } from '../../../components';
import { colors, spacing } from '../../../theme';
import { useSectionBadges, useCompetencies, useRoster } from '../useInstructor';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';
import type { SectionBadge, CompetencyDef } from '../../../domain/types';
import { isMockMode } from '../../../config/appConfig';

export function BadgesTab({ sectionId }: { sectionId: string }) {
  const { list, save, remove } = useSectionBadges(sectionId);
  const roster = useRoster(sectionId);
  const [editing, setEditing] = useState<Partial<SectionBadge> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const submit = async () => {
    if (!editing) return;
    try { await save.mutateAsync({ id: editing.id, sectionId, name: editing.name ?? '', description: editing.description ?? '', criteria: editing.criteria ?? '', awardedStudentIds: editing.awardedStudentIds ?? [] }); toast('Badge saved', 'success'); setEditing(null); } catch (e) { toast(errorMessage(e), 'error'); }
  };
  return (
    <Stack>
      <Card>
        <Row justify="space-between"><Text variant="displaySm">Badges</Text>{list.data?.length ? <Pill label={`${list.data.length}`} tone="grey" small /> : null}</Row>
        {list.isLoading ? <LoadingState /> : list.error ? <ErrorState error={list.error} /> : !list.data?.length ? <Text variant="bodySm" style={{ marginVertical: spacing.sm }}>No badges are currently available for users to earn</Text> : list.data.map(b => (
          <Card key={b.id} tone="muted" padding={spacing.md} style={{ marginTop: spacing.sm }} testID={`badge-${b.id}`}>
            <Row justify="space-between"><Row gap={8}><Icon name="Award" size={18} color={colors.gold600} /><Text variant="titleSm">{b.name}</Text></Row><Pill label={`${b.awardedStudentIds.length} awarded`} tone="green" small /></Row>
            <Text variant="bodySm">{b.description}</Text>
            <Text variant="caption">Criteria: {b.criteria || '—'}</Text>
            <Row style={{ marginTop: spacing.sm }}><Button title="Edit / assign" variant="outline" size="sm" fullWidth={false} onPress={() => setEditing(b)} testID={`badge-edit-${b.id}`} /><Button title="Delete" variant="ghost" size="sm" fullWidth={false} onPress={() => setDeleteId(b.id)} /></Row>
          </Card>
        ))}
        <Button title="+ Add a new badge" style={{ marginTop: spacing.md }} onPress={() => setEditing({ awardedStudentIds: [] })} testID="badge-add" />
      </Card>
      {isMockMode() ? <DemoLabel text="Local badge records · no verified credentials" /> : null}
      <BottomSheet visible={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit badge' : 'New badge'} testID="badge-sheet">
        <Input label="Name" required value={editing?.name ?? ''} onChangeText={t => setEditing(e => ({ ...e, name: t }))} testID="badge-name" />
        <Input label="Description" value={editing?.description ?? ''} onChangeText={t => setEditing(e => ({ ...e, description: t }))} testID="badge-desc" />
        <Input label="Criteria" value={editing?.criteria ?? ''} onChangeText={t => setEditing(e => ({ ...e, criteria: t }))} placeholder="e.g. Attend all sessions" testID="badge-criteria" />
        <Text variant="label">Assign to students</Text>
        {(roster.data ?? []).map(u => <Checkbox key={u.id} label={u.displayName} checked={!!editing?.awardedStudentIds?.includes(u.id)} onChange={v => setEditing(e => ({ ...e, awardedStudentIds: v ? [...(e?.awardedStudentIds ?? []), u.id] : (e?.awardedStudentIds ?? []).filter(x => x !== u.id) }))} testID={`badge-assign-${u.id}`} />)}
        <Button title="Save badge" onPress={submit} loading={save.isPending} disabled={!editing?.name?.trim()} disabledReason="Name is required" testID="badge-save" />
      </BottomSheet>
      <ConfirmSheet visible={!!deleteId} onClose={() => setDeleteId(null)} destructive title="Delete badge?" message={`Students who were assigned this badge will lose it${isMockMode() ? ' in the demo records' : ''}.`} confirmLabel="Delete" onConfirm={async () => { await remove.mutateAsync(deleteId!); setDeleteId(null); }} />
    </Stack>
  );
}

const LEVELS = ['Emerging', 'Developing', 'Proficient', 'Advanced'];

export function CompetencyTab({ sectionId }: { sectionId: string }) {
  const { list, save, remove, assess } = useCompetencies(sectionId);
  const roster = useRoster(sectionId);
  const [editing, setEditing] = useState<Partial<CompetencyDef> | null>(null);
  const [assessing, setAssessing] = useState<CompetencyDef | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const submit = async () => {
    if (!editing) return;
    try { await save.mutateAsync({ id: editing.id, sectionId, name: editing.name ?? '', description: editing.description ?? '', levels: LEVELS }); toast('Competency saved', 'success'); setEditing(null); } catch (e) { toast(errorMessage(e), 'error'); }
  };
  return (
    <Stack>
      <Card>
        <Text variant="displaySm">Competency Breakdown</Text>
        {list.isLoading ? <LoadingState /> : list.error ? <ErrorState error={list.error} /> : !list.data?.length ? <Text variant="bodySm" style={{ marginVertical: spacing.sm }}>No competencies found</Text> : list.data.map(c => {
          const total = roster.data?.length ?? 0;
          const counts = LEVELS.map(l => c.assessments.filter(a => a.level === l).length);
          return (
            <Card key={c.id} tone="muted" padding={spacing.md} style={{ marginTop: spacing.sm }} testID={`comp-${c.id}`}>
              <Row justify="space-between"><Text variant="titleSm">{c.name}</Text><Pill label={`${c.assessments.length}/${total} assessed`} tone={c.assessments.length === total && total ? 'green' : 'grey'} small /></Row>
              <Text variant="bodySm">{c.description}</Text>
              <View style={styles.bar}>{counts.map((n, i) => <View key={i} style={{ flex: n || 0.001, backgroundColor: [colors.coral500, colors.gold500, colors.green500, colors.green900][i] }} />)}</View>
              <Row wrap gap={6}>{LEVELS.map((l, i) => <Text key={l} variant="caption">{l}: {counts[i]}</Text>)}</Row>
              <Row style={{ marginTop: spacing.sm }}><Button title="Assess students" size="sm" fullWidth={false} onPress={() => setAssessing(c)} testID={`comp-assess-${c.id}`} /><Button title="Edit" variant="outline" size="sm" fullWidth={false} onPress={() => setEditing(c)} /><Button title="Delete" variant="ghost" size="sm" fullWidth={false} onPress={() => setDeleteId(c.id)} /></Row>
            </Card>
          );
        })}
        <Button title="+ Add Competencies" style={{ marginTop: spacing.md }} onPress={() => setEditing({})} testID="comp-add" />
      </Card>
      {isMockMode() ? <DemoLabel text="Levels are demo values (Emerging → Advanced)" /> : <Text variant="caption">Assessments are saved to this section and remain visible after sign-in.</Text>}
      <BottomSheet visible={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit competency' : 'New competency'} testID="comp-sheet">
        <Input label="Name" required value={editing?.name ?? ''} onChangeText={t => setEditing(e => ({ ...e, name: t }))} placeholder="e.g. Family systems assessment" testID="comp-name" />
        <Input label="Description" value={editing?.description ?? ''} onChangeText={t => setEditing(e => ({ ...e, description: t }))} multiline testID="comp-desc" />
        <Text variant="caption">Levels: {LEVELS.join(' → ')}</Text>
        <Button title="Save competency" onPress={submit} loading={save.isPending} disabled={!editing?.name?.trim()} disabledReason="Name is required" testID="comp-save" />
      </BottomSheet>
      <BottomSheet visible={!!assessing} onClose={() => setAssessing(null)} title={assessing?.name} subtitle="Assign a level per student" testID="comp-assess-sheet">
        {(roster.data ?? []).map(u => { const cur = list.data?.find(c => c.id === assessing?.id)?.assessments.find(a => a.studentId === u.id)?.level; return (
          <Row key={u.id} gap={spacing.sm} style={{ paddingVertical: 4 }}><Avatar initials={u.avatarInitials} size={30} bg={colors.green50} fg={colors.green900} /><Text variant="bodyStrong" style={{ flex: 1 }}>{u.displayName}</Text><View style={{ width: 150 }}><Select compact value={cur} onChange={l => assess.mutate({ competencyId: assessing!.id, studentId: u.id, level: l })} placeholder="Level" options={LEVELS.map(l => ({ value: l, label: l }))} testID={`comp-level-${u.id}`} /></View></Row>
        ); })}
        <Button title="Done" onPress={() => setAssessing(null)} />
      </BottomSheet>
      <ConfirmSheet visible={!!deleteId} onClose={() => setDeleteId(null)} destructive title="Delete competency?" message="All level assessments for this competency will be removed." confirmLabel="Delete" onConfirm={async () => { await remove.mutateAsync(deleteId!); setDeleteId(null); }} />
    </Stack>
  );
}

const styles = StyleSheet.create({ bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginVertical: spacing.sm, backgroundColor: colors.border } });
