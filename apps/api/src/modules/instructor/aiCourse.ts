import { randomInt, randomUUID } from "node:crypto";
import type { SessionClaims } from "@myheritage/contracts";
import { prisma } from "@myheritage/db";
import { z } from "zod";
import { generateWithAi } from "../../lib/ask.js";
import { S, s, settingsOf } from "../admin/heritage/courses.js";
import { extractJson, loadSectionForDraft } from "./aiDraft.js";
import { sanitizeLessonHtml } from "./aiDraftContent.js";
import {
  SYSTEM_PROMPT,
  assessmentPrompt,
  blueprintPrompt,
  casePrompt,
  coveredSummary,
  lessonPrompt,
  quizPrompt,
} from "./aiCoursePrompts.js";
import {
  type AssessmentContent,
  type Blueprint,
  type Check,
  type CourseCase,
  type LessonContent,
  type QuizContent,
  BlueprintEdits,
  CourseBrief,
  applyBlueprintEdits,
  assessmentInstructions,
  blueprintChecks,
  caseBrief,
  normalizeAssessment,
  normalizeBlueprint,
  normalizeCase,
  normalizeLesson,
  normalizeQuiz,
  quizCode,
  renderCaseInstructor,
  renderCaseLearner,
  renderCourseOutline,
  renderInstructorGuide,
  renderLesson,
  renderQuizIntro,
} from "./aiCourseSpec.js";
import { buildCourseLms, mergeCourseLmsOverlay } from "./courseLmsScreens.js";
import { retireLmsAssignment, saveLmsAssignment } from "./lmsActivities.js";
import { findVisibleQuiz, quizFromActivity, staffQuizResults } from "./lmsQuiz.js";

type ItemKind = "case" | "lesson" | "quiz" | "assessment";
type ItemStatus = "pending" | "running" | "done" | "failed";

type Job = {
  sectionId: string;
  courseCode: string;
  courseTitle: string;
  version: number;
  stage: "blueprint" | "approved" | "published";
  brief: CourseBrief;
  blueprint: Blueprint | null;
  blueprintTask: { status: "running" | "done" | "failed"; error?: string; startedAt: string; model?: string };
  approvedAt?: string;
  approvedBy?: string;
  published?: { at: string; by: string; version: number; topicIds: string[]; reusedTopicIds: string[]; activityIds: string[]; assignmentIds: string[] };
  updatedAt: string;
};

type Item = {
  key: string;
  kind: ItemKind;
  ref: string;
  label: string;
  version: number;
  status: ItemStatus;
  attempts: number;
  error?: string;
  model?: string;
  startedAt?: string;
  finishedAt?: string;
  content?: unknown;
};

const STALE_MS = 8 * 60_000;
const CONCURRENCY = 4;
const AI_TIMEOUT_MS = 240_000;

const jobPath = (sectionId: string) => `/ai-course/${sectionId}/job`;
const itemPrefix = (sectionId: string) => `/ai-course/${sectionId}/item/`;

function fail(message: string, status = 400, code = "VALIDATION_ERROR"): never {
  throw Object.assign(new Error(message), { status, code });
}

async function readJob(institutionId: string, sectionId: string): Promise<Job | null> {
  const row = await prisma.sisScreenState.findUnique({ where: { institutionId_path: { institutionId, path: jobPath(sectionId) } } });
  return row ? (JSON.parse(row.payloadJson) as Job) : null;
}

async function writeJob(institutionId: string, job: Job) {
  job.updatedAt = new Date().toISOString();
  const payloadJson = JSON.stringify(job);
  await prisma.sisScreenState.upsert({
    where: { institutionId_path: { institutionId, path: jobPath(job.sectionId) } },
    create: { institutionId, path: jobPath(job.sectionId), payloadJson },
    update: { payloadJson },
  });
}

async function readItems(institutionId: string, sectionId: string, version: number): Promise<Item[]> {
  const rows = await prisma.sisScreenState.findMany({ where: { institutionId, path: { startsWith: itemPrefix(sectionId) } } });
  return rows.map((r) => JSON.parse(r.payloadJson) as Item).filter((i) => i.version === version);
}

async function writeItem(institutionId: string, sectionId: string, item: Item) {
  const path = `${itemPrefix(sectionId)}${item.key}`;
  const payloadJson = JSON.stringify(item);
  await prisma.sisScreenState.upsert({
    where: { institutionId_path: { institutionId, path } },
    create: { institutionId, path, payloadJson },
    update: { payloadJson },
  });
}

async function clearItems(institutionId: string, sectionId: string) {
  await prisma.sisScreenState.deleteMany({ where: { institutionId, path: { startsWith: itemPrefix(sectionId) } } });
}

async function courseContext(institutionId: string, section: { courseId: string; course: { code: string; title: string; credits: number | null } }) {
  const settings = (await settingsOf(institutionId, S.courseSettings, [section.courseId])).get(section.courseId)?.data ?? {};
  return {
    code: section.course.code,
    title: section.course.title,
    credits: section.course.credits,
    description: s(settings.description).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1500),
    totalHours: Number(s(settings.totalHours)) || null,
  };
}

async function askJson(prompt: string, maxTokens: number) {
  const ai = await generateWithAi(SYSTEM_PROMPT, prompt, AI_TIMEOUT_MS, { json: true, maxTokens });
  return { data: extractJson(ai.answer), model: ai.model };
}

/* ------------------------------------------------------------------ Blueprint ------------------------------------------------------------------ */

const blueprintRuns = new Set<string>();

async function runBlueprint(institutionId: string, sectionId: string, version: number, course: Awaited<ReturnType<typeof courseContext>>) {
  const key = `${institutionId}:${sectionId}`;
  blueprintRuns.add(key);
  let result: { blueprint?: Blueprint; model?: string; error?: string } = {};
  try {
    const job = await readJob(institutionId, sectionId);
    if (!job || job.version !== version) return;
    let lastError = "";
    for (let attempt = 0; attempt < 3 && !result.blueprint; attempt += 1) {
      try {
        const { data, model } = await askJson(
          blueprintPrompt(job.brief, course) + (lastError ? `\n\nYour previous answer was rejected: ${lastError}. Fix this and return the full JSON.` : ""),
          8000,
        );
        result = { blueprint: normalizeBlueprint(data, job.brief, course), model };
      } catch (err) {
        lastError = err instanceof Error ? err.message : "invalid blueprint";
      }
    }
    if (!result.blueprint) result = { error: lastError || "The AI did not return a usable blueprint" };
  } finally {
    blueprintRuns.delete(key);
    const latest = await readJob(institutionId, sectionId);
    if (latest && latest.version === version && latest.stage === "blueprint") {
      latest.blueprint = result.blueprint ?? latest.blueprint;
      latest.blueprintTask = result.blueprint
        ? { status: "done", startedAt: latest.blueprintTask.startedAt, model: result.model }
        : { status: "failed", startedAt: latest.blueprintTask.startedAt, error: result.error || "Blueprint generation stopped" };
      await writeJob(institutionId, latest);
    }
  }
}

/* ------------------------------------------------------------------ Items ------------------------------------------------------------------ */

function planItems(bp: Blueprint, includeCase: boolean, version: number): Item[] {
  const base = { version, status: "pending" as const, attempts: 0 };
  return [
    ...(includeCase ? [{ ...base, key: "case", kind: "case" as const, ref: "case", label: "Shared business case" }] : []),
    ...bp.modules.flatMap((m) => m.lessons.map((l) => ({ ...base, key: `lesson-${l.id}`, kind: "lesson" as const, ref: l.id, label: `${l.id} · ${l.title}` }))),
    ...bp.assessments.map((a) => ({ ...base, key: `assessment-${a.id}`, kind: "assessment" as const, ref: a.id, label: `${a.id} · ${a.title}` })),
    ...bp.modules.map((m) => ({ ...base, key: `quiz-${m.id}`, kind: "quiz" as const, ref: m.id, label: `Quiz ${quizCode(m.number)} · ${m.title}` })),
  ];
}

function dependencies(item: Item, items: Item[]): Item[] {
  if (item.kind === "case") return [];
  if (item.kind === "quiz") return items.filter((i) => i.kind === "lesson" && i.ref.startsWith(`${item.ref}-`));
  return items.filter((i) => i.kind === "case");
}

async function generateItem(job: Job, item: Item, items: Item[]): Promise<{ content: unknown; model: string }> {
  const bp = job.blueprint!;
  const caseItem = items.find((i) => i.kind === "case" && i.status === "done");
  const caseText = caseBrief((caseItem?.content as CourseCase | undefined) ?? null);
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const retry = lastError ? `\n\nYour previous answer was rejected: ${lastError}. Fix this and return the full JSON.` : "";
    try {
      if (item.kind === "case") {
        const { data, model } = await askJson(casePrompt(bp, job.brief.outline) + retry, 8000);
        return { content: normalizeCase(data), model };
      }
      if (item.kind === "lesson") {
        const mod = bp.modules.find((m) => m.lessons.some((l) => l.id === item.ref))!;
        const lesson = mod.lessons.find((l) => l.id === item.ref)!;
        const isLast = mod.lessons[mod.lessons.length - 1]!.id === lesson.id;
        const earlier = bp.modules
          .flatMap((m) => m.lessons)
          .filter((l) => l.number < lesson.number)
          .map((l) => ({ lesson: l, content: (items.find((i) => i.key === `lesson-${l.id}` && i.status === "done")?.content as LessonContent | undefined) ?? null }));
        const { data, model } = await askJson(lessonPrompt({ bp, mod, lesson, caseText, covered: coveredSummary(earlier), isLast }) + retry, 8000);
        const content = normalizeLesson(data, {
          id: lesson.id,
          title: lesson.title,
          minutes: lesson.minutes,
          delivery: bp.course.delivery,
          validOutcomes: bp.outcomes.map((o) => o.id),
          quiz: isLast ? { code: quizCode(mod.number), minutes: bp.quizMinutes, questions: bp.quizQuestions } : undefined,
        });
        return { content, model };
      }
      if (item.kind === "quiz") {
        const mod = bp.modules.find((m) => m.id === item.ref)!;
        const lessons = mod.lessons.map((l) => ({ lesson: l, content: items.find((i) => i.key === `lesson-${l.id}`)!.content as LessonContent }));
        const { data, model } = await askJson(quizPrompt(bp, mod, lessons) + retry, 6000);
        return {
          // A random seed per generation so answer keys are not the same pattern in every course.
          content: normalizeQuiz(data, { moduleNumber: mod.number, moduleTitle: mod.title, count: bp.quizQuestions, minutes: bp.quizMinutes, lessonIds: mod.lessons.map((l) => l.id), seed: randomInt(1, 2 ** 31) }),
          model,
        };
      }
      const meta = bp.assessments.find((a) => a.id === item.ref)!;
      const { data, model } = await askJson(assessmentPrompt(bp, meta, caseText, job.brief.outline) + retry, 5000);
      return { content: normalizeAssessment(data, { id: meta.id, title: meta.title }), model };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "invalid output";
      if ((err as { code?: string }).code === "AI_UNAVAILABLE") throw err;
    }
  }
  throw new Error(lastError || "The AI returned unusable content");
}

const runners = new Map<string, Promise<void>>();

function startRunner(institutionId: string, sectionId: string) {
  const key = `${institutionId}:${sectionId}`;
  if (runners.has(key)) return;
  const run = runJob(institutionId, sectionId)
    .catch((err) => console.error("ai-course runner failed", sectionId, err))
    .finally(() => runners.delete(key));
  runners.set(key, run);
}

async function runJob(institutionId: string, sectionId: string) {
  const start = await readJob(institutionId, sectionId);
  if (!start || start.stage !== "approved" || !start.blueprint) return;
  const version = start.version;
  for (const item of await readItems(institutionId, sectionId, version)) {
    if (item.status === "running") await writeItem(institutionId, sectionId, { ...item, status: "pending" });
  }
  const claimed = new Set<string>();
  const worker = async () => {
    for (;;) {
      const job = await readJob(institutionId, sectionId);
      if (!job || job.version !== version || job.stage !== "approved") return;
      const items = await readItems(institutionId, sectionId, version);
      const ready = items.find((i) => i.status === "pending" && !claimed.has(i.key) && dependencies(i, items).every((d) => d.status === "done"));
      if (!ready) {
        const waiting = items.some((i) => i.status === "pending" && !claimed.has(i.key) && dependencies(i, items).every((d) => d.status !== "failed"));
        if (waiting && claimed.size) {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        return;
      }
      claimed.add(ready.key);
      try {
        const running: Item = { ...ready, status: "running", attempts: ready.attempts + 1, startedAt: new Date().toISOString(), error: undefined };
        await writeItem(institutionId, sectionId, running);
        try {
          const { content, model } = await generateItem(job, running, items);
          await writeItem(institutionId, sectionId, { ...running, status: "done", content, model, finishedAt: new Date().toISOString() });
        } catch (err) {
          await writeItem(institutionId, sectionId, {
            ...running,
            status: "failed",
            error: err instanceof Error ? err.message.slice(0, 400) : "Generation failed",
            finishedAt: new Date().toISOString(),
          });
        }
      } finally {
        claimed.delete(ready.key);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

/* ------------------------------------------------------------------ Public API ------------------------------------------------------------------ */

async function loadSection(user: SessionClaims, path: string) {
  return loadSectionForDraft(user, path);
}

function itemSummary(item: Item, now: number) {
  const stale = item.status === "running" && item.startedAt && now - Date.parse(item.startedAt) > STALE_MS;
  const content = item.content as { flags?: string[] } | undefined;
  return {
    key: item.key,
    kind: item.kind,
    ref: item.ref,
    label: item.label,
    status: stale ? ("failed" as const) : item.status,
    error: stale ? "Generation was interrupted; retry it" : item.error,
    attempts: item.attempts,
    flags: content?.flags?.length ?? 0,
  };
}

function contentChecks(job: Job, items: Item[]): Check[] {
  const bp = job.blueprint;
  if (!bp) return [];
  const checks = blueprintChecks(bp);
  const lessons = items.filter((i) => i.kind === "lesson" && i.status === "done").map((i) => i.content as LessonContent);
  if (lessons.length) {
    const planned = lessons.reduce((a, l) => a + l.plan.reduce((x, r) => x + r.minutes, 0), 0);
    const target = lessons.reduce((a, l) => a + l.minutes, 0);
    checks.push({ label: "Lesson session plans", ok: planned === target, detail: `${lessons.length} lesson plans total ${planned} of ${target} minutes (quiz time included)` });
    if (bp.course.delivery === "self_paced") {
      const withVideo = lessons.filter((lesson) => lesson.storyboard?.slides.length).length;
      checks.push({
        label: "AI video lectures",
        ok: withVideo === lessons.length,
        detail: `${withVideo} of ${lessons.length} self-paced lessons include a reviewed narrated storyboard`,
      });
    }
  }
  const quizzes = items.filter((i) => i.kind === "quiz" && i.status === "done").map((i) => i.content as QuizContent);
  if (quizzes.length) {
    const ok = quizzes.every((q) => q.questions.length === bp.quizQuestions && q.questions.every((x) => x.options.length === 4 && x.answer >= 0 && x.answer < 4));
    checks.push({ label: "Quiz answer keys", ok, detail: `${quizzes.length} quizzes, each with ${bp.quizQuestions} single-answer questions and a stored key` });
  }
  const rubrics = items.filter((i) => i.kind === "assessment" && i.status === "done").map((i) => i.content as AssessmentContent);
  if (rubrics.length) {
    const ok = rubrics.every((r) => r.criteria.reduce((a, c) => a + c.points, 0) === 100);
    checks.push({ label: "Rubric totals", ok, detail: `${rubrics.length} rubrics, each marked out of 100` });
  }
  const flags = items.reduce((a, i) => a + ((i.content as { flags?: string[] } | undefined)?.flags?.length ?? 0), 0) + bp.flags.length;
  checks.push({ label: "Review flags", ok: true, detail: flags ? `${flags} item(s) flagged for expert review — listed in the instructor guides` : "No items flagged" });
  return checks;
}

export async function getAiCourse(user: SessionClaims, path: string) {
  const section = await loadSection(user, path);
  const course = await courseContext(user.institutionId, section);
  const job = await readJob(user.institutionId, section.id);
  const items = job ? await readItems(user.institutionId, section.id, job.version) : [];
  const now = Date.now();
  const blueprintStale =
    job?.stage === "blueprint" &&
    job.blueprintTask.status === "running" &&
    !blueprintRuns.has(`${user.institutionId}:${section.id}`) &&
    now - Date.parse(job.blueprintTask.startedAt) > 30_000;
  return {
    course: { code: course.code, title: course.title, description: course.description, totalHours: course.totalHours },
    job: job
      ? {
          version: job.version,
          stage: job.stage,
          brief: job.brief,
          blueprint: job.blueprint,
          blueprintTask: blueprintStale ? { ...job.blueprintTask, status: "failed", error: "Blueprint generation was interrupted; generate it again" } : job.blueprintTask,
          approvedAt: job.approvedAt,
          published: job.published ? { at: job.published.at, version: job.published.version } : null,
        }
      : null,
    items: items.map((i) => itemSummary(i, now)),
    running: runners.has(`${user.institutionId}:${section.id}`),
    checks: job ? contentChecks(job, items) : [],
  };
}

export async function startAiCourseBlueprint(user: SessionClaims, path: string, body: unknown) {
  const section = await loadSection(user, path);
  const brief = CourseBrief.parse((body as { brief?: unknown })?.brief ?? body);
  const prev = await readJob(user.institutionId, section.id);
  if (prev?.stage === "approved" && runners.has(`${user.institutionId}:${section.id}`)) fail("Content is still generating. Wait for it to finish before starting over.", 409, "CONFLICT");
  const course = await courseContext(user.institutionId, section);
  const job: Job = {
    sectionId: section.id,
    courseCode: course.code,
    courseTitle: course.title,
    version: (prev?.version ?? 0) + 1,
    stage: "blueprint",
    brief,
    blueprint: null,
    blueprintTask: { status: "running", startedAt: new Date().toISOString() },
    published: prev?.published,
    updatedAt: new Date().toISOString(),
  };
  await clearItems(user.institutionId, section.id);
  await writeJob(user.institutionId, job);
  void runBlueprint(user.institutionId, section.id, job.version, course).catch((err) => console.error("ai-course blueprint failed", err));
  return getAiCourse(user, path);
}

export async function saveAiCourseBlueprint(user: SessionClaims, path: string, body: unknown) {
  const section = await loadSection(user, path);
  const job = await readJob(user.institutionId, section.id);
  if (!job?.blueprint || job.stage !== "blueprint") fail("Open a blueprint that has not been approved yet");
  job.blueprint = applyBlueprintEdits(job.blueprint, BlueprintEdits.parse(body));
  await writeJob(user.institutionId, job);
  return getAiCourse(user, path);
}

export async function approveAiCourseBlueprint(user: SessionClaims, path: string) {
  const section = await loadSection(user, path);
  const job = await readJob(user.institutionId, section.id);
  if (!job?.blueprint || job.stage !== "blueprint") fail("Generate a blueprint first");
  const failing = blueprintChecks(job.blueprint).filter((c) => !c.ok);
  if (failing.length) fail(`Fix the blueprint before approving: ${failing.map((c) => `${c.label} — ${c.detail}`).join("; ")}`);
  job.stage = "approved";
  job.approvedAt = new Date().toISOString();
  job.approvedBy = user.accountId;
  await clearItems(user.institutionId, section.id);
  for (const item of planItems(job.blueprint, job.brief.includeCase, job.version)) await writeItem(user.institutionId, section.id, item);
  await writeJob(user.institutionId, job);
  startRunner(user.institutionId, section.id);
  return getAiCourse(user, path);
}

export async function reopenAiCourseBlueprint(user: SessionClaims, path: string) {
  const section = await loadSection(user, path);
  const job = await readJob(user.institutionId, section.id);
  if (!job?.blueprint) fail("Nothing to reopen");
  job.version += 1;
  job.stage = "blueprint";
  job.blueprintTask = { status: "done", startedAt: new Date().toISOString() };
  await clearItems(user.institutionId, section.id);
  await writeJob(user.institutionId, job);
  return getAiCourse(user, path);
}

export async function resumeAiCourse(user: SessionClaims, path: string, body: unknown) {
  const section = await loadSection(user, path);
  const job = await readJob(user.institutionId, section.id);
  if (!job?.blueprint || job.stage === "blueprint") fail("Approve the blueprint first");
  if (runners.has(`${user.institutionId}:${section.id}`) && !(body as { key?: unknown } | null)?.key) return getAiCourse(user, path);
  const only = z.object({ key: z.string().max(80).optional() }).parse(body ?? {}).key;
  if (job.stage === "published") {
    job.stage = "approved";
    await writeJob(user.institutionId, job);
  }
  const now = Date.now();
  for (const item of await readItems(user.institutionId, section.id, job.version)) {
    const stale = item.status === "running" && item.startedAt && now - Date.parse(item.startedAt) > STALE_MS;
    const redo = only ? item.key === only && item.status !== "running" : item.status === "failed" || stale;
    if (redo) await writeItem(user.institutionId, section.id, { ...item, status: "pending", error: undefined, ...(only ? { attempts: 0 } : {}) });
  }
  startRunner(user.institutionId, section.id);
  return getAiCourse(user, path);
}

export async function discardAiCourse(user: SessionClaims, path: string) {
  const section = await loadSection(user, path);
  const job = await readJob(user.institutionId, section.id);
  await clearItems(user.institutionId, section.id);
  if (job?.published) {
    await writeJob(user.institutionId, { ...job, version: job.version + 1, stage: "blueprint", blueprint: null, blueprintTask: { status: "failed", startedAt: new Date().toISOString(), error: "Discarded" } });
  } else {
    await prisma.sisScreenState.deleteMany({ where: { institutionId: user.institutionId, path: jobPath(section.id) } });
  }
  return getAiCourse(user, path);
}

/** Learner-facing preview of one generated item, rendered exactly as it will be published. */
export async function previewAiCourseItem(user: SessionClaims, path: string, key: string) {
  const section = await loadSection(user, path);
  const job = await readJob(user.institutionId, section.id);
  if (!job?.blueprint) fail("No blueprint");
  const items = await readItems(user.institutionId, section.id, job.version);
  const item = items.find((i) => i.key === key);
  if (!item || item.status !== "done") fail("That item has not been generated yet", 404, "NOT_FOUND");
  const bp = job.blueprint;
  let html = "";
  if (item.kind === "case") html = renderCaseLearner(item.content as CourseCase) + renderCaseInstructor(item.content as CourseCase);
  if (item.kind === "lesson") {
    const mod = bp.modules.find((m) => m.lessons.some((l) => l.id === item.ref))!;
    html = renderLesson(bp, mod, mod.lessons.find((l) => l.id === item.ref)!, item.content as LessonContent);
  }
  if (item.kind === "quiz") {
    const quiz = item.content as QuizContent;
    const mod = bp.modules.find((m) => m.id === item.ref)!;
    html = renderQuizIntro(bp, quiz) + renderInstructorGuide(bp, mod, [], quiz, []);
  }
  if (item.kind === "assessment") {
    const meta = bp.assessments.find((a) => a.id === item.ref)!;
    const content = item.content as AssessmentContent;
    html = `<h2>${meta.id} · ${meta.title}</h2>${assessmentInstructions(bp, meta, content)
      .split("\n")
      .map((line) => (line ? `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>` : ""))
      .join("")}`;
  }
  return { key, label: item.label, html: sanitizeLessonHtml(html), flags: (item.content as { flags?: string[] }).flags ?? [], model: item.model };
}

/* ------------------------------------------------------------------ Publish ------------------------------------------------------------------ */

type OverlayActivity = Record<string, unknown> & { id: string };

function stamp() {
  return new Date().toLocaleString("en-CA", { dateStyle: "full", timeStyle: "short", timeZone: "America/Toronto" });
}

export async function publishAiCourse(user: SessionClaims, path: string) {
  const section = await loadSection(user, path);
  const job = await readJob(user.institutionId, section.id);
  if (!job?.blueprint || job.stage === "blueprint") fail("Approve the blueprint and generate the content first");
  if (runners.has(`${user.institutionId}:${section.id}`)) fail("Content is still generating", 409, "CONFLICT");
  const items = await readItems(user.institutionId, section.id, job.version);
  const missing = items.filter((i) => i.status !== "done");
  if (missing.length) fail(`${missing.length} item(s) are not generated yet: ${missing.slice(0, 5).map((i) => i.label).join(", ")}`);
  const failing = contentChecks(job, items).filter((c) => !c.ok);
  if (failing.length) fail(`Publishing is blocked: ${failing.map((c) => `${c.label} — ${c.detail}`).join("; ")}`);

  const bp = job.blueprint;
  const get = <T>(key: string) => items.find((i) => i.key === key)?.content as T | undefined;
  const caseContent = get<CourseCase>("case") ?? null;
  const sync = bp.course.delivery === "synchronous";
  const institutionId = user.institutionId;
  const overlayPath = `/instructor/sections/${section.id}`;
  const tag = randomUUID().slice(0, 6);
  let seq = 0;
  const newId = (prefix: string) => `${prefix}-aic${tag}${(seq++).toString(36)}`;

  for (const assignmentId of job.published?.assignmentIds ?? []) await retireLmsAssignment(institutionId, section.id, assignmentId);

  const row = await prisma.sisScreenState.findUnique({ where: { institutionId_path: { institutionId, path: overlayPath } } });
  const overlay = row ? (JSON.parse(row.payloadJson) as Record<string, unknown>) : {};
  const prevActs = new Set(job.published?.activityIds ?? []);
  const prevTopics = new Set([...(job.published?.topicIds ?? []), ...(job.published?.reusedTopicIds ?? [])]);
  const topicActivities: Record<string, OverlayActivity[]> = {};
  for (const [topicId, acts] of Object.entries((overlay.topicActivities as Record<string, OverlayActivity[]>) || {})) {
    const kept = (acts || []).filter((a) => !prevActs.has(String(a?.id || "")));
    if (kept.length || !prevTopics.has(topicId)) topicActivities[topicId] = kept;
  }
  const extraTopics = ((overlay.extraTopics as Array<Record<string, unknown>>) || []).filter((t) => !(job.published?.topicIds ?? []).includes(String(t.id)));
  const topicTitles = { ...((overlay.topicTitles as Record<string, string>) || {}) };
  const topicSummaries = { ...((overlay.topicSummaries as Record<string, string>) || {}) };
  for (const id of job.published?.reusedTopicIds ?? []) {
    delete topicTitles[id];
    delete topicSummaries[id];
  }
  const hiddenActivityIds = ((overlay.hiddenActivityIds as string[]) || []).filter((id) => !prevActs.has(id));
  const cleaned = { ...overlay, topicActivities, extraTopics, topicTitles, topicSummaries, hiddenActivityIds };

  const merged = mergeCourseLmsOverlay(
    buildCourseLms({ code: section.course.code, title: section.course.title, session: "", location: "", instructorFirst: "", instructorLast: "" }),
    cleaned,
  );
  const placeholders = merged.topics.filter((t) => /^Topic \d+$/.test(t.title) && t.activities.length === 0).map((t) => t.id);

  const page = (name: string, html: string, extra: Partial<OverlayActivity> = {}): OverlayActivity => ({
    id: newId("act"),
    type: "PAGE",
    name,
    body: sanitizeLessonHtml(html),
    modified: stamp(),
    ...extra,
  });

  const created = { topicIds: [] as string[], reusedTopicIds: [] as string[], activityIds: [] as string[], assignmentIds: [] as string[] };
  const hiddenNew: string[] = [];
  const topicsOut: Array<{ title: string; summary: string; activities: OverlayActivity[] }> = [];

  const overview: OverlayActivity[] = [page(`Course outline — ${bp.course.code} ${bp.course.title}`, renderCourseOutline(bp), { note: `${bp.course.hours} hours · ${bp.modules.length} modules · ${sync ? "synchronous" : "self-paced"}` })];
  if (caseContent) {
    overview.push(page(`Case study — ${caseContent.name}`, renderCaseLearner(caseContent), { note: "Fictional teaching case used throughout the course" }));
    const notes = page(`Instructor case notes — ${caseContent.name} (staff only)`, renderCaseInstructor(caseContent), { hidden: true });
    hiddenNew.push(notes.id);
    overview.push(notes);
  }
  topicsOut.push({ title: "Course overview", summary: bp.course.description, activities: overview });

  if (bp.quizWeight > 0) {
    created.assignmentIds.push(
      await saveLmsAssignment({
        institutionId,
        sectionId: section.id,
        title: `Module quizzes (${quizCode(1)}–${quizCode(bp.modules.length)})`,
        settings: {
          instructions: `Quiz category: total correct answers across all module quizzes ÷ ${bp.modules.length * bp.quizQuestions} × 100. Enter the percentage from the quiz results.`,
          maxScore: 100,
          weightPercent: bp.quizWeight,
          fileSubmissions: false,
          onlineText: false,
        },
        hidden: true,
      }),
    );
  }

  for (const mod of bp.modules) {
    const acts: OverlayActivity[] = [];
    const lessons = mod.lessons.map((lesson) => ({ lesson, content: get<LessonContent>(`lesson-${lesson.id}`) ?? null }));
    for (const { lesson, content } of lessons) {
      const storyboard = content?.storyboard ?? null;
      acts.push(
        page(`${lesson.id} · ${lesson.title}`, renderLesson(bp, mod, lesson, content!), {
          note: storyboard
            ? `${lesson.minutes} min self-study · dynamic AI video lecture · ${storyboard.slides.length} slides`
            : `${lesson.minutes} min · ${sync ? "live session" : "self-study unit"}`,
          ...(storyboard ? { storyboard } : {}),
        }),
      );
    }
    const quiz = get<QuizContent>(`quiz-${mod.id}`) ?? null;
    if (quiz) {
      acts.push({
        id: newId("act"),
        type: "QUIZ",
        name: `Quiz ${quiz.code} · ${mod.title}`,
        body: sanitizeLessonHtml(renderQuizIntro(bp, quiz)),
        note: `${quiz.questions.length} questions · ${quiz.minutes} min · auto-graded, first attempt counts`,
        quiz: { code: quiz.code, minutes: quiz.minutes, questions: quiz.questions },
        modified: stamp(),
      });
    }
    const due = bp.assessments.filter((a) => a.dueModule === mod.id);
    const dueContent = due.map((meta) => ({ meta, content: get<AssessmentContent>(`assessment-${meta.id}`) ?? null }));
    for (const { meta, content } of dueContent) {
      const instructions = assessmentInstructions(bp, meta, content!);
      const settings = { instructions, maxScore: 100, weightPercent: meta.weight, fileSubmissions: true, onlineText: false, maxFiles: 10 };
      const assignmentId = await saveLmsAssignment({ institutionId, sectionId: section.id, title: `${meta.id} · ${meta.title}`, settings, hidden: false });
      created.assignmentIds.push(assignmentId);
      acts.push({
        id: newId("act"),
        type: "ASSIGNMENT",
        name: `${meta.id} · ${meta.title}`,
        description: meta.summary,
        note: `${meta.mode} · ${meta.weight}% · marked out of 100`,
        assignment: settings,
        assignmentId,
        settings: { "Activity instructions": instructions, "Maximum grade": "100", "Course Mark Weight": String(meta.weight), "File submissions": "Yes" },
        modified: stamp(),
      });
    }
    const guide = page(`Instructor guide · ${mod.id} (staff only)`, renderInstructorGuide(bp, mod, lessons, quiz, dueContent), { hidden: true });
    hiddenNew.push(guide.id);
    acts.push(guide);
    topicsOut.push({ title: `${mod.id} · ${mod.title}`, summary: [mod.purpose, mod.milestone ? `Milestone: ${mod.milestone}` : "", `${Math.round(mod.minutes / 6) / 10} hours`].filter(Boolean).join(" "), activities: acts });
  }

  const newExtra = topicsOut.length - Math.min(placeholders.length, topicsOut.length);
  if (extraTopics.length + newExtra > 40) fail("This course already has too many topics to add the generated modules. Remove unused topics first.");
  for (const t of topicsOut) {
    const reuse = placeholders.shift();
    const id = reuse ?? newId("topic");
    if (reuse) {
      topicTitles[id] = t.title;
      topicSummaries[id] = t.summary;
      created.reusedTopicIds.push(id);
    } else {
      extraTopics.push({ id, title: t.title, summary: t.summary, activities: [] });
      created.topicIds.push(id);
    }
    topicActivities[id] = [...(topicActivities[id] || []), ...t.activities];
    created.activityIds.push(...t.activities.map((a) => a.id));
  }

  const next = { ...cleaned, topicActivities, extraTopics, topicTitles, topicSummaries, hiddenActivityIds: [...hiddenActivityIds, ...hiddenNew] };
  await prisma.sisScreenState.upsert({
    where: { institutionId_path: { institutionId, path: overlayPath } },
    create: { institutionId, path: overlayPath, payloadJson: JSON.stringify(next) },
    update: { payloadJson: JSON.stringify(next) },
  });

  job.stage = "published";
  job.published = { at: new Date().toISOString(), by: user.accountId, version: job.version, ...created };
  await writeJob(institutionId, job);
  await prisma.auditEvent.create({
    data: {
      institutionId,
      actorId: user.accountId,
      eventName: "course.ai_course.published",
      purpose: "instructor_mutation",
      afterJson: JSON.stringify({ sectionId: section.id, course: bp.course.code, modules: bp.modules.length, activities: created.activityIds.length, assignments: created.assignmentIds.length }),
      source: "course.ai_course",
      correlationId: randomUUID(),
    },
  });
  return { ...(await getAiCourse(user, path)), publishedSummary: { topics: topicsOut.length, activities: created.activityIds.length, assignments: created.assignmentIds.length } };
}

/** Answer key plus per-student results for a quiz activity, for the staff quiz view. */
export async function aiQuizResults(user: SessionClaims, path: string, activityId: string) {
  const section = await loadSection(user, path);
  const row = await prisma.sisScreenState.findUnique({ where: { institutionId_path: { institutionId: user.institutionId, path: `/instructor/sections/${section.id}` } } });
  const overlay = row ? (JSON.parse(row.payloadJson) as Record<string, unknown>) : null;
  const found =
    findVisibleQuiz(overlay, activityId) ??
    (() => {
      const all = Object.values(((overlay?.topicActivities as Record<string, Array<Record<string, unknown>>>) || {})).flat();
      const activity = all.find((a) => String(a?.id || "") === activityId);
      const quiz = activity ? quizFromActivity(activity) : null;
      return quiz ? { activity, quiz } : null;
    })();
  if (!found) fail("This quiz has no stored questions", 404, "NOT_FOUND");
  return { quiz: found.quiz, ...(await staffQuizResults(user.institutionId, section.id, found.quiz, activityId)) };
}
