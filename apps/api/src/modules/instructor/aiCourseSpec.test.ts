import { describe, expect, it } from "vitest";
import {
  CourseBrief,
  applyBlueprintEdits,
  apportion,
  assessmentInstructions,
  blueprintChecks,
  evaluateArithmetic,
  normalizeAssessment,
  normalizeBlueprint,
  normalizeCase,
  normalizeLesson,
  normalizePlan,
  normalizeQuiz,
  renderCourseOutline,
  renderLesson,
  renderQuizIntro,
} from "./aiCourseSpec.js";
import { gradeQuiz, quizFromActivity, studentQuizQuestions } from "./lmsQuiz.js";

const brief = CourseBrief.parse({ hours: 120, modules: 12, lessonsPerModule: 4 });
const course = { code: "CAP 101", title: "Applied Business Capstone Project" };

function rawBlueprint(overrides: Record<string, unknown> = {}) {
  return {
    description: "Learners complete an applied consulting project for a fictional organization.",
    outcomes: ["Define a business problem", "Analyze data", "Recommend a solution", "Communicate findings"],
    modules: Array.from({ length: 12 }, (_, m) => ({
      title: `Module ${m + 1}`,
      purpose: "Purpose",
      outcomes: ["CLO1", `CLO${(m % 4) + 1}`],
      milestone: "Milestone",
      lessons: Array.from({ length: 4 }, (_, l) => ({ title: `Lesson ${m + 1}.${l + 1}`, focus: "Focus" })),
    })),
    quiz_weight: 15,
    assessments: [
      { title: "Project charter", mode: "Individual", weight: 5, due_module: 1, outcomes: ["CLO1"] },
      { title: "Research plan", mode: "Team", weight: 20, due_module: "M03", outcomes: ["CLO2"] },
      { title: "Analysis report", weight: 30, due_module: 8, outcomes: ["CLO2", "CLO3"] },
      { title: "Final presentation", weight: 30, due_module: 12, outcomes: ["CLO3", "CLO4"] },
    ],
    ...overrides,
  };
}

describe("apportion", () => {
  it("always sums exactly to the total", () => {
    expect(apportion([1, 1, 1], 100)).toEqual([34, 33, 33]);
    expect(apportion([5, 15, 30], 85).reduce((a, b) => a + b, 0)).toBe(85);
    expect(apportion([0, 0], 10)).toEqual([5, 5]);
  });
});

describe("normalizeBlueprint", () => {
  it("builds CAP 101 structure: 12 × 4 lessons, 7,200 minutes, weights 100", () => {
    const bp = normalizeBlueprint(rawBlueprint(), brief, course);
    expect(bp.modules).toHaveLength(12);
    expect(bp.modules[0]!.lessons[0]!.id).toBe("M01-L01");
    expect(bp.modules[11]!.lessons[3]!.id).toBe("M12-L04");
    expect(bp.modules.flatMap((m) => m.lessons).every((l) => l.minutes === 150)).toBe(true);
    expect(bp.quizWeight + bp.assessments.reduce((a, x) => a + x.weight, 0)).toBe(100);
    expect(bp.assessments[1]).toMatchObject({ id: "A2", mode: "Team", dueModule: "M03", dueLessonId: "M03-L04" });
    expect(blueprintChecks(bp).every((c) => c.ok)).toBe(true);
    expect(bp.flags).toEqual([]);
  });

  it("rescales weights that do not total 100 and flags it", () => {
    const bp = normalizeBlueprint(rawBlueprint({ quiz_weight: 10, assessments: [{ title: "A", weight: 50 }, { title: "B", weight: 50 }] }), brief, course);
    expect(bp.quizWeight + bp.assessments.reduce((a, x) => a + x.weight, 0)).toBe(100);
    expect(bp.flags.some((f) => f.includes("rescaled"))).toBe(true);
  });

  it("rejects a blueprint with too few modules", () => {
    expect(() => normalizeBlueprint(rawBlueprint({ modules: [] }), brief, course)).toThrow(/modules/);
  });

  it("applies edits only when weights still total 100", () => {
    const bp = normalizeBlueprint(rawBlueprint(), brief, course);
    expect(() => applyBlueprintEdits(bp, { quizWeight: 20 })).toThrow(/100/);
    const next = applyBlueprintEdits(bp, {
      quizWeight: 20,
      assessments: bp.assessments.map((a, i) => ({ title: a.title, mode: a.mode, weight: i === 2 ? a.weight - 5 : a.weight, dueModule: a.dueModule })),
    });
    expect(next.quizWeight + next.assessments.reduce((a, x) => a + x.weight, 0)).toBe(100);
  });

  it("splits uneven hours with at most one minute difference", () => {
    const b = CourseBrief.parse({ hours: 45, modules: 7, lessonsPerModule: 3 });
    const bp = normalizeBlueprint(rawBlueprint({ modules: rawBlueprint().modules.slice(0, 7) }), b, course);
    const mins = bp.modules.flatMap((m) => m.lessons.map((l) => l.minutes));
    expect(mins.reduce((a, x) => a + x, 0)).toBe(45 * 60);
    expect(Math.max(...mins) - Math.min(...mins)).toBeLessThanOrEqual(1);
  });
});

describe("normalizePlan", () => {
  it("forces the plan to the lesson minutes and inserts the module quiz", () => {
    const { plan } = normalizePlan(
      [
        { activity: "Retrieval", minutes: 15 },
        { activity: "Teaching", minutes: 40 },
        { activity: "Workshop", minutes: 60 },
        { activity: "Quiz time", minutes: 30 },
        { activity: "Exit", minutes: 10 },
      ],
      { minutes: 150, delivery: "synchronous", quiz: { code: "Q01", minutes: 20, questions: 10 } },
    );
    expect(plan.reduce((a, r) => a + r.minutes, 0)).toBe(150);
    expect(plan.filter((r) => /quiz/i.test(r.activity))).toEqual([{ activity: "Module quiz Q01 (10 questions)", minutes: 20 }]);
  });

  it("uses the standard self-paced plan when the AI gives none", () => {
    const { plan, flags } = normalizePlan(null, { minutes: 90, delivery: "self_paced" });
    expect(plan.reduce((a, r) => a + r.minutes, 0)).toBe(90);
    expect(plan[0]!.activity).toMatch(/Orientation/);
    expect(flags).toHaveLength(1);
  });

  it("requires a narrated storyboard for self-paced lessons but not synchronous lessons", () => {
    const reading = Array.from({ length: 4 }, (_, i) => `Paragraph ${i} ${"word ".repeat(90)}`);
    const base = { core_reading: reading, objectives: ["Explain the workflow"], workshop: ["Complete the practice task"] };
    expect(() =>
      normalizeLesson(base, { id: "M01-L01", title: "Workflow", minutes: 90, delivery: "self_paced", validOutcomes: ["CLO1"] }),
    ).toThrow(/video storyboard/);
    const selfPaced = normalizeLesson(
      {
        ...base,
        storyboard: {
          title: "Workflow lecture",
          slides: Array.from({ length: 5 }, (_, i) => ({ heading: `Step ${i + 1}`, bullets: ["Key point", "Applied example"], narration: "This lesson explains the approved workflow and shows how to apply it safely." })),
        },
      },
      { id: "M01-L01", title: "Workflow", minutes: 90, delivery: "self_paced", validOutcomes: ["CLO1"] },
    );
    expect(selfPaced.storyboard?.slides).toHaveLength(5);
    const synchronous = normalizeLesson(base, { id: "M01-L01", title: "Workflow", minutes: 90, delivery: "synchronous", validOutcomes: ["CLO1"] });
    expect(synchronous.storyboard).toBeNull();
  });
});

describe("normalizeQuiz", () => {
  const questions = Array.from({ length: 12 }, (_, i) => ({
    question: `Question ${i}?`,
    options: [`Right ${i}`, `Wrong a ${i}`, `Wrong b ${i}`, `Wrong c ${i}`],
    answer: i % 2 ? "A" : 0,
    rationale: "Because",
    lesson_id: "M01-L02",
  }));

  it("keeps exactly N valid questions and the correct option survives re-ordering", () => {
    const quiz = normalizeQuiz({ questions }, { moduleNumber: 1, moduleTitle: "Intro", count: 10, minutes: 20, lessonIds: ["M01-L01", "M01-L02"] });
    expect(quiz.questions).toHaveLength(10);
    expect(quiz.questions[0]!.id).toBe("Q01-01");
    quiz.questions.forEach((q, i) => expect(q.options[q.answer]).toBe(`Right ${i}`));
    expect(new Set(quiz.questions.map((q) => q.answer)).size).toBeGreaterThan(1);
  });

  it("spreads answers across A–D and varies the key between generations of the same module", () => {
    const ctx = { moduleNumber: 1, moduleTitle: "Intro", count: 10, minutes: 20, lessonIds: [] };
    const keys = [11, 22, 33, 44].map((seed) => normalizeQuiz({ questions }, { ...ctx, seed }).questions.map((q) => q.answer));
    for (const key of keys) expect(Math.max(...[0, 1, 2, 3].map((n) => key.filter((k) => k === n).length))).toBeLessThanOrEqual(3);
    expect(new Set(keys.map((k) => k.join(""))).size).toBeGreaterThan(1);
  });

  it("drops malformed and duplicate questions, then fails when too few remain", () => {
    const bad = [questions[0], questions[0], { question: "x", options: ["a", "b"], answer: 0 }, { question: "y", options: ["a", "a", "b", "c"], answer: 0 }];
    expect(() => normalizeQuiz({ questions: bad }, { moduleNumber: 2, moduleTitle: "T", count: 5, minutes: 10, lessonIds: [] })).toThrow(/only 1 valid/);
  });

  it("never sends answers to students and grades the first attempt correctly", () => {
    const quiz = normalizeQuiz({ questions }, { moduleNumber: 3, moduleTitle: "T", count: 10, minutes: 20, lessonIds: [] });
    const stored = quizFromActivity({ quiz: { code: quiz.code, minutes: quiz.minutes, questions: quiz.questions } })!;
    const view = studentQuizQuestions(stored);
    expect(JSON.stringify(view)).not.toMatch(/"answer"|rationale/);
    const answers = Object.fromEntries(stored.questions.map((q, i) => [q.id, i < 7 ? q.answer : (q.answer + 1) % 4]));
    expect(gradeQuiz(stored, answers)).toMatchObject({ score: 7, maxScore: 10 });
  });
});

describe("case arithmetic", () => {
  it("evaluates safely and corrects wrong AI totals", () => {
    expect(evaluateArithmetic("(1,200 - 950) ÷ 1,200 × 100")).toBeCloseTo(20.833, 2);
    expect(evaluateArithmetic("process.exit()")).toBeNaN();
    const c = normalizeCase({
      name: "Harbour Desk Services",
      overview: ["A fictional office-services firm."],
      instructor_calculations: [
        { label: "Monthly tickets", expression: "420 + 380", result: 800 },
        { label: "Backlog share", expression: "120 / 800 * 100", result: 20 },
      ],
    });
    expect(c.calculations[0]).toMatchObject({ result: 800, corrected: false });
    expect(c.calculations[1]).toMatchObject({ result: 15, corrected: true });
    expect(c.flags).toHaveLength(1);
  });
});

describe("assessments and rendering", () => {
  it("rescales rubric points to exactly 100", () => {
    const a = normalizeAssessment(
      { task: ["Do the work"], criteria: [{ name: "A", points: 30 }, { name: "B", points: 30 }, { name: "C", points: 30 }] },
      { id: "A1", title: "Charter" },
    );
    expect(a.criteria.reduce((s, c) => s + c.points, 0)).toBe(100);
    expect(a.flags).toHaveLength(1);
  });

  it("renders learner pages without answer keys and only allowed tags", () => {
    const bp = normalizeBlueprint(rawBlueprint(), brief, course);
    const mod = bp.modules[0]!;
    const lesson = mod.lessons[3]!;
    const reading = Array.from({ length: 4 }, (_, i) => `Paragraph ${i} ${"word ".repeat(90)}`);
    const content = normalizeLesson(
      { core_reading: reading, objectives: ["Explain scope"], workshop: ["Draft a charter"], outcomes: ["CLO1"] },
      { id: lesson.id, title: lesson.title, minutes: lesson.minutes, delivery: "synchronous", validOutcomes: ["CLO1"], quiz: { code: "Q01", minutes: 20, questions: 10 } },
    );
    expect(content.plan.reduce((s, r) => s + r.minutes, 0)).toBe(150);
    const html = renderLesson(bp, mod, lesson, content) + renderCourseOutline(bp);
    const tags = new Set([...html.matchAll(/<\/?([a-z0-9]+)/gi)].map((m) => m[1]!.toLowerCase()));
    const allowed = new Set(["h2", "h3", "h4", "p", "ul", "ol", "li", "strong", "b", "em", "i", "br", "blockquote", "table", "thead", "tbody", "tr", "th", "td", "details", "summary", "code"]);
    expect([...tags].filter((t) => !allowed.has(t))).toEqual([]);
    expect(renderCourseOutline(bp)).toContain("100%");

    const quiz = normalizeQuiz(
      { questions: Array.from({ length: 10 }, (_, i) => ({ question: `Q${i}?`, options: [`r${i}`, `a${i}`, `b${i}`, `c${i}`], answer: 0, rationale: "SECRET-RATIONALE" })) },
      { moduleNumber: 1, moduleTitle: mod.title, count: 10, minutes: 20, lessonIds: [] },
    );
    expect(renderQuizIntro(bp, quiz)).not.toContain("SECRET-RATIONALE");
  });

  it("writes plain-text assignment instructions with the rubric total", () => {
    const bp = normalizeBlueprint(rawBlueprint(), brief, course);
    const a = normalizeAssessment(
      { task: ["Do it"], criteria: [{ name: "A", points: 40 }, { name: "B", points: 30 }, { name: "C", points: 30 }] },
      { id: "A1", title: "Charter" },
    );
    const text = assessmentInstructions(bp, bp.assessments[0]!, a);
    expect(text).not.toMatch(/<[a-z]/i);
    expect(text).toContain("100");
    expect(text).toContain("End of M01");
  });
});
