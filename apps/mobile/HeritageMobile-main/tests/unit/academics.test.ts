import { createTestServices } from '../../src/services';
import { createMemoryStore } from '../../src/storage/asyncStorage';
import { scenario } from '../../src/services/mock/simulate';
import { IDS } from '../../src/fixtures/constants';
import { clock } from '../../src/utils/clock';

beforeEach(() => { scenario.set({ latencyMs: 0, mode: 'success' }); clock.setOffsetMs(new Date('2026-09-25T15:44:17-07:00').getTime() - Date.now()); });

async function setup() {
  const { repo, services } = createTestServices(createMemoryStore());
  await repo.hydrate();
  return { repo, services };
}

describe('Assignments → grades cross-role flow', () => {
  it('submission requires an attachment, creates a receipt, and does not publish a grade', async () => {
    const { services } = await setup();
    await expect(services.assignments.submit({ assignmentId: 'as_acsw_final', studentId: IDS.student, attachments: [] })).rejects.toMatchObject({ code: 'VALIDATION' });
    const progress: number[] = [];
    const sub = await services.assignments.submit({ assignmentId: 'as_acsw_final', studentId: IDS.student, attachments: [{ id: 'a1', name: 'final.pdf', size: 100, mimeType: 'application/pdf', uri: 'file:///x.pdf' }], onProgress: p => progress.push(p) });
    expect(sub.status).toBe('submitted');
    expect(sub.receiptId).toBeTruthy();
    expect(progress[progress.length - 1]).toBe(1);
    const a = await services.assignments.get('as_acsw_final', IDS.student);
    expect(a.derivedStatus).toBe('submitted');
    expect(a.mark).toBeUndefined();
    await expect(services.assignments.submit({ assignmentId: 'as_acsw_final', studentId: IDS.student, attachments: sub.attachments })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('simulated upload failure is retryable', async () => {
    const { services } = await setup();
    await expect(services.assignments.submit({ assignmentId: 'as_acsw_q1', studentId: IDS.student, attachments: [{ id: 'a', name: 'q.pdf', size: 1, mimeType: 'application/pdf', uri: 'file:///q.pdf' }], failUpload: true })).rejects.toMatchObject({ code: 'NETWORK', retryable: true });
    const ok = await services.assignments.submit({ assignmentId: 'as_acsw_q1', studentId: IDS.student, attachments: [{ id: 'a', name: 'q.pdf', size: 1, mimeType: 'application/pdf', uri: 'file:///q.pdf' }] });
    expect(ok.status).toBe('submitted');
  });

  it('instructor marks: validation, missing blocks submit, submit ≠ release, student sees only released', async () => {
    const { services } = await setup();
    const items = await services.grades.listGradeItems(IDS.secACSW500);
    const roster = await services.courses.listRoster(IDS.secACSW500);
    await expect(services.grades.saveDraftMarks({ sectionId: IDS.secACSW500, marks: [{ gradeItemId: items[0].id, studentId: IDS.student, score: 120 }] })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(services.grades.submitMarks(IDS.secACSW500)).rejects.toThrow(/missing/);
    await services.grades.saveDraftMarks({ sectionId: IDS.secACSW500, marks: items.flatMap(g => roster.map(u => ({ gradeItemId: g.id, studentId: u.id, score: 80 }))) });
    expect((await services.grades.listStudentMarks(IDS.student)).filter(m => m.sectionId === IDS.secACSW500)).toHaveLength(0);
    const sub = await services.grades.submitMarks(IDS.secACSW500);
    expect(sub.submitted).toBe(items.length * roster.length);
    expect((await services.grades.listStudentMarks(IDS.student)).filter(m => m.sectionId === IDS.secACSW500)).toHaveLength(0);
    const rel = await services.grades.releaseMarks(IDS.secACSW500);
    expect(rel.released).toBe(items.length * roster.length);
    const visible = (await services.grades.listStudentMarks(IDS.student)).filter(m => m.sectionId === IDS.secACSW500);
    expect(visible).toHaveLength(items.length);
    const a = await services.assignments.get('as_acsw_final', IDS.student);
    expect(a.derivedStatus).toBe('graded');
    const notes = await services.notifications.list(IDS.student);
    expect(notes.some(n => n.title === 'Grades released')).toBe(true);
    await expect(services.grades.addGradeItem({ sectionId: IDS.secACSW500, name: 'Extra', weightPct: 10, maxPoints: 100 })).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});

describe('Attendance cross-role flow', () => {
  it('draft does not reach the student; submit does; correction request is pending', async () => {
    const { services } = await setup();
    const before = (await services.attendance.listStudentRecords(IDS.student)).length;
    await services.attendance.saveDraft({ instructorId: IDS.instructor, sectionId: IDS.secACSW500, date: '2026-09-22', entries: [{ studentId: IDS.student, status: 'late' }] });
    expect((await services.attendance.listStudentRecords(IDS.student)).length).toBe(before);
    const roster = await services.courses.listRoster(IDS.secACSW500);
    await expect(services.attendance.submit({ instructorId: IDS.instructor, sectionId: IDS.secACSW500, date: '2026-09-22', entries: [{ studentId: IDS.student, status: 'late' }] })).rejects.toMatchObject({ code: 'VALIDATION' });
    await services.attendance.submit({ instructorId: IDS.instructor, sectionId: IDS.secACSW500, date: '2026-09-22', entries: roster.map(u => ({ studentId: u.id, status: u.id === IDS.student ? 'late' : 'present' })) });
    const after = await services.attendance.listStudentRecords(IDS.student);
    expect(after.length).toBe(before + 1);
    const rec = after.find(r => r.session.date === '2026-09-22')!;
    expect(rec.status).toBe('late');
    const summary = await services.attendance.sectionSummary(IDS.secACSW500);
    expect(summary.lastTaken).toBe('2026-09-22');
    const corr = await services.attendance.requestCorrection({ studentId: IDS.student, recordId: rec.id, reason: 'I was on time' });
    expect(corr.status).toBe('pending');
    await expect(services.attendance.requestCorrection({ studentId: IDS.student, recordId: rec.id, reason: 'again' })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await services.attendance.listStudentRecords(IDS.student)).find(r => r.id === rec.id)?.status).toBe('late'); // not self-edited
  });
});

describe('Workshops cross-role flow', () => {
  it('approval-required registration stays pending until the instructor decides; capacity + duplicates enforced', async () => {
    const { services } = await setup();
    const req = await services.workshops.register({ studentId: IDS.student, workshopId: IDS.wsResume });
    expect(req.status).toBe('pending');
    await expect(services.workshops.register({ studentId: IDS.student, workshopId: IDS.wsResume })).rejects.toMatchObject({ code: 'CONFLICT' });
    const list = await services.workshops.listEnrolmentsForInstructor();
    const mine = list.find(e => e.id === req.id)!;
    expect(mine.student.displayName).toBe('Marcus Vance');
    const decided = await services.workshops.decide({ enrolmentId: req.id, decision: 'approved', instructorId: IDS.instructor });
    expect(decided.status).toBe('approved');
    await expect(services.workshops.decide({ enrolmentId: req.id, decision: 'declined', instructorId: IDS.instructor })).rejects.toMatchObject({ code: 'CONFLICT' });
    const w = await services.workshops.get(IDS.wsResume, IDS.student);
    expect(w.myEnrolment?.status).toBe('approved');
    expect(w.registeredCount).toBe(4);
    const open = await services.workshops.register({ studentId: IDS.student, workshopId: IDS.wsGis });
    expect(open.status).toBe('approved'); // no approval required
    await services.workshops.drop({ studentId: IDS.student, workshopId: IDS.wsGis });
    expect((await services.workshops.get(IDS.wsGis, IDS.student)).myEnrolment).toBeUndefined();
  });
});

describe('Requests & tasks', () => {
  it('leave request validates dates, overlaps and stays pending; survives a "restart"', async () => {
    const store = createMemoryStore();
    const { repo, services } = createTestServices(store);
    await repo.hydrate();
    await expect(services.requests.submitLeave({ studentId: IDS.student, startDate: '2026-12-10', endDate: '2026-12-01', reason: 'Medical procedure' })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(services.requests.submitLeave({ studentId: IDS.student, startDate: '2026-11-05', endDate: '2026-11-07', reason: 'Overlaps existing' })).rejects.toMatchObject({ code: 'CONFLICT' });
    const r = await services.requests.submitLeave({ studentId: IDS.student, startDate: '2026-12-01', endDate: '2026-12-07', reason: 'Family emergency travel' });
    expect(r.status).toBe('pending');
    await repo.flush();
    const { repo: repo2, services: s2 } = createTestServices(store);
    await repo2.hydrate();
    expect((await s2.requests.list(IDS.student, 'leave')).some(x => x.id === r.id)).toBe(true);
  });

  it('upload-required task cannot be completed without evidence; counts move together', async () => {
    const { services } = await setup();
    await expect(services.tasks.complete({ taskId: 'task1', studentId: IDS.student })).rejects.toMatchObject({ code: 'VALIDATION' });
    const t = await services.tasks.complete({ taskId: 'task1', studentId: IDS.student, evidence: { id: 'e', name: 'immunization.pdf', size: 10, mimeType: 'application/pdf', uri: 'file:///i.pdf' } });
    expect(t.status).toBe('completed');
    expect(t.approval).toBe('pending');
    const list = await services.tasks.list(IDS.student);
    expect(list.filter(x => x.status === 'pending')).toHaveLength(0);
    expect(list.filter(x => x.status === 'completed')).toHaveLength(3);
  });

  it('lets a student withdraw a pending leave request', async () => {
    const { services } = await setup();
    const request = await services.requests.submitLeave({ studentId: IDS.student, startDate: '2027-01-04', endDate: '2027-01-08', reason: 'Medical recovery period' });
    await services.requests.cancel(request.id);
    expect((await services.requests.get(request.id)).status).toBe('cancelled');
    await expect(services.requests.cancel(request.id)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('personal details request is pending and does not rewrite the official record', async () => {
    const { services, repo } = await setup();
    const r = await services.requests.submitPersonalDetails({ studentId: IDS.student, payload: { phone: '(604) 555-0000' } });
    expect(r.status).toBe('pending');
    expect(repo.find('users', IDS.student)!.student!.phone).toBe('(778) 676-6436');
  });

  it('finance balances derive from charges and payments; demo payment records a transaction', async () => {
    const { services } = await setup();
    const st = (await services.finance.listStatements(IDS.student)).find(s => s.termId === IDS.termTR1_2026)!;
    expect(st.totalCharges).toBe(13228);
    expect(st.totalPayments).toBe(10000);
    expect(st.balance).toBe(3228);
    expect(await services.finance.payBalance({ studentId: IDS.student, termId: IDS.termTR1_2026, amount: 1000, outcome: 'cancel' })).toBeNull();
    await services.finance.payBalance({ studentId: IDS.student, termId: IDS.termTR1_2026, amount: 1000, outcome: 'success' });
    const after = (await services.finance.listStatements(IDS.student)).find(s => s.termId === IDS.termTR1_2026)!;
    expect(after.balance).toBe(2228);
  });
});

describe('Notifications & mail persistence', () => {
  it('read state and drafts survive a restart', async () => {
    const store = createMemoryStore();
    const { repo, services } = createTestServices(store);
    await repo.hydrate();
    const unread = (await services.notifications.list(IDS.student)).find(n => !n.read)!;
    await services.notifications.markRead(IDS.student, unread.id);
    const draft = await services.mail.saveDraft({ userId: IDS.student, toIds: ['c_advising'], subject: 'Draft subject', body: 'Body', attachments: [] });
    await repo.flush();
    const { repo: r2, services: s2 } = createTestServices(store);
    await r2.hydrate();
    expect((await s2.notifications.list(IDS.student)).find(n => n.id === unread.id)?.read).toBe(true);
    expect((await s2.mail.list(IDS.student, 'drafts')).some(m => m.id === draft.id)).toBe(true);
  });

  it('send queues in outbox; processing delivers to internal recipients; failure is retryable', async () => {
    const { services } = await setup();
    await expect(services.mail.send({ userId: IDS.student, toIds: [], subject: 'x', body: 'y', attachments: [] })).rejects.toMatchObject({ code: 'VALIDATION' });
    const m = await services.mail.send({ userId: IDS.student, toIds: [IDS.instructor], subject: 'Hello', body: 'Hi Monica', attachments: [] });
    expect(m.folder).toBe('outbox');
    expect(m.outboxStatus).toBe('queued');
    await services.mail.processOutbox(IDS.student, { fail: true });
    expect((await services.mail.get(m.id)).outboxStatus).toBe('failed');
    await services.mail.retry(m.id);
    await services.mail.processOutbox(IDS.student);
    expect((await services.mail.get(m.id)).outboxStatus).toBe('sent');
    expect((await services.mail.list(IDS.instructor, 'inbox')).some(x => x.subject === 'Hello')).toBe(true);
  });
});
