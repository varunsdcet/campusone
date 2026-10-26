import type { AiCourseItemPreview, AiCourseState, AiDraftResult, AssignedWorkItem, DashboardData, InstructorAiService, InstructorService } from '../contracts/instructor';
import type { SectionWithCourse, WorkshopWithStatus } from '../contracts/academics';
import type {
  AiDraftStoryboard, AcademicProgram, Assignment, AttendanceRecord, AttendanceStatus, BadgeBase, ClassSession, ContentRepository, Course, CourseEvaluation, Faculty, FacultyRecord, GradeItem,
  HistoricalOffering, Mark, ProgramType, ScheduleChangeRequest, SectionEnrolment, Submission, Term, TodoItem, UserAccount, Workshop, WorkshopEnrolment,
} from '../../domain/types';
import { ServiceError } from '../errors';
import { qs, type ApiClient } from './client';
import { cached, dateOnly, initials, mapCourseRow, nowIso, parseSchedule, termFrom, webUrl } from './util';

const ZERO_UUID = '00000000-0000-4000-8000-000000000000';

/** "Brooks, Emily" or "Emily Brooks" → parts. */
function nameParts(name: string) {
  const n = (name || '').trim();
  if (n.includes(',')) {
    const [last, first] = n.split(',').map(s => s.trim());
    return { first: first ?? '', last: last ?? '', display: `${first ?? ''} ${last ?? ''}`.trim() };
  }
  const parts = n.split(/\s+/);
  return { first: parts[0] ?? '', last: parts.slice(1).join(' '), display: n };
}

function studentAccount(r: { id: string; name: string; studentNumber?: string; email?: string; program?: string }): UserAccount {
  const p = nameParts(r.name);
  return {
    id: r.id,
    role: 'student',
    loginId: r.studentNumber ?? '',
    demoPassword: '',
    displayName: p.display || 'Student',
    firstName: p.first,
    lastName: p.last,
    email: r.email ?? '',
    avatarInitials: initials(p.first, p.last),
    capabilities: [],
    student: {
      studentNumber: r.studentNumber ?? '',
      programId: r.program ?? '',
      programName: r.program && r.program !== '—' ? r.program : '',
      catalogYear: '',
      advisorName: '',
      phone: '',
      sensitiveIdMasked: '•••',
      emergencyContactName: '',
      emergencyContactPhone: '',
    },
  };
}

/** "9/18/2026, 5:00:00 PM" → { date, time } */
function parseWhen(s: string): { date: string; time: string } {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i.exec(s);
  if (!m) return { date: dateOnly(s), time: '' };
  let h = Number(m[4]);
  if (m[6]?.toUpperCase() === 'PM' && h < 12) h += 12;
  if (m[6]?.toUpperCase() === 'AM' && h === 12) h = 0;
  return { date: `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`, time: `${String(h).padStart(2, '0')}:${m[5]}` };
}

/** "Sep 1, 2026 - Dec 18, 2026" → ISO dates */
function parseRange(s: string): { start: string; end: string } {
  const parts = (s || '').split(/\s+-\s+|\s+–\s+/);
  const iso = (x?: string) => {
    if (!x) return '';
    const d = new Date(x.replace(/\./g, ''));
    return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  return { start: iso(parts[0]), end: iso(parts[1]) };
}

const attendanceStatus = (s: string): AttendanceStatus | null => {
  const v = (s || '').toLowerCase();
  if (v === 'present') return 'present';
  if (v === 'absent') return 'absent';
  if (v === 'late' || v === 'tardy') return 'late';
  if (v === 'excused') return 'excused';
  return null;
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Same percentage → letter scale the API applies to grade items and student course grades. */
const LETTERS: [number, string][] = [[90, 'A'], [85, 'A-'], [80, 'B+'], [75, 'B'], [70, 'B-'], [65, 'C+'], [60, 'C'], [50, 'D'], [0, 'F']];
const letterFor = (pct: number) => LETTERS.find(([min]) => pct >= min)?.[1] ?? 'F';

/* ------------------------------- DTOs ------------------------------- */

interface Bootstrap {
  displayName: string;
  email: string;
  studentCount: number;
  sectionCount: number;
  draftGradeCount: number;
  unreadNotifications: number;
  workshopCounts?: Record<string, number>;
  sections: { sectionId: string; code: string; title: string; sectionCode: string; enrolmentCount: number }[];
}
interface Screen<P> { payload: P }
interface GradebookDto {
  sectionId: string;
  courseCode: string;
  courseTitle: string;
  assignments: { id: string; title: string; maxScore: number; weightPercent: number }[];
  rows: { studentId: string; studentNumber: string; name: string; cells: { gradeItemId: string; assignmentId: string; score: number | null; maxScore: number; status: string; rowVersion: number; feedback: string | null }[] }[];
}
interface CourseDetail {
  sectionId: string;
  code: string;
  title: string;
  status: string;
  overview?: { label: string; value: string }[];
  roster?: { studentId: string; name: string; studentNumber: string; program?: string; email?: string; standing?: string }[];
  lectures?: { title: string; when: string; location?: string; joinUrl?: string }[];
  labs?: { title: string; when: string; location?: string }[];
  attendance?: {
    meetings: { label: string; present: number; absent: number; late: number; excused: number; total: number }[];
    rows?: { studentId: string; status: string; meetingLabel: string; recordedAt: string }[];
  };
  assessments?: { title: string; due?: string; maxScore?: string; weight?: string }[];
  lms?: { location?: string; joinUrl?: string; ended?: boolean; topics?: { id: string; title: string; summary?: string; activities: { id: string; type: string; name: string; body?: string; modified?: string; hidden?: boolean; joinUrl?: string | null; storyboard?: AiDraftStoryboard }[] }[]; gradeColumns?: string[]; gradeWeights?: string[]; badges?: { id: string; name: string; description?: string; criteria?: string; awardedStudentIds?: string[] }[]; competencies?: { id: string; name: string; description?: string; levels?: string[]; assessments?: { id: string; competencyId: string; studentId: string; level: string; updatedAt: string }[] }[] };
}

/* ------------------------------ factory ----------------------------- */

export function createInstructorApi(api: ApiClient) {
  const screen = <P>(path: string) => api.get<Screen<P>>(`/instructor/sis/screen${qs({ path })}`).then(r => r.payload ?? ({} as P));
  const action = async <R = unknown>(path: string, act: string, rowKey?: string) => {
    const response = await api.post<{ message?: string; result?: R & { error?: boolean; message?: string } }>('/instructor/sis/action', { path, action: act, rowKey });
    if (response.result?.error) throw new ServiceError('VALIDATION', response.result.message || response.message || `${act} could not be completed.`);
    return response;
  };

  const bootstrap = cached(60_000, () => api.get<Bootstrap>('/instructor/sis/bootstrap'));

  type CourseRow = { id: string; code: string; section: string; title: string; delivery: string; students: string; status: string; location: string; schedule: string; term: string };
  const myCourses = cached(60_000, () => screen<{ hccMyCourses?: { courses: CourseRow[] } }>('/instructor/sections').then(p => p.hccMyCourses?.courses ?? []).catch(() => [] as CourseRow[]));

  const sections = cached(60_000, async (): Promise<SectionWithCourse[]> => {
    const [b, rows] = await Promise.all([bootstrap(), myCourses()]);
    const me = api.accountId ?? '';
    return b.sections.map(s => {
      const row = rows.find(r => r.id === s.sectionId);
      const [dates = '', sched = ''] = (row?.schedule ?? '').split('\n');
      const range = parseRange(dates);
      const status = row?.status ?? '';
      const base = mapCourseRow(
        {
          sectionId: s.sectionId,
          courseCode: s.code,
          courseTitle: s.title,
          sectionCode: s.sectionCode,
          termName: row?.term ?? null,
          credits: null,
          instructorName: b.displayName,
          deliveryMethod: row?.delivery && row.delivery !== '—' ? row.delivery : null,
          location: row?.location && row.location !== '—' ? row.location : null,
          scheduleText: null,
          startsOn: range.start || null,
          endsOn: range.end || null,
          enrolmentCount: s.enrolmentCount,
          courseStatus: /ended|complete/i.test(status) ? 'completed' : /upcoming|not started/i.test(status) ? 'upcoming' : null,
        },
        me,
      );
      const parsed = parseSchedule(sched.replace(/,\s*/g, '\n').replace(/^([A-Za-z]{3})\s/gm, '$1: '));
      return {
        ...base,
        instructorName: b.displayName,
        scheduleLabel: sched && sched !== 'TBA' ? sched : base.scheduleLabel,
        meetingDays: parsed.meetingDays.length ? parsed.meetingDays : base.meetingDays,
        startTime: parsed.startTime || base.startTime,
        endTime: parsed.endTime || base.endTime,
        term: row?.term ? termFrom(row.term, range.start, range.end) : base.term,
      };
    });
  });

  const detailCache = new Map<string, Promise<CourseDetail>>();
  const competencySections = new Map<string, string>();
  const badgeSections = new Map<string, string>();
  const lessonSections = new Map<string, string>();
  const detail = (sectionId: string) => {
    if (!detailCache.has(sectionId)) {
      const p = screen<{ courseDetail?: CourseDetail }>(`/instructor/sections/${sectionId}`).then(d => {
        if (!d.courseDetail) throw new ServiceError('NOT_FOUND', 'Course section not found');
        return d.courseDetail;
      });
      detailCache.set(sectionId, p);
      p.catch(() => detailCache.delete(sectionId));
      setTimeout(() => detailCache.delete(sectionId), 60_000);
    }
    return detailCache.get(sectionId)!;
  };

  async function sectionById(id: string) {
    const s = (await sections()).find(x => x.id === id);
    if (!s) throw new ServiceError('NOT_FOUND', 'Course section not found');
    return s;
  }

  const gradebook = (sectionId: string) => api.get<GradebookDto>(`/gradebooks/${encodeURIComponent(sectionId)}`);

  const cellStatus = (s: string): Mark['status'] => (s === 'published' ? 'released' : s === 'pending_publish' ? 'submitted' : 'draft');

  /* --------------------------- InstructorApi -------------------------- */

  const core = {
    sections,
    async sessions(sectionId: string): Promise<ClassSession[]> {
      const d = await detail(sectionId);
      const s = await sectionById(sectionId).catch(() => null);
      return [...(d.lectures ?? []), ...(d.labs ?? [])]
        .map((l, i) => {
          const w = parseWhen(l.when);
          return { id: `${sectionId}:${w.date}:${i}`, sectionId, date: w.date, startTime: w.time || s?.startTime || '', endTime: s?.endTime ?? '', topic: l.title };
        })
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    async roster(sectionId: string): Promise<(UserAccount & { enrolment: SectionEnrolment })[]> {
      const d = await detail(sectionId);
      return (d.roster ?? []).map(r => ({
        ...studentAccount({ id: r.studentId, name: r.name, studentNumber: r.studentNumber, email: r.email, program: r.program }),
        enrolment: { id: `${sectionId}:${r.studentId}`, sectionId, studentId: r.studentId, status: 'enrolled' as const },
      }));
    },
    async submissions(sectionId: string): Promise<(Submission & { assignment: Assignment; student: UserAccount })[]> {
      type Row = { studentId: string; name: string; studentNumber: string; submission: { id: string; status: string; submittedAt: string | null; textBody: string | null; files: { id: string; filename: string; mimeType: string; sizeBytes: number }[] } | null; grade: { score: number | null; status: string } | null };
      type Resp = { assignments: { id: string; title: string; dueAt: string | null; maxScore: number }[]; rows: Row[] };
      const first = await api.get<Resp>(`/instructor/sections/${encodeURIComponent(sectionId)}/submissions`);
      const per = await Promise.all(
        first.assignments.map(a => (a.id === first.assignments[0]?.id ? Promise.resolve({ a, r: first }) : api.get<Resp>(`/instructor/sections/${encodeURIComponent(sectionId)}/submissions${qs({ assignmentId: a.id })}`).then(r => ({ a, r })))),
      );
      return per.flatMap(({ a, r }) =>
        r.rows
          .filter(x => x.submission)
          .map(x => {
            const sub = x.submission!;
            const late = sub.submittedAt && a.dueAt ? new Date(sub.submittedAt) > new Date(a.dueAt) : false;
            const status: Submission['status'] = x.grade?.score != null ? 'graded' : sub.status === 'returned' ? 'returned' : sub.status === 'submitted' ? (late ? 'late' : 'submitted') : 'draft';
            return {
              id: sub.id,
              assignmentId: a.id,
              studentId: x.studentId,
              status,
              attachments: sub.files.map(f => ({ id: f.id, name: f.filename, size: f.sizeBytes, mimeType: f.mimeType, uri: '' })),
              note: sub.textBody ?? undefined,
              submittedAt: sub.submittedAt ?? undefined,
              updatedAt: sub.submittedAt ?? nowIso(),
              assignment: { id: a.id, sectionId, title: a.title, description: '', points: a.maxScore, weightPct: 0, dueAt: a.dueAt ?? undefined, gradeItemId: a.id },
              student: studentAccount({ id: x.studentId, name: x.name, studentNumber: x.studentNumber }),
            };
          }),
      );
    },
    async gradeItems(sectionId: string): Promise<GradeItem[]> {
      const g = await gradebook(sectionId);
      return g.assignments.map(a => ({ id: a.id, sectionId, name: a.title, weightPct: a.weightPercent, maxPoints: a.maxScore }));
    },
    async addGradeItem(input: Omit<GradeItem, 'id'>): Promise<GradeItem> {
      const path = `/instructor/f/t56-active-courses${qs({ view: input.sectionId })}`;
      const response = await action<{ assignmentId?: string }>(path, 'Create Grading Item', JSON.stringify({ Name: input.name, OutOf: String(input.maxPoints), Weight: String(input.weightPct) }));
      const assignmentId = response.result?.assignmentId;
      if (!assignmentId) throw new ServiceError('SERVER', 'The grading item was saved but the server did not return its identifier.');
      detailCache.delete(input.sectionId);
      return { ...input, id: assignmentId };
    },
    async marks(sectionId: string): Promise<Mark[]> {
      const g = await gradebook(sectionId);
      return g.rows.flatMap(r =>
        r.cells
          .filter(c => c.score != null || c.gradeItemId !== ZERO_UUID)
          .map(c => ({ id: `${c.assignmentId}:${r.studentId}`, gradeItemId: c.assignmentId, sectionId, studentId: r.studentId, score: c.score ?? undefined, status: cellStatus(c.status), feedback: c.feedback ?? undefined, updatedAt: nowIso() })),
      );
    },
    async saveDraftMarks(input: { sectionId: string; marks: { gradeItemId: string; studentId: string; score?: number; feedback?: string }[] }): Promise<Mark[]> {
      const g = await gradebook(input.sectionId);
      const errors: string[] = [];
      for (const m of input.marks) {
        if (m.score === undefined || m.score === null || Number.isNaN(m.score)) continue;
        const cell = g.rows.find(r => r.studentId === m.studentId)?.cells.find(c => c.assignmentId === m.gradeItemId);
        if (!cell) continue;
        if (cell.status === 'published' || cell.status === 'pending_publish') continue;
        if (cell.score === m.score && (cell.feedback ?? '') === (m.feedback ?? '')) continue;
        try {
          if (cell.gradeItemId === ZERO_UUID) await api.post('/grade-items', { assignmentId: m.gradeItemId, studentId: m.studentId, score: m.score, feedback: m.feedback ?? null });
          else await api.patch(`/grade-items/${encodeURIComponent(cell.gradeItemId)}`, { score: m.score, rowVersion: cell.rowVersion, feedback: m.feedback ?? null });
        } catch (e) {
          errors.push((e as Error).message);
        }
      }
      if (errors.length) throw new ServiceError('VALIDATION', errors[0]);
      return core.marks(input.sectionId);
    },
    async submitMarks(sectionId: string) {
      const g = await gradebook(sectionId);
      const cells = g.rows.flatMap(r => r.cells);
      const ids = cells.filter(c => c.status === 'draft' && c.score != null && c.gradeItemId !== ZERO_UUID).map(c => c.gradeItemId);
      const missing = cells.filter(c => c.score == null).length;
      if (!ids.length) {
        if (cells.some(c => c.status === 'pending_publish')) throw new ServiceError('CONFLICT', 'These grades are already awaiting registrar approval.');
        throw new ServiceError('VALIDATION', 'Enter and save at least one mark before submitting.');
      }
      await api.post(`/gradebooks/${encodeURIComponent(sectionId)}/publish`, { gradeItemIds: ids }, { 'Idempotency-Key': `grades-${sectionId}-${Date.now()}` });
      return { submitted: ids.length, missing };
    },
    async releaseMarks(_sectionId: string): Promise<{ released: number }> {
      throw new ServiceError('PERMISSION_DENIED', 'Submitted grades are released to students automatically once the registrar approves them.', { retryable: false });
    },
    async exportCsv(sectionId: string) {
      const g = await gradebook(sectionId);
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const header = ['Student', 'Student #', ...g.assignments.map(a => `${a.title} (/${a.maxScore})`)];
      const lines = g.rows.map(r => [r.name, r.studentNumber, ...g.assignments.map(a => r.cells.find(c => c.assignmentId === a.id)?.score ?? '')]);
      return { fileName: `${g.courseCode.replace(/\W+/g, '-')}-grades.csv`, content: [header, ...lines].map(l => l.map(esc).join(',')).join('\n') };
    },
    async attendanceForDate(date: string, sectionId?: string) {
      type Group = { sectionId: string; course: string; title: string; offering: string; meta: string; students: { id: string; name: string; studentNumber: string; status: string; note: string }[] };
      const p = await screen<{ hccAttendance?: { groups: Group[] } }>(`/instructor/attendance${qs({ date, sectionId })}`);
      const all = await sections();
      return (p.hccAttendance?.groups ?? [])
        .filter(g => !sectionId || g.sectionId === sectionId)
        .map(g => {
          const section = all.find(s => s.id === g.sectionId) ?? mapCourseRow({ sectionId: g.sectionId, courseCode: g.course, courseTitle: g.title, sectionCode: g.offering, termName: null, credits: null, instructorName: null });
          const sessionId = `${g.sectionId}:${date}`;
          const submitted = /submitted|finali[sz]ed|taken(?! yet)/i.test(g.meta) && !/not yet taken/i.test(g.meta);
          const records: AttendanceRecord[] = g.students.flatMap(st => {
            const status = attendanceStatus(st.status);
            return status ? [{ id: `${sessionId}:${st.id}`, sessionId, sectionId: g.sectionId, studentId: st.id, status, note: st.note || undefined, state: submitted ? 'submitted' : 'draft', recordedAt: nowIso() } as AttendanceRecord] : [];
          });
          return {
            section,
            session: { id: sessionId, sectionId: g.sectionId, date, startTime: section.startTime, endTime: section.endTime, topic: g.meta.split('·')[0]?.trim() || `${g.course} class` },
            records,
            roster: g.students.map(st => studentAccount({ id: st.id, name: st.name, studentNumber: st.studentNumber })),
          };
        });
    },
    async saveAttendance(input: { sectionId: string; date: string; entries: { studentId: string; status: AttendanceStatus; note?: string }[] }, submit: boolean): Promise<AttendanceRecord[]> {
      if (submit && !input.entries.length) throw new ServiceError('VALIDATION', 'Mark at least one student before submitting.');
      const rowKey = JSON.stringify({ date: input.date, roster: input.entries.map(e => ({ studentId: e.studentId, sectionId: input.sectionId, status: cap(e.status), note: e.note ?? '' })) });
      await action(`/instructor/attendance${qs({ date: input.date, sectionId: input.sectionId })}`, submit ? 'Submit Attendance' : 'Save Draft', rowKey);
      detailCache.delete(input.sectionId);
      const groups = await core.attendanceForDate(input.date, input.sectionId);
      const recs = groups[0]?.records ?? [];
      return recs.map(r => ({ ...r, state: submit ? 'submitted' : r.state }));
    },
    async sectionContent(sectionId: string) {
      const d = await detail(sectionId);
      const l = d.lms;
      const cols = l?.gradeColumns ?? [];
      const fromGrades = cols.map((label, i) => ({ label, weight: parseFloat(l?.gradeWeights?.[i] ?? '') })).filter(x => !Number.isNaN(x.weight));
      const fromAssessments = (d.assessments ?? []).map(a => ({ label: a.title, weight: parseFloat(a.weight ?? '') })).filter(x => !Number.isNaN(x.weight));
      const joinUrl = webUrl(l?.joinUrl ?? d.lectures?.find(x => x.joinUrl)?.joinUrl);
      return {
        topics: (l?.topics ?? []).map(t => ({ ...t, activities: t.activities.filter(a => !a.hidden) })).filter(t => t.activities.length),
        evaluation: fromGrades.length ? fromGrades : fromAssessments,
        joinUrl,
        liveRoomReady: Boolean(joinUrl) && !l?.ended,
        location: l?.location,
      };
    },
    async attendanceSummary(sectionId: string) {
      const d = await detail(sectionId);
      const meetings = d.attendance?.meetings ?? [];
      const last = meetings[meetings.length - 1]?.label;
      return {
        lastTaken: last && /^\d{4}-\d{2}-\d{2}$/.test(last) ? last : undefined,
        present: meetings.reduce((n, m) => n + m.present + m.late, 0),
        total: meetings.reduce((n, m) => n + m.total, 0),
        sessionsTaken: meetings.length,
      };
    },
    async workshopEnrolments(): Promise<(WorkshopEnrolment & { workshop: Workshop; student: UserAccount })[]> {
      type Row = { id: string; studentName: string; studentNumber: string; workshop: string; workshopId: string; status: string; enrolledOn: string; note: string };
      const p = await screen<{ workshopEnrolments?: { rows: Row[] } }>('/instructor/f/t40-workshop-enrollment-status?status=all');
      return (p.workshopEnrolments?.rows ?? []).map(r => {
        const [code, title] = r.workshop.split(/\s+—\s+/);
        const status = (['pending', 'approved', 'declined', 'dropped', 'completed'].includes(r.status.toLowerCase()) ? r.status.toLowerCase() : 'pending') as WorkshopEnrolment['status'];
        const workshop: WorkshopWithStatus = {
          id: r.workshopId, code: code ?? r.workshop, title: title ?? r.workshop, category: 'Workshop', description: '', date: '', startTime: '', durationHours: 0, ceu: 0, mode: 'In person', location: '', capacity: 0, instructor: '', requiresApproval: true, agenda: [], materials: [], joinUrlLabel: '', registeredCount: 0,
        };
        return { id: r.id, workshopId: r.workshopId, studentId: r.studentNumber, status, requestedAt: r.enrolledOn, workshop, student: studentAccount({ id: r.studentNumber, name: r.studentName, studentNumber: r.studentNumber }) };
      });
    },
    async decideWorkshop(input: { enrolmentId: string; decision: 'approved' | 'declined' | 'dropped' }): Promise<WorkshopEnrolment> {
      const label = input.decision === 'approved' ? 'Approve' : input.decision === 'declined' ? 'Decline' : 'Drop';
      const r = await action('/instructor/f/t40-workshop-enrollment-status', label, input.enrolmentId);
      if (r.result?.error) throw new ServiceError('CONFLICT', r.result.message ?? r.message ?? 'The enrolment could not be updated.');
      const row = (await core.workshopEnrolments()).find(x => x.id === input.enrolmentId);
      return { id: input.enrolmentId, workshopId: row?.workshopId ?? '', studentId: row?.studentId ?? '', status: input.decision, requestedAt: row?.requestedAt ?? nowIso(), decidedAt: nowIso() };
    },
  };

  /* -------------------------- InstructorService ------------------------- */

  type DashPayload = {
    gradesQueue?: { code: string; status: string }[];
    dashboard?: {
      gradeSubmissions?: { code: string; sectionCode: string; status: string; missing: string; href: string }[];
      alerts?: { id?: string; title: string; body: string; tone: string }[];
      officeHours?: { day: string; window: string; mode: string }[];
      timetable?: { code: string; room: string; status: string; href: string }[];
    };
  };
  const dash = cached(60_000, () => screen<DashPayload>('/instructor'));

  const gradeStatusOf = (status: string | undefined): 'Submission required' | 'Submitted' | 'Released' =>
    /released|published/i.test(status ?? '') ? 'Released' : /submitted|pending approval|awaiting/i.test(status ?? '') ? 'Submitted' : 'Submission required';

  const todoRoute = (title: string): TodoItem['link'] => {
    const t = title.toLowerCase();
    if (t.includes('grade')) return { route: 'InstructorGradesSubmission' };
    if (t.includes('attendance')) return { route: 'InstructorCourseAttendance' };
    if (t.includes('workshop')) return { route: 'InstructorWorkshopEnrolments' };
    if (t.includes('schedule')) return { route: 'InstructorPendingSchedules' };
    if (t.includes('flag') || t.includes('student')) return { route: 'InstructorStudentList' };
    return { route: 'InstructorMyCourses' };
  };

  type StudentRow = { id: string; name: string; studentNumber: string; status: string; program: string; programTerm: string; admissionTerm: string; date: string };
  const directory = cached(60_000, () => screen<{ hccStudents?: { rows: StudentRow[] } }>('/instructor/f/t12-students-view').then(p => p.hccStudents?.rows ?? []));

  type TermsPayload = { manageTerms?: { campusOptions?: { label: string; value: string }[]; terms: { id: string; name: string; code: string; dates?: string; campuses: string[] | string; startsOn?: string; endsOn?: string }[] } };
  const termsScreen = () => screen<TermsPayload>('/instructor/f/t51-manage-terms');

  type ActiveRow = { id?: string; code?: string; title?: string; course?: string; section?: string; dates?: string; enrolment?: string };
  const aiPath = (sectionId: string) => `/instructor/f/t56-active-courses${qs({ view: sectionId })}`;
  const aiCourseQs = (sectionId: string) => qs({ path: aiPath(sectionId) });
  const aiPost = (url: string, sectionId: string, body: Record<string, unknown> = {}) => api.request<AiCourseState>('POST', url, { path: aiPath(sectionId), ...body }, { timeoutMs: 60_000 });
  const aiService: InstructorAiService = {
    async courses() {
      const p = await screen<{ activeCourses?: { rows: ActiveRow[] } }>('/instructor/f/t56-active-courses');
      return (p.activeCourses?.rows ?? [])
        .filter(r => r.id && /^[0-9a-z-]{36}$/i.test(r.id))
        .map(r => ({ sectionId: r.id!, code: r.code ?? '', title: r.title || r.course || '', section: r.section ?? '', dates: r.dates ?? '', enrolment: r.enrolment ?? '' }));
    },
    async topics(sectionId) {
      const d = await detail(sectionId);
      return (d.lms?.topics ?? []).filter(t => t.id !== 'topic-eval').map(t => ({ id: t.id, title: t.title, summary: t.summary ?? '', activities: t.activities.map(a => a.name) }));
    },
    async generateDraft(input) {
      return api.request<AiDraftResult>(
        'POST',
        '/instructor/ai-draft',
        { path: aiPath(input.sectionId), topicTitle: input.topic.title, topicSummary: input.topic.summary, lessonTitle: input.lessonTitle.trim() || input.topic.title, minutes: input.minutes || 20, slides: input.slides || 6, existingActivities: input.topic.activities.slice(0, 40) },
        { timeoutMs: 180_000 },
      );
    },
    async addDraftToTopic(input) {
      const rowKey = JSON.stringify({ TopicId: input.topicId, Type: 'PAGE', Name: input.name, Body: input.html, Storyboard: JSON.stringify({ ...input.storyboard, title: input.name }) });
      const r = await api.post<{ ok?: boolean; message?: string; result?: { error?: boolean } }>('/instructor/sis/action', { path: aiPath(input.sectionId), action: 'Add an activity or resource', rowKey });
      if (r.ok === false || r.result?.error) throw new ServiceError('VALIDATION', r.message || 'Could not add the lesson to the course. Try again.');
      detailCache.delete(input.sectionId);
    },
    course: sectionId => api.get<AiCourseState>(`/instructor/ai-course${aiCourseQs(sectionId)}`),
    startBlueprint: (sectionId, brief) => aiPost('/instructor/ai-course/blueprint', sectionId, { brief }),
    saveBlueprint: (sectionId, edits) => api.request<AiCourseState>('PUT', '/instructor/ai-course/blueprint', { path: aiPath(sectionId), ...edits }, { timeoutMs: 60_000 }),
    approve: sectionId => aiPost('/instructor/ai-course/approve', sectionId),
    run: (sectionId, key) => aiPost('/instructor/ai-course/run', sectionId, key ? { key } : {}),
    async publish(sectionId) {
      const r = await api.request<AiCourseState>('POST', '/instructor/ai-course/publish', { path: aiPath(sectionId) }, { timeoutMs: 180_000 });
      detailCache.delete(sectionId);
      return r;
    },
    reopen: sectionId => aiPost('/instructor/ai-course/reopen', sectionId),
    discard: sectionId => api.request<AiCourseState>('DELETE', `/instructor/ai-course${aiCourseQs(sectionId)}`, undefined, { timeoutMs: 60_000 }),
    preview: (sectionId, key) => api.get<AiCourseItemPreview>(`/instructor/ai-course/item${qs({ path: aiPath(sectionId), key })}`),
  };

  const instructorService: InstructorService = {
    async listAssignedWork() {
      const response = await api.get<{ items: AssignedWorkItem[] }>('/instructor/assigned-work');
      return response.items;
    },
    async dashboard(): Promise<DashboardData> {
      const [b, d, secs] = await Promise.all([bootstrap(), dash().catch(() => ({}) as DashPayload), sections()]);
      const subs = d.dashboard?.gradeSubmissions ?? [];
      const withStatus = secs.map(s => {
        const g = subs.find(x => x.sectionCode === s.sectionCode) ?? d.gradesQueue?.find(x => x.code === s.course.code);
        return { ...s, gradeStatus: gradeStatusOf(g?.status) };
      });
      const todos: TodoItem[] = (d.dashboard?.alerts ?? [])
        .map((a, i) => ({
          id: a.id ?? `alert-${i}-${a.title}`,
          instructorId: api.accountId ?? '',
          title: a.title,
          subtitle: a.body,
          tag: a.tone === 'warning' ? 'Action' : undefined,
          priority: (a.tone === 'danger' || a.tone === 'error' ? 'high' : a.tone === 'warning' ? 'medium' : 'low') as TodoItem['priority'],
          action: 'open' as const,
          link: todoRoute(a.title),
          done: false,
        }));
      const oh = d.dashboard?.officeHours?.[0];
      return {
        studentCount: b.studentCount,
        courseCount: new Set(b.sections.map(s => s.code)).size,
        sectionCount: b.sectionCount,
        pendingGradeSections: withStatus.filter(s => s.enrolledCount > 0 && s.gradeStatus === 'Submission required').length,
        todos,
        sections: withStatus,
        officeHours: oh ? { label: [oh.day, oh.window].filter(Boolean).join(' · '), roomReady: false, mode: oh.mode || undefined } : undefined,
        unreadNotifications: b.unreadNotifications,
      };
    },
    async completeTodo(todoId) {
      if (!todoId.startsWith('notification:')) throw new ServiceError('CONFLICT', 'This item clears automatically after its underlying work is completed.');
      await action('/instructor', 'Mark notification read', todoId.slice('notification:'.length));
      dash.invalidate();
      bootstrap.invalidate();
    },
    async listStudents(_instructorId, filters) {
      const former = /graduat|withdrawn|dismiss|cancel|declin|refused|in-active/i;
      let items = (await directory()).map(r => ({
        ...studentAccount({ id: r.id, name: r.name, studentNumber: r.studentNumber, program: r.program }),
        status: r.status,
        termLabel: r.programTerm && r.programTerm !== '—' ? r.programTerm : '',
        admissionTerm: r.admissionTerm && r.admissionTerm !== '—' ? r.admissionTerm : '',
        updatedAt: r.date,
      }));
      if (filters.category === 'active') items = items.filter(i => !former.test(i.status));
      if (filters.category === 'former') items = items.filter(i => former.test(i.status));
      if (filters.query) {
        const q = filters.query.toLowerCase();
        items = items.filter(i => i.displayName.toLowerCase().includes(q) || i.student!.studentNumber.toLowerCase().includes(q) || i.student!.programName.toLowerCase().includes(q));
      }
      if (filters.program) items = items.filter(i => i.student?.programName === filters.program);
      if (filters.letter && filters.letter !== 'ALL') items = items.filter(i => i.lastName.toUpperCase().startsWith(filters.letter!));
      items.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
      const total = items.length;
      const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));
      const start = (filters.page - 1) * filters.pageSize;
      return { items: items.slice(start, start + filters.pageSize), total, pageCount };
    },
    async getStudent(_instructorId, studentId) {
      const secs = await sections();
      const rosters = await Promise.all(secs.map(s => core.roster(s.id).then(r => ({ s, r })).catch(() => ({ s, r: [] as Awaited<ReturnType<typeof core.roster>> }))));
      const hit = rosters.flatMap(x => x.r).find(u => u.id === studentId);
      const row = (await directory().catch(() => [] as StudentRow[])).find(r => r.id === studentId);
      if (!hit && !row) throw new ServiceError('PERMISSION_DENIED', 'You can only view students enrolled in your sections.');
      const account: UserAccount = hit ? { ...hit } : studentAccount({ id: studentId, name: row!.name, studentNumber: row!.studentNumber, program: row!.program });
      delete (account as Partial<UserAccount & { enrolment: SectionEnrolment }>).enrolment;
      return { ...account, sections: rosters.filter(x => x.r.some(u => u.id === studentId)).map(x => x.s) };
    },
    async getStudentRecord(_instructorId, studentId) {
      const secs = await sections();
      const details = (await Promise.all(secs.map(s => detail(s.id).then(d => ({ s, d })).catch(() => null)))).filter(
        (x): x is { s: SectionWithCourse; d: CourseDetail } => !!x?.d.roster?.some(r => r.studentId === studentId),
      );
      if (!details.length) throw new ServiceError('PERMISSION_DENIED', 'You can only view students enrolled in your sections.');
      const standing = details.map(x => x.d.roster?.find(r => r.studentId === studentId)?.standing).find(Boolean);
      const attendance = details.flatMap(({ s, d }) =>
        (d.attendance?.rows ?? [])
          .filter(r => r.studentId === studentId)
          .map(r => {
            const v = r.status.toLowerCase();
            return { sectionId: s.id, date: r.meetingLabel, status: (v === 'absent' || v === 'late' || v === 'excused' ? v : 'present') as 'present' | 'absent' | 'late' | 'excused' };
          }),
      );
      const grades = await Promise.all(
        details
          .filter(x => x.d.assessments?.length)
          .map(async ({ s }) => {
            const g = await gradebook(s.id).catch(() => null);
            const row = g?.rows.find(r => r.studentId === studentId);
            return {
              sectionId: s.id,
              items: (g?.assignments ?? []).map(a => {
                const c = row?.cells.find(x => x.assignmentId === a.id);
                return { id: a.id, name: a.title, weightPct: a.weightPercent, maxPoints: a.maxScore, score: c?.score ?? undefined, status: cellStatus(c?.status ?? 'draft'), feedback: c?.feedback ?? undefined };
              }),
            };
          }),
      );
      return { standing: standing ? cap(standing) : undefined, attendance: attendance.sort((a, b) => b.date.localeCompare(a.date)), grades: grades.filter(g => g.items.length) };
    },

    async listLessonCourses() {
      const secs = await sections();
      const seen = new Map<string, Course>();
      secs.forEach(s => seen.set(s.course.id, s.course));
      return [...seen.values()];
    },
    async listLessonPlans(courseId) {
      const section = (await sections()).find(item => item.course.id === courseId || item.id === courseId);
      if (!section) return [];
      const d = await detail(section.id);
      const activities = (d.lms?.topics ?? []).flatMap(topic => topic.activities.map((activity, index) => ({ topic, activity, index })));
      return activities.filter(({ activity }) => ['PAGE', 'TEXT', 'VIDEO', 'FILE'].includes(activity.type.toUpperCase())).map(({ activity, index }) => {
        lessonSections.set(activity.id, section.id);
        const contentType = activity.type.toUpperCase() === 'VIDEO' ? 'Video' : activity.type.toUpperCase() === 'FILE' ? 'PDF' : 'Text article';
        const content = activity.body ?? '';
        const parsedModified = activity.modified ? new Date(activity.modified) : null;
        const modified = parsedModified && !Number.isNaN(parsedModified.getTime()) ? parsedModified.toISOString() : nowIso();
        const published = activity.hidden ? undefined : { content, title: activity.name, publishedAt: modified };
        return { id: activity.id, courseId: section.course.id, title: activity.name, contentType, order: index + 1, content, readMinutes: Math.max(1, Math.round(content.split(/\s+/).filter(Boolean).length / 180)), draftUpdatedAt: modified, published } as const;
      });
    },
    async getLessonPlan(lessonId) {
      const known = lessonSections.get(lessonId);
      const all = await sections();
      const candidates = known ? all.filter(item => item.id === known) : all;
      for (const section of candidates) {
        const plans = await instructorService.listLessonPlans(section.course.id);
        const found = plans.find(item => item.id === lessonId);
        if (found) return found;
      }
      throw new ServiceError('NOT_FOUND', 'Lesson plan not found.');
    },
    async saveLessonPlan(lesson) {
      const section = (await sections()).find(item => item.course.id === lesson.courseId || item.id === lesson.courseId);
      if (!section) throw new ServiceError('NOT_FOUND', 'Course section not found.');
      const d = await detail(section.id);
      const topic = d.lms?.topics?.[0];
      if (!topic) throw new ServiceError('CONFLICT', 'Add a course topic before saving a lesson.');
      const exists = (d.lms?.topics ?? []).some(item => item.activities.some(activity => activity.id === lesson.id));
      let id = lesson.id;
      if (exists) {
        await action<{ id: string }>(`/instructor/sections/${encodeURIComponent(section.id)}`, 'Save page', JSON.stringify({ Id: lesson.id, Name: lesson.title, Body: lesson.content, Hidden: lesson.published ? 'No' : 'Yes' }));
      } else {
        const response = await action<{ activity?: { id?: string } }>(`/instructor/sections/${encodeURIComponent(section.id)}`, 'Add activity', JSON.stringify({ TopicId: topic.id, ActivityType: 'PAGE', Name: lesson.title, Body: lesson.content, Hidden: 'Yes' }));
        id = response.result?.activity?.id ?? '';
      }
      if (!id) throw new ServiceError('SERVER', 'Lesson was not returned by the server.');
      detailCache.delete(section.id);
      lessonSections.set(id, section.id);
      return { ...lesson, id, readMinutes: Math.max(1, Math.round(lesson.content.split(/\s+/).filter(Boolean).length / 180)), draftUpdatedAt: nowIso() };
    },
    async generateLessonDraft(lessonId, kind) {
      const lesson = await instructorService.getLessonPlan(lessonId);
      const response = await api.post<{ answer: string }>('/ai/ask', {
        question: kind === 'quiz' ? `Create a short practice quiz draft for the lesson "${lesson.title}". Include answers and explanations.` : `Create a concise, structured lesson plan draft for "${lesson.title}".`,
        contextPath: '/instructor',
        capability: 'faculty_assistant',
      }, { 'Idempotency-Key': `lesson-${lessonId}-${kind}-${Date.now()}` });
      return { content: response.answer };
    },
    async publishLessonPlan(lessonId) {
      const lesson = await instructorService.getLessonPlan(lessonId);
      const sectionId = lessonSections.get(lessonId);
      if (!sectionId) throw new ServiceError('NOT_FOUND', 'Lesson section not found.');
      await action(`/instructor/sections/${encodeURIComponent(sectionId)}`, 'Save page', JSON.stringify({ Id: lesson.id, Name: lesson.title, Body: lesson.content, Hidden: 'No' }));
      detailCache.delete(sectionId);
      return { ...lesson, published: { title: lesson.title, content: lesson.content, publishedAt: nowIso() }, draftUpdatedAt: nowIso() };
    },

    async listCompetencies(sectionId) {
      const d = await detail(sectionId);
      return (d.lms?.competencies ?? []).map(c => {
        competencySections.set(c.id, sectionId);
        return { id: c.id, sectionId, name: c.name, description: c.description ?? '', levels: c.levels?.length ? c.levels : ['Emerging', 'Developing', 'Proficient', 'Advanced'], assessments: c.assessments ?? [] };
      });
    },
    async saveCompetency(def) {
      const response = await action<{ id: string; name: string; description?: string; levels?: string[] }>(`/instructor/sections/${encodeURIComponent(def.sectionId)}`, 'Save competency', JSON.stringify({ Id: def.id ?? '', Name: def.name, Description: def.description, Levels: JSON.stringify(def.levels) }));
      if (!response.result?.id) throw new ServiceError('SERVER', 'Competency was not returned by the server.');
      competencySections.set(response.result.id, def.sectionId);
      detailCache.delete(def.sectionId);
      return { id: response.result.id, sectionId: def.sectionId, name: response.result.name, description: response.result.description ?? def.description, levels: response.result.levels?.length ? response.result.levels : def.levels };
    },
    async deleteCompetency(id) {
      const sectionId = competencySections.get(id);
      if (!sectionId) throw new ServiceError('NOT_FOUND', 'Reload competencies before deleting this item.');
      await action(`/instructor/sections/${encodeURIComponent(sectionId)}`, 'Delete competency', id);
      detailCache.delete(sectionId);
      competencySections.delete(id);
    },
    async assessCompetency(input) {
      const sectionId = competencySections.get(input.competencyId);
      if (!sectionId) throw new ServiceError('NOT_FOUND', 'Reload competencies before assessing students.');
      const response = await action<{ id: string; competencyId: string; studentId: string; level: string; updatedAt: string }>(`/instructor/sections/${encodeURIComponent(sectionId)}`, 'Assess competency', JSON.stringify({ CompetencyId: input.competencyId, StudentId: input.studentId, Level: input.level }));
      if (!response.result?.id) throw new ServiceError('SERVER', 'Competency assessment was not returned by the server.');
      detailCache.delete(sectionId);
      return response.result;
    },
    async listSectionBadges(sectionId) {
      const d = await detail(sectionId);
      return (d.lms?.badges ?? []).map(b => {
        badgeSections.set(b.id, sectionId);
        return { id: b.id, sectionId, name: b.name, description: b.description ?? '', criteria: b.criteria ?? '', awardedStudentIds: b.awardedStudentIds ?? [] };
      });
    },
    async saveSectionBadge(badge) {
      const response = await action<{ id: string; name: string; description: string; criteria: string; awardedStudentIds: string[] }>(`/instructor/sections/${encodeURIComponent(badge.sectionId)}`, 'Save course badge', JSON.stringify({ Id: badge.id ?? '', Name: badge.name, Description: badge.description, Criteria: badge.criteria, StudentIds: badge.awardedStudentIds.join(',') }));
      if (!response.result?.id) throw new ServiceError('SERVER', 'Badge was not returned by the server.');
      badgeSections.set(response.result.id, badge.sectionId);
      detailCache.delete(badge.sectionId);
      return { ...response.result, sectionId: badge.sectionId };
    },
    async deleteSectionBadge(id) {
      const sectionId = badgeSections.get(id);
      if (!sectionId) throw new ServiceError('NOT_FOUND', 'Reload badges before deleting this item.');
      await action(`/instructor/sections/${encodeURIComponent(sectionId)}`, 'Delete course badge', id);
      detailCache.delete(sectionId);
      badgeSections.delete(id);
    },
    async queryLogs() {
      return [];
    },

    async listEvaluations() {
      type Row = { id: string; course: string; title: string; offering: string; evaluation: string; dates: string; schedule: string };
      const [p, secs] = await Promise.all([screen<{ hccEvaluations?: { rows: Row[] } }>('/instructor/f/t36-course-evaluations'), sections()]);
      return (p.hccEvaluations?.rows ?? []).map(r => {
        const range = parseRange(r.dates);
        const section = secs.find(s => s.id === r.id) ?? { ...mapCourseRow({ sectionId: r.id, courseCode: r.course, courseTitle: r.title, sectionCode: r.offering, termName: null, credits: null, instructorName: null, startsOn: range.start, endsOn: range.end }), scheduleLabel: r.schedule };
        const ev: CourseEvaluation = { id: `ev_${r.id}`, sectionId: r.id, evaluationName: r.evaluation, responses: [], invited: section.enrolledCount };
        return { ...ev, section };
      });
    },
    async getEvaluation(sectionId) {
      return (await instructorService.listEvaluations('')).find(e => e.sectionId === sectionId) ?? null;
    },

    async listRepositories(filters) {
      type Row = { id: string; courseId?: string; number: string; name: string; lms: string; status: string; courseTypes: string; push: number; pull: number; isDefault: string; courseFormat: string; sections: string };
      const p = await screen<{ contentRepository?: { courses: Row[] } }>('/instructor/f/t37-course-repository');
      let items: ContentRepository[] = (p.contentRepository?.courses ?? []).map(r => ({
        id: r.id,
        courseId: r.courseId,
        code: r.number,
        name: r.name,
        status: /active/i.test(r.status) && !/inactive/i.test(r.status) ? 'active' : 'inactive',
        lms: r.lms,
        types: r.courseTypes,
        pushCount: Number(r.push) || 0,
        pullCount: Number(r.pull) || 0,
        history: [],
        version: (Number(r.push) || 0) + 1,
        deployed: 'synced',
        format: r.courseFormat,
        sections: Number(r.sections) || 0,
        isDefault: /yes/i.test(r.isDefault),
      }));
      if (filters.query) {
        const q = filters.query.toLowerCase();
        items = items.filter(r => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
      }
      if (filters.repository === 'Active only') items = items.filter(r => r.status === 'active');
      if (filters.repository === 'Inactive only') items = items.filter(r => r.status === 'inactive');
      const total = items.length;
      const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));
      const start = (filters.page - 1) * filters.pageSize;
      return { items: items.slice(start, start + filters.pageSize), total, pageCount };
    },
    async createRepository(input) {
      const current = (await instructorService.listRepositories({ page: 1, pageSize: 10_000 })).items;
      const duplicates = current.filter(r => r.status === 'active' && r.courseId === input.courseId);
      if (duplicates.length && !input.deactivateDuplicates) {
        throw new ServiceError('CONFLICT', `${duplicates.length} active content course(s) already use this course. Confirm to deactivate them.`);
      }
      const course = (await instructorService.listLessonCourses(api.accountId ?? '')).find(c => c.id === input.courseId);
      const response = await action<{ id?: string }>('/instructor/f/t80-create-content-course', 'Create Content Course', JSON.stringify({
        Course: input.courseId,
        'Course Number': course?.code ?? input.courseId,
        'Course Title': course?.title ?? input.name,
        'Note / Name': input.name,
        'Course Types': input.types,
        Default: input.isDefault ? 'Yes' : 'No',
        'Course Format': input.format,
        'Sections / Weeks': String(input.sections),
      }));
      const items = (await instructorService.listRepositories({ page: 1, pageSize: 10_000 })).items;
      const repo = items.find(r => r.id === response.result?.id) ?? items.find(r => r.name === input.name);
      if (!repo) throw new ServiceError('SERVER', 'The content course was saved but could not be reloaded.');
      return { repo, deactivated: input.deactivateDuplicates ? duplicates : [] };
    },
    async updateRepository(id, patch) {
      const items = (await instructorService.listRepositories({ page: 1, pageSize: 10_000 })).items;
      const current = items.find(r => r.id === id);
      if (!current) throw new ServiceError('NOT_FOUND', 'Repository not found');
      const next = { ...current, ...patch };
      await action('/instructor/f/t80-create-content-course', 'Save Content Course', JSON.stringify({
        __contentCourseId: id,
        Course: next.courseId ?? next.code,
        'Course Number': next.code,
        'Course Title': next.name,
        'Note / Name': next.name,
        'Course Types': next.types,
        Default: next.isDefault ? 'Yes' : 'No',
        'Course Format': next.format,
        'Sections / Weeks': String(next.sections),
        Status: next.status === 'active' ? 'Active' : 'Inactive',
      }));
      const refreshed = (await instructorService.listRepositories({ page: 1, pageSize: 10_000 })).items.find(r => r.id === id);
      if (!refreshed) throw new ServiceError('SERVER', 'The repository was updated but could not be reloaded.');
      return refreshed;
    },
    async deleteRepository(id) {
      await action('/instructor/f/t37-course-repository', 'Delete Content Course', id);
    },
    async repositoryAction(id, act) {
      if (act === 'manage') {
        const { items } = await instructorService.listRepositories({ page: 1, pageSize: 10_000 });
        const repo = items.find(x => x.id === id);
        if (!repo) throw new ServiceError('NOT_FOUND', 'Repository not found');
        return repo;
      }
      await action('/instructor/f/t37-course-repository', act === 'push' ? 'PUSH' : 'PULL', id);
      const { items } = await instructorService.listRepositories({ page: 1, pageSize: 10_000 });
      const r = items.find(x => x.id === id);
      if (!r) throw new ServiceError('NOT_FOUND', 'Repository not found');
      return { ...r, history: [{ id: `h-${Date.now()}`, at: nowIso(), action: act, version: r.version, by: 'You' }] };
    },

    async listScheduleChanges(_instructorId, changeType) {
      type Row = { id: string; sectionId?: string; course?: string; title?: string; offering?: string; changeType?: string; requestedAt?: string; requestedBy?: string; dates?: string; schedule?: string; location?: string; conflict?: string; status?: string };
      const p = await screen<{ hccPendingSchedules?: { rows: Row[] } }>(`/instructor/f/t38-pending-course-schedules${qs({ changeType: changeType && changeType !== 'All Types' ? changeType : undefined, show: '1' })}`);
      const secs = await sections();
      return (p.hccPendingSchedules?.rows ?? []).map(r => {
        const range = parseRange(r.dates ?? '');
        const section = secs.find(s => s.id === r.sectionId || s.sectionCode === r.offering) ?? mapCourseRow({ sectionId: r.sectionId ?? r.id, courseCode: r.course ?? '', courseTitle: r.title ?? '', sectionCode: r.offering ?? '', termName: null, credits: null, instructorName: null });
        const ct = (['Schedule Change', 'Room Change', 'Instructor Change'].includes(r.changeType ?? '') ? r.changeType : 'Schedule Change') as ScheduleChangeRequest['changeType'];
        const st = (r.status ?? '').toLowerCase();
        return {
          id: r.id,
          sectionId: section.id,
          changeType: ct,
          requestedAt: r.requestedAt ?? '',
          requestedBy: r.requestedBy ?? 'Registrar',
          proposed: { startDate: range.start, endDate: range.end, scheduleLabel: r.schedule ?? '', location: r.location },
          conflict: r.conflict || undefined,
          status: (st.includes('accept') || st.includes('approv') ? 'accepted' : st.includes('reject') ? 'rejected' : 'pending') as ScheduleChangeRequest['status'],
          section,
        };
      });
    },
    async decideScheduleChange(input) {
      await action('/instructor/f/t38-pending-course-schedules', input.decision === 'accepted' ? 'Accept' : 'Reject', input.id);
      const all = await instructorService.listScheduleChanges('', undefined);
      const r = all.find(x => x.id === input.id);
      return { ...(r ?? { id: input.id, sectionId: '', changeType: 'Schedule Change' as const, requestedAt: '', requestedBy: '', proposed: { startDate: '', endDate: '', scheduleLabel: '' } }), status: input.decision, decisionNote: input.note, decidedAt: nowIso() };
    },
    async gradeSubmissionOverview(_instructorId, filters) {
      const secs = (await sections()).filter(s => s.enrolledCount > 0 && (!filters.sectionId || s.id === filters.sectionId));
      const d = await dash().catch(() => ({}) as DashPayload);
      const subs = d.dashboard?.gradeSubmissions ?? [];
      const out = secs.map(s => {
        const g = subs.find(x => x.sectionCode === s.sectionCode);
        const st = gradeStatusOf(g?.status);
        return { section: s, studentCount: s.enrolledCount, missing: Number(g?.missing) || 0, status: (st === 'Released' ? 'released' : st === 'Submitted' ? 'submitted' : 'required') as 'required' | 'submitted' | 'released' };
      });
      return out.filter(x => !filters.status || filters.status === 'all' || x.status === filters.status);
    },
    async listHistory() {
      type Row = { id: string; course: string; title: string; offering: string; room: string; dates: string; schedule: string; instructor: string; term: string };
      const [p, secs] = await Promise.all([screen<{ hccCourseHistory?: { rows: Row[] } }>('/instructor/f/t39-course-history'), sections()]);
      return (p.hccCourseHistory?.rows ?? []).map<HistoricalOffering>(r => {
        const range = parseRange(r.dates);
        return { id: r.id, termLabel: r.term, code: r.course, sectionCode: r.offering, title: r.title, room: r.room, schedule: r.schedule, instructorName: r.instructor, startDate: range.start, endDate: range.end, resources: [], enrolled: secs.find(s => s.id === r.id)?.enrolledCount ?? 0 };
      });
    },
    async historyGradeDistribution(offeringId) {
      const d = await detail(offeringId);
      // Opening a gradebook with no assessments makes the API create a "Final Grade" column, so skip those offerings.
      if (!d.assessments?.length) return null;
      const g = await gradebook(offeringId);
      const weights = new Map(g.assignments.map(a => [a.id, a.weightPercent]));
      const pcts = g.rows.flatMap(r => {
        const released = r.cells.filter(c => c.status === 'published' && c.score != null && c.maxScore > 0);
        const w = released.reduce((n, c) => n + (weights.get(c.assignmentId) ?? 0), 0);
        if (!w) return [];
        return [released.reduce((n, c) => n + (c.score! / c.maxScore) * (weights.get(c.assignmentId) ?? 0), 0) / w * 100];
      });
      if (!pcts.length) return null;
      const counts = new Map<string, number>();
      pcts.forEach(p => { const l = letterFor(Math.round(p * 10) / 10); counts.set(l, (counts.get(l) ?? 0) + 1); });
      return { enrolled: d.roster?.length ?? g.rows.length, graded: pcts.length, bands: LETTERS.map(([, label]) => ({ label, count: counts.get(label) ?? 0 })) };
    },

    async listFaculties() {
      type P = { id: string; name: string; abbreviation: string; active: boolean };
      const p = await screen<{ facultiesPrograms?: { faculties: (P & { programs: P[] })[] } }>('/instructor/f/t13-program-management');
      return (p.facultiesPrograms?.faculties ?? []).map(f => ({
        id: f.id,
        name: f.name,
        abbreviation: f.abbreviation,
        status: f.active ? 'active' : 'inactive',
        programs: f.programs.map<AcademicProgram>(pr => ({ id: pr.id, facultyId: f.id, name: pr.name, abbreviation: pr.abbreviation, status: pr.active ? 'active' : 'inactive' })),
      })) as (Faculty & { programs: AcademicProgram[] })[];
    },
    async saveFaculty(f) {
      const response = await action<{ id?: string; name?: string; abbreviation?: string; active?: boolean }>('/instructor/f/t13-program-management', 'Save Faculty', JSON.stringify({
        facultyId: f.id,
        'Faculty Name': f.name,
        'Faculty Abbreviation': f.abbreviation,
        'Active / Inactive': f.status === 'active' ? 'Active' : 'Inactive',
      }));
      return { id: response.result?.id ?? f.id ?? '', name: response.result?.name ?? f.name, abbreviation: response.result?.abbreviation ?? f.abbreviation, status: response.result?.active === false ? 'inactive' : f.status };
    },
    async deleteFaculty(id) {
      await action('/instructor/f/t13-program-management', 'Delete Faculty', id);
      return {};
    },
    async saveProgram(p) {
      const faculty = (await instructorService.listFaculties()).find(f => f.id === p.facultyId);
      const response = await action<{ programId?: string; code?: string; facultyId?: string }>('/instructor/f/t13-program-management', 'Save Program', JSON.stringify({
        __programId: p.id,
        'Program Faculty': faculty?.name ?? p.facultyId,
        'Program Name': p.name,
        'Legal Program Name': p.legalName ?? p.name,
        Abbreviation: p.abbreviation,
        'Program Type': p.programTypeId ?? 'Diploma',
        'Active / Inactive': p.status === 'active' ? 'Active' : 'Inactive',
        __settings: p,
      }));
      return { ...p, id: response.result?.programId ?? p.id ?? '', facultyId: response.result?.facultyId ?? p.facultyId, abbreviation: response.result?.code ?? p.abbreviation };
    },
    async deleteProgram(id) {
      await action('/instructor/f/t13-program-management', 'Delete Program', id);
      return {};
    },
    async listProgramTypes(query) {
      const p = await screen<{ programTypes?: { types: { id: string; name: string; abbreviation: string; active: boolean }[] } }>('/instructor/f/t50-program-types');
      const q = query?.trim().toLowerCase();
      return (p.programTypes?.types ?? [])
        .map<ProgramType>((t, i) => ({ id: t.id, name: t.name, abbreviation: t.abbreviation, status: t.active ? 'active' : 'inactive', order: i + 1 }))
        .filter(t => !q || t.name.toLowerCase().includes(q) || t.abbreviation.toLowerCase().includes(q));
    },
    async saveProgramType(t) {
      const response = await action<{ id?: string; name?: string; abbreviation?: string; active?: boolean }>('/instructor/f/t50-program-types', 'Save Program Type', JSON.stringify({
        __typeId: t.id,
        'Program Type Name': t.name,
        Abbreviation: t.abbreviation,
        'Active / Inactive': t.status === 'active' ? 'Active' : 'Inactive',
      }));
      const all = await instructorService.listProgramTypes();
      return all.find(x => x.id === response.result?.id) ?? { ...t, id: response.result?.id ?? t.id ?? '', order: all.length + 1 };
    },
    async reorderProgramTypes(orderedIds) {
      await action('/instructor/f/t50-program-types', 'Reorder Program Types', JSON.stringify(orderedIds));
      return instructorService.listProgramTypes();
    },
    async deleteProgramType(id) {
      await action('/instructor/f/t50-program-types', 'Delete Program Type', id);
      return {};
    },
    async listTerms(campus) {
      const p = await termsScreen();
      return (p.manageTerms?.terms ?? [])
        .filter(t => !campus || /^all campuses$/i.test(campus) || t.campuses.includes(campus))
        .map<Term>(t => {
          const range = parseRange(t.dates ?? '');
          return { ...termFrom(t.name, t.startsOn || range.start, t.endsOn || range.end), id: t.id, code: t.code, name: t.name, campus: Array.isArray(t.campuses) ? t.campuses.join(', ') : t.campuses };
        });
    },
    async listCampuses() {
      const p = await termsScreen();
      return (p.manageTerms?.campusOptions ?? []).filter(o => o.value).map(o => o.label);
    },
    async saveTerm(t) {
      const response = await action<{ termId?: string }>('/instructor/f/t51-manage-terms', 'Save Term', JSON.stringify({
        __termId: t.id,
        'Term Name': t.name,
        'Term Abbreviation': t.code,
        'Start Date': t.startDate,
        'End Date': t.endDate,
        Campuses: t.campus.split(',').map(x => x.trim()).filter(Boolean).join('|'),
        Status: t.status,
        Notes: t.notes ?? '',
      }));
      const all = await instructorService.listTerms();
      return all.find(x => x.id === response.result?.termId) ?? { ...t, id: response.result?.termId ?? t.id ?? '' };
    },
    async deleteTerm(id) {
      await action('/instructor/f/t51-manage-terms', 'Delete Term', id);
      return {};
    },

    async getProfile(instructorId) {
      type KV = { label: string; value: string };
      const [b, p] = await Promise.all([bootstrap(), screen<{ profileBio?: { name: string; department: string; role: string; staffId: string; personal: KV[]; academic: KV[]; expertise: string[]; bio: string; connect: { phone: string; email: string } } }>('/instructor/f/t02-profile-biography')]);
      const bio = p.profileBio;
      const n = nameParts(bio?.name ?? b.displayName);
      const kv = (list: KV[] | undefined, re: RegExp) => list?.find(x => re.test(x.label))?.value;
      const clean = (v?: string) => (v && v !== '—' ? v : undefined);
      return {
        id: instructorId || api.accountId || '',
        role: 'instructor',
        loginId: b.email,
        demoPassword: '',
        displayName: n.display,
        firstName: n.first,
        lastName: n.last,
        email: bio?.connect.email || b.email,
        avatarInitials: initials(n.first, n.last),
        capabilities: [],
        instructor: {
          staffId: bio?.staffId ?? '',
          department: bio?.department ?? 'Faculty',
          rank: bio?.role ?? 'Instructor',
          phone: clean(bio?.connect.phone),
          highestDegree: clean(kv(bio?.academic, /degree/i)),
          biography: bio?.bio || undefined,
          topics: bio?.expertise?.length ? bio.expertise : [...new Set(b.sections.map(s => s.code))],
          availability: [],
          compensation: { basis: '—', rateLabel: '—', note: 'Compensation details are available from HR.' },
        },
      };
    },
    async getProfileTabs() {
      type Slot = { id?: string; day: string; start: string; end: string; mode: string; location: string; date?: string; endDate?: string; repeats?: string; note?: string };
      type Entry = { kind: 'class' | 'availability'; title: string; time: string; location?: string };
      const opt = <P>(path: string) => screen<P>(path).catch(() => ({}) as P);
      const [t, a, c, s] = await Promise.all([
        opt<{ profileTopics?: { currentCourses?: string[]; previousCourses?: string[]; academicChair?: string[]; certifications?: unknown[]; research?: unknown[] } }>('/instructor/f/t03-profile-topics'),
        opt<{ availability?: { slots?: Slot[]; officeHours?: string; generalInfo?: string; scheduleByDate?: { date: string; course: string; section: string; time: string }[] } }>('/instructor/f/t04-profile-availability'),
        opt<{ compensation?: { summary?: { label: string; value: string }[]; payPeriods?: Record<string, string>[]; contracts?: Record<string, string>[] } }>('/instructor/f/t05-profile-compensation'),
        opt<{ schedule?: { weekLabel?: string; weekDays?: { label: string; dateLabel: string; entries: Entry[] }[] } }>('/instructor/f/t06-profile-schedule'),
      ]);
      const strs = (v?: unknown[]) => (v ?? []).filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      return {
        topics: { current: t.profileTopics?.currentCourses ?? [], previous: t.profileTopics?.previousCourses ?? [], chair: t.profileTopics?.academicChair ?? [], certifications: strs(t.profileTopics?.certifications), research: strs(t.profileTopics?.research) },
        availability: {
          slots: (a.availability?.slots ?? []).map((x, i) => ({ id: x.id ?? `slot-${i}`, day: x.repeats || x.day, from: x.start, to: x.end, mode: x.mode, location: x.location, repeats: x.repeats || undefined, date: x.date || undefined, endDate: x.endDate || undefined, note: x.note || undefined })),
          officeHours: a.availability?.officeHours ?? '',
          generalInfo: a.availability?.generalInfo ?? '',
        },
        compensation: { summary: c.compensation?.summary ?? [], payPeriods: c.compensation?.payPeriods ?? [], contracts: c.compensation?.contracts ?? [] },
        schedule: {
          weekLabel: s.schedule?.weekLabel ?? '',
          days: (s.schedule?.weekDays ?? []).map(d => ({ label: d.label, dateLabel: d.dateLabel, entries: d.entries.map(e => ({ kind: e.kind, title: e.title, time: e.time, location: e.location })) })),
          upcoming: (a.availability?.scheduleByDate ?? []).filter(x => x.date >= today).sort((x, y) => x.date.localeCompare(y.date)).slice(0, 10),
        },
      };
    },
    async updateProfile(instructorId, patch) {
      await action('/instructor/f/t02-profile-biography', 'Save profile', JSON.stringify({
        ...(patch.displayName !== undefined ? { 'Display Name': patch.displayName } : {}),
        ...(patch.preferredName !== undefined ? { 'Preferred Name': patch.preferredName } : {}),
        ...(patch.email !== undefined ? { Email: patch.email } : {}),
        ...(patch.phone !== undefined ? { Phone: patch.phone } : {}),
        ...(patch.pronouns !== undefined ? { Pronouns: patch.pronouns } : {}),
        ...(patch.office !== undefined ? { Office: patch.office } : {}),
        ...(patch.department !== undefined ? { Department: patch.department } : {}),
        ...(patch.rank !== undefined ? { 'Faculty Rank': patch.rank } : {}),
        ...(patch.highestDegree !== undefined ? { Education: patch.highestDegree } : {}),
        ...(patch.yearsTeaching !== undefined ? { 'Years Teaching': String(patch.yearsTeaching) } : {}),
        ...(patch.hireDate !== undefined ? { 'Hire Date': patch.hireDate } : {}),
      }));
      return instructorService.getProfile(instructorId);
    },
    async accomplishments() {
      type Def = { id: string; name: string; description: string; status: string };
      const [b, p, badges] = await Promise.all([
        bootstrap(),
        screen<{ accomplishments?: { stats: { label: string; value: string }[]; items: { id?: string; title: string; detail: string; year: string; category: string; icon?: string }[]; definitions: Def[] } }>('/instructor/f/t34-accomplishments'),
        screen<{ hccBadges?: { rows: { id: string; student: string; badge: string; status: string }[] } }>('/instructor/f/t82-badges-accomplishments').catch(() => ({}) as { hccBadges?: undefined }),
      ]);
      const a = p.accomplishments;
      const stat = (re: RegExp) => Number(a?.stats.find(s => re.test(s.label))?.value) || 0;
      const meta = (desc: string, key: string) => new RegExp(`${key}:\\s*(.+)`, 'i').exec(desc)?.[1]?.trim() ?? '';
      const badgeBases: BadgeBase[] = (a?.definitions ?? []).map(d => ({
        id: d.id,
        name: d.name,
        description: d.description.split('\n')[0] ?? '',
        checkVersion: meta(d.description, 'Version'),
        language: meta(d.description, 'Language') || 'English',
        issuer: meta(d.description, 'Issuer') || 'Campus One',
        skillLevel: meta(d.description, 'Skill level') || '—',
        status: d.status === 'active' ? 'active' : 'inactive',
        createdAt: '',
      }));
      const records: FacultyRecord[] = (a?.items ?? []).map((it, i) => ({
        id: it.id ?? `derived-${i}`,
        instructorId: api.accountId ?? '',
        title: it.title,
        description: it.detail,
        year: it.year,
        icon: it.icon === 'award' || it.icon === 'curriculum' || it.icon === 'teaching' || it.icon === 'history' ? it.icon : /award|badge/i.test(it.title) ? 'award' : /course|taught/i.test(it.title) ? 'teaching' : /curricul/i.test(it.title) ? 'curriculum' : 'note',
      }));
      const rows = badges.hccBadges?.rows ?? [];
      return {
        currentSections: stat(/current section/i) || b.sectionCount,
        coursesTaught: stat(/course/i) || new Set(b.sections.map(s => s.code)).size,
        students: stat(/student/i) || b.studentCount,
        badgeBases,
        issuedCount: rows.filter(r => /award|earned|issued/i.test(r.status)).length,
        records,
        studentBadges: rows.map(r => ({ badgeCode: r.badge, title: r.badge, studentName: r.student, status: /award|earned|issued/i.test(r.status) ? ('earned' as const) : ('available' as const) })),
      };
    },
    async createBadgeBase(input) {
      const response = await action<{ id: string; name: string }>('/instructor/f/t70-add-badge', 'Save Badge / Accomplishment', JSON.stringify({ Name: input.name, Description: input.description, Version: input.checkVersion, Language: input.language, 'Issuer Name': input.issuer, 'Skill level': input.skillLevel, 'Badge Text': input.description }));
      if (!response.result?.id) throw new ServiceError('SERVER', 'Badge base was not returned by the server.');
      return { ...input, id: response.result.id, status: 'active', createdAt: nowIso() };
    },
    async addFacultyRecord(input) {
      const response = await action<{ id: string; title: string; detail: string; year: string; icon?: string }>('/instructor/f/t34-accomplishments', 'Add accomplishment', JSON.stringify({ Title: input.title, Description: input.description, Year: input.year, Icon: input.icon }));
      if (!response.result?.id) throw new ServiceError('SERVER', 'Faculty record was not returned by the server.');
      return { ...input, id: response.result.id, title: response.result.title, description: response.result.detail, year: response.result.year, icon: (response.result.icon as FacultyRecord['icon'] | undefined) ?? input.icon };
    },
    async updateFacultyRecord(id, patch) {
      if (id.startsWith('derived-')) throw new ServiceError('CONFLICT', 'Teaching history is calculated from assigned courses and cannot be edited here.');
      const response = await action<{ id: string; title: string; detail: string; year: string; icon?: string }>('/instructor/f/t34-accomplishments', 'Update accomplishment', JSON.stringify({ Id: id, ...(patch.title !== undefined ? { Title: patch.title } : {}), ...(patch.description !== undefined ? { Description: patch.description } : {}), ...(patch.year !== undefined ? { Year: patch.year } : {}), ...(patch.icon !== undefined ? { Icon: patch.icon } : {}) }));
      if (!response.result?.id) throw new ServiceError('SERVER', 'Faculty record was not returned by the server.');
      return { id: response.result.id, instructorId: patch.instructorId ?? api.accountId ?? '', title: response.result.title, description: response.result.detail, year: response.result.year, icon: (response.result.icon as FacultyRecord['icon'] | undefined) ?? patch.icon ?? 'note' };
    },
    async listSectionsForInstructor() {
      return sections();
    },
    ai: aiService,
  };
  return {
    core,
    service: instructorService,
    invalidate: () => {
      bootstrap.invalidate();
      myCourses.invalidate();
      sections.invalidate();
      dash.invalidate();
      directory.invalidate();
      detailCache.clear();
    },
  };
}

export type InstructorApi = ReturnType<typeof createInstructorApi>['core'];
