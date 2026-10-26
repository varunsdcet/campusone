import type { InstructorService, DashboardData, StudentNote } from '../contracts/instructor';
import type { UserAccount, LessonPlan, CompetencyDef, SectionBadge, ContentRepository, ProgramType, Term, Faculty, AcademicProgram, FacultyRecord, BadgeBase } from '../../domain/types';
import { ServiceError } from '../errors';
import { simulate, demoEmpty } from './simulate';
import { MockContext } from './context';
import { newId } from '../../utils/ids';
import { clock } from '../../utils/clock';
import { withCourse, getSectionOrThrow } from './academicsMock';

const pub = (u: UserAccount): UserAccount => ({ ...u, demoPassword: '' });

export function createInstructorMock(ctx: MockContext): InstructorService {
  const { repo } = ctx;
  const mySections = (instructorId: string) => repo.table('sections').filter(s => s.instructorId === instructorId);
  const missingFor = (sectionId: string) => {
    const items = repo.table('gradeItems').filter(g => g.sectionId === sectionId);
    const roster = repo.table('sectionEnrolments').filter(e => e.sectionId === sectionId && e.status !== 'dropped');
    let missing = 0;
    items.forEach(g => roster.forEach(r => {
      const m = repo.table('marks').find(x => x.gradeItemId === g.id && x.studentId === r.studentId);
      if (!m || m.score === undefined) missing += 1;
    }));
    return { missing, studentCount: roster.length };
  };
  const gradeStatus = (sectionId: string): 'required' | 'submitted' | 'released' => {
    const marks = repo.table('marks').filter(m => m.sectionId === sectionId);
    const { missing } = missingFor(sectionId);
    if (missing > 0 || marks.length === 0) return 'required';
    if (marks.every(m => m.status === 'released')) return 'released';
    if (marks.every(m => m.status !== 'draft')) return 'submitted';
    return 'required';
  };
  const requireCap = (instructorId: string, cap: UserAccount['capabilities'][number]) => {
    const u = repo.find('users', instructorId);
    const s = repo.table('settings').find(x => x.userId === instructorId);
    if (!u || !u.capabilities.includes(cap) || s?.extendedPermissionsDemo === false) {
      throw new ServiceError('PERMISSION_DENIED', `This action requires the "${cap}" capability. Production authorisation must be enforced by the backend.`);
    }
  };
  const notes: StudentNote[] = [];
  // The registry service methods are capability-gated for the single demo instructor.
  const registryActor = () => repo.table('users').find(u => u.role === 'instructor' && u.capabilities.includes('registry.faculties'))!.id;

  return {
    async dashboard(instructorId): Promise<DashboardData> {
      await simulate('instructor.dashboard');
      const secs = mySections(instructorId);
      const studentIds = new Set(repo.table('sectionEnrolments').filter(e => secs.some(s => s.id === e.sectionId) && e.status !== 'dropped').map(e => e.studentId));
      const courseIds = new Set(secs.map(s => s.courseId));
      const sections = secs.map(s => ({ ...withCourse(repo, s), gradeStatus: ({ required: 'Submission required', submitted: 'Submitted', released: 'Released' } as const)[gradeStatus(s.id)] }));
      return {
        studentCount: studentIds.size,
        courseCount: courseIds.size,
        sectionCount: secs.length,
        pendingGradeSections: sections.filter(s => s.enrolledCount > 0 && s.gradeStatus === 'Submission required').length,
        todos: repo.table('todos').filter(t => t.instructorId === instructorId && !t.done),
        sections,
        officeHours: { label: '2:00 PM', roomReady: true },
        unreadNotifications: repo.table('notifications').filter(n => n.userId === instructorId && !n.read).length,
      };
    },
    async completeTodo(todoId) {
      repo.mutate(db => {
        const t = db.todos.find(x => x.id === todoId);
        if (t) t.done = true;
      });
    },
    async listStudents(instructorId, filters) {
      await simulate('instructor.listStudents');
      requireCap(instructorId, 'students.directory');
      const secs = mySections(instructorId);
      const enrol = repo.table('sectionEnrolments').filter(e => secs.some(s => s.id === e.sectionId));
      const ids = Array.from(new Set(enrol.map(e => e.studentId)));
      let items = ids.map(id => {
        const u = pub(repo.find('users', id)!);
        const active = enrol.some(e => e.studentId === id && e.status === 'enrolled');
        return { ...u, status: active ? 'Active Student' : 'Former Student', termLabel: '2026F: 2026-09-01 – 2026-12-18', admissionTerm: `${u.student?.studentNumber.slice(3, 7)}F`, updatedAt: '2026-09-19T11:26:00-07:00' };
      });
      if (filters.category === 'active') items = items.filter(i => i.status === 'Active Student');
      if (filters.category === 'former') items = items.filter(i => i.status === 'Former Student');
      if (filters.query) {
        const q = filters.query.toLowerCase();
        items = items.filter(i => i.displayName.toLowerCase().includes(q) || i.student?.studentNumber.toLowerCase().includes(q) || i.student?.programName.toLowerCase().includes(q));
      }
      if (filters.program) items = items.filter(i => i.student?.programName === filters.program);
      if (filters.letter && filters.letter !== 'ALL') items = items.filter(i => i.lastName.toUpperCase().startsWith(filters.letter!));
      items.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
      const total = items.length;
      const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));
      const start = (filters.page - 1) * filters.pageSize;
      return demoEmpty('instructor.listStudents', { items: items.slice(start, start + filters.pageSize), total, pageCount }, { items: [], total: 0, pageCount: 1 });
    },
    async getStudent(instructorId, studentId) {
      await simulate('instructor.getStudent');
      const secs = mySections(instructorId);
      const allowed = repo.table('sectionEnrolments').some(e => e.studentId === studentId && secs.some(s => s.id === e.sectionId));
      if (!allowed) throw new ServiceError('PERMISSION_DENIED', 'You can only view students enrolled in your sections.');
      const u = pub(repo.find('users', studentId)!);
      const sections = repo.table('sectionEnrolments').filter(e => e.studentId === studentId && secs.some(s => s.id === e.sectionId)).map(e => getSectionOrThrow(repo, e.sectionId));
      return { ...u, sections };
    },
    async getStudentRecord(instructorId, studentId) {
      await simulate('instructor.getStudentRecord');
      const secIds = repo.table('sectionEnrolments').filter(e => e.studentId === studentId && mySections(instructorId).some(s => s.id === e.sectionId)).map(e => e.sectionId);
      if (!secIds.length) throw new ServiceError('PERMISSION_DENIED', 'You can only view students enrolled in your sections.');
      const attendance = repo.table('attendance')
        .filter(a => a.studentId === studentId && secIds.includes(a.sectionId) && a.state === 'submitted')
        .map(a => ({ sectionId: a.sectionId, date: repo.find('classSessions', a.sessionId)?.date ?? a.recordedAt.slice(0, 10), status: a.status, note: a.note }))
        .sort((a, b) => b.date.localeCompare(a.date));
      const grades = secIds.map(sectionId => ({
        sectionId,
        items: repo.table('gradeItems').filter(g => g.sectionId === sectionId).map(g => {
          const m = repo.table('marks').find(x => x.gradeItemId === g.id && x.studentId === studentId);
          return { id: g.id, name: g.name, weightPct: g.weightPct, maxPoints: g.maxPoints, score: m?.score, status: m?.status ?? 'draft', feedback: m?.feedback };
        }),
      })).filter(g => g.items.length);
      return { standing: 'Good Standing', attendance, grades };
    },
    studentNotes: {
      async list(studentId) {
        await simulate('instructor.studentNotes.list');
        if (!notes.some(n => n.studentId === studentId)) notes.push({ id: newId('note'), studentId, at: '2026-09-18T15:10:00-07:00', author: 'You', text: 'Participates well in class discussion. Follow up on the missing reflection journal.' });
        return notes.filter(n => n.studentId === studentId).sort((a, b) => b.at.localeCompare(a.at));
      },
      async add(studentId, text) {
        await simulate('instructor.studentNotes.add');
        if (!text.trim()) throw new ServiceError('VALIDATION', 'Note text is required.');
        const note = { id: newId('note'), studentId, at: new Date(clock.now()).toISOString(), author: 'You', text: text.trim() };
        notes.push(note);
        return note;
      },
    },
    async listLessonCourses(instructorId) {
      const courseIds = Array.from(new Set(repo.table('lessonPlans').map(l => l.courseId)));
      void instructorId;
      return repo.table('courses').filter(c => courseIds.includes(c.id));
    },
    async listLessonPlans(courseId) {
      await simulate('instructor.listLessonPlans');
      return repo.table('lessonPlans').filter(l => l.courseId === courseId).sort((a, b) => a.order - b.order);
    },
    async getLessonPlan(id) {
      const l = repo.find('lessonPlans', id);
      if (!l) throw new ServiceError('NOT_FOUND', 'Lesson not found');
      return l;
    },
    async saveLessonPlan(lesson) {
      await simulate('instructor.saveLessonPlan');
      if (!lesson.title.trim()) throw new ServiceError('VALIDATION', 'Lesson title is required.');
      const saved: LessonPlan = { ...lesson, draftUpdatedAt: new Date(clock.now()).toISOString(), readMinutes: Math.max(1, Math.round(lesson.content.split(/\s+/).length / 180)) || lesson.readMinutes };
      repo.upsert('lessonPlans', saved);
      return saved;
    },
    async generateLessonDraft(lessonId, kind) {
      await new Promise<void>(r => setTimeout(r, 1200)); // visible "generating" state
      await simulate('instructor.generateLessonDraft');
      const l = repo.find('lessonPlans', lessonId);
      if (!l) throw new ServiceError('NOT_FOUND', 'Lesson not found');
      const course = repo.find('courses', l.courseId);
      if (kind === 'quiz') {
        return { content: `## Practice quiz (demo template)\n\n1. Which statement best describes ${l.title}?\n   - A. Option one\n   - B. Option two\n   - C. Option three\n\n2. Give one workplace example related to ${course?.title ?? 'this course'}.\n\n3. True or false: the lesson's key idea applies to every business task.\n\n_Generated locally from an editable template — review before publishing._` };
      }
      return { content: `## ${l.title}\n\n**Learning outcomes**\n- Explain the core idea of ${l.title}\n- Apply it to a ${course?.title ?? 'course'} scenario\n- Identify common mistakes\n\n**Overview**\nThis lesson introduces ${l.title.toLowerCase()} and connects it to daily practice.\n\n**Activity (10 min)**\nIn pairs, list two situations where this applies and one where it does not.\n\n**Check for understanding**\nAsk learners to summarise the key idea in one sentence.\n\n_Generated locally from an editable template — review before publishing._` };
    },
    async publishLessonPlan(lessonId) {
      await simulate('instructor.publishLessonPlan');
      return repo.mutate(db => {
        const l = db.lessonPlans.find(x => x.id === lessonId);
        if (!l) throw new ServiceError('NOT_FOUND', 'Lesson not found');
        l.published = { title: l.title, content: l.content, publishedAt: new Date(clock.now()).toISOString() };
        return { ...l };
      });
    },
    async listCompetencies(sectionId) {
      await simulate('instructor.listCompetencies');
      return repo.table('competencies').filter(c => c.sectionId === sectionId).map(c => ({ ...c, assessments: repo.table('competencyAssessments').filter(a => a.competencyId === c.id) }));
    },
    async saveCompetency(def) {
      await simulate('instructor.saveCompetency');
      if (!def.name.trim()) throw new ServiceError('VALIDATION', 'Competency name is required.');
      const rec: CompetencyDef = { ...def, id: def.id ?? newId('comp') };
      repo.upsert('competencies', rec);
      return rec;
    },
    async deleteCompetency(id) {
      await simulate('instructor.deleteCompetency');
      repo.mutate(db => {
        db.competencies = db.competencies.filter(c => c.id !== id);
        db.competencyAssessments = db.competencyAssessments.filter(a => a.competencyId !== id);
      });
    },
    async assessCompetency({ competencyId, studentId, level }) {
      await simulate('instructor.assessCompetency');
      const id = `${competencyId}:${studentId}`;
      const rec = { id, competencyId, studentId, level, updatedAt: new Date(clock.now()).toISOString() };
      repo.upsert('competencyAssessments', rec);
      return rec;
    },
    async listSectionBadges(sectionId) {
      await simulate('instructor.listSectionBadges');
      return repo.table('sectionBadges').filter(b => b.sectionId === sectionId);
    },
    async saveSectionBadge(badge) {
      await simulate('instructor.saveSectionBadge');
      if (!badge.name.trim()) throw new ServiceError('VALIDATION', 'Badge name is required.');
      const rec: SectionBadge = { ...badge, id: badge.id ?? newId('sb') };
      repo.upsert('sectionBadges', rec);
      return rec;
    },
    async deleteSectionBadge(id) {
      await simulate('instructor.deleteSectionBadge');
      repo.remove('sectionBadges', id);
    },
    async queryLogs(f) {
      await simulate('instructor.queryLogs');
      return repo.table('logs').filter(l => l.sectionId === f.sectionId
        && (!f.participantId || f.participantId === 'all' || l.actorId === f.participantId)
        && (!f.date || f.date === 'all' || l.at.startsWith(f.date))
        && (!f.activity || f.activity === 'all' || l.activity === f.activity)
        && (!f.action || f.action === 'all' || l.action === f.action)
        && (!f.source || f.source === 'all' || l.source === f.source)
        && (!f.event || f.event === 'all' || l.event === f.event),
      ).sort((a, b) => b.at.localeCompare(a.at));
    },
    async listEvaluations(instructorId) {
      await simulate('instructor.listEvaluations');
      const hist = repo.table('history');
      const current = mySections(instructorId).map(s => getSectionOrThrow(repo, s.id));
      // Historical offerings appear as evaluation entries (empty) + current sections (populated where responses exist)
      const items = [
        ...current.map(s => {
          const ev = repo.table('evaluations').find(e => e.sectionId === s.id);
          return { ...(ev ?? { id: `ev_${s.id}`, sectionId: s.id, evaluationName: 'End of course evaluation', responses: [], invited: s.enrolledCount }), section: s };
        }),
        ...hist.map(h => ({ id: `ev_${h.id}`, sectionId: h.id, evaluationName: 'End of course evaluation', responses: [], invited: 0, section: { ...current[0], id: h.id, sectionCode: h.sectionCode, course: { id: h.id, code: h.code, title: h.title, department: '', credits: 3, description: '' }, startDate: h.startDate, endDate: h.endDate, scheduleLabel: 'Mon–Fri', location: h.room, enrolledCount: h.enrolled } })),
      ];
      return demoEmpty('instructor.listEvaluations', items, []);
    },
    async getEvaluation(sectionId) {
      await simulate('instructor.getEvaluation');
      const ev = repo.table('evaluations').find(e => e.sectionId === sectionId);
      const s = repo.find('sections', sectionId);
      if (s) return { ...(ev ?? { id: `ev_${sectionId}`, sectionId, evaluationName: 'End of course evaluation', responses: [], invited: 0 }), section: getSectionOrThrow(repo, sectionId) };
      const h = repo.find('history', sectionId);
      if (!h) return null;
      const base = getSectionOrThrow(repo, mySections(registryActor())[0].id);
      return { id: `ev_${h.id}`, sectionId: h.id, evaluationName: 'End of course evaluation', responses: [], invited: 0, section: { ...base, id: h.id, sectionCode: h.sectionCode, course: { id: h.id, code: h.code, title: h.title, department: '', credits: 3, description: '' } } };
    },
    async listRepositories(filters) {
      await simulate('instructor.listRepositories');
      let items = repo.table('repositories');
      if (filters.query) {
        const q = filters.query.toLowerCase();
        items = items.filter(r => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
      }
      if (filters.repository === 'Active only') items = items.filter(r => r.status === 'active');
      if (filters.repository === 'Inactive only') items = items.filter(r => r.status === 'inactive');
      const total = items.length;
      const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));
      const start = (filters.page - 1) * filters.pageSize;
      return demoEmpty('instructor.listRepositories', { items: items.slice(start, start + filters.pageSize), total, pageCount }, { items: [], total: 0, pageCount: 1 });
    },
    async createRepository(input) {
      await simulate('instructor.createRepository');
      const course = repo.find('courses', input.courseId);
      if (!course) throw new ServiceError('NOT_FOUND', 'Course not found');
      if (!input.name.trim()) throw new ServiceError('VALIDATION', 'Note / name is required.');
      if (input.sections < 1 || input.sections > 52) throw new ServiceError('VALIDATION', 'Sections / weeks must be between 1 and 52.');
      return repo.mutate(db => {
        const duplicates = db.repositories.filter(r => r.courseId === input.courseId && r.status === 'active');
        const deactivated: ContentRepository[] = [];
        if (duplicates.length && !input.deactivateDuplicates) {
          throw new ServiceError('CONFLICT', `An active repository already exists for ${course.code}. Confirm to deactivate ${duplicates.length} duplicate(s).`, { details: { duplicates: String(duplicates.length) } });
        }
        if (input.deactivateDuplicates) duplicates.forEach(d => { d.status = 'inactive'; deactivated.push({ ...d }); });
        const r: ContentRepository = { id: newId('repo'), code: course.code, name: input.name, courseId: input.courseId, status: 'active', lms: 'Moodle (demo label)', types: input.types, pushCount: 0, pullCount: 0, history: [{ id: newId('h'), at: new Date(clock.now()).toISOString(), action: 'Created', version: 1, by: 'Instructor' }], version: 1, deployed: 'local-ahead', format: input.format, sections: input.sections, isDefault: input.isDefault };
        db.repositories.unshift(r);
        return { repo: r, deactivated };
      });
    },
    async updateRepository(id, patch) {
      await simulate('instructor.updateRepository');
      return repo.mutate(db => {
        const r = db.repositories.find(x => x.id === id);
        if (!r) throw new ServiceError('NOT_FOUND', 'Repository not found');
        Object.assign(r, patch);
        r.history.unshift({ id: newId('h'), at: new Date(clock.now()).toISOString(), action: 'Edited', version: r.version, by: 'Instructor' });
        return { ...r };
      });
    },
    async deleteRepository(id) {
      await simulate('instructor.deleteRepository');
      repo.remove('repositories', id);
    },
    async repositoryAction(id, action) {
      await simulate('instructor.repositoryAction');
      return repo.mutate(db => {
        const r = db.repositories.find(x => x.id === id);
        if (!r) throw new ServiceError('NOT_FOUND', 'Repository not found');
        const nowIso = new Date(clock.now()).toISOString();
        if (action === 'push') {
          r.pushCount += 1;
          r.version += 1;
          r.deployed = 'synced';
          r.history.unshift({ id: newId('h'), at: nowIso, action: 'Push (demo — no LMS contacted)', version: r.version, by: 'Instructor' });
        } else if (action === 'pull') {
          r.pullCount += 1;
          r.deployed = 'synced';
          r.history.unshift({ id: newId('h'), at: nowIso, action: 'Pull (demo — no LMS contacted)', version: r.version, by: 'Instructor' });
        }
        return { ...r };
      });
    },
    async restoreRepositoryVersion(id, historyId) {
      await simulate('instructor.restoreRepositoryVersion');
      return repo.mutate(db => {
        const r = db.repositories.find(x => x.id === id);
        if (!r) throw new ServiceError('NOT_FOUND', 'Repository not found');
        const h = r.history.find(x => x.id === historyId);
        if (!h) throw new ServiceError('NOT_FOUND', 'Version not found');
        if (h.version === r.version) throw new ServiceError('CONFLICT', `v${h.version} is already the current version.`);
        r.version += 1;
        r.deployed = 'local-ahead';
        r.history.unshift({ id: newId('h'), at: new Date(clock.now()).toISOString(), action: `Restored v${h.version} (demo — no LMS contacted)`, version: r.version, by: 'Instructor' });
        return { ...r };
      });
    },
    async listScheduleChanges(instructorId, changeType) {
      await simulate('instructor.listScheduleChanges');
      const secs = mySections(instructorId);
      return demoEmpty('instructor.listScheduleChanges', repo.table('scheduleChanges').filter(c => secs.some(s => s.id === c.sectionId) && (!changeType || changeType === 'All' || c.changeType === changeType)).map(c => ({ ...c, section: getSectionOrThrow(repo, c.sectionId) })), []);
    },
    async decideScheduleChange({ id, decision, note }) {
      await simulate('instructor.decideScheduleChange');
      return repo.mutate(db => {
        const c = db.scheduleChanges.find(x => x.id === id);
        if (!c) throw new ServiceError('NOT_FOUND', 'Request not found');
        if (c.status !== 'pending') throw new ServiceError('CONFLICT', `Already ${c.status}.`);
        c.status = decision;
        c.decisionNote = note;
        c.decidedAt = new Date(clock.now()).toISOString();
        if (decision === 'accepted') {
          const s = db.sections.find(x => x.id === c.sectionId)!;
          s.startDate = c.proposed.startDate;
          s.endDate = c.proposed.endDate;
          s.scheduleLabel = c.proposed.scheduleLabel;
          if (c.proposed.location) s.location = c.proposed.location;
        }
        return { ...c };
      });
    },
    async gradeSubmissionOverview(instructorId, filters) {
      await simulate('instructor.gradeSubmissionOverview');
      const secs = mySections(instructorId).filter(s => !filters.sectionId || s.id === filters.sectionId);
      return secs.map(s => ({ section: getSectionOrThrow(repo, s.id), ...missingFor(s.id), status: gradeStatus(s.id) })).filter(x => x.studentCount > 0 && (!filters.status || filters.status === 'all' || x.status === filters.status));
    },
    async listHistory() {
      await simulate('instructor.listHistory');
      return repo.table('history');
    },
    async historyGradeDistribution(offeringId) {
      await simulate('instructor.historyGradeDistribution');
      const h = repo.find('history', offeringId);
      if (!h || !h.enrolled) return null;
      const shares: [string, number][] = [['A', 0.18], ['A-', 0.14], ['B+', 0.16], ['B', 0.14], ['B-', 0.1], ['C+', 0.08], ['C', 0.08], ['D', 0.04], ['F', 0.03]];
      const bands = shares.map(([label, p]) => ({ label, count: Math.floor(h.enrolled * p) }));
      const graded = Math.max(0, h.enrolled - 1);
      bands[0].count += Math.max(0, graded - bands.reduce((n, b) => n + b.count, 0));
      return { enrolled: h.enrolled, graded, bands };
    },
    async listFaculties() {
      await simulate('instructor.listFaculties');
      requireCap(registryActor(), 'registry.faculties');
      return repo.table('faculties').map(f => ({ ...f, programs: repo.table('academicPrograms').filter(p => p.facultyId === f.id) }));
    },
    async saveFaculty(f) {
      await simulate('instructor.saveFaculty');
      requireCap(registryActor(), 'registry.faculties');
      if (!f.name.trim() || !f.abbreviation.trim()) throw new ServiceError('VALIDATION', 'Name and abbreviation are required.');
      const rec: Faculty = { ...f, id: f.id ?? newId('fac') };
      repo.upsert('faculties', rec);
      return rec;
    },
    async deleteFaculty(id) {
      await simulate('instructor.deleteFaculty');
      requireCap(registryActor(), 'registry.faculties');
      const programs = repo.table('academicPrograms').filter(p => p.facultyId === id);
      if (programs.length) return { blockedBy: `${programs.length} program(s) still reference this faculty. Move or delete them first.` };
      repo.remove('faculties', id);
      return {};
    },
    async saveProgram(p) {
      await simulate('instructor.saveProgram');
      requireCap(registryActor(), 'registry.faculties');
      if (!p.facultyId || !p.name.trim()) throw new ServiceError('VALIDATION', 'Faculty and program name are required.');
      const rec: AcademicProgram = { ...p, id: p.id ?? newId('ap') };
      repo.upsert('academicPrograms', rec);
      return rec;
    },
    async deleteProgram(id) {
      await simulate('instructor.deleteProgram');
      requireCap(registryActor(), 'registry.faculties');
      const students = repo.table('users').filter(u => u.student?.programId === id);
      if (students.length) return { blockedBy: `${students.length} student record(s) are enrolled in this program. Deletion is blocked.` };
      repo.remove('academicPrograms', id);
      return {};
    },
    async listProgramTypes(query) {
      await simulate('instructor.listProgramTypes');
      const q = query?.toLowerCase();
      return repo.table('programTypes').filter(t => !q || t.name.toLowerCase().includes(q) || t.abbreviation.toLowerCase().includes(q)).sort((a, b) => a.order - b.order);
    },
    async saveProgramType(t) {
      await simulate('instructor.saveProgramType');
      requireCap(registryActor(), 'registry.programTypes');
      if (!t.name.trim() || !t.abbreviation.trim()) throw new ServiceError('VALIDATION', 'Name and abbreviation are required.');
      const dup = repo.table('programTypes').find(x => x.abbreviation.toLowerCase() === t.abbreviation.toLowerCase() && x.id !== t.id);
      if (dup) throw new ServiceError('VALIDATION', `Abbreviation "${t.abbreviation}" is already used by ${dup.name}.`);
      return repo.mutate(db => {
        const existing = t.id ? db.programTypes.find(x => x.id === t.id) : undefined;
        if (existing) {
          Object.assign(existing, t);
          return { ...existing };
        }
        const rec: ProgramType = { ...t, id: newId('pt'), order: db.programTypes.length };
        db.programTypes.push(rec);
        return rec;
      });
    },
    async reorderProgramTypes(orderedIds) {
      requireCap(registryActor(), 'registry.programTypes');
      return repo.mutate(db => {
        orderedIds.forEach((id, i) => {
          const t = db.programTypes.find(x => x.id === id);
          if (t) t.order = i;
        });
        return [...db.programTypes].sort((a, b) => a.order - b.order);
      });
    },
    async deleteProgramType(id) {
      await simulate('instructor.deleteProgramType');
      requireCap(registryActor(), 'registry.programTypes');
      const refs = repo.table('academicPrograms').filter(p => p.programTypeId === id);
      if (refs.length) return { blockedBy: `${refs.length} program(s) use this type (${refs.slice(0, 3).map(r => r.abbreviation).join(', ')}). Reassign them first.` };
      repo.remove('programTypes', id);
      return {};
    },
    async listTerms(campus) {
      await simulate('instructor.listTerms');
      return repo.table('terms').filter(t => !campus || campus === 'ALL CAMPUSES' || t.campus === campus).sort((a, b) => b.startDate.localeCompare(a.startDate));
    },
    async saveTerm(t) {
      await simulate('instructor.saveTerm');
      requireCap(registryActor(), 'registry.terms');
      if (!t.name.trim() || !t.code.trim()) throw new ServiceError('VALIDATION', 'Name and code are required.');
      if (t.endDate < t.startDate) throw new ServiceError('VALIDATION', 'End date must be after the start date.');
      const dup = repo.table('terms').find(x => x.code.toLowerCase() === t.code.toLowerCase() && x.id !== t.id);
      if (dup) throw new ServiceError('VALIDATION', `Term code "${t.code}" already exists.`);
      const rec: Term = { ...t, id: t.id ?? newId('t') };
      repo.upsert('terms', rec);
      return rec;
    },
    async deleteTerm(id) {
      await simulate('instructor.deleteTerm');
      requireCap(registryActor(), 'registry.terms');
      const refs = repo.table('sections').filter(s => s.termId === id);
      if (refs.length) return { blockedBy: `${refs.length} course section(s) are scheduled in this term. Deletion is blocked.` };
      repo.remove('terms', id);
      return {};
    },
    async getProfile(instructorId) {
      await simulate('instructor.getProfile');
      return pub(repo.find('users', instructorId)!);
    },
    async updateProfile(instructorId, patch) {
      await simulate('instructor.updateProfile');
      return repo.mutate(db => {
        const u = db.users.find(x => x.id === instructorId)!;
        const { displayName, preferredName, email, ...rest } = patch;
        if (displayName) u.displayName = displayName;
        if (preferredName !== undefined) u.preferredName = preferredName;
        if (email) u.email = email;
        u.instructor = { ...u.instructor!, ...rest };
        return pub(u);
      });
    },
    async accomplishments(instructorId) {
      await simulate('instructor.accomplishments');
      const secs = mySections(instructorId);
      const hist = repo.table('history');
      const students = new Set(repo.table('sectionEnrolments').filter(e => secs.some(s => s.id === e.sectionId)).map(e => e.studentId)).size;
      const awards = repo.table('badgeAwards').filter(a => a.issuedBy === instructorId);
      return {
        currentSections: secs.length,
        coursesTaught: new Set([...secs.map(s => repo.find('courses', s.courseId)?.code), ...hist.map(h => h.code)]).size,
        students,
        badgeBases: repo.table('badgeBases'),
        issuedCount: awards.filter(a => a.earnedAt).length,
        records: [
          ...repo.table('facultyRecords').filter(r => r.instructorId === instructorId),
          { id: 'derived_current', instructorId, title: 'Current teaching load', description: secs.map(s => repo.find('courses', s.courseId)?.code).join(', '), year: '2026F', icon: 'teaching' },
          { id: 'derived_prev', instructorId, title: 'Previous courses taught', description: `${hist.length} past offering(s) · ${hist.map(h => h.code).join(', ')}`, year: '2025F', icon: 'history' },
        ],
        studentBadges: awards.map(a => {
          const b = repo.find('badges', a.badgeId)!;
          return { badgeCode: b.code, title: b.title, studentName: repo.find('users', a.studentId)?.displayName ?? '', status: a.earnedAt ? 'earned' as const : 'available' as const, year: a.earnedAt?.slice(0, 4) };
        }),
      };
    },
    async createBadgeBase(input) {
      await simulate('instructor.createBadgeBase');
      if (!input.name.trim()) throw new ServiceError('VALIDATION', 'Badge base name is required.');
      const rec: BadgeBase = { ...input, id: newId('bb'), status: 'active', createdAt: new Date(clock.now()).toISOString() };
      repo.mutate(db => db.badgeBases.push(rec));
      return rec;
    },
    async addFacultyRecord(input) {
      await simulate('instructor.addFacultyRecord');
      if (!input.title.trim()) throw new ServiceError('VALIDATION', 'Title is required.');
      const rec: FacultyRecord = { ...input, id: newId('fr') };
      repo.mutate(db => db.facultyRecords.unshift(rec));
      return rec;
    },
    async updateFacultyRecord(id, patch) {
      await simulate('instructor.updateFacultyRecord');
      return repo.mutate(db => {
        const r = db.facultyRecords.find(x => x.id === id);
        if (!r) throw new ServiceError('NOT_FOUND', 'Record not found');
        Object.assign(r, patch);
        return { ...r };
      });
    },
    async listSectionsForInstructor(instructorId) {
      return mySections(instructorId);
    },
  };
}
