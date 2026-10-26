import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { generateWithAi } from "../../lib/ask.js";
import { assertPermission } from "../admin/superAdmin.service.js";
import { S, s, settingsOf } from "../admin/heritage/courses.js";
import { StoryboardSlide, normalizeStoryboard, sanitizeLessonHtml } from "./aiDraftContent.js";
import { isFacultyAssigned } from "./sectionFaculty.js";
import { assertInstitutionAiAllowed } from "../ai/governance-policy.js";

export const AiDraftRequest = z.object({
  path: z.string().min(1),
  topicTitle: z.string().trim().min(1).max(200),
  topicSummary: z.string().max(2000).optional(),
  lessonTitle: z.string().trim().min(3).max(200),
  minutes: z.coerce.number().int().min(5).max(180).default(20),
  slides: z.coerce.number().int().min(3).max(12).default(6),
  existingActivities: z.array(z.string().max(200)).max(60).optional(),
});

const QuizItem = z.object({
  question: z.string().min(1).max(600),
  options: z.array(z.string().max(300)).min(2).max(6),
  answer: z.coerce.number().int().min(0).max(5),
});
const Draft = z.object({
  lesson_html: z.string().min(20),
  quiz: z.array(QuizItem).max(10).default([]),
  storyboard: z.object({ title: z.string().optional(), slides: z.array(StoryboardSlide).min(1).max(14) }),
});

export function extractJson(answer: string) {
  const unfenced = answer.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object");
  return JSON.parse(unfenced.slice(start, end + 1)) as unknown;
}

function sectionIdFromPath(path: string) {
  const direct = /^\/instructor\/sections\/([0-9a-z-]{36})(?:[/?]|$)/i.exec(path)?.[1];
  if (direct) return direct;
  const [pathname, qs = ""] = path.split("?");
  const view = new URLSearchParams(qs).get("view") || "";
  return pathname === "/instructor/f/t56-active-courses" && /^[0-9a-z-]{36}$/i.test(view) ? view : null;
}

export async function loadSectionForDraft(user: SessionClaims, path: string) {
  const sectionId = sectionIdFromPath(path);
  if (!sectionId) throw Object.assign(new Error("Open a course section first"), { status: 400, code: "VALIDATION_ERROR" });
  const section = await prisma.section.findFirst({
    where: { id: sectionId, institutionId: user.institutionId },
    include: { course: true, term: true },
  });
  if (!section) throw Object.assign(new Error("Section not found"), { status: 404, code: "NOT_FOUND" });
  const staff = user.roles.includes("admin") || user.roles.includes("registrar");
  if (staff) {
    await assertPermission(user, "courseManagement", "edit");
  } else if (!(await isFacultyAssigned(user, section))) {
    throw Object.assign(new Error("You do not teach this section"), { status: 403, code: "FORBIDDEN" });
  }
  return section;
}

export async function generateAiDraft(user: SessionClaims, input: z.infer<typeof AiDraftRequest>) {
  await assertInstitutionAiAllowed(user.institutionId, user.roles);
  const section = await loadSectionForDraft(user, input.path);
  const course = (await settingsOf(user.institutionId, S.courseSettings, [section.courseId])).get(section.courseId)?.data ?? {};
  const description = s(course.description).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1500);
  const totalHours = s(course.totalHours);

  const system = `You write university course lessons for MyHeritage College instructors.
Reply with ONLY one JSON object, no prose and no markdown fences, matching:
{"lesson_html": string, "quiz": [{"question": string, "options": [string, string, string, string], "answer": number}], "storyboard": {"title": string, "slides": [{"heading": string, "bullets": [string], "narration": string}]}}
Rules:
- lesson_html: a complete lesson using only <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>. Start with learning objectives, then teach the content, then a short summary.
- quiz: 5 multiple-choice questions on this lesson; "answer" is the 0-based index of the correct option.
- storyboard: a narrated video slideshow of the same lesson; each slide has 2-4 short bullets and 2-4 sentences of spoken narration in plain text.
- Stay within the course and topic given. Do not invent institution policies, dates, grades or names.`;

  const prompt = [
    `Course: ${section.course.code} — ${section.course.title} (${section.course.credits} credits${totalHours ? `, ${totalHours} total hours` : ""}).`,
    description ? `Course description: ${description}` : "",
    section.term ? `Term: ${section.term.name}.` : "",
    `Topic: ${input.topicTitle}.`,
    input.topicSummary?.trim() ? `Topic summary: ${input.topicSummary.replace(/<[^>]*>/g, " ").trim().slice(0, 800)}` : "",
    input.existingActivities?.length ? `Existing activities in this topic: ${input.existingActivities.slice(0, 20).join("; ")}.` : "",
    `Lesson title: ${input.lessonTitle}.`,
    `Target length: about ${input.minutes} minutes of study. Produce exactly ${input.slides} slides.`,
  ]
    .filter(Boolean)
    .join("\n");

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const ai = await generateWithAi(system, attempt ? `${prompt}\nReturn valid JSON only.` : prompt, 150_000, { json: true });
    try {
      const draft = Draft.parse(extractJson(ai.answer));
      const storyboard = normalizeStoryboard(draft.storyboard, input.lessonTitle, input.minutes);
      if (!storyboard) throw new Error("storyboard invalid");
      const quiz = draft.quiz.filter((q) => q.answer < q.options.length);
      await prisma.auditEvent.create({
        data: {
          institutionId: user.institutionId,
          actorId: user.accountId,
          eventName: "course.ai_draft.generated",
          purpose: "instructor_mutation",
          afterJson: JSON.stringify({ sectionId: section.id, course: section.course.code, topic: input.topicTitle, lesson: input.lessonTitle, model: ai.model, slides: storyboard.slides.length, quiz: quiz.length }),
          source: "course.ai_draft",
          correlationId: randomUUID(),
        },
      });
      return {
        lessonTitle: input.lessonTitle,
        lessonHtml: sanitizeLessonHtml(draft.lesson_html),
        quiz,
        storyboard,
        model: ai.model,
        grounding: { course: `${section.course.code} — ${section.course.title}`, hasDescription: Boolean(description), term: section.term?.name ?? null },
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "invalid draft";
    }
  }
  throw Object.assign(new Error(`The AI returned an unusable draft (${lastError}). Please try again.`), { status: 502, code: "AI_BAD_OUTPUT" });
}
