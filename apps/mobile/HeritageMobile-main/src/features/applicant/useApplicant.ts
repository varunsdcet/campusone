import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '../../app/ServicesProvider';
import { useCurrentUserId } from '../../state/sessionStore';
import { Routes, type RouteName } from '../../navigation/routes';
import type { ApplicantPortalView, ApplicationForm } from '../../services/contracts/applicant';
import type { SubmissionAttachment } from '../../domain/types';

const keys = {
  all: (userId: string) => ['applicant', userId] as const,
  home: (userId: string) => ['applicant', userId, 'home'] as const,
  view: (userId: string, path: string) => ['applicant', userId, 'view', path] as const,
  form: (userId: string) => ['applicant', userId, 'form'] as const,
};

/** The applicant portal exists only against the live API. */
export function useApplicantService() {
  return useServices().applicant;
}

export function useApplicantHome() {
  const svc = useApplicantService(); const userId = useCurrentUserId();
  return useQuery({ queryKey: keys.home(userId), queryFn: () => svc!.home(), enabled: !!svc });
}

export function useApplicantView(path: string) {
  const svc = useApplicantService(); const userId = useCurrentUserId();
  return useQuery({ queryKey: keys.view(userId, path), queryFn: () => svc!.view(path), enabled: !!svc });
}

export function useApplicationForm() {
  const svc = useApplicantService(); const userId = useCurrentUserId();
  return useQuery({ queryKey: keys.form(userId), queryFn: () => svc!.getForm(), enabled: !!svc });
}

export function useApplicantMutations() {
  const svc = useApplicantService(); const userId = useCurrentUserId(); const qc = useQueryClient();
  const refresh = (path?: string, view?: ApplicantPortalView) => {
    if (path && view) qc.setQueryData(keys.view(userId, path), view);
    return qc.invalidateQueries({ queryKey: keys.all(userId) });
  };
  return {
    saveForm: useMutation({
      mutationFn: (values: Record<string, string>) => svc!.saveForm(values),
      onSuccess: (form: ApplicationForm) => { qc.setQueryData(keys.form(userId), form); void qc.invalidateQueries({ queryKey: keys.home(userId) }); },
    }),
    action: useMutation({
      mutationFn: (p: { action: string; payload?: Record<string, unknown>; path: string }) => svc!.action(p.action, p.payload, p.path),
      onSuccess: (r, p) => refresh(p.path, r.view),
    }),
    upload: useMutation({
      mutationFn: (p: { documentId: string; file: SubmissionAttachment }) => svc!.uploadDocument(p.documentId, p.file),
      onSuccess: r => refresh('/applicant/documents', r.view),
    }),
  };
}

export type ApplicantTarget = { route: RouteName; params?: Record<string, unknown> };

function titleFromPath(path: string) {
  const leaf = path.split('/').filter(Boolean).pop() ?? 'Applicant';
  return leaf.replace(/^ap-\d+-/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Maps an applicant portal href (as returned by the API) to an app screen. */
export function applicantTarget(href: string | undefined): ApplicantTarget | null {
  if (!href) return null;
  const path = href.split('?')[0].replace(/\/+$/, '');
  const tab = (screen: RouteName, params?: Record<string, unknown>): ApplicantTarget => ({ route: Routes.ApplicantTabs, params: { screen, params } });
  switch (path) {
    case '/applicant': return tab(Routes.ApplicantHomeTab);
    case '/applicant/application': return tab(Routes.ApplicantApplicationTab);
    case '/applicant/documents': return tab(Routes.ApplicantDocumentsTab);
    case '/applicant/messages': return tab(Routes.ApplicantMessagesTab, { tab: 'messages' });
    case '/applicant/notifications': return tab(Routes.ApplicantMessagesTab, { tab: 'notifications' });
    case '/applicant/offers': return { route: Routes.ApplicantOffers };
    case '/applicant/timeline': return { route: Routes.ApplicantTimeline };
    case '/applicant/ask': return { route: Routes.AskHeritage };
    case '/applicant/search':
    case '/applicant/all': return null;
  }
  if (path.startsWith('/applicant/')) return { route: Routes.ApplicantView, params: { path, title: titleFromPath(path) } };
  return null;
}
