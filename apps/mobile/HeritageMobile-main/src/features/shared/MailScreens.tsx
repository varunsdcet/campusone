import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View, Pressable } from 'react-native';
import { Screen, ScreenHeader, Text, Card, Row, Stack, Button, Pill, LoadingState, ErrorState, EmptyState, Icon, ChipRow, Select, Checkbox, Input, BottomSheet, ConfirmSheet, DemoLabel, InfoBanner, KeyValueRow, Pager } from '../../components';
import { colors, spacing } from '../../theme';
import { Routes } from '../../navigation/routes';
import type { RootScreenProps } from '../../navigation/types';
import { useMail, useMailMessage, useMailMutations, useContacts } from './useShared';
import { formatDate, formatDateTime, formatBytes } from '../../utils/format';
import type { MailFolder, MailMessage, MailAttachment } from '../../domain/types';
import type { MailMessageView } from '../../services/contracts/records';
import { toast } from '../../state/uiStore';
import { errorMessage } from '../../services/errors';
import { pickAttachment } from './files';
import { useUnsavedChangesGuard } from './hooks';
import { useSettings } from '../auth/useAuth';
import { clock } from '../../utils/clock';
import { useClockTick } from './hooks';
import { useFileActions } from './useFileActions';
import { isMockMode } from '../../config/appConfig';

const FOLDERS: { value: MailFolder; label: string }[] = [{ value: 'inbox', label: 'Inbox' }, { value: 'outbox', label: 'Outbox' }, { value: 'drafts', label: 'Drafts' }, { value: 'junk', label: 'Junk' }, { value: 'deleted', label: 'Deleted' }];
const PAGE = 10;

/** Compose params; `forwardId` rides alongside the declared route params. */
type ComposeParams = { draftId?: string; toId?: string; toRole?: 'staff' | 'instructor'; toName?: string; subject?: string; forwardId?: string };
const forwardParams = (forwardId: string): ComposeParams => ({ forwardId });

function forwardBody(msg: MailMessageView, timeZone?: string) {
  return [
    '',
    '',
    '---------- Forwarded message ----------',
    `From: ${msg.fromName}`,
    `Date: ${formatDateTime(msg.createdAt, timeZone)}`,
    `Subject: ${msg.subject || '(no subject)'}`,
    `To: ${msg.toNames.join(', ')}`,
    ...(msg.ccNames?.length ? [`Cc: ${msg.ccNames.join(', ')}`] : []),
    '',
    msg.body,
  ].join('\n');
}

export function MailScreen({ navigation, route }: RootScreenProps<'Mail'>) {
  const [folder, setFolder] = useState<MailFolder>(route.params?.folder ?? 'inbox');
  const mail = useMail(folder);
  const m = useMailMutations();
  const settings = useSettings();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<string>('');
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const now = useClockTick(10000);
  const data = mail.data ?? [];
  useEffect(() => { setSelected(new Set()); setPage(1); }, [folder]);
  // Outbox queue: deliver messages whose sendAt has passed (deterministic, demo).
  useEffect(() => {
    if (folder === 'outbox' && data.some(x => x.outboxStatus === 'queued' && x.sendAt && new Date(x.sendAt).getTime() <= now)) m.processOutbox.mutate(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, now, data.length]);
  const pageCount = Math.max(1, Math.ceil(data.length / PAGE));
  const shown = data.slice((page - 1) * PAGE, page * PAGE);
  const toggle = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const actions = folder === 'deleted'
    ? [{ value: 'restore', label: 'Restore to Inbox' }, { value: 'delete', label: 'Delete permanently' }]
    : folder === 'junk'
      ? [{ value: 'read', label: 'Mark as read' }, { value: 'unread', label: 'Mark as unread' }, { value: 'restore', label: 'Not junk · move to Inbox' }, { value: 'deleted', label: 'Move to Deleted' }]
      : [{ value: 'read', label: 'Mark as read' }, { value: 'unread', label: 'Mark as unread' }, { value: 'junk', label: 'Move to Junk' }, { value: 'deleted', label: 'Move to Deleted' }];
  const go = async () => {
    const ids = Array.from(selected);
    if (!ids.length || !action) return;
    try {
      if (action === 'read' || action === 'unread') await Promise.all(ids.map(id => m.markRead.mutateAsync({ id, read: action === 'read' })));
      else if (action === 'restore') await m.move.mutateAsync({ ids, folder: 'inbox' });
      else if (action === 'delete') { setConfirmDelete(true); return; }
      else await m.move.mutateAsync({ ids, folder: action as MailFolder });
      toast(`${ids.length} message(s) updated`, 'success');
      setSelected(new Set()); setAction('');
    } catch (e) { toast(errorMessage(e), 'error'); }
  };
  const queued = data.filter(x => x.outboxStatus === 'queued').length;
  return (
    <Screen scroll={false} padded={false} testID="mail-screen" header={<ScreenHeader overline="Campus mail" title="My E-mail / Messages" actions={[{ label: 'Compose', icon: 'SquarePen', accessibilityLabel: 'Compose message', variant: 'primary', onPress: () => navigation.navigate(Routes.MailCompose), testID: 'mail-compose' }]} />}>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <ChipRow options={FOLDERS} value={folder} onChange={setFolder} testID="mail-folder" />
        <Row justify="space-between" style={{ marginVertical: spacing.sm }}>
          <Row gap={6}><Text variant="titleMd" style={{ textTransform: 'capitalize' }}>{folder}</Text>{folder === 'outbox' && queued ? <Pill label={`${queued} queued`} tone="teal" small /> : folder === 'inbox' && data.filter(x => !x.read).length ? <Pill label={`${data.filter(x => !x.read).length} unread`} tone="coral" small /> : null}</Row>
          <Text variant="caption">Local sync: just now</Text>
        </Row>
        <Pager page={page} pageCount={pageCount} onChange={setPage} total={data.length} testID="mail-pager" />
      </View>
      {mail.isLoading ? <LoadingState /> : mail.error ? <ErrorState error={mail.error} onRetry={() => mail.refetch()} /> : (
        <FlatList data={shown} keyExtractor={x => x.id} contentContainerStyle={styles.list} ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={<EmptyState icon="MailOpen" title={`No messages in ${folder}`} />}
          renderItem={({ item }) => <MailRow msg={item} selected={selected.has(item.id)} onToggle={() => toggle(item.id)} onOpen={() => navigation.navigate(Routes.MailMessage, { messageId: item.id })} onFlag={() => m.flag.mutate({ id: item.id, flagged: !item.flagged })} onRetry={() => m.retry.mutate(item.id)} tz={settings.data?.timeZone} />}
          ListFooterComponent={<Stack gap={spacing.sm} style={{ marginTop: spacing.md }}>
            {data.length ? <><Text variant="bodySm">With checked ({selected.size})</Text><Row><View style={{ flex: 1 }}><Select compact value={action} onChange={setAction} placeholder="-- Select Action --" options={actions} testID="mail-action" /></View><Button title="Go" variant="outline" fullWidth={false} onPress={go} disabled={!selected.size || !action} disabledReason={!selected.size ? 'Select messages first' : undefined} testID="mail-go" /></Row></> : null}
            {folder === 'outbox' && isMockMode() ? <>
              <InfoBanner tone="teal" icon="Info" title="Outbox dispatch queue (demo)" text="Messages wait here briefly, then are marked sent locally. Nothing is ever delivered outside this device." />
              <Row><Button title="Process queue now" variant="outline" size="sm" style={{ flex: 1 }} onPress={() => m.processOutbox.mutate(undefined)} disabled={!queued} disabledReason="Nothing queued" testID="mail-process" /><Button title="Simulate failure" variant="ghost" size="sm" style={{ flex: 1 }} onPress={() => m.processOutbox.mutate({ fail: true })} disabled={!queued} testID="mail-process-fail" /></Row>
            </> : null}
            <DemoLabel text="Demo delivery · no real email is sent" />
          </Stack>}
        />
      )}
      <ConfirmSheet visible={confirmDelete} onClose={() => setConfirmDelete(false)} destructive title="Delete permanently?" message={`${selected.size} message(s) will be permanently removed from your mailbox. This cannot be undone.`} confirmLabel="Delete" onConfirm={async () => { await m.deletePermanently.mutateAsync(Array.from(selected)); setSelected(new Set()); setConfirmDelete(false); setAction(''); }} testID="mail-delete-sheet" />
    </Screen>
  );
}

function MailRow({ msg, selected, onToggle, onOpen, onFlag, onRetry, tz }: { msg: MailMessage; selected: boolean; onToggle: () => void; onOpen: () => void; onFlag: () => void; onRetry: () => void; tz?: string }) {
  const sendIn = msg.sendAt ? Math.max(0, Math.round((new Date(msg.sendAt).getTime() - clock.now()) / 60000)) : 0;
  return (
    <Pressable testID={`mail-${msg.id}`} accessibilityRole="button" accessibilityLabel={`${msg.read ? '' : 'Unread. '}${msg.subject} from ${msg.fromName}`} onPress={onOpen} style={[styles.row, msg.outboxStatus === 'failed' ? styles.failed : msg.folder === 'outbox' ? styles.outbox : null]}>
      <Row gap={spacing.sm} align="flex-start">
        <Checkbox checked={selected} onChange={onToggle} testID={`mail-check-${msg.id}`} />
        <View style={{ flex: 1 }}>
          <Row justify="space-between"><Row gap={6}>{!msg.read ? <View style={styles.unreadDot} /> : null}<Text variant="titleSm">{msg.folder === 'inbox' || msg.folder === 'junk' ? msg.fromName : msg.toNames.join(', ') || 'No recipient'}</Text></Row><Row gap={6}><Text variant="caption">{formatDate(msg.createdAt).replace(/, \d{4}$/, '')}</Text><Pressable accessibilityRole="button" accessibilityLabel={msg.flagged ? 'Unflag' : 'Flag'} onPress={onFlag} hitSlop={8}><Icon name="Flag" size={16} color={msg.flagged ? colors.coral600 : colors.inkFaint} /></Pressable></Row></Row>
          <Row gap={4}><Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>{msg.subject || '(no subject)'}</Text>{msg.outboxStatus === 'queued' ? <Icon name="Clock" size={14} color={colors.inkMuted} /> : null}</Row>
          <Text variant="bodySm" numberOfLines={2}>{msg.body}</Text>
          <Row justify="space-between" style={{ marginTop: 6 }}>
            {msg.attachments.length ? <Row gap={4}><Icon name="Paperclip" size={12} color={colors.inkMuted} /><Text variant="caption">{msg.attachments[0].name} ({formatBytes(msg.attachments[0].size)}){msg.attachments.length > 1 ? ` +${msg.attachments.length - 1}` : ''}</Text></Row> : <View />}
            {msg.outboxStatus === 'queued' ? <Pill label={sendIn ? `Sending in ${sendIn}m` : 'Sending…'} tone="teal" small /> : msg.outboxStatus === 'sent' ? <Pill label={isMockMode() ? 'Sent (demo)' : 'Sent'} tone="green" small /> : msg.outboxStatus === 'failed' ? <Pressable onPress={onRetry} accessibilityRole="button" testID={`mail-retry-${msg.id}`}><Pill label="Failed · Retry" tone="red" small /></Pressable> : null}
          </Row>
        </View>
      </Row>
      <Text style={{ display: 'none' }}>{tz}</Text>
    </Pressable>
  );
}

export function MailMessageScreen({ navigation, route }: RootScreenProps<'MailMessage'>) {
  const q = useMailMessage(route.params.messageId);
  const m = useMailMutations();
  const settings = useSettings();
  const [confirm, setConfirm] = useState(false);
  const msg = q.data;
  useEffect(() => { if (msg && !msg.read) m.markRead.mutate({ id: msg.id, read: true }); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msg?.id]);
  const files = useFileActions();
  return (
    <Screen testID="mail-message" header={<ScreenHeader backLabel="Mail" actions={msg ? [{ icon: 'Flag', accessibilityLabel: msg.flagged ? 'Unflag' : 'Flag', onPress: () => m.flag.mutate({ id: msg.id, flagged: !msg.flagged }) }, { icon: 'Trash2', accessibilityLabel: 'Delete', onPress: () => setConfirm(true), testID: 'msg-delete' }] : []} />}>
      {q.isLoading ? <LoadingState /> : !msg ? <ErrorState error={q.error} /> : (
        <Stack>
          <Text variant="displaySm">{msg.subject || '(no subject)'}</Text>
          <Card padding={spacing.md}>
            <KeyValueRow label="From" value={msg.fromName} />
            <KeyValueRow label="To" value={msg.toNames.join(', ')} />
            {msg.ccNames?.length ? <KeyValueRow label="Cc" value={msg.ccNames.join(', ')} /> : null}
            <KeyValueRow label="Date" value={formatDateTime(msg.createdAt, settings.data?.timeZone)} border={!!msg.outboxStatus} />
            {msg.outboxStatus ? <KeyValueRow label="Delivery" value={isMockMode() ? `${msg.outboxStatus} (demo)` : msg.outboxStatus} border={false} /> : null}
          </Card>
          <Card><Text variant="body">{msg.body}</Text></Card>
          {msg.attachments.length ? <Card padding={spacing.md}><Text variant="overline" style={{ marginBottom: 4 }}>Attachments</Text>{msg.attachments.map(a => <Row key={a.id} gap={8} style={{ paddingVertical: 6 }}><Icon name="Paperclip" size={16} color={colors.inkMuted} /><Text variant="bodyStrong" style={{ flex: 1 }}>{a.name}</Text><Text variant="caption">{formatBytes(a.size)}</Text>{a.uri ? <Button title="Open" size="sm" variant="outline" fullWidth={false} onPress={() => files.viewPath(a.uri!, undefined, a.name)} /> : isMockMode() ? <Pill label="sample" tone="grey" small /> : null}</Row>)}</Card> : null}
          <Row>
            {msg.folder === 'drafts' ? <Button title="Edit draft" style={{ flex: 1 }} onPress={() => navigation.replace(Routes.MailCompose, { draftId: msg.id })} testID="msg-edit" /> : <>
              <Button title="Reply" style={{ flex: 1 }} onPress={() => navigation.navigate(Routes.MailCompose, { toId: msg.fromId, subject: `Re: ${msg.subject}` })} testID="msg-reply" />
              <Button title="Forward" variant="outline" style={{ flex: 1 }} icon={<Icon name="Forward" size={16} color={colors.green900} />} onPress={() => navigation.navigate(Routes.MailCompose, forwardParams(msg.id))} testID="msg-forward" />
            </>}
            {msg.outboxStatus === 'failed' ? <Button title="Retry send" variant="outline" style={{ flex: 1 }} onPress={() => m.retry.mutate(msg.id)} testID="msg-retry" /> : null}
            {msg.folder === 'deleted' ? <Button title="Restore" variant="outline" style={{ flex: 1 }} onPress={() => { m.move.mutate({ ids: [msg.id], folder: msg.previousFolder ?? 'inbox' }); navigation.goBack(); }} /> : null}
          </Row>
        </Stack>
      )}
      <ConfirmSheet visible={confirm} onClose={() => setConfirm(false)} destructive title={msg?.folder === 'deleted' ? 'Delete permanently?' : 'Move to Deleted?'} message={msg?.folder === 'deleted' ? 'This cannot be undone.' : 'You can restore it from the Deleted folder.'} confirmLabel="Delete" onConfirm={async () => { if (!msg) return; if (msg.folder === 'deleted') await m.deletePermanently.mutateAsync([msg.id]); else await m.move.mutateAsync({ ids: [msg.id], folder: 'deleted' }); setConfirm(false); navigation.goBack(); }} testID="msg-delete-sheet" />
    </Screen>
  );
}

export function MailComposeScreen({ navigation, route }: RootScreenProps<'MailCompose'>) {
  const params = route.params as ComposeParams | undefined;
  const source = useMailMessage(params?.draftId ?? params?.forwardId ?? '');
  const contacts = useContacts();
  const settings = useSettings();
  const m = useMailMutations();
  const [toIds, setToIds] = useState<string[]>(params?.toId ? [params.toId] : []);
  const [ccIds, setCcIds] = useState<string[]>([]);
  const [subject, setSubject] = useState(params?.subject ?? '');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<MailAttachment[]>([]);
  const [pickerFor, setPickerFor] = useState<'to' | 'cc' | null>(null);
  const [contactQuery, setContactQuery] = useState('');
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recipientPrefillAttempted = useRef(false);
  const { allowLeave } = useUnsavedChangesGuard(dirty, 'Discard this message? Save it as a draft first to keep it.');
  useEffect(() => {
    if (recipientPrefillAttempted.current || params?.toId || !params?.toRole || !contacts.data) return;
    recipientPrefillAttempted.current = true;
    const wantedName = params.toName?.trim().toLowerCase();
    const match = contacts.data.find(c => c.role === params.toRole && wantedName && c.name.trim().toLowerCase() === wantedName)
      ?? contacts.data.find(c => c.role === params.toRole);
    if (match) setToIds([match.id]);
  }, [contacts.data, params?.toId, params?.toName, params?.toRole]);
  useEffect(() => {
    const src = source.data;
    if (!src) return;
    if (params?.draftId) { setToIds(src.toIds); setCcIds(src.ccIds ?? []); setSubject(src.subject); setBody(src.body); setAttachments(src.attachments); }
    else if (params?.forwardId) {
      setSubject(/^fwd:/i.test(src.subject) ? src.subject : `Fwd: ${src.subject}`);
      setBody(forwardBody(src, settings.data?.timeZone));
      setAttachments(src.attachments);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.data?.id]);
  const list = useMemo(() => (contacts.data ?? []).filter(c => !contactQuery || c.name.toLowerCase().includes(contactQuery.toLowerCase()) || c.email.toLowerCase().includes(contactQuery.toLowerCase())), [contacts.data, contactQuery]);
  const nameOf = (id: string) => contacts.data?.find(c => c.id === id)?.name ?? id;
  const names = toIds.map(nameOf);
  const ccNames = ccIds.map(nameOf);
  const picked = pickerFor === 'cc' ? ccIds : toIds;
  const setPicked = pickerFor === 'cc' ? setCcIds : setToIds;
  const payload = { draftId: params?.draftId, toIds, ccIds: ccIds.filter(id => !toIds.includes(id)), subject, body, attachments };
  const saveDraft = async () => { try { await m.saveDraft.mutateAsync(payload); setDirty(false); allowLeave(); toast('Draft saved', 'success'); navigation.goBack(); } catch (e) { toast(errorMessage(e), 'error'); } };
  const send = async () => { setError(null); try { await m.send.mutateAsync(payload); setDirty(false); allowLeave(); toast(isMockMode() ? 'Queued in Outbox (demo delivery)' : 'Message sent', 'success'); navigation.replace(Routes.Mail, { folder: 'outbox' }); } catch (e) { setError(errorMessage(e)); } };
  const addAttachment = async () => {
    const r = await pickAttachment({ keepCopy: true });
    if (r.status === 'picked') { setAttachments(a => [...a, { id: r.attachment.id, name: r.attachment.name, size: r.attachment.size, uri: r.attachment.uri, mimeType: r.attachment.mimeType }]); setDirty(true); }
    else if (r.status === 'error') toast(r.message, 'error');
  };
  return (
    <Screen testID="mail-compose" header={<ScreenHeader title="Compose" actions={[{ label: 'Send', icon: 'Send', accessibilityLabel: 'Send message', variant: 'primary', onPress: send, testID: 'compose-send' }]} />} footer={<Row><Button title="Save draft" variant="outline" style={{ flex: 1 }} onPress={saveDraft} loading={m.saveDraft.isPending} testID="compose-save-draft" /><Button title={isMockMode() ? 'Send (demo)' : 'Send'} style={{ flex: 1 }} onPress={send} loading={m.send.isPending} testID="compose-send-footer" /></Row>}>
      <Stack>
        <Pressable accessibilityRole="button" accessibilityLabel={`Recipients: ${names.join(', ') || 'none'}`} onPress={() => setPickerFor('to')} style={styles.toField} testID="compose-to">
          <Text variant="label">To</Text>
          <Row wrap style={{ flex: 1 }}>{names.length ? names.map((n, i) => <Pill key={toIds[i]} label={n} tone="green" small />) : <Text variant="body" color={colors.inkFaint}>{isMockMode() ? 'Choose recipients from demo contacts' : 'Choose recipients'}</Text>}</Row>
          <Icon name="UserPlus" size={18} color={colors.inkSecondary} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Cc: ${ccNames.join(', ') || 'none'}`} onPress={() => setPickerFor('cc')} style={styles.toField} testID="compose-cc">
          <Text variant="label">Cc</Text>
          <Row wrap style={{ flex: 1 }}>{ccNames.length ? ccNames.map((n, i) => <Pill key={ccIds[i]} label={n} tone="grey" small />) : <Text variant="body" color={colors.inkFaint}>Optional</Text>}</Row>
          <Icon name="UserPlus" size={18} color={colors.inkSecondary} />
        </Pressable>
        <Input label="Subject" value={subject} onChangeText={t => { setSubject(t); setDirty(true); }} placeholder="Subject" testID="compose-subject" />
        <Input label="Message" value={body} onChangeText={t => { setBody(t); setDirty(true); }} placeholder="Write your message…" multiline style={{ minHeight: 160 }} testID="compose-body" />
        {attachments.map(a => <Row key={a.id} gap={8} style={styles.att}><Icon name="Paperclip" size={16} color={colors.inkMuted} /><Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{a.name}</Text><Text variant="caption">{formatBytes(a.size)}</Text><Pressable accessibilityRole="button" accessibilityLabel="Remove attachment" onPress={() => { setAttachments(x => x.filter(y => y.id !== a.id)); setDirty(true); }} hitSlop={8}><Icon name="X" size={16} color={colors.danger600} /></Pressable></Row>)}
        <Button title="Add attachment" variant="subtle" size="sm" fullWidth={false} icon={<Icon name="Paperclip" size={14} color={colors.green900} />} onPress={addAttachment} testID="compose-attach" />
        {error ? <InfoBanner tone="coral" icon="TriangleAlert" text={error} /> : null}
        {isMockMode() ? <DemoLabel text="Messages are queued locally · never sent for real" /> : null}
      </Stack>
      <BottomSheet visible={pickerFor !== null} onClose={() => setPickerFor(null)} title={pickerFor === 'cc' ? 'Cc' : 'Recipients'} subtitle={isMockMode() ? 'Demo contacts' : undefined} testID="compose-contacts">
        <Input placeholder="Search contacts" leftIcon="Search" value={contactQuery} onChangeText={setContactQuery} testID="compose-contact-search" />
        {list.map(c => <Checkbox key={c.id} checked={picked.includes(c.id)} onChange={v => { setPicked(ids => (v ? [...ids, c.id] : ids.filter(x => x !== c.id))); setDirty(true); }} label={c.email ? `${c.name} · ${c.email}` : c.name} testID={`contact-${c.id}`} />)}
        <Button title="Done" onPress={() => setPickerFor(null)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  row: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  outbox: { borderLeftWidth: 4, borderLeftColor: colors.coral600 },
  failed: { borderLeftWidth: 4, borderLeftColor: colors.danger600 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral500 },
  toField: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, padding: spacing.md, minHeight: 48 },
  att: { backgroundColor: colors.surfaceMuted, padding: spacing.sm, borderRadius: 10 },
});
