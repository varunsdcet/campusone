import type { SubmissionAttachment } from '../../domain/types';

/** Server-rendered applicant portal screen (`GET /applicant/view?path=…`). */
export interface ApplicantPortalRow {
  primary: string;
  secondary?: string;
  meta?: string;
  href?: string;
}

export interface ApplicantPortalAction {
  label: string;
  href?: string;
  action?: string;
  payload?: Record<string, unknown>;
  variant?: 'primary' | 'secondary' | 'ai';
}

export interface ApplicantPortalView {
  path: string;
  title: string;
  subtitle: string;
  metrics: { label: string; value: string; hint?: string }[];
  sections: { title: string; rows: ApplicantPortalRow[] }[];
  actions: ApplicantPortalAction[];
}

export type ApplicationSection = 'personal' | 'academic' | 'program';

export interface ApplicationField {
  key: string;
  label: string;
  section: ApplicationSection;
  required: boolean;
  kind: 'text' | 'email' | 'date' | 'year' | 'tel' | 'select';
  max?: number;
  options?: string[];
  dynamic?: 'programs' | 'intakes';
}

export interface ApplicationDocument {
  id: string;
  label: string;
  /** missing | uploaded | accepted | rejected | … */
  status: string;
  fileName: string | null;
}

export interface ApplicationForm {
  applicationId: string;
  status: string;
  editable: boolean;
  progressPct: number;
  values: Record<string, string>;
  fields: ApplicationField[];
  options: { programs: string[]; intakes: string[] };
  completeness: {
    sections: Record<ApplicationSection, { done: boolean; missing: string[] }>;
    documentsMissing: string[];
    missing: string[];
    pct: number;
  };
  documents: ApplicationDocument[];
  savedAt?: string;
}

export interface ApplicantActionResult {
  ok: boolean;
  status?: string;
  view: ApplicantPortalView;
}

/** Applicant admissions portal (live API only; absent in mock mode). */
export interface ApplicantService {
  home(): Promise<ApplicantPortalView>;
  view(path: string): Promise<ApplicantPortalView>;
  getForm(): Promise<ApplicationForm>;
  saveForm(values: Record<string, string>): Promise<ApplicationForm>;
  /** Runs a portal action (submit_application, accept_offer, decline_offer, ready_interview, save_progress). */
  action(action: string, payload?: Record<string, unknown>, path?: string): Promise<ApplicantActionResult>;
  uploadDocument(documentId: string, file: SubmissionAttachment): Promise<ApplicantActionResult>;
}
