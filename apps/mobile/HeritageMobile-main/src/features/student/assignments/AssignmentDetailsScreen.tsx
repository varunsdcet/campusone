import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Pressable, ActivityIndicator } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, Icon, StatTile, KeyValueRow, InfoBanner, ProgressBar, BottomSheet, ListRow, ConfirmSheet, Input, DemoLabel, Toggle } from '../../../components';
import { colors, spacing } from '../../../theme';
import { Routes } from '../../../navigation/routes';
import type { RootScreenProps } from '../../../navigation/types';
import { useAssignment, useAssignmentMutations } from '../courses/useCourses';
import { formatDate, formatDateTime, daysUntil, formatBytes } from '../../../utils/format';
import { pickAttachment, canPreviewInApp, removeLocalCopy, viewFile, shareFile } from '../../shared/files';
import type { SubmissionAttachment } from '../../../domain/types';
import { appConfig, isMockMode } from '../../../config/appConfig';
import { toast } from '../../../state/uiStore';
import { errorMessage } from '../../../services/errors';
import { useServices } from '../../../app/ServicesProvider';
import { useUnsavedChangesGuard } from '../../shared/hooks';
import { statusBadge } from './AssignmentsScreen';
import { useSettings } from '../../auth/useAuth';

const LIVE_TYPES = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.png', '.jpg', '.jpeg', '.zip'];

export function AssignmentDetailsScreen({ navigation, route }: RootScreenProps<'StudentAssignmentDetails'>) {
  const { assignmentId } = route.params;
  const q = useAssignment(assignmentId);
  const m = useAssignmentMutations(assignmentId);
  const services = useServices();
  const settings = useSettings();
  const mock = isMockMode();
  const [attachments, setAttachments] = useState<SubmissionAttachment[]>([]);
  const [note, setNote] = useState('');
  const [dirty, setDirty] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [menu, setMenu] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [simulateFail, setSimulateFail] = useState(false);
  const { allowLeave } = useUnsavedChangesGuard(dirty, 'Your files or text are not saved as a draft. Discard the changes?');
  const a = q.data;
  useEffect(() => {
    if (a && !dirty) {
      setAttachments(a.submission?.attachments ?? []);
      setNote(a.submission?.note ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.submission?.updatedAt]);
  const rules = a?.rules;
  const windowOpen = rules ? rules.open : true;
  const editable = !a || ((a.derivedStatus === 'upcoming' || a.derivedStatus === 'draft') && windowOpen);
  const allowFiles = !rules || rules.fileSubmissions;
  const allowText = rules ? rules.onlineText : true;
  const max = rules ? rules.maxFiles ?? Infinity : appConfig.demo.attachmentMaxCount;
  const maxBytes = Math.min(rules?.maxFileBytes ?? appConfig.demo.attachmentMaxBytes, appConfig.demo.attachmentMaxBytes);
  const types = rules ? (rules.acceptedTypes.length ? rules.acceptedTypes : LIVE_TYPES) : undefined;
  const hasText = allowText && note.trim().length > 0;
  const canSubmit = attachments.length > 0 || (!mock && hasText);
  const addFile = async () => {
    const res = await pickAttachment({ maxBytes, extensions: types });
    if (res.status === 'cancelled') return;
    if (res.status === 'error') { toast(res.message, 'error'); return; }
    setAttachments(prev => (Number.isFinite(max) ? [...prev.slice(0, max - 1), res.attachment] : [...prev, res.attachment]));
    setDirty(true);
  };
  const removeFile = async (att: SubmissionAttachment) => {
    setAttachments(prev => prev.filter(x => x.id !== att.id));
    setDirty(true);
    if (att.uri) await removeLocalCopy(att.uri);
  };
  /** Local picks open directly; files already on the server are downloaded first. */
  const localPath = async (att: SubmissionAttachment) => {
    if (att.uri) return att.uri;
    if (!services.assignments.downloadAttachment) throw new Error('This file is not available on this device.');
    return services.assignments.downloadAttachment(att);
  };
  const openFile = async (att: SubmissionAttachment, share: boolean) => {
    setOpening(att.id);
    try {
      const path = await localPath(att);
      if (share) await shareFile(path, att.name);
      else await viewFile(path, att.mimeType, att.name);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setOpening(null);
    }
  };
  const saveDraft = async () => {
    setUploadError(null);
    try {
      await m.saveDraft.mutateAsync({ attachments, note });
      setDirty(false);
      toast('Draft saved', 'success');
    } catch (e) {
      setUploadError(errorMessage(e));
    }
  };
  const submit = async () => {
    setConfirm(false);
    setUploadError(null);
    setProgress(0);
    try {
      await m.submit.mutateAsync({ attachments, note, failUpload: simulateFail, onProgress: setProgress });
      setSimulateFail(false);
      setDirty(false);
      allowLeave();
      setProgress(null);
      toast('Submission received', 'success');
    } catch (e) {
      setProgress(null);
      setUploadError(errorMessage(e));
    }
  };
  const tz = settings.data?.timeZone;
  const badge = a ? statusBadge(a) : null;
  const closesAt = rules?.closesAt ?? a?.dueAt;
  const notOpenYet = Boolean(rules?.availableFrom && new Date(rules.availableFrom).getTime() > Date.now());
  const sub = a?.submission;
  const submittedFlow = sub && sub.status !== 'draft' && sub.submittedAt;
  return (
    <Screen testID="assignment-details" header={<ScreenHeader backLabel="All assignments" actions={a ? [{ label: 'Open course', accessibilityLabel: 'Open course', onPress: () => navigation.navigate(Routes.StudentCourseDetails, { sectionId: a.sectionId }), testID: 'assignment-open-course' }, { icon: 'EllipsisVertical', accessibilityLabel: 'More', onPress: () => setMenu(true) }] : []} />}>
      {q.isLoading ? <LoadingState /> : !a || !badge ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <Stack>
          <Card>
            <Stack gap={spacing.sm}>
              <Row justify="space-between"><Pill label={`${a.section.course.code} · ${a.section.course.title}`} tone="grey" small icon={<Icon name="GraduationCap" size={12} color={colors.inkSecondary} />} /><Pill label={badge.label} tone={badge.tone} small /></Row>
              <Text variant="displayMd" style={{ textTransform: 'uppercase' }}>{a.title}</Text>
              {a.description ? <Text variant="bodySm">{a.description}</Text> : null}
              <Row><StatTile label="Status" value={badge.label} sub={a.section.course.code} /><StatTile label="Points" value={a.points} sub="Maximum score" /></Row>
              <Row><StatTile label="Weight" value={`${a.weightPct}%`} sub="Course grade" /><StatTile label="Due date" value={a.dueAt ? formatDate(a.dueAt) : 'Not set'} sub={a.dueAt ? <Text variant="caption" color={daysUntil(a.dueAt) < 0 ? colors.danger600 : colors.coral600}>{formatDateTime(a.dueAt, tz).split(', ')[1]} · {daysUntil(a.dueAt) < 0 ? `${-daysUntil(a.dueAt)} days overdue` : `${daysUntil(a.dueAt)} days left`}</Text> : undefined} /></Row>
            </Stack>
          </Card>
          <Card>
            <Row justify="space-between" style={{ marginBottom: spacing.sm }}><Text variant="overline">Overview</Text><Text variant="caption">Specification</Text></Row>
            <KeyValueRow label="Course" value={`${a.section.course.code} · ${a.section.course.title}`} />
            <KeyValueRow label="Title" value={a.title} />
            <KeyValueRow label="Due date" value={a.dueAt ? formatDateTime(a.dueAt, tz) : 'Not set'} />
            {rules?.closesAt && rules.closesAt !== a.dueAt ? <KeyValueRow label="Submissions close" value={formatDateTime(rules.closesAt, tz)} /> : null}
            {rules ? <KeyValueRow label="Submission type" value={[rules.fileSubmissions ? 'File upload' : null, rules.onlineText ? 'Online text' : null].filter(Boolean).join(' + ') || 'Not accepted online'} /> : null}
            <KeyValueRow label="Grading" value={`${a.points} points · ${a.weightPct}% weight`} border={false} />
          </Card>
          {a.mark ? (
            <Card tone="green">
              <Row justify="space-between"><Text variant="titleSm">Released grade</Text><Pill label={`${a.mark.score} / ${a.points}`} tone="green" /></Row>
              {a.mark.feedback ? <Text variant="bodySm" style={{ marginTop: 4 }}>Feedback: {a.mark.feedback}</Text> : null}
              <Text variant="caption" style={{ marginTop: 4 }}>Released {formatDateTime(a.mark.updatedAt, tz)}</Text>
            </Card>
          ) : null}
          {submittedFlow ? (
            <Card tone="info">
              <Row justify="space-between"><Text variant="titleSm">Submission receipt</Text><Pill label={sub.status === 'late' ? 'LATE' : sub.status.toUpperCase()} tone={sub.status === 'late' ? 'red' : 'blue'} small /></Row>
              <Text variant="bodySm">{sub.receiptId ? `Receipt ${sub.receiptId} · ` : ''}submitted {formatDateTime(sub.submittedAt!, tz)}</Text>
              {sub.status === 'late' && a.dueAt ? <Text variant="caption" color={colors.danger600}>Submitted after the due date ({formatDateTime(a.dueAt, tz)}).</Text> : null}
              <Text variant="caption">Submitting work does not publish a grade. Your instructor marks and releases grades separately.</Text>
            </Card>
          ) : null}
          {!windowOpen && (a.derivedStatus === 'upcoming' || a.derivedStatus === 'draft') ? (
            <InfoBanner tone="coral" icon="Lock" title={notOpenYet ? 'Submissions not open yet' : 'Submission window closed'} text={notOpenYet && rules?.availableFrom ? `You can submit from ${formatDateTime(rules.availableFrom, tz)}.` : closesAt ? `Submissions closed ${formatDateTime(closesAt, tz)}. Contact your instructor if you need an extension.` : 'Contact your instructor if you need an extension.'} />
          ) : null}
          <Card>
            <Row justify="space-between" style={{ marginBottom: spacing.sm }}><Text variant="titleSm">Your submission{Number.isFinite(max) ? ` (${attachments.length}/${max})` : ''}</Text><Pill label={attachments.length ? `${attachments.length} file${attachments.length === 1 ? '' : 's'}` : 'No files'} tone="grey" small /></Row>
            {attachments.length ? attachments.map(att => (
              <Row key={att.id} gap={spacing.sm} style={styles.fileRow}>
                <View style={styles.fileIcon}><Icon name={/pdf/i.test(att.mimeType) ? 'FileText' : /image/.test(att.mimeType) ? 'Image' : /zip/.test(att.mimeType) ? 'FileArchive' : 'File'} size={18} color={colors.green900} /></View>
                <View style={{ flex: 1 }}><Text variant="bodyStrong" numberOfLines={1}>{att.name}</Text><Text variant="caption">{formatBytes(att.size)} · {att.uri ? (editable && !mock ? 'Not uploaded yet' : att.mimeType) : 'Uploaded'}</Text></View>
                {opening === att.id ? <View style={styles.iconBtn}><ActivityIndicator color={colors.green900} /></View> : canPreviewInApp(att.mimeType, att.name) ? <Pressable accessibilityRole="button" accessibilityLabel="Preview file" onPress={() => openFile(att, false)} style={styles.iconBtn} testID="attachment-preview"><Icon name="Eye" size={18} /></Pressable> : <Pressable accessibilityRole="button" accessibilityLabel="Open with another app" onPress={() => openFile(att, true)} style={styles.iconBtn}><Icon name="ExternalLink" size={18} /></Pressable>}
                {editable ? <Pressable accessibilityRole="button" accessibilityLabel="Remove file" onPress={() => removeFile(att)} style={styles.iconBtn} testID="attachment-remove"><Icon name="Trash2" size={18} color={colors.danger600} /></Pressable> : null}
              </Row>
            )) : <Text variant="bodySm">{allowFiles ? 'No files uploaded yet.' : 'This assignment takes an online text answer only.'}</Text>}
            {attachments.some(x => !canPreviewInApp(x.mimeType, x.name)) ? <Text variant="caption">In-app preview is unavailable for some formats; use Open with another app.</Text> : null}
            {editable && dirty && !mock && a.submission?.attachments.some(s => !attachments.some(x => x.id === s.id)) ? <Text variant="caption" color={colors.coral600}>Removed files are deleted from your draft when you save or submit.</Text> : null}
            {editable && allowFiles && attachments.length < max ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Choose a file to upload" onPress={addFile} style={styles.dropzone} testID="attachment-add">
                <Icon name="CloudUpload" size={28} color={colors.green700} />
                <Text variant="bodyStrong">Choose a file to upload</Text>
                <Text variant="caption">{types ? types.map(t => t.replace('.', '').toUpperCase()).join(', ') : 'PDF, Office, images, or ZIP'} · up to {Math.round(maxBytes / (1024 * 1024))} MB</Text>
                <Button title="Browse Files" variant="outline" size="sm" fullWidth={false} onPress={addFile} />
              </Pressable>
            ) : null}
            {mock && editable ? <Input label="Note to instructor (optional)" placeholder="Add a short note" value={note} onChangeText={t => { setNote(t); setDirty(true); }} containerStyle={{ marginTop: spacing.sm }} testID="assignment-note" /> : null}
            {!mock && allowText ? (
              editable
                ? <Input label="Online text" placeholder="Write your answer here" value={note} onChangeText={t => { setNote(t); setDirty(true); }} multiline maxLength={50000} style={{ minHeight: 120, textAlignVertical: 'top' }} containerStyle={{ marginTop: spacing.sm }} testID="assignment-note" />
                : note ? <View style={{ marginTop: spacing.sm }}><Text variant="label">Online text</Text><Text variant="bodySm">{note}</Text></View> : null
            ) : null}
            {progress !== null ? <View style={{ marginTop: spacing.sm, gap: 4 }}><ProgressBar value={progress * 100} /><Text variant="caption">Uploading… {Math.round(progress * 100)}%{mock ? ' (simulated)' : ''}</Text></View> : null}
            {uploadError ? <InfoBanner tone="coral" icon="TriangleAlert" title="Could not save your submission" text={uploadError} /> : null}
            {editable ? (
              <Stack gap={spacing.sm} style={{ marginTop: spacing.md }}>
                {uploadError && progress === null ? <Button title="Retry" variant="coral" onPress={() => { setSimulateFail(false); void submit(); }} testID="assignment-retry" /> : null}
                <Button title="Submit assignment" variant="coral" disabled={!canSubmit || progress !== null} disabledReason={canSubmit ? undefined : allowFiles ? 'Attach your completed document above to enable submission.' : 'Write your online text to enable submission.'} onPress={() => setConfirm(true)} testID="assignment-submit" />
                <Button title="Save draft" variant="outline" onPress={saveDraft} loading={m.saveDraft.isPending} disabled={progress !== null} testID="assignment-save-draft" />
                {mock ? <Toggle label="Simulate upload failure (demo)" value={simulateFail} onChange={setSimulateFail} testID="assignment-simulate-fail" /> : null}
              </Stack>
            ) : null}
          </Card>
          {a.dueAt && editable ? (
            mock
              ? <InfoBanner tone="gold" icon="Info" title="Late submission policy (demo text)" text={`Submissions past ${formatDateTime(a.dueAt, tz)} are marked late and may require academic department approval.`} />
              : closesAt ? <InfoBanner tone="gold" icon="Info" title="Deadline" text={`Submit before ${formatDateTime(closesAt, tz)}. After that the portal no longer accepts uploads for this assignment.`} /> : null
          ) : null}
          <DemoLabel text="Native document picker · local copies kept in app Documents" />
        </Stack>
      )}
      <ConfirmSheet visible={confirm} onClose={() => setConfirm(false)} onConfirm={submit} title="Submit assignment?" message={`You are submitting ${[attachments.length ? `${attachments.length} file(s)` : null, hasText && !mock ? 'your online text' : null].filter(Boolean).join(' and ')} for ${a?.title}. This is final — you cannot edit after submitting.`} confirmLabel="Submit" icon="Send" testID="assignment-confirm" />
      <BottomSheet visible={menu} onClose={() => setMenu(false)} title="Assignment">
        <ListRow icon="BookOpen" title="Open course" onPress={() => { setMenu(false); if (a) navigation.navigate(Routes.StudentCourseDetails, { sectionId: a.sectionId, tab: 'grades' }); }} />
        <ListRow icon="ClipboardList" title="All assignments" onPress={() => { setMenu(false); navigation.navigate(Routes.StudentAssignments); }} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fileRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  fileIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.green50, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  dropzone: { marginTop: spacing.sm, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong, borderRadius: 14, padding: spacing.lg, alignItems: 'center', gap: 6 },
});
