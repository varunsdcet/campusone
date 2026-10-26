import * as RNFS from '@dr.pogodin/react-native-fs';
import type {
  AskHeritageAnswer, AskHeritageService, BadgeWithProgress, CalendarPeriod, CourseEvaluation, DocumentsService, FinanceService, MailMessageView, MailService, NotificationsService, PracticumPlacement, RecordsService, RequestDetail, RequestsService,
  DegreeProgressLite, DegreeScenarioResult, StudentAcademicProfile, StudentComplianceOverview, StudentCredential, StudentSuccessSupport, TasksService,
} from '../contracts/records';
import type { ChangeRequest, Contact, EnglishTestRegistration, ExtracurricularRecord, FinanceTransaction, MailAttachment, MailFolder, MailMessage, Notification, PlanCourse, RequestKind, RequiredTask } from '../../domain/types';
import { ServiceError } from '../errors';
import { qs, type ApiClient } from './client';
import { cached, nowIso, webUrl } from './util';

type Role = () => 'student' | 'instructor' | 'applicant' | null;

/* ----------------------------- helpers ----------------------------- */

const SERVICE_TYPE_KIND: Record<string, RequestKind> = {
  official_transcript: 'transcript',
  transcript_request: 'transcript',
  enrollment_verification: 'specialLetter',
  leave_of_absence: 'leave',
};

function requestStatus(s: string): ChangeRequest['status'] {
  const v = s.toLowerCase();
  if (v === 'approved' || v === 'completed' || v === 'fulfilled' || v === 'resolved') return 'approved';
  if (v === 'cancelled' || v === 'withdrawn') return 'cancelled';
  if (v === 'rejected' || v === 'declined' || v === 'denied') return 'rejected';
  return 'pending';
}

/** Maps a Heritage web path (from AI sources / notifications) to a native route. */
function routeFor(href: string | undefined, role: 'student' | 'instructor' | 'applicant' | null): { route: string; params?: Record<string, string> } | undefined {
  if (!href) return undefined;
  const h = href.toLowerCase();
  if (role === 'applicant') {
    if (h.includes('document')) return { route: 'ApplicantTabs', params: { screen: 'ApplicantDocumentsTab' } };
    if (h.includes('offer')) return { route: 'ApplicantOffers' };
    if (h.includes('timeline')) return { route: 'ApplicantTimeline' };
    if (h.includes('message') || h.includes('notification')) return { route: 'ApplicantTabs', params: { screen: 'ApplicantMessagesTab' } };
    if (h.includes('application')) return { route: 'ApplicantTabs', params: { screen: 'ApplicantApplicationTab' } };
    return undefined;
  }
  if (role === 'instructor') {
    if (h.includes('grade')) return { route: 'InstructorGradesSubmission' };
    if (h.includes('attendance')) return { route: 'InstructorCourseAttendance' };
    if (h.includes('workshop')) return { route: 'InstructorWorkshopEnrolments' };
    if (h.includes('schedul')) return { route: 'InstructorPendingSchedules' };
    if (h.includes('student')) return { route: 'InstructorStudentList' };
    if (h.includes('section') || h.includes('course')) return { route: 'InstructorMyCourses' };
    return undefined;
  }
  if (h.includes('assignment') || h.includes('assessment')) return { route: 'StudentAssignments' };
  if (h.includes('attendance') || h.includes('compliance')) return { route: 'StudentAttendance' };
  if (h.includes('grade') || h.includes('transcript') || h.includes('marks')) return { route: 'StudentFinalMarks' };
  if (h.includes('degree') || h.includes('plan') || h.includes('program')) return { route: 'StudentProgramPlan' };
  if (h.includes('finance') || h.includes('account') || h.includes('payment')) return { route: 'StudentFinance' };
  if (h.includes('tax')) return { route: 'StudentTaxDocuments' };
  if (h.includes('document')) return { route: 'StudentDocuments' };
  if (h.includes('workshop')) return { route: 'StudentWorkshops' };
  if (h.includes('badge')) return { route: 'StudentBadges' };
  if (h.includes('task') || h.includes('evaluation')) return { route: 'StudentRequiredTasks' };
  if (h.includes('leave')) return { route: 'StudentLeave' };
  if (h.includes('course') || h.includes('lms')) return { route: 'StudentMyCourses' };
  return undefined;
}

interface EvaluationDto {
  id: string;
  courseCode: string;
  courseTitle: string;
  sectionId: string | null;
  status: 'pending' | 'submitted';
  dueAt: string | null;
  submittedAt: string | null;
  overallRating: number | null;
  responses: CourseEvaluation['responses'] | null;
}

const mapEvaluation = (e: EvaluationDto): CourseEvaluation => ({
  id: e.id,
  courseCode: e.courseCode,
  courseTitle: e.courseTitle,
  sectionId: e.sectionId ?? undefined,
  status: e.status,
  dueAt: e.dueAt ?? undefined,
  submittedAt: e.submittedAt ?? undefined,
  overallRating: e.overallRating ?? undefined,
  responses: e.responses ?? undefined,
});

/* ------------------------------ records ----------------------------- */

export function createRecordsApi(api: ApiClient, role: Role) {
  const servicesList = () => api.get<{ requests: { id: string; type: string; subject: string; details: string; status: string; createdAt: string; decidedAt?: string | null; updatedAt?: string | null }[] }>('/student/services');

  async function serviceRequest(kind: RequestKind, type: string, subject: string, details: string, payload: Record<string, unknown>): Promise<ChangeRequest> {
    const r = await api.post<{ request?: { id: string }; id?: string; status?: string }>('/student/services', { type, subject: subject.slice(0, 200), details });
    return {
      id: r.request?.id ?? r.id ?? `req-${Date.now()}`,
      studentId: '',
      kind,
      status: 'pending',
      createdAt: nowIso(),
      reviewer: 'Registrar',
      payload,
      summary: subject,
    };
  }

  const records: RecordsService = {
    async getAcademicProfile() {
      const [plan, credits] = await Promise.all([
        api.get<{ cohort: StudentAcademicProfile['cohort'] }>('/student/program-plan'),
        api.get<{ items: StudentAcademicProfile['transferCredits'] }>('/student/transfer-credits'),
      ]);
      return { cohort: plan.cohort, transferCredits: credits.items };
    },
    getCompliance() {
      return api.get<StudentComplianceOverview>('/student/compliance');
    },
    getDegreeProgress() {
      return api.get<DegreeProgressLite>('/student/degree-progress');
    },
    runDegreeScenario(input) {
      return api.post<DegreeScenarioResult>('/student/degree-scenarios', input);
    },
    async getSuccessSupport() {
      const [caseResponse, appointmentResponse] = await Promise.all([
        api.get<{ items: StudentSuccessSupport['cases'] }>('/student/success/cases'),
        api.get<{ items: StudentSuccessSupport['appointments'] }>('/student/advising/appointments'),
      ]);
      return { cases: caseResponse.items, appointments: appointmentResponse.items };
    },
    async listBadges() {
      const d = await api.get<{ badges: { id: string; code: string; title: string; description: string; status: string; earnedAt: string | null }[] }>('/student/badges');
      return d.badges.map<BadgeWithProgress>(b => {
        const earned = b.status === 'earned' || Boolean(b.earnedAt);
        return {
          id: b.id,
          code: b.code,
          title: b.title,
          description: b.description,
          requirement: { type: 'manual', target: 1 },
          earned,
          progress: { current: earned ? 1 : 0, target: 1 },
          award: earned ? { id: `${b.id}:me`, badgeId: b.id, studentId: '', earnedAt: b.earnedAt ?? undefined } : undefined,
        };
      });
    },
    async listExtracurricular() {
      const d = await api.get<{ records: { id: string; termCode: string; category: string; title: string; detail: string; status: string }[] }>('/student/extracurricular');
      return d.records.map<ExtracurricularRecord>(r => {
        const c = r.category.toLowerCase();
        const category: ExtracurricularRecord['category'] = c.includes('volunt') ? 'Volunteer' : c.includes('athlet') || c.includes('sport') ? 'Athletics' : 'Student leadership';
        return { id: r.id, studentId: '', category, title: r.title, description: r.detail, term: r.termCode, status: 'Recorded', details: r.detail };
      });
    },
    async listPlan() {
      type Row = { id: string; courseCode: string; title: string; status: string; startsOn: string | null; endsOn: string | null; scheduleText: string | null; sectionId: string | null; sortOrder: number; category: string };
      const d = await api.get<{ main: Row[]; practicum: Row[]; makeup: Row[] }>('/student/program-plan');
      return [...(d.main ?? []), ...(d.practicum ?? []), ...(d.makeup ?? [])]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map<PlanCourse>((r, i) => ({
          id: r.id,
          studentId: '',
          order: i + 1,
          code: r.courseCode,
          title: r.title,
          status: r.status === 'completed' ? 'completed' : r.status === 'in_progress' ? 'inProgress' : r.status === 'dropped' || r.status === 'withdrawn' ? 'dropped' : 'notStarted',
          startDate: r.startsOn ?? '',
          endDate: r.endsOn ?? '',
          scheduleLabel: r.scheduleText ?? '',
          campusRoom: r.category === 'practicum' ? 'Practicum placement' : '',
          sectionId: r.sectionId ?? undefined,
          retakeSectionCode: r.category === 'makeup' ? r.scheduleText ?? undefined : undefined,
        }));
    },
    requestTranscript() {
      return serviceRequest('transcript', 'official_transcript', 'Official transcript request', 'Please issue an official transcript. Requested from the Campus One mobile app.', {});
    },
    async listPendingEvaluations() {
      const d = await api.get<{ pendingEvaluations?: { id: string; courseCode: string; courseTitle: string; dueAt: string | null }[] }>('/me/home');
      return (d.pendingEvaluations ?? []).map<CourseEvaluation>(e => ({ id: e.id, courseCode: e.courseCode, courseTitle: e.courseTitle, status: 'pending', dueAt: e.dueAt ?? undefined }));
    },
    async getEvaluation(evaluationId) {
      const d = await api.get<{ evaluation: EvaluationDto }>(`/student/evaluations/${encodeURIComponent(evaluationId)}`);
      return mapEvaluation(d.evaluation);
    },
    async submitEvaluation(evaluationId, input) {
      const body = { ...input, comments: input.comments?.trim() || undefined };
      const d = await api.post<{ evaluation: EvaluationDto }>(`/student/evaluations/${encodeURIComponent(evaluationId)}/submit`, body);
      return mapEvaluation(d.evaluation);
    },
    async listPracticum() {
      const d = await api.get<{ placements: { id: string; programName: string; employerName: string; siteName: string; siteAddress: string | null; supervisorName: string | null; supervisorEmail: string | null; status: string; startsOn: string | null; endsOn: string | null; hours: PracticumPlacement['hours']; evaluations: Array<{ id: string; status: 'due' | 'submitted' | 'reviewed'; score: number | null; notes: string | null }>; incidents: Array<{ id: string; occurredOn: string; category: string; severity: string; status: string; actionTaken: string | null }> }[] }>('/student/practicum');
      return d.placements.map<PracticumPlacement>(p => ({ ...p, siteAddress: p.siteAddress ?? undefined, supervisorName: p.supervisorName ?? undefined, supervisorEmail: p.supervisorEmail ?? undefined, startsOn: p.startsOn ?? undefined, endsOn: p.endsOn ?? undefined, evaluations: p.evaluations.map(e => ({ ...e, score: e.score ?? undefined, notes: e.notes ?? undefined })), incidents: p.incidents.map(i => ({ ...i, actionTaken: i.actionTaken ?? undefined })) }));
    },
    async logPracticumHours(input) {
      if (!input.weekLabel.trim()) throw new ServiceError('VALIDATION', 'Enter the week these hours cover.', { details: { weekLabel: 'Required' } });
      if (!(input.hours > 0 && input.hours <= 80)) throw new ServiceError('VALIDATION', 'Hours must be more than 0 and at most 80 per entry.', { details: { hours: 'Between 0 and 80' } });
      await api.post('/student/practicum/hours', { placementId: input.placementId, weekLabel: input.weekLabel.trim(), hours: input.hours });
    },
    async getCareer() {
      const d = await api.get<{ opportunities: { id: string; title: string; employerName: string; skills: string[]; status: string; href: string | null; updatedAt: string }[]; services: { title: string; body: string; cta: string; href: string | null }[] }>('/student/career');
      return {
        opportunities: d.opportunities.map(o => ({ ...o, href: o.href ?? undefined })),
        services: d.services.map(s => ({ ...s, href: s.href ?? undefined })),
      };
    },
    async getCalendars() {
      type Period = { id: string; code: string; name: string; startsOn: string | null; endsOn: string | null };
      const d = await api.get<{ academicBlocks: Period[]; financialTerms: Period[] }>('/student/calendars');
      const map = (p: Period): CalendarPeriod => ({ id: p.id, code: p.code, name: p.name, startsOn: p.startsOn ?? '', endsOn: p.endsOn ?? '' });
      return { academicBlocks: d.academicBlocks.map(map), financialTerms: d.financialTerms.map(map) };
    },
    async listCredentials() {
      const d = await api.get<{ credentials: { id: string; title: string; status: StudentCredential['status']; detail: string | null; earnedAt: string | null }[]; issuanceEnabled: boolean }>('/student/credentials');
      return { issuanceEnabled: d.issuanceEnabled, credentials: d.credentials.map(c => ({ id: c.id, title: c.title, status: c.status, detail: c.detail ?? undefined, earnedAt: c.earnedAt ?? undefined })) };
    },
  };

  /* ------------------------------- tasks ------------------------------ */

  type TaskDto = { id: string; title: string; detail: string; dueAt: string | null; requestedAt: string; status: string; href: string | null; completedAt: string | null; requirement: RequiredTask['requirement']; approval: RequiredTask['approval'] | null; evidence: { id: string; name: string; sizeBytes: number; mimeType: string } | null };
  const mapTask = (t: TaskDto): RequiredTask => {
    const h = (t.href ?? '').toLowerCase();
    return {
      id: t.id,
      studentId: '',
      category: h.includes('evaluation') ? 'Course evaluation' : h.includes('document') ? 'Documents' : 'Registrar',
      title: t.title,
      description: t.detail,
      requestedAt: t.requestedAt,
      dueNote: t.dueAt ? `Due ${new Date(t.dueAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}` : undefined,
      requirement: t.requirement ?? (h.includes('evaluation') ? 'evaluation' : h.includes('document') || /upload/i.test(t.title) ? 'upload' : 'confirm'),
      status: t.status === 'completed' ? 'completed' : 'pending',
      completedAt: t.completedAt ?? undefined,
      approval: t.approval ?? undefined,
      evidence: t.evidence ? { id: t.evidence.id, name: t.evidence.name, size: t.evidence.sizeBytes, mimeType: t.evidence.mimeType, uri: '' } : undefined,
    };
  };
  const tasks: TasksService = {
    async list() {
      const d = await api.get<{ pending: TaskDto[]; completed: TaskDto[] }>('/student/required-tasks');
      return [...d.pending, ...d.completed].map(mapTask);
    },
    async complete({ taskId, evidence }) {
      if (evidence) {
        const localPath = evidence.uri.startsWith('file://') ? evidence.uri.slice(7) : evidence.uri;
        const base64 = (await RNFS.readFile(localPath, 'base64')).replace(/\s+/g, '');
        await api.request('POST', `/student/required-tasks/${encodeURIComponent(taskId)}/evidence`, { name: evidence.name, mime: evidence.mimeType, base64 }, { timeoutMs: 120_000 });
      } else {
        await api.post(`/student/required-tasks/${encodeURIComponent(taskId)}/complete`, {});
      }
      const all = await tasks.list('');
      const t = all.find(x => x.id === taskId);
      if (!t) throw new ServiceError('NOT_FOUND', 'Task not found');
      return { ...t, evidence };
    },
  };

  /* ----------------------------- documents ---------------------------- */

  const documents: DocumentsService = {
    async list() {
      const d = await api.get<{ items: { id: string; recordName: string; recordDate: string | null; docLabel: string | null; downloadUrl: string | null; status: string }[] }>('/student/documents');
      return d.items.map(x => ({
        id: x.id,
        studentId: '',
        title: x.recordName,
        type: x.docLabel ?? '',
        issuedAt: x.recordDate ?? '',
        status: x.status === 'archived' ? 'archived' : 'available',
        url: x.downloadUrl && !/^\/student\/documents\/?$/.test(x.downloadUrl) ? webUrl(x.downloadUrl) : undefined,
        sizeLabel: '',
      }));
    },
    async listTax() {
      const d = await api.get<{ documents: { id: string; docType: string; taxYear: number; title: string; status: string; issuedAt: string | null; downloadUrl?: string | null }[] }>('/student/tax-documents');
      return d.documents.map(x => ({
        id: x.id,
        studentId: '',
        year: x.taxYear,
        form: 'T2202' as const,
        issuedAt: x.issuedAt ?? '',
        status: x.status === 'archived' ? 'archived' : 'available',
        reportingTerm: `Tax year ${x.taxYear}`,
        sizeLabel: 'PDF',
        pdfPath: x.downloadUrl === null ? undefined : `/student/tax-documents/${encodeURIComponent(x.id)}/pdf`,
      }));
    },
    async downloadTaxPdf(doc) {
      if (!doc.pdfPath) throw new ServiceError('NOT_FOUND', 'This tax slip has no PDF available.');
      const toFile = `${RNFS.DocumentDirectoryPath}/T2202-${doc.year}-${doc.id}.pdf`;
      const res = await RNFS.downloadFile({ fromUrl: api.url(doc.pdfPath), toFile, headers: api.authHeaders() }).promise;
      if (res.statusCode !== 200) throw new ServiceError('SERVER', `Could not download the T2202 slip (HTTP ${res.statusCode}).`);
      return toFile;
    },
    requestSpecialLetter({ purpose, details }) {
      return serviceRequest('specialLetter', 'enrollment_verification', `Special letter: ${purpose}`, details.trim().length >= 10 ? details.trim() : `${purpose}. ${details}`.padEnd(10, ' '), { purpose, details });
    },
  };

  /* ------------------------------ finance ----------------------------- */

  interface FinanceDto {
    summary: { balance: { amountCents: number }; paymentExecutionEnabled: boolean };
    entries: { id: string; label: string; amountCad: number; kind: string; status: string; source: string | null; postedAt: string; financialTermId: string | null }[];
    financialTerms: { id: string; code: string; name: string }[];
    statement: { termName: string; charges: { id: string; label: string; amountCad: number }[]; totalChargesCad: number; gstCad: number; pstCad: number; gstRatePercent: number; pstRatePercent: number; totalPaymentsCad: number; balanceCad: number };
  }
  const financeAll = cached(30_000, () => api.get<FinanceDto>('/student/finance'));

  const finance: FinanceService = {
    async listStatements() {
      const all = await financeAll();
      const perTerm = await Promise.all(
        all.financialTerms.map(t => api.get<FinanceDto>(`/student/finance${qs({ financialTermId: t.id })}`).then(d => ({ t, d })).catch(() => null)),
      );
      const toStatement = (id: string, label: string, s: FinanceDto['statement']) => ({
        id,
        studentId: '',
        termId: id,
        termLabel: label,
        charges: s.charges.map(c => ({ label: c.label, amount: c.amountCad })),
        taxes: [
          ...(s.gstCad ? [{ label: `GST (${s.gstRatePercent}%)`, amount: s.gstCad }] : []),
          ...(s.pstCad ? [{ label: `PST (${s.pstRatePercent}%)`, amount: s.pstCad }] : []),
        ],
        totalCharges: s.totalChargesCad,
        totalTax: (s.gstCad ?? 0) + (s.pstCad ?? 0),
        totalPayments: s.totalPaymentsCad,
        balance: s.balanceCad,
      });
      return [
        toStatement('all', 'All terms', all.statement),
        ...perTerm.filter((x): x is { t: FinanceDto['financialTerms'][number]; d: FinanceDto } => Boolean(x && x.d.statement.charges.length)).map(({ t, d }) => toStatement(t.id, t.code, d.statement)),
      ];
    },
    async listTransactions(_studentId, termId) {
      const all = await financeAll();
      return all.entries
        .filter(e => !termId || termId === 'all' || e.financialTermId === termId)
        .map<FinanceTransaction>(e => ({
          id: e.id,
          studentId: '',
          termId: e.financialTermId ?? 'all',
          date: e.postedAt,
          description: e.status === 'waived' ? `${e.label} (waived · $${Math.abs(e.amountCad).toFixed(2)})` : e.label,
          amount: e.status === 'waived' ? 0 : e.kind === 'payment' || e.kind === 'credit' || e.kind === 'refund' ? Math.abs(e.amountCad) : -Math.abs(e.amountCad),
          kind: e.kind === 'payment' ? 'payment' : 'charge',
          reference: e.source && !/[:/]|^financial-management$|^seed/i.test(e.source) ? e.source : '',
        }))
        .sort((a, b) => b.date.localeCompare(a.date));
    },
    async payBalance() {
      throw new ServiceError('NOT_CONFIGURED', 'Online payments are not enabled yet. Please pay through the Heritage finance office or the web portal.', { retryable: false });
    },
  };

  /* ------------------------------ requests ---------------------------- */

  const localRequests: ChangeRequest[] = [];
  const englishTests: EnglishTestRegistration[] = [];

  /** Decision time is only known when the backend sends it; never derived from "now". */
  const decidedAtOf = (status: ChangeRequest['status'], r: { decidedAt?: string | null; updatedAt?: string | null }) =>
    status === 'pending' ? undefined : r.decidedAt ?? r.updatedAt ?? undefined;

  async function allRequests(): Promise<RequestDetail[]> {
    const [svc, loa] = await Promise.all([
      servicesList().catch(() => ({ requests: [] })),
      api.get<{ requests: { id: string; reason: string; startsOn: string; endsOn: string; status: string; decisionNote?: string | null; createdAt: string; decidedAt?: string | null; updatedAt?: string | null }[] }>('/student/leave-of-absence').catch(() => ({ requests: [] })),
    ]);
    const fromSvc = svc.requests.map<RequestDetail>(r => {
      const kind: RequestKind = SERVICE_TYPE_KIND[r.type] ?? (/^attendance correction/i.test(r.subject) ? 'attendanceCorrection' : /english/i.test(r.subject) ? 'englishTest' : /personal details/i.test(r.subject) ? 'personalDetails' : 'specialLetter');
      const status = requestStatus(r.status);
      return { id: r.id, studentId: '', kind, status, createdAt: r.createdAt, decidedAt: decidedAtOf(status, r), reviewer: 'Student Services', payload: { subject: r.subject, details: r.details }, summary: r.subject };
    });
    const fromLoa = loa.requests.map<RequestDetail>(r => {
      const status = requestStatus(r.status);
      return {
        id: r.id,
        studentId: '',
        kind: 'leave',
        status,
        createdAt: r.createdAt,
        decidedAt: decidedAtOf(status, r),
        decisionNote: r.decisionNote ?? undefined,
        reviewer: 'Registrar',
        payload: { startDate: r.startsOn, endDate: r.endsOn, reason: r.reason },
        summary: `Leave of absence ${r.startsOn} → ${r.endsOn}`,
      };
    });
    const ids = new Set([...fromSvc, ...fromLoa].map(r => r.id));
    return [...localRequests.filter(r => !ids.has(r.id)), ...fromSvc, ...fromLoa].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const requests: RequestsService = {
    async list(_studentId, kind) {
      const all = await allRequests();
      return kind ? all.filter(r => r.kind === kind) : all;
    },
    async get(requestId) {
      const r = (await allRequests()).find(x => x.id === requestId);
      if (!r) throw new ServiceError('NOT_FOUND', 'Request not found');
      return r;
    },
    async submitPersonalDetails({ payload }) {
      const p = payload as Record<string, string | undefined>;
      const body = {
        givenName: p.firstName,
        familyName: p.lastName,
        middleName: p.middleName || undefined,
        preferredName: p.preferredName || undefined,
        primaryEmail: p.email,
        phone: p.phone,
        emergencyContactName: p.emergencyName,
        emergencyContactPhone: p.emergencyPhone,
        reason: 'Personal details update requested from the Campus One mobile app.',
      };
      const r = await api.post<{ approvalRequestId: string; status: string }>('/me/profile-change-requests', body);
      const rest = { ...payload };
      delete rest.sensitiveId;
      const req: ChangeRequest = { id: r.approvalRequestId, studentId: '', kind: 'personalDetails', status: 'pending', createdAt: nowIso(), reviewer: 'Registrar', payload: rest, summary: 'Personal details update' };
      localRequests.unshift(req);
      return req;
    },
    async submitLeave({ startDate, endDate, reason }) {
      const r = await api.post<{ request?: { id: string }; id?: string }>('/student/leave-of-absence', { reason, startsOn: startDate, endsOn: endDate });
      const req: ChangeRequest = { id: r.request?.id ?? r.id ?? `loa-${Date.now()}`, studentId: '', kind: 'leave', status: 'pending', createdAt: nowIso(), reviewer: 'Registrar', payload: { startDate, endDate, reason }, summary: `Leave of absence ${startDate} → ${endDate}` };
      localRequests.unshift(req);
      return req;
    },
    async cancel(requestId) {
      const request = await requests.get(requestId);
      if (request.kind !== 'leave') throw new ServiceError('VALIDATION', 'Only leave-of-absence requests can be withdrawn in the mobile app.');
      if (request.status !== 'pending') throw new ServiceError('CONFLICT', 'Only a pending request can be withdrawn.');
      await api.post(`/student/leave-of-absence/${encodeURIComponent(requestId)}/cancel`, {});
      const local = localRequests.find(item => item.id === requestId);
      if (local) local.status = 'cancelled';
    },
    async registerEnglishTest(input) {
      const { testType, preferredSession, campus, fee, consentAccepted, ...base } = input;
      const lines = [
        'English test registration',
        testType ? `Test type: ${testType}` : '',
        `Name: ${input.fullName}`,
        `Email: ${input.email}`,
        `Phone: ${input.phone}`,
        `Preferred date: ${input.preferredDate}`,
        preferredSession ? `Preferred session: ${preferredSession}` : '',
        campus ? `Campus: ${campus}` : '',
        fee != null ? `Fee: ${fee}` : '',
        `First language: ${input.firstLanguage}`,
        input.accommodation ? `Accommodation: ${input.accommodation}` : '',
        consentAccepted ? 'Consent: student agreed to the registration terms' : '',
      ];
      const details = lines.filter(Boolean).join('\n');
      const r = await serviceRequest('englishTest', 'general_inquiry', `English test registration · ${input.preferredDate}`, details, { ...input });
      const reg: EnglishTestRegistration = { ...base, id: r.id, status: 'pending-review', createdAt: r.createdAt };
      englishTests.unshift(reg);
      return reg;
    },
    async listEnglishTests() {
      const fromServer = (await allRequests())
        .filter(r => r.kind === 'englishTest' && !englishTests.some(e => e.id === r.id))
        .map<EnglishTestRegistration>(r => ({
          id: r.id,
          studentId: '',
          fullName: '',
          email: '',
          phone: '',
          preferredDate: /·\s*(\d{4}-\d{2}-\d{2})/.exec(r.summary)?.[1] ?? '',
          firstLanguage: '',
          status: r.status === 'approved' ? 'scheduled' : 'pending-review',
          createdAt: r.createdAt,
        }));
      return [...englishTests, ...fromServer];
    },
  };

  /* --------------------------- notifications -------------------------- */

  const iconFor = (key: string, title: string): Notification['icon'] => {
    const k = `${key} ${title}`.toLowerCase();
    if (k.includes('grade') || k.includes('mark')) return 'grade';
    if (k.includes('workshop')) return 'workshop';
    if (k.includes('schedule') || k.includes('calendar')) return 'schedule';
    if (k.includes('class') || k.includes('live') || k.includes('video')) return 'video';
    if (k.includes('miss') || k.includes('overdue') || k.includes('warn') || k.includes('compliance') || k.includes('hold')) return 'warning';
    return 'info';
  };
  const categoryFor = (key: string) => {
    const k = key.split('.')[0] ?? '';
    return k ? k.charAt(0).toUpperCase() + k.slice(1) : 'General';
  };

  const notifications: NotificationsService = {
    async list(userId) {
      const d = await api.get<{ items: { id: string; title: string; body: string; readAt: string | null; createdAt: string; templateKey: string | null }[] }>('/notifications/me');
      return d.items.map<Notification>(n => {
        const key = n.templateKey ?? '';
        return {
          id: n.id,
          userId,
          title: n.title,
          body: n.body,
          category: categoryFor(key),
          createdAt: n.createdAt,
          read: Boolean(n.readAt),
          icon: iconFor(key, n.title),
          link: routeFor(key.replace(/\./g, '/'), role()),
        };
      });
    },
    async markRead(_userId, id) {
      await api.patch(`/notifications/me/${encodeURIComponent(id)}/read`, {});
    },
    async markAllRead() {
      await api.post('/notifications/me/read-all', {});
    },
  };

  /* -------------------------------- mail ------------------------------ */

  interface ThreadSummary { id: string; subject: string; preview: string; folderKind: string; participants?: string[]; participantNames?: string[]; otherName?: string; flagged: boolean; updatedAt: string; readAt: string | null }
  type Party = string | { accountId?: string; name?: string; email?: string };
  interface MailAttachmentDto { id: string; name: string; mime: string; sizeBytes: number }
  interface ThreadDetail { id: string; subject: string; folderKind: string; flagged: boolean; from?: Party | null; to?: Party[] | Party; cc?: Party[]; messages: { id: string; from: string; senderAccountId: string; senderName: string; text: string; time: string; attachments?: MailAttachmentDto[] }[] }
  const partyName = (p: Party) => (typeof p === 'string' ? p : p.name || p.email || '');

  const audience = cached(5 * 60_000, async () => {
    const d = await api.get<Record<string, { accountId: string; name: string; group: string }[]>>('/mail/audience');
    const seen = new Map<string, Contact>();
    for (const [group, list] of Object.entries(d)) {
      if (!Array.isArray(list)) continue;
      for (const c of list) {
        if (seen.has(c.accountId)) continue;
        seen.set(c.accountId, { id: c.accountId, name: c.name, email: '', role: group === 'instructors' ? 'instructor' : group === 'staff' ? 'staff' : 'student' });
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  });

  const asFolder = (k: string): MailFolder => (['inbox', 'outbox', 'drafts', 'junk', 'deleted'].includes(k) ? (k as MailFolder) : 'inbox');
  const folderOf = new Map<string, MailFolder>();

  const mimeForName = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    return ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : ext === 'txt' ? 'text/plain' : ext === 'csv' ? 'text/csv' : ext === 'doc' ? 'application/msword' : ext === 'xls' ? 'application/vnd.ms-excel' : ext === 'ppt' ? 'application/vnd.ms-powerpoint' : ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : ext === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : ext === 'pptx' ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : ext === 'zip' ? 'application/zip' : 'application/octet-stream';
  };

  async function encodeMailAttachments(attachments: MailAttachment[]) {
    if (attachments.length > 5) throw new ServiceError('VALIDATION', 'Attach at most 5 files.');
    return Promise.all(attachments.map(async file => {
      if (!file.uri) throw new ServiceError('NOT_FOUND', `The local copy of "${file.name}" is unavailable.`);
      const localPath = file.uri.startsWith('file://') ? file.uri.slice(7) : file.uri;
      const base64 = (await RNFS.readFile(localPath, 'base64')).replace(/\s+/g, '');
      return { name: file.name, mime: file.mimeType || mimeForName(file.name), base64 };
    }));
  }

  async function downloadMailAttachments(threadId: string, messages: ThreadDetail['messages']): Promise<MailAttachment[]> {
    const rows = messages.flatMap(message => message.attachments ?? []);
    return Promise.all(rows.map(async file => {
      try {
        const payload = await api.get<MailAttachmentDto & { base64: string }>(`/mail/threads/${encodeURIComponent(threadId)}/attachments/${encodeURIComponent(file.id)}`);
        const safeName = payload.name.replace(/[\\/]/g, '_');
        const path = `${RNFS.CachesDirectoryPath}/mail-${payload.id}-${safeName}`;
        await RNFS.writeFile(path, payload.base64, 'base64');
        return { id: payload.id, name: payload.name, size: payload.sizeBytes, mimeType: payload.mime, uri: path };
      } catch {
        return { id: file.id, name: file.name, size: file.sizeBytes, mimeType: file.mime };
      }
    }));
  }

  function fromSummary(t: ThreadSummary, folder: MailFolder): MailMessage {
    const me = api.accountId ?? '';
    const others = (t.participants ?? []).filter(p => p !== me);
    const outgoing = folder === 'outbox' || folder === 'drafts';
    const name = t.otherName ?? t.participantNames?.[0] ?? '';
    return {
      id: t.id,
      ownerId: me,
      folder,
      fromId: outgoing ? me : others[0] ?? '',
      fromName: outgoing ? 'Me' : name || 'Campus One',
      toIds: outgoing ? others : [me],
      toNames: outgoing ? [name].filter(Boolean) : ['Me'],
      subject: t.subject,
      body: t.preview,
      attachments: [],
      createdAt: t.updatedAt,
      read: Boolean(t.readAt) || outgoing,
      flagged: t.flagged,
      outboxStatus: folder === 'outbox' ? 'sent' : undefined,
    };
  }

  async function bulk(threadIds: string[], action: string) {
    if (threadIds.length) await api.post('/mail/bulk', { threadIds, action });
  }

  const mail: MailService = {
    async list(_userId, folder) {
      const d = await api.get<{ threads: ThreadSummary[] }>(`/mail${qs({ folderKind: folder })}`);
      return d.threads.map(t => {
        folderOf.set(t.id, folder);
        return fromSummary(t, folder);
      });
    },
    async get(id) {
      const t = await api.get<ThreadDetail>(`/mail/threads/${encodeURIComponent(id)}`);
      const folder = asFolder(t.folderKind ?? folderOf.get(id) ?? 'inbox');
      const me = api.accountId ?? '';
      const first = t.messages[0];
      const outgoing = first ? first.senderAccountId === me : folder === 'outbox' || folder === 'drafts';
      const body = t.messages.length > 1 ? t.messages.map(m => `${m.senderName} · ${new Date(m.time).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}\n${m.text}`).join('\n\n———\n\n') : first?.text ?? '';
      const contacts = await audience().catch(() => [] as Contact[]);
      const idsOf = (list: Party[]) => list.map(p => (typeof p === 'string' ? contacts.find(c => c.name === p)?.id : p.accountId)).filter((x): x is string => Boolean(x));
      const toList = Array.isArray(t.to) ? t.to : t.to ? [t.to] : [];
      const ccList = t.cc ?? [];
      const toNames = toList.map(partyName).filter(Boolean);
      const attachments = await downloadMailAttachments(t.id, t.messages);
      const view: MailMessageView = {
        id: t.id,
        ownerId: me,
        folder,
        fromId: first?.senderAccountId ?? '',
        fromName: outgoing ? 'Me' : first?.senderName || (t.from ? partyName(t.from) : '') || 'Campus One',
        toIds: idsOf(toList),
        toNames: toNames.length ? toNames : outgoing ? [] : ['Me'],
        ccIds: idsOf(ccList),
        ccNames: ccList.map(partyName).filter(Boolean),
        subject: t.subject,
        body,
        attachments,
        createdAt: t.messages[t.messages.length - 1]?.time ?? nowIso(),
        read: true,
        flagged: t.flagged,
        outboxStatus: folder === 'outbox' ? 'sent' : undefined,
      };
      return view;
    },
    listContacts: () => audience(),
    async saveDraft({ draftId, toIds, ccIds, subject, body, attachments }) {
      const files = await encodeMailAttachments(attachments);
      const r = await api.request<{ threadId: string }>('POST', '/mail/compose', { toAccountIds: toIds, ccAccountIds: ccIds?.length ? ccIds : undefined, subject: subject.trim() || '(no subject)', body: body || ' ', asDraft: true, attachments: files.length ? files : undefined }, { timeoutMs: 120_000 });
      if (draftId && draftId !== r.threadId && folderOf.get(draftId) === 'drafts') await bulk([draftId], 'purge').catch(() => undefined);
      folderOf.set(r.threadId, 'drafts');
      return mail.get(r.threadId);
    },
    async send({ draftId, toIds, ccIds, subject, body, attachments }) {
      if (!toIds.length) throw new ServiceError('VALIDATION', 'Add at least one recipient.');
      if (!subject.trim()) throw new ServiceError('VALIDATION', 'Add a subject.');
      const cc = (ccIds ?? []).filter(id => !toIds.includes(id));
      const files = await encodeMailAttachments(attachments);
      const r = await api.request<{ threadId: string }>('POST', '/mail/compose', { toAccountIds: toIds, ccAccountIds: cc.length ? cc : undefined, subject: subject.trim(), body: body.trim() || ' ', attachments: files.length ? files : undefined }, { timeoutMs: 120_000 });
      if (draftId && folderOf.get(draftId) === 'drafts') await bulk([draftId], 'purge').catch(() => undefined);
      folderOf.set(r.threadId, 'outbox');
      return mail.get(r.threadId);
    },
    async processOutbox() {
      return [];
    },
    retry: id => mail.get(id),
    markRead: (id, read) => bulk([id], read ? 'mark_read' : 'mark_unread'),
    flag: (id, flagged) => bulk([id], flagged ? 'flag' : 'unflag'),
    async move(ids, folder) {
      if (folder === 'deleted') {
        await bulk(ids, 'delete');
        ids.forEach(id => folderOf.set(id, 'deleted'));
        return;
      }
      if (folder === 'junk') {
        await bulk(ids, 'move_junk');
        ids.forEach(id => folderOf.set(id, 'junk'));
        return;
      }
      if (folder === 'inbox') {
        const fromJunk = ids.filter(i => folderOf.get(i) === 'junk');
        const fromDeleted = ids.filter(i => folderOf.get(i) !== 'junk');
        await bulk(fromJunk, 'mark_not_junk');
        await bulk(fromDeleted, 'restore');
        ids.forEach(id => folderOf.set(id, 'inbox'));
        return;
      }
      throw new ServiceError('NOT_CONFIGURED', `Moving messages to ${folder} is not supported.`);
    },
    async deletePermanently(ids) {
      await bulk(ids, 'purge');
      ids.forEach(id => folderOf.delete(id));
    },
  };

  /* ---------------------------- Ask Heritage -------------------------- */

  interface CoachDto { interactionId: string; answer: string; sources: { id: string; title: string; uri: string }[]; suggestedActions: { label: string; href: string }[]; claims?: { kind: string; text: string }[]; createdAt: string; question?: string; feedback?: 'up' | 'down' }

  function toAnswer(d: CoachDto, question: string): AskHeritageAnswer {
    const r = role();
    const kinds = ['FACT', 'INFERENCE', 'CONFLICT', 'UNCERTAINTY'];
    const facts = (d.claims ?? [])
      .map(c => ({ kind: (kinds.includes(c.kind.toUpperCase()) ? c.kind.toUpperCase() : 'FACT') as AskHeritageAnswer['facts'][number]['kind'], text: c.text }));
    const [assessment, ...rest] = d.answer.split(/\n\s*\n/);
    return {
      id: d.interactionId,
      question,
      createdAt: d.createdAt,
      context: r === 'instructor' ? 'Instructor workspace' : 'Your Campus One record',
      assessment: assessment ?? d.answer,
      facts: facts.length ? facts : rest.filter(Boolean).map(text => ({ kind: 'FACT' as const, text })),
      actions: d.suggestedActions.map(a => ({ label: a.label, ...(routeFor(a.href, r) ?? { route: r === 'instructor' ? 'InstructorDashboard' : r === 'applicant' ? 'ApplicantTabs' : 'StudentHomeTab' }) })),
      sources: d.sources.map(s => ({ label: s.title, ...(routeFor(s.uri, r) ?? {}) })),
      feedback: d.feedback,
    };
  }

  const askHeritage: AskHeritageService = {
    async suggestions() {
      const contextPath = role() === 'instructor' ? '/instructor' : role() === 'applicant' ? '/applicant' : '/student';
      const d = await api.get<{ suggestions: string[] }>(`/ai/suggestions${qs({ contextPath })}`);
      return d.suggestions;
    },
    async ask(_userId, question) {
      const key = `co-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const d = await api.post<CoachDto>('/ai/ask', { question: question.trim(), contextPath: role() === 'instructor' ? '/instructor' : role() === 'applicant' ? '/applicant' : '/student' }, { 'Idempotency-Key': key });
      return toAnswer(d, question.trim());
    },
    async history() {
      const d = await api.get<{ items: CoachDto[] }>('/ai/history');
      return d.items.map(i => toAnswer(i, i.question ?? '')).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async feedback(_userId, answerId, value) {
      await api.post(`/ai/interactions/${encodeURIComponent(answerId)}/feedback`, { value });
    },
  };

  return { records, tasks, documents, finance, requests, notifications, mail, askHeritage, invalidate: () => { financeAll.invalidate(); audience.invalidate(); } };
}
