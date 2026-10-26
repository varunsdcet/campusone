import type { CatalogueFilters, CatalogueService, CoachService, EnrolmentService, LearningService } from '../contracts/learning';
import type { Activity, Bookmark, Certificate, Chapter, CoachConversation, CoachMessage, Enrolment, LearningProgress, Programme, ProgrammeLevel, ReadingContent } from '../../domain/types';
import { ServiceError } from '../errors';
import { createCoachMock, createLearningMock } from '../mock/learningMock';
import type { Repository } from '../../storage/repository';
import type { KeyValueStore } from '../../storage/asyncStorage';
import type { ApiClient } from './client';
import { cached, nowIso } from './util';
import { appConfig } from '../../config/appConfig';

const webOrigin = () => {
  if (!appConfig.webOrigin) throw new ServiceError('NOT_CONFIGURED', 'webOrigin is not configured.');
  return appConfig.webOrigin.replace(/\/$/, '');
};
import { getCurriculum, installSelfpacedCurriculum, normalizeRemoteChapter, type RemoteSelfpacedChapter, type SelfpacedActivity, type SelfpacedChapter } from './curriculum/selfpacedCurriculum';

interface ProgramDto {
  id: string;
  slug: string;
  title: string;
  subject: string;
  level: string;
  blurb?: string;
  description: string;
  hours: number;
  chapters: number;
  priceCad: number;
  internationalCad?: number;
  features?: string[];
  curriculum?: RemoteSelfpacedChapter[];
}

/* ------------------------- curriculum mapping ------------------------- */

const decode = (s: string) =>
  s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const text = (html: string) => decode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t]+/g, ' ').trim();
const items = (html: string) => [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(m => text(m[1])).filter(Boolean);
const paragraphs = (html: string) => text(html.replace(/<(ul|ol)[^>]*>[\s\S]*?<\/\1>/gi, '')).replace(/\n{2,}/g, '\n');

function readingFromHtml(html: string): ReadingContent {
  const parts = html.split(/<h2[^>]*>/i);
  const intro = paragraphs(parts[0] ?? '');
  const sections = parts.slice(1).map(p => {
    const [head, body = ''] = p.split(/<\/h2>/i);
    return { heading: text(head), body };
  });
  const find = (re: RegExp) => sections.find(s => re.test(s.heading));
  const objectivesSec = find(/objective|checklist/i) ?? sections.find(s => items(s.body).length);
  const whySec = find(/why|quality/i);
  const coreSec = find(/core|concept/i);
  const exampleSec = find(/example|try it/i);
  const used = new Set([objectivesSec, whySec, coreSec, exampleSec]);
  const coreItems = coreSec ? items(coreSec.body) : [];
  const steps = coreItems.length
    ? coreItems.map((body, i) => ({ title: `Step ${i + 1}`, body }))
    : sections.filter(s => !used.has(s)).map(s => ({ title: s.heading, body: [paragraphs(s.body), ...items(s.body).map(i => `• ${i}`)].filter(Boolean).join('\n') }));
  return {
    intro,
    objectives: objectivesSec ? items(objectivesSec.body) : [],
    whyItMatters: whySec ? [paragraphs(whySec.body), ...items(whySec.body).map(i => `• ${i}`)].filter(Boolean).join('\n') : '',
    coreConcepts: coreSec ? paragraphs(coreSec.body) : sections.filter(s => !used.has(s)).length ? '' : intro,
    steps: coreItems.length ? [...steps, ...sections.filter(s => !used.has(s)).map(s => ({ title: s.heading, body: [paragraphs(s.body), ...items(s.body).map(i => `• ${i}`)].filter(Boolean).join('\n') }))] : steps,
    workedExample: exampleSec ? paragraphs(exampleSec.body) : '',
  };
}

function mapActivity(a: SelfpacedActivity, chapterId: string, index: number): Activity {
  const base = { id: a.id, chapterId, index, title: a.title, minutes: a.minutes };
  const questions = (qs: NonNullable<SelfpacedActivity['questions']>) => qs.map(q => ({ id: q.id, prompt: q.prompt, options: q.options, correctIndex: q.correct, explanation: '' }));
  switch (a.type) {
    case 'reading':
      return { ...base, type: 'reading', reading: readingFromHtml(a.html ?? '') };
    case 'evaluation':
      return {
        ...base,
        type: 'reading',
        reading: {
          intro: 'Review how your work in this programme is evaluated before you sit the final exam.',
          objectives: (a.evaluationRows ?? []).map(r => `${r.component} — ${r.weight}`),
          whyItMatters: 'Knowing the weighting helps you decide where to focus your final review.',
          coreConcepts: '',
          steps: [],
          workedExample: '',
        },
      };
    case 'lecture':
      return {
        ...base,
        type: 'lecture',
        lecture: { presenter: 'Heritage instructor', slides: (a.storyboard?.slides ?? []).map(s => ({ title: s.heading, bullets: s.bullets, transcript: s.narration })) },
      };
    case 'quiz':
      return { ...base, type: 'practiceQuiz', quiz: { questions: questions(a.questions ?? []) } };
    case 'matching':
      return { ...base, type: 'matching', matching: { pairs: (a.pairs ?? []).map(p => ({ id: p.id, term: p.left, definition: p.right })) } };
    case 'assessment':
    default: {
      const bank = a.questionBank ?? a.questions ?? [];
      return { ...base, type: 'assessment', quiz: { questions: questions(bank.slice(0, a.questionCount ?? bank.length)) } };
    }
  }
}

function mapChapters(programmeId: string, chapters: SelfpacedChapter[]): Chapter[] {
  return chapters.map((c, i) => ({
    id: c.id,
    programmeId,
    index: i + 1,
    title: c.title,
    description: c.summary,
    hours: c.hours,
    activities: c.activities.map((a, ai) => mapActivity(a, c.id, ai + 1)),
  }));
}

function mapProgramme(p: ProgramDto, index: number): Programme {
  const chapters = mapChapters(p.slug, getCurriculum(p.slug));
  const subject = p.subject || 'General';
  const lower = `${p.title} ${subject}`.toLowerCase();
  const level: ProgrammeLevel = (['Beginner', 'Intermediate', 'Advanced'] as const).find(l => l.toLowerCase() === p.level?.toLowerCase()) ?? 'Intermediate';
  return {
    id: p.slug,
    title: p.title,
    subject,
    category: /red seal/.test(lower) ? 'Red Seal Exam Prep' : subject,
    level,
    description: p.description || p.blurb || '',
    hours: p.hours,
    chapterCount: chapters.length || p.chapters,
    activityCount: chapters.reduce((n, c) => n + c.activities.length, 0),
    priceCad: p.priceCad,
    residency: 'domestic',
    featured: index === 0,
    heroImage: /pharm/.test(lower) ? 'pharmacy' : /business|office|capstone/.test(lower) ? 'office' : 'trades',
    highlights: p.features?.length
      ? p.features.map(f => (/^\d+\s+chapters?$/i.test(f.trim()) ? `${chapters.length || p.chapters} chapters` : f))
      : [`${chapters.length || p.chapters} chapters`, `${p.hours} hours`],
    chapters,
  };
}

/* ------------------------------ services ------------------------------ */

export function createLearningApi(api: ApiClient, baseRepo: Repository, sessionStore: KeyValueStore) {
  const programmes = new Map<string, Programme>();

  const catalogue = cached(5 * 60_000, async () => {
    const d = await api.get<{ items: ProgramDto[] }>('/selfpaced/programs');
    for (const item of d.items) {
      if (item.curriculum?.length) installSelfpacedCurriculum(item.slug, item.curriculum.map(normalizeRemoteChapter));
    }
    const list = d.items.map(mapProgramme);
    programmes.clear();
    list.forEach(p => programmes.set(p.id, p));
    return list;
  });

  /** Programmes stay in memory (large); progress, enrolments and certificates persist in the repository. */
  const repo = new Proxy(baseRepo, {
    get(target, prop, receiver) {
      if (prop === 'find') {
        return (name: string, id: string) => (name === 'programmes' ? programmes.get(id) : (target.find as (n: string, i: string) => unknown)(name, id));
      }
      if (prop === 'table') {
        return (name: string) => (name === 'programmes' ? [...programmes.values()] : (target.table as (n: string) => unknown)(name));
      }
      const v = Reflect.get(target, prop, receiver);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  }) as Repository;

  const ctx = { repo, sessionStore };
  const localLearning = createLearningMock(ctx);
  const localCoach = createCoachMock(ctx);

  type LearningStateDto = {
    bookmarks: Bookmark[];
    progress: LearningProgress[];
    coachConversations: CoachConversation[];
    certificates: Certificate[];
  };

  async function hydrateLearningState(userId: string) {
    await baseRepo.hydrate();
    const state = await api.get<LearningStateDto>('/selfpaced/state');
    baseRepo.mutate(db => {
      db.bookmarks = [...db.bookmarks.filter(item => item.userId !== userId), ...state.bookmarks];
      db.progress = [...db.progress.filter(item => item.userId !== userId), ...state.progress];
      db.coachConversations = [...db.coachConversations.filter(item => item.userId !== userId), ...state.coachConversations];
      db.certificates = [...db.certificates.filter(item => item.studentId !== userId), ...state.certificates];
    });
  }

  async function persistLearningState(userId: string) {
    await api.put('/selfpaced/state', {
      bookmarks: baseRepo.table('bookmarks').filter(item => item.userId === userId),
      progress: baseRepo.table('progress').filter(item => item.userId === userId),
      coachConversations: baseRepo.table('coachConversations').filter(item => item.userId === userId),
      certificates: baseRepo.table('certificates').filter(item => item.studentId === userId),
    });
  }

  async function syncEnrolments(userId: string): Promise<Enrolment[]> {
    await catalogue();
    const d = await api.get<{ items: { slug: string; enrolledAt: string; method: string; paymentReference?: string }[] }>('/selfpaced/enrolments');
    const out: Enrolment[] = [];
    await baseRepo.hydrate();
    for (const e of d.items) {
      if (!programmes.has(e.slug)) continue;
      const id = `${userId}:${e.slug}`;
      const local = baseRepo.find('enrolments', id);
      const enrolment: Enrolment = {
        id,
        userId,
        programmeId: e.slug,
        enrolledAt: e.enrolledAt,
        paymentId: e.paymentReference ?? e.method,
        status: local?.status === 'completed' ? 'completed' : 'active',
      };
      if (!local || local.enrolledAt !== enrolment.enrolledAt) baseRepo.upsert('enrolments', enrolment);
      out.push(enrolment);
    }
    return out;
  }
  const enrolmentsOnce = new Map<string, Promise<Enrolment[]>>();
  const ensure = (userId: string) => {
    if (!enrolmentsOnce.has(userId)) {
      const p = hydrateLearningState(userId).then(() => syncEnrolments(userId));
      enrolmentsOnce.set(userId, p);
      p.catch(() => enrolmentsOnce.delete(userId));
    }
    return enrolmentsOnce.get(userId)!;
  };

  const catalogueService: CatalogueService = {
    async listProgrammes(filters: CatalogueFilters = {}) {
      const q = filters.query?.trim().toLowerCase();
      return (await catalogue()).filter(p => {
        if (q && !`${p.title} ${p.description} ${p.subject}`.toLowerCase().includes(q)) return false;
        if (filters.subject && filters.subject !== 'All subjects' && p.subject !== filters.subject) return false;
        if (filters.level && filters.level !== 'All levels' && p.level !== filters.level) return false;
        if (filters.category && filters.category !== 'All Programs' && p.category !== filters.category && p.subject !== filters.category) return false;
        return true;
      });
    },
    async getProgramme(id) {
      await catalogue();
      const p = programmes.get(id);
      if (!p) throw new ServiceError('NOT_FOUND', 'Programme not found');
      return p;
    },
    async listBookmarks(userId) {
      await ensure(userId);
      return baseRepo.table('bookmarks').filter(b => b.userId === userId);
    },
    async toggleBookmark(userId, programmeId) {
      await ensure(userId);
      const id = `${userId}:${programmeId}`;
      if (baseRepo.find('bookmarks', id)) {
        baseRepo.remove('bookmarks', id);
        await persistLearningState(userId);
        return { bookmarked: false };
      }
      baseRepo.upsert('bookmarks', { id, userId, programmeId, createdAt: nowIso() });
      await persistLearningState(userId);
      return { bookmarked: true };
    },
  };

  const enrolment: EnrolmentService = {
    async listEnrolments(userId) {
      enrolmentsOnce.delete(userId);
      return ensure(userId);
    },
    async getEnrolment(userId, programmeId) {
      return (await ensure(userId)).find(e => e.programmeId === programmeId) ?? null;
    },
    async checkout({ userId, programmeId, outcome }) {
      const programme = await catalogueService.getProgramme(programmeId);
      if ((await ensure(userId)).some(e => e.programmeId === programmeId)) throw new ServiceError('CONFLICT', 'You are already enrolled in this programme.');
      if (outcome === 'cancel') throw new ServiceError('CANCELLED', 'Checkout cancelled. No money was charged.');
      if (programme.priceCad > 0) {
        throw new ServiceError('VALIDATION', `${programme.title} is a paid programme. Continue to secure card payment.`, { retryable: false });
      }
      await api.post('/selfpaced/enrolments/free', { slug: programmeId });
      enrolmentsOnce.delete(userId);
      const list = await ensure(userId);
      const e = list.find(x => x.programmeId === programmeId);
      if (!e) throw new ServiceError('SERVER', 'Enrolment was not confirmed. Pull to refresh and try again.');
      return { payment: { id: `free:${programmeId}`, userId, programmeId, amountCad: 0, status: 'succeeded', createdAt: e.enrolledAt, reference: 'FREE' }, enrolment: e };
    },
    async startCardCheckout({ userId, programmeId }) {
      const programme = await catalogueService.getProgramme(programmeId);
      if ((await ensure(userId)).some(e => e.programmeId === programmeId)) throw new ServiceError('CONFLICT', 'You are already enrolled in this programme.');
      const origin = webOrigin();
      const res = await api.request<{ url?: string; mode?: string }>('POST', `${origin}/api/selfpaced/checkout`, { slug: programme.id }, { auth: false });
      if (res.mode !== 'stripe_hosted' || !res.url) throw new ServiceError('SERVER', 'Card payment is not available right now. Please try again later.');
      return { url: res.url, successUrl: `${origin}/selfpaced/success`, cancelUrl: `${origin}/selfpaced/programs/${programme.id}` };
    },
    async completeCardCheckout({ userId, programmeId, sessionId }) {
      const programme = await catalogueService.getProgramme(programmeId);
      const accountId = api.accountId;
      if (!accountId) throw new ServiceError('UNAUTHENTICATED', 'Sign in again to finish your enrolment.');
      const proof = await api.request<{ verified: boolean; error?: string; sessionId: string; timestamp: number; proof: string }>('POST', `${webOrigin()}/api/selfpaced/checkout/verify`, { sessionId, slug: programme.id, accountId }, { auth: false });
      if (!proof.verified) throw new ServiceError('SERVER', proof.error ?? 'We could not verify this payment.');
      await api.post('/selfpaced/enrolments/paid', { slug: programme.id, sessionId: proof.sessionId, accountId, timestamp: proof.timestamp, proof: proof.proof });
      enrolmentsOnce.delete(userId);
      const e = (await ensure(userId)).find(x => x.programmeId === programmeId);
      if (!e) throw new ServiceError('SERVER', 'Payment received, but the enrolment was not confirmed yet. Pull to refresh in a moment.');
      return { payment: { id: proof.sessionId, userId, programmeId, amountCad: programme.priceCad, status: 'succeeded', createdAt: e.enrolledAt, reference: proof.sessionId.slice(-10).toUpperCase() }, enrolment: e };
    },
    async listPayments(userId) {
      return (await ensure(userId)).map(e => ({ id: e.paymentId, userId, programmeId: e.programmeId, amountCad: programmes.get(e.programmeId)?.priceCad ?? 0, status: 'succeeded' as const, createdAt: e.enrolledAt, reference: e.paymentId.toUpperCase() }));
    },
  };

  const withData = <A extends unknown[], R>(fn: (userId: string, ...rest: A) => Promise<R>) => async (userId: string, ...rest: A): Promise<R> => {
    await baseRepo.hydrate();
    await ensure(userId);
    return fn(userId, ...rest);
  };
  const withPersistedData = <A extends unknown[], R>(fn: (userId: string, ...rest: A) => Promise<R>) => withData(async (userId: string, ...rest: A) => {
    const result = await fn(userId, ...rest);
    await persistLearningState(userId);
    return result;
  });

  const learning: LearningService = {
    getSnapshot: withPersistedData(localLearning.getSnapshot),
    recordTime: withPersistedData(localLearning.recordTime),
    markReadToBottom: withPersistedData(localLearning.markReadToBottom),
    completeActivity: withPersistedData(localLearning.completeActivity),
    saveQuizAnswer: withPersistedData(localLearning.saveQuizAnswer),
    submitQuiz: withPersistedData(localLearning.submitQuiz),
    resetQuiz: withPersistedData(localLearning.resetQuiz),
    saveMatching: withPersistedData(localLearning.saveMatching),
    submitMatching: withPersistedData(localLearning.submitMatching),
    getCertificate: withData(localLearning.getCertificate),
    issueDemoCertificate: withData(async (userId: string, programmeId: string) => {
      const snap = await localLearning.getSnapshot(userId, programmeId);
      if (!snap.completedAll) throw new ServiceError('VALIDATION', 'Complete every activity and pass each chapter assessment first.');
      const existing = baseRepo.table('certificates').find(c => c.studentId === userId && c.programmeId === programmeId);
      if (existing) return existing;
      const r = await api.post<{ certificateId: string; issuedAt: string }>('/selfpaced/certificates', { slug: programmeId, completedActivityIds: snap.progress.completedActivityIds, assessmentsPassed: true });
      const cert: Certificate = { id: r.certificateId, studentId: userId, programmeId, issuedAt: r.issuedAt, credentialId: r.certificateId.slice(0, 8).toUpperCase() };
      baseRepo.mutate(db => {
        db.certificates.push(cert);
        const p = db.progress.find(x => x.id === `${userId}:${programmeId}`);
        if (p) p.certificateId = cert.id;
      });
      await persistLearningState(userId);
      return cert;
    }),
    async devJumpTo() {
      throw new ServiceError('PERMISSION_DENIED', 'Developer shortcuts are disabled for live accounts.');
    },
  };

  const convo = (userId: string, chapterId: string) => baseRepo.table('coachConversations').find(c => c.id === `${userId}:${chapterId}`);

  const coach: CoachService = {
    getConversation: withPersistedData(localCoach.getConversation),
    async ask({ userId, programmeId, chapterId, activityId, prompt }) {
      await baseRepo.hydrate();
      await ensure(userId);
      await localCoach.getConversation(userId, programmeId, chapterId);
      const programme = programmes.get(programmeId);
      const chapter = programme?.chapters.find(c => c.id === chapterId);
      const userMsg: CoachMessage = { id: `cm-${Date.now()}`, role: 'user', text: prompt, createdAt: nowIso(), contextActivityId: activityId };
      baseRepo.mutate(() => convo(userId, chapterId)!.messages.push(userMsg));
      try {
        const question = `${prompt.trim()}\n\n(Context: ${programme?.title ?? programmeId} · ${chapter?.title ?? chapterId})`;
        const r = await api.post<{ answer: string; createdAt: string }>(
          '/ai/ask',
          { question: question.slice(0, 2000), contextPath: `/student/learn/${programmeId}`, capability: 'study_coach' },
          { 'Idempotency-Key': `coach-${userMsg.id}-${Math.random().toString(36).slice(2, 8)}` },
        );
        const reply: CoachMessage = { id: `cm-${Date.now()}-r`, role: 'coach', text: r.answer, createdAt: r.createdAt ?? nowIso(), status: 'sent', contextActivityId: activityId };
        baseRepo.mutate(() => convo(userId, chapterId)!.messages.push(reply));
        await persistLearningState(userId);
        return reply;
      } catch (e) {
        baseRepo.mutate(() => {
          const m = convo(userId, chapterId)?.messages.find(x => x.id === userMsg.id);
          if (m) m.status = 'error';
        });
        await persistLearningState(userId).catch(() => undefined);
        throw e;
      }
    },
    clear: withPersistedData(localCoach.clear),
  };

  return { catalogue: catalogueService, enrolment, learning, coach, invalidate: () => { catalogue.invalidate(); enrolmentsOnce.clear(); } };
}
