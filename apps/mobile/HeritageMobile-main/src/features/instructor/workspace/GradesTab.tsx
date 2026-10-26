import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, EmptyState, Icon, Input, Avatar, BottomSheet, ConfirmSheet, Screen, ScreenHeader, DemoLabel, InfoBanner, StatTile, KeyValueRow } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useRoster, useSectionMarks, useGradeMutations, useSubmissionsForSection } from '../useInstructor';
import { useGradeItems, useSection } from '../../student/courses/useCourses';
import { useAppNavigation } from '../../../navigation/hooks';
import { useFileActions } from '../../shared/useFileActions';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';
import { useUnsavedChangesGuard } from '../../shared/hooks';
import { formatBytes, formatDateTime } from '../../../utils/format';
import type { Mark } from '../../../domain/types';

type Phase = 'Draft' | 'Submitted' | 'Released';
const PHASE_TONE: Record<Phase, 'purple' | 'blue' | 'green'> = { Draft: 'purple', Submitted: 'blue', Released: 'green' };
/** Any unsubmitted draft keeps the section in Draft; otherwise the furthest-along state wins. */
function gradePhase(marks: Mark[] | undefined): Phase {
  const scored = (marks ?? []).filter(x => x.score !== undefined);
  if (!scored.length || scored.some(x => x.status === 'draft')) return 'Draft';
  return scored.some(x => x.status === 'submitted') ? 'Submitted' : 'Released';
}
function PhasePill({ marks, testID }: { marks: Mark[] | undefined; testID: string }) {
  const phase = gradePhase(marks);
  return <Pill label={`Status: ${phase}`} tone={PHASE_TONE[phase]} dot testID={testID} />;
}

export function GradesTab({ sectionId }: { sectionId: string }) {
  const navigation = useAppNavigation();
  const items = useGradeItems(sectionId);
  const roster = useRoster(sectionId);
  const marks = useSectionMarks(sectionId);
  const m = useGradeMutations(sectionId);
  const files = useFileActions();
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [max, setMax] = useState('100');
  const [postOpen, setPostOpen] = useState(false);
  const totalWeight = (items.data ?? []).reduce((a, g) => a + g.weightPct, 0);
  const counts = useMemo(() => {
    const all = marks.data ?? [];
    return { draft: all.filter(x => x.status === 'draft' && x.score !== undefined).length, submitted: all.filter(x => x.status === 'submitted').length, released: all.filter(x => x.status === 'released').length, expected: (items.data?.length ?? 0) * (roster.data?.length ?? 0) };
  }, [marks.data, items.data, roster.data]);
  const standing = useMemo(() => {
    const all = marks.data ?? [];
    const gi = items.data ?? [];
    const scored = all.filter(x => x.score !== undefined);
    if (!scored.length || !gi.length) return null;
    const perStudent = (roster.data ?? []).map(u => { const mine = scored.filter(x => x.studentId === u.id); const w = mine.reduce((a, x) => a + (gi.find(g => g.id === x.gradeItemId)?.weightPct ?? 0), 0); return w ? mine.reduce((a, x) => a + (x.score! / (gi.find(g => g.id === x.gradeItemId)?.maxPoints ?? 100)) * (gi.find(g => g.id === x.gradeItemId)?.weightPct ?? 0), 0) / w : null; }).filter((x): x is number => x !== null);
    return perStudent.length ? Math.round((perStudent.reduce((a, b) => a + b, 0) / perStudent.length) * 100) : null;
  }, [marks.data, items.data, roster.data]);
  const addItem = async () => {
    const w = Number(weight); const mp = Number(max);
    if (!name.trim() || Number.isNaN(w) || w <= 0 || Number.isNaN(mp) || mp <= 0) { toast('Enter a name, a positive weight and max points', 'error'); return; }
    try { await m.addItem.mutateAsync({ name: name.trim(), weightPct: w, maxPoints: mp }); toast('Grade item added', 'success'); setAddOpen(false); setName(''); setWeight(''); } catch (e) { toast(errorMessage(e), 'error'); }
  };
  const exportCsv = async () => { try { const r = await m.exportCsv.mutateAsync(); await files.exportText(r.fileName, r.content); } catch (e) { toast(errorMessage(e), 'error'); } };
  return (
    <Stack>
      <Card>
        {marks.data ? <Row style={{ marginBottom: spacing.sm }}><PhasePill marks={marks.data} testID="grades-phase" /></Row> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          <Button title="Add Item" variant="outline" size="sm" fullWidth={false} onPress={() => setAddOpen(true)} testID="grades-add-item" />
          <Button title="Enter marks" variant="outline" size="sm" fullWidth={false} onPress={() => navigation.navigate(Routes.InstructorGradeEntry, { sectionId })} disabled={!roster.data?.length || !items.data?.length} disabledReason={!roster.data?.length ? 'No students registered' : undefined} testID="grades-enter" />
          <Button title="Post Class Marks" variant="outline" size="sm" fullWidth={false} onPress={() => setPostOpen(true)} disabled={!counts.submitted} disabledReason="Submit marks first" testID="grades-post" />
          <Button title="Export Grades" variant="outline" size="sm" fullWidth={false} onPress={exportCsv} testID="grades-export" />
        </ScrollView>
        {items.isLoading ? <LoadingState /> : items.error ? <ErrorState error={items.error} onRetry={() => items.refetch()} /> : (
          <View style={styles.grid}>
            {(items.data ?? []).map(g => <View key={g.id} style={styles.cell}><Text variant="overline">{g.name}</Text><Text variant="titleMd">{g.weightPct.toFixed(2)}%</Text></View>)}
            <View style={styles.cell}><Text variant="overline">Current standing</Text><Text variant="titleMd">{standing !== null ? `${standing}%` : '—'}</Text></View>
          </View>
        )}
        {!roster.data?.length ? <View style={styles.empty}><Text variant="bodySm" style={{ fontStyle: 'italic' }}>No students are currently registered in this course offering.</Text></View> : (
          <Row style={{ marginTop: spacing.sm }}><StatTile label="Draft" value={counts.draft} sub={`of ${counts.expected}`} /><StatTile label="Submitted" value={counts.submitted} /><StatTile label="Released" value={counts.released} /></Row>
        )}
        <Row justify="space-between" style={styles.footer}><Text variant="caption">Grading breakdown</Text><Text variant="label" color={totalWeight === 100 ? colors.success600 : colors.danger600}>Weight total: {totalWeight}%{totalWeight !== 100 ? ' (must be 100%)' : ''}</Text></Row>
      </Card>
      <SubmissionsList sectionId={sectionId} />
      <DemoLabel text="Draft → submitted → released are distinct states" />
      <BottomSheet visible={addOpen} onClose={() => setAddOpen(false)} title="Add grade item" testID="grades-add-sheet">
        <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. Quiz 3" testID="gi-name" />
        <Row><View style={{ flex: 1 }}><Input label="Weight %" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} helper={`Remaining: ${Math.max(0, 100 - totalWeight)}%`} testID="gi-weight" /></View><View style={{ flex: 1 }}><Input label="Max points" keyboardType="number-pad" value={max} onChangeText={setMax} testID="gi-max" /></View></Row>
        <Button title="Add item" onPress={addItem} loading={m.addItem.isPending} testID="gi-save" />
      </BottomSheet>
      <ConfirmSheet visible={postOpen} onClose={() => setPostOpen(false)} title="Post class marks?" icon="Send" confirmLabel="Release to students" loading={m.release.isPending} message={`${counts.submitted} submitted mark(s) will become visible to students. Released marks cannot be edited${isMockMode() ? ' in this demo' : ''}.`} testID="grades-post-sheet" onConfirm={async () => { try { const r = await m.release.mutateAsync(); toast(`${r.released} marks released to students`, 'success'); } catch (e) { toast(errorMessage(e), 'error'); } setPostOpen(false); }} />
    </Stack>
  );
}

function SubmissionsList({ sectionId }: { sectionId: string }) {
  const subs = useSubmissionsForSection(sectionId);
  const files = useFileActions();
  if (!subs.data?.length) return null;
  return (
    <Card>
      <Text variant="overline" style={{ marginBottom: 4 }}>Student submissions ({subs.data.length})</Text>
      {subs.data.map(s => (
        <Row key={s.id} gap={spacing.sm} style={styles.sub}>
          <Avatar initials={s.student.avatarInitials} size={32} bg={colors.green50} fg={colors.green900} />
          <View style={{ flex: 1 }}><Text variant="bodyStrong">{s.student.displayName} · {s.assignment.title}</Text><Text variant="caption">{s.status}{s.submittedAt ? ` · ${formatDateTime(s.submittedAt)}` : ''}{s.attachments[0] ? ` · ${s.attachments[0].name} (${formatBytes(s.attachments[0].size)})` : ''}</Text></View>
          {s.attachments[0]?.uri ? <Button title="Open" size="sm" variant="outline" fullWidth={false} onPress={() => files.viewPath(s.attachments[0].uri, s.attachments[0].mimeType, s.attachments[0].name)} /> : <Pill label={s.status} tone={s.status === 'draft' ? 'purple' : 'blue'} small />}
        </Row>
      ))}
    </Card>
  );
}

export function GradeEntryScreen({ navigation, route }: RootScreenProps<'InstructorGradeEntry'>) {
  const { sectionId } = route.params;
  const section = useSection(sectionId);
  const items = useGradeItems(sectionId);
  const roster = useRoster(sectionId);
  const marks = useSectionMarks(sectionId);
  const m = useGradeMutations(sectionId);
  const [values, setValues] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [init, setInit] = useState(false);
  const [review, setReview] = useState(false);
  useEffect(() => {
    if (!init && marks.data) { const v: Record<string, string> = {}; const f: Record<string, string> = {}; marks.data.forEach(x => { if (x.score !== undefined) v[x.id] = String(x.score); if (x.feedback) f[x.id] = x.feedback; }); setValues(v); setFeedback(f); setInit(true); }
  }, [marks.data, init]);
  const saved = useMemo(() => Object.fromEntries((marks.data ?? []).filter(x => x.score !== undefined).map(x => [x.id, String(x.score)])), [marks.data]);
  const savedFeedback = useMemo(() => Object.fromEntries((marks.data ?? []).filter(x => x.feedback).map(x => [x.id, x.feedback!])), [marks.data]);
  const dirty = init && (JSON.stringify(values) !== JSON.stringify(saved) || JSON.stringify(Object.fromEntries(Object.entries(feedback).filter(([, v]) => v))) !== JSON.stringify(savedFeedback));
  const { allowLeave } = useUnsavedChangesGuard(dirty, 'Unsaved marks will be lost. Save a draft first?');
  const gi = items.data ?? [];
  const list = roster.data ?? [];
  const statusOf = (id: string) => marks.data?.find(x => x.id === id && x.score !== undefined)?.status;  const invalid = Object.entries(values).filter(([id, v]) => { const g = gi.find(x => id.startsWith(x.id + ':')); const n = Number(v); return v !== '' && (Number.isNaN(n) || n < 0 || n > (g?.maxPoints ?? 100)); });
  const missing = gi.length * list.length - Object.values(values).filter(v => v !== '').length;
  const payload = () => gi.flatMap(g => list.map(u => { const id = `${g.id}:${u.id}`; const v = values[id]; return { gradeItemId: g.id, studentId: u.id, score: v === '' || v === undefined ? undefined : Number(v), feedback: feedback[id] }; }));
  const saveDraft = async () => { try { await m.saveDraft.mutateAsync(payload()); allowLeave(); toast('Draft marks saved', 'success'); } catch (e) { toast(errorMessage(e), 'error'); } };
  const submit = async () => { try { await m.saveDraft.mutateAsync(payload()); const r = await m.submit.mutateAsync(); allowLeave(); setReview(false); toast(`${r.submitted} marks submitted (not yet released)`, 'success'); navigation.goBack(); } catch (e) { toast(errorMessage(e), 'error'); setReview(false); } };
  return (
    <Screen testID="grade-entry" header={<ScreenHeader title="Enter marks" subtitle={section.data ? `${section.data.course.code} · ${section.data.sectionCode}` : ''} />} footer={<Row><Button title="Save draft" variant="outline" style={{ flex: 1 }} onPress={saveDraft} loading={m.saveDraft.isPending} disabled={invalid.length > 0} disabledReason={invalid.length ? `${invalid.length} invalid mark(s)` : undefined} testID="ge-save-draft" /><Button title="Review & submit" style={{ flex: 1.2 }} onPress={() => setReview(true)} disabled={missing > 0 || invalid.length > 0} disabledReason={missing > 0 ? `${missing} mark(s) missing` : invalid.length ? 'Fix invalid marks' : undefined} testID="ge-submit" /></Row>}>
      {items.isLoading || roster.isLoading || marks.isLoading ? <LoadingState /> : !list.length ? <EmptyState icon="Users" title="No students registered" /> : (
        <Stack>
          <Row><PhasePill marks={marks.data} testID="ge-phase" /></Row>
          <InfoBanner tone="grey" icon="Info" text={`Marks must be between 0 and each item's maximum. Configured weights total ${gi.reduce((a, g) => a + g.weightPct, 0)}%. Submitting is not releasing — use Post Class Marks afterwards.`} />
          {list.map(u => (
            <Card key={u.id} padding={spacing.md} testID={`ge-${u.id}`}>
              <Row gap={spacing.sm} style={{ marginBottom: spacing.sm }}><Avatar initials={u.avatarInitials} size={32} bg={colors.green50} fg={colors.green900} /><View><Text variant="bodyStrong">{u.displayName}</Text><Text variant="caption">{u.student?.studentNumber}</Text></View></Row>
              {gi.map(g => { const id = `${g.id}:${u.id}`; const v = values[id] ?? ''; const n = Number(v); const bad = v !== '' && (Number.isNaN(n) || n < 0 || n > g.maxPoints); const st = statusOf(id); return (
                <View key={g.id} style={styles.itemBlock}>
                  <Row gap={spacing.sm}>
                    <Text variant="bodySm" style={{ flex: 1 }}>{g.name} <Text variant="caption">({g.weightPct}%)</Text></Text>
                    <View style={{ width: 120 }}><Input keyboardType="decimal-pad" placeholder={`/ ${g.maxPoints}`} value={v} editable={st !== 'released'} onChangeText={t => setValues(x => ({ ...x, [id]: t }))} error={bad ? `0–${g.maxPoints}` : undefined} testID={`ge-${u.id}-${g.id}`} /></View>
                    {st ? <Pill label={st === 'released' ? 'Released' : st === 'submitted' ? 'Submitted' : 'Draft'} tone={st === 'released' ? 'green' : st === 'submitted' ? 'blue' : 'purple'} small testID={`ge-${u.id}-${g.id}-status`} /> : null}
                  </Row>
                  <Input placeholder={`Feedback on ${g.name} (optional)`} value={feedback[id] ?? ''} editable={st !== 'released'} onChangeText={t => setFeedback(f => ({ ...f, [id]: t }))} containerStyle={{ marginTop: 4 }} testID={`ge-${u.id}-${g.id}-feedback`} />
                </View>
              ); })}
            </Card>
          ))}
          <DemoLabel text="Released marks are read-only" />
        </Stack>
      )}
      <ConfirmSheet visible={review} onClose={() => setReview(false)} onConfirm={submit} loading={m.submit.isPending || m.saveDraft.isPending} title="Submit marks?" icon="ClipboardCheck" confirmLabel="Submit marks" testID="ge-review-sheet" message={<Stack gap={4}><Text variant="body" align="center">{gi.length} items × {list.length} students</Text><KeyValueRow label="Entered" value={`${gi.length * list.length - missing}`} border={false} /><Text variant="caption" align="center">Submitted marks stay hidden from students until you Post Class Marks.</Text></Stack>} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  itemBlock: { paddingBottom: spacing.sm, marginBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  cell: { width: '50%', paddingVertical: 8, paddingRight: 8 },
  empty: { backgroundColor: colors.surfaceMuted, borderRadius: 10, padding: spacing.md, marginTop: spacing.sm },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.sm },
  sub: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
});
export { Icon };
