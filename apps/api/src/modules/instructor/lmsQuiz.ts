import type { SessionClaims } from "@myheritage/contracts";
import { prisma } from "@myheritage/db";
import { writeAuditAndOutbox } from "@myheritage/events";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { studentCanAccessLmsActivity } from "./lmsAccessRestrictions.js";

/** Auto-graded multiple-choice quiz stored on a QUIZ activity in the section overlay. Answer keys never leave staff endpoints. */
export type LmsQuizQuestion = { id: string; text: string; options: string[]; answer: number; rationale?: string; lessonId?: string | null };
export type LmsQuizData = { code: string; minutes: number; questions: LmsQuizQuestion[] };
export type LmsQuizAttempt = {
  studentId: string;
  accountId: string;
  answers: Record<string, number>;
  results: Array<{ id: string; correct: boolean }>;
  score: number;
  maxScore: number;
  submittedAt: string;
};

export function quizFromActivity(activity: unknown): LmsQuizData | null {
  const quiz = (activity as { quiz?: unknown } | null)?.quiz as Partial<LmsQuizData> | undefined;
  if (!quiz || !Array.isArray(quiz.questions) || !quiz.questions.length) return null;
  const questions = quiz.questions.filter(
    (q): q is LmsQuizQuestion =>
      Boolean(q) && typeof q.id === "string" && typeof q.text === "string" && Array.isArray(q.options) && Number.isInteger(q.answer),
  );
  return questions.length ? { code: String(quiz.code || ""), minutes: Number(quiz.minutes) || 0, questions } : null;
}

export function studentQuizQuestions(quiz: LmsQuizData) {
  return quiz.questions.map((q) => ({ id: q.id, text: q.text, answers: q.options, mark: "1.00" }));
}

export const QuizAttemptRequest = z.object({
  answers: z.record(z.string().max(40), z.coerce.number().int().min(-1).max(9)),
});

const attemptPrefix = (sectionId: string, activityId: string) => `/student/lms-quiz/${sectionId}/${activityId}/`;

function httpError(message: string, code: string, status: number) {
  return Object.assign(new Error(message), { code, status });
}

export async function loadSectionOverlay(institutionId: string, sectionId: string) {
  for (const path of [`/instructor/sections/${sectionId}`, `/instructor/f/t56-active-courses?view=${sectionId}`]) {
    const state = await prisma.sisScreenState.findUnique({ where: { institutionId_path: { institutionId, path } } });
    if (state) return JSON.parse(state.payloadJson) as Record<string, unknown>;
  }
  return null;
}

/** The visible QUIZ activity with its edits applied, or null when it is hidden, deleted or has no stored questions. */
export function findVisibleQuiz(overlay: Record<string, unknown> | null, activityId: string) {
  if (!overlay) return null;
  const deleted = new Set(Array.isArray(overlay.deletedActivityIds) ? (overlay.deletedActivityIds as string[]) : []);
  const hidden = new Set(Array.isArray(overlay.hiddenActivityIds) ? (overlay.hiddenActivityIds as string[]) : []);
  if (deleted.has(activityId) || hidden.has(activityId)) return null;
  const topics = (overlay.topicActivities as Record<string, Array<Record<string, unknown>>> | undefined) || {};
  const extra = Array.isArray(overlay.extraTopics) ? (overlay.extraTopics as Array<{ activities?: unknown }>) : [];
  const base = [
    ...Object.values(topics).flat(),
    ...extra.flatMap((t) => (Array.isArray(t?.activities) ? (t.activities as Array<Record<string, unknown>>) : [])),
  ].find((a) => a && String(a.id || "") === activityId);
  if (!base) return null;
  const edit = ((overlay.activityEdits as Record<string, Record<string, unknown>> | undefined) || {})[activityId] || {};
  const merged = { ...base, ...edit };
  if (merged.hidden || String(merged.type || "").toUpperCase() !== "QUIZ") return null;
  const quiz = quizFromActivity(merged);
  return quiz ? { activity: merged, quiz } : null;
}

export function gradeQuiz(quiz: LmsQuizData, answers: Record<string, number>) {
  const results = quiz.questions.map((q) => ({ id: q.id, correct: answers[q.id] === q.answer }));
  return { results, score: results.filter((r) => r.correct).length, maxScore: quiz.questions.length };
}

export async function studentQuizAttempts(institutionId: string, sectionId: string, studentId: string) {
  const rows = await prisma.sisScreenState.findMany({
    where: { institutionId, path: { startsWith: `/student/lms-quiz/${sectionId}/`, endsWith: `/${studentId}` } },
  });
  const out = new Map<string, LmsQuizAttempt>();
  for (const row of rows) {
    const activityId = row.path.split("/")[4];
    if (activityId) out.set(activityId, JSON.parse(row.payloadJson) as LmsQuizAttempt);
  }
  return out;
}

export async function submitQuizAttempt(
  user: SessionClaims,
  student: { id: string },
  sectionId: string,
  activityId: string,
  body: unknown,
  correlationId: string = randomUUID(),
) {
  const input = QuizAttemptRequest.parse(body);
  const enrolment = await prisma.enrolment.findFirst({
    where: { institutionId: user.institutionId, studentId: student.id, sectionId, status: { in: ["enrolled", "completed"] } },
    select: { id: true },
  });
  if (!enrolment) throw httpError("Section not in your enrolment", "NOT_FOUND", 404);
  const overlay = await loadSectionOverlay(user.institutionId, sectionId);
  const found = findVisibleQuiz(overlay, activityId);
  if (!found || !studentCanAccessLmsActivity(overlay, activityId, student.id)) {
    throw httpError("This quiz is not available", "NOT_FOUND", 404);
  }
  const graded = gradeQuiz(found.quiz, input.answers);
  const attempt: LmsQuizAttempt = {
    studentId: student.id,
    accountId: user.accountId,
    answers: Object.fromEntries(found.quiz.questions.map((q) => [q.id, input.answers[q.id] ?? -1])),
    ...graded,
    submittedAt: new Date().toISOString(),
  };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.sisScreenState.create({
        data: { institutionId: user.institutionId, path: `${attemptPrefix(sectionId, activityId)}${student.id}`, payloadJson: JSON.stringify(attempt) },
      });
      await writeAuditAndOutbox(tx, {
        institutionId: user.institutionId,
        actorId: user.accountId,
        eventName: "QuizAttempt.submitted",
        purpose: "assessment",
        before: null,
        after: { sectionId, activityId, studentId: student.id, score: attempt.score, maxScore: attempt.maxScore },
        source: "student.quiz.submit",
        correlationId,
      });
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") throw httpError("You have already submitted this quiz. Only the first attempt is graded.", "CONFLICT", 409);
    throw err;
  }
  return { score: attempt.score, maxScore: attempt.maxScore, submittedAt: attempt.submittedAt, results: attempt.results };
}

export async function staffQuizResults(institutionId: string, sectionId: string, quiz: LmsQuizData, activityId: string) {
  const [enrolments, rows] = await Promise.all([
    prisma.enrolment.findMany({
      where: { institutionId, sectionId, status: { in: ["enrolled", "completed"] } },
      include: { student: { include: { person: true } } },
    }),
    prisma.sisScreenState.findMany({ where: { institutionId, path: { startsWith: attemptPrefix(sectionId, activityId) } } }),
  ]);
  const attempts = new Map(rows.map((r) => {
    const a = JSON.parse(r.payloadJson) as LmsQuizAttempt;
    return [a.studentId, a] as const;
  }));
  const students = enrolments
    .map((e) => {
      const a = attempts.get(e.studentId);
      return {
        studentId: e.studentId,
        name: `${e.student.person.familyName}, ${e.student.person.givenName}`,
        studentNumber: e.student.studentNumber,
        score: a?.score ?? null,
        maxScore: quiz.questions.length,
        submittedAt: a?.submittedAt ?? null,
      };
    })
    .sort((x, y) => x.name.localeCompare(y.name));
  const submitted = [...attempts.values()];
  const questions = quiz.questions.map((q) => {
    const answered = submitted.filter((a) => a.results.some((r) => r.id === q.id));
    const correct = answered.filter((a) => a.results.find((r) => r.id === q.id)?.correct).length;
    return { id: q.id, correctRate: answered.length ? Math.round((correct / answered.length) * 100) : null };
  });
  return { submitted: submitted.length, enrolled: enrolments.length, students, questions };
}
