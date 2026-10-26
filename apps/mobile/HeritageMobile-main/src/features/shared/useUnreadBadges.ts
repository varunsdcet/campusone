import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRepository, useServices } from '../../app/ServicesProvider';
import { useSessionStore } from '../../state/sessionStore';
import { isMockMode } from '../../config/appConfig';
import { qk } from '../../app/queryKeys';

/** Derived unread counts for tab badges (repository in mock mode, live queries against the API). */
export function useUnreadBadges() {
  const repo = useRepository();
  const s = useServices();
  const userId = useSessionStore(st => st.user?.id);
  const live = !isMockMode() && Boolean(userId);
  const notifications = useQuery({ queryKey: qk.notifications(userId ?? ''), queryFn: () => s.notifications.list(userId!), enabled: live, refetchInterval: 60_000 });
  const inbox = useQuery({ queryKey: qk.mail(userId ?? '', 'inbox'), queryFn: () => s.mail.list(userId!, 'inbox'), enabled: live, refetchInterval: 60_000 });
  const compute = () => {
    if (!userId || !repo.isHydrated || !isMockMode()) return { mail: false, notifications: false };
    const db = repo.data;
    return {
      mail: db.mail.some(m => m.ownerId === userId && m.folder === 'inbox' && !m.read),
      notifications: db.notifications.some(n => n.userId === userId && !n.read),
    };
  };
  const [state, setState] = useState(compute);
  useEffect(() => {
    setState(compute());
    return repo.subscribe(() => setState(compute()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, userId]);
  if (live) return { mail: Boolean(inbox.data?.some(m => !m.read)), notifications: Boolean(notifications.data?.some(n => !n.read)) };
  return state;
}
