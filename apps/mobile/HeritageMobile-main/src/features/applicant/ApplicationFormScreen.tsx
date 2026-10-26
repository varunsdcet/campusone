import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, Input, Select, DateField, Accordion, ProgressBar, StatTile, InfoBanner, ConfirmSheet, LoadingState, ErrorState, ListRow } from '../../components';
import { spacing } from '../../theme';
import { Routes } from '../../navigation/routes';
import type { ApplicantTabProps } from '../../navigation/types';
import { useAppNavigation, navigateTo } from '../../navigation/hooks';
import type { ApplicationField, ApplicationForm, ApplicationSection } from '../../services/contracts/applicant';
import { toast } from '../../state/uiStore';
import { errorMessage } from '../../services/errors';
import { formatTime } from '../../utils/format';
import { useApplicantMutations, useApplicantService, useApplicationForm } from './useApplicant';
import { ApplicantUnavailable } from './ApplicantPortalScreens';
import { statusLabel, statusTone } from './PortalViewContent';

const SECTIONS: { id: ApplicationSection; title: string; hint: string }[] = [
  { id: 'personal', title: 'Personal details', hint: 'Your legal name, contact details and residency.' },
  { id: 'academic', title: 'Academic history', hint: 'The highest level of education you have completed.' },
  { id: 'program', title: 'Program choice', hint: 'The program and intake you are applying for.' },
];

function optionsOf(f: ApplicationField, form: ApplicationForm) {
  return (f.dynamic === 'programs' ? form.options.programs : f.dynamic === 'intakes' ? form.options.intakes : f.options) ?? [];
}

function FieldInput({ f, form, value, onChange, disabled }: { f: ApplicationField; form: ApplicationForm; value: string; onChange: (v: string) => void; disabled: boolean }) {
  const testID = `app-field-${f.key}`;
  const opts = optionsOf(f, form);
  if (f.kind === 'select' && (opts.length || !f.dynamic)) {
    const all = value && !opts.includes(value) ? [value, ...opts] : opts;
    if (disabled) return <Input label={f.label} required={f.required} value={value} editable={false} testID={testID} />;
    return <Select label={f.label} required={f.required} value={value} onChange={onChange} placeholder="Select…" options={all.map(o => ({ value: o, label: o }))} testID={testID} />;
  }
  if (f.kind === 'date' && !disabled) return <DateField label={f.label} required={f.required} value={value || undefined} onChange={onChange} maximumDate={new Date()} testID={testID} />;
  return (
    <Input
      label={f.label}
      required={f.required}
      value={value}
      onChangeText={onChange}
      editable={!disabled}
      maxLength={f.kind === 'year' ? 4 : f.max}
      keyboardType={f.kind === 'email' ? 'email-address' : f.kind === 'tel' ? 'phone-pad' : f.kind === 'year' ? 'number-pad' : 'default'}
      autoCapitalize={f.kind === 'email' ? 'none' : 'words'}
      autoCorrect={false}
      placeholder={f.kind === 'year' ? 'YYYY' : f.dynamic ? 'Enter the program name you are interested in' : undefined}
      testID={testID}
    />
  );
}

export function ApplicationFormScreen(_props: ApplicantTabProps<'ApplicantApplicationTab'>) {
  const svc = useApplicantService();
  const navigation = useAppNavigation();
  const form = useApplicationForm();
  const m = useApplicantMutations();
  const [values, setValues] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (form.data && !dirty) setValues(form.data.values);
  }, [form.data, dirty]);

  const set = (key: string, v: string) => {
    setValues(s => ({ ...s, [key]: v }));
    setDirty(true);
    setProblem(null);
  };

  const save = async (quiet?: boolean) => {
    setProblem(null);
    try {
      const out = await m.saveForm.mutateAsync(values);
      setValues(out.values);
      setDirty(false);
      if (!quiet) toast(`Saved at ${formatTime(out.savedAt ? new Date(out.savedAt) : new Date())}`, 'success');
      return out;
    } catch (e) {
      setProblem(errorMessage(e));
      return null;
    }
  };

  const startSubmit = async () => {
    const saved = dirty ? await save(true) : form.data;
    if (!saved) return;
    if (saved.completeness.missing.length) {
      setProblem(`Complete these before submitting: ${saved.completeness.missing.join('; ')}`);
      return;
    }
    setConfirm(true);
  };

  const submit = async () => {
    try {
      await m.action.mutateAsync({ action: 'submit_application', path: '/applicant/application' });
      await form.refetch();
      setConfirm(false);
      toast('Application submitted. Admissions will be in touch.', 'success');
    } catch (e) {
      setConfirm(false);
      setProblem(errorMessage(e));
    }
  };

  const data = form.data;
  const busy = m.saveForm.isPending || m.action.isPending;
  const c = data?.completeness;
  const docsUploaded = data?.documents.filter(d => d.status !== 'missing' && d.status !== 'rejected').length ?? 0;
  return (
    <Screen
      testID="applicant-application"
      bottomInset={false}
      header={<ScreenHeader title="Application" subtitle={values.programName ? `${values.programName}${values.intakeTerm ? ` · ${values.intakeTerm}` : ''}` : 'Admissions portal'} hideBack />}
      refreshing={form.isRefetching}
      onRefresh={dirty ? undefined : () => form.refetch()}
    >
      {!svc ? <ApplicantUnavailable /> : form.isLoading ? <LoadingState label="Loading your application…" /> : form.error ? <ErrorState error={form.error} onRetry={() => form.refetch()} /> : data && c ? (
        <Stack>
          <Row align="stretch">
            <StatTile label="Status" value={statusLabel(data.status)} style={{ flex: 1 }} />
            <StatTile label="Progress" value={`${c.pct}%`} sub={c.missing.length ? `${c.missing.length} left` : 'Ready'} style={{ flex: 1 }} />
            <StatTile label="Documents" value={`${docsUploaded}/${docsUploaded + c.documentsMissing.length}`} sub="uploaded" style={{ flex: 1 }} />
          </Row>
          <ProgressBar value={c.pct} />
          {problem ? <InfoBanner tone="coral" icon="TriangleAlert" text={problem} /> : null}
          {!data.editable ? <InfoBanner tone="green" icon="Lock" title="Submitted" text="This application was submitted and can no longer be edited. Follow its progress on the timeline." /> : null}
          {SECTIONS.map((s, idx) => {
            const state = c.sections[s.id];
            return (
              <Accordion
                key={s.id}
                title={s.title}
                subtitle={s.hint}
                initiallyOpen={data.editable && (idx === 0 || !state.done)}
                right={<Pill label={state.done ? 'Complete' : `${state.missing.length} to complete`} tone={state.done ? 'green' : 'gold'} small />}
                testID={`app-section-${s.id}`}
              >
                <Stack gap={spacing.sm}>
                  {s.id === 'program' && !data.options.programs.length ? <Text variant="caption">No programs are open for applications yet. Enter the program name you are interested in.</Text> : null}
                  {data.fields.filter(f => f.section === s.id).map(f => (
                    <FieldInput key={f.key} f={f} form={data} value={values[f.key] ?? ''} onChange={v => set(f.key, v)} disabled={!data.editable || busy} />
                  ))}
                </Stack>
              </Accordion>
            );
          })}
          <Card padding={spacing.md}>
            <Row justify="space-between"><Text variant="overline">Documents</Text><Pill label={c.documentsMissing.length ? `${c.documentsMissing.length} missing` : 'Complete'} tone={c.documentsMissing.length ? 'coral' : 'green'} small /></Row>
            {data.documents.map(d => (
              <ListRow key={d.id} title={d.label} subtitle={d.status === 'missing' ? 'Not uploaded' : d.fileName ?? 'File'} right={<Pill label={d.status.replace(/_/g, ' ')} tone={statusTone(d.status)} small />} chevron={false} />
            ))}
            <Button title="Upload documents" variant="outline" size="sm" onPress={() => navigateTo(navigation, Routes.ApplicantTabs, { screen: Routes.ApplicantDocumentsTab })} testID="app-open-documents" />
          </Card>
          {data.editable ? (
            <View style={{ gap: spacing.sm }}>
              <Button title={dirty ? 'Save progress' : 'Saved'} variant="outline" disabled={busy || !dirty} loading={m.saveForm.isPending && !confirm} onPress={() => void save()} testID="app-save" />
              <Button title="Submit application" disabled={busy} onPress={() => void startSubmit()} testID="app-submit" />
            </View>
          ) : (
            <Button title="View timeline" variant="outline" onPress={() => navigation.navigate(Routes.ApplicantTimeline)} testID="app-timeline" />
          )}
        </Stack>
      ) : null}
      <ConfirmSheet visible={confirm} onClose={() => setConfirm(false)} onConfirm={() => void submit()} title="Submit application?" message="Once submitted, your application can no longer be edited. Admissions will review your packet." confirmLabel="Submit" icon="Send" loading={m.action.isPending} testID="app-submit-sheet" />
    </Screen>
  );
}
