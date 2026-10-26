import React, { useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, Input, Select, DateField, LoadingState, ErrorState, EmptyState, Icon, ConfirmSheet, KeyValue, KeyValueRow, DemoLabel } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useTerms, useRegistry } from '../useInstructor';
import { formatDate } from '../../../utils/format';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';
import { useUnsavedChangesGuard } from '../../shared/hooks';
import type { Term } from '../../../domain/types';
import type { TermRecord } from '../../../services/contracts';
import { clock } from '../../../utils/clock';
import { useQuery } from '@tanstack/react-query';
import { useServices } from '../../../app/ServicesProvider';

const CAMPUSES = ['ALL CAMPUSES', '#110 Heritage College- Surrey', 'Heritage College - Vancouver (demo)'];

function useCampusOptions(): string[] {
  const s = useServices();
  const q = useQuery({ queryKey: ['termCampuses'], queryFn: () => s.instructor.listCampuses!(), enabled: !isMockMode() && Boolean(s.instructor.listCampuses) });
  return isMockMode() ? CAMPUSES : ['ALL CAMPUSES', ...(q.data ?? [])];
}

function statusOf(t: Term): { label: string; tone: 'green' | 'grey' | 'teal' } {
  if (t.status === 'archived') return { label: 'Archived', tone: 'grey' };
  const now = clock.now();
  if (new Date(t.startDate).getTime() > now) return { label: 'Upcoming', tone: 'green' };
  if (new Date(t.endDate).getTime() < now) return { label: 'Past', tone: 'grey' };
  return { label: 'Current', tone: 'teal' };
}

export function ManageTermsScreen({ navigation }: RootScreenProps<'InstructorManageTerms'>) {
  const campuses = useCampusOptions();
  const [campus, setCampus] = useState(campuses[0]);
  const terms = useTerms(campus);
  const r = useRegistry();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Term | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const del = async () => { if (!deleting) return; try { const res = await r.deleteTerm.mutateAsync(deleting.id); if (res.blockedBy) setBlocked(res.blockedBy); else toast('Term deleted', 'success'); } catch (e) { toast(errorMessage(e), 'error'); } setDeleting(null); };
  return (
    <Screen testID="manage-terms" header={<ScreenHeader backLabel="Back" actions={[{ label: 'Create Term', icon: 'Plus', accessibilityLabel: 'Create term', variant: 'primary', onPress: () => navigation.navigate(Routes.InstructorTermForm), testID: 'term-create' }]} />}>
      <Stack>
        <Text variant="displayMd" style={{ textTransform: 'uppercase' }}>Manage Terms</Text>
        <Text variant="body">Configure and manage academic terms, dates, and campus allocations.</Text>
        <Card padding={spacing.md}><Select label="Campus" value={campus} onChange={setCampus} options={campuses.map(c => ({ value: c, label: c }))} testID="terms-campus" /></Card>
        <Row justify="space-between"><Text variant="overline">{terms.data?.length ?? 0} academic terms</Text><Text variant="caption">Active configuration</Text></Row>
        {terms.isLoading ? <LoadingState /> : terms.error ? <ErrorState error={terms.error} onRetry={() => terms.refetch()} /> : !terms.data?.length ? <EmptyState icon="CalendarRange" title="No terms for this campus" /> : terms.data.map(t => {
          const st = statusOf(t);
          const open = expanded.has(t.id);
          return (
            <Card key={t.id} padding={0} testID={`term-${t.id}`}>
              <View style={{ padding: spacing.lg }}>
                <Row justify="space-between"><Text variant="titleMd">{t.name}</Text><Pill label={st.label} tone={st.tone} small /></Row>
                <Text variant="bodySm">Code: <Text variant="bodyStrong">{t.code}</Text></Text>
                <View style={styles.divider} />
                <KeyValue label="Term dates" value={`${formatDate(t.startDate)} - ${formatDate(t.endDate)}`} />
                <KeyValue label="Campus" value={t.campus} style={{ marginTop: 6 }} />
                {open ? <View style={{ marginTop: 6 }}><KeyValue label="Status" value={t.status} />{isMockMode() && t.addDropDeadline ? <KeyValue label="Add/drop deadline" value={formatDate(t.addDropDeadline)} style={{ marginTop: 6 }} /> : null}<KeyValue label="Notes" value={t.notes ?? 'No notes'} style={{ marginTop: 6 }} /><KeyValue label="Term ID" value={t.id} style={{ marginTop: 6 }} /></View> : null}
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setExpanded(s => { const n = new Set(s); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })} style={styles.more} testID={`term-more-${t.id}`}><Text variant="label" color={colors.green900}>{open ? 'SHOW LESS ˄' : 'SHOW MORE ˅'}</Text></Pressable>
              </View>
              <Row style={styles.footer}>
                <Pressable accessibilityRole="button" onPress={() => navigation.navigate(Routes.InstructorTermForm, { termId: t.id, mode: 'view' })} style={styles.fbtn} testID={`term-view-${t.id}`}><Text variant="label" color={colors.green900}>VIEW</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => navigation.navigate(Routes.InstructorTermForm, { termId: t.id, mode: 'edit' })} style={[styles.fbtn, styles.fmid]} testID={`term-edit-${t.id}`}><Text variant="label" color={colors.green900}>EDIT</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => setDeleting(t)} style={styles.fbtn} testID={`term-delete-${t.id}`}><Text variant="label" color={colors.danger600}>DELETE</Text></Pressable>
              </Row>
            </Card>
          );
        })}
        <DemoLabel text="Terms referenced by course sections cannot be deleted" />
      </Stack>
      <ConfirmSheet visible={!!deleting} onClose={() => setDeleting(null)} onConfirm={del} destructive loading={r.deleteTerm.isPending} title="Delete term?" message={`"${deleting?.name}" (${deleting?.code}) will be removed if no course sections are scheduled in it.`} confirmLabel="Delete term" testID="term-delete-sheet" />
      <ConfirmSheet visible={!!blocked} onClose={() => setBlocked(null)} onConfirm={() => setBlocked(null)} title="Deletion blocked" icon="ShieldAlert" message={blocked ?? ''} confirmLabel="Understood" cancelLabel="Close" testID="term-blocked" />
    </Screen>
  );
}

export function TermFormScreen({ navigation, route }: RootScreenProps<'InstructorTermForm'>) {
  const terms = useTerms();
  const r = useRegistry();
  const existing = terms.data?.find(t => t.id === route.params?.termId);
  const readOnly = route.params?.mode === 'view';
  const [name, setName] = useState(existing?.name ?? '');
  const [code, setCode] = useState(existing?.code ?? '');
  const [start, setStart] = useState(existing?.startDate ?? '');
  const [end, setEnd] = useState(existing?.endDate ?? '');
  const campuses = useCampusOptions();
  const [campus, setCampus] = useState(existing?.campus ?? (isMockMode() ? CAMPUSES[1] : ''));
  const [status, setStatus] = useState<Term['status']>(existing?.status ?? 'upcoming');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [addDrop, setAddDrop] = useState(existing?.addDropDeadline ?? '');
  const [touched, setTouched] = useState(false);
  const { allowLeave } = useUnsavedChangesGuard(touched && !readOnly);
  const hasAddDrop = isMockMode();
  const errors = {
    name: !name.trim() ? 'Name is required' : undefined,
    code: !code.trim() ? 'Code is required' : undefined,
    campus: !campus ? 'Campus is required' : undefined,
    start: !start ? 'Start date is required' : undefined,
    end: !end ? 'End date is required' : start && end <= start ? 'End must be after start' : undefined,
    addDrop: hasAddDrop && addDrop && start && end && (addDrop < start || addDrop > end) ? 'Add/drop deadline must fall between the start and end dates' : undefined,
  };
  const save = async () => {
    setTouched(true);
    if (Object.values(errors).some(Boolean)) { toast('Fix the highlighted fields', 'error'); return; }
    const input: Omit<TermRecord, 'id'> & { id?: string } = { id: existing?.id, name: name.trim(), code: code.trim().toUpperCase(), startDate: start, endDate: end, campus, status, notes, ...(hasAddDrop && addDrop ? { addDropDeadline: addDrop } : {}) };
    try { await r.saveTerm.mutateAsync(input); allowLeave(); toast('Term saved', 'success'); navigation.goBack(); } catch (e) { toast(errorMessage(e), 'error'); }
  };
  if (route.params?.termId && terms.isLoading) return <Screen header={<ScreenHeader title="Term" />}><LoadingState /></Screen>;
  return (
    <Screen testID="term-form" header={<ScreenHeader title={readOnly ? 'Term details' : existing ? 'Edit term' : 'Create term'} actions={readOnly && existing ? [{ label: 'Edit', accessibilityLabel: 'Edit term', onPress: () => navigation.replace(Routes.InstructorTermForm, { termId: existing.id, mode: 'edit' }) }] : []} />} footer={!readOnly ? <Row><Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => navigation.goBack()} /><Button title="Save term" style={{ flex: 1.3 }} onPress={save} loading={r.saveTerm.isPending} testID="term-save" /></Row> : undefined}>
      <Stack>
        {readOnly && existing ? (
          <Card><KeyValueRow label="Name" value={existing.name} /><KeyValueRow label="Code" value={existing.code} /><KeyValueRow label="Dates" value={`${formatDate(existing.startDate)} – ${formatDate(existing.endDate)}`} />{hasAddDrop ? <KeyValueRow label="Add/drop deadline" value={existing.addDropDeadline ? formatDate(existing.addDropDeadline) : '—'} /> : null}<KeyValueRow label="Campus" value={existing.campus} /><KeyValueRow label="Status" value={existing.status} /><KeyValueRow label="Notes" value={existing.notes ?? '—'} border={false} /></Card>
        ) : (
          <Card>
            <Stack gap={spacing.sm}>
              <Input label="Term name" required placeholder="e.g. Fall 2027" value={name} onChangeText={t => { setName(t); setTouched(true); }} error={touched ? errors.name : undefined} testID="term-name" />
              <Input label="Code" required placeholder="e.g. 2027F" autoCapitalize="characters" value={code} onChangeText={t => { setCode(t); setTouched(true); }} error={touched ? errors.code : undefined} testID="term-code" />
              <Row><View style={{ flex: 1 }}><DateField label="Start date" required value={start || undefined} onChange={v => { setStart(v); setTouched(true); }} error={touched ? errors.start : undefined} testID="term-start" /></View><View style={{ flex: 1 }}><DateField label="End date" required value={end || undefined} onChange={v => { setEnd(v); setTouched(true); }} error={touched ? errors.end : undefined} testID="term-end" /></View></Row>
              {hasAddDrop ? <DateField label="Add/drop deadline" value={addDrop || undefined} onChange={v => { setAddDrop(v); setTouched(true); }} error={touched ? errors.addDrop : undefined} helper="Last day students can add or drop courses; must fall within the term" testID="term-add-drop" /> : null}
              <Select label="Campus" required value={campus} error={touched ? errors.campus : undefined} onChange={v => { setCampus(v); setTouched(true); }} options={campuses.slice(1).map(c => ({ value: c, label: c }))} testID="term-campus" />
              <Select label="Status" value={status} onChange={v => { setStatus(v); setTouched(true); }} options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'current', label: 'Current' }, { value: 'past', label: 'Past' }, { value: 'archived', label: 'Archived' }]} testID="term-status" />
              <Input label="Notes" value={notes} onChangeText={t => { setNotes(t); setTouched(true); }} multiline testID="term-notes" />
            </Stack>
          </Card>
        )}
        <DemoLabel text="Local registry record" />
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({ divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }, more: { minHeight: 40, justifyContent: 'center', marginTop: spacing.sm }, footer: { borderTopWidth: 1, borderTopColor: colors.border }, fbtn: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, fmid: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border } });
export { Icon };
