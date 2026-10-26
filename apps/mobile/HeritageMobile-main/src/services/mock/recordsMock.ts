import type { RecordsService, TasksService, DocumentsService, FinanceService, RequestsService, NotificationsService, MailService, AskHeritageService, AskHeritageAnswer, BadgeWithProgress } from '../contracts/records';
import type { MailMessage, ChangeRequest } from '../../domain/types';
import { ServiceError } from '../errors';
import { simulate, demoEmpty } from './simulate';
import { MockContext } from './context';
import { newId } from '../../utils/ids';
import { clock, MINUTE_MS } from '../../utils/clock';

export function createRecordsMock(ctx: MockContext): RecordsService {
  const { repo } = ctx;
  return {
    async listBadges(studentId) {
      await simulate('records.listBadges');
      const completedWorkshops = repo.table('workshopEnrolments').filter(e => e.studentId === studentId && e.status === 'completed').length;
      const items: BadgeWithProgress[] = repo.table('badges').map(b => {
        const award = repo.table('badgeAwards').find(a => a.badgeId === b.id && a.studentId === studentId);
        const current = b.requirement.type === 'workshops' ? completedWorkshops : award?.earnedAt ? b.requirement.target : 0;
        return { ...b, award, progress: { current, target: b.requirement.target }, earned: !!award?.earnedAt };
      });
      return demoEmpty('records.listBadges', items, []);
    },
    async listExtracurricular(studentId) {
      await simulate('records.listExtracurricular');
      return demoEmpty('records.listExtracurricular', repo.table('extracurricular').filter(e => e.studentId === studentId), []);
    },
    async listPlan(studentId) {
      await simulate('records.listPlan');
      return repo.table('planCourses').filter(p => p.studentId === studentId).sort((a, b) => a.order - b.order);
    },
    async requestTranscript(studentId) {
      await simulate('records.requestTranscript');
      const req: ChangeRequest = { id: newId('req'), studentId, kind: 'transcript', status: 'pending', createdAt: new Date(clock.now()).toISOString(), reviewer: 'Registrar Services', payload: { format: 'PDF (sealed)' }, summary: 'Official transcript request (mock)' };
      repo.mutate(db => db.requests.push(req));
      return req;
    },
  };
}

export function createTasksMock(ctx: MockContext): TasksService {
  const { repo } = ctx;
  return {
    async list(studentId) {
      await simulate('tasks.list');
      return repo.table('requiredTasks').filter(t => t.studentId === studentId);
    },
    async complete({ taskId, studentId, evidence, confirmation }) {
      await simulate('tasks.complete');
      return repo.mutate(db => {
        const t = db.requiredTasks.find(x => x.id === taskId && x.studentId === studentId);
        if (!t) throw new ServiceError('NOT_FOUND', 'Task not found');
        if (t.status === 'completed') throw new ServiceError('CONFLICT', 'This task is already completed.');
        if (t.requirement === 'upload' && !evidence) throw new ServiceError('VALIDATION', 'This task requires an uploaded document before it can be completed.');
        if (t.requirement === 'confirm' && !confirmation) throw new ServiceError('VALIDATION', 'Confirm the details to complete this task.');
        t.status = 'completed';
        t.completedAt = new Date(clock.now()).toISOString();
        t.evidence = evidence;
        t.approval = t.requirement === 'upload' ? 'pending' : undefined;
        return { ...t };
      });
    },
  };
}

export function createDocumentsMock(ctx: MockContext): DocumentsService {
  const { repo } = ctx;
  return {
    async list(studentId) {
      await simulate('documents.list');
      return demoEmpty('documents.list', repo.table('documents').filter(d => d.studentId === studentId), []);
    },
    async listTax(studentId) {
      await simulate('documents.listTax');
      return repo.table('taxDocuments').filter(d => d.studentId === studentId).sort((a, b) => b.year - a.year);
    },
    async requestSpecialLetter({ studentId, purpose, details }) {
      await simulate('documents.requestSpecialLetter');
      if (!purpose.trim()) throw new ServiceError('VALIDATION', 'Select a purpose for the letter.');
      const req: ChangeRequest = { id: newId('req'), studentId, kind: 'specialLetter', status: 'pending', createdAt: new Date(clock.now()).toISOString(), reviewer: 'Registrar Services', payload: { purpose, details }, summary: `Special verification letter · ${purpose}` };
      repo.mutate(db => db.requests.push(req));
      return req;
    },
  };
}

export function createFinanceMock(ctx: MockContext): FinanceService {
  const { repo } = ctx;
  const enrich = (s: (typeof repo.data.statements)[number]) => {
    const totalCharges = s.charges.reduce((a, c) => a + c.amount, 0);
    const totalTax = s.taxes.reduce((a, c) => a + c.amount, 0);
    const totalPayments = repo.table('transactions').filter(t => t.studentId === s.studentId && t.termId === s.termId && t.amount > 0).reduce((a, t) => a + t.amount, 0);
    return { ...s, totalCharges, totalTax, totalPayments, balance: totalCharges + totalTax - totalPayments };
  };
  return {
    async listStatements(studentId) {
      await simulate('finance.listStatements');
      return repo.table('statements').filter(s => s.studentId === studentId).map(enrich);
    },
    async listTransactions(studentId, termId) {
      await simulate('finance.listTransactions');
      return repo.table('transactions').filter(t => t.studentId === studentId && (!termId || t.termId === termId)).sort((a, b) => b.date.localeCompare(a.date));
    },
    async payBalance({ studentId, termId, amount, outcome }) {
      await simulate('finance.payBalance');
      if (amount <= 0) throw new ServiceError('VALIDATION', 'Enter an amount greater than zero.');
      if (outcome === 'cancel') return null;
      if (outcome === 'fail') throw new ServiceError('SERVER', 'Demo payment declined (simulated). No money was charged.', { retryable: true });
      const tx = { id: newId('tx'), studentId, termId, date: new Date(clock.now()).toISOString().slice(0, 10), description: 'Demo payment (no real funds)', amount, kind: 'demo-payment' as const, reference: `DEMO-PAY-${Math.floor(clock.now() / 1000) % 100000}` };
      repo.mutate(db => db.transactions.push(tx));
      return tx;
    },
  };
}

export function createRequestsMock(ctx: MockContext): RequestsService {
  const { repo } = ctx;
  const push = (req: ChangeRequest) => repo.mutate(db => db.requests.push(req));
  return {
    async list(studentId, kind) {
      await simulate('requests.list');
      return repo.table('requests').filter(r => r.studentId === studentId && (!kind || r.kind === kind)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async get(requestId) {
      const r = repo.find('requests', requestId);
      if (!r) throw new ServiceError('NOT_FOUND', 'Request not found');
      return r;
    },
    async submitPersonalDetails({ studentId, payload }) {
      await simulate('requests.submitPersonalDetails');
      const req: ChangeRequest = { id: newId('req'), studentId, kind: 'personalDetails', status: 'pending', createdAt: new Date(clock.now()).toISOString(), reviewer: 'Registrar', payload, summary: 'Personal details update' };
      push(req);
      return req;
    },
    async submitLeave({ studentId, startDate, endDate, reason }) {
      await simulate('requests.submitLeave');
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();
      if (!reason.trim()) throw new ServiceError('VALIDATION', 'Describe the reason for your leave.');
      if (!(end >= start)) throw new ServiceError('VALIDATION', 'End date must be on or after the start date.');
      const overlapping = repo.table('requests').find(r => r.studentId === studentId && r.kind === 'leave' && r.status === 'pending' && new Date(String(r.payload.startDate)).getTime() <= end && new Date(String(r.payload.endDate)).getTime() >= start);
      if (overlapping) throw new ServiceError('CONFLICT', 'A pending leave request already covers these dates.');
      const days = Math.round((end - start) / 86400000) + 1;
      const req: ChangeRequest = { id: newId('req'), studentId, kind: 'leave', status: 'pending', createdAt: new Date(clock.now()).toISOString(), reviewer: 'Academic Registrar', payload: { startDate, endDate, days, reason, termLabel: 'Fall 2026' }, summary: `${startDate} → ${endDate} · ${days} days` };
      push(req);
      return req;
    },
    async cancel(requestId) {
      await simulate('requests.cancel');
      const request = repo.find('requests', requestId);
      if (!request) throw new ServiceError('NOT_FOUND', 'Request not found');
      if (request.kind !== 'leave') throw new ServiceError('VALIDATION', 'Only leave-of-absence requests can be withdrawn.');
      if (request.status !== 'pending') throw new ServiceError('CONFLICT', 'Only a pending request can be withdrawn.');
      repo.mutate(db => {
        const row = db.requests.find(item => item.id === requestId);
        if (row) row.status = 'cancelled';
      });
    },
    async registerEnglishTest(input) {
      await simulate('requests.registerEnglishTest');
      const existing = repo.table('englishTests').find(e => e.studentId === input.studentId && e.status === 'pending-review');
      if (existing) throw new ServiceError('CONFLICT', 'A registration is already pending review.');
      const rec = { ...input, id: newId('et'), status: 'pending-review' as const, createdAt: new Date(clock.now()).toISOString() };
      repo.mutate(db => {
        db.englishTests.push(rec);
        db.requests.push({ id: rec.id, studentId: input.studentId, kind: 'englishTest', status: 'pending', createdAt: rec.createdAt, reviewer: 'Registrar', payload: { preferredDate: input.preferredDate }, summary: 'English test registration' });
      });
      return rec;
    },
    async listEnglishTests(studentId) {
      return repo.table('englishTests').filter(e => e.studentId === studentId);
    },
  };
}

export function createNotificationsMock(ctx: MockContext): NotificationsService {
  const { repo } = ctx;
  return {
    async list(userId) {
      await simulate('notifications.list');
      return demoEmpty('notifications.list', repo.table('notifications').filter(n => n.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), []);
    },
    async markRead(userId, id) {
      repo.mutate(db => {
        const n = db.notifications.find(x => x.id === id && x.userId === userId);
        if (n) n.read = true;
      });
    },
    async markAllRead(userId) {
      await simulate('notifications.markAllRead');
      repo.mutate(db => db.notifications.filter(n => n.userId === userId).forEach(n => (n.read = true)));
    },
  };
}

export function createMailMock(ctx: MockContext): MailService {
  const { repo } = ctx;
  const names = (ids: string[]) => ids.map(id => repo.table('contacts').find(c => c.id === id)?.name ?? repo.find('users', id)?.displayName ?? id);
  return {
    async list(userId, folder) {
      await simulate('mail.list');
      return demoEmpty('mail.list', repo.table('mail').filter(m => m.ownerId === userId && m.folder === folder).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), []);
    },
    async get(id) {
      const m = repo.find('mail', id);
      if (!m) throw new ServiceError('NOT_FOUND', 'Message not found');
      return m;
    },
    async listContacts() {
      return repo.table('contacts');
    },
    async saveDraft({ userId, draftId, toIds, subject, body, attachments }) {
      await simulate('mail.saveDraft');
      const me = repo.find('users', userId)!;
      return repo.mutate(db => {
        let m = draftId ? db.mail.find(x => x.id === draftId) : undefined;
        if (!m) {
          m = { id: newId('mail'), ownerId: userId, folder: 'drafts', fromId: userId, fromName: me.displayName, toIds: [], toNames: [], subject: '', body: '', attachments: [], createdAt: '', read: true, flagged: false };
          db.mail.push(m);
        }
        Object.assign(m, { toIds, toNames: names(toIds), subject, body, attachments, folder: 'drafts', createdAt: new Date(clock.now()).toISOString() });
        return { ...m };
      });
    },
    async send({ userId, draftId, toIds, subject, body, attachments }) {
      await simulate('mail.send');
      if (!toIds.length) throw new ServiceError('VALIDATION', 'Add at least one recipient.');
      if (!subject.trim()) throw new ServiceError('VALIDATION', 'Add a subject.');
      if (!body.trim()) throw new ServiceError('VALIDATION', 'Write a message.');
      const me = repo.find('users', userId)!;
      return repo.mutate(db => {
        let m = draftId ? db.mail.find(x => x.id === draftId) : undefined;
        if (!m) {
          m = { id: newId('mail'), ownerId: userId, folder: 'outbox', fromId: userId, fromName: me.displayName, toIds: [], toNames: [], subject: '', body: '', attachments: [], createdAt: '', read: true, flagged: false };
          db.mail.push(m);
        }
        const nowIso = new Date(clock.now()).toISOString();
        Object.assign(m, { toIds, toNames: names(toIds), subject, body, attachments, folder: 'outbox', outboxStatus: 'queued', sendAt: new Date(clock.now() + 2 * MINUTE_MS).toISOString(), createdAt: nowIso });
        return { ...m };
      });
    },
    async processOutbox(userId, opts) {
      await simulate('mail.processOutbox');
      return repo.mutate(db => {
        const queued = db.mail.filter(m => m.ownerId === userId && m.folder === 'outbox' && m.outboxStatus === 'queued');
        queued.forEach(m => {
          if (opts?.fail) {
            m.outboxStatus = 'failed';
            return;
          }
          m.outboxStatus = 'sent';
          m.folder = 'outbox';
          // Deliver a copy to internal demo recipients' inboxes.
          m.toIds.forEach(to => {
            if (db.users.find(u => u.id === to)) {
              db.mail.push({ ...m, id: newId('mail'), ownerId: to, folder: 'inbox', read: false, flagged: false, outboxStatus: undefined, sendAt: undefined, createdAt: new Date(clock.now()).toISOString() });
            }
          });
        });
        return queued.map(m => ({ ...m }));
      });
    },
    async retry(messageId) {
      await simulate('mail.retry');
      return repo.mutate(db => {
        const m = db.mail.find(x => x.id === messageId);
        if (!m) throw new ServiceError('NOT_FOUND', 'Message not found');
        m.outboxStatus = 'queued';
        m.sendAt = new Date(clock.now() + 2 * MINUTE_MS).toISOString();
        return { ...m };
      });
    },
    async markRead(messageId, read) {
      repo.mutate(db => {
        const m = db.mail.find(x => x.id === messageId);
        if (m) m.read = read;
      });
    },
    async flag(messageId, flagged) {
      repo.mutate(db => {
        const m = db.mail.find(x => x.id === messageId);
        if (m) m.flagged = flagged;
      });
    },
    async move(ids, folder) {
      await simulate('mail.move');
      repo.mutate(db => db.mail.filter(m => ids.includes(m.id)).forEach(m => {
        if (folder === 'deleted') m.previousFolder = m.folder;
        m.folder = folder;
      }));
    },
    async deletePermanently(ids) {
      await simulate('mail.deletePermanently');
      repo.mutate(db => {
        db.mail = db.mail.filter(m => !ids.includes(m.id)) as MailMessage[];
      });
    },
  };
}

/* ---------------- Ask Heritage (read-only, grounded in local records) ---------------- */

const askHistory = new Map<string, AskHeritageAnswer[]>();

export function createAskHeritageMock(ctx: MockContext): AskHeritageService {
  const { repo } = ctx;
  return {
    async suggestions(userId) {
      const u = repo.find('users', userId)!;
      return u.role === 'student'
        ? ['Can I graduate next summer?', 'Why is STAT310 blocked?', 'Can I take Summer courses?', 'What is my attendance rate?']
        : ['Which sections still need grades?', 'Who is waiting for workshop approval?', 'What schedule conflicts are open?', 'How many students are in my sections?'];
    },
    async ask(userId, question) {
      await simulate('askHeritage.ask');
      const u = repo.find('users', userId)!;
      const nowIso = new Date(clock.now()).toISOString();
      let answer: AskHeritageAnswer;
      if (u.role === 'student') {
        const fm = repo.table('finalMarks').filter(f => f.studentId === userId);
        const earned = fm.filter(f => f.gradePoints !== undefined).reduce((a, f) => a + f.credits, 0);
        const required = 27;
        const q = question.toLowerCase();
        const att = repo.table('attendance').filter(a => a.studentId === userId && a.state === 'submitted');
        if (q.includes('attendance')) {
          const present = att.filter(a => a.status === 'present').length;
          answer = {
            id: newId('ask'), question, createdAt: nowIso, context: `${u.student?.programName} (${u.student?.catalogYear})`,
            assessment: `Your recorded attendance rate is ${Math.round((present / Math.max(1, att.length)) * 100)}% across ${att.length} recorded sessions.`,
            facts: [
              { kind: 'FACT', text: `${present} present · ${att.filter(a => a.status === 'late').length} late · ${att.filter(a => a.status === 'absent').length} absent.` },
              { kind: 'INFERENCE', text: 'Late arrivals count toward attendance but not toward the on-time rate.' },
              { kind: 'UNCERTAINTY', text: 'Draft attendance not yet submitted by instructors is excluded.' },
            ],
            actions: [{ label: 'Open attendance', route: 'StudentAttendance' }],
            sources: att.slice(0, 4).map(a => ({ label: `${repo.find('sections', a.sectionId)?.sectionCode} session ${a.sessionId.slice(-2)}`, route: 'StudentAttendance' })),
          };
        } else {
          answer = {
            id: newId('ask'), question, createdAt: nowIso, context: `${u.student?.programName} (${u.student?.catalogYear})`,
            assessment: q.includes('summer') && q.includes('course')
              ? 'Summer offerings exist for MATH210 in the demo catalogue; sequencing still requires MATH210 before STAT310.'
              : 'Earliest projected degree completion from catalog sequencing rules is Summer 2027. You cannot complete graduation requirements by Summer 2026.',
            facts: [
              { kind: 'FACT', text: `${earned} credits satisfied; ${required - earned} credits remain of ${required} required.` },
              { kind: 'INFERENCE', text: 'Sequencing requires 4 sequential semesters: MATH210 → STAT310 → DATA401 → Capstone.' },
              { kind: 'CONFLICT', text: 'Prerequisite chain blocked: STAT310 needs MATH210; DATA401 needs STAT310.' },
              { kind: 'UNCERTAINTY', text: 'Seat availability & unlisted external transfer credits are not included unless formally articulated.' },
            ],
            requirements: [
              { code: 'ENG110', title: 'Academic Writing', meta: '3 Credits · Core Foundation', status: 'inProgress' },
              { code: 'MATH210', title: 'Discrete Math', meta: '3 Credits · Major Core', status: 'inProgress' },
              { code: 'STAT310', title: 'Applied Statistics', meta: '3 Credits · Prerequisite missing', status: 'blocked', blockedBy: 'MATH210' },
              { code: 'DATA401', title: 'Data Engineering', meta: '3 Credits · Advanced Sequence', status: 'blocked', blockedBy: 'STAT310' },
              { code: 'ELECTIVE', title: 'Open Elective', meta: '3 Credits · General Breadth', status: 'missing' },
              { code: 'CAPSTONE', title: 'CS Capstone', meta: '3 Credits · Terminal Project', status: 'missing' },
            ],
            actions: [
              { label: 'View full degree audit checklist', route: 'StudentProgramPlan' },
              { label: 'Explore plan', route: 'StudentProgramPlan' },
              { label: 'Book advisor', route: 'StudentMailCompose', params: { toId: 'c_advising' } },
            ],
            sources: [
              { label: `${u.student?.programName} · ${u.student?.catalogYear}`, route: 'StudentProgramPlan' },
              { label: `Student ${u.student?.studentNumber}`, route: 'StudentProfile' },
              ...repo.table('sectionEnrolments').filter(e => e.studentId === userId).slice(0, 6).map(e => {
                const s = repo.find('sections', e.sectionId)!;
                const c = repo.find('courses', s.courseId)!;
                return { label: `${c.code} enrolment`, route: 'StudentCourseDetails', params: { sectionId: s.id } };
              }),
            ],
          };
        }
      } else {
        const sections = repo.table('sections').filter(s => s.instructorId === userId);
        const missingBySection = sections.map(s => {
          const items = repo.table('gradeItems').filter(g => g.sectionId === s.id);
          const roster = repo.table('sectionEnrolments').filter(e => e.sectionId === s.id && e.status !== 'dropped');
          let missing = 0;
          items.forEach(g => roster.forEach(r => {
            const m = repo.table('marks').find(x => x.gradeItemId === g.id && x.studentId === r.studentId);
            if (!m || m.score === undefined) missing += 1;
          }));
          return { s, missing };
        });
        const pendingWs = repo.table('workshopEnrolments').filter(e => e.status === 'pending');
        const conflicts = repo.table('scheduleChanges').filter(c => c.status === 'pending' && sections.some(s => s.id === c.sectionId));
        const students = new Set(repo.table('sectionEnrolments').filter(e => sections.some(s => s.id === e.sectionId)).map(e => e.studentId)).size;
        answer = {
          id: newId('ask'), question, createdAt: nowIso, context: 'Instructor records · Fall 2026',
          assessment: `${missingBySection.filter(x => x.missing > 0).length} of ${sections.length} sections still require grade submission; ${pendingWs.length} workshop request(s) await a decision; ${conflicts.length} schedule change(s) are open.`,
          facts: [
            { kind: 'FACT', text: `${students} distinct students across ${sections.length} sections.` },
            ...missingBySection.filter(x => x.missing > 0).slice(0, 3).map(x => ({ kind: 'FACT' as const, text: `${repo.find('courses', x.s.courseId)?.code} (${x.s.sectionCode}): ${x.missing} marks missing.` })),
            { kind: 'INFERENCE', text: 'Submitted marks remain invisible to students until released.' },
            { kind: 'UNCERTAINTY', text: 'Registrar deadlines are demo values, not confirmed policy.' },
          ],
          actions: [
            { label: 'Open Grades Submission', route: 'InstructorGradesSubmission' },
            { label: 'Workshop enrolments', route: 'InstructorWorkshopEnrolments' },
            { label: 'Pending schedules', route: 'InstructorPendingSchedules' },
          ],
          sources: sections.slice(0, 6).map(s => ({ label: `${repo.find('courses', s.courseId)?.code} ${s.sectionCode}`, route: 'InstructorCourseWorkspace', params: { sectionId: s.id } })),
        };
      }
      const list = askHistory.get(userId) ?? [];
      list.push(answer);
      askHistory.set(userId, list);
      return answer;
    },
    async history(userId) {
      return askHistory.get(userId) ?? [];
    },
    async feedback(userId, answerId, value) {
      const list = askHistory.get(userId) ?? [];
      const a = list.find(x => x.id === answerId);
      if (a) a.feedback = value;
    },
  };
}
