import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '../../../app/ServicesProvider';
import { qk } from '../../../app/queryKeys';
import { useCurrentUserId } from '../../../state/sessionStore';
import type { CatalogueFilters, CheckoutOutcome } from '../../../services/contracts/learning';

export function useProgrammes(filters: CatalogueFilters) {
  const s = useServices();
  return useQuery({ queryKey: qk.programmes(filters), queryFn: () => s.catalogue.listProgrammes(filters) });
}

export function useProgramme(id: string) {
  const s = useServices();
  return useQuery({ queryKey: qk.programme(id), queryFn: () => s.catalogue.getProgramme(id) });
}

export function useBookmarks() {
  const s = useServices();
  const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.bookmarks(userId), queryFn: () => s.catalogue.listBookmarks(userId) });
}

export function useToggleBookmark() {
  const s = useServices();
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  return useMutation({
    mutationFn: (programmeId: string) => s.catalogue.toggleBookmark(userId, programmeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.bookmarks(userId) }),
  });
}

export function useEnrolments() {
  const s = useServices();
  const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.enrolments(userId), queryFn: () => s.enrolment.listEnrolments(userId) });
}

export function useCheckout() {
  const s = useServices();
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  return useMutation({
    mutationFn: (input: { programmeId: string; outcome: CheckoutOutcome }) => s.enrolment.checkout({ userId, ...input }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.enrolments(userId) });
      qc.invalidateQueries({ queryKey: qk.transactions(userId) });
      qc.invalidateQueries({ queryKey: qk.notifications(userId) });
    },
  });
}

export function useCardCheckout() {
  const s = useServices();
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const supported = !!s.enrolment.startCardCheckout && !!s.enrolment.completeCardCheckout;
  const start = useMutation({ mutationFn: (programmeId: string) => s.enrolment.startCardCheckout!({ userId, programmeId }) });
  const complete = useMutation({
    mutationFn: (input: { programmeId: string; sessionId: string }) => s.enrolment.completeCardCheckout!({ userId, ...input }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.enrolments(userId) });
      qc.invalidateQueries({ queryKey: qk.transactions(userId) });
      qc.invalidateQueries({ queryKey: qk.notifications(userId) });
    },
  });
  return { supported, start, complete };
}
