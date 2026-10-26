import React, { useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, EmptyState, Icon, Input, DateField, BottomSheet, Select, DemoLabel, StatTile } from '../../../components';
import { colors, spacing } from '../../../theme';
import { isMockMode } from '../../../config/appConfig';
import type { RootScreenProps } from '../../../navigation/types';
import { useDocuments, useRecordMutations } from '../records/useRecords';
import { formatDate } from '../../../utils/format';
import { useFileActions } from '../../shared/useFileActions';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';

export function DocumentsScreen(_props: RootScreenProps<'StudentDocuments'>) {
  const docs = useDocuments();
  const files = useFileActions();
  const m = useRecordMutations();
  const [name, setName] = useState('');
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [letter, setLetter] = useState(false);
  const [purpose, setPurpose] = useState('');
  const [details, setDetails] = useState('');
  const list = useMemo(() => (docs.data ?? []).filter(d => (!name.trim() || d.title.toLowerCase().includes(name.toLowerCase())) && (!from || d.issuedAt >= from) && (!to || d.issuedAt <= to)), [docs.data, name, from, to]);
  return (
    <Screen testID="documents-screen" header={<ScreenHeader />}>
      {docs.isLoading ? <LoadingState /> : docs.error ? <ErrorState error={docs.error} onRetry={() => docs.refetch()} /> : (
        <Stack>
          <Text variant="displayLg">My Documents</Text>
          <Text variant="body">{isMockMode() ? 'Access and download your institutional student documents (sample files in this demo).' : 'Access and download your institutional student documents.'}</Text>
          <Row><StatTile label="Total documents" value={docs.data?.length ?? 0} icon="FileText" />{isMockMode() ? <StatTile label="Status" value="Sample" sub="Demo files · not registrar-verified" icon="ShieldCheck" accent={colors.gold600} /> : <StatTile label="Available" value={(docs.data ?? []).filter(d => d.status === 'available').length} icon="ShieldCheck" />}</Row>
          <Card padding={spacing.md}>
            <Input label="Filter document name" placeholder="Search by name" leftIcon="Search" value={name} onChangeText={setName} testID="docs-search" />
            <Row style={{ marginTop: spacing.sm }}><View style={{ flex: 1 }}><DateField label="From date" value={from} onChange={setFrom} testID="docs-from" /></View><View style={{ flex: 1 }}><DateField label="To date" value={to} onChange={setTo} testID="docs-to" /></View></Row>
            {from || to || name ? <Button title="Clear filters" variant="ghost" size="sm" onPress={() => { setFrom(undefined); setTo(undefined); setName(''); }} /> : null}
          </Card>
          <Row justify="space-between"><Text variant="overline">Available documents ({list.length})</Text>{isMockMode() ? <Pill label="All updated" tone="green" small /> : null}</Row>
          {!list.length ? <EmptyState icon="FileX" title="No documents match" /> : list.map(d => (
            <Card key={d.id} testID={`doc-${d.id}`}>
              <Row gap={spacing.md}>
                <View style={styles.tile}><Icon name={d.type === 'Campus ID' ? 'IdCard' : d.type === 'Official letter' ? 'Mail' : 'BookOpen'} size={20} color={colors.green900} /></View>
                <View style={{ flex: 1 }}><Text variant="titleSm">{d.title}</Text>{d.issuedAt ? <Text variant="caption">{formatDate(d.issuedAt, { dot: true, weekday: true })}</Text> : null}</View>
                {d.type ? <Pill label={d.type} tone="grey" small /> : null}
              </Row>
              <Row justify="space-between" style={{ marginTop: spacing.sm }}>
                <Pill label={d.status} tone={d.status === 'available' ? 'green' : 'grey'} small dot />
                {isMockMode() && d.sampleAsset ? <Row>
                  <Button title="View" variant="outline" size="sm" fullWidth={false} onPress={() => files.view(d.sampleAsset!)} loading={files.busy === `view:${d.sampleAsset}`} testID={`doc-view-${d.id}`} />
                  <Button title="Download" size="sm" fullWidth={false} icon={<Icon name="Download" size={14} color={colors.white} />} onPress={() => files.download(d.sampleAsset!, `${d.title.replace(/\s+/g, '-')}-SAMPLE.${d.sampleAsset === 'idcard' ? 'png' : 'pdf'}`)} loading={files.busy === `download:${d.sampleAsset}`} testID={`doc-download-${d.id}`} />
                </Row> : d.url ? <Button title="Open" size="sm" fullWidth={false} icon={<Icon name="ExternalLink" size={14} color={colors.white} />} onPress={() => Linking.openURL(d.url!).catch(() => toast('Could not open this document.', 'error'))} testID={`doc-view-${d.id}`} /> : null}
              </Row>
            </Card>
          ))}
          <Card tone="gold">
            <Text variant="overline" style={{ marginBottom: 4 }}>{isMockMode() ? 'Registrar documents (demo)' : 'Registrar documents'}</Text>
            <Text variant="caption">{isMockMode() ? 'Exported files are locally generated samples without cryptographic verification. Request a special verification letter to create a mock registrar request.' : 'Need an official verification letter? Send a request to the Registrar.'}</Text>
            <Button title="Request Special Verification Letter ›" variant="ghost" size="sm" onPress={() => setLetter(true)} testID="docs-request-letter" />
          </Card>
          <DemoLabel text="Sample PDFs bundled with the app" />
        </Stack>
      )}
      <BottomSheet visible={letter} onClose={() => setLetter(false)} title="Special verification letter" subtitle={isMockMode() ? 'Creates a mock registrar request' : 'Sends a request to the Registrar'} testID="letter-sheet">
        <Select label="Purpose" required value={purpose} onChange={setPurpose} placeholder="Select purpose" options={[{ value: 'Study permit', label: 'Study permit' }, { value: 'Employer verification', label: 'Employer verification' }, { value: 'Bank / housing', label: 'Bank / housing' }, { value: 'Other', label: 'Other' }]} testID="letter-purpose" />
        <Input label="Details" placeholder="Who should the letter be addressed to?" multiline value={details} onChangeText={setDetails} testID="letter-details" />
        <Button title="Submit request" disabled={!purpose} disabledReason="Choose a purpose" loading={m.requestLetter.isPending} testID="letter-submit" onPress={async () => { try { await m.requestLetter.mutateAsync({ purpose, details }); toast('Letter request recorded (pending)', 'success'); setLetter(false); setPurpose(''); setDetails(''); } catch (e) { toast(errorMessage(e), 'error'); } }} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({ tile: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.green50, alignItems: 'center', justifyContent: 'center' } });
