import type { AuthService } from '../contracts/auth';
import type { Capability, Session, UserAccount, UserSettings } from '../../domain/types';
import { ServiceError } from '../errors';
import type { ApiClient } from './client';
import { initials } from './util';
import { setDisplayTimeZone } from '../../utils/format';

interface LoginResponseDto {
  accessToken: string;
  accountId: string;
  personId: string;
  institutionId: string;
  roles: string[];
  givenName: string;
  familyName: string;
  requiresMfa: boolean;
  accountStatus?: 'active' | 'paused';
}

interface StudentProfileDto {
  studentId: string;
  studentNumber: string;
  givenName: string;
  familyName: string;
  middleName: string | null;
  preferredName: string | null;
  primaryEmail: string;
  personalEmail: string | null;
  phone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  programName: string;
  standing: string;
  timezone: string | null;
  status?: string;
}

interface InstructorBootstrapDto {
  displayName: string;
  email: string;
  sectionCount: number;
  studentCount: number;
}

const INSTRUCTOR_CAPS: Capability[] = [
  'courses.manage',
  'grades.submit',
  'attendance.record',
  'workshops.approve',
  'students.directory',
  'schedules.review',
  'registry.faculties',
  'registry.programTypes',
  'registry.terms',
  'repository.manage',
];

const DEVICE_KEY = 'campusone.device.v1';

/** Builds the app user from the live API (profile for students, SIS bootstrap for instructors). */
export async function loadUser(api: ApiClient, login: { accountId: string; roles: string[]; givenName: string; familyName: string }): Promise<{ user: UserAccount; timezone?: string }> {
  const role = login.roles.includes('student') ? 'student' : login.roles.includes('instructor') ? 'instructor' : login.roles.includes('applicant') ? 'applicant' : null;
  if (!role) throw new ServiceError('PERMISSION_DENIED', 'The Campus One app is for students, instructors and applicants. Please use the Campus One web portal for staff access.');
  if (role === 'applicant') {
    const form = await api.get<{ values?: Record<string, string> }>('/applicant/application/form').catch(e => {
      if (ServiceError.is(e, 'NOT_FOUND')) return null;
      throw e;
    });
    const v = form?.values ?? {};
    const first = v.givenName || login.givenName;
    const last = v.familyName || login.familyName;
    return {
      user: {
        id: login.accountId,
        role,
        loginId: v.email ?? '',
        demoPassword: '',
        displayName: `${first} ${last}`.trim() || 'Applicant',
        firstName: first,
        lastName: last,
        email: v.email ?? '',
        avatarInitials: initials(first, last),
        capabilities: [],
      },
    };
  }
  if (role === 'student') {
    const p = await api.get<StudentProfileDto>('/me/profile');
    const first = p.givenName || login.givenName;
    const last = p.familyName || login.familyName;
    return {
      timezone: p.timezone ?? undefined,
      user: {
        id: login.accountId,
        role,
        loginId: p.studentNumber,
        demoPassword: '',
        displayName: `${first} ${last}`.trim(),
        firstName: first,
        lastName: last,
        preferredName: p.preferredName ?? undefined,
        email: p.primaryEmail,
        avatarInitials: initials(first, last),
        capabilities: [],
        student: {
          studentNumber: p.studentNumber,
          programId: p.studentId,
          programName: p.programName,
          catalogYear: '',
          advisorName: '',
          phone: p.phone ?? '',
          middleName: p.middleName ?? undefined,
          sensitiveIdMasked: '•••',
          emergencyContactName: p.emergencyContactName ?? '',
          emergencyContactPhone: p.emergencyContactPhone ?? '',
        },
      },
    };
  }
  const b = await api.get<InstructorBootstrapDto>('/instructor/sis/bootstrap').catch(() => null);
  const display = b?.displayName || `${login.givenName} ${login.familyName}`.trim();
  return {
    user: {
      id: login.accountId,
      role,
      loginId: b?.email ?? '',
      demoPassword: '',
      displayName: display,
      firstName: login.givenName,
      lastName: login.familyName,
      email: b?.email ?? '',
      avatarInitials: initials(login.givenName, login.familyName),
      capabilities: INSTRUCTOR_CAPS,
      instructor: {
        staffId: login.accountId.slice(0, 8).toUpperCase(),
        department: 'Faculty',
        rank: 'Instructor',
        topics: [],
        availability: [],
        compensation: { basis: '', rateLabel: '', note: '' },
      },
    },
  };
}

export function createAuthApi(api: ApiClient, store: { getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<void> }): AuthService {
  let settings: UserSettings | null = null;
  let current: UserAccount | null = null;

  async function deviceFingerprint() {
    let id = await store.getItem(DEVICE_KEY);
    if (!id) {
      id = `campusone-ios-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      await store.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  return {
    async login(input) {
      const dto = await api.request<LoginResponseDto>(
        'POST',
        '/auth/login',
        { email: input.loginId.trim(), password: input.password, deviceFingerprint: await deviceFingerprint(), remember: input.rememberMe },
        { auth: false },
      ).catch(e => {
        if (ServiceError.is(e) && (e.code === 'UNAUTHENTICATED' || e.code === 'VALIDATION')) {
          throw new ServiceError('UNAUTHENTICATED', e.code === 'VALIDATION' ? 'Enter your student number or college email and password.' : e.message || 'Invalid credentials.', { details: { field: 'password' } });
        }
        throw e;
      });
      if (dto.requiresMfa) throw new ServiceError('PERMISSION_DENIED', 'This account requires multi-factor sign-in. Please sign in on the Heritage web portal.');
      await api.setSession({ accessToken: dto.accessToken, accountId: dto.accountId, rememberMe: input.rememberMe, createdAt: new Date().toISOString() });
      try {
        const { user, timezone } = await loadUser(api, dto);
        current = user;
        settings = { userId: user.id, timeZone: timezone ?? 'America/Vancouver', notificationsEnabled: true };
        setDisplayTimeZone(settings.timeZone);
        const session: Session = { userId: user.id, role: user.role, rememberMe: input.rememberMe, createdAt: new Date().toISOString() };
        return { session, user };
      } catch (e) {
        await api.request('POST', '/auth/logout', {}).catch(() => undefined);
        await api.clearSession();
        throw e;
      }
    },

    async restoreSession() {
      const stored = await api.loadSession();
      if (!stored) return null;
      try {
        const access = await api.get<{ accessLevelId?: string | null }>('/me/access').catch(() => null);
        // Applicant accounts have no access level, and /me/home reports them as "student"; the applicant API only answers applicants.
        const applicant = !access?.accessLevelId
          ? await api.get('/applicant/bootstrap').then(() => true, e => {
              if (ServiceError.is(e, 'PERMISSION_DENIED') || ServiceError.is(e, 'NOT_FOUND')) return false;
              throw e;
            })
          : false;
        const me: { role?: string; givenName?: string; familyName?: string } = applicant ? {} : await api.get('/me/home');
        const roles = applicant ? ['applicant'] : me.role === 'student' || access?.accessLevelId === 'student' ? ['student'] : ['instructor'];
        const { user, timezone } = await loadUser(api, { accountId: stored.accountId, roles, givenName: me.givenName ?? '', familyName: me.familyName ?? '' });
        current = user;
        settings = { userId: user.id, timeZone: timezone ?? 'America/Vancouver', notificationsEnabled: true };
        setDisplayTimeZone(settings.timeZone);
        return { session: { userId: user.id, role: user.role, rememberMe: true, createdAt: stored.createdAt }, user };
      } catch (e) {
        if (ServiceError.is(e, 'UNAUTHENTICATED') || ServiceError.is(e, 'PERMISSION_DENIED')) {
          await api.clearSession();
          return null;
        }
        throw e;
      }
    },

    async logout() {
      if (api.token) await api.request('POST', '/auth/logout', {}).catch(() => undefined);
      await api.clearSession();
      current = null;
      settings = null;
      setDisplayTimeZone(undefined);
    },

    async getUser(userId) {
      if (current && current.id === userId) return current;
      throw new ServiceError('NOT_FOUND', 'User not found');
    },

    async verifyPassword(_userId, password) {
      if (!password) throw new ServiceError('UNAUTHENTICATED', 'Enter your current password.', { details: { field: 'currentPassword' } });
      try {
        await api.request<{ ok: true }>('POST', '/auth/verify-password', { password }, { suppressUnauthorizedHandler: true });
        return { ok: true };
      } catch (e) {
        if (ServiceError.is(e, 'UNAUTHENTICATED')) {
          throw new ServiceError('UNAUTHENTICATED', 'That password does not match our records.', { details: { field: 'currentPassword' } });
        }
        throw e;
      }
    },

    async requestPasswordReset(input) {
      const email = input.email.trim().toLowerCase();
      const studentNumber = input.studentNumber?.trim();
      const r = await api.request<{ ok: boolean; resetToken?: string }>('POST', '/auth/forgot-password', { email, ...(studentNumber ? { studentNumber } : {}) }, { auth: false });
      return { requestId: `reset-${Date.now()}`, createdAt: new Date().toISOString(), resetToken: r?.resetToken };
    },

    async resetPassword({ token, password }) {
      await api.request('POST', '/auth/reset-password', { token, password }, { auth: false }).catch(e => {
        if (ServiceError.is(e) && (e.code === 'VALIDATION' || e.code === 'UNAUTHENTICATED')) {
          throw new ServiceError('VALIDATION', /password/i.test(e.message) && !/link/i.test(e.message) ? 'Password must be at least 8 characters long.' : 'This reset link is invalid or has expired. Request a new one.');
        }
        throw e;
      });
      return { ok: true as const };
    },

    async changePassword(_userId, input) {
      await api.post('/auth/change-password', input).catch(e => {
        if (ServiceError.is(e) && (e.code === 'UNAUTHENTICATED' || e.code === 'VALIDATION')) {
          throw new ServiceError('UNAUTHENTICATED', e.message || 'Current password is incorrect.', { details: { field: 'currentPassword' } });
        }
        throw e;
      });
      return { ok: true };
    },

    async getSettings(userId) {
      return settings ?? { userId, timeZone: 'America/Vancouver', notificationsEnabled: true };
    },

    async updateSettings(userId, patch) {
      const next: UserSettings = { ...(settings ?? { userId, timeZone: 'America/Vancouver', notificationsEnabled: true }), ...patch };
      if (patch.timeZone) {
        await api.patch('/me/preferences', { timezone: patch.timeZone });
      }
      settings = next;
      setDisplayTimeZone(next.timeZone);
      return next;
    },
  };
}
