import * as RNFS from '@dr.pogodin/react-native-fs';
import type { AssignmentRules, AssignmentsService, AssignmentWithContext, AttendanceService, CoursesService, GradesService, SectionWithCourse, WorkshopsService, WorkshopWithStatus } from '../contracts/academics';
import type { AiDraftStoryboard, AttendanceRecord, ClassSession, FinalMark, Mark, Material, SectionDay, Submission, SubmissionAttachment, Term, WorkshopEnrolment } from '../../domain/types';
import { ServiceError } from '../errors';
import type { ApiClient } from './client';
import { cached, dateOnly, mapCourseRow, nowIso, webUrl, type CourseRowDto } from './util';
import type { InstructorApi } from './instructor';

/* ------------------------------ DTOs ------------------------------ */

interface AssignmentDto {
  id: string;
  sectionId: string;
  courseCode: string;
  courseTitle: string;
  title: string;
  dueAt: string | null;
  maxScore: number | null;
  weightPercent: number | null;
  state: string;
  submission: { id: string; status: 'draft' | 'submitted' | 'returned'; submittedAt: string | null; files: { id: string; filename: string; mimeType: string; sizeBytes: number; createdAt?: string }[]; textBody: string | null } | null;
  instructions: string | null;
  grade: { score: number | null; maxScore?: number | null; letter?: string | null; feedback?: string | null; publishedAt?: string | null } | null;
  onlineText?: boolean;
  fileSubmissions?: boolean;
  availableFrom?: string | null;
  cutoffAt?: string | null;
  maxFiles?: number | null;
  maxFileBytes?: number | null;
  acceptedTypes?: string[];
}

/** File types the student upload endpoint accepts (it derives the MIME type from the extension). */
const UPLOAD_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.zip': 'application/zip',
};
const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 180_000;

interface GradesDto {
  courses: {
    sectionId: string;
    code: string;
    title: string;
    credits: number;
    currentPercent: number | null;
    letter: string | null;
    items: { id: string; score: number | null; maxScore: number; letter: string | null; status: string; publishedAt: string | null; title: string; weightPercent: number; feedback: string | null }[];
  }[];
}

interface LmsDto {
  dayBlocks?: { id: string; label: string; title: string; sortOrder: number; lessons: { id: string; title: string; body: string; resourceHref: string | null; sortOrder: number; completed: boolean }[] }[];
  topics?: { id: string; title: string; activities: { id: string; type: string; name: string; hidden?: boolean; joinUrl?: string | null; storyboard?: AiDraftStoryboard }[] }[];
  folders?: { id: string; name: string; items: { id: string; title: string; kind: string; href: string | null; sizeLabel?: string }[] }[];
  gradeScheme?: { title: string; weightPercent: number }[];
  syllabus?: { id: string; title: string; level: number }[];
  location?: string;
  joinUrl?: string | null;
}

interface ContentDto {
  items: { id: string; kind: string; title: string; detail: string; href: string | null; joinUrl: string | null; completed: boolean }[];
}

interface WorkshopDto {
  id: string;
  code: string;
  title: string;
  description: string;
  creditsCeu: number;
  startsAt: string;
  endsAt: string;
  location: string | null;
  capacity: number;
  registeredCount: number;
  status: string;
  registrationStatus: string;
  joinUrl: string | null;
}

const COLORS = ['#0F4C3A', '#D4A017', '#E2725B', '#3B82F6', '#8B5CF6', '#10B981'];

const activityKind = (type: string): Material['kind'] => (/quiz/i.test(type) ? 'quiz' : /folder/i.test(type) ? 'folder' : /file|resource|pdf/i.test(type) ? 'file' : 'page');
const topicDays = (topics: NonNullable<LmsDto['topics']>, start: number): SectionDay[] =>
  topics
    .map(t => ({ ...t, activities: t.activities.filter(a => !a.hidden) }))
    .filter(t => t.activities.length)
    .map((t, i) => ({ id: t.id, index: start + i + 1, label: t.title, materials: t.activities.map<Material>(a => ({ id: a.id, kind: activityKind(a.type), title: a.name, url: webUrl(a.joinUrl), storyboard: a.storyboard?.slides?.length ? a.storyboard : undefined })) }));

/* ---------------------------- Courses ----------------------------- */

export function createAcademicsApi(api: ApiClient, role: () => 'student' | 'instructor' | 'applicant' | null, instructor: () => InstructorApi) {
  const studentCourses = cached(60_000, async () => {
    const d = await api.get<{ courses: CourseRowDto[] }>('/courses/me');
    return d.courses.map(c => mapCourseRow(c));
  });
  const lmsCache = new Map<string, Promise<LmsDto | null>>();
  const lms = (sectionId: string) => {
    if (!lmsCache.has(sectionId)) {
      const p = api.get<LmsDto>(`/student/courses/${encodeURIComponent(sectionId)}/lms`).catch(() => null);
      lmsCache.set(sectionId, p);
    }
    return lmsCache.get(sectionId)!;
  };

  const sections = () => (role() === 'instructor' ? instructor().sections() : studentCourses());

  async function sectionById(id: string): Promise<SectionWithCourse> {
    const all = await sections();
    const s = all.find(x => x.id === id);
    if (!s) throw new ServiceError('NOT_FOUND', 'Course section not found');
    return s;
  }

  async function enrich(s: SectionWithCourse): Promise<SectionWithCourse> {
    if (role() === 'instructor') {
      const c = await instructor().sectionContent(s.id).catch(() => null);
      if (!c) return s;
      return {
        ...s,
        days: topicDays(c.topics, 0),
        evaluation: c.evaluation.map((e, i) => ({ ...e, color: COLORS[i % COLORS.length] })),
        liveRoomReady: c.liveRoomReady,
        joinUrl: c.joinUrl,
        location: s.location || c.location || '',
      };
    }
    if (role() !== 'student') return s;
    const d = await lms(s.id);
    if (!d) return s;
    const days: SectionDay[] = (d.dayBlocks ?? []).map((b, i) => ({
      id: b.id,
      index: i + 1,
      label: b.label,
      note: b.title,
      materials: b.lessons.map<Material>(l => ({ id: l.id, kind: 'page', title: l.title, fileName: l.body || undefined, url: webUrl(l.resourceHref), status: l.completed ? 'Completed' : undefined })),
    }));
    for (const f of d.folders ?? []) {
      days.push({
        id: f.id,
        index: days.length + 1,
        label: f.name,
        materials: f.items.map<Material>(it => ({ id: it.id, kind: it.kind === 'folder' ? 'folder' : 'file', title: it.title, fileName: it.sizeLabel ?? undefined, url: webUrl(it.href) })),
      });
    }
    days.push(...topicDays(d.topics ?? [], days.length));
    return {
      ...s,
      days,
      evaluation: (d.gradeScheme ?? []).map((g, i) => ({ label: g.title, weight: g.weightPercent, color: COLORS[i % COLORS.length] })),
      objectives: (d.syllabus ?? []).map(x => x.title).join('\n'),
      liveRoomReady: Boolean(d.joinUrl),
      joinUrl: webUrl(d.joinUrl),
      location: s.location || d.location || '',
    };
  }

  const courses: CoursesService = {
    async listStudentSections() {
      return studentCourses();
    },
    async listInstructorSections() {
      return instructor().sections();
    },
    async getSection(sectionId) {
      return enrich(await sectionById(sectionId));
    },
    async listSessions(sectionId) {
      if (role() === 'instructor') return instructor().sessions(sectionId);
      const d = await api.get<ContentDto>(`/student/courses/${encodeURIComponent(sectionId)}/content`).catch(() => ({ items: [] }));
      const s = await sectionById(sectionId).catch(() => null);
      return d.items
        .filter(i => i.kind === 'lecture' || i.id.startsWith('session:'))
        .map<ClassSession>(i => {
          const iso = /\d{4}-\d{2}-\d{2}T[\d:.]+Z/.exec(i.detail)?.[0];
          const start = iso ? new Date(iso) : null;
          return {
            id: i.id.replace(/^session:/, ''),
            sectionId,
            date: iso ? dateOnly(iso) : '',
            startTime: start ? `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}` : s?.startTime ?? '',
            endTime: s?.endTime ?? '',
            topic: i.title,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    async listRoster(sectionId) {
      return instructor().roster(sectionId);
    },
    async listTerms() {
      const all = await sections();
      const map = new Map<string, Term>();
      all.forEach(s => map.set(s.term.id, s.term));
      return [...map.values()];
    },
    async updateSectionContent() {
      throw new ServiceError('NOT_CONFIGURED', 'Course content is edited on the Heritage web portal.');
    },
  };

  /* -------------------------- Assignments -------------------------- */

  function submissionFrom(a: AssignmentDto): Submission | undefined {
    const sub = a.submission;
    if (!sub) return undefined;
    const files: SubmissionAttachment[] = sub.files.map(f => ({ id: f.id, name: f.filename, size: f.sizeBytes, mimeType: f.mimeType, uri: '' }));
    const late = sub.submittedAt && a.dueAt ? new Date(sub.submittedAt) > new Date(a.dueAt) : false;
    const status: Submission['status'] = a.grade?.score != null ? 'graded' : sub.status === 'returned' ? 'returned' : sub.status === 'submitted' ? (late ? 'late' : 'submitted') : 'draft';
    const lastFile = sub.files.map(f => f.createdAt ?? '').sort().pop();
    return {
      id: sub.id,
      assignmentId: a.id,
      studentId: '',
      status,
      attachments: files,
      note: sub.textBody ?? undefined,
      submittedAt: sub.submittedAt ?? undefined,
      receiptId: sub.submittedAt ? `RCPT-${sub.id.slice(0, 8).toUpperCase()}` : undefined,
      // Stable across refetches so the editor only resets when the server copy really changes.
      updatedAt: sub.submittedAt ?? `${lastFile || sub.id}#${sub.files.length}#${(sub.textBody ?? '').length}`,
    };
  }

  function rulesFrom(a: AssignmentDto): AssignmentRules {
    const now = Date.now();
    const closesAt = a.cutoffAt ?? a.dueAt ?? undefined;
    const notYet = a.availableFrom ? new Date(a.availableFrom).getTime() > now : false;
    const closed = closesAt ? new Date(closesAt).getTime() < now : false;
    return {
      onlineText: a.onlineText ?? false,
      fileSubmissions: a.fileSubmissions ?? true,
      maxFiles: a.maxFiles ?? undefined,
      maxFileBytes: a.maxFileBytes ?? undefined,
      acceptedTypes: (a.acceptedTypes ?? []).map(t => t.toLowerCase()),
      availableFrom: a.availableFrom ?? undefined,
      closesAt,
      open: !notYet && !closed,
    };
  }

  async function toContext(a: AssignmentDto, all?: SectionWithCourse[]): Promise<AssignmentWithContext> {
    const list = all ?? (await sections());
    const section = list.find(s => s.id === a.sectionId) ?? mapCourseRow({ sectionId: a.sectionId, courseCode: a.courseCode, courseTitle: a.courseTitle, sectionCode: a.courseCode, termName: null, credits: null, instructorName: null });
    const submission = submissionFrom(a);
    const released = a.grade?.score != null;
    const mark: Mark | undefined = released
      ? { id: `${a.id}:me`, gradeItemId: a.id, sectionId: a.sectionId, studentId: '', score: a.grade!.score ?? undefined, status: 'released', feedback: a.grade!.feedback ?? undefined, updatedAt: a.grade!.publishedAt ?? nowIso() }
      : undefined;
    const derivedStatus: AssignmentWithContext['derivedStatus'] = released ? 'graded' : submission?.status === 'returned' ? 'returned' : submission?.status === 'late' ? 'late' : submission?.status === 'submitted' ? 'submitted' : submission?.attachments.length || submission?.note?.trim() ? 'draft' : 'upcoming';
    return {
      id: a.id,
      sectionId: a.sectionId,
      title: a.title,
      description: a.instructions ?? '',
      points: a.maxScore ?? 100,
      weightPct: a.weightPercent ?? 0,
      dueAt: a.dueAt ?? undefined,
      gradeItemId: a.id,
      section,
      submission,
      mark,
      derivedStatus,
      rules: rulesFrom(a),
    };
  }

  /** POSTs JSON with upload progress (XMLHttpRequest); falls back to fetch where XHR is unavailable. */
  function postWithProgress<T>(path: string, body: Record<string, unknown>, onProgress?: (p: number) => void): Promise<T> {
    if (typeof XMLHttpRequest === 'undefined') return api.request<T>('POST', path, body, { timeoutMs: UPLOAD_TIMEOUT_MS });
    return new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', api.url(path));
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.setRequestHeader('Content-Type', 'application/json');
      Object.entries(api.authHeaders()).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.timeout = UPLOAD_TIMEOUT_MS;
      if (onProgress) {
        xhr.upload.onprogress = e => {
          if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
        };
      }
      xhr.onload = () => {
        let json: unknown;
        try {
          json = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
        } catch {
          json = undefined;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(json as T);
          return;
        }
        const err = (json as { error?: { message?: string } | string } | undefined)?.error;
        const message = (typeof err === 'string' ? err : err?.message) || `Upload failed (HTTP ${xhr.status}).`;
        const code = xhr.status === 401 ? 'UNAUTHENTICATED' : xhr.status === 403 ? 'PERMISSION_DENIED' : xhr.status === 404 ? 'NOT_FOUND' : xhr.status === 409 ? 'CONFLICT' : xhr.status === 400 || xhr.status === 413 || xhr.status === 422 ? 'VALIDATION' : 'SERVER';
        reject(new ServiceError(code, message));
      };
      xhr.onerror = () => reject(new ServiceError('NETWORK', 'The upload was interrupted. Check your internet connection and try again.'));
      xhr.ontimeout = () => reject(new ServiceError('TIMEOUT', 'The upload timed out. Try again on a stronger connection.'));
      xhr.send(JSON.stringify(body));
    });
  }

  function checkFile(file: SubmissionAttachment, rules: AssignmentRules) {
    const ext = /\.[^.]+$/.exec(file.name)?.[0]?.toLowerCase() ?? '';
    if (!rules.fileSubmissions) throw new ServiceError('VALIDATION', 'This assignment accepts online text only, not file uploads.');
    if (!UPLOAD_MIME[ext]) throw new ServiceError('VALIDATION', `"${file.name}" is not an accepted type. Upload a PDF, Word, Excel, CSV, PNG, JPEG or ZIP file.`);
    if (rules.acceptedTypes.length && !rules.acceptedTypes.includes(ext)) throw new ServiceError('VALIDATION', `This assignment only accepts ${rules.acceptedTypes.join(', ')} files.`);
    const limit = Math.min(rules.maxFileBytes ?? UPLOAD_MAX_BYTES, UPLOAD_MAX_BYTES);
    if (file.size > limit) throw new ServiceError('VALIDATION', `"${file.name}" is ${(file.size / 1048576).toFixed(1)} MB. This assignment accepts files up to ${Math.round(limit / 1048576)} MB.`);
  }

  async function uploadAttachment(assignmentId: string, file: SubmissionAttachment, onProgress?: (p: number) => void) {
    const path = decodeURI(file.uri.replace(/^file:\/\//, ''));
    const contentBase64 = (await RNFS.readFile(path, 'base64')).replace(/\s+/g, '');
    const padding = contentBase64.endsWith('==') ? 2 : contentBase64.endsWith('=') ? 1 : 0;
    const sizeBytes = (contentBase64.length / 4) * 3 - padding;
    const ext = /\.[^.]+$/.exec(file.name)?.[0]?.toLowerCase() ?? '';
    if (sizeBytes > UPLOAD_MAX_BYTES) throw new ServiceError('VALIDATION', `"${file.name}" is larger than 10 MB.`);
    await postWithProgress(`/student/assignments/${encodeURIComponent(assignmentId)}/files`, { filename: file.name, mimeType: UPLOAD_MIME[ext] ?? file.mimeType, sizeBytes, contentBase64 }, onProgress);
  }

  const getAssignment = async (id: string) => (await api.get<{ assignment: AssignmentDto }>(`/student/assignments/${encodeURIComponent(id)}`)).assignment;

  /**
   * Makes the server draft match the editor: removes server files the student deleted,
   * uploads newly picked local files (with byte progress), then saves the online text.
   */
  async function syncDraft(a: AssignmentDto, attachments: SubmissionAttachment[], note: string | undefined, onProgress?: (p: number) => void) {
    const rules = rulesFrom(a);
    if (a.grade?.score != null) throw new ServiceError('CONFLICT', 'This assignment has been graded and can no longer be changed.');
    if (a.submission && a.submission.status !== 'draft') throw new ServiceError('CONFLICT', 'This assignment has already been submitted.');
    if (!rules.open) throw new ServiceError('CONFLICT', rules.availableFrom && new Date(rules.availableFrom).getTime() > Date.now() ? 'Submissions for this assignment have not opened yet.' : 'The submission deadline has passed.');
    const server = a.submission?.files ?? [];
    const keep = new Set(attachments.map(f => f.id));
    const removed = server.filter(f => !keep.has(f.id));
    const fresh = attachments.filter(f => f.uri && !server.some(s => s.id === f.id));
    fresh.forEach(f => checkFile(f, rules));
    if (rules.maxFiles && server.length - removed.length + fresh.length > rules.maxFiles) {
      throw new ServiceError('VALIDATION', `This assignment accepts at most ${rules.maxFiles} file${rules.maxFiles === 1 ? '' : 's'}.`);
    }
    for (const f of removed) await api.del(`/student/submission-files/${encodeURIComponent(f.id)}`);
    const total = fresh.reduce((n, f) => n + Math.max(f.size, 1), 0);
    let done = 0;
    for (const f of fresh) {
      await uploadAttachment(a.id, f, p => onProgress?.((done + p * Math.max(f.size, 1)) / total));
      done += Math.max(f.size, 1);
      onProgress?.(done / total);
    }
    const text = note ?? '';
    if (rules.onlineText && text !== (a.submission?.textBody ?? '')) {
      await api.put(`/student/assignments/${encodeURIComponent(a.id)}/text`, { text });
    }
    return { uploaded: fresh.length, removed: removed.length };
  }

  const emptyDraft = (assignmentId: string): Submission => ({ id: `draft:${assignmentId}`, assignmentId, studentId: '', status: 'draft', attachments: [], updatedAt: '' });

  const assignments: AssignmentsService = {
    async listForStudent() {
      const [d, all] = await Promise.all([api.get<{ assignments: AssignmentDto[] }>('/student/assignments'), studentCourses()]);
      return Promise.all(d.assignments.map(a => toContext(a, all)));
    },
    async get(assignmentId) {
      return toContext(await getAssignment(assignmentId));
    },
    async saveDraft({ assignmentId, attachments, note }) {
      await syncDraft(await getAssignment(assignmentId), attachments, note);
      return submissionFrom(await getAssignment(assignmentId)) ?? emptyDraft(assignmentId);
    },
    async submit({ assignmentId, attachments, note, onProgress }) {
      const a = await getAssignment(assignmentId);
      if (a.submission?.status === 'submitted') throw new ServiceError('CONFLICT', 'This assignment has already been submitted.');
      const hasText = Boolean(a.onlineText && note?.trim());
      if (!attachments.length && !hasText) throw new ServiceError('VALIDATION', a.onlineText ? 'Upload a file or write your online text before submitting.' : 'Attach your completed document to enable submission.');
      onProgress?.(0);
      await syncDraft(a, attachments, note, p => onProgress?.(p * 0.9));
      await api.post(`/student/assignments/${encodeURIComponent(assignmentId)}/submit`, {});
      onProgress?.(1);
      return submissionFrom(await getAssignment(assignmentId)) ?? emptyDraft(assignmentId);
    },
    async downloadAttachment(file) {
      if (file.uri) return file.uri.replace(/^file:\/\//, '');
      const d = await api.request<{ name: string; mime: string; base64: string }>('GET', `/student/submission-files/${encodeURIComponent(file.id)}`, undefined, { timeoutMs: UPLOAD_TIMEOUT_MS });
      const safe = (d.name || file.name).replace(/[/\\]/g, '_');
      const dir = `${RNFS.CachesDirectoryPath}/submissions/${file.id}`;
      await RNFS.mkdir(dir);
      const path = `${dir}/${safe}`;
      await RNFS.writeFile(path, d.base64, 'base64');
      return path;
    },
    async listSubmissionsForSection(sectionId) {
      return instructor().submissions(sectionId);
    },
  };

  /* ----------------------------- Grades ----------------------------- */

  const myGrades = cached(60_000, () => api.get<GradesDto>('/grades/me'));
  const gradePointsFor = (letter: FinalMark['grade']): number | undefined => ({
    A: 4,
    'A-': 3.7,
    'B+': 3.3,
    B: 3,
    'B-': 2.7,
    'C+': 2.3,
    C: 2,
    D: 1,
    F: 0,
  } as Partial<Record<FinalMark['grade'], number>>)[letter];

  const grades: GradesService = {
    listGradeItems: sectionId => instructor().gradeItems(sectionId),
    addGradeItem: input => instructor().addGradeItem(input),
    listMarks: sectionId => instructor().marks(sectionId),
    async listStudentMarks() {
      const d = await myGrades();
      return d.courses.flatMap(c =>
        c.items
          .filter(i => i.status === 'published' && i.score != null)
          .map<Mark>(i => ({ id: i.id, gradeItemId: i.id, sectionId: c.sectionId, studentId: '', score: i.score ?? undefined, status: 'released', feedback: i.feedback ?? undefined, updatedAt: i.publishedAt ?? nowIso() })),
      );
    },
    saveDraftMarks: input => instructor().saveDraftMarks(input),
    submitMarks: sectionId => instructor().submitMarks(sectionId),
    releaseMarks: sectionId => instructor().releaseMarks(sectionId),
    async listFinalMarks() {
      const [d, all] = await Promise.all([myGrades(), studentCourses()]);
      return d.courses.map<FinalMark>(c => {
        const s = all.find(x => x.id === c.sectionId);
        const done = s?.status === 'Completed';
        const letter = (c.letter ?? (done ? 'I' : 'IP')) as FinalMark['grade'];
        return {
          id: c.sectionId,
          studentId: '',
          courseCode: c.code,
          courseTitle: c.title,
          programId: '',
          termId: s?.termId ?? '',
          startDate: s?.startDate ?? '',
          endDate: s?.endDate ?? '',
          credits: c.credits,
          grade: letter,
          gradePoints: gradePointsFor(letter),
          scorePct: c.currentPercent ?? undefined,
          status: s?.status === 'Completed' ? 'Completed' : 'In Progress',
        };
      });
    },
    exportGradesCsv: sectionId => instructor().exportCsv(sectionId),
  };

  /* --------------------------- Attendance --------------------------- */

  interface AttendanceDto {
    records: { id: string; sectionId: string; courseCode: string; meetingLabel: string; status: string; recordedAt: string; note: string }[];
  }
  type CorrectionDto = { id: string; type: string; subject: string; details: string; status: string; createdAt: string };
  const correctionRecordId = (details: string) => /^\[attendance-record:([^\]]+)\]/.exec(details)?.[1] ?? '';
  const correctionReason = (details: string) => details.replace(/^\[attendance-record:[^\]]+\]\s*/, '').replace(/^Attendance correction request[^\n]*\n*/i, '').trim();
  const correctionStatus = (status: string): 'pending' | 'approved' | 'rejected' => /resolved|approved|completed/i.test(status) ? 'approved' : /reject|cancel/i.test(status) ? 'rejected' : 'pending';
  const listCorrectionRows = async () => {
    const d = await api.get<{ requests: CorrectionDto[] }>('/student/services');
    return d.requests.filter(r => /^attendance correction\b/i.test(r.subject) && correctionRecordId(r.details));
  };

  const attendance: AttendanceService = {
    async listStudentRecords() {
      const [d, all] = await Promise.all([api.get<AttendanceDto>('/student/attendance'), studentCourses()]);
      return d.records.map(r => {
        const section = all.find(s => s.id === r.sectionId) ?? mapCourseRow({ sectionId: r.sectionId, courseCode: r.courseCode, courseTitle: r.courseCode, sectionCode: r.courseCode, termName: null, credits: null, instructorName: null });
        const date = /^\d{4}-\d{2}-\d{2}/.test(r.meetingLabel) ? r.meetingLabel.slice(0, 10) : dateOnly(r.recordedAt);
        const status = (['present', 'absent', 'late', 'excused'].includes(r.status) ? r.status : 'present') as AttendanceRecord['status'];
        const rec: AttendanceRecord & { session: ClassSession; section: SectionWithCourse } = {
          id: r.id,
          sessionId: `${r.sectionId}:${date}`,
          sectionId: r.sectionId,
          studentId: '',
          status,
          note: r.note || undefined,
          state: 'submitted',
          recordedAt: r.recordedAt,
          session: { id: `${r.sectionId}:${date}`, sectionId: r.sectionId, date, startTime: section.startTime, endTime: section.endTime, topic: r.meetingLabel },
          section,
        };
        return rec;
      });
    },
    async requestCorrection({ studentId, recordId, reason }) {
      if (!reason.trim()) throw new ServiceError('VALIDATION', 'Describe what was recorded incorrectly.');
      const existing = await listCorrectionRows();
      if (existing.some(r => correctionRecordId(r.details) === recordId && correctionStatus(r.status) === 'pending')) throw new ServiceError('CONFLICT', 'A correction request for this session is already pending.');
      const records = await attendance.listStudentRecords(studentId);
      const rec = records.find(r => r.id === recordId);
      const subject = `Attendance correction · ${rec?.section.course.code ?? 'class'} ${rec?.session.date ?? ''}`.trim();
      const response = await api.post<{ requests: CorrectionDto[] }>('/student/services', { type: 'general_inquiry', subject: subject.slice(0, 200), details: `[attendance-record:${recordId}]\nAttendance correction request for ${rec?.section.course.code ?? ''} on ${rec?.session.date ?? ''} (recorded: ${rec?.status ?? 'unknown'}).\n\n${reason.trim()}` });
      const saved = response.requests[0];
      if (!saved) throw new ServiceError('SERVER', 'The correction request was not returned by the server.');
      return { id: saved.id, studentId, recordId, reason: reason.trim(), status: correctionStatus(saved.status), createdAt: saved.createdAt };
    },
    async listCorrections(studentId) {
      return (await listCorrectionRows()).map(r => ({ id: r.id, studentId, recordId: correctionRecordId(r.details), reason: correctionReason(r.details), status: correctionStatus(r.status), createdAt: r.createdAt }));
    },
    listForDate: (instructorId, date, sectionId) => instructor().attendanceForDate(date, sectionId),
    saveDraft: input => instructor().saveAttendance(input, false),
    submit: input => instructor().saveAttendance(input, true),
    sectionSummary: sectionId => instructor().attendanceSummary(sectionId),
  };

  /* ---------------------------- Workshops --------------------------- */

  const workshopLists = cached(30_000, () => api.get<{ available: WorkshopDto[]; mine: WorkshopDto[]; completed: WorkshopDto[] }>('/student/workshops'));

  function mapWorkshop(w: WorkshopDto): WorkshopWithStatus {
    const start = new Date(w.startsAt);
    const end = new Date(w.endsAt);
    const span = (end.getTime() - start.getTime()) / 3_600_000;
    // Daily session length; wraps when the session crosses midnight in the device time zone.
    const daily = (((end.getHours() * 60 + end.getMinutes() - start.getHours() * 60 - start.getMinutes()) % 1440) + 1440) % 1440 / 60;
    const hours = Math.max(0, Math.round((span > 24 ? daily : span) * 2) / 2);
    const online = Boolean(w.joinUrl) || /online|zoom|teams/i.test(w.location ?? '');
    const reg = w.registrationStatus;
    const myStatus: WorkshopEnrolment['status'] | null = reg === 'registered' || reg === 'approved' ? 'approved' : reg === 'pending' || reg === 'waitlisted' ? 'pending' : reg === 'completed' ? 'completed' : reg === 'declined' ? 'declined' : reg === 'cancelled' || reg === 'dropped' ? 'dropped' : null;
    return {
      id: w.id,
      code: w.code,
      title: w.title,
      category: 'Workshop',
      description: w.description,
      date: dateOnly(w.startsAt),
      endDate: dateOnly(w.endsAt) !== dateOnly(w.startsAt) ? dateOnly(w.endsAt) : undefined,
      startTime: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
      durationHours: hours,
      ceu: w.creditsCeu,
      mode: online ? 'Online' : 'In person',
      location: w.location ?? '',
      capacity: w.capacity,
      instructor: '',
      requiresApproval: false,
      agenda: [],
      materials: [],
      joinUrlLabel: online ? 'Online session' : '',
      joinUrl: w.joinUrl ?? undefined,
      registeredCount: w.registeredCount,
      myEnrolment: myStatus ? { id: `${w.id}:me`, workshopId: w.id, studentId: '', status: myStatus, requestedAt: w.startsAt } : undefined,
    };
  }

  async function allWorkshops() {
    const d = await workshopLists();
    const seen = new Map<string, WorkshopWithStatus>();
    [...d.mine, ...d.available, ...d.completed].forEach(w => {
      if (!seen.has(w.id)) seen.set(w.id, mapWorkshop(w));
    });
    return [...seen.values()];
  }

  const workshops: WorkshopsService = {
    async list() {
      return allWorkshops();
    },
    async get(workshopId) {
      if (role() === 'instructor') {
        // Instructors have no workshop-detail endpoint; the t40 enrolment screen is their source of truth.
        const rows = (await instructor().workshopEnrolments()).filter(e => e.workshopId === workshopId);
        if (!rows.length) throw new ServiceError('NOT_FOUND', 'Workshop not found');
        return { ...(rows[0].workshop as WorkshopWithStatus), registeredCount: rows.filter(e => e.status === 'approved' || e.status === 'completed').length };
      }
      const w = (await allWorkshops()).find(x => x.id === workshopId);
      if (!w) throw new ServiceError('NOT_FOUND', 'Workshop not found');
      return w;
    },
    async register({ workshopId }) {
      await api.post('/student/workshops/register', { workshopId });
      workshopLists.invalidate();
      const w = await workshops.get(workshopId);
      return w.myEnrolment ?? { id: `${workshopId}:me`, workshopId, studentId: '', status: 'pending', requestedAt: nowIso() };
    },
    async drop({ workshopId }) {
      await api.post(`/student/workshops/${encodeURIComponent(workshopId)}/cancel`, {});
      workshopLists.invalidate();
    },
    async join(workshopId) {
      return api.post<{ ok: true; mode: 'online' | 'check_in'; joinUrl: string | null }>(`/student/workshops/${encodeURIComponent(workshopId)}/join`, {});
    },
    listEnrolmentsForInstructor: () => instructor().workshopEnrolments(),
    decide: input => instructor().decideWorkshop(input),
  };

  return { courses, assignments, grades, attendance, workshops, studentCourses, invalidate: () => { studentCourses.invalidate(); myGrades.invalidate(); workshopLists.invalidate(); lmsCache.clear(); } };
}
