import React, { useState } from 'react';
import { View } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, Icon, IconTile, StatTile, InfoBanner, LoadingState, ErrorState, EmptyState } from '../../components';
import { colors, spacing } from '../../theme';
import type { ApplicantTabProps } from '../../navigation/types';
import { pickAttachment, removeLocalCopy } from '../shared/files';
import { APPLICANT_UPLOAD_MAX_BYTES, APPLICANT_UPLOAD_MIME } from '../../services/api/applicant';
import { toast } from '../../state/uiStore';
import { errorMessage } from '../../services/errors';
import { useApplicantMutations, useApplicantService, useApplicationForm } from './useApplicant';
import { ApplicantUnavailable } from './ApplicantPortalScreens';
import { statusTone } from './PortalViewContent';

const EXTENSIONS = Object.keys(APPLICANT_UPLOAD_MIME);

export function ApplicantDocumentsScreen(_props: ApplicantTabProps<'ApplicantDocumentsTab'>) {
  const svc = useApplicantService();
  const form = useApplicationForm();
  const m = useApplicantMutations();
  const [busyId, setBusyId] = useState<string | null>(null);

  const upload = async (documentId: string, label: string) => {
    const picked = await pickAttachment({ maxBytes: APPLICANT_UPLOAD_MAX_BYTES, extensions: EXTENSIONS });
    if (picked.status === 'cancelled') return;
    if (picked.status === 'error') { toast(picked.message, 'error'); return; }
    setBusyId(documentId);
    try {
      await m.upload.mutateAsync({ documentId, file: picked.attachment });
      await form.refetch();
      toast(`${label} uploaded`, 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusyId(null);
      void removeLocalCopy(picked.attachment.uri);
    }
  };

  const docs = form.data?.documents ?? [];
  const uploaded = docs.filter(d => d.status !== 'missing' && d.status !== 'rejected').length;
  const accepted = docs.filter(d => d.status === 'accepted').length;
  return (
    <Screen testID="applicant-documents" bottomInset={false} header={<ScreenHeader title="Documents" subtitle="Your admissions document packet" hideBack />} refreshing={form.isRefetching} onRefresh={() => form.refetch()}>
      {!svc ? <ApplicantUnavailable /> : form.isLoading ? <LoadingState /> : form.error ? <ErrorState error={form.error} onRetry={() => form.refetch()} /> : (
        <Stack>
          <Row align="stretch">
            <StatTile label="Required" value={docs.length} style={{ flex: 1 }} />
            <StatTile label="Uploaded" value={uploaded} style={{ flex: 1 }} />
            <StatTile label="Accepted" value={accepted} style={{ flex: 1 }} />
          </Row>
          <InfoBanner tone="grey" icon="ShieldCheck" text="Upload PDF, Word (.doc/.docx), PNG or JPEG files up to 10 MB. Campus One never asks for a passport, SIN or other government ID." />
          {!docs.length ? <EmptyState icon="FileX" title="No documents requested" message="Admissions will add your checklist here." /> : docs.map(d => {
            const canUpload = d.status !== 'accepted';
            const missing = d.status === 'missing' || d.status === 'rejected';
            return (
              <Card key={d.id} testID={`applicant-doc-${d.id}`}>
                <Row gap={spacing.md}>
                  <IconTile icon={missing ? 'FileUp' : 'FileCheck'} bg={missing ? colors.coral50 : colors.green50} color={missing ? colors.coral600 : colors.green900} />
                  <View style={{ flex: 1 }}>
                    <Text variant="titleSm">{d.label}</Text>
                    <Text variant="caption">{d.status === 'missing' ? 'Not uploaded' : d.fileName ?? 'File on record'}</Text>
                  </View>
                  <Pill label={d.status.replace(/_/g, ' ')} tone={statusTone(d.status)} small dot />
                </Row>
                {canUpload ? (
                  <Button
                    title={missing ? 'Upload' : 'Replace file'}
                    variant={missing ? 'primary' : 'outline'}
                    size="sm"
                    style={{ marginTop: spacing.sm }}
                    icon={<Icon name="Upload" size={14} color={missing ? colors.white : colors.green900} />}
                    loading={busyId === d.id}
                    disabled={!!busyId}
                    onPress={() => void upload(d.id, d.label)}
                    testID={`applicant-doc-upload-${d.id}`}
                  />
                ) : null}
              </Card>
            );
          })}
        </Stack>
      )}
    </Screen>
  );
}
