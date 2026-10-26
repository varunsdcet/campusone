import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '../../app/ServicesProvider';
import { useSessionStore } from '../../state/sessionStore';
import { qk } from '../../app/queryKeys';
import type { LoginInput } from '../../services/contracts/auth';
import { scenario } from '../../services/mock/simulate';

export function useLogin() {
  const services = useServices();
  const setSignedIn = useSessionStore(s => s.setSignedIn);
  return useMutation({
    mutationFn: (input: LoginInput) => services.auth.login(input),
    onSuccess: ({ session, user }) => setSignedIn(session, user),
  });
}

export function useRestoreSession() {
  const services = useServices();
  const setSignedIn = useSessionStore(s => s.setSignedIn);
  const setSignedOut = useSessionStore(s => s.setSignedOut);
  return useCallback(async () => {
    const restored = await services.auth.restoreSession();
    if (restored) setSignedIn(restored.session, restored.user);
    else setSignedOut();
  }, [services, setSignedIn, setSignedOut]);
}

/** Logout clears session-specific caches but keeps shared demo records. */
export function useLogout() {
  const services = useServices();
  const qc = useQueryClient();
  const setSignedOut = useSessionStore(s => s.setSignedOut);
  return useCallback(async () => {
    await services.auth.logout();
    qc.clear();
    scenario.reset();
    setSignedOut();
  }, [services, qc, setSignedOut]);
}

export function useSettings() {
  const services = useServices();
  const userId = useSessionStore(s => s.user?.id);
  return useQuery({ queryKey: qk.settings(userId ?? 'none'), queryFn: () => services.auth.getSettings(userId!), enabled: !!userId });
}

export function useUpdateSettings() {
  const services = useServices();
  const qc = useQueryClient();
  const userId = useSessionStore(s => s.user!.id);
  return useMutation({
    mutationFn: (patch: Parameters<typeof services.auth.updateSettings>[1]) => services.auth.updateSettings(userId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.settings(userId) }),
  });
}

export function useRequestPasswordReset() {
  const services = useServices();
  return useMutation({ mutationFn: (input: { studentNumber?: string; email: string }) => services.auth.requestPasswordReset(input) });
}

export function useResetPassword() {
  const services = useServices();
  return {
    supported: !!services.auth.resetPassword,
    mutation: useMutation({ mutationFn: (input: { token: string; password: string }) => services.auth.resetPassword!(input) }),
  };
}

export function useVerifyPassword() {
  const services = useServices();
  const userId = useSessionStore(s => s.user!.id);
  return useMutation({ mutationFn: (password: string) => services.auth.verifyPassword(userId, password) });
}

export function useChangePassword() {
  const services = useServices();
  const userId = useSessionStore(s => s.user!.id);
  return useMutation({ mutationFn: (input: { currentPassword: string; newPassword: string }) => services.auth.changePassword(userId, input) });
}
