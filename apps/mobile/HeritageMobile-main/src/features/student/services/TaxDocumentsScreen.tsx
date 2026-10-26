import React, { useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, EmptyState, Icon, KeyValue, InfoBanner, DemoLabel, Select } from '../../../components';
import { colors, spacing } from '../../../theme';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import type { TaxDocument } from '../../../domain/types';
import { useTaxDocuments } from '../records/useRecords';
import { formatDate, formatMoney } from '../../../utils/format';
import { useFileActions } from '../../shared/useFileActions';
import { useServices } from '../../../app/ServicesProvider';
import { isMockMode } from '../../../config/appConfig';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';

export function TaxDocumentsScreen({ navigation }: RootScreenProps<'StudentTaxDocuments'>) {
  const q = useTaxDocuments();
  const s = useServices();
  const files = useFileActions();
  const [idx, setIdx] = useState(0);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const docs = q.data ?? [];
  const sel = docs[idx];
  const available = docs.filter(d => d.status === 'available');
  const mock = isMockMode();
  const live = (d: TaxDocument) => Boolean(s.documents.downloadTaxPdf && d.pdfPath);
  const openPdf = async (d: TaxDocument) => {
    if (!s.documents.downloadTaxPdf) return;
    setPdfBusy(d.id);
    try { const path = await s.documents.downloadTaxPdf(d); await files.viewPath(path, 'application/pdf', `${d.form} — ${d.year}`); } catch (e) { toast(errorMessage(e), 'error'); } finally { setPdfBusy(null); }
  };
  return (
    <Screen testID="tax-documents" header={<ScreenHeader />}>
      {q.isLoading ? <LoadingState /> : !mock && !q.error && !sel ? <EmptyState icon="FileX" title="No tax documents yet" message="T2202 slips appear here once Campus One issues them." /> : q.error || !sel ? <ErrorState error={q.error ?? new Error('No tax documents')} onRetry={() => q.refetch()} /> : (
        <Stack>
          <Text variant="displayLg">Tax Documents / Forms</Text>
          <Text variant="body">{mock ? 'Inspect and download SAMPLE T2202 slips. Nothing here is a legally valid tax document.' : 'Official T2202 tuition slips issued by Campus One. Open a slip to view, save or share the PDF.'}</Text>
          <Card><Row>{[['Slips', `${available.length}`, 'Available'], ['Tax year', String(Math.max(...docs.map(d => d.year))), 'Latest'], mock ? ['Status', 'Sample', 'Not CRA-issued'] : ['Status', 'Issued', 'By Campus One']].map(([a, b, c]) => <View key={String(a)} style={styles.stat}><Text variant="overline">{a}</Text><Text variant="titleMd" color={colors.green900}>{b}</Text><Text variant="caption">{c}</Text></View>)}</Row></Card>
          <Card>
            <Row justify="space-between"><Text variant="overline">{mock ? 'Self-service issuance (demo)' : 'Self-service issuance'}</Text><Icon name="FileText" size={18} color={colors.green700} /></Row>
            <Text variant="displaySm" style={{ marginVertical: 4 }}>Generate Tax Document</Text>
            <Text variant="bodySm">{mock ? 'Select a sample tax slip to inspect synthetic tuition details and open the sample PDF.' : 'Select a tax year to view the slip details and open the official PDF.'}</Text>
            <Row justify="space-between" style={{ marginTop: spacing.sm }}><Text variant="label">Tax Document / Form</Text><Text variant="caption">{mock ? 'Sample slip' : 'T2202'}</Text></Row>
            <Select value={sel.id} onChange={id => setIdx(docs.findIndex(d => d.id === id))} options={docs.map(d => ({ value: d.id, label: `${d.form} — ${d.year}`, description: d.status === 'archived' ? 'Archived' : mock ? 'Tuition and Enrolment Certificate (sample)' : 'Tuition and Enrolment Certificate' }))} testID="tax-select" sheetTitle="Select year / form" />
            <View style={[styles.bar, { backgroundColor: sel.status === 'available' ? colors.success100 : colors.surfaceMuted }]}><Text variant="label" color={sel.status === 'available' ? colors.success600 : colors.inkSecondary}>• {sel.status === 'available' ? (mock ? 'Available (sample)' : 'Available') : 'Archived'}</Text><Text variant="caption">Issued: {formatDate(sel.issuedAt)}</Text></View>
            <Card tone="muted" padding={spacing.md}>
              <Row justify="space-between"><Text variant="overline">Document summary</Text>{mock ? <Pill label="Synthetic values" tone="gold" small /> : null}</Row>
              <Row wrap gap={spacing.md} style={{ marginTop: spacing.sm }}>
                <KeyValue label="Designation" value={`Form ${sel.form}`} style={styles.kv} />
                <KeyValue label="Reporting term" value={sel.reportingTerm} style={styles.kv} />
                {sel.eligibleTuition !== undefined ? <KeyValue label="Eligible tuition" value={formatMoney(sel.eligibleTuition)} style={styles.kv} /> : null}
                {sel.fullTimeMonths !== undefined ? <KeyValue label="Full-time months" value={`${sel.fullTimeMonths} Months`} style={styles.kv} /> : null}
              </Row>
              <Text variant="caption" style={{ marginTop: spacing.sm }}>{mock ? 'A real T2202 reports eligible tuition fees and qualifying months for Canadian income tax purposes. This demo slip is a placeholder and must not be filed.' : 'The T2202 reports eligible tuition fees and qualifying months for Canadian income tax purposes. Use the official PDF when filing.'}</Text>
            </Card>
            {live(sel) || mock ? <Button title={live(sel) ? 'Download / Open PDF' : 'Download / Open sample PDF'} icon={<Icon name="Download" size={16} color={colors.white} />} style={{ marginTop: spacing.md }} loading={live(sel) ? pdfBusy === sel.id : files.busy === 'view:tax'} onPress={() => (live(sel) ? openPdf(sel) : files.view('tax'))} testID="tax-open" /> : null}
          </Card>
          <Row justify="space-between"><View><Text variant="titleSm">Available Tax Documents</Text><Text variant="caption">{mock ? 'Historical & current sample certificates' : 'Historical & current certificates'}</Text></View><View style={styles.circle}><Text variant="label">{docs.length} Records</Text></View></Row>
          {docs.map(d => (
            <Card key={d.id} padding={spacing.md} testID={`tax-${d.id}`}>
              <Row gap={spacing.md}>
                <View style={[styles.tile, d.status === 'archived' ? { backgroundColor: colors.surfaceMuted } : null]}><Icon name={d.status === 'archived' ? 'History' : 'FileText'} size={20} color={colors.green900} /></View>
                <View style={{ flex: 1 }}><Text variant="bodyStrong">{d.form} Tuition & Enrolment</Text><Text variant="caption">Tax Year {d.year} • {formatDate(d.issuedAt, { dot: true })}</Text></View>
                <Pill label={d.status === 'available' ? 'Available' : 'Archived'} tone={d.status === 'available' ? 'green' : 'grey'} small />
              </Row>
              {live(d) || mock ? <Row justify="space-between" style={{ marginTop: spacing.sm }}><Text variant="caption">PDF Document • {d.sizeLabel}{live(d) ? '' : ' (sample)'}</Text><Pressable accessibilityRole="button" disabled={pdfBusy === d.id} onPress={() => (live(d) ? openPdf(d) : files.download('tax', `T2202-${d.year}-SAMPLE.pdf`))} testID={`tax-get-${d.id}`}><Text variant="label" color={colors.green900}>{live(d) ? (pdfBusy === d.id ? 'Downloading…' : 'Get PDF →') : 'Get sample PDF →'}</Text></Pressable></Row> : null}
            </Card>
          ))}
          <InfoBanner tone="gold" icon="Info" title={mock ? 'Tax notice (demo)' : 'Tax notice'} text={mock ? 'Real T2202 certificates are issued by the institution under the Income Tax Act. This app only shows sample files; verify your details with Student Accounts before filing.' : 'T2202 certificates are issued by Campus One under the Income Tax Act. Verify your details with Student Accounts before filing.'} />
          <Button title="Need tax slip assistance? Contact Student Accounts ›" variant="ghost" size="sm" onPress={() => navigation.navigate(Routes.MailCompose, mock ? { toId: 'c_accounts', subject: 'Tax slip assistance' } : { subject: 'Tax slip assistance' })} testID="tax-contact" />
          <DemoLabel text="NOT A LEGALLY VALID TAX SLIP" />
        </Stack>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 8, padding: spacing.sm, marginVertical: spacing.sm },
  kv: { width: '45%' },
  circle: { backgroundColor: colors.green50, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  tile: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.green50, alignItems: 'center', justifyContent: 'center' },
});
