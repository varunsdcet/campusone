import { create } from 'zustand';
import type { Role, Session, UserAccount } from '../domain/types';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

interface SessionState {
  status: SessionStatus;
  session: Session | null;
  user: UserAccount | null;
  /** Demo: show the role switcher after login. */
  setSignedIn(session: Session, user: UserAccount): void;
  setSignedOut(): void;
  setUser(user: UserAccount): void;
  role(): Role | null;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  status: 'loading',
  session: null,
  user: null,
  setSignedIn: (session, user) => set({ status: 'signedIn', session, user }),
  setSignedOut: () => set({ status: 'signedOut', session: null, user: null }),
  setUser: user => set({ user }),
  role: () => get().user?.role ?? null,
}));

export function useCurrentUser(): UserAccount {
  const user = useSessionStore(s => s.user);
  if (!user) throw new Error('No signed-in user');
  return user;
}

export function useCurrentUserId(): string {
  return useCurrentUser().id;
}
