import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '../../app/ServicesProvider';
import { qk } from '../../app/queryKeys';
import { useCurrentUserId } from '../../state/sessionStore';
import type { MailFolder, MailAttachment } from '../../domain/types';

export function useNotifications() {
  const s = useServices(); const userId = useCurrentUserId(); const qc = useQueryClient();
  const list = useQuery({ queryKey: qk.notifications(userId), queryFn: () => s.notifications.list(userId) });
  const inv = () => qc.invalidateQueries({ queryKey: qk.notifications(userId) });
  return {
    list,
    markRead: useMutation({ mutationFn: (id: string) => s.notifications.markRead(userId, id), onSuccess: inv }),
    markAllRead: useMutation({ mutationFn: () => s.notifications.markAllRead(userId), onSuccess: inv }),
  };
}

export function useMail(folder: MailFolder) {
  const s = useServices(); const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.mail(userId, folder), queryFn: () => s.mail.list(userId, folder) });
}
export function useMailMessage(id: string) {
  const s = useServices();
  return useQuery({
    queryKey: qk.mailMessage(id),
    queryFn: () => s.mail.get(id),
    // A new compose has no source message. Calling /mail/threads/ with an
    // empty id can be rejected by the API gateway and must never sign the
    // user out merely for opening a fresh message.
    enabled: Boolean(id.trim()),
  });
}
export function useContacts() {
  const s = useServices();
  return useQuery({ queryKey: qk.contacts(), queryFn: () => s.mail.listContacts() });
}
export function useMailMutations() {
  const s = useServices(); const userId = useCurrentUserId(); const qc = useQueryClient();
  const inv = () => { qc.invalidateQueries({ queryKey: ['mail', userId] }); qc.invalidateQueries({ queryKey: ['mailMessage'] }); };
  type Compose = { draftId?: string; toIds: string[]; ccIds?: string[]; subject: string; body: string; attachments: MailAttachment[] };
  return {
    saveDraft: useMutation({ mutationFn: (p: Compose) => s.mail.saveDraft({ userId, ...p }), onSuccess: inv }),
    send: useMutation({ mutationFn: (p: Compose) => s.mail.send({ userId, ...p }), onSuccess: inv }),
    processOutbox: useMutation({ mutationFn: (opts?: { fail?: boolean }) => s.mail.processOutbox(userId, opts), onSuccess: inv }),
    retry: useMutation({ mutationFn: (id: string) => s.mail.retry(id), onSuccess: inv }),
    markRead: useMutation({ mutationFn: (p: { id: string; read: boolean }) => s.mail.markRead(p.id, p.read), onSuccess: inv }),
    flag: useMutation({ mutationFn: (p: { id: string; flagged: boolean }) => s.mail.flag(p.id, p.flagged), onSuccess: inv }),
    move: useMutation({ mutationFn: (p: { ids: string[]; folder: MailFolder }) => s.mail.move(p.ids, p.folder), onSuccess: inv }),
    deletePermanently: useMutation({ mutationFn: (ids: string[]) => s.mail.deletePermanently(ids), onSuccess: inv }),
  };
}

export function useAskHeritage() {
  const s = useServices(); const userId = useCurrentUserId(); const qc = useQueryClient();
  const suggestions = useQuery({ queryKey: qk.askSuggestions(userId), queryFn: () => s.askHeritage.suggestions(userId) });
  const history = useQuery({ queryKey: qk.askHistory(userId), queryFn: () => s.askHeritage.history(userId) });
  const ask = useMutation({ mutationFn: (q: string) => s.askHeritage.ask(userId, q), onSettled: () => qc.invalidateQueries({ queryKey: qk.askHistory(userId) }) });
  const feedback = useMutation({ mutationFn: (p: { id: string; value: 'up' | 'down' }) => s.askHeritage.feedback(userId, p.id, p.value), onSuccess: () => qc.invalidateQueries({ queryKey: qk.askHistory(userId) }) });
  return { suggestions, history, ask, feedback };
}
