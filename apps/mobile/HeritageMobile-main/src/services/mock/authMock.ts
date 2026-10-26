import type { AuthService, LoginInput } from '../contracts/auth';
import type { Session, UserAccount, UserSettings } from '../../domain/types';
import { ServiceError } from '../errors';
import { simulate } from './simulate';
import { MockContext, SESSION_KEY } from './context';
import { newId } from '../../utils/ids';
import { clock } from '../../utils/clock';

function publicUser(u: UserAccount): UserAccount {
  // Never hand the demo password to the UI layer.
  return { ...u, demoPassword: '' };
}

export function createAuthMock(ctx: MockContext): AuthService {
  const { repo, sessionStore } = ctx;
  return {
    async login(input: LoginInput) {
      await simulate('auth.login');
      const loginId = input.loginId.trim().toLowerCase();
      const user = repo.table('users').find(u => u.loginId.toLowerCase() === loginId);
      if (!user || user.demoPassword !== input.password) {
        throw new ServiceError('UNAUTHENTICATED', 'Invalid credentials. Check your login and password and try again.', {
          details: { field: 'password' },
        });
      }
      const session: Session = { userId: user.id, role: user.role, rememberMe: input.rememberMe, createdAt: new Date(clock.now()).toISOString() };
      if (input.rememberMe) await sessionStore.setItem(SESSION_KEY, JSON.stringify(session));
      else await sessionStore.removeItem(SESSION_KEY);
      return { session, user: publicUser(user) };
    },
    async restoreSession() {
      const raw = await sessionStore.getItem(SESSION_KEY);
      if (!raw) return null;
      try {
        const session = JSON.parse(raw) as Session;
        const user = repo.find('users', session.userId);
        if (!user) return null;
        return { session, user: publicUser(user) };
      } catch {
        return null;
      }
    },
    async logout() {
      await sessionStore.removeItem(SESSION_KEY);
    },
    async getUser(userId) {
      const user = repo.find('users', userId);
      if (!user) throw new ServiceError('NOT_FOUND', 'User not found');
      return publicUser(user);
    },
    async verifyPassword(userId, password) {
      await simulate('auth.verifyPassword');
      const user = repo.find('users', userId);
      if (!user || user.demoPassword !== password) {
        throw new ServiceError('UNAUTHENTICATED', 'That password does not match our records.', { details: { field: 'currentPassword' } });
      }
      return { ok: true };
    },
    async requestPasswordReset(input) {
      await simulate('auth.requestPasswordReset');
      const id = (input.studentNumber ?? input.email).trim().toLowerCase();
      const user = repo.table('users').find(u => u.loginId.toLowerCase() === id);
      // Always succeed with a mock request record so the UI never leaks account existence.
      const requestId = newId('pwreset');
      if (user) {
        repo.mutate(db => {
          db.requests.push({
            id: requestId, studentId: user.id, kind: 'specialLetter', status: 'pending', createdAt: new Date(clock.now()).toISOString(),
            reviewer: 'Student Support (demo)', payload: { type: 'password-reset', email: input.email }, summary: 'Mock password reset request',
          });
        });
      }
      return { requestId, createdAt: new Date(clock.now()).toISOString() };
    },
    async changePassword(userId, input) {
      await simulate('auth.changePassword');
      const user = repo.find('users', userId);
      if (!user || user.demoPassword !== input.currentPassword) {
        throw new ServiceError('UNAUTHENTICATED', 'Current password is incorrect.', { details: { field: 'currentPassword' } });
      }
      repo.mutate(db => {
        const u = db.users.find(x => x.id === userId)!;
        u.demoPassword = input.newPassword;
      });
      return { ok: true };
    },
    async getSettings(userId) {
      let s = repo.table('settings').find(x => x.userId === userId);
      if (!s) {
        s = { userId, timeZone: 'America/Vancouver', notificationsEnabled: true };
        repo.mutate(db => db.settings.push(s!));
      }
      return s;
    },
    async updateSettings(userId, patch) {
      await simulate('auth.updateSettings');
      return repo.mutate(db => {
        let s = db.settings.find(x => x.userId === userId);
        if (!s) {
          s = { userId, timeZone: 'America/Vancouver', notificationsEnabled: true };
          db.settings.push(s);
        }
        Object.assign(s, patch);
        return { ...s } as UserSettings;
      });
    },
  };
}
