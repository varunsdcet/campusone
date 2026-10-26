import React, { useEffect, useState } from 'react';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, LoadingState, ErrorState, EmptyState, Input, ChipRow, InfoBanner } from '../../../components';
import { spacing } from '../../../theme';
import type { RootScreenProps } from '../../../navigation/types';
import { useCourseSessions, useLabNotebook } from './useCourseLearning';
import { useSettings } from '../../auth/useAuth';
import { formatDate, formatDateTime } from '../../../utils/format';
import { toast } from '../../../state/uiStore';
import { ServiceError, errorMessage } from '../../../services/errors';

/** Student lab notebook per lab session (GET/PUT /student/labs/:sessionId/notebook). */
export function CourseNotesScreen({ route }: RootScreenProps<'StudentCourseNotes'>) {
  const { sectionId } = route.params;
  const labs = useCourseSessions(sectionId, 'lab');
  const [sessionId, setSessionId] = useState(route.params.sessionId);
  useEffect(() => {
    if (!sessionId && labs.data?.length) setSessionId(labs.data[0].id);
  }, [labs.data, sessionId]);
  return (
    <Screen testID="course-notes" header={<ScreenHeader title="My notes" backLabel="Course" />}>
      {labs.isLoading ? <LoadingState /> : labs.error ? <ErrorState error={labs.error} onRetry={() => labs.refetch()} /> : !labs.data?.length ? (
        <EmptyState icon="NotebookPen" title="No lab sessions yet" message="Notes are kept in a notebook for each lab session of this course. They will appear here once a lab is scheduled." testID="notes-empty" />
      ) : (
        <Stack>
          {labs.data.length > 1 ? <ChipRow options={labs.data.map(l => ({ value: l.id, label: `${formatDate(l.startsAt)} · ${l.title}` }))} value={sessionId ?? ''} onChange={setSessionId} testID="notes-session" /> : (
            <Text variant="bodySm">{labs.data[0].title} · {formatDate(labs.data[0].startsAt)}</Text>
          )}
          {sessionId ? <NotebookEditor key={sessionId} sessionId={sessionId} /> : null}
        </Stack>
      )}
    </Screen>
  );
}

function NotebookEditor({ sessionId }: { sessionId: string }) {
  const { notebook, save } = useLabNotebook(sessionId);
  const tz = useSettings().data?.timeZone;
  const nb = notebook.data;
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  useEffect(() => {
    if (nb) {
      setTitle(nb.title);
      setBody(nb.body);
    }
  }, [nb]);
  if (notebook.isLoading) return <LoadingState />;
  if (!nb) return <ErrorState error={notebook.error} onRetry={() => notebook.refetch()} />;
  const locked = Boolean(nb.lockedAt);
  const dirty = title !== nb.title || body !== nb.body;
  const onSave = async () => {
    try {
      await save.mutateAsync({ title: title.trim(), body, rowVersion: nb.rowVersion });
      toast('Notes saved', 'success');
    } catch (e) {
      if (ServiceError.is(e) && e.code === 'CONFLICT') void notebook.refetch();
      toast(errorMessage(e), 'error');
    }
  };
  return (
    <Stack>
      {locked ? <InfoBanner tone="gold" icon="Lock" text={`This notebook was locked ${formatDateTime(nb.lockedAt!, tz)} and can no longer be edited.`} /> : null}
      <Card padding={spacing.md}>
        <Stack gap={spacing.sm}>
          <Input label="Title" value={title} onChangeText={setTitle} editable={!locked} maxLength={200} testID="notes-title" />
          <Input label="Notes" value={body} onChangeText={setBody} editable={!locked} multiline maxLength={50_000} style={{ minHeight: 220, textAlignVertical: 'top' }} placeholder="Write your lab observations, results and questions…" testID="notes-body" />
          <Row justify="space-between"><Text variant="caption">Version {nb.version} · saved {formatDateTime(nb.updatedAt, tz)}</Text><Text variant="caption">{body.length.toLocaleString()} / 50,000</Text></Row>
        </Stack>
      </Card>
      {!locked ? (
        <Row>
          <Button title="Discard" variant="outline" style={{ flex: 1 }} onPress={() => { setTitle(nb.title); setBody(nb.body); }} disabled={!dirty} />
          <Button title="Save notes" style={{ flex: 1 }} onPress={onSave} loading={save.isPending} disabled={!dirty || !title.trim()} disabledReason={!title.trim() ? 'Add a title' : 'No changes yet'} testID="notes-save" />
        </Row>
      ) : null}
    </Stack>
  );
}
