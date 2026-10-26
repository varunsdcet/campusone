import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionClaims } from "@myheritage/contracts";

type Fn = ReturnType<typeof vi.fn>;

const store = vi.hoisted(() => ({
  models: new Map<string, Map<string, Fn>>(),
  screens: new Map<string, string>(),
  assignments: new Map<string, Record<string, unknown>>(),
  defaults: { findMany: [], findFirst: null, findUnique: null, count: 0, deleteMany: { count: 0 }, updateMany: { count: 1 } } as Record<string, unknown>,
}));

const prisma = vi.hoisted(() => {
  const modelProxy = (name: string) =>
    new Proxy(
      {},
      {
        get(_t, method: string) {
          let fns = store.models.get(name);
          if (!fns) store.models.set(name, (fns = new Map()));
          let fn = fns.get(method);
          if (!fn) {
            fn = vi.fn(async (args?: { data?: Record<string, unknown> }) =>
              method in store.defaults ? store.defaults[method] : { id: `${name}-id`, ...(args?.data ?? {}) },
            );
            fns.set(method, fn);
          }
          return fn;
        },
      },
    );
  return new Proxy({} as Record<string, unknown>, {
    get(_t, key: string) {
      if (key === "then") return undefined;
      if (key === "$transaction") return async (run: unknown) => typeof run === "function" ? (run as (tx: unknown) => unknown)(prisma) : Promise.all(run as Promise<unknown>[]);
      return modelProxy(key);
    },
  });
});

vi.mock("@myheritage/db", () => ({ prisma }));
vi.mock("../me/studentAlignment.js", () => ({ currentStudentId: async () => "student-1" }));
vi.mock("./sectionLmsMeta.js", () => ({ sectionLmsMeta: async () => null }));

const ai = vi.hoisted(() => ({ calls: [] as string[], failOnce: new Set<string>() }));
vi.mock("../../lib/ask.js", () => ({
  generateWithAi: vi.fn(async (_system: string, prompt: string) => {
    ai.calls.push(prompt.split("\n")[0]!);
    return { answer: JSON.stringify(fakeAnswer(prompt)), model: "deepseek:test", source: "deepseek" };
  }),
}));

const words = (n: number, seed: string) => Array.from({ length: n }, (_, i) => `${seed}${i % 7}`).join(" ");

function fakeAnswer(prompt: string): unknown {
  if (prompt.startsWith("TASK: Create the course BLUEPRINT")) {
    return {
      description: "Learners deliver an applied consulting project for a fictional client.",
      audience: "Final-term business diploma learners",
      prerequisites: "Program approval",
      outcomes: ["Define the business problem", "Analyse case data", "Recommend and justify a solution", "Communicate results professionally"],
      modules: [1, 2, 3].map((m) => ({
        title: `Module ${m} title`,
        purpose: `Purpose ${m}`,
        topics: ["Topic a", "Topic b"],
        outcomes: [`CLO${m}`, "CLO4"],
        milestone: `Milestone ${m}`,
        lessons: [1, 2].map((l) => ({ title: `Lesson ${m}.${l}`, focus: `Focus ${m}.${l}` })),
      })),
      quiz_weight: 15,
      assessments: [
        { title: "Project charter", mode: "Individual", weight: 25, due_module: 1, outcomes: ["CLO1"], summary: "Charter" },
        { title: "Analysis report", mode: "Team", weight: 30, due_module: 2, outcomes: ["CLO2", "CLO3"], summary: "Report" },
        { title: "Final presentation", mode: "Individual", weight: 30, due_module: 3, outcomes: ["CLO4"], summary: "Pitch" },
      ],
      assumptions: ["Fictional case"],
      approval_required: ["Pass mark"],
    };
  }
  if (prompt.startsWith("TASK: Create ONE fictional organization case")) {
    return {
      name: "Harbour Desk Services",
      synthetic_notice: "Fictional.",
      overview: ["A fictional office-services firm with 40 staff."],
      problem: "Response times are slipping.",
      facts: ["Monthly tickets: 800", "Backlog: 120"],
      instructor_calculations: [
        { label: "Monthly tickets", expression: "420 + 380", result: 800, unit: "tickets" },
        { label: "Backlog share", expression: "120 / 800 * 100", result: 20, unit: "%" },
      ],
    };
  }
  if (prompt.startsWith("TASK: Write the complete learner and instructor material")) {
    const id = /: (M\d\d-L\d\d) "/.exec(prompt)![1]!;
    return {
      objectives: [`Explain ${id}`],
      outcomes: ["CLO1"],
      core_reading: [1, 2, 3, 4].map((i) => `Paragraph ${i} for ${id}. ${words(90, "concept")}`),
      key_learning: ["Key point"],
      worked_example: "Worked example using Harbour Desk figures.",
      common_error: "Confusing symptoms with causes.",
      session_plan: [
        { activity: "Retrieval", minutes: 10 },
        { activity: "Teaching", minutes: 30 },
        { activity: "Workshop", minutes: 50 },
        { activity: "Exit", minutes: 10 },
      ],
      practical_method: ["Step 1", "Step 2"],
      workshop: ["Draft the problem statement"],
      evidence: "Problem statement",
      self_check: [{ question: "What is scope?", model_response: "The agreed boundary." }],
      exit_record: "One sentence on today's decision.",
      glossary: [{ term: "Scope", definition: "Boundary of work" }],
      storyboard: {
        title: `${id} narrated lesson`,
        estimated_duration_sec: 360,
        slides: Array.from({ length: 5 }, (_, i) => ({
          number: i + 1,
          heading: `${id} concept ${i + 1}`,
          bullets: ["Key idea", "Applied example"],
          narration: `This slide explains the approved ${id} lesson concept and its practical application.`,
        })),
      },
      instructor: { facilitation: ["Facilitate"], misconceptions: ["Mistake"], model_answers: ["INSTRUCTOR-MODEL-ANSWER"], feedback: ["Feedback"] },
    };
  }
  if (prompt.startsWith("TASK: Write module quiz")) {
    const count = Number(/exactly (\d+)/.exec(prompt)![1]);
    const mod = /for (M\d\d)/.exec(prompt)![1]!;
    return {
      questions: Array.from({ length: count }, (_, i) => ({
        question: `${mod} question ${i + 1}?`,
        options: [`Correct ${mod}-${i}`, `Wrong A ${i}`, `Wrong B ${i}`, `Wrong C ${i}`],
        answer: 0,
        rationale: `RATIONALE-${mod}-${i}`,
        lesson_id: `${mod}-L01`,
      })),
    };
  }
  if (prompt.startsWith("TASK: Write the complete brief and marking rubric")) {
    return {
      task: ["Complete the task using the case."],
      deliverables: ["Report"],
      submission: "One PDF",
      length: "1,500 words",
      criteria: [
        { name: "Analysis", points: 40, evidence: "Uses data" },
        { name: "Recommendation", points: 30, evidence: "Justified" },
        { name: "Communication", points: 30, evidence: "Clear" },
      ],
      marking_guidance: ["Check figures"],
      integrity: "Own work.",
    };
  }
  throw new Error(`unexpected prompt: ${prompt.slice(0, 80)}`);
}

import {
  aiQuizResults,
  approveAiCourseBlueprint,
  getAiCourse,
  publishAiCourse,
  saveAiCourseBlueprint,
  startAiCourseBlueprint,
} from "./aiCourse.js";
import { submitQuizAttempt } from "./lmsQuiz.js";
import { getStudentCourseLms } from "../student/wave3.service.js";

function fn(model: string, method: string): Fn {
  return (prisma as unknown as Record<string, Record<string, Fn>>)[model]![method]!;
}

const teacher: SessionClaims = {
  sub: "t-sub",
  accountId: "t-account",
  personId: "t-person",
  institutionId: "inst-1",
  roles: ["instructor"],
  sessionId: "t-session",
};
const studentUser: SessionClaims = { ...teacher, sub: "s-sub", accountId: "s-account", personId: "s-person", roles: ["student"] };
const sectionId = "80000000-0000-4000-8000-00000000000a";
const PATH = `/instructor/sections/${sectionId}`;
const section = {
  id: sectionId,
  code: "CAP101-01",
  instructorPersonId: teacher.personId,
  courseId: "course-cap",
  course: { code: "CAP 101", title: "Applied Business Capstone Project", credits: 3 },
  term: null,
  academicBlock: null,
  classSessions: [],
  dayBlocks: [],
  folders: [],
  syllabusTopics: [],
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(check: () => Promise<boolean>, label: string) {
  for (let i = 0; i < 200; i += 1) {
    if (await check()) return;
    await sleep(50);
  }
  throw new Error(`timed out waiting for ${label}`);
}

function overlay() {
  return JSON.parse(store.screens.get(PATH) || "{}") as {
    extraTopics?: Array<{ id: string; title: string }>;
    topicActivities?: Record<string, Array<Record<string, unknown>>>;
    topicTitles?: Record<string, string>;
    hiddenActivityIds?: string[];
  };
}

beforeEach(() => {
  store.models.clear();
  store.screens.clear();
  store.assignments.clear();
  ai.calls.length = 0;
  fn("section", "findFirst").mockResolvedValue(section);
  fn("person", "findFirst").mockResolvedValue({ givenName: "Elena", familyName: "Vance" });
  fn("student", "findFirst").mockResolvedValue({ id: "student-1" });
  fn("enrolment", "findFirst").mockResolvedValue({ id: "enr-1", studentId: "student-1", section });
  fn("enrolment", "findMany").mockResolvedValue([
    { studentId: "student-1", student: { studentNumber: "S0001", person: { givenName: "Ada", familyName: "Lovelace" } } },
  ]);
  const pathOf = (where: { institutionId_path?: { path: string }; path?: unknown }) => where.institutionId_path?.path;
  const matches = (path: string, cond: unknown) => {
    if (typeof cond === "string") return path === cond;
    const c = (cond || {}) as { startsWith?: string; endsWith?: string };
    return (!c.startsWith || path.startsWith(c.startsWith)) && (!c.endsWith || path.endsWith(c.endsWith));
  };
  fn("sisScreenState", "findUnique").mockImplementation(async ({ where }: { where: { institutionId_path: { path: string } } }) => {
    const payloadJson = store.screens.get(pathOf(where)!);
    return payloadJson ? { path: pathOf(where), payloadJson } : null;
  });
  fn("sisScreenState", "findMany").mockImplementation(async ({ where }: { where: { path: unknown } }) =>
    [...store.screens.entries()].filter(([p]) => matches(p, where.path)).map(([path, payloadJson]) => ({ path, payloadJson })),
  );
  fn("sisScreenState", "upsert").mockImplementation(async ({ where, create }: { where: { institutionId_path: { path: string } }; create: { payloadJson: string } }) => {
    store.screens.set(pathOf(where)!, create.payloadJson);
    return {};
  });
  fn("sisScreenState", "create").mockImplementation(async ({ data }: { data: { path: string; payloadJson: string } }) => {
    if (store.screens.has(data.path)) throw Object.assign(new Error("unique"), { code: "P2002" });
    store.screens.set(data.path, data.payloadJson);
    return data;
  });
  fn("sisScreenState", "deleteMany").mockImplementation(async ({ where }: { where: { path: unknown } }) => {
    for (const p of [...store.screens.keys()]) if (matches(p, where.path)) store.screens.delete(p);
    return { count: 1 };
  });
  fn("assignment", "create").mockImplementation(async ({ data }: { data: { id: string } }) => {
    store.assignments.set(data.id, data);
    return data;
  });
  fn("assignment", "deleteMany").mockImplementation(async ({ where }: { where: { id: string } }) => {
    store.assignments.delete(where.id);
    return { count: 1 };
  });
});

async function buildCourse(delivery: "synchronous" | "self_paced" = "synchronous") {
  await startAiCourseBlueprint(teacher, PATH, {
    path: PATH,
    brief: { hours: 12, modules: 3, lessonsPerModule: 2, delivery, quizQuestions: 5, outline: "CAP 101 outline" },
  });
  await waitFor(async () => (await getAiCourse(teacher, PATH)).job?.blueprintTask.status === "done", "blueprint");
  const state = await getAiCourse(teacher, PATH);
  expect(state.checks.every((c) => c.ok)).toBe(true);
  await approveAiCourseBlueprint(teacher, PATH);
  await waitFor(async () => {
    const s = await getAiCourse(teacher, PATH);
    return !s.running && s.items.length > 0 && s.items.every((i) => i.status === "done" || i.status === "failed");
  }, "content generation");
}

describe("AI course builder end to end", () => {
  it("filters restricted sections and activities from the student LMS payload", async () => {
    const otherOnly = JSON.stringify({ match: "all", rules: [{ type: "student", studentIds: ["student-2"] }] });
    store.screens.set(
      PATH,
      JSON.stringify({
        extraTopics: [
          { id: "topic-private", title: "Private section", activities: [] },
          { id: "topic-public", title: "Public section", activities: [] },
        ],
        topicRestrictions: { "topic-private": otherOnly },
        topicActivities: {
          "topic-private": [{ id: "private-page", type: "PAGE", name: "Private page", body: "secret" }],
          "topic-public": [
            { id: "restricted-page", type: "PAGE", name: "Restricted page", body: "secret", settings: { "Access restrictions": otherOnly } },
            { id: "open-page", type: "PAGE", name: "Open page", body: "open" },
          ],
        },
      }),
    );

    const lms = await getStudentCourseLms(studentUser, sectionId);
    expect(lms.topics.some((topic) => topic.id === "topic-private")).toBe(false);
    const publicActivities = lms.topics.find((topic) => topic.id === "topic-public")?.activities || [];
    expect(publicActivities.map((activity) => activity.id)).toEqual(["open-page"]);
  });

  it("publishes narrated video storyboards to self-paced students only", async () => {
    await buildCourse("self_paced");
    const generated = await getAiCourse(teacher, PATH);
    expect(generated.checks.find((check) => check.label === "AI video lectures")).toMatchObject({ ok: true });
    await publishAiCourse(teacher, PATH);
    const lms = await getStudentCourseLms(studentUser, sectionId);
    const visible = lms.topics.flatMap((topic) => topic.activities);
    const lesson = visible.find((activity) => activity.name.startsWith("M01-L01"));
    expect(lesson?.storyboard?.slides).toHaveLength(5);
    expect(lesson?.body).toContain("Learning objectives");
    expect(lesson?.body).toContain("Core reading");
    expect(lesson?.body).toContain("Worked example");
    expect(lesson?.body).toContain("SELF-STUDY PLAN");
    expect(lesson?.body).toContain("Practice activity");
    expect(lesson?.body).toContain("Formative self-check");
    expect(lesson?.body).toContain("Exit record");
    expect(lesson?.body).toContain("Glossary");
    expect(visible.some((activity) => activity.type === "QUIZ" && activity.questions?.length === 5)).toBe(true);
    const assignment = visible.find((activity) => activity.type === "ASSIGNMENT");
    expect(assignment?.assignment?.instructions).toContain("ANALYTIC RUBRIC — 100 POINTS");
    expect(assignment?.assignmentId).toBeTruthy();
    expect(JSON.stringify(lesson)).not.toContain("INSTRUCTOR-MODEL-ANSWER");
  }, 60_000);

  it("generates, publishes, hides answer keys from students and grades one quiz attempt", async () => {
    await buildCourse();
    const generated = await getAiCourse(teacher, PATH);
    expect(generated.items.filter((i) => i.status !== "done")).toEqual([]);
    expect(generated.items).toHaveLength(1 + 6 + 3 + 3);
    expect(generated.checks.filter((c) => !c.ok)).toEqual([]);
    expect(ai.calls.filter((c) => c.startsWith("TASK: Write module quiz"))).toHaveLength(3);

    const published = await publishAiCourse(teacher, PATH);
    expect(published.publishedSummary).toMatchObject({ topics: 4, assignments: 4 });
    const weights = [...store.assignments.values()].map((a) => Number(a.weightPercent));
    expect(weights.reduce((a, b) => a + b, 0)).toBe(100);

    const o = overlay();
    const acts = Object.values(o.topicActivities || {}).flat();
    const guides = acts.filter((a) => String(a.name).startsWith("Instructor guide"));
    expect(guides).toHaveLength(3);
    expect(guides.every((g) => o.hiddenActivityIds!.includes(String(g.id)))).toBe(true);
    expect(String(guides[0]!.body)).toContain("ANSWER KEY");
    const lessonPage = acts.find((a) => String(a.name).startsWith("M01-L02"))!;
    expect(String(lessonPage.body)).toContain("Module quiz Q01");
    expect(String(lessonPage.body)).not.toContain("INSTRUCTOR-MODEL-ANSWER");

    const lms = await getStudentCourseLms(studentUser, sectionId);
    const visible = lms.topics.flatMap((t) => t.activities);
    const studentJson = JSON.stringify(lms);
    expect(visible.some((a) => a.name.startsWith("Instructor guide") || a.name.startsWith("Instructor case notes"))).toBe(false);
    expect(studentJson).not.toMatch(/RATIONALE-|ANSWER KEY|INSTRUCTOR-MODEL-ANSWER|"answer"/);
    const quiz = visible.find((a) => a.type === "QUIZ" && a.name.includes("Q01"))!;
    expect(quiz.questions).toHaveLength(5);
    expect(quiz.quizAttempt).toBeNull();

    const stored = acts.find((a) => a.id === quiz.id)!.quiz as { questions: Array<{ id: string; answer: number }> };
    const answers = Object.fromEntries(stored.questions.map((q, i) => [q.id, i < 4 ? q.answer : (q.answer + 1) % 4]));
    const result = await submitQuizAttempt(studentUser, { id: "student-1" }, sectionId, quiz.id, { answers });
    expect(result).toMatchObject({ score: 4, maxScore: 5 });
    await expect(submitQuizAttempt(studentUser, { id: "student-1" }, sectionId, quiz.id, { answers })).rejects.toMatchObject({ status: 409 });

    const after = await getStudentCourseLms(studentUser, sectionId);
    expect(after.topics.flatMap((t) => t.activities).find((a) => a.id === quiz.id)!.quizAttempt).toMatchObject({ score: 4, maxScore: 5 });
    const staff = await aiQuizResults(teacher, PATH, quiz.id);
    expect(staff).toMatchObject({ submitted: 1, enrolled: 1 });
    expect(staff.students[0]).toMatchObject({ name: "Lovelace, Ada", score: 4 });
  }, 60_000);

  it("republishing replaces the previous publication instead of duplicating it", async () => {
    await buildCourse();
    await publishAiCourse(teacher, PATH);
    const first = Object.values(overlay().topicActivities || {}).flat().length;
    await publishAiCourse(teacher, PATH);
    expect(Object.values(overlay().topicActivities || {}).flat()).toHaveLength(first);
    expect(store.assignments.size).toBe(4);
  }, 60_000);

  it("rejects blueprint edits whose weights do not total 100", async () => {
    await startAiCourseBlueprint(teacher, PATH, { brief: { hours: 12, modules: 3, lessonsPerModule: 2, quizQuestions: 5 } });
    await waitFor(async () => (await getAiCourse(teacher, PATH)).job?.blueprintTask.status === "done", "blueprint");
    await expect(saveAiCourseBlueprint(teacher, PATH, { quizWeight: 30 })).rejects.toMatchObject({ status: 400 });
    const ok = await saveAiCourseBlueprint(teacher, PATH, { quizWeight: 15, description: "Edited" });
    expect(ok.job?.blueprint?.course.description).toBe("Edited");
  }, 30_000);
});
