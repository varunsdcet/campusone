import type { CoursesService, AssignmentsService, GradesService, AttendanceService, WorkshopsService, SectionWithCourse, AssignmentWithContext } from '../contracts/academics';
import type { Section, Submission, Mark, AttendanceRecord, WorkshopEnrolment, GradeItem } from '../../domain/types';
import { ServiceError } from '../errors';
import { simulate, demoEmpty } from './simulate';
import { MockContext } from './context';
import { newId } from '../../utils/ids';
import { clock } from '../../utils/clock';
import { Repository } from '../../storage/repository';

export function withCourse(repo: Repository, s: Section): SectionWithCourse {
  const course = repo.find('courses', s.courseId)!;
  const instructor = repo.find('users', s.instructorId);
  const term = repo.find('terms', s.termId)!;
  const enrolledCount = repo.table('sectionEnrolments').filter(e => e.sectionId === s.id && e.status !== 'dropped').length;
  return { ...s, course, instructorName: instructor?.displayName ?? 'TBA', term, enrolledCount };
}

export function getSectionOrThrow(repo: Repository, id: string): SectionWithCourse {
  const s = repo.find('sections', id);
  if (!s) throw new ServiceError('NOT_FOUND', 'Course section not found');
  return withCourse(repo, s);
}

export function createCoursesMock(ctx: MockContext): CoursesService {
  const { repo } = ctx;
  return {
    async listStudentSections(studentId) {
      await simulate('courses.listStudentSections');
      const ids = repo.table('sectionEnrolments').filter(e => e.studentId === studentId).map(e => e.sectionId);
      const items = repo.table('sections').filter(s => ids.includes(s.id)).map(s => withCourse(repo, s));
      return demoEmpty('courses.listStudentSections', items, []);
    },
    async listInstructorSections(instructorId) {
      await simulate('courses.listInstructorSections');
      return repo.table('sections').filter(s => s.instructorId === instructorId).map(s => withCourse(repo, s));
    },
    async getSection(sectionId) {
      await simulate('courses.getSection');
      return getSectionOrThrow(repo, sectionId);
    },
    async listSessions(sectionId) {
      return repo.table('classSessions').filter(s => s.sectionId === sectionId).sort((a, b) => a.date.localeCompare(b.date));
    },
    async listRoster(sectionId) {
      await simulate('courses.listRoster');
      return repo.table('sectionEnrolments').filter(e => e.sectionId === sectionId && e.status !== 'dropped').map(e => {
        const u = repo.find('users', e.studentId)!;
        return { ...u, demoPassword: '', enrolment: e };
      }).sort((a, b) => a.lastName.localeCompare(b.lastName));
    },
    async listTerms() {
      return repo.table('terms');
    },
    async updateSectionContent(sectionId, patch) {
      await simulate('courses.updateSectionContent');
      return repo.mutate(db => {
        const s = db.sections.find(x => x.id === sectionId);
        if (!s) throw new ServiceError('NOT_FOUND', 'Section not found');
        Object.assign(s, patch);
        db.logs.push({ id: newId('log'), sectionId, at: new Date(clock.now()).toISOString(), actorId: s.instructorId, actorName: 'Instructor', activity: 'Course content', action: 'updated', source: 'app', event: 'Course content edited', description: 'Course content updated in edit mode.' });
        return { ...s };
      });
    },
  };
}

function deriveStatus(a: { dueAt?: string }, submission?: Submission, mark?: Mark): AssignmentWithContext['derivedStatus'] {
  if (mark?.status === 'released' && mark.score !== undefined) return 'graded';
  if (submission?.status === 'returned') return 'returned';
  if (submission?.status === 'draft') return 'draft';
  if (submission?.status === 'submitted' || submission?.status === 'late') {
    return submission.status === 'late' ? 'late' : 'submitted';
  }
  return 'upcoming';
}

export function createAssignmentsMock(ctx: MockContext): AssignmentsService {
  const { repo } = ctx;
  const build = (a: (typeof repo.data.assignments)[number], studentId: string): AssignmentWithContext => {
    const section = getSectionOrThrow(repo, a.sectionId);
    const submission = repo.table('submissions').find(s => s.assignmentId === a.id && s.studentId === studentId);
    const mark = repo.table('marks').find(m => m.gradeItemId === a.gradeItemId && m.studentId === studentId);
    return { ...a, section, submission, mark: mark?.status === 'released' ? mark : undefined, derivedStatus: deriveStatus(a, submission, mark) };
  };
  return {
    async listForStudent(studentId) {
      await simulate('assignments.listForStudent');
      const sectionIds = repo.table('sectionEnrolments').filter(e => e.studentId === studentId).map(e => e.sectionId);
      const items = repo.table('assignments').filter(a => sectionIds.includes(a.sectionId)).map(a => build(a, studentId));
      return demoEmpty('assignments.listForStudent', items, []);
    },
    async get(assignmentId, studentId) {
      await simulate('assignments.get');
      const a = repo.find('assignments', assignmentId);
      if (!a) throw new ServiceError('NOT_FOUND', 'Assignment not found');
      return build(a, studentId);
    },
    async saveDraft({ assignmentId, studentId, attachments, note }) {
      await simulate('assignments.saveDraft');
      return repo.mutate(db => {
        let s = db.submissions.find(x => x.assignmentId === assignmentId && x.studentId === studentId);
        if (s && s.status !== 'draft') throw new ServiceError('CONFLICT', 'This assignment has already been submitted.');
        if (!s) {
          s = { id: newId('sub'), assignmentId, studentId, status: 'draft', attachments: [], updatedAt: '' };
          db.submissions.push(s);
        }
        s.attachments = attachments;
        s.note = note;
        s.updatedAt = new Date(clock.now()).toISOString();
        return { ...s };
      });
    },
    async submit({ assignmentId, studentId, attachments, note, failUpload, onProgress }) {
      if (!attachments.length) throw new ServiceError('VALIDATION', 'Attach your completed document to enable submission.');
      // Simulated upload progress
      for (let i = 1; i <= 5; i++) {
        await new Promise<void>(r => setTimeout(r, 180));
        onProgress?.(i / 5 * 0.9);
        if (failUpload && i === 3) throw new ServiceError('NETWORK', 'Upload interrupted (simulated). Tap Retry to resume.', { retryable: true });
      }
      await simulate('assignments.submit');
      onProgress?.(1);
      const a = repo.find('assignments', assignmentId)!;
      const nowIso = new Date(clock.now()).toISOString();
      const late = a.dueAt ? clock.now() > new Date(a.dueAt).getTime() : false;
      return repo.mutate(db => {
        let s = db.submissions.find(x => x.assignmentId === assignmentId && x.studentId === studentId);
        if (s && s.status !== 'draft') throw new ServiceError('CONFLICT', 'This assignment has already been submitted.');
        if (!s) {
          s = { id: newId('sub'), assignmentId, studentId, status: 'draft', attachments: [], updatedAt: nowIso };
          db.submissions.push(s);
        }
        s.attachments = attachments;
        s.note = note;
        s.status = late ? 'late' : 'submitted';
        s.submittedAt = nowIso;
        s.receiptId = `RCPT-${a.sectionId.replace('sec_', '').toUpperCase()}-${Math.floor(clock.now() / 1000) % 10000}`;
        s.updatedAt = nowIso;
        // Create a draft mark placeholder for the instructor (not released).
        const markId = `${a.gradeItemId}:${studentId}`;
        if (!db.marks.find(m => m.id === markId)) {
          db.marks.push({ id: markId, gradeItemId: a.gradeItemId, sectionId: a.sectionId, studentId, status: 'draft', updatedAt: nowIso });
        }
        db.logs.push({ id: newId('log'), sectionId: a.sectionId, at: nowIso, actorId: studentId, actorName: db.users.find(u => u.id === studentId)?.displayName ?? studentId, activity: a.title, action: 'submitted', source: 'app', event: 'Assignment submitted', description: `Submitted ${attachments.length} file(s) for ${a.title}.` });
        return { ...s };
      });
    },
    async listSubmissionsForSection(sectionId) {
      await simulate('assignments.listSubmissionsForSection');
      const as = repo.table('assignments').filter(a => a.sectionId === sectionId);
      return repo.table('submissions').filter(s => as.some(a => a.id === s.assignmentId)).map(s => ({
        ...s, assignment: as.find(a => a.id === s.assignmentId)!, student: { ...repo.find('users', s.studentId)!, demoPassword: '' },
      }));
    },
  };
}

export function createGradesMock(ctx: MockContext): GradesService {
  const { repo } = ctx;
  return {
    async listGradeItems(sectionId) {
      await simulate('grades.listGradeItems');
      return repo.table('gradeItems').filter(g => g.sectionId === sectionId);
    },
    async addGradeItem(input) {
      await simulate('grades.addGradeItem');
      const existing = repo.table('gradeItems').filter(g => g.sectionId === input.sectionId);
      const total = existing.reduce((s, g) => s + g.weightPct, 0) + input.weightPct;
      if (total > 100) throw new ServiceError('VALIDATION', `Configured weights would total ${total}%. Weights must not exceed 100%.`);
      const item: GradeItem = { id: newId('gi'), ...input };
      repo.upsert('gradeItems', item);
      return item;
    },
    async listMarks(sectionId) {
      await simulate('grades.listMarks');
      return repo.table('marks').filter(m => m.sectionId === sectionId);
    },
    async listStudentMarks(studentId) {
      await simulate('grades.listStudentMarks');
      return repo.table('marks').filter(m => m.studentId === studentId && m.status === 'released');
    },
    async saveDraftMarks({ sectionId, marks }) {
      await simulate('grades.saveDraftMarks');
      return repo.mutate(db => {
        const out: Mark[] = [];
        for (const m of marks) {
          const gi = db.gradeItems.find(g => g.id === m.gradeItemId);
          if (!gi) throw new ServiceError('NOT_FOUND', 'Grade item not found');
          if (m.score !== undefined && (m.score < 0 || m.score > gi.maxPoints)) throw new ServiceError('VALIDATION', `${gi.name}: mark must be between 0 and ${gi.maxPoints}.`);
          const id = `${m.gradeItemId}:${m.studentId}`;
          let rec = db.marks.find(x => x.id === id);
          if (rec && rec.status === 'released') continue; // released marks are immutable in the demo
          if (!rec) {
            rec = { id, gradeItemId: m.gradeItemId, sectionId, studentId: m.studentId, status: 'draft', updatedAt: '' };
            db.marks.push(rec);
          }
          rec.score = m.score;
          rec.feedback = m.feedback;
          rec.status = 'draft';
          rec.updatedAt = new Date(clock.now()).toISOString();
          out.push({ ...rec });
        }
        return out;
      });
    },
    async submitMarks(sectionId) {
      await simulate('grades.submitMarks');
      const items = repo.table('gradeItems').filter(g => g.sectionId === sectionId);
      const roster = repo.table('sectionEnrolments').filter(e => e.sectionId === sectionId && e.status !== 'dropped');
      let missing = 0;
      for (const g of items) for (const e of roster) {
        const m = repo.table('marks').find(x => x.gradeItemId === g.id && x.studentId === e.studentId);
        if (!m || m.score === undefined) missing += 1;
      }
      if (missing > 0) throw new ServiceError('VALIDATION', `${missing} mark(s) are missing. Enter every mark before submitting.`);
      let submitted = 0;
      repo.mutate(db => {
        db.marks.filter(m => m.sectionId === sectionId && m.status === 'draft').forEach(m => {
          m.status = 'submitted';
          m.updatedAt = new Date(clock.now()).toISOString();
          submitted += 1;
        });
        db.logs.push({ id: newId('log'), sectionId, at: new Date(clock.now()).toISOString(), actorId: 'instructor', actorName: 'Instructor', activity: 'Grades', action: 'submitted', source: 'app', event: 'Grades submitted', description: `${submitted} marks submitted (not yet released).` });
      });
      return { submitted, missing: 0 };
    },
    async releaseMarks(sectionId) {
      await simulate('grades.releaseMarks');
      let released = 0;
      repo.mutate(db => {
        const nowIso = new Date(clock.now()).toISOString();
        db.marks.filter(m => m.sectionId === sectionId && m.status === 'submitted').forEach(m => {
          m.status = 'released';
          m.updatedAt = nowIso;
          released += 1;
          const sub = db.submissions.find(s => s.studentId === m.studentId && db.assignments.find(a => a.id === s.assignmentId)?.gradeItemId === m.gradeItemId);
          if (sub) sub.status = 'graded';
        });
        if (released) {
          const sec = db.sections.find(s => s.id === sectionId)!;
          const course = db.courses.find(c => c.id === sec.courseId)!;
          const studentIds = Array.from(new Set(db.marks.filter(m => m.sectionId === sectionId && m.status === 'released').map(m => m.studentId)));
          studentIds.forEach(sid => db.notifications.unshift({ id: newId('n'), userId: sid, title: 'Grades released', body: `${course.code} · ${course.title}: your instructor released class marks.`, category: 'Grades', createdAt: nowIso, read: false, icon: 'grade', link: { route: 'StudentCourseDetails', params: { sectionId, tab: 'grades' } } }));
        }
      });
      if (!released) throw new ServiceError('VALIDATION', 'No submitted marks to release. Submit marks first.');
      return { released };
    },
    async listFinalMarks(studentId) {
      await simulate('grades.listFinalMarks');
      return repo.table('finalMarks').filter(f => f.studentId === studentId);
    },
    async exportGradesCsv(sectionId) {
      const sec = getSectionOrThrow(repo, sectionId);
      const items = repo.table('gradeItems').filter(g => g.sectionId === sectionId);
      const roster = repo.table('sectionEnrolments').filter(e => e.sectionId === sectionId).map(e => repo.find('users', e.studentId)!);
      const header = ['Student', 'Student number', ...items.map(i => `${i.name} (${i.weightPct}%)`), 'Status'].join(',');
      const rows = roster.map(u => {
        const cells = items.map(i => {
          const m = repo.table('marks').find(x => x.gradeItemId === i.id && x.studentId === u.id);
          return m?.score ?? '';
        });
        const statuses = items.map(i => repo.table('marks').find(x => x.gradeItemId === i.id && x.studentId === u.id)?.status ?? 'missing');
        return [`"${u.displayName}"`, u.student?.studentNumber ?? '', ...cells, statuses.join('|')].join(',');
      });
      return { fileName: `${sec.course.code.replace(/\s/g, '')}-${sec.sectionCode}-grades-DEMO.csv`, content: [header, ...rows].join('\n') };
    },
  };
}

export function createAttendanceMock(ctx: MockContext): AttendanceService {
  const { repo } = ctx;
  const sessionFor = (sectionId: string, date: string) => repo.table('classSessions').find(s => s.sectionId === sectionId && s.date === date);
  return {
    async listStudentRecords(studentId) {
      await simulate('attendance.listStudentRecords');
      const items = repo.table('attendance').filter(a => a.studentId === studentId && a.state === 'submitted').map(a => ({
        ...a, session: repo.find('classSessions', a.sessionId)!, section: getSectionOrThrow(repo, a.sectionId),
      })).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
      return demoEmpty('attendance.listStudentRecords', items, []);
    },
    async requestCorrection({ studentId, recordId, reason }) {
      await simulate('attendance.requestCorrection');
      if (!reason.trim()) throw new ServiceError('VALIDATION', 'Describe what was recorded incorrectly.');
      const existing = repo.table('attendanceCorrections').find(c => c.recordId === recordId && c.status === 'pending');
      if (existing) throw new ServiceError('CONFLICT', 'A correction request for this session is already pending.');
      const req = { id: newId('corr'), studentId, recordId, reason, status: 'pending' as const, createdAt: new Date(clock.now()).toISOString() };
      repo.mutate(db => {
        db.attendanceCorrections.push(req);
        db.requests.push({ id: req.id, studentId, kind: 'attendanceCorrection', status: 'pending', createdAt: req.createdAt, reviewer: 'Department Registrar', payload: { recordId, reason }, summary: 'Attendance correction request' });
      });
      return req;
    },
    async listCorrections(studentId) {
      return repo.table('attendanceCorrections').filter(c => c.studentId === studentId);
    },
    async listForDate(instructorId, date, sectionId) {
      await simulate('attendance.listForDate');
      const sections = repo.table('sections').filter(s => s.instructorId === instructorId && (!sectionId || s.id === sectionId));
      return sections.map(s => {
        const session = sessionFor(s.id, date);
        const roster = repo.table('sectionEnrolments').filter(e => e.sectionId === s.id && e.status !== 'dropped').map(e => ({ ...repo.find('users', e.studentId)!, demoPassword: '' }));
        const records = session ? repo.table('attendance').filter(a => a.sessionId === session.id) : [];
        return { section: withCourse(repo, s), session, records, roster };
      });
    },
    async saveDraft({ sectionId, date, entries }) {
      await simulate('attendance.saveDraft');
      return writeAttendance(ctx, sectionId, date, entries, 'draft');
    },
    async submit({ sectionId, date, entries, instructorId }) {
      await simulate('attendance.submit');
      const roster = repo.table('sectionEnrolments').filter(e => e.sectionId === sectionId && e.status !== 'dropped');
      const missing = roster.filter(r => !entries.find(e => e.studentId === r.studentId));
      if (missing.length) throw new ServiceError('VALIDATION', `Mark every student before submitting (${missing.length} missing).`);
      const recs = writeAttendance(ctx, sectionId, date, entries, 'submitted');
      repo.mutate(db => {
        db.logs.push({ id: newId('log'), sectionId, at: new Date(clock.now()).toISOString(), actorId: instructorId, actorName: 'Instructor', activity: 'Attendance', action: 'submitted', source: 'app', event: 'Attendance submitted', description: `Attendance submitted for ${date}.` });
      });
      return recs;
    },
    async sectionSummary(sectionId) {
      const recs = repo.table('attendance').filter(a => a.sectionId === sectionId && a.state === 'submitted');
      const sessions = Array.from(new Set(recs.map(r => r.sessionId)));
      const last = sessions.map(id => repo.find('classSessions', id)!).sort((a, b) => b.date.localeCompare(a.date))[0];
      const lastRecs = last ? recs.filter(r => r.sessionId === last.id) : [];
      return { lastTaken: last?.date, present: lastRecs.filter(r => r.status === 'present').length, total: lastRecs.length, sessionsTaken: sessions.length };
    },
  };
}

function writeAttendance(ctx: MockContext, sectionId: string, date: string, entries: { studentId: string; status: AttendanceRecord['status']; note?: string }[], state: 'draft' | 'submitted'): AttendanceRecord[] {
  const { repo } = ctx;
  return repo.mutate(db => {
    let session = db.classSessions.find(s => s.sectionId === sectionId && s.date === date);
    if (!session) {
      const sec = db.sections.find(s => s.id === sectionId)!;
      session = { id: `${sectionId}_s_${date}`, sectionId, date, startTime: sec.startTime, endTime: sec.endTime, topic: 'Class session' };
      db.classSessions.push(session);
    }
    const out: AttendanceRecord[] = [];
    for (const e of entries) {
      const id = `${session.id}:${e.studentId}`;
      let rec = db.attendance.find(a => a.id === id);
      if (!rec) {
        rec = { id, sessionId: session.id, sectionId, studentId: e.studentId, status: e.status, state, recordedAt: '' };
        db.attendance.push(rec);
      }
      rec.status = e.status;
      rec.note = e.note;
      rec.state = state;
      rec.recordedAt = new Date(clock.now()).toISOString();
      out.push({ ...rec });
    }
    return out;
  });
}

export function createWorkshopsMock(ctx: MockContext): WorkshopsService {
  const { repo } = ctx;
  const counts = (workshopId: string) => repo.table('workshopEnrolments').filter(e => e.workshopId === workshopId && (e.status === 'approved' || e.status === 'completed')).length;
  const withStatus = (w: (typeof repo.data.workshops)[number], studentId?: string) => ({
    ...w, registeredCount: counts(w.id),
    myEnrolment: studentId ? repo.table('workshopEnrolments').find(e => e.workshopId === w.id && e.studentId === studentId && e.status !== 'dropped' && e.status !== 'declined') : undefined,
  });
  return {
    async list(studentId) {
      await simulate('workshops.list');
      return demoEmpty('workshops.list', repo.table('workshops').map(w => withStatus(w, studentId)), []);
    },
    async get(workshopId, studentId) {
      await simulate('workshops.get');
      const w = repo.find('workshops', workshopId);
      if (!w) throw new ServiceError('NOT_FOUND', 'Workshop not found');
      return withStatus(w, studentId);
    },
    async register({ studentId, workshopId }) {
      await simulate('workshops.register');
      const w = repo.find('workshops', workshopId);
      if (!w) throw new ServiceError('NOT_FOUND', 'Workshop not found');
      const active = repo.table('workshopEnrolments').find(e => e.workshopId === workshopId && e.studentId === studentId && ['pending', 'approved', 'completed'].includes(e.status));
      if (active) throw new ServiceError('CONFLICT', `You already have a ${active.status} registration for this workshop.`);
      if (counts(workshopId) >= w.capacity) throw new ServiceError('CONFLICT', 'This workshop is full.');
      const nowIso = new Date(clock.now()).toISOString();
      const rec: WorkshopEnrolment = { id: newId('we'), workshopId, studentId, status: w.requiresApproval ? 'pending' : 'approved', requestedAt: nowIso, decidedAt: w.requiresApproval ? undefined : nowIso };
      repo.mutate(db => {
        db.workshopEnrolments.push(rec);
        if (w.requiresApproval) {
          const student = db.users.find(u => u.id === studentId);
          db.users.filter(u => u.role === 'instructor' && u.capabilities.includes('workshops.approve')).forEach(i =>
            db.notifications.unshift({ id: newId('n'), userId: i.id, title: 'Workshop request pending', body: `${student?.displayName} requested ${w.code} — ${w.title}.`, category: 'Workshops', createdAt: nowIso, read: false, icon: 'workshop', link: { route: 'InstructorWorkshopEnrolments' } }),
          );
        }
      });
      return rec;
    },
    async drop({ studentId, workshopId }) {
      await simulate('workshops.drop');
      repo.mutate(db => {
        const e = db.workshopEnrolments.find(x => x.workshopId === workshopId && x.studentId === studentId && ['pending', 'approved'].includes(x.status));
        if (!e) throw new ServiceError('NOT_FOUND', 'No active registration to drop.');
        e.status = 'dropped';
        e.decidedAt = new Date(clock.now()).toISOString();
      });
    },
    async listEnrolmentsForInstructor() {
      await simulate('workshops.listEnrolmentsForInstructor');
      return repo.table('workshopEnrolments').map(e => ({ ...e, workshop: repo.find('workshops', e.workshopId)!, student: { ...repo.find('users', e.studentId)!, demoPassword: '' } }));
    },
    async decide({ enrolmentId, decision, instructorId }) {
      await simulate('workshops.decide');
      return repo.mutate(db => {
        const e = db.workshopEnrolments.find(x => x.id === enrolmentId);
        if (!e) throw new ServiceError('NOT_FOUND', 'Enrolment not found');
        if (decision === 'dropped' && e.status !== 'approved') throw new ServiceError('CONFLICT', 'Only approved enrolments can be dropped.');
        if (decision !== 'dropped' && e.status !== 'pending') throw new ServiceError('CONFLICT', `This request was already ${e.status}. Duplicate decisions are blocked.`);
        const w = db.workshops.find(x => x.id === e.workshopId)!;
        if (decision === 'approved') {
          const approved = db.workshopEnrolments.filter(x => x.workshopId === w.id && x.status === 'approved').length;
          if (approved >= w.capacity) throw new ServiceError('CONFLICT', 'Workshop is at capacity. Decline or drop another enrolment first.');
        }
        e.status = decision;
        e.decidedAt = new Date(clock.now()).toISOString();
        e.decidedBy = instructorId;
        db.notifications.unshift({ id: newId('n'), userId: e.studentId, title: `Workshop ${decision}`, body: `${w.code} — ${w.title}: your registration was ${decision}.`, category: 'Workshops', createdAt: e.decidedAt, read: false, icon: 'workshop', link: { route: 'StudentWorkshopDetails', params: { workshopId: w.id } } });
        return { ...e };
      });
    },
  };
}
