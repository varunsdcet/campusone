import { ApiError, api, loadSession } from "./api";
import { isKnownSelfpacedSlug } from "./selfpacedPrograms";

const STORAGE_USER = "hcc-selfpaced-user";
const STORAGE_ENROLLMENTS = "hcc-selfpaced-enrollments";
const STORAGE_PROGRESS = "hcc-selfpaced-progress";

/** How many chapters unlock each calendar day after enrollment. */
export const CHAPTERS_PER_DAY = 1;

export type SelfpacedUser = {
  name: string;
  email: string;
};

export type SelfpacedProgress = {
  completedActivityIds: string[];
  startedAt?: string;
  lastActivityId?: string;
  /** Bumped when chapter activity order/types change so stale IDs are pruned. */
  curriculumVersion?: number;
  activityMeta?: Record<
    string,
    {
      dwellSeconds?: number;
      watchPct?: number;
      scrolledEnd?: boolean;
      coachChecksCorrect?: number;
      bestScore?: number;
    }
  >;
  chapterAssessments?: Record<
    string,
    {
      attempts: Array<{
        number: number;
        score: number;
        passed: boolean;
        submittedAt: string;
        questionIds: string[];
      }>;
      passed: boolean;
      remediationDone?: boolean;
      nextAttemptAt?: string;
    }
  >;
  studyPlan?: {
    goal: string;
    weeklyHours: number;
    targetFinish: string;
    onboardedAt?: string;
    mutedNudges?: boolean;
  };
  weakTopics?: string[];
  coachMute?: boolean;
  coachMessagesToday?: number;
  coachMessagesDay?: string;
};

/** Curriculum shape for self-paced v2 (R→R→L→PQ→M→CA). */
export const SELFPACED_CURRICULUM_VERSION = 2;

export type EnrollmentRecord = {
  slug: string;
  enrolledAt: string;
  certificateId?: string;
  certificateIssuedAt?: string;
};

type EnrollmentBag = {
  version: 3;
  byEmail: Record<string, EnrollmentRecord[]>;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function startOfLocalDay(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole calendar days since enrollment date (local). Enrollment day = 0. */
export function calendarDaysSince(iso: string, now = new Date()): number {
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((startOfLocalDay(now) - startOfLocalDay(start)) / 86400000));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function loadSelfpacedUser(): SelfpacedUser | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_USER);
    if (!raw) return null;
    return JSON.parse(raw) as SelfpacedUser;
  } catch {
    return null;
  }
}

export function saveSelfpacedUser(user: SelfpacedUser) {
  if (!canUseStorage()) return;
  localStorage.setItem(
    STORAGE_USER,
    JSON.stringify({
      name: user.name.trim(),
      email: normalizeEmail(user.email),
    }),
  );
}

export function clearSelfpacedUser() {
  if (!canUseStorage()) return;
  localStorage.removeItem(STORAGE_USER);
}

export function clearEnrollments() {
  if (!canUseStorage()) return;
  const user = loadSelfpacedUser();
  if (!user) {
    localStorage.removeItem(STORAGE_ENROLLMENTS);
    return;
  }
  const bag = readEnrollmentBag();
  delete bag.byEmail[normalizeEmail(user.email)];
  writeEnrollmentBag(bag);
}

export function clearSelfpacedSession() {
  clearSelfpacedUser();
  if (!canUseStorage()) return;
  // Keep keyed enrollments/progress for other emails; clear only guest legacy keys if present.
}

function normalizeEnrollments(raw: unknown): EnrollmentRecord[] {
  if (!Array.isArray(raw)) return [];
  const now = new Date().toISOString();
  const out: EnrollmentRecord[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item) {
      out.push({ slug: item, enrolledAt: now });
      continue;
    }
    if (item && typeof item === "object" && "slug" in item) {
      const rec = item as EnrollmentRecord;
      if (rec.slug) {
        out.push({
          slug: rec.slug,
          enrolledAt: rec.enrolledAt || now,
          certificateId: rec.certificateId,
          certificateIssuedAt: rec.certificateIssuedAt,
        });
      }
    }
  }
  return out;
}

function knownSlug(slug: string): boolean {
  return isKnownSelfpacedSlug(slug);
}

function readEnrollmentBag(): EnrollmentBag {
  if (!canUseStorage()) return { version: 3, byEmail: {} };
  try {
    const raw = localStorage.getItem(STORAGE_ENROLLMENTS);
    if (!raw) return { version: 3, byEmail: {} };
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && "byEmail" in (parsed as object)) {
      const bag = parsed as EnrollmentBag;
      return { version: 3, byEmail: bag.byEmail || {} };
    }
    // Legacy: flat array shared by everyone — migrate under current user only.
    const legacy = normalizeEnrollments(parsed);
    const user = loadSelfpacedUser();
    const byEmail: Record<string, EnrollmentRecord[]> = {};
    if (user && legacy.length) byEmail[normalizeEmail(user.email)] = legacy;
    const migrated: EnrollmentBag = { version: 3, byEmail };
    writeEnrollmentBag(migrated);
    return migrated;
  } catch {
    return { version: 3, byEmail: {} };
  }
}

function writeEnrollmentBag(bag: EnrollmentBag) {
  if (!canUseStorage()) return;
  localStorage.setItem(STORAGE_ENROLLMENTS, JSON.stringify(bag));
}

export function loadEnrollmentRecords(): EnrollmentRecord[] {
  const user = loadSelfpacedUser();
  if (!user) return [];
  const email = normalizeEmail(user.email);
  const bag = readEnrollmentBag();
  const list = normalizeEnrollments(bag.byEmail[email] || []);
  // Dynamic/admin-created programmes may not be installed until the catalogue request completes.
  // Keep structurally valid slugs here; the dashboard only renders slugs present in the live catalogue.
  const cleaned = list.filter((r) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.slug));
  return cleaned;
}

function saveEnrollmentRecords(records: EnrollmentRecord[]) {
  const user = loadSelfpacedUser();
  if (!user || !canUseStorage()) return;
  const email = normalizeEmail(user.email);
  const bag = readEnrollmentBag();
  bag.byEmail[email] = records;
  writeEnrollmentBag(bag);
}

export function loadEnrollments(): string[] {
  return loadEnrollmentRecords().map((r) => r.slug);
}

export function getEnrollment(slug: string): EnrollmentRecord | undefined {
  return loadEnrollmentRecords().find((r) => r.slug === slug);
}

export function enrollProgram(slug: string) {
  if (!canUseStorage()) return;
  const user = loadSelfpacedUser();
  if (!user || !slug || !isKnownSelfpacedSlug(slug)) return;
  const records = loadEnrollmentRecords();
  if (records.some((r) => r.slug === slug)) return;
  records.push({ slug, enrolledAt: new Date().toISOString() });
  saveEnrollmentRecords(records);
}

/** Restores server-authoritative enrolments on a new browser/device. */
export async function syncSelfpacedEnrollments(): Promise<EnrollmentRecord[]> {
  const session = loadSession();
  const user = loadSelfpacedUser();
  if (!session || !user) return loadEnrollmentRecords();
  const out = await api<{ items: Array<{ slug: string; enrolledAt: string }> }>("/selfpaced/enrolments", {}, session.accessToken, { skipAuthRedirect: true });
  const current = loadEnrollmentRecords();
  const bySlug = new Map(current.map((item) => [item.slug, item]));
  for (const item of out.items) if (item.slug) bySlug.set(item.slug, { ...bySlug.get(item.slug), ...item });
  const records = [...bySlug.values()];
  saveEnrollmentRecords(records);
  return records;
}

export function isEnrolled(slug: string): boolean {
  return loadEnrollments().includes(slug);
}

/** Date-based chapter ceiling (enrolment day = chapter 1). Pass-gate is in selfpacedEngine.openChapterCount. */
export function unlockedChapterCount(slug: string, totalChapters: number): number {
  if (totalChapters <= 0) return 0;
  const enrollment = getEnrollment(slug);
  if (!enrollment) return 0;
  const days = calendarDaysSince(enrollment.enrolledAt);
  return Math.min(totalChapters, (days + 1) * CHAPTERS_PER_DAY);
}

export function isChapterUnlocked(slug: string, chapterIndexZeroBased: number, totalChapters: number): boolean {
  return chapterIndexZeroBased >= 0 && chapterIndexZeroBased < unlockedChapterCount(slug, totalChapters);
}

export function nextChapterUnlockDate(slug: string, totalChapters: number): Date | null {
  const enrollment = getEnrollment(slug);
  if (!enrollment) return null;
  const unlocked = unlockedChapterCount(slug, totalChapters);
  if (unlocked >= totalChapters) return null;
  const enrolled = new Date(enrollment.enrolledAt);
  const next = new Date(enrolled);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + unlocked);
  return next;
}

export function formatUnlockLabel(date: Date): string {
  return date.toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

type ProgressBag = {
  version: 3;
  byEmail: Record<string, Record<string, SelfpacedProgress>>;
};

function emptyProgress(): SelfpacedProgress {
  return { completedActivityIds: [] };
}

function isSlugProgressMap(value: unknown): value is Record<string, SelfpacedProgress> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if ("byEmail" in value) return false;
  return true;
}

function readProgressBag(): ProgressBag {
  if (!canUseStorage()) return { version: 3, byEmail: {} };
  try {
    const raw = localStorage.getItem(STORAGE_PROGRESS);
    if (!raw) return { version: 3, byEmail: {} };
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && "byEmail" in (parsed as object)) {
      const bag = parsed as ProgressBag;
      return { version: 3, byEmail: bag.byEmail || {} };
    }
    // Legacy shared progress leaked across accounts — do NOT attach it to the current user.
    // Keep a backup under a reserved key so nothing is silently assigned to a new signup.
    const legacy = isSlugProgressMap(parsed) ? parsed : {};
    const migrated: ProgressBag = {
      version: 3,
      byEmail: Object.keys(legacy).length ? { "__legacy_shared__": legacy } : {},
    };
    writeProgressBag(migrated);
    return migrated;
  } catch {
    return { version: 3, byEmail: {} };
  }
}

function writeProgressBag(bag: ProgressBag) {
  if (!canUseStorage()) return;
  localStorage.setItem(STORAGE_PROGRESS, JSON.stringify(bag));
}

export function loadAllProgress(): Record<string, SelfpacedProgress> {
  const user = loadSelfpacedUser();
  if (!user) return {};
  const email = normalizeEmail(user.email);
  const bag = readProgressBag();
  return bag.byEmail[email] || {};
}

export function loadProgress(slug: string): SelfpacedProgress {
  const raw = loadAllProgress()[slug] || emptyProgress();
  // Pure read — do not write during render (migrate is in-memory only).
  if (raw.curriculumVersion === SELFPACED_CURRICULUM_VERSION) return raw;
  return { ...raw, curriculumVersion: SELFPACED_CURRICULUM_VERSION };
}

/** Drop stale activity IDs from older curriculum shapes (e.g. knowledge quiz before lecture). */
export function pruneProgressToCurriculum(slug: string, validActivityIds: string[]): SelfpacedProgress {
  const current = loadProgress(slug);
  const valid = new Set(validActivityIds);
  const completedActivityIds = (current.completedActivityIds || []).filter((id) => valid.has(id));
  const activityMeta: SelfpacedProgress["activityMeta"] = {};
  for (const [id, meta] of Object.entries(current.activityMeta || {})) {
    if (valid.has(id)) activityMeta[id] = meta;
  }
  const next: SelfpacedProgress = {
    ...current,
    completedActivityIds,
    activityMeta,
    curriculumVersion: SELFPACED_CURRICULUM_VERSION,
  };
  saveProgress(slug, next);
  return next;
}

export function saveProgress(slug: string, progress: SelfpacedProgress) {
  if (!canUseStorage()) return;
  const user = loadSelfpacedUser();
  if (!user) return;
  const email = normalizeEmail(user.email);
  const bag = readProgressBag();
  const mine = { ...(bag.byEmail[email] || {}) };
  mine[slug] = progress;
  bag.byEmail[email] = mine;
  writeProgressBag(bag);
}

export function markActivityComplete(slug: string, activityId: string) {
  const current = loadProgress(slug);
  const completedActivityIds = Array.from(new Set([...current.completedActivityIds, activityId]));
  saveProgress(slug, {
    ...current,
    completedActivityIds,
    startedAt: current.startedAt || new Date().toISOString(),
    lastActivityId: activityId,
  });
}

export function isCourseComplete(slug: string, totalActivities: number): boolean {
  if (totalActivities <= 0) return false;
  const progress = loadProgress(slug);
  if (progress.completedActivityIds.length < totalActivities) return false;
  const assessments = Object.values(progress.chapterAssessments || {});
  // When assessments exist, every recorded chapter must be passed.
  if (assessments.length > 0 && !assessments.every((a) => a.passed)) return false;
  return true;
}

const SERVER_CERTIFICATE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only ids issued by the server (CredentialRecord) resolve on the public verify page. */
export function isIssuedCertificateId(id: string | undefined): id is string {
  return Boolean(id && SERVER_CERTIFICATE_ID.test(id));
}

export type CertificateIssue =
  | { ok: true; record: EnrollmentRecord }
  | { ok: false; reason: "incomplete" | "not_enrolled" | "sign_in" | "error"; message: string };

const pendingIssues = new Map<string, Promise<CertificateIssue>>();

/** Records completion on the server, which issues the credential once per learner and course. */
export function requestCertificate(slug: string, totalActivities: number): Promise<CertificateIssue> {
  const inFlight = pendingIssues.get(slug);
  if (inFlight) return inFlight;
  const run = (async (): Promise<CertificateIssue> => {
    if (!isCourseComplete(slug, totalActivities)) return { ok: false, reason: "incomplete", message: "Finish every activity first." };
    const current = getEnrollment(slug);
    if (!current) return { ok: false, reason: "not_enrolled", message: "You are not enrolled in this course." };
    if (isIssuedCertificateId(current.certificateId)) return { ok: true, record: current };
    const session = loadSession();
    if (!session) return { ok: false, reason: "sign_in", message: "Sign in with your CampusOne account to issue your verifiable certificate." };
    try {
      const out = await api<{ certificateId: string; issuedAt: string }>(
        "/selfpaced/certificates",
        {
          method: "POST",
          body: JSON.stringify({ slug, completedActivityIds: loadProgress(slug).completedActivityIds, assessmentsPassed: true }),
        },
        session.accessToken,
        { skipAuthRedirect: true },
      );
      const records = loadEnrollmentRecords();
      const idx = records.findIndex((r) => r.slug === slug);
      const record: EnrollmentRecord = { ...current, certificateId: out.certificateId, certificateIssuedAt: out.issuedAt };
      if (idx >= 0) {
        records[idx] = record;
        saveEnrollmentRecords(records);
      }
      return { ok: true, record };
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        return { ok: false, reason: "sign_in", message: "Your session expired. Sign in again to issue your certificate." };
      }
      return { ok: false, reason: "error", message: err instanceof Error ? err.message : "Could not issue the certificate." };
    }
  })().finally(() => pendingIssues.delete(slug));
  pendingIssues.set(slug, run);
  return run;
}

/**
 * Returns the enrollment once the course is complete. Its certificateId is set only after the server has issued
 * the credential; issuance is started in the background when the learner is signed in.
 */
export function ensureCertificate(slug: string, totalActivities: number): EnrollmentRecord | null {
  if (!isCourseComplete(slug, totalActivities)) return null;
  const current = getEnrollment(slug);
  if (!current) return null;
  if (isIssuedCertificateId(current.certificateId)) return current;
  if (typeof window !== "undefined" && loadSession()) void requestCertificate(slug, totalActivities);
  return { ...current, certificateId: undefined, certificateIssuedAt: undefined };
}

/** Lookup enrollment by certificate id (public verify). */
export function findEnrollmentByCertificateId(certificateId: string): {
  enrollment: EnrollmentRecord;
  user: SelfpacedUser | null;
} | null {
  if (!certificateId) return null;
  const records = loadEnrollmentRecords();
  const enrollment = records.find((r) => r.certificateId === certificateId);
  if (!enrollment) return null;
  return { enrollment, user: loadSelfpacedUser() };
}
