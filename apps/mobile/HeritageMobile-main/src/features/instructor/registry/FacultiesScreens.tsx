import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, Input, Select, LoadingState, ErrorState, EmptyState, Icon, Accordion, ConfirmSheet, DemoLabel, InfoBanner, Toggle, KeyValueRow } from '../../../components';
import { colors, spacing } from '../../../theme';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useRegistry, useProgramTypes } from '../useInstructor';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';
import { useUnsavedChangesGuard } from '../../shared/hooks';
import type { AcademicProgram } from '../../../domain/types';
import { isMockMode } from '../../../config/appConfig';

export function FacultiesScreen({ navigation }: RootScreenProps<'InstructorFaculties'>) {
  const r = useRegistry();
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState<{ kind: 'faculty' | 'program'; id: string; name: string } | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const list = useMemo(() => (r.faculties.data ?? []).map(f => ({ ...f, programs: f.programs.filter(p => !query.trim() || p.name.toLowerCase().includes(query.toLowerCase()) || p.abbreviation.toLowerCase().includes(query.toLowerCase())) })).filter(f => !query.trim() || f.name.toLowerCase().includes(query.toLowerCase()) || f.programs.length), [r.faculties.data, query]);
  const run = async () => {
    if (!confirm) return;
    try {
      const res = confirm.kind === 'faculty' ? await r.deleteFaculty.mutateAsync(confirm.id) : await r.deleteProgram.mutateAsync(confirm.id);
      if (res.blockedBy) setBlocked(res.blockedBy); else toast(`${confirm.kind === 'faculty' ? 'Faculty' : 'Program'} deleted`, 'success');
    } catch (e) { toast(errorMessage(e), 'error'); }
    setConfirm(null);
  };
  return (
    <Screen testID="faculties" header={<ScreenHeader />}>
      <Stack>
        <Text variant="displayMd" style={{ textTransform: 'uppercase' }}>Manage Faculties & Programs</Text>
        <Text variant="body">Manage faculties, programs, and their settings.</Text>
        {isMockMode() ? <InfoBanner tone="gold" icon="ShieldAlert" text="Registry screens are enabled by a demo capability flag. Production authorization must be confirmed and enforced by the backend." /> : null}
        <Row><Button title="+ Create Faculty" style={{ flex: 1 }} onPress={() => navigation.navigate(Routes.InstructorAddFaculty)} testID="fac-create" /><Button title="+ Create Program" variant="outline" style={{ flex: 1, borderColor: colors.coral500 }} onPress={() => navigation.navigate(Routes.InstructorAddProgram)} testID="prog-create" /></Row>
        <Input placeholder="Search faculties or programs..." leftIcon="Search" value={query} onChangeText={setQuery} testID="fac-search" />
        {r.faculties.isLoading ? <LoadingState /> : r.faculties.error ? <ErrorState error={r.faculties.error} onRetry={() => r.faculties.refetch()} /> : !list.length ? <EmptyState icon="Building2" title="No faculties match" /> : list.map((f, i) => (
          <Accordion key={f.id} title={f.name.toUpperCase()} titleVariant="displayXs" subtitle={`${f.status === 'active' ? '● Active' : '○ Inactive'} • ${f.programs.length} Programs`} initiallyOpen={i === 0} testID={`fac-${f.id}`}>
            <Row justify="space-between" style={styles.actions}><Text variant="overline">Faculty actions</Text><Row><Button title="Edit" variant="outline" size="sm" fullWidth={false} onPress={() => navigation.navigate(Routes.InstructorAddFaculty, { facultyId: f.id })} testID={`fac-edit-${f.id}`} /><Button title="Delete" variant="outline" size="sm" fullWidth={false} style={{ borderColor: colors.danger600 }} onPress={() => setConfirm({ kind: 'faculty', id: f.id, name: f.name })} testID={`fac-delete-${f.id}`} /></Row></Row>
            {f.programs.map(p => (
              <Card key={p.id} tone="muted" padding={spacing.md} testID={`prog-${p.id}`}>
                <Text variant="titleSm">{p.name}</Text>
                <Row style={{ marginTop: 6 }}><Pill label={p.abbreviation} tone="grey" small /><Pill label={p.status === 'active' ? 'Active' : 'Inactive'} tone={p.status === 'active' ? 'green' : 'grey'} small dot /></Row>
                <View style={styles.dashed} />
                <Row justify="flex-end"><Button title="Settings" variant="subtle" size="sm" fullWidth={false} icon={<Icon name="Settings" size={14} color={colors.green900} />} onPress={() => navigation.navigate(Routes.InstructorAddProgram, { programId: p.id })} testID={`prog-settings-${p.id}`} /><Button title="Delete" variant="ghost" size="sm" fullWidth={false} icon={<Icon name="Trash2" size={14} color={colors.danger600} />} onPress={() => setConfirm({ kind: 'program', id: p.id, name: p.name })} testID={`prog-delete-${p.id}`} /></Row>
              </Card>
            ))}
            {!f.programs.length ? <Text variant="caption">No programs in this faculty.</Text> : null}
            <Button title="+ Add program to this faculty" variant="ghost" size="sm" onPress={() => navigation.navigate(Routes.InstructorAddProgram, { facultyId: f.id })} />
          </Accordion>
        ))}
        <DemoLabel text="Dependency-aware deletion: referenced entities block deletion" />
      </Stack>
      <ConfirmSheet visible={!!confirm} onClose={() => setConfirm(null)} onConfirm={run} destructive loading={r.deleteFaculty.isPending || r.deleteProgram.isPending} title={`Delete ${confirm?.kind}?`} message={`"${confirm?.name}" will be removed if nothing references it. Programs with enrolled students and faculties with programs are blocked.`} confirmLabel="Delete" testID="fac-confirm" />
      <ConfirmSheet visible={!!blocked} onClose={() => setBlocked(null)} onConfirm={() => setBlocked(null)} title="Deletion blocked" icon="ShieldAlert" message={blocked ?? ''} confirmLabel="Understood" cancelLabel="Close" testID="fac-blocked" />
    </Screen>
  );
}

export function AddFacultyScreen({ navigation, route }: RootScreenProps<'InstructorAddFaculty'>) {
  const r = useRegistry();
  const existing = r.faculties.data?.find(f => f.id === route.params?.facultyId);
  const [name, setName] = useState(existing?.name ?? '');
  const [abbr, setAbbr] = useState(existing?.abbreviation ?? '');
  const [status, setStatus] = useState<'active' | 'inactive'>(existing?.status ?? 'active');
  const [touched, setTouched] = useState(false);
  const dirty = name !== (existing?.name ?? '') || abbr !== (existing?.abbreviation ?? '') || status !== (existing?.status ?? 'active');
  const { allowLeave } = useUnsavedChangesGuard(dirty);
  const errors = { name: !name.trim() ? 'Faculty name is required' : undefined, abbr: !abbr.trim() ? 'Abbreviation is required' : abbr.trim().length > 6 ? 'Use up to 6 characters' : undefined };
  const save = async () => {
    setTouched(true);
    if (errors.name || errors.abbr) return;
    try { await r.saveFaculty.mutateAsync({ id: existing?.id, name: name.trim(), abbreviation: abbr.trim().toUpperCase(), status }); allowLeave(); toast('Faculty saved', 'success'); navigation.goBack(); } catch (e) { toast(errorMessage(e), 'error'); }
  };
  return (
    <Screen testID="add-faculty" header={<ScreenHeader />}>
      <Stack>
        <Text variant="displayLg">{existing ? 'Edit Faculty' : 'Add Faculty'}</Text>
        <Text variant="body">Configure institutional division parameters to organize academic departments.</Text>
        <Card>
          <Text variant="titleMd" style={styles.cardTitle}>Faculty details</Text>
          <Stack gap={spacing.sm}>
            <Input label="Faculty Name" required placeholder="e.g., Faculty of Arts & Sciences" helper="English" value={name} onChangeText={setName} error={touched ? errors.name : undefined} testID="fac-name" />
            <Input label="Faculty Abbreviation" required placeholder="e.g., FAS" helper="English" autoCapitalize="characters" value={abbr} onChangeText={setAbbr} error={touched ? errors.abbr : undefined} testID="fac-abbr" />
            <Select label="Active / Inactive" value={status} onChange={setStatus} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} helper="Status determines visibility across student enrollment catalogs" testID="fac-status" />
          </Stack>
        </Card>
        <Button title="Save Faculty" onPress={save} loading={r.saveFaculty.isPending} testID="fac-save" />
        <Button title="Cancel" variant="outline" onPress={() => navigation.goBack()} testID="fac-cancel" />
      </Stack>
    </Screen>
  );
}

type SectionKey = 'delivery' | 'enrolmentConditions' | 'calculations' | 'academicStanding' | 'graduation' | 'chairAccess' | 'permissions' | 'designations';

/** Inner fields for the collapsed sections were NOT supplied – minimal coherent demo controls (see DESIGN_DECISIONS). */
const SECTION_DEFAULTS: Record<SectionKey, Record<string, string | boolean | number>> = {
  delivery: { mode: 'In person', campus: '#110 Heritage College- Surrey', durationMonths: 12 },
  enrolmentConditions: { minimumAge: 18, englishTestRequired: true, intakeTerms: 'Fall, Winter' },
  calculations: { gpaScale: '4.0', passingGrade: 60, creditsRequired: 27 },
  academicStanding: { probationBelowGpa: 2.0, dismissalAfterProbations: 2 },
  graduation: { minimumGpa: 2.0, capstoneRequired: true, residencyCredits: 15 },
  chairAccess: { chairName: '', leadName: '', canApproveGrades: true },
  permissions: { instructorsCanEditContent: true, advisorsCanViewFinance: false },
  designations: { honoursThreshold: 85, distinctionLabel: 'Distinction' },
};
const SECTION_TITLES: Record<SectionKey, string> = { delivery: 'Program Delivery Settings', enrolmentConditions: 'Program Enrolment Conditions', calculations: 'Program Calculations & Statistical Details', academicStanding: 'Program Academic Standing Settings', graduation: 'Program Graduation Conditions', chairAccess: 'Program Chair & Lead Accesses', permissions: 'Program Permissions', designations: 'Designations' };

export function AddProgramScreen({ navigation, route }: RootScreenProps<'InstructorAddProgram'>) {
  const r = useRegistry();
  const types = useProgramTypes();
  const existing = r.faculties.data?.flatMap(f => f.programs).find(p => p.id === route.params?.programId);
  const [facultyId, setFacultyId] = useState(existing?.facultyId ?? route.params?.facultyId ?? '');
  const [name, setName] = useState(existing?.name ?? '');
  const [legalName, setLegalName] = useState(existing?.legalName ?? '');
  const [abbr, setAbbr] = useState(existing?.abbreviation ?? '');
  const [typeId, setTypeId] = useState(existing?.programTypeId ?? '');
  const [status, setStatus] = useState<'active' | 'inactive'>(existing?.status ?? 'active');
  const [sections, setSections] = useState<Record<SectionKey, Record<string, string | boolean | number>>>(() => Object.fromEntries((Object.keys(SECTION_DEFAULTS) as SectionKey[]).map(k => [k, { ...SECTION_DEFAULTS[k], ...((existing?.[k] as Record<string, string | boolean | number>) ?? {}) }])) as Record<SectionKey, Record<string, string | boolean | number>>);
  const [touched, setTouched] = useState(false);
  const { allowLeave } = useUnsavedChangesGuard(touched);
  const errors = { facultyId: !facultyId ? 'Select a faculty' : undefined, name: !name.trim() ? 'Program name is required' : undefined };
  const setField = (k: SectionKey, f: string, v: string | boolean | number) => { setTouched(true); setSections(s => ({ ...s, [k]: { ...s[k], [f]: v } })); };
  const save = async () => {
    setTouched(true);
    if (errors.facultyId || errors.name) { toast('Fill in the required fields', 'error'); return; }
    try {
      const payload: Omit<AcademicProgram, 'id'> & { id?: string } = { id: existing?.id, facultyId, name: name.trim(), legalName: legalName.trim() || undefined, abbreviation: abbr.trim().toUpperCase() || name.trim().slice(0, 4).toUpperCase(), programTypeId: typeId || undefined, status, ...sections };
      await r.saveProgram.mutateAsync(payload); allowLeave(); toast('Program saved', 'success'); navigation.goBack();
    } catch (e) { toast(errorMessage(e), 'error'); }
  };
  return (
    <Screen testID="add-program" header={<ScreenHeader />} footer={<Row><Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => navigation.goBack()} testID="prog-cancel" /><Button title="Save Program" style={{ flex: 1.3 }} onPress={save} loading={r.saveProgram.isPending} testID="prog-save" /></Row>}>
      <Stack>
        <Text variant="displayMd" style={{ textTransform: 'uppercase' }}>{existing ? 'Program Settings' : 'Add Program'}</Text>
        <Text variant="body">Create a new academic program and configure degree rules.</Text>
        <Accordion title="Program Details" dot initiallyOpen testID="prog-sec-details">
          <Stack gap={spacing.sm}>
            <Select label="Program Faculty" required value={facultyId || undefined} onChange={v => { setFacultyId(v); setTouched(true); }} placeholder="-- Select Faculty --" options={(r.faculties.data ?? []).map(f => ({ value: f.id, label: f.name }))} error={touched ? errors.facultyId : undefined} testID="prog-faculty" />
            <Input label="Program Name" required placeholder="e.g., Certificate in Accounting" helper="English" value={name} onChangeText={t => { setName(t); setTouched(true); }} error={touched ? errors.name : undefined} testID="prog-name" />
            <Input label="Legal Program Name" placeholder="e.g., Certificate in Accounting and Payroll" helper="English" value={legalName} onChangeText={t => { setLegalName(t); setTouched(true); }} testID="prog-legal" />
            <Input label="Abbreviation" placeholder="E.G., CAPA" helper="English" autoCapitalize="characters" value={abbr} onChangeText={t => { setAbbr(t); setTouched(true); }} testID="prog-abbr" />
            <Select label="Program Type" value={typeId || undefined} onChange={v => { setTypeId(v); setTouched(true); }} placeholder="-- Select Program Type --" options={(types.data ?? []).map(t => ({ value: t.id, label: `${t.name} (${t.abbreviation})` }))} testID="prog-type" />
            <Select label="Active / Inactive" value={status} onChange={v => { setStatus(v); setTouched(true); }} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} testID="prog-status" />
          </Stack>
        </Accordion>
        {(Object.keys(SECTION_TITLES) as SectionKey[]).map(k => (
          <Accordion key={k} title={SECTION_TITLES[k]} dot testID={`prog-sec-${k}`}>
            {isMockMode() ? <InfoBanner tone="grey" icon="FlaskConical" text="Inner fields for this section were not supplied in the reference designs. These are minimal demo controls, not institutional rules." /> : null}
            {Object.entries(sections[k]).map(([f, v]) => {
              const label = f.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
              if (typeof v === 'boolean') return <Toggle key={f} label={label} value={v} onChange={val => setField(k, f, val)} testID={`prog-${k}-${f}`} />;
              return <Input key={f} label={label} value={String(v)} keyboardType={typeof v === 'number' ? 'decimal-pad' : 'default'} onChangeText={t => setField(k, f, typeof v === 'number' ? Number(t) || 0 : t)} testID={`prog-${k}-${f}`} />;
            })}
          </Accordion>
        ))}
        {existing ? <Card tone="muted"><KeyValueRow label="Program ID" value={existing.id} border={false} /></Card> : null}
        <DemoLabel text="Collapsed-section fields are inferred demo controls" />
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({ actions: { backgroundColor: colors.surfaceMuted, marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }, dashed: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.border, marginVertical: spacing.sm }, cardTitle: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.sm, marginBottom: spacing.sm } });
