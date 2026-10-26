/**
 * Read-only smoke test of every service against the live Heritage API.
 * Run: LIVE=1 CO_PW=... npx jest tests/live --testMatch '**\/live/*.test.ts'
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Repository } from '../../src/storage/repository';
import { buildSeed } from '../../src/fixtures/seed';
import { createApiServices } from '../../src/services/api';
import { useSessionStore } from '../../src/state/sessionStore';
import type { Services } from '../../src/services/contracts';

declare const process: { env: Record<string, string | undefined> };

const live = process.env.LIVE === '1' ? describe : describe.skip;
jest.setTimeout(240_000);

type Step = [string, () => Promise<unknown>];

async function runSteps(steps: Step[]) {
  const failures: string[] = [];
  for (const [name, fn] of steps) {
    const t = Date.now();
    try {
      const out = await fn();
      const size = Array.isArray(out) ? `${out.length} items` : out && typeof out === 'object' ? `keys=${Object.keys(out).slice(0, 6).join(',')}` : String(out);
      console.log(`OK   ${name} (${Date.now() - t}ms) ${size}`);
    } catch (e) {
      const err = e as { code?: string; message?: string; stack?: string };
      failures.push(`${name}: ${err.code ?? ''} ${err.message}`);
      console.log(`FAIL ${name}: ${err.code ?? ''} ${err.message}\n${(err.stack ?? '').split('\n').slice(1, 4).join('\n')}`);
    }
  }
  return failures;
}

function makeServices(): Services {
  const repo = new Repository({ store: AsyncStorage, seed: buildSeed, persistDelayMs: 0 });
  return createApiServices({ repo, store: AsyncStorage });
}

async function signIn(s: Services, loginId: string) {
  const { session, user } = await s.auth.login({ loginId, password: process.env.CO_PW ?? '', rememberMe: true });
  useSessionStore.getState().setSignedIn(session, user);
  return user;
}

live('live API', () => {
  it('student flows', async () => {
    const s = makeServices();
    const u = await signIn(s, 'ST-2024-001');
    const id = u.id;
    let sectionId = '';
    let assignmentId = '';
    let programmeId = '';
    let mailId = '';
    let workshopId = '';
    let requestId = '';
    let taxDocumentId = '';
    const failures = await runSteps([
      ['auth.restoreSession', () => s.auth.restoreSession()],
      ['auth.getSettings', () => s.auth.getSettings(id)],
      ['auth.verifyPassword', () => s.auth.verifyPassword(id, process.env.CO_PW ?? '')],
      ['courses.listStudentSections', async () => { const r = await s.courses.listStudentSections(id); sectionId = r[0]?.id ?? ''; return r; }],
      ['courses.getSection', () => s.courses.getSection(sectionId)],
      ['courses.listSessions', () => s.courses.listSessions(sectionId)],
      ['courses.listTerms', () => s.courses.listTerms()],
      ['assignments.listForStudent', async () => { const r = await s.assignments.listForStudent(id); assignmentId = r[0]?.id ?? ''; return r; }],
      ['assignments.get', () => s.assignments.get(assignmentId, id)],
      ['grades.listStudentMarks', () => s.grades.listStudentMarks(id)],
      ['grades.listFinalMarks', () => s.grades.listFinalMarks(id)],
      ['attendance.listStudentRecords', () => s.attendance.listStudentRecords(id)],
      ['attendance.listCorrections', () => s.attendance.listCorrections(id)],
      ['workshops.list', async () => { const r = await s.workshops.list(id); workshopId = r[0]?.id ?? ''; return r; }],
      ['workshops.get', () => workshopId ? s.workshops.get(workshopId, id) : Promise.resolve('no workshop')],
      ['records.listBadges', () => s.records.listBadges(id)],
      ['records.listExtracurricular', () => s.records.listExtracurricular(id)],
      ['records.listPlan', () => s.records.listPlan(id)],
      ['records.listPendingEvaluations', () => s.records.listPendingEvaluations?.() ?? Promise.resolve('not exposed')],
      ['records.listPracticum', () => s.records.listPracticum?.() ?? Promise.resolve('not exposed')],
      ['records.getCareer', () => s.records.getCareer?.() ?? Promise.resolve('not exposed')],
      ['records.getCalendars', () => s.records.getCalendars?.() ?? Promise.resolve('not exposed')],
      ['records.listCredentials', () => s.records.listCredentials?.() ?? Promise.resolve('not exposed')],
      ['tasks.list', () => s.tasks.list(id)],
      ['documents.list', () => s.documents.list(id)],
      ['documents.listTax', async () => { const r = await s.documents.listTax(id); taxDocumentId = r[0]?.id ?? ''; return r; }],
      ['documents.taxPdf', async () => {
        if (!taxDocumentId) return 'no tax document';
        const sess = JSON.parse((await AsyncStorage.getItem('campusone.session.v1')) ?? '{}');
        const response = await fetch(`https://myvccbc.com/__api/student/tax-documents/${encodeURIComponent(taxDocumentId)}/pdf`, { headers: { Authorization: `Bearer ${sess.accessToken}` } });
        if (!response.ok || !/application\/pdf/i.test(response.headers.get('content-type') ?? '')) throw new Error(`Tax PDF returned HTTP ${response.status} (${response.headers.get('content-type') ?? 'no content type'})`);
        return { status: response.status, contentType: response.headers.get('content-type') };
      }],
      ['finance.listStatements', () => s.finance.listStatements(id)],
      ['finance.listTransactions', () => s.finance.listTransactions(id)],
      ['requests.list', async () => { const r = await s.requests.list(id); requestId = r[0]?.id ?? ''; return r; }],
      ['requests.get', () => requestId ? s.requests.get(requestId) : Promise.resolve('no request')],
      ['requests.listEnglishTests', () => s.requests.listEnglishTests(id)],
      ['notifications.list', () => s.notifications.list(id)],
      ['mail.list inbox', async () => { const r = await s.mail.list(id, 'inbox'); mailId = r[0]?.id ?? ''; return r; }],
      ['mail.list outbox', () => s.mail.list(id, 'outbox')],
      ['mail.list drafts', () => s.mail.list(id, 'drafts')],
      ['mail.get', () => (mailId ? s.mail.get(mailId) : Promise.resolve('no mail'))],
      ['mail.listContacts', () => s.mail.listContacts()],
      ['raw /mail', async () => {
        const sess = JSON.parse((await AsyncStorage.getItem('campusone.session.v1')) ?? '{}');
        for (const q of ['', '?folderKind=inbox', '?folderKind=sent']) {
          const r = await fetch(`https://myvccbc.com/__api/mail${q}`, { headers: { Authorization: `Bearer ${sess.accessToken}` } });
          console.log(`   /mail${q}: ${r.status}`, (await r.text()).slice(0, 400));
        }
      }],
      ['askHeritage.suggestions', () => s.askHeritage.suggestions(id)],
      ['askHeritage.history', () => s.askHeritage.history(id)],
      ['askHeritage.ask', async () => { const a = await s.askHeritage.ask(id, 'When is my next class?'); console.log('   answer:', JSON.stringify(a).slice(0, 300)); return a; }],
      ['catalogue.listProgrammes', async () => { const r = await s.catalogue.listProgrammes(); programmeId = r[0]?.id ?? ''; return r; }],
      ['catalogue.getProgramme', async () => { const p = await s.catalogue.getProgramme(programmeId); console.log('   chapters:', p.chapters?.length, 'activities:', p.chapters?.[0]?.activities?.length); return p; }],
      ['catalogue.listBookmarks', () => s.catalogue.listBookmarks(id)],
      ['enrolment.listEnrolments', async () => { const r = await s.enrolment.listEnrolments(id); if (r[0]) programmeId = r[0].programmeId; return r; }],
      ['enrolment.listPayments', () => s.enrolment.listPayments(id)],
      ['learning.getSnapshot', () => s.learning.getSnapshot(id, programmeId)],
      ['learning.getCertificate', () => s.learning.getCertificate(id, programmeId)],
      ['courseLearning.getLms', () => s.courseLearning?.getLms(sectionId) ?? Promise.resolve('not exposed')],
      ['courseLearning.getContent', () => s.courseLearning?.getContent(sectionId) ?? Promise.resolve('not exposed')],
      ['courseLearning.listLectures', () => s.courseLearning?.listSessions(sectionId, 'lecture') ?? Promise.resolve('not exposed')],
      ['courseLearning.listLabs', () => s.courseLearning?.listSessions(sectionId, 'lab') ?? Promise.resolve('not exposed')],
      ['courseLearning.listAssessments', () => s.courseLearning?.listAssessments(sectionId) ?? Promise.resolve('not exposed')],
      ['courseLearning.getSyllabus', () => s.courseLearning?.getSyllabus(sectionId) ?? Promise.resolve('not exposed')],
      ['courseLearning.liveStatus', () => s.courseLearning?.liveStatus(sectionId) ?? Promise.resolve('not exposed')],
      ['courseLearning.liveRecordings', () => s.courseLearning?.liveRecordings(sectionId) ?? Promise.resolve('not exposed')],
      ['feePayments.enabled', () => s.feePayments?.enabled() ?? Promise.resolve('not exposed')],
    ]);
    await s.auth.logout();
    expect(failures).toEqual([]);
  });

  it('instructor flows', async () => {
    const s = makeServices();
    const u = await signIn(s, 'vance.instructor@heritage.edu');
    const id = u.id;
    let sectionId = '';
    let studentId = '';
    let lessonCourseId = '';
    let lessonId = '';
    let historyId = '';
    const failures = await runSteps([
      ['instructor.dashboard', async () => { const d = await s.instructor.dashboard(id); console.log('   dashboard:', JSON.stringify(d).slice(0, 300)); return d; }],
      ['courses.listInstructorSections', async () => {
        const r = await s.courses.listInstructorSections(id);
        for (const sec of r) {
          const [roster, sessions, marks] = await Promise.all([s.courses.listRoster(sec.id), s.courses.listSessions(sec.id), s.grades.listMarks(sec.id)]);
          console.log(`   ${sec.course?.code} ${sec.sectionCode}: roster=${roster.length} sessions=${sessions.length} marks=${marks.length}`);
          if (!sectionId && roster.length) sectionId = sec.id;
        }
        sectionId ||= r[0]?.id ?? '';
        return r;
      }],
      ['courses.getSection', () => s.courses.getSection(sectionId)],
      ['courses.listSessions', () => s.courses.listSessions(sectionId)],
      ['courses.listRoster', () => s.courses.listRoster(sectionId)],
      ['assignments.listSubmissionsForSection', () => s.assignments.listSubmissionsForSection(sectionId)],
      ['grades.listGradeItems', () => s.grades.listGradeItems(sectionId)],
      ['grades.listMarks', () => s.grades.listMarks(sectionId)],
      ['grades.exportGradesCsv', () => s.grades.exportGradesCsv(sectionId)],
      ['attendance.listForDate', () => s.attendance.listForDate(id, new Date().toISOString().slice(0, 10))],
      ['attendance.sectionSummary', () => s.attendance.sectionSummary(sectionId)],
      ['workshops.listEnrolmentsForInstructor', () => s.workshops.listEnrolmentsForInstructor()],
      ['instructor.listStudents', async () => { const r = await s.instructor.listStudents(id, { category: 'all', page: 1, pageSize: 20 }); studentId = r.items[0]?.id ?? ''; return r; }],
      ['instructor.getStudent', () => studentId ? s.instructor.getStudent(id, studentId) : Promise.resolve('no student')],
      ['instructor.getStudentRecord', () => studentId ? s.instructor.getStudentRecord(id, studentId) : Promise.resolve('no student')],
      ['instructor.studentNotes.list', () => studentId && s.instructor.studentNotes ? s.instructor.studentNotes.list(studentId) : Promise.resolve('not exposed')],
      ['instructor.listLessonCourses', async () => { const r = await s.instructor.listLessonCourses(id); lessonCourseId = r[0]?.id ?? ''; return r; }],
      ['instructor.listLessonPlans', async () => { const r = lessonCourseId ? await s.instructor.listLessonPlans(lessonCourseId) : []; lessonId = r[0]?.id ?? ''; return r; }],
      ['instructor.getLessonPlan', () => lessonId ? s.instructor.getLessonPlan(lessonId) : Promise.resolve('no lesson')],
      ['instructor.listCompetencies', () => s.instructor.listCompetencies(sectionId)],
      ['instructor.listSectionBadges', () => s.instructor.listSectionBadges(sectionId)],
      ['instructor.queryLogs', () => s.instructor.queryLogs({ sectionId })],
      ['instructor.listEvaluations', () => s.instructor.listEvaluations(id)],
      ['instructor.getEvaluation', () => s.instructor.getEvaluation(sectionId)],
      ['instructor.listRepositories', () => s.instructor.listRepositories({ page: 1, pageSize: 20 })],
      ['instructor.listScheduleChanges', () => s.instructor.listScheduleChanges(id)],
      ['instructor.gradeSubmissionOverview', () => s.instructor.gradeSubmissionOverview(id, { status: 'all' })],
      ['instructor.listHistory', async () => { const r = await s.instructor.listHistory(id); historyId = r[0]?.id ?? ''; return r; }],
      ['instructor.historyGradeDistribution', () => historyId ? s.instructor.historyGradeDistribution(historyId) : Promise.resolve('no history')],
      ['instructor.listFaculties', () => s.instructor.listFaculties()],
      ['instructor.listProgramTypes', () => s.instructor.listProgramTypes()],
      ['instructor.listTerms', () => s.instructor.listTerms()],
      ['instructor.listCampuses', () => s.instructor.listCampuses?.() ?? Promise.resolve('not exposed')],
      ['instructor.getProfile', () => s.instructor.getProfile(id)],
      ['instructor.getProfileTabs', () => s.instructor.getProfileTabs?.() ?? Promise.resolve('not exposed')],
      ['instructor.accomplishments', () => s.instructor.accomplishments(id)],
      ['instructor.listSectionsForInstructor', () => s.instructor.listSectionsForInstructor(id)],
      ['notifications.list', () => s.notifications.list(id)],
      ['mail.list inbox', () => s.mail.list(id, 'inbox')],
      ['askHeritage.suggestions', () => s.askHeritage.suggestions(id)],
      ['instructor.ai.courses', () => s.instructor.ai?.courses() ?? Promise.resolve('not exposed')],
      ['instructor.ai.topics', () => s.instructor.ai?.topics(sectionId) ?? Promise.resolve('not exposed')],
      ['instructor.ai.course', () => s.instructor.ai?.course(sectionId) ?? Promise.resolve('not exposed')],
    ]);
    await s.auth.logout();
    expect(failures).toEqual([]);
  });
});
