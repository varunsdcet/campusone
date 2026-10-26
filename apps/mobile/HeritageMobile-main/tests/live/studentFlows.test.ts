/**
 * Live check of the student assignment / workshop / evaluation / record adapters.
 * Writes are limited to uploading one tiny file to an open assignment draft and deleting it again.
 * Run: LIVE=1 CO_PW=... npx jest tests/live/studentFlows.test.ts
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Repository } from '../../src/storage/repository';
import { buildSeed } from '../../src/fixtures/seed';
import { createApiServices } from '../../src/services/api';
import { useSessionStore } from '../../src/state/sessionStore';
import { appConfig } from '../../src/config/appConfig';
import type { Services } from '../../src/services/contracts';

declare const process: { env: Record<string, string | undefined> };
declare function btoa(data: string): string;
declare function atob(data: string): string;

const mockPdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n';
const mockWritten: Record<string, string> = {};

jest.mock('@dr.pogodin/react-native-fs', () => ({
  DocumentDirectoryPath: '/Documents',
  CachesDirectoryPath: '/Caches',
  readFile: jest.fn(async () => btoa(mockPdf)),
  writeFile: jest.fn(async (path: string, data: string) => { mockWritten[path] = data; }),
  mkdir: jest.fn(async () => undefined),
  exists: jest.fn(async () => true),
  unlink: jest.fn(async () => undefined),
}));

// The RN jest preset stubs XMLHttpRequest; the adapter falls back to fetch without it.
delete (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;

const live = process.env.LIVE === '1' ? describe : describe.skip;
jest.setTimeout(240_000);

function makeServices(): Services {
  appConfig.mode = 'api';
  const repo = new Repository({ store: AsyncStorage, seed: buildSeed, persistDelayMs: 0 });
  return createApiServices({ repo, store: AsyncStorage });
}

async function signIn(s: Services, loginId: string) {
  const { session, user } = await s.auth.login({ loginId, password: process.env.CO_PW ?? '', rememberMe: false });
  useSessionStore.getState().setSignedIn(session, user);
  return user;
}

live('live student flows', () => {
  it('assignments: upload, view and delete a draft file', async () => {
    const s = makeServices();
    const u = await signIn(s, 'ST-2024-001');
    try {
      const all = await s.assignments.listForStudent(u.id);
      console.log('assignments:', all.map(a => `${a.section.course.code} ${a.title} [${a.derivedStatus}${a.rules?.open ? '' : ',closed'}] files=${a.submission?.attachments.length ?? 0}`).join(' | '));
      const target = all.find(a => a.rules?.open && a.rules.fileSubmissions && (a.derivedStatus === 'upcoming' || a.derivedStatus === 'draft') && !a.submission?.attachments.length);
      expect(target).toBeDefined();
      const id = target!.id;
      const progress: number[] = [];
      const draft = await s.assignments.saveDraft({ assignmentId: id, studentId: u.id, attachments: [{ id: 'att_live_test', name: 'campusone-upload-check.pdf', size: mockPdf.length, mimeType: 'application/pdf', uri: 'file:///tmp/campusone-upload-check.pdf' }] });
      console.log('after upload:', draft.status, draft.attachments.map(f => `${f.name} ${f.size}B uri=${f.uri || '(server)'}`));
      expect(draft.attachments).toHaveLength(1);
      expect(draft.attachments[0].uri).toBe('');
      const path = await s.assignments.downloadAttachment!(draft.attachments[0]);
      expect(atob(mockWritten[path])).toBe(mockPdf);
      console.log('downloaded to', path);
      const afterDelete = await s.assignments.saveDraft({ assignmentId: id, studentId: u.id, attachments: [] });
      console.log('after delete:', afterDelete.attachments.length, 'files');
      expect(afterDelete.attachments).toHaveLength(0);
      const again = await s.assignments.get(id, u.id);
      expect(again.derivedStatus).toBe('upcoming');
      void progress;
      const closed = all.find(a => a.rules && !a.rules.open && a.derivedStatus === 'upcoming');
      if (closed) await expect(s.assignments.saveDraft({ assignmentId: closed.id, studentId: u.id, attachments: [] })).rejects.toThrow(/deadline/i);
    } finally {
      await s.auth.logout();
    }
  });

  it('workshops, evaluations and records (read-only)', async () => {
    const s = makeServices();
    const u = await signIn(s, 'ST-2024-001');
    try {
      const ws = await s.workshops.list(u.id);
      console.log('workshops:', ws.map(w => `${w.code} ${w.date}${w.endDate ? `→${w.endDate}` : ''} ${w.startTime} ${w.durationHours}h ${w.myEnrolment?.status ?? 'none'}`).join(' | '));
      expect(ws.length).toBeGreaterThan(0);
      const pending = await s.records.listPendingEvaluations!();
      console.log('pending evaluations:', pending.map(e => `${e.courseCode} ${e.status}`));
      if (pending[0]) {
        const ev = await s.records.getEvaluation!(pending[0].id);
        expect(ev.courseCode).toBe(pending[0].courseCode);
        // Invalid ratings are rejected by the API without recording anything.
        await expect(s.records.submitEvaluation!(pending[0].id, { overallRating: 0, teachingQuality: 0, courseMaterials: 0, workload: 0 })).rejects.toMatchObject({ code: 'VALIDATION' });
      }
      const practicum = await s.records.listPracticum!();
      console.log('practicum:', practicum.map(p => `${p.siteName} ${p.status} hours=${p.hours.length}`));
      await expect(s.records.logPracticumHours!({ placementId: practicum[0]?.id ?? 'x', weekLabel: '', hours: 4 })).rejects.toMatchObject({ code: 'VALIDATION' });
      const career = await s.records.getCareer!();
      console.log('career:', career.opportunities.length, 'opportunities,', career.services.length, 'services');
      const cal = await s.records.getCalendars!();
      console.log('calendars:', cal.academicBlocks.length, 'blocks,', cal.financialTerms.length, 'terms');
      const creds = await s.records.listCredentials!();
      console.log('credentials:', creds.credentials.map(c => `${c.title} ${c.status}`));
      const tx = await s.finance.listTransactions(u.id);
      console.log('transactions:', tx.map(t => `${t.description} ${t.amount}`).join(' | '));
    } finally {
      await s.auth.logout();
    }
  });

  it('instructor workshop details come from instructor data', async () => {
    const s = makeServices();
    const u = await signIn(s, 'vance.instructor@heritage.edu');
    try {
      const rows = await s.workshops.listEnrolmentsForInstructor();
      expect(rows.length).toBeGreaterThan(0);
      const w = await s.workshops.get(rows[0].workshopId, u.id);
      console.log('instructor workshop:', w.code, w.title, 'approved seats', w.registeredCount);
      expect(w.id).toBe(rows[0].workshopId);
    } finally {
      await s.auth.logout();
    }
  });
});
