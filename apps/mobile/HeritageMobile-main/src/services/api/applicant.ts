import * as RNFS from '@dr.pogodin/react-native-fs';
import type { ApplicantActionResult, ApplicantPortalView, ApplicantService, ApplicationForm } from '../contracts/applicant';
import { ServiceError } from '../errors';
import type { ApiClient } from './client';

export const APPLICANT_UPLOAD_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};
export const APPLICANT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 120_000;

/** The portal API still carries the legacy product name in labels; the app is branded Campus One. */
export function brandText(s: string): string;
export function brandText(s: string | undefined): string | undefined;
export function brandText(s: string | undefined) {
  return s?.replace(/Heritage Community College|Heritage College|Heritage/g, 'Campus One');
}

interface PortalViewDto {
  path: string;
  title: string;
  subtitle?: string;
  metrics?: { label: string; value: string; hint?: string }[];
  sections?: { title: string; rows: { primary: string; secondary?: string; meta?: string; href?: string }[] }[];
  actions?: { label: string; href?: string; action?: string; payload?: Record<string, unknown>; variant?: 'primary' | 'secondary' | 'ai' }[];
}

function toView(d: PortalViewDto): ApplicantPortalView {
  return {
    path: d.path,
    title: brandText(d.title),
    subtitle: brandText(d.subtitle ?? ''),
    metrics: (d.metrics ?? []).map(m => ({ label: brandText(m.label), value: m.value.replace(/_/g, ' '), hint: brandText(m.hint) })),
    sections: (d.sections ?? []).map(s => ({
      title: brandText(s.title),
      rows: s.rows.map(r => ({ primary: brandText(r.primary), secondary: brandText(r.secondary), meta: brandText(r.meta), href: r.href })),
    })),
    actions: (d.actions ?? []).filter(a => a.href !== '/applicant/search').map(a => ({ ...a, label: brandText(a.label) })),
  };
}

export function createApplicantApi(api: ApiClient): { applicant: ApplicantService } {
  const action = async (name: string, payload?: Record<string, unknown>, path?: string, timeoutMs?: number): Promise<ApplicantActionResult> => {
    const d = await api.request<{ ok?: boolean; status?: string; view: PortalViewDto }>('POST', '/applicant/action', { action: name, ...(payload ? { payload } : {}), ...(path ? { path } : {}) }, { timeoutMs });
    return { ok: d.ok !== false, status: d.status, view: toView(d.view) };
  };
  return {
    applicant: {
      async home() {
        const d = await api.get<{ home: PortalViewDto }>('/applicant/bootstrap');
        return toView(d.home);
      },
      async view(path) {
        return toView(await api.get<PortalViewDto>(`/applicant/view?path=${encodeURIComponent(path)}`));
      },
      getForm() {
        return api.get<ApplicationForm>('/applicant/application/form');
      },
      saveForm(values) {
        return api.put<ApplicationForm>('/applicant/application/form', values);
      },
      action(name, payload, path) {
        return action(name, payload, path);
      },
      async uploadDocument(documentId, file) {
        const ext = /\.[^.]+$/.exec(file.name)?.[0]?.toLowerCase() ?? '';
        const mimeType = APPLICANT_UPLOAD_MIME[ext];
        if (!mimeType) throw new ServiceError('VALIDATION', `"${file.name}" is not an accepted type. Upload a PDF, Word (.doc/.docx), PNG or JPEG file.`);
        const path = decodeURI(file.uri.replace(/^file:\/\//, ''));
        const contentBase64 = (await RNFS.readFile(path, 'base64')).replace(/\s+/g, '');
        const padding = contentBase64.endsWith('==') ? 2 : contentBase64.endsWith('=') ? 1 : 0;
        const sizeBytes = (contentBase64.length / 4) * 3 - padding;
        if (sizeBytes <= 0) throw new ServiceError('VALIDATION', 'The selected file is empty (0 bytes). Choose a file that has content.');
        if (sizeBytes > APPLICANT_UPLOAD_MAX_BYTES) throw new ServiceError('VALIDATION', 'Files must be 10 MB or smaller.');
        return action('upload_document', { documentId, filename: file.name, mimeType, sizeBytes, contentBase64 }, '/applicant/documents', UPLOAD_TIMEOUT_MS);
      },
    },
  };
}
