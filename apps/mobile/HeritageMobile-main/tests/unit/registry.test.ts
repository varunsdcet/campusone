import { createTestServices } from '../../src/services';
import { createMemoryStore } from '../../src/storage/asyncStorage';
import { scenario } from '../../src/services/mock/simulate';
import { IDS } from '../../src/fixtures/constants';
import { canAccess } from '../../src/navigation/permissions';
import { Routes } from '../../src/navigation/routes';

beforeEach(() => scenario.set({ latencyMs: 0, mode: 'success' }));

async function setup() {
  const { repo, services } = createTestServices(createMemoryStore());
  await repo.hydrate();
  return { repo, services };
}

describe('Program types', () => {
  it('create → edit → reorder → dependency-aware delete', async () => {
    const { services } = await setup();
    const t = await services.instructor.saveProgramType({ name: 'Micro-credential', abbreviation: 'MC', status: 'active' });
    expect(t.order).toBe(7);
    await expect(services.instructor.saveProgramType({ name: 'Dup', abbreviation: 'mc', status: 'active' })).rejects.toMatchObject({ code: 'VALIDATION' });
    const edited = await services.instructor.saveProgramType({ id: t.id, name: 'Micro-credential (edited)', abbreviation: 'MC', status: 'inactive' });
    expect(edited.name).toContain('edited');
    const list = await services.instructor.listProgramTypes();
    const ids = list.map(x => x.id);
    const reordered = await services.instructor.reorderProgramTypes([ids[ids.length - 1], ...ids.slice(0, -1)]);
    expect(reordered[0].id).toBe(t.id);
    const blocked = await services.instructor.deleteProgramType('pt_dip');
    expect(blocked.blockedBy).toMatch(/program/);
    expect((await services.instructor.listProgramTypes()).some(x => x.id === 'pt_dip')).toBe(true);
    const ok = await services.instructor.deleteProgramType(t.id);
    expect(ok.blockedBy).toBeUndefined();
    expect((await services.instructor.listProgramTypes()).some(x => x.id === t.id)).toBe(false);
  });
});

describe('Faculties, programs, terms', () => {
  it('blocks deleting referenced entities and allows unreferenced ones', async () => {
    const { services } = await setup();
    expect((await services.instructor.deleteFaculty('fac_cs')).blockedBy).toMatch(/program/);
    expect((await services.instructor.deleteProgram('prog_cs')).blockedBy).toMatch(/student/);
    expect((await services.instructor.deleteTerm(IDS.term2026F)).blockedBy).toMatch(/section/);
    const f = await services.instructor.saveFaculty({ name: 'Faculty of Arts', abbreviation: 'FA', status: 'active' });
    expect((await services.instructor.deleteFaculty(f.id)).blockedBy).toBeUndefined();
    await expect(services.instructor.saveTerm({ name: 'Bad', code: 'BAD', startDate: '2027-02-01', endDate: '2027-01-01', campus: 'x', status: 'upcoming' })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(services.instructor.saveTerm({ name: 'Dup', code: '2026F', startDate: '2027-01-01', endDate: '2027-02-01', campus: 'x', status: 'upcoming' })).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('capability gating: registry methods fail when the demo flag is off', async () => {
    const { services, repo } = await setup();
    repo.mutate(db => { db.settings.find(s => s.userId === IDS.instructor)!.extendedPermissionsDemo = false; });
    await expect(services.instructor.listFaculties()).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });
});

describe('Repository & schedules', () => {
  it('excludes zero-enrolment sections from the grade submission queue', async () => {
    const { services } = await setup();
    const queue = await services.instructor.gradeSubmissionOverview(IDS.instructor, { status: 'required' });
    expect(queue.length).toBeGreaterThan(0);
    expect(queue.every(item => item.studentCount > 0)).toBe(true);
    expect((await services.instructor.dashboard(IDS.instructor)).pendingGradeSections).toBe(queue.length);
  });

  it('duplicate active repository requires explicit confirmation', async () => {
    const { services } = await setup();
    await expect(services.instructor.createRepository({ courseId: 'c_acsw100', name: 'New', types: 'All', isDefault: true, format: 'Topics', sections: 10, deactivateDuplicates: false })).rejects.toMatchObject({ code: 'CONFLICT' });
    const r = await services.instructor.createRepository({ courseId: 'c_acsw100', name: 'New', types: 'All', isDefault: true, format: 'Topics', sections: 10, deactivateDuplicates: true });
    expect(r.deactivated).toHaveLength(1);
    const pushed = await services.instructor.repositoryAction(r.repo.id, 'push');
    expect(pushed.version).toBe(2);
    expect(pushed.history[0].action).toMatch(/demo/);
  });

  it('accepted schedule change updates the section; rejected stays traceable', async () => {
    const { services } = await setup();
    const acc = await services.instructor.decideScheduleChange({ id: 'sc7', decision: 'accepted' });
    expect(acc.status).toBe('accepted');
    expect((await services.courses.getSection(IDS.secACSW500)).location).toBe('#112 Heritage College - Surrey');
    const rej = await services.instructor.decideScheduleChange({ id: 'sc1', decision: 'rejected', note: 'conflict' });
    expect(rej.status).toBe('rejected');
    expect((await services.instructor.listScheduleChanges(IDS.instructor, 'All')).find(c => c.id === 'sc1')?.decisionNote).toBe('conflict');
    await expect(services.instructor.decideScheduleChange({ id: 'sc1', decision: 'accepted' })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('student directory is restricted to the instructor\'s sections', async () => {
    const { services } = await setup();
    const r = await services.instructor.listStudents(IDS.instructor, { category: 'all', page: 1, pageSize: 50 });
    expect(r.total).toBe(7);
    await expect(services.instructor.getStudent(IDS.instructorPendelton, 'u_student_aisha')).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });
});

describe('Route permissions', () => {
  it('denies cross-role and capability-gated routes', async () => {
    const { repo } = await setup();
    const student = repo.find('users', IDS.student)!;
    const instructor = repo.find('users', IDS.instructor)!;
    expect(canAccess(Routes.InstructorFaculties, student).ok).toBe(false);
    expect(canAccess(Routes.StudentOutline, instructor).ok).toBe(false);
    expect(canAccess(Routes.InstructorFaculties, instructor, { userId: instructor.id, timeZone: 'UTC', notificationsEnabled: true, extendedPermissionsDemo: false }).ok).toBe(false);
    expect(canAccess(Routes.InstructorFaculties, instructor, { userId: instructor.id, timeZone: 'UTC', notificationsEnabled: true, extendedPermissionsDemo: true }).ok).toBe(true);
    expect(canAccess(Routes.Notifications, student).ok).toBe(true);
    expect(canAccess(Routes.InstructorFaculties, { ...instructor, capabilities: [] }).ok).toBe(false);
  });
});

describe('HTTP adapter', () => {
  it('returns typed NOT_CONFIGURED for every method', async () => {
    const { createHttpServices } = require('../../src/services/http') as typeof import('../../src/services/http');
    const http = createHttpServices(() => undefined);
    await expect(http.auth.login({ loginId: 'x', password: 'y', rememberMe: false })).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
    await expect(http.courses.listStudentSections('x')).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });
});
