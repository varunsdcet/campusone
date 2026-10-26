import type { CatalogueService, EnrolmentService, LearningService, CoachService, ProgressSnapshot, ActivityGateState, CatalogueFilters } from '../contracts/learning';
import type { Programme, LearningProgress, Activity, CoachMessage, CoachConversation, Certificate } from '../../domain/types';
import { ServiceError } from '../errors';
import { simulate, demoEmpty } from './simulate';
import { MockContext } from './context';
import { newId } from '../../utils/ids';
import { clock, DAY_MS } from '../../utils/clock';
import { progressionPolicy } from '../../config/progressionPolicy';

export function createCatalogueMock(ctx: MockContext): CatalogueService {
  const { repo } = ctx;
  return {
    async listProgrammes(filters: CatalogueFilters = {}) {
      await simulate('catalogue.listProgrammes');
      const q = filters.query?.trim().toLowerCase();
      const items = repo.table('programmes').filter(p => {
        if (q && !(p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.subject.toLowerCase().includes(q))) return false;
        if (filters.subject && filters.subject !== 'All subjects' && p.subject !== filters.subject) return false;
        if (filters.level && filters.level !== 'All levels' && p.level !== filters.level) return false;
        if (filters.category && filters.category !== 'All Programs' && p.category !== filters.category && p.subject !== filters.category) return false;
        return true;
      });
      return demoEmpty('catalogue.listProgrammes', items, []);
    },
    async getProgramme(id) {
      await simulate('catalogue.getProgramme');
      const p = repo.find('programmes', id);
      if (!p) throw new ServiceError('NOT_FOUND', 'Programme not found');
      return p;
    },
    async listBookmarks(userId) {
      return repo.table('bookmarks').filter(b => b.userId === userId);
    },
    async toggleBookmark(userId, programmeId) {
      await simulate('catalogue.toggleBookmark');
      const id = `${userId}:${programmeId}`;
      const existing = repo.find('bookmarks', id);
      if (existing) {
        repo.remove('bookmarks', id);
        return { bookmarked: false };
      }
      repo.upsert('bookmarks', { id, userId, programmeId, createdAt: new Date(clock.now()).toISOString() });
      return { bookmarked: true };
    },
  };
}

export function createEnrolmentMock(ctx: MockContext): EnrolmentService {
  const { repo } = ctx;
  return {
    async listEnrolments(userId) {
      await simulate('enrolment.list');
      return repo.table('enrolments').filter(e => e.userId === userId);
    },
    async getEnrolment(userId, programmeId) {
      return repo.table('enrolments').find(e => e.userId === userId && e.programmeId === programmeId) ?? null;
    },
    async checkout({ userId, programmeId, outcome }) {
      await simulate('enrolment.checkout');
      const programme = repo.find('programmes', programmeId);
      if (!programme) throw new ServiceError('NOT_FOUND', 'Programme not found');
      const existing = repo.table('enrolments').find(e => e.userId === userId && e.programmeId === programmeId);
      if (existing) throw new ServiceError('CONFLICT', 'You are already enrolled in this programme. Duplicate purchases are blocked.');
      const nowIso = new Date(clock.now()).toISOString();
      const payment = {
        id: newId('pay'), userId, programmeId, amountCad: programme.priceCad,
        status: outcome === 'success' ? 'succeeded' as const : outcome === 'cancel' ? 'cancelled' as const : 'failed' as const,
        createdAt: nowIso, reference: `DEMO-CHK-${Math.floor(clock.now() / 1000).toString(36).toUpperCase()}`,
      };
      repo.mutate(db => db.payments.push(payment));
      if (outcome !== 'success') {
        if (outcome === 'fail') throw new ServiceError('SERVER', 'Demo payment declined (simulated). No money was charged.', { retryable: true });
        throw new ServiceError('CANCELLED', 'Checkout cancelled. No money was charged.');
      }
      const enrolment = { id: newId('enr'), userId, programmeId, enrolledAt: nowIso, paymentId: payment.id, status: 'active' as const };
      repo.mutate(db => {
        db.enrolments.push(enrolment);
        db.transactions.push({ id: newId('tx'), studentId: userId, termId: 't_2026F', date: nowIso.slice(0, 10), description: `Demo enrolment · ${programme.title}`, amount: -programme.priceCad, kind: 'demo-payment', reference: payment.reference });
        db.transactions.push({ id: newId('tx'), studentId: userId, termId: 't_2026F', date: nowIso.slice(0, 10), description: `Demo payment · ${programme.title}`, amount: programme.priceCad, kind: 'demo-payment', reference: payment.reference });
        db.notifications.unshift({ id: newId('n'), userId, title: 'Enrolment confirmed (demo)', body: `You are enrolled in ${programme.title}. Chapter 1 is open now.`, category: 'Enrolment', createdAt: nowIso, read: false, icon: 'info', link: { route: 'StudentOutline', params: { programmeId } } });
      });
      return { payment, enrolment };
    },
    async listPayments(userId) {
      return repo.table('payments').filter(p => p.userId === userId);
    },
  };
}

/* ---------------- Learning progression ---------------- */

function allActivities(p: Programme): Activity[] {
  return p.chapters.flatMap(c => c.activities);
}

function ensureProgress(ctx: MockContext, userId: string, programmeId: string): LearningProgress {
  const id = `${userId}:${programmeId}`;
  let pr = ctx.repo.find('progress', id);
  if (!pr) {
    pr = { id, userId, programmeId, completedActivityIds: [], secondsSpent: {}, readToBottom: {}, quizAnswers: {}, quizBestScore: {}, matchingAssignments: {}, matchingResult: {}, assessmentResults: {} };
    ctx.repo.mutate(db => db.progress.push(pr!));
  }
  return pr;
}

export function computeSnapshot(programme: Programme, progress: LearningProgress, enrolledAt: string, now: number): ProgressSnapshot {
  const completed = new Set(progress.completedActivityIds);
  const gates: Record<string, ActivityGateState> = {};
  const enrolledMs = new Date(enrolledAt).getTime();
  let chapterUnlockedCount = 0;
  let chaptersPassed = 0;
  let nextActivityId: string | undefined;
  let previousChapterPassed = true;
  let firstIncompleteFound = false;
  programme.chapters.forEach((chapter, ci) => {
    const releaseAt = enrolledMs + ci * (DAY_MS / progressionPolicy.chapterReleasePerDay);
    const timeReleased = now >= releaseAt;
    const chapterReleased = timeReleased && (!progressionPolicy.requireAssessmentPassToUnlockNextChapter || previousChapterPassed);
    if (chapterReleased) chapterUnlockedCount += 1;
    let prevDone = true;
    chapter.activities.forEach(a => {
      const isDone = completed.has(a.id);
      const unlocked = chapterReleased && prevDone;
      const current = unlocked && !isDone && !firstIncompleteFound;
      if (current) {
        firstIncompleteFound = true;
        nextActivityId = a.id;
      }
      gates[a.id] = {
        activityId: a.id,
        unlocked,
        completed: isDone,
        current,
        chapterReleased,
        releasesAt: timeReleased ? undefined : new Date(releaseAt).toISOString(),
        reason: !timeReleased ? 'Opens ' + new Date(releaseAt).toDateString() : !previousChapterPassed ? 'Pass the previous chapter assessment' : !prevDone ? 'Complete the previous activity' : undefined,
      };
      prevDone = prevDone && isDone;
    });
    const assessment = chapter.activities.find(a => a.type === 'assessment');
    const passed = assessment ? !!progress.assessmentResults[assessment.id]?.passed : prevDone;
    if (passed) chaptersPassed += 1;
    previousChapterPassed = passed;
  });
  const total = allActivities(programme).length;
  const completedCount = progress.completedActivityIds.filter(id => gates[id]).length;
  return {
    progress,
    gates,
    chapterUnlockedCount,
    completedCount,
    totalCount: total,
    percent: total ? Math.round((completedCount / total) * 100) : 0,
    nextActivityId,
    completedAll: completedCount >= total && total > 0,
    chaptersPassed,
  };
}

export function createLearningMock(ctx: MockContext): LearningService {
  const { repo } = ctx;
  const getProgramme = (id: string) => {
    const p = repo.find('programmes', id);
    if (!p) throw new ServiceError('NOT_FOUND', 'Programme not found');
    return p;
  };
  const snapshot = (userId: string, programmeId: string): ProgressSnapshot => {
    const programme = getProgramme(programmeId);
    const enrolment = repo.table('enrolments').find(e => e.userId === userId && e.programmeId === programmeId);
    if (!enrolment) throw new ServiceError('PERMISSION_DENIED', 'You are not enrolled in this programme.');
    const progress = ensureProgress(ctx, userId, programmeId);
    return computeSnapshot(programme, progress, enrolment.enrolledAt, clock.now());
  };
  const update = (userId: string, programmeId: string, fn: (p: LearningProgress) => void) => {
    repo.mutate(db => {
      const p = db.progress.find(x => x.id === `${userId}:${programmeId}`)!;
      fn(p);
    });
  };
  const findActivity = (programmeId: string, activityId: string) => {
    const a = allActivities(getProgramme(programmeId)).find(x => x.id === activityId);
    if (!a) throw new ServiceError('NOT_FOUND', 'Activity not found');
    return a;
  };

  return {
    async getSnapshot(userId, programmeId) {
      await simulate('learning.getSnapshot');
      return snapshot(userId, programmeId);
    },
    async recordTime(userId, programmeId, activityId, seconds) {
      ensureProgress(ctx, userId, programmeId);
      update(userId, programmeId, p => {
        p.secondsSpent[activityId] = (p.secondsSpent[activityId] ?? 0) + seconds;
        p.lastActivityId = activityId;
      });
    },
    async markReadToBottom(userId, programmeId, activityId) {
      ensureProgress(ctx, userId, programmeId);
      update(userId, programmeId, p => {
        p.readToBottom[activityId] = true;
      });
    },
    async completeActivity(userId, programmeId, activityId) {
      await simulate('learning.completeActivity');
      const snap = snapshot(userId, programmeId);
      const gate = snap.gates[activityId];
      if (!gate?.unlocked) throw new ServiceError('PERMISSION_DENIED', gate?.reason ?? 'This activity is locked.');
      const activity = findActivity(programmeId, activityId);
      const spent = snap.progress.secondsSpent[activityId] ?? 0;
      const need = progressionPolicy.activityGateSeconds[activity.type];
      if (spent < need) throw new ServiceError('VALIDATION', `Pacing requirement not met. ${Math.ceil(need - spent)}s remaining.`);
      if (activity.type === 'reading' && progressionPolicy.requireReadToBottom && !snap.progress.readToBottom[activityId]) {
        throw new ServiceError('VALIDATION', 'Read to the bottom to satisfy completion requirements.');
      }
      if (activity.type === 'matching' && !snap.progress.matchingResult[activityId]?.passed) throw new ServiceError('VALIDATION', 'Pass the matching drill first.');
      if (activity.type === 'assessment' && !snap.progress.assessmentResults[activityId]?.passed) throw new ServiceError('VALIDATION', 'Pass the chapter assessment first.');
      if (activity.type === 'practiceQuiz' && snap.progress.quizBestScore[activityId] === undefined) throw new ServiceError('VALIDATION', 'Submit the practice quiz first.');
      update(userId, programmeId, p => {
        if (!p.completedActivityIds.includes(activityId)) p.completedActivityIds.push(activityId);
      });
      const after = snapshot(userId, programmeId);
      if (after.completedAll && !after.progress.completedAt) {
        update(userId, programmeId, p => {
          p.completedAt = new Date(clock.now()).toISOString();
        });
        repo.mutate(db => {
          const e = db.enrolments.find(x => x.userId === userId && x.programmeId === programmeId);
          if (e) e.status = 'completed';
        });
      }
      return snapshot(userId, programmeId);
    },
    async saveQuizAnswer(userId, programmeId, activityId, questionId, optionIndex) {
      ensureProgress(ctx, userId, programmeId);
      update(userId, programmeId, p => {
        p.quizAnswers[activityId] = { ...(p.quizAnswers[activityId] ?? {}), [questionId]: optionIndex };
      });
    },
    async submitQuiz(userId, programmeId, activityId, kind) {
      await simulate('learning.submitQuiz');
      const activity = findActivity(programmeId, activityId);
      const questions = activity.quiz?.questions ?? [];
      const p = ensureProgress(ctx, userId, programmeId);
      const answers = p.quizAnswers[activityId] ?? {};
      if (questions.some(q => answers[q.id] === undefined)) throw new ServiceError('VALIDATION', 'Answer every question before submitting.');
      const correct = questions.filter(q => answers[q.id] === q.correctIndex).length;
      const score = Math.round((correct / questions.length) * 100);
      const passed = kind === 'assessment' ? score >= progressionPolicy.passMark.assessment : true;
      update(userId, programmeId, pr => {
        if (kind === 'practiceQuiz') pr.quizBestScore[activityId] = Math.max(pr.quizBestScore[activityId] ?? 0, score);
        else {
          const prev = pr.assessmentResults[activityId];
          pr.assessmentResults[activityId] = { score: Math.max(prev?.score ?? 0, score), passed: (prev?.passed ?? false) || passed, submittedAt: new Date(clock.now()).toISOString(), attempts: (prev?.attempts ?? 0) + 1 };
        }
      });
      return { score, passed, correct, total: questions.length };
    },
    async resetQuiz(userId, programmeId, activityId) {
      ensureProgress(ctx, userId, programmeId);
      update(userId, programmeId, p => {
        delete p.quizAnswers[activityId];
      });
    },
    async saveMatching(userId, programmeId, activityId, pairId, definitionPairId) {
      ensureProgress(ctx, userId, programmeId);
      update(userId, programmeId, p => {
        const map = { ...(p.matchingAssignments[activityId] ?? {}) };
        // A definition can only be assigned to one term: reassigning moves it.
        if (definitionPairId) {
          for (const k of Object.keys(map)) if (map[k] === definitionPairId && k !== pairId) delete map[k];
          map[pairId] = definitionPairId;
        } else delete map[pairId];
        p.matchingAssignments[activityId] = map;
      });
    },
    async submitMatching(userId, programmeId, activityId) {
      await simulate('learning.submitMatching');
      const activity = findActivity(programmeId, activityId);
      const pairs = activity.matching?.pairs ?? [];
      const p = ensureProgress(ctx, userId, programmeId);
      const map = p.matchingAssignments[activityId] ?? {};
      if (pairs.some(pr => !map[pr.id])) throw new ServiceError('VALIDATION', `Complete all ${pairs.length} matches to verify and submit the drill.`);
      const wrong = pairs.filter(pr => map[pr.id] !== pr.id).map(pr => pr.id);
      const correct = pairs.length - wrong.length;
      const score = Math.round((correct / pairs.length) * 100);
      const passed = score >= progressionPolicy.passMark.matching;
      update(userId, programmeId, pr => {
        pr.matchingResult[activityId] = { score, passed, submittedAt: new Date(clock.now()).toISOString() };
      });
      return { score, passed, correct, total: pairs.length, wrongPairIds: wrong };
    },
    async getCertificate(userId, programmeId) {
      return repo.table('certificates').find(c => c.studentId === userId && c.programmeId === programmeId) ?? null;
    },
    async issueDemoCertificate(userId, programmeId) {
      await simulate('learning.issueDemoCertificate');
      const snap = snapshot(userId, programmeId);
      if (!snap.completedAll) throw new ServiceError('VALIDATION', 'Complete every activity and pass each chapter assessment first.');
      const existing = repo.table('certificates').find(c => c.studentId === userId && c.programmeId === programmeId);
      if (existing) return existing;
      const cert: Certificate = { id: newId('cert'), studentId: userId, programmeId, issuedAt: new Date(clock.now()).toISOString(), credentialId: `DEMO-${programmeId.slice(-6).toUpperCase()}-${Math.floor(clock.now() / 1000) % 100000}` };
      repo.mutate(db => {
        db.certificates.push(cert);
        const p = db.progress.find(x => x.id === `${userId}:${programmeId}`);
        if (p) p.certificateId = cert.id;
      });
      return cert;
    },
    async devJumpTo(userId, programmeId, activityId) {
      const programme = getProgramme(programmeId);
      const acts = allActivities(programme);
      const idx = acts.findIndex(a => a.id === activityId);
      if (idx < 0) throw new ServiceError('NOT_FOUND', 'Activity not found');
      ensureProgress(ctx, userId, programmeId);
      // Move enrolment date back far enough that every chapter is time-released.
      repo.mutate(db => {
        const e = db.enrolments.find(x => x.userId === userId && x.programmeId === programmeId);
        if (e) e.enrolledAt = new Date(clock.now() - programme.chapters.length * DAY_MS).toISOString();
      });
      update(userId, programmeId, p => {
        p.completedActivityIds = acts.slice(0, idx).map(a => a.id);
        acts.slice(0, idx).forEach(a => {
          p.secondsSpent[a.id] = 9999;
          p.readToBottom[a.id] = true;
          if (a.type === 'assessment') p.assessmentResults[a.id] = { score: 100, passed: true, submittedAt: new Date(clock.now()).toISOString(), attempts: 1 };
          if (a.type === 'matching') p.matchingResult[a.id] = { score: 100, passed: true, submittedAt: new Date(clock.now()).toISOString() };
          if (a.type === 'practiceQuiz') p.quizBestScore[a.id] = 100;
        });
        acts.slice(idx).forEach(a => {
          // Everything from the target onwards starts as a clean attempt (re-runnable dev jump).
          delete p.assessmentResults[a.id];
          delete p.matchingResult[a.id];
          delete p.quizAnswers[a.id];
          delete p.matchingAssignments[a.id];
          delete p.quizBestScore[a.id];
          delete p.secondsSpent[a.id];
          delete p.readToBottom[a.id];
          p.completedActivityIds = p.completedActivityIds.filter(id => id !== a.id);
        });
        p.lastActivityId = activityId;
        delete p.completedAt;
      });
      return snapshot(userId, programmeId);
    },
  };
}

/* ---------------- Ask Coach (deterministic demo responses) ---------------- */

export function createCoachMock(ctx: MockContext): CoachService {
  const { repo } = ctx;
  const convoId = (userId: string, chapterId: string) => `${userId}:${chapterId}`;
  const ensure = (userId: string, programmeId: string, chapterId: string): CoachConversation => {
    let c = repo.find('coachConversations', convoId(userId, chapterId));
    if (!c) {
      c = { id: convoId(userId, chapterId), userId, programmeId, chapterId, messages: [] };
      repo.mutate(db => db.coachConversations.push(c!));
    }
    return c;
  };
  return {
    async getConversation(userId, programmeId, chapterId) {
      return ensure(userId, programmeId, chapterId);
    },
    async ask({ userId, programmeId, chapterId, activityId, prompt }) {
      ensure(userId, programmeId, chapterId);
      const programme = repo.find('programmes', programmeId)!;
      const chapter = programme.chapters.find(c => c.id === chapterId)!;
      const activity = chapter.activities.find(a => a.id === activityId) ?? chapter.activities[0];
      const userMsg: CoachMessage = { id: newId('cm'), role: 'user', text: prompt, createdAt: new Date(clock.now()).toISOString(), contextActivityId: activityId };
      repo.mutate(db => db.coachConversations.find(c => c.id === convoId(userId, chapterId))!.messages.push(userMsg));
      try {
        await simulate('coach.ask');
      } catch (e) {
        repo.mutate(db => {
          const m = db.coachConversations.find(c => c.id === convoId(userId, chapterId))!.messages.find(x => x.id === userMsg.id);
          if (m) m.status = 'error';
        });
        throw e;
      }
      const reading = chapter.activities.find(a => a.reading)?.reading;
      const lower = prompt.toLowerCase();
      let text: string;
      if (lower.includes('quiz')) {
        const q = chapter.activities.find(a => a.type === 'practiceQuiz')?.quiz?.questions[0];
        text = `**Quick check (demo)** — ${q?.prompt ?? 'What are the four parts of an office workflow?'}\n\nThink it through, then open the practice quiz to check your answer. This is an ungraded practice prompt.`;
      } else if (lower.includes('example') || lower.includes('workplace')) {
        text = `**Workplace example (demo)**\n\n${reading?.workedExample ?? 'A realistic scenario from this chapter.'}\n\n_Drawn from ${chapter.title}, which is unlocked for you._`;
      } else if (lower.includes('simpl') || lower.includes('explain')) {
        text = `**In plain terms (demo)**\n\n${reading?.coreConcepts ?? chapter.description}\n\n**Step 1 — ${reading?.steps[0]?.title ?? 'Prepare'}:** ${reading?.steps[0]?.body ?? ''}\n**Step 2 — ${reading?.steps[1]?.title ?? 'Execute'}:** ${reading?.steps[1]?.body ?? ''}\n\n_Only Chapter ${chapter.index} material is used in this answer._`;
      } else {
        text = `**About "${activity.title}" (demo response)**\n\n${reading?.intro ?? chapter.description}\n\n**Why it matters:** ${reading?.whyItMatters ?? ''}\n\n_This demo coach answers only from chapters unlocked for you (${programme.title} · Chapter ${chapter.index})._`;
      }
      const reply: CoachMessage = { id: newId('cm'), role: 'coach', text, createdAt: new Date(clock.now()).toISOString(), status: 'sent', contextActivityId: activityId };
      repo.mutate(db => db.coachConversations.find(c => c.id === convoId(userId, chapterId))!.messages.push(reply));
      return reply;
    },
    async clear(userId, _programmeId, chapterId) {
      repo.mutate(db => {
        const c = db.coachConversations.find(x => x.id === convoId(userId, chapterId));
        if (c) c.messages = [];
      });
    },
  };
}
