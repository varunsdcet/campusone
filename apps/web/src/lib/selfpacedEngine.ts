/**
 * Self-paced completion, unlock, assessment, and coach rules (spec 21 Sep 2026).
 * Client-enforced for the prototype; API routes mirror the same helpers.
 */

import {
  calendarDaysSince,
  getEnrollment,
  loadProgress,
  saveProgress,
  type SelfpacedProgress,
} from "./selfpacedAuth";
import {
  getCurriculum,
  type QuizQuestion,
  type SelfpacedActivity,
  type SelfpacedChapter,
} from "./selfpacedCurriculum";

export const PASS_MARK = 70;
export const MATCHING_PASS = 80;
export const MAX_CHAPTER_ATTEMPTS = 3;
export const MAX_FINAL_ATTEMPTS = 2;
export const CHAPTER_COOLDOWN_HOURS = 12;
export const FINAL_COOLDOWN_HOURS = 48;
/** Countdown before any activity can be marked complete (2 minutes). */
export const ACTIVITY_TIMER_SECONDS = 120;
export const COACH_DAILY_CAP = 50;

export type ActivityMeta = {
  dwellSeconds?: number;
  watchPct?: number;
  scrolledEnd?: boolean;
  coachChecksCorrect?: number;
  bestScore?: number;
};

export type AssessmentAttemptRecord = {
  number: number;
  score: number;
  passed: boolean;
  submittedAt: string;
  questionIds: string[];
};

export type ChapterAssessmentState = {
  attempts: AssessmentAttemptRecord[];
  passed: boolean;
  remediationDone?: boolean;
  nextAttemptAt?: string;
};

export type StudyPlan = {
  goal: string;
  weeklyHours: number;
  targetFinish: string;
  onboardedAt?: string;
  mutedNudges?: boolean;
};

export type CoachMode = "on" | "hints" | "off" | "ask_instructor";

export function ensureProgressShape(p: SelfpacedProgress): SelfpacedProgress {
  return {
    completedActivityIds: p.completedActivityIds || [],
    startedAt: p.startedAt,
    lastActivityId: p.lastActivityId,
    activityMeta: p.activityMeta || {},
    chapterAssessments: p.chapterAssessments || {},
    studyPlan: p.studyPlan,
    weakTopics: p.weakTopics || [],
    coachMute: p.coachMute,
    coachMessagesToday: p.coachMessagesToday || 0,
    coachMessagesDay: p.coachMessagesDay,
  };
}

export function patchProgress(slug: string, patch: Partial<SelfpacedProgress>) {
  const current = ensureProgressShape(loadProgress(slug));
  saveProgress(slug, { ...current, ...patch });
}

export function setActivityMeta(slug: string, activityId: string, meta: Partial<ActivityMeta>) {
  const current = ensureProgressShape(loadProgress(slug));
  const prev = current.activityMeta?.[activityId] || {};
  patchProgress(slug, {
    activityMeta: {
      ...(current.activityMeta || {}),
      [activityId]: { ...prev, ...meta },
    },
  });
}

export function coachModeFor(activity: SelfpacedActivity): CoachMode {
  if (activity.type === "assessment") return "off";
  if (activity.type === "lecture") return "ask_instructor";
  return "on";
}

export function chapterUnlockDate(slug: string, chapterIndexZeroBased: number): Date | null {
  const enrollment = getEnrollment(slug);
  if (!enrollment) return null;
  const enrolled = new Date(enrollment.enrolledAt);
  const d = new Date(enrolled);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + chapterIndexZeroBased);
  return d;
}

export function isDateUnlocked(slug: string, chapterIndexZeroBased: number, now = new Date()): boolean {
  const enrollment = getEnrollment(slug);
  if (!enrollment) return false;
  return calendarDaysSince(enrollment.enrolledAt, now) >= chapterIndexZeroBased;
}

export function assessmentActivity(chapter: SelfpacedChapter): SelfpacedActivity | undefined {
  return chapter.activities.find((a) => a.type === "assessment");
}

export function isChapterAssessmentPassed(slug: string, chapterId: string): boolean {
  const p = ensureProgressShape(loadProgress(slug));
  return Boolean(p.chapterAssessments?.[chapterId]?.passed);
}

/** Spec: chapter[n] open when previous assessment passed AND today >= enrolment + n days. */
export function isChapterOpen(slug: string, chapterIndexZeroBased: number, now = new Date()): boolean {
  const chapters = getCurriculum(slug);
  if (chapterIndexZeroBased < 0 || chapterIndexZeroBased >= chapters.length) return false;
  if (!isDateUnlocked(slug, chapterIndexZeroBased, now)) return false;
  if (chapterIndexZeroBased === 0) return true;
  const prev = chapters[chapterIndexZeroBased - 1];
  return isChapterAssessmentPassed(slug, prev.id);
}

export function openChapterCount(slug: string, now = new Date()): number {
  const chapters = getCurriculum(slug);
  let n = 0;
  for (let i = 0; i < chapters.length; i++) {
    if (!isChapterOpen(slug, i, now)) break;
    n += 1;
  }
  return n;
}

export function chapterLockReason(
  slug: string,
  chapterIndexZeroBased: number,
  now = new Date(),
): { kind: "date" | "pass" | "open"; date?: Date; prevChapter?: number } {
  if (isChapterOpen(slug, chapterIndexZeroBased, now)) return { kind: "open" };
  if (!isDateUnlocked(slug, chapterIndexZeroBased, now)) {
    return { kind: "date", date: chapterUnlockDate(slug, chapterIndexZeroBased) || undefined };
  }
  return { kind: "pass", prevChapter: chapterIndexZeroBased };
}

export function isActivitySequentiallyOpen(
  slug: string,
  chapter: SelfpacedChapter,
  activityId: string,
): boolean {
  const completed = new Set(loadProgress(slug).completedActivityIds || []);
  for (const act of chapter.activities) {
    if (act.id === activityId) return true;
    if (!completed.has(act.id)) return false;
  }
  return false;
}

export function formatTimer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/** Universal 2-minute countdown gate for every activity. */
export function activityTimerReady(meta: ActivityMeta): {
  ok: boolean;
  remaining: number;
  missing: string[];
} {
  const elapsed = meta.dwellSeconds || 0;
  const remaining = Math.max(0, ACTIVITY_TIMER_SECONDS - elapsed);
  if (remaining > 0) {
    return {
      ok: false,
      remaining,
      missing: [`Wait ${formatTimer(remaining)} before marking complete`],
    };
  }
  return { ok: true, remaining: 0, missing: [] };
}

export function readingCompleteReady(
  _activity: SelfpacedActivity,
  meta: ActivityMeta,
): { ok: boolean; missing: string[] } {
  return activityTimerReady(meta);
}

export function lectureCompleteReady(meta: ActivityMeta): { ok: boolean; missing: string[] } {
  const timer = activityTimerReady(meta);
  const missing = [...timer.missing];
  if ((meta.watchPct || 0) < 90) missing.push("Watch at least 90% of the narrated lecture");
  return { ok: missing.length === 0, missing };
}

/** Matching: timer only — score shown for practice, not a completion gate. */
export function matchingCompleteReady(_score: number): { ok: boolean; missing: string[] } {
  return { ok: true, missing: [] };
}

export function drawAssessmentQuestions(
  bank: QuizQuestion[],
  count: number,
  seedKey: string,
): QuizQuestion[] {
  if (!bank.length) return [];
  const arr = [...bank];
  let h = 0;
  for (let i = 0; i < seedKey.length; i++) h = (h * 31 + seedKey.charCodeAt(i)) >>> 0;
  for (let i = arr.length - 1; i > 0; i--) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const j = h % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const n = Math.min(count, arr.length);
  return arr.slice(0, n).map((q) => shuffleQuestionOptions(q, seedKey + q.id));
}

function shuffleQuestionOptions(q: QuizQuestion, seed: string): QuizQuestion {
  const idxs = q.options.map((_, i) => i);
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  for (let i = idxs.length - 1; i > 0; i--) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const j = h % (i + 1);
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  const options = idxs.map((i) => q.options[i]);
  const correct = idxs.indexOf(q.correct);
  return { ...q, options, correct };
}

export function canStartAttempt(
  slug: string,
  chapterId: string,
  isFinal: boolean,
  now = new Date(),
): { ok: boolean; reason?: string; nextAt?: string } {
  const p = ensureProgressShape(loadProgress(slug));
  const state = p.chapterAssessments?.[chapterId];
  if (state?.passed) return { ok: false, reason: "Already passed" };
  const max = isFinal ? MAX_FINAL_ATTEMPTS : MAX_CHAPTER_ATTEMPTS;
  const used = state?.attempts.length || 0;
  if (used >= max) return { ok: false, reason: "No attempts remaining — instructor review required" };
  if (state?.nextAttemptAt && new Date(state.nextAttemptAt).getTime() > now.getTime()) {
    return { ok: false, reason: "Cooldown active", nextAt: state.nextAttemptAt };
  }
  if (used > 0 && !state?.remediationDone) {
    return { ok: false, reason: "Complete the coach remediation plan before retaking" };
  }
  return { ok: true };
}

export function recordAssessmentAttempt(
  slug: string,
  chapterId: string,
  score: number,
  questionIds: string[],
  isFinal: boolean,
): ChapterAssessmentState {
  const p = ensureProgressShape(loadProgress(slug));
  const prev = p.chapterAssessments?.[chapterId] || { attempts: [], passed: false };
  const passed = score >= PASS_MARK;
  const number = prev.attempts.length + 1;
  const cooldownH = isFinal ? FINAL_COOLDOWN_HOURS : CHAPTER_COOLDOWN_HOURS;
  const next = new Date();
  next.setHours(next.getHours() + cooldownH);
  const nextState: ChapterAssessmentState = {
    attempts: [
      ...prev.attempts,
      {
        number,
        score,
        passed,
        submittedAt: new Date().toISOString(),
        questionIds,
      },
    ],
    passed: prev.passed || passed,
    remediationDone: passed ? true : false,
    nextAttemptAt: passed ? undefined : next.toISOString(),
  };
  const weak = [...(p.weakTopics || [])];
  if (!passed && !weak.includes(chapterId)) weak.push(chapterId);
  patchProgress(slug, {
    chapterAssessments: { ...(p.chapterAssessments || {}), [chapterId]: nextState },
    weakTopics: weak,
  });
  return nextState;
}

export function markRemediationDone(slug: string, chapterId: string) {
  const p = ensureProgressShape(loadProgress(slug));
  const prev = p.chapterAssessments?.[chapterId];
  if (!prev) return;
  patchProgress(slug, {
    chapterAssessments: {
      ...(p.chapterAssessments || {}),
      [chapterId]: { ...prev, remediationDone: true },
    },
  });
}

export function allAssessmentsPassed(slug: string): boolean {
  const chapters = getCurriculum(slug);
  if (!chapters.length) return false;
  return chapters.every((ch) => {
    const has = assessmentActivity(ch);
    if (!has) return true;
    return isChapterAssessmentPassed(slug, ch.id);
  });
}

export function todaysPlan(slug: string): {
  activities: Array<{ chapterId: string; activity: SelfpacedActivity }>;
  minutes: number;
  weakTopic: string | null;
} {
  const chapters = getCurriculum(slug);
  const open = openChapterCount(slug);
  const completed = new Set(loadProgress(slug).completedActivityIds || []);
  const activities: Array<{ chapterId: string; activity: SelfpacedActivity }> = [];
  for (let i = 0; i < open; i++) {
    const ch = chapters[i];
    for (const act of ch.activities) {
      if (!completed.has(act.id) && isActivitySequentiallyOpen(slug, ch, act.id)) {
        activities.push({ chapterId: ch.id, activity: act });
        break;
      }
    }
  }
  const minutes = activities.reduce((n, a) => n + (a.activity.minutes || 0), 0);
  const p = ensureProgressShape(loadProgress(slug));
  const weakId = p.weakTopics?.[0] || null;
  const weakTopic = weakId ? chapters.find((c) => c.id === weakId)?.title || null : null;
  return { activities, minutes, weakTopic };
}

export function bumpCoachMessage(slug: string): boolean {
  const p = ensureProgressShape(loadProgress(slug));
  const day = new Date().toISOString().slice(0, 10);
  const count = p.coachMessagesDay === day ? p.coachMessagesToday || 0 : 0;
  if (count >= COACH_DAILY_CAP) return false;
  patchProgress(slug, { coachMessagesToday: count + 1, coachMessagesDay: day });
  return true;
}
