import React, { useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, Input, Select, LoadingState, ErrorState, EmptyState, Icon, Pager, ConfirmSheet, BottomSheet, KeyValueRow, DemoLabel, InfoBanner, Toggle } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useRepositories, useRepositoryMutations } from '../useInstructor';
import { useQuery } from '@tanstack/react-query';
import { useServices } from '../../../app/ServicesProvider';
import { toast } from '../../../state/uiStore';
import { ServiceError, errorMessage } from '../../../services/errors';
import { formatDateTime } from '../../../utils/format';
import type { ContentRepository } from '../../../domain/types';
import { useUnsavedChangesGuard } from '../../shared/hooks';
import { useCurrentUserId } from '../../../state/sessionStore';

export function RepositoryScreen({ navigation }: RootScreenProps<'InstructorRepository'>) {
  const [query, setQuery] = useState('');
  const [repoFilter, setRepoFilter] = useState('Master Repository');
  const [applied, setApplied] = useState({ query: '', repository: 'Master Repository' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const list = useRepositories({ ...applied, page, pageSize });
  const m = useRepositoryMutations();
  const [confirm, setConfirm] = useState<{ repo: ContentRepository; action: 'delete' | 'push' | 'pull' } | null>(null);
  const [manage, setManage] = useState<ContentRepository | null>(null);
  const run = async () => {
    if (!confirm) return;
    try {
      if (confirm.action === 'delete') { await m.remove.mutateAsync(confirm.repo.id); toast(isMockMode() ? 'Repository deleted (local demo)' : 'Repository deleted', 'success'); }
      else { await m.action.mutateAsync({ id: confirm.repo.id, action: confirm.action }); toast(isMockMode() ? `${confirm.action === 'push' ? 'Push' : 'Pull'} recorded locally — no LMS was contacted` : `${confirm.action === 'push' ? 'Push' : 'Pull'} requested`, 'success'); }
    } catch (e) { toast(errorMessage(e), 'error'); }
    setConfirm(null);
  };
  return (
    <Screen testID="repository" header={<ScreenHeader backLabel="Courses" />}>
      <Stack>
        <Text variant="displayMd">Course Content Repository</Text>
        <Text variant="body">Manage master packages, synchronize versions, and inspect deployment states{isMockMode() ? ' (local demo state only)' : ''}.</Text>
        <Button title="+ Create Content Course" onPress={() => navigation.navigate(Routes.InstructorCreateContentCourse)} testID="repo-create" />
        <Card padding={spacing.md}>
          <Row justify="space-between"><Text variant="overline">Course filter</Text><Text variant="caption">Refine catalogue</Text></Row>
          <Input label="Course name / number" value={query} onChangeText={setQuery} placeholder="e.g. ACSW 100" containerStyle={{ marginTop: spacing.sm }} testID="repo-query" />
          <Select label="Repository filter" value={repoFilter} onChange={setRepoFilter} options={[{ value: 'Master Repository', label: 'Master Repository' }, { value: 'Active only', label: 'Active only' }, { value: 'Inactive only', label: 'Inactive only' }]} testID="repo-filter" />
          <Button title="Search Repository" icon={<Icon name="Search" size={16} color={colors.white} />} style={{ marginTop: spacing.sm }} onPress={() => { setApplied({ query, repository: repoFilter }); setPage(1); }} testID="repo-search" />
        </Card>
        <Pager page={page} pageCount={list.data?.pageCount ?? 1} onChange={setPage} total={list.data?.total} pageSize={pageSize} onPageSize={setPageSize} testID="repo-pager" />
        {list.isLoading ? <LoadingState /> : list.error ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : !list.data?.items.length ? <EmptyState icon="Database" title="No repositories match" /> : list.data.items.map(r => (
          <Card key={r.id} testID={`repo-${r.id}`}>
            <Row justify="space-between"><Text variant="titleMd" style={{ flex: 1 }}>{r.code} — {r.name}</Text><Pill label={r.status === 'active' ? 'Active' : 'Inactive'} tone={r.status === 'active' ? 'green' : 'grey'} small /></Row>
            <Text variant="caption">LMS: [{r.lms}] Types: {r.types} · v{r.version} · {r.deployed}</Text>
            <Row style={{ marginTop: spacing.sm }}>
              <Button title="Manage" variant="subtle" size="sm" style={{ flex: 1 }} onPress={() => setManage(r)} testID={`repo-manage-${r.id}`} />
              <Button title="Edit" variant="outline" size="sm" style={{ flex: 1 }} onPress={() => navigation.navigate(Routes.InstructorCreateContentCourse, { repoId: r.id })} testID={`repo-edit-${r.id}`} />
              <Button title="Delete" variant="danger" size="sm" style={{ flex: 1 }} onPress={() => setConfirm({ repo: r, action: 'delete' })} testID={`repo-delete-${r.id}`} />
            </Row>
            <Row style={{ marginTop: spacing.sm }} wrap>
              <Pressable accessibilityRole="button" onPress={() => setConfirm({ repo: r, action: 'push' })} style={styles.chip} testID={`repo-push-${r.id}`}><Text variant="label" color={colors.green900}>PUSH ({r.pushCount})</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => setConfirm({ repo: r, action: 'pull' })} style={styles.chip} testID={`repo-pull-${r.id}`}><Text variant="label" color={colors.green900}>PULL ({r.pullCount})</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={!r.history.length} onPress={() => navigation.navigate(Routes.InstructorRepositoryHistory, { repoId: r.id })} style={[styles.chip, !r.history.length ? { opacity: 0.4 } : null]} testID={`repo-history-${r.id}`}><Text variant="label" color={colors.green900}>HISTORY ({r.history.length})</Text></Pressable>
            </Row>
          </Card>
        ))}
        <Pager page={page} pageCount={list.data?.pageCount ?? 1} onChange={setPage} pageSize={pageSize} onPageSize={setPageSize} />
        <DemoLabel text="Push/Pull update local version state only · no Moodle sync" />
      </Stack>
      <ConfirmSheet visible={!!confirm} onClose={() => setConfirm(null)} onConfirm={run} destructive={confirm?.action === 'delete'} loading={m.remove.isPending || m.action.isPending} title={confirm?.action === 'delete' ? 'Delete repository?' : confirm?.action === 'push' ? (isMockMode() ? 'Push to LMS (demo)?' : 'Push to LMS?') : isMockMode() ? 'Pull from LMS (demo)?' : 'Pull from LMS?'} icon={confirm?.action === 'delete' ? 'Trash2' : confirm?.action === 'push' ? 'Upload' : 'Download'} confirmLabel={confirm?.action === 'delete' ? 'Delete' : confirm?.action === 'push' ? (isMockMode() ? 'Record push' : 'Push') : isMockMode() ? 'Record pull' : 'Pull'} message={!isMockMode() ? (confirm?.action === 'delete' ? `"${confirm.repo.code} — ${confirm.repo.name}" will be removed from the repository list.` : `This requests a ${confirm?.action} for this course package.`) : confirm?.action === 'delete' ? `"${confirm.repo.code} — ${confirm.repo.name}" will be removed from the local demo repository list.` : `This records a ${confirm?.action} in the local history and bumps the version. No real Moodle synchronization occurs.`} testID="repo-confirm" />
      <BottomSheet visible={!!manage} onClose={() => setManage(null)} title={manage ? `${manage.code} — ${manage.name}` : ''} subtitle="Manage (local state)" testID="repo-manage-sheet">
        {manage ? (<>
          <KeyValueRow label="Status" value={manage.status} />
          <KeyValueRow label="Version" value={`v${manage.version} · ${manage.deployed}`} />
          <KeyValueRow label="Format" value={`${manage.format} · ${manage.sections} sections`} />
          <KeyValueRow label="Default" value={manage.isDefault ? 'Yes' : 'No'} border={false} />
          <Toggle label="Active" value={manage.status === 'active'} onChange={async v => { try { const r = await m.update.mutateAsync({ id: manage.id, patch: { status: v ? 'active' : 'inactive' } }); setManage(r); } catch (e) { toast(errorMessage(e), 'error'); } }} testID="repo-toggle-active" />
          <Toggle label="Default for course" value={manage.isDefault} onChange={async v => { const r = await m.update.mutateAsync({ id: manage.id, patch: { isDefault: v } }); setManage(r); }} testID="repo-toggle-default" />
          <Button title="View history" variant="outline" onPress={() => { setManage(null); navigation.navigate(Routes.InstructorRepositoryHistory, { repoId: manage.id }); }} />
        </>) : null}
      </BottomSheet>
    </Screen>
  );
}

export function RepositoryHistoryScreen({ route }: RootScreenProps<'InstructorRepositoryHistory'>) {
  const q = useRepositories({ page: 1, pageSize: 500 });
  const m = useRepositoryMutations();
  const repo = q.data?.items.find(r => r.id === route.params.repoId);
  const [target, setTarget] = useState<ContentRepository['history'][number] | null>(null);
  const restore = async () => {
    if (!repo || !target) return;
    try { await m.restore.mutateAsync({ id: repo.id, historyId: target.id }); toast(isMockMode() ? `Restored v${target.version} (local demo — no LMS contacted)` : `Restored v${target.version}`, 'success'); } catch (e) { toast(errorMessage(e), 'error'); }
    setTarget(null);
  };
  return (
    <Screen testID="repo-history" header={<ScreenHeader title="Version history" subtitle={repo ? `${repo.code} — ${repo.name}` : ''} />}>
      {q.isLoading ? <LoadingState /> : !repo ? <ErrorState error={new Error('Repository not found')} /> : (
        <Stack>
          <Card>{repo.history.length ? repo.history.map(h => (
            <Row key={h.id} justify="space-between" style={styles.hist}>
              <View style={{ flex: 1 }}><Text variant="bodyStrong">{h.action}</Text><Text variant="caption">{formatDateTime(h.at)} · {h.by}</Text></View>
              <Pill label={h.version === repo.version ? `v${h.version} · current` : `v${h.version}`} tone={h.version === repo.version ? 'green' : 'grey'} small />
              {m.canRestore && h.version !== repo.version ? <Button title="Restore" size="sm" variant="outline" fullWidth={false} style={{ marginLeft: spacing.sm }} onPress={() => setTarget(h)} testID={`repo-restore-${h.id}`} /> : null}
            </Row>
          )) : <EmptyState contained={false} icon="History" title="No history" />}</Card>
          <DemoLabel text="Local version history" />
        </Stack>
      )}
      <ConfirmSheet visible={!!target} onClose={() => setTarget(null)} onConfirm={restore} loading={m.restore.isPending} icon="History" title={`Restore v${target?.version ?? ''}?`} confirmLabel="Restore version" message={repo && target ? `The content package for ${repo.code} will be restored to v${target.version} and saved as v${repo.version + 1}. The current version stays in history${isMockMode() ? ' (local demo only — no LMS is contacted)' : ''}.` : ''} testID="repo-restore-sheet" />
    </Screen>
  );
}

const TYPES = ['All Course Types', 'Lecture', 'Lab', 'Online'];
const FORMATS = ['Topics', 'Weekly', 'Single activity'];

export function CreateContentCourseScreen({ navigation, route }: RootScreenProps<'InstructorCreateContentCourse'>) {
  const s = useServices();
  const courses = useQuery({ queryKey: ['allCourses'], queryFn: async () => (await s.courses.listInstructorSections('any'), s.instructor.listLessonCourses('any')) });
  const existing = useRepositories({ page: 1, pageSize: 500 });
  const editing = existing.data?.items.find(r => r.id === route.params?.repoId);
  const m = useRepositoryMutations();
  const [courseId, setCourseId] = useState(editing?.courseId ?? (isMockMode() ? 'c_acsw100' : ''));
  const [name, setName] = useState(editing?.name ?? (isMockMode() ? 'Addictions Fundamentals' : ''));
  const [types, setTypes] = useState(editing?.types ?? TYPES[0]);
  const [isDefault, setIsDefault] = useState(editing?.isDefault ?? true);
  const [format, setFormat] = useState(editing?.format ?? FORMATS[0]);
  const [sections, setSections] = useState(String(editing?.sections ?? 10));
  const [dupOpen, setDupOpen] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const { allowLeave } = useUnsavedChangesGuard(touched);
  const userId = useCurrentUserId();
  const allCourses = useQuery({ queryKey: ['courseCatalog', userId], queryFn: async () => { const secs = await s.courses.listInstructorSections(userId); const lesson = await s.instructor.listLessonCourses(userId); const map = new Map<string, { id: string; label: string }>(); secs.forEach(x => map.set(x.courseId, { id: x.courseId, label: `${x.course.code}: ${x.course.title}` })); lesson.forEach(c => map.set(c.id, { id: c.id, label: `${c.code}: ${c.title}` })); return Array.from(map.values()); } });
  void courses;
  const n = Number(sections);
  const errors = { name: !name.trim() ? 'Note / name is required' : undefined, sections: Number.isNaN(n) || n < 1 || n > 52 ? 'Enter 1–52 sections / weeks' : undefined };
  const save = async (deactivateDuplicates = false) => {
    if (errors.name || errors.sections) { setTouched(true); toast('Fix the highlighted fields', 'error'); return; }
    try {
      if (editing) { await m.update.mutateAsync({ id: editing.id, patch: { name, types, isDefault, format, sections: n, courseId } }); toast('Repository updated', 'success'); }
      else { const r = await m.create.mutateAsync({ courseId, name, types, isDefault, format, sections: n, deactivateDuplicates }); toast(r.deactivated.length ? `Created · ${r.deactivated.length} duplicate(s) deactivated (confirmed)` : 'Content course created', 'success'); }
      allowLeave(); setDupOpen(null); navigation.goBack();
    } catch (e) {
      if (ServiceError.is(e, 'CONFLICT')) setDupOpen(e.message); else toast(errorMessage(e), 'error');
    }
  };
  return (
    <Screen testID="create-content-course" header={<ScreenHeader backLabel="Back" />}>
      <Stack>
        <Text variant="displayMd">{editing ? 'Edit Content Course' : 'Create Content Course'}</Text>
        <InfoBanner tone="warning" icon="TriangleAlert" text={isMockMode() ? 'Demo rule: if an active repository already exists for the selected course, you will be asked to confirm before duplicates are deactivated. Nothing is deactivated silently, and unrelated records are never touched.' : 'If an active repository already exists for the selected course, you will be asked to confirm before duplicates are deactivated. Nothing is deactivated silently, and unrelated records are never touched.'} />
        <Card>
          <Text variant="displayXs" style={{ marginBottom: spacing.sm }}>Course Content Repository Settings</Text>
          <Stack gap={spacing.sm}>
            <Select label="Course" required value={courseId} onChange={v => { setCourseId(v); setTouched(true); }} options={(allCourses.data ?? []).map(c => ({ value: c.id, label: c.label }))} testID="ccc-course" />
            <Input label="Note / name" required value={name} onChangeText={t => { setName(t); setTouched(true); }} error={touched ? errors.name : undefined} testID="ccc-name" />
            <Select label="Course types" value={types} onChange={setTypes} options={TYPES.map(t => ({ value: t, label: t }))} testID="ccc-types" />
            <Select label="Default" value={isDefault ? 'Yes' : 'No'} onChange={v => setIsDefault(v === 'Yes')} options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} testID="ccc-default" />
            <Select label="Course format" value={format} onChange={setFormat} options={FORMATS.map(f => ({ value: f, label: f }))} testID="ccc-format" />
            <Input label="Sections / weeks" keyboardType="number-pad" value={sections} onChangeText={t => { setSections(t); setTouched(true); }} error={touched ? errors.sections : undefined} testID="ccc-sections" />
          </Stack>
        </Card>
        <Button title={editing ? 'Save changes' : 'Create Content Course'} onPress={() => save(false)} loading={m.create.isPending || m.update.isPending} testID="ccc-save" />
        <Button title="Cancel" variant="outline" onPress={() => navigation.goBack()} testID="ccc-cancel" />
        <DemoLabel text="Local repository record" />
      </Stack>
      <ConfirmSheet visible={!!dupOpen} onClose={() => setDupOpen(null)} onConfirm={() => save(true)} destructive title="Duplicate active repository" message={`${dupOpen ?? ''} Confirm to deactivate the existing active repository for this course and create the new one. Other courses are unaffected.`} confirmLabel="Deactivate duplicates & create" loading={m.create.isPending} testID="ccc-dup-sheet" />
    </Screen>
  );
}

const styles = StyleSheet.create({ chip: { backgroundColor: colors.green50, borderRadius: 999, paddingHorizontal: 12, minHeight: 36, justifyContent: 'center' }, hist: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border } });
export { View };
