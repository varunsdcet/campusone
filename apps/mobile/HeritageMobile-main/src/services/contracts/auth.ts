import type { Session, UserAccount, UserSettings } from '../../domain/types';

export interface LoginInput {
  loginId: string;
  password: string;
  rememberMe: boolean;
}

export interface AuthService {
  login(input: LoginInput): Promise<{ session: Session; user: UserAccount }>;
  /** Restores a remembered session, or returns null. */
  restoreSession(): Promise<{ session: Session; user: UserAccount } | null>;
  logout(): Promise<void>;
  getUser(userId: string): Promise<UserAccount>;
  /** Re-verifies the current password (Security settings). */
  verifyPassword(userId: string, password: string): Promise<{ ok: true }>;
  /** Creates a MOCK reset request. No email is sent. */
  requestPasswordReset(input: { studentNumber?: string; email: string }): Promise<{ requestId: string; createdAt: string; resetToken?: string }>;
  /** Sets a new password using the token from the emailed reset link. */
  resetPassword?(input: { token: string; password: string }): Promise<{ ok: true }>;
  changePassword(userId: string, input: { currentPassword: string; newPassword: string }): Promise<{ ok: true }>;
  getSettings(userId: string): Promise<UserSettings>;
  updateSettings(userId: string, patch: Partial<UserSettings>): Promise<UserSettings>;
}
