import { z } from "zod";
import { normalizeStoryboard, type AiDraftStoryboard } from "./aiDraftContent.js";

/**
 * AI course builder — the structure every generated course must satisfy (modelled on the CAP 101 pack:
 * program outline, learner manual lessons, module quizzes, assessment briefs with 100-point rubrics and
 * instructor-only guides). The AI drafts text; these functions own every number, ID and total.
 */

export type Delivery = "synchronous" | "self_paced";

export const MAX_TOTAL_LESSONS = 96;

export const CourseBrief = z
  .object({
    hours: z.coerce.number().int().min(1).max(600),
    modules: z.coerce.number().int().min(1).max(24),
    lessonsPerModule: z.coerce.number().int().min(1).max(8),
    delivery: z.enum(["synchronous", "self_paced"]).default("synchronous"),
    deliveryMethod: z.string().trim().max(120).default("Distance / online"),
    breakdown: z.string().trim().max(200).default("100% online"),
    audience: z.string().trim().max(600).default(""),
    includeCase: z.coerce.boolean().default(true),
    quizQuestions: z.coerce.number().int().min(5).max(20).default(10),
    outline: z.string().max(40_000).default(""),
    notes: z.string().max(4_000).default(""),
  })
  .refine((b) => b.modules * b.lessonsPerModule <= MAX_TOTAL_LESSONS, {
    message: `Keep modules × lessons per module at or below ${MAX_TOTAL_LESSONS}`,
    path: ["lessonsPerModule"],
  })
  .refine((b) => (b.hours * 60) / (b.modules * b.lessonsPerModule) >= 20, {
    message: "Each lesson needs at least 20 minutes — reduce modules or lessons, or increase hours",
    path: ["hours"],
  });
export type CourseBrief = z.infer<typeof CourseBrief>;

export type BlueprintLesson = {
  id: string;
  number: number;
  title: string;
  focus: string;
  minutes: number;
};

export type BlueprintModule = {
  id: string;
  number: number;
  title: string;
  purpose: string;
  topics: string[];
  milestone: string;
  outcomes: string[];
  minutes: number;
  lessons: BlueprintLesson[];
};

export type BlueprintAssessment = {
  id: string;
  title: string;
  mode: "Individual" | "Team";
  weight: number;
  dueModule: string;
  dueLessonId: string;
  outcomes: string[];
  summary: string;
};

export type Blueprint = {
  course: {
    code: string;
    title: string;
    hours: number;
    totalMinutes: number;
    delivery: Delivery;
    deliveryMethod: string;
    breakdown: string;
    description: string;
    audience: string;
    prerequisites: string;
  };
  outcomes: Array<{ id: string; text: string }>;
  modules: BlueprintModule[];
  quizWeight: number;
  quizQuestions: number;
  quizMinutes: number;
  assessments: BlueprintAssessment[];
  assumptions: string[];
  approvalRequired: string[];
  flags: string[];
};

export type Check = { label: string; ok: boolean; detail: string };

const pad2 = (n: number) => String(n).padStart(2, "0");
export const moduleId = (n: number) => `M${pad2(n)}`;
export const lessonId = (m: number, l: number) => `${moduleId(m)}-L${pad2(l)}`;
export const quizCode = (m: number) => `Q${pad2(m)}`;

export function plainText(value: unknown, max = 4000): string {
  if (value == null) return "";
  const text = typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim()
    .slice(0, max);
}

function textList(value: unknown, maxItems: number, maxLen = 600): string[] {
  const arr = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\n+/) : [];
  return arr
    .map((v) => (v && typeof v === "object" ? plainText((v as Record<string, unknown>).text ?? (v as Record<string, unknown>).title, maxLen) : plainText(v, maxLen)))
    .map((v) => v.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, ""))
    .filter(Boolean)
    .slice(0, maxItems);
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[%\s,]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

/** Whole-number shares of `total` proportional to `weights` (largest-remainder), always summing exactly to `total`. */
export function apportion(weights: number[], total: number): number[] {
  if (!weights.length) return [];
  const safe = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const sum = safe.reduce((a, b) => a + b, 0);
  const basis = sum > 0 ? safe : safe.map(() => 1);
  const basisSum = basis.reduce((a, b) => a + b, 0);
  const exact = basis.map((w) => (w / basisSum) * total);
  const floors = exact.map(Math.floor);
  let remainder = total - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => ({ i, frac: e - Math.floor(e) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; remainder > 0 && k < order.length; k += 1, remainder -= 1) floors[order[k]!.i] += 1;
  return floors;
}

/** Splits total course minutes across every lesson; differences are at most one minute. */
export function lessonMinutesPlan(totalMinutes: number, count: number): number[] {
  return apportion(Array.from({ length: count }, () => 1), totalMinutes);
}

function outcomeRefs(value: unknown, valid: Set<string>): string[] {
  const out = new Set<string>();
  for (const raw of arr(value).length ? arr(value) : String(value ?? "").split(/[\s,;]+/)) {
    const m = /(?:CLO)?\s*(\d{1,2})/i.exec(String(raw ?? ""));
    if (!m) continue;
    const id = `CLO${Number(m[1])}`;
    if (valid.has(id)) out.add(id);
  }
  return [...out];
}

/** Turns the model's blueprint draft into the approved structure; throws when the outline is structurally unusable. */
export function normalizeBlueprint(raw: unknown, brief: CourseBrief, course: { code: string; title: string }): Blueprint {
  const root = obj(raw);
  const flags: string[] = [];
  const totalMinutes = brief.hours * 60;

  const outcomes = textList(root.outcomes ?? root.course_learning_outcomes, 10, 400).map((text, i) => ({ id: `CLO${i + 1}`, text }));
  if (outcomes.length < 3) throw new Error(`blueprint has ${outcomes.length} learning outcomes (need at least 3)`);
  const validClo = new Set(outcomes.map((o) => o.id));

  const rawModules = arr(root.modules);
  if (rawModules.length < brief.modules) throw new Error(`blueprint has ${rawModules.length} modules (need ${brief.modules})`);
  if (rawModules.length > brief.modules) flags.push(`The AI proposed ${rawModules.length} modules; only the first ${brief.modules} were kept.`);

  const minutes = lessonMinutesPlan(totalMinutes, brief.modules * brief.lessonsPerModule);
  const modules: BlueprintModule[] = rawModules.slice(0, brief.modules).map((rm, mi) => {
    const m = obj(rm);
    const rawLessons = arr(m.lessons ?? m.sessions);
    if (rawLessons.length < brief.lessonsPerModule) {
      throw new Error(`module ${mi + 1} has ${rawLessons.length} lessons (need ${brief.lessonsPerModule})`);
    }
    const lessons = rawLessons.slice(0, brief.lessonsPerModule).map((rl, li) => {
      const l = obj(rl);
      const title = plainText(typeof rl === "string" ? rl : l.title, 160);
      if (!title) throw new Error(`lesson ${lessonId(mi + 1, li + 1)} has no title`);
      return {
        id: lessonId(mi + 1, li + 1),
        number: mi * brief.lessonsPerModule + li + 1,
        title,
        focus: plainText(l.focus ?? l.summary ?? l.description, 400),
        minutes: minutes[mi * brief.lessonsPerModule + li]!,
      };
    });
    const title = plainText(m.title, 160);
    if (!title) throw new Error(`module ${mi + 1} has no title`);
    let refs = outcomeRefs(m.outcomes ?? m.clos, validClo);
    if (!refs.length) {
      refs = [outcomes[mi % outcomes.length]!.id];
      flags.push(`${moduleId(mi + 1)} had no valid outcome links; linked to ${refs[0]} for review.`);
    }
    return {
      id: moduleId(mi + 1),
      number: mi + 1,
      title,
      purpose: plainText(m.purpose ?? m.summary, 600),
      topics: textList(m.topics, 10, 200),
      milestone: plainText(m.milestone ?? m.deliverable ?? m.main_output, 400),
      outcomes: refs,
      minutes: lessons.reduce((a, l) => a + l.minutes, 0),
      lessons,
    };
  });

  const quizWeightRaw = num(root.quiz_weight ?? root.quizWeight);
  const proposed = arr(root.assessments ?? root.assessment_blueprint)
    .map(obj)
    .filter((a) => plainText(a.title ?? a.name, 200));
  if (!proposed.length) throw new Error("blueprint has no assessments");
  if (proposed.length > 16) flags.push("More than 16 assessments were proposed; extras were dropped.");
  const rawAssessments = proposed.slice(0, 16);
  const quizWeight = Number.isFinite(quizWeightRaw) && quizWeightRaw >= 0 && quizWeightRaw <= 40 ? Math.round(quizWeightRaw) : 10;
  if (!(Number.isFinite(quizWeightRaw) && quizWeightRaw >= 0 && quizWeightRaw <= 40)) flags.push("Quiz category weight was missing or out of range; set to 10%.");

  const rawWeights = rawAssessments.map((a) => num(a.weight ?? a.weight_percent));
  const rawTotal = rawWeights.reduce((s, w) => s + (Number.isFinite(w) && w > 0 ? w : 0), 0) + quizWeight;
  const weights = apportion(rawWeights, 100 - quizWeight);
  if (Math.abs(rawTotal - 100) > 0.001 || rawWeights.some((w) => !Number.isFinite(w) || w <= 0 || !Number.isInteger(w))) {
    flags.push(`Assessment weights totalled ${Math.round(rawTotal * 100) / 100}%; rescaled so quizzes plus assessments total exactly 100%.`);
  }

  const assessments: BlueprintAssessment[] = rawAssessments.map((a, i) => {
    const dueNumber = Math.min(brief.modules, Math.max(1, Math.round(num(String(a.due_module ?? a.dueModule ?? "").replace(/^M/i, ""))) || brief.modules));
    const mod = modules[dueNumber - 1]!;
    let refs = outcomeRefs(a.outcomes ?? a.clos, validClo);
    if (!refs.length) refs = mod.outcomes.slice(0, 2);
    return {
      id: `A${i + 1}`,
      title: plainText(a.title ?? a.name, 160),
      mode: /team|group/i.test(String(a.mode ?? a.type ?? "")) ? "Team" : "Individual",
      weight: weights[i]!,
      dueModule: mod.id,
      dueLessonId: mod.lessons[mod.lessons.length - 1]!.id,
      outcomes: refs,
      summary: plainText(a.summary ?? a.purpose ?? a.deliverable, 600),
    };
  });

  const blueprint: Blueprint = {
    course: {
      code: course.code,
      title: course.title,
      hours: brief.hours,
      totalMinutes,
      delivery: brief.delivery,
      deliveryMethod: brief.deliveryMethod || "Distance / online",
      breakdown: brief.breakdown || "100% online",
      description: plainText(root.description ?? root.course_description, 1500),
      audience: plainText(root.audience, 400) || brief.audience,
      prerequisites: plainText(root.prerequisites, 400) || "Requires institutional approval",
    },
    outcomes,
    modules,
    quizWeight,
    quizQuestions: brief.quizQuestions,
    quizMinutes: brief.quizQuestions * 2,
    assessments,
    assumptions: textList(root.assumptions, 12, 400),
    approvalRequired: textList(root.approval_required ?? root.approvalRequired, 12, 400),
    flags,
  };
  if (!blueprint.approvalRequired.length) {
    blueprint.approvalRequired = [
      "Entry requirements, credit status and calendar",
      "Pass mark, attendance, late-work and reassessment rules",
      "Accessibility accommodations and AI/tool-use rules",
    ];
  }
  return blueprint;
}

/** Applies teacher edits (titles, focus, weights, modes) and re-runs every total. */
export const BlueprintEdits = z.object({
  description: z.string().max(1500).optional(),
  outcomes: z.array(z.string().max(400)).max(10).optional(),
  modules: z
    .array(
      z.object({
        title: z.string().max(160),
        purpose: z.string().max(600).optional(),
        milestone: z.string().max(400).optional(),
        lessons: z.array(z.object({ title: z.string().max(160), focus: z.string().max(400).optional() })),
      }),
    )
    .optional(),
  quizWeight: z.coerce.number().int().min(0).max(40).optional(),
  assessments: z
    .array(
      z.object({
        title: z.string().max(160),
        mode: z.enum(["Individual", "Team"]),
        weight: z.coerce.number().int().min(1).max(100),
        dueModule: z.string().max(4),
        summary: z.string().max(600).optional(),
      }),
    )
    .max(16)
    .optional(),
});

export function applyBlueprintEdits(bp: Blueprint, edits: z.infer<typeof BlueprintEdits>): Blueprint {
  const next: Blueprint = JSON.parse(JSON.stringify(bp)) as Blueprint;
  if (edits.description !== undefined) next.course.description = plainText(edits.description, 1500);
  if (edits.outcomes) {
    if (edits.outcomes.length !== next.outcomes.length) throw Object.assign(new Error("Outcome count cannot change"), { status: 400 });
    next.outcomes = next.outcomes.map((o, i) => ({ ...o, text: plainText(edits.outcomes![i], 400) || o.text }));
  }
  if (edits.modules) {
    if (edits.modules.length !== next.modules.length) throw Object.assign(new Error("Module count cannot change"), { status: 400 });
    next.modules = next.modules.map((m, mi) => {
      const e = edits.modules![mi]!;
      if (e.lessons.length !== m.lessons.length) throw Object.assign(new Error(`${m.id}: lesson count cannot change`), { status: 400 });
      return {
        ...m,
        title: plainText(e.title, 160) || m.title,
        purpose: e.purpose !== undefined ? plainText(e.purpose, 600) : m.purpose,
        milestone: e.milestone !== undefined ? plainText(e.milestone, 400) : m.milestone,
        lessons: m.lessons.map((l, li) => ({
          ...l,
          title: plainText(e.lessons[li]!.title, 160) || l.title,
          focus: e.lessons[li]!.focus !== undefined ? plainText(e.lessons[li]!.focus, 400) : l.focus,
        })),
      };
    });
  }
  if (edits.quizWeight !== undefined) next.quizWeight = edits.quizWeight;
  if (edits.assessments) {
    if (!edits.assessments.length) throw Object.assign(new Error("Keep at least one assessment"), { status: 400 });
    next.assessments = edits.assessments.map((a, i) => {
      const prev = next.assessments[i];
      const mod = next.modules.find((m) => m.id === a.dueModule) || next.modules[next.modules.length - 1]!;
      return {
        id: `A${i + 1}`,
        title: plainText(a.title, 160) || prev?.title || `Assessment ${i + 1}`,
        mode: a.mode,
        weight: a.weight,
        dueModule: mod.id,
        dueLessonId: mod.lessons[mod.lessons.length - 1]!.id,
        outcomes: prev?.outcomes?.length ? prev.outcomes : mod.outcomes.slice(0, 2),
        summary: a.summary !== undefined ? plainText(a.summary, 600) : prev?.summary || "",
      };
    });
  }
  const total = next.quizWeight + next.assessments.reduce((s, a) => s + a.weight, 0);
  if (total !== 100) throw Object.assign(new Error(`Weights must total 100% (quizzes ${next.quizWeight}% + assessments now total ${total}%)`), { status: 400 });
  return next;
}

export function blueprintChecks(bp: Blueprint): Check[] {
  const lessons = bp.modules.flatMap((m) => m.lessons);
  const minutes = lessons.reduce((a, l) => a + l.minutes, 0);
  const weights = bp.quizWeight + bp.assessments.reduce((a, x) => a + x.weight, 0);
  const ids = lessons.map((l) => l.id);
  const taught = new Set(bp.modules.flatMap((m) => m.outcomes));
  const assessed = new Set(bp.assessments.flatMap((a) => a.outcomes));
  const untaught = bp.outcomes.filter((o) => !taught.has(o.id)).map((o) => o.id);
  const unassessed = bp.outcomes.filter((o) => !assessed.has(o.id)).map((o) => o.id);
  return [
    { label: "Instructional time", ok: minutes === bp.course.totalMinutes, detail: `${minutes} of ${bp.course.totalMinutes} minutes (${bp.course.hours} h) scheduled across ${lessons.length} lessons` },
    { label: "Structure", ok: new Set(ids).size === ids.length, detail: `${bp.modules.length} modules × ${bp.modules[0]?.lessons.length ?? 0} lessons, unique IDs` },
    { label: "Assessment weights", ok: weights === 100, detail: `Quizzes ${bp.quizWeight}% + ${bp.assessments.length} assessments = ${weights}%` },
    { label: "Outcomes taught", ok: untaught.length === 0, detail: untaught.length ? `Not linked to any module: ${untaught.join(", ")}` : "Every outcome is linked to at least one module" },
    { label: "Outcomes assessed", ok: unassessed.length === 0, detail: unassessed.length ? `Not assessed: ${unassessed.join(", ")}` : "Every outcome is assessed at least once" },
  ];
}

/* ------------------------------------------------------------------ Shared case ------------------------------------------------------------------ */

export type CaseCalc = { label: string; expression: string; result: number; unit: string; corrected: boolean };
export type CourseCase = {
  name: string;
  notice: string;
  overview: string[];
  problem: string;
  offerings: string[];
  segments: string[];
  operations: string;
  tables: Array<{ title: string; columns: string[]; rows: string[][] }>;
  interviews: Array<{ id: string; role: string; quote: string; prompt: string }>;
  options: Array<{ id: string; title: string; summary: string }>;
  constraints: string[];
  limitations: string[];
  facts: Array<{ id: string; fact: string }>;
  calculations: CaseCalc[];
  flags: string[];
};

/** Evaluates + − × ÷ and parentheses over plain numbers; returns NaN for anything else. */
export function evaluateArithmetic(expression: string): number {
  const src = expression.replace(/[×x]/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/(\d),(?=\d{3}\b)/g, "$1").replace(/\s+/g, "");
  if (!src || !/^[\d.+\-*/()]+$/.test(src)) return NaN;
  let pos = 0;
  const peek = () => src[pos];
  function factor(): number {
    if (peek() === "-") {
      pos += 1;
      return -factor();
    }
    if (peek() === "+") {
      pos += 1;
      return factor();
    }
    if (peek() === "(") {
      pos += 1;
      const v = expr();
      if (peek() !== ")") throw new Error("paren");
      pos += 1;
      return v;
    }
    const m = /^\d+(?:\.\d+)?/.exec(src.slice(pos));
    if (!m) throw new Error("number");
    pos += m[0].length;
    return Number(m[0]);
  }
  function term(): number {
    let v = factor();
    while (peek() === "*" || peek() === "/") {
      const op = src[pos++];
      const r = factor();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function expr(): number {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = src[pos++];
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  try {
    const v = expr();
    return pos === src.length && Number.isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function normalizeCase(raw: unknown): CourseCase {
  const root = obj(raw);
  const name = plainText(root.name ?? root.company ?? root.title, 120);
  if (!name) throw new Error("case has no organization name");
  const overview = textList(root.overview ?? root.profile, 6, 1200);
  if (!overview.length) throw new Error("case has no overview");
  const flags: string[] = [];
  const tables = arr(root.data_tables ?? root.tables)
    .map(obj)
    .map((t) => {
      const columns = arr(t.columns).map((c) => plainText(c, 60)).filter(Boolean).slice(0, 10);
      const rows = arr(t.rows)
        .slice(0, 30)
        .map((r) => arr(r).slice(0, columns.length).map((c) => plainText(c, 120)));
      return { title: plainText(t.title, 160), columns, rows: rows.filter((r) => r.length === columns.length) };
    })
    .filter((t) => t.title && t.columns.length && t.rows.length)
    .slice(0, 6);
  const calculations = arr(root.instructor_calculations ?? root.calculations)
    .map(obj)
    .map((c) => {
      const expression = plainText(c.expression, 200);
      const stated = num(c.result);
      const computed = evaluateArithmetic(expression);
      const label = plainText(c.label ?? c.check, 200);
      if (!label || !Number.isFinite(computed)) return null;
      const corrected = !Number.isFinite(stated) || Math.abs(stated - computed) > 0.01;
      if (corrected) flags.push(`${label}: the AI stated ${Number.isFinite(stated) ? stated : "no result"}; recalculated as ${round2(computed)}.`);
      return { label, expression, result: round2(computed), unit: plainText(c.unit, 30), corrected };
    })
    .filter((c): c is CaseCalc => Boolean(c))
    .slice(0, 20);
  return {
    name,
    notice: plainText(root.synthetic_notice ?? root.notice, 400) || "Entirely fictional teaching case. All organizations, people, records and figures are invented for classroom analysis.",
    overview,
    problem: plainText(root.problem ?? root.business_problem, 1200),
    offerings: textList(root.products ?? root.offerings, 8, 300),
    segments: textList(root.customer_segments ?? root.segments, 8, 300),
    operations: plainText(root.operations ?? root.current_process, 1500),
    tables,
    interviews: arr(root.interviews)
      .map(obj)
      .map((x, i) => ({
        id: `INT${pad2(i + 1)}`,
        role: plainText(x.role, 120),
        quote: plainText(x.quote ?? x.extract, 800),
        prompt: plainText(x.analyze ?? x.prompt, 300),
      }))
      .filter((x) => x.quote)
      .slice(0, 8),
    options: arr(root.options ?? root.improvement_options)
      .map(obj)
      .map((x, i) => ({ id: `OPT${i + 1}`, title: plainText(x.title, 160), summary: plainText(x.summary ?? x.description, 600) }))
      .filter((x) => x.title)
      .slice(0, 5),
    constraints: textList(root.constraints, 10, 300),
    limitations: textList(root.limitations ?? root.data_limitations, 10, 300),
    facts: textList(root.facts ?? root.fact_register, 30, 300).map((fact, i) => ({ id: `F${pad2(i + 1)}`, fact })),
    calculations,
    flags,
  };
}

/** Compact fact sheet passed to every later generation so numbers stay consistent. */
export function caseBrief(c: CourseCase | null): string {
  if (!c) return "";
  const lines = [
    `Shared course case: ${c.name} (synthetic).`,
    c.overview.join(" "),
    c.problem ? `Problem: ${c.problem}` : "",
    ...c.facts.map((f) => `${f.id}: ${f.fact}`),
    ...c.calculations.map((x) => `Verified: ${x.label} = ${x.result}${x.unit ? ` ${x.unit}` : ""} (${x.expression})`),
  ];
  return lines.filter(Boolean).join("\n").slice(0, 6000);
}

/* ------------------------------------------------------------------ Lessons ------------------------------------------------------------------ */

export type LessonContent = {
  id: string;
  title: string;
  minutes: number;
  objectives: string[];
  outcomes: string[];
  reading: string[];
  keyLearning: string[];
  workedExample: string;
  commonError: string;
  plan: Array<{ activity: string; minutes: number }>;
  method: string[];
  workshop: string[];
  evidence: string;
  selfCheck: Array<{ question: string; answer: string }>;
  exitRecord: string;
  glossary: Array<{ term: string; definition: string }>;
  /** Generated only for self-paced delivery; synchronous/offline courses remain text-led. */
  storyboard: AiDraftStoryboard | null;
  instructor: { facilitation: string[]; misconceptions: string[]; modelAnswers: string[]; feedback: string[] };
  flags: string[];
};

const DEFAULT_PLAN: Record<Delivery, Array<[string, number]>> = {
  synchronous: [
    ["Retrieval and decision briefing", 15],
    ["Live concept teaching with slides", 35],
    ["Guided reading and annotation", 20],
    ["Worked case and discussion", 25],
    ["Supervised applied workshop", 45],
    ["Exit evidence and reflection", 10],
  ],
  self_paced: [
    ["Orientation and learning objectives", 10],
    ["Core reading and note-making", 45],
    ["Worked example study", 20],
    ["Applied practice activity", 45],
    ["Formative self-check", 15],
    ["Reflection and exit record", 15],
  ],
};

/** Session minute table that always sums to the lesson's minutes and reserves the module quiz in the last lesson. */
export function normalizePlan(
  raw: unknown,
  ctx: { minutes: number; delivery: Delivery; quiz?: { code: string; minutes: number; questions: number } },
): { plan: Array<{ activity: string; minutes: number }>; flags: string[] } {
  const flags: string[] = [];
  let rows = arr(raw)
    .map(obj)
    .map((r) => ({ activity: plainText(r.activity ?? r.component ?? r.title, 120), minutes: Math.round(num(r.minutes)) }))
    .filter((r) => r.activity && Number.isFinite(r.minutes) && r.minutes > 0);
  const quizRow = ctx.quiz ? { activity: `Module quiz ${ctx.quiz.code} (${ctx.quiz.questions} questions)`, minutes: Math.min(ctx.quiz.minutes, Math.floor(ctx.minutes / 2)) } : null;
  if (quizRow) rows = rows.filter((r) => !/\bquiz\b/i.test(r.activity));
  const target = ctx.minutes - (quizRow?.minutes ?? 0);
  if (rows.length < 3) {
    flags.push("Session plan was missing or incomplete; the standard plan was used.");
    const tpl = DEFAULT_PLAN[ctx.delivery];
    const shares = apportion(tpl.map(([, m]) => m), target);
    rows = tpl.map(([activity], i) => ({ activity, minutes: shares[i]! }));
  }
  const sum = rows.reduce((a, r) => a + r.minutes, 0);
  if (sum !== target) {
    const diff = target - sum;
    const largest = rows.reduce((best, r, i) => (r.minutes > rows[best]!.minutes ? i : best), 0);
    if (Math.abs(diff) <= target * 0.3 && rows[largest]!.minutes + diff >= 5) {
      rows[largest] = { ...rows[largest]!, minutes: rows[largest]!.minutes + diff };
    } else {
      const shares = apportion(rows.map((r) => r.minutes), target);
      rows = rows.map((r, i) => ({ ...r, minutes: shares[i]! })).filter((r) => r.minutes > 0);
    }
    flags.push(`Session plan totalled ${sum} minutes; adjusted to ${target}${quizRow ? ` plus ${quizRow.minutes} for the quiz` : ""}.`);
  }
  if (quizRow) rows.splice(Math.max(0, rows.length - 1), 0, quizRow);
  return { plan: rows.slice(0, 12), flags };
}

export function normalizeLesson(
  raw: unknown,
  ctx: { id: string; title: string; minutes: number; delivery: Delivery; validOutcomes: string[]; quiz?: { code: string; minutes: number; questions: number } },
): LessonContent {
  const root = obj(raw);
  const reading = textList(root.core_reading ?? root.reading, 10, 2400);
  const readingWords = reading.join(" ").split(/\s+/).filter(Boolean).length;
  if (reading.length < 3 || readingWords < 250) throw new Error(`${ctx.id}: core reading too short (${readingWords} words)`);
  const objectives = textList(root.objectives ?? root.learning_objectives, 6, 300);
  if (!objectives.length) throw new Error(`${ctx.id}: no learning objectives`);
  const workshop = textList(root.workshop ?? root.practice_activity ?? root.activity_steps, 8, 600);
  if (!workshop.length) throw new Error(`${ctx.id}: no applied activity`);
  const { plan, flags } = normalizePlan(root.session_plan ?? root.study_plan, ctx);
  const storyboard =
    ctx.delivery === "self_paced"
      ? normalizeStoryboard(root.storyboard ?? root.video_storyboard, `${ctx.id} · ${ctx.title}`)
      : null;
  if (ctx.delivery === "self_paced" && !storyboard) {
    throw new Error(`${ctx.id}: self-paced lesson has no valid narrated video storyboard`);
  }
  const valid = new Set(ctx.validOutcomes);
  const outcomes = outcomeRefs(root.outcomes, valid);
  const ins = obj(root.instructor ?? root.instructor_only);
  return {
    id: ctx.id,
    title: ctx.title,
    minutes: ctx.minutes,
    objectives,
    outcomes,
    reading,
    keyLearning: textList(root.key_learning, 6, 400),
    workedExample: plainText(root.worked_example, 2500),
    commonError: plainText(root.common_error, 600),
    plan,
    method: textList(root.practical_method ?? root.method, 8, 400),
    workshop,
    evidence: plainText(root.evidence ?? root.learner_output, 600),
    selfCheck: arr(root.self_check ?? root.formative_checks)
      .map(obj)
      .map((q) => ({ question: plainText(q.question, 600), answer: plainText(q.model_response ?? q.answer, 1200) }))
      .filter((q) => q.question && q.answer)
      .slice(0, 4),
    exitRecord: plainText(root.exit_record, 600),
    glossary: arr(root.glossary)
      .map(obj)
      .map((g) => ({ term: plainText(g.term, 80), definition: plainText(g.definition, 400) }))
      .filter((g) => g.term && g.definition)
      .slice(0, 10),
    storyboard,
    instructor: {
      facilitation: textList(ins.facilitation ?? ins.facilitation_notes, 8, 600),
      misconceptions: textList(ins.misconceptions ?? ins.expected_misconceptions, 6, 400),
      modelAnswers: textList(ins.model_answers ?? ins.model_responses, 6, 1200),
      feedback: textList(ins.feedback ?? ins.feedback_guidance, 6, 400),
    },
    flags: [...flags, ...textList(root.review_flags, 6, 300)],
  };
}

/* ------------------------------------------------------------------ Quizzes ------------------------------------------------------------------ */

export type QuizQuestion = { id: string; text: string; options: string[]; answer: number; rationale: string; lessonId: string | null };
export type QuizContent = { code: string; moduleId: string; title: string; minutes: number; questions: QuizQuestion[]; flags: string[] };

/** Deterministic answer positions so keys are spread across A–D instead of clustering on one letter. */
export function balancedPositions(count: number, seed: number): number[] {
  const out: number[] = [];
  let s = (seed * 2654435761) >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  while (out.length < count) {
    const block = [0, 1, 2, 3];
    for (let i = block.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [block[i], block[j]] = [block[j]!, block[i]!];
    }
    out.push(...block);
  }
  return out.slice(0, count);
}

export function normalizeQuiz(
  raw: unknown,
  ctx: { moduleNumber: number; moduleTitle: string; count: number; minutes: number; lessonIds: string[]; seed?: number },
): QuizContent {
  const code = quizCode(ctx.moduleNumber);
  const flags: string[] = [];
  const seen = new Set<string>();
  const valid: Array<Omit<QuizQuestion, "id">> = [];
  for (const rq of arr(obj(raw).questions ?? raw)) {
    const q = obj(rq);
    const text = plainText(q.question ?? q.text, 600);
    const options = arr(q.options).map((o) => plainText(o, 300).replace(/^[A-Da-d][.)]\s+/, ""));
    const answer = typeof q.answer === "string" && /^[A-Da-d]$/.test(q.answer.trim()) ? q.answer.trim().toUpperCase().charCodeAt(0) - 65 : Math.round(num(q.answer));
    const key = text.toLowerCase().replace(/\W+/g, " ").trim();
    if (!text || seen.has(key)) continue;
    if (options.length !== 4 || options.some((o) => !o)) continue;
    if (new Set(options.map((o) => o.toLowerCase())).size !== 4) continue;
    if (!Number.isInteger(answer) || answer < 0 || answer > 3) continue;
    seen.add(key);
    const lesson = plainText(q.lesson_id ?? q.lessonId, 20).toUpperCase();
    valid.push({ text, options, answer, rationale: plainText(q.rationale ?? q.explanation, 600), lessonId: ctx.lessonIds.includes(lesson) ? lesson : null });
  }
  if (valid.length < ctx.count) throw new Error(`${code}: only ${valid.length} valid questions (need ${ctx.count})`);
  const positions = balancedPositions(ctx.count, ctx.seed ?? ctx.moduleNumber);
  const questions = valid.slice(0, ctx.count).map((q, i) => {
    const target = positions[i]!;
    const correct = q.options[q.answer]!;
    const others = q.options.filter((_, oi) => oi !== q.answer);
    const options = [...others.slice(0, target), correct, ...others.slice(target)];
    return { ...q, id: `${code}-${pad2(i + 1)}`, options, answer: target };
  });
  if (questions.some((q) => !q.rationale)) flags.push("Some questions have no rationale; add one before releasing answers.");
  if (questions.some((q) => !q.lessonId)) flags.push("Some questions are not linked to a lesson in this module; check they were taught.");
  return { code, moduleId: moduleId(ctx.moduleNumber), title: `${code} · ${ctx.moduleTitle}`, minutes: ctx.minutes, questions, flags };
}

/* ------------------------------------------------------------------ Assessments ------------------------------------------------------------------ */

export type AssessmentContent = {
  id: string;
  title: string;
  task: string[];
  deliverables: string[];
  submission: string;
  length: string;
  criteria: Array<{ name: string; points: number; evidence: string }>;
  guidance: string[];
  integrity: string;
  flags: string[];
};

export const RUBRIC_LEVELS: Array<[number, string, string]> = [
  [4, "Complete, accurate, integrated and evidence-supported; relevant limits and decision implications are addressed.", "100% of criterion maximum"],
  [3, "Sound and relevant with minor gaps or limited integration; evidence is generally reliable.", "75% of criterion maximum"],
  [2, "Partially correct or supported, with material gaps that weaken the result.", "50% of criterion maximum"],
  [1, "Limited, largely descriptive, weakly supported or substantially inaccurate.", "25% of criterion maximum"],
  [0, "Absent, unassessable or unsupported; no credit demonstrated for this criterion.", "0% of criterion maximum"],
];

export function normalizeAssessment(raw: unknown, ctx: { id: string; title: string }): AssessmentContent {
  const root = obj(raw);
  const task = textList(root.task ?? root.instructions, 6, 2000);
  if (!task.length) throw new Error(`${ctx.id}: no task instructions`);
  const rawCriteria = arr(root.criteria ?? root.rubric)
    .map(obj)
    .map((c) => ({ name: plainText(c.name ?? c.criterion, 120), points: num(c.points ?? c.max), evidence: plainText(c.evidence ?? c.descriptor, 1200) }))
    .filter((c) => c.name)
    .slice(0, 8);
  if (rawCriteria.length < 3) throw new Error(`${ctx.id}: rubric needs at least 3 criteria`);
  const flags: string[] = [];
  const rawTotal = rawCriteria.reduce((a, c) => a + (Number.isFinite(c.points) && c.points > 0 ? c.points : 0), 0);
  const points = apportion(rawCriteria.map((c) => c.points), 100);
  if (rawTotal !== 100 || rawCriteria.some((c) => !Number.isInteger(c.points))) flags.push(`Rubric points totalled ${rawTotal}; rescaled to 100.`);
  return {
    id: ctx.id,
    title: ctx.title,
    task,
    deliverables: textList(root.deliverables, 10, 400),
    submission: plainText(root.submission ?? root.submission_package, 600),
    length: plainText(root.length ?? root.word_count, 120),
    criteria: rawCriteria.map((c, i) => ({ ...c, points: points[i]! })),
    guidance: textList(root.marking_guidance ?? root.guidance, 8, 500),
    integrity: plainText(root.integrity ?? root.academic_integrity, 600),
    flags,
  };
}

/* ------------------------------------------------------------------ Rendering ------------------------------------------------------------------ */

export const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const p = (t: string) => (t ? `<p>${esc(t)}</p>` : "");
const ul = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "");
const ol = (items: string[]) => (items.length ? `<ol>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ol>` : "");
const h3 = (t: string) => `<h3>${esc(t)}</h3>`;
function table(head: string[], rows: string[][], boldLast = false) {
  const body = rows
    .map((r, ri) => `<tr>${r.map((c) => `<td>${boldLast && ri === rows.length - 1 ? `<strong>${esc(c)}</strong>` : esc(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`;
}

const unitWord = (d: Delivery) => (d === "synchronous" ? "Session" : "Study unit");
const hoursLabel = (min: number) => `${Math.round((min / 60) * 100) / 100}`;

export function dueLabel(bp: Blueprint, a: BlueprintAssessment) {
  const lesson = bp.modules.flatMap((m) => m.lessons).find((l) => l.id === a.dueLessonId);
  return `End of ${a.dueModule}${lesson ? ` / ${unitWord(bp.course.delivery)} ${pad2(lesson.number)}` : ""}`;
}

export function renderCourseOutline(bp: Blueprint): string {
  const c = bp.course;
  const description = c.delivery === "synchronous" ? "Synchronous — live instruction, guided reading, supervised workshops and assessments" : "Asynchronous (self-paced) — guided reading, worked examples, practice activities and self-checks";
  const lessons = bp.modules.flatMap((m) => m.lessons.map((l) => ({ m, l })));
  return [
    `<h2>Program outline — ${esc(c.code)} ${esc(c.title)}</h2>`,
    table(
      ["Course title", "# of hours of instruction", "Delivery method", "Delivery description", "Breakdown"],
      [[`${c.code} – ${c.title}`, String(c.hours), c.deliveryMethod, description, c.breakdown]],
    ),
    h3("Course description"),
    p(c.description),
    c.audience ? p(`Audience: ${c.audience}`) : "",
    p(`Prerequisites: ${c.prerequisites}`),
    h3("Course learning outcomes"),
    table(["ID", "On successful completion, the learner will be able to"], bp.outcomes.map((o) => [o.id, o.text])),
    h3(`${bp.modules.length}-module curriculum (${c.hours} hours)`),
    table(
      ["Module", "Focus", "Hours", "Main output", "Outcomes"],
      [...bp.modules.map((m) => [m.id, m.title, hoursLabel(m.minutes), m.milestone, m.outcomes.join(", ")]), ["", "Total", String(c.hours), "", ""]],
      true,
    ),
    p(
      `Each module contains ${bp.modules[0]?.lessons.length ?? 0} ${c.delivery === "synchronous" ? "live sessions" : "study units"}; ${lessons.length} in total, ${c.totalMinutes.toLocaleString("en-CA")} instructional minutes. The ${bp.quizMinutes}-minute module quiz sits inside the last ${unitWord(c.delivery).toLowerCase()} of each module. Breaks and optional homework are excluded.`,
    ),
    h3("Assessment plan"),
    table(
      ["ID", "Assessment", "Mode", "Weight", "Due", "Outcomes"],
      [
        [`${quizCode(1)}–${quizCode(bp.modules.length)}`, `${bp.modules.length} module quizzes (${bp.quizQuestions} questions each)`, "Individual", `${bp.quizWeight}%`, "Each module", "All"],
        ...bp.assessments.map((a) => [a.id, a.title, a.mode, `${a.weight}%`, dueLabel(bp, a), a.outcomes.join(", ")]),
        ["", "Total", "", "100%", "", ""],
      ],
      true,
    ),
    p(
      `Quiz category points = total correct quiz answers ÷ ${bp.modules.length * bp.quizQuestions} × ${bp.quizWeight}. Each assessment rubric is marked out of 100; its contribution = score ÷ 100 × its weight.`,
    ),
    h3(c.delivery === "synchronous" ? "Session calendar" : "Study plan"),
    table(
      [unitWord(c.delivery), "Module / lesson", "Minutes"],
      [...lessons.map(({ l }) => [pad2(l.number), `${l.id} · ${l.title}`, String(l.minutes)]), ["", "Total", String(c.totalMinutes)]],
      true,
    ),
    h3("Requires institutional approval"),
    ul(bp.approvalRequired),
    bp.assumptions.length ? h3("Design assumptions") + ul(bp.assumptions) : "",
    p("This curriculum is an AI-assisted proposed design reviewed by the course instructor. It is not an accredited or institution-approved syllabus until the items above are confirmed."),
  ].join("");
}

export function renderCaseLearner(c: CourseCase): string {
  return [
    `<h2>${esc(c.name)}</h2>`,
    `<p><strong>Data provenance:</strong> ${esc(c.notice)}</p>`,
    ...c.overview.map(p),
    c.problem ? h3("The business problem") + p(c.problem) : "",
    c.offerings.length ? h3("Products and services") + ul(c.offerings) : "",
    c.segments.length ? h3("Customer segments") + ul(c.segments) : "",
    c.operations ? h3("Current operations") + p(c.operations) : "",
    ...c.tables.map((t) => h3(t.title) + table(t.columns, t.rows)),
    c.interviews.length
      ? h3("Synthetic interview extracts") +
        c.interviews.map((x) => `<p><strong>${esc(x.id)} | ${esc(x.role)}</strong></p><blockquote>${esc(x.quote)}</blockquote>${x.prompt ? `<p><em>Analyze:</em> ${esc(x.prompt)}</p>` : ""}`).join("")
      : "",
    c.options.length ? h3("Improvement options") + table(["ID", "Option", "Summary"], c.options.map((o) => [o.id, o.title, o.summary])) : "",
    c.constraints.length ? h3("Scope and constraints") + ol(c.constraints) : "",
    c.limitations.length ? h3("Data limitations") + ul(c.limitations) : "",
  ].join("");
}

export function renderCaseInstructor(c: CourseCase): string {
  return [
    `<h2>Instructor case notes — ${esc(c.name)}</h2>`,
    p("INSTRUCTOR ONLY — hidden from learners. Calculations below were re-computed by the system from their formulas."),
    c.facts.length ? h3("Case fact register") + table(["ID", "Fact"], c.facts.map((f) => [f.id, f.fact])) : "",
    c.calculations.length
      ? h3("Worked case checks") +
        table(
          ["Check", "Working", "Result"],
          c.calculations.map((x) => [x.label, x.expression, `${x.result.toLocaleString("en-CA")}${x.unit ? ` ${x.unit}` : ""}${x.corrected ? " (recalculated)" : ""}`]),
        )
      : "",
    c.flags.length ? h3("Review flags") + ul(c.flags) : "",
  ].join("");
}

export function renderLesson(bp: Blueprint, mod: BlueprintModule, lesson: BlueprintLesson, content: LessonContent): string {
  const sync = bp.course.delivery === "synchronous";
  const outcomes = content.outcomes.length ? content.outcomes : mod.outcomes;
  return [
    `<p><strong>${esc(mod.id)} • ${esc(mod.title.toUpperCase())}</strong></p>`,
    `<h2>${esc(lesson.id)} | ${esc(lesson.title)}</h2>`,
    p(`${unitWord(bp.course.delivery)} ${pad2(lesson.number)} • ${lesson.minutes} minutes${sync ? " live" : " of guided self-study"} • Outcomes: ${outcomes.join(", ")}`),
    h3("Learning objectives"),
    ul(content.objectives),
    h3("Core reading"),
    ...content.reading.map(p),
    content.keyLearning.length ? h3("Key learning") + ol(content.keyLearning) : "",
    content.workedExample ? h3("Worked example") + p(content.workedExample) : "",
    content.commonError ? `<p><strong>Common error to avoid:</strong> ${esc(content.commonError)}</p>` : "",
    h3(`${lesson.id} / ${sync ? "LIVE APPLICATION PLAN" : "SELF-STUDY PLAN"}`),
    `<h4>${lesson.minutes}-minute ${sync ? "session" : "study"} plan</h4>`,
    table(
      [sync ? "Live component" : "Study activity", "Minutes"],
      [...content.plan.map((r) => [r.activity, String(r.minutes)]), ["Total", String(content.plan.reduce((a, r) => a + r.minutes, 0))]],
      true,
    ),
    content.method.length ? h3("Practical method") + ol(content.method) : "",
    h3(sync ? "Supervised workshop instructions" : "Practice activity"),
    ol(content.workshop),
    content.evidence ? h3("Evidence to submit or retain") + p(content.evidence) : "",
    content.selfCheck.length
      ? h3("Formative self-check") +
        content.selfCheck.map((q) => `<p><strong>${esc(q.question)}</strong></p><details><summary>Model response</summary><p>${esc(q.answer)}</p></details>`).join("")
      : "",
    content.exitRecord ? `<p><strong>Exit record:</strong> ${esc(content.exitRecord)}</p>` : "",
    content.glossary.length ? h3("Glossary") + table(["Term", "Meaning"], content.glossary.map((g) => [g.term, g.definition])) : "",
  ].join("");
}

export function renderQuizIntro(bp: Blueprint, quiz: QuizContent): string {
  return [
    p(`${quiz.code} / ${quiz.moduleId} / ${quiz.questions.length} marks / ${quiz.minutes} minutes`),
    p(
      `${quiz.questions.length} single-best-answer questions. One point per correct answer, zero for incorrect or unanswered items; no negative marking. Your first submitted attempt is graded. Course notes are allowed; peers and AI assistance are not.`,
    ),
    p(`The module quizzes together are worth ${bp.quizWeight}% of the course grade.`),
  ].join("");
}

export function renderInstructorGuide(
  bp: Blueprint,
  mod: BlueprintModule,
  lessons: Array<{ lesson: BlueprintLesson; content: LessonContent | null }>,
  quiz: QuizContent | null,
  assessments: Array<{ meta: BlueprintAssessment; content: AssessmentContent | null }>,
): string {
  const letters = ["A", "B", "C", "D"];
  return [
    `<h2>Instructor guide — ${esc(mod.id)} ${esc(mod.title)}</h2>`,
    p("INSTRUCTOR ONLY — DO NOT PUBLISH TO LEARNERS. Contains answer keys, model responses and marking guidance."),
    table(["Module", "Evidence to inspect", "Outcomes"], [[mod.id, mod.milestone || mod.purpose, mod.outcomes.join(", ")]]),
    ...lessons.map(({ lesson, content }) =>
      content
        ? [
            h3(`${lesson.id} · ${lesson.title}`),
            content.instructor.facilitation.length ? "<h4>Facilitation notes</h4>" + ol(content.instructor.facilitation) : "",
            content.instructor.misconceptions.length ? "<h4>Expected misconceptions</h4>" + ul(content.instructor.misconceptions) : "",
            content.instructor.modelAnswers.length ? "<h4>Model responses</h4>" + ul(content.instructor.modelAnswers) : "",
            content.instructor.feedback.length ? "<h4>Feedback guidance</h4>" + ul(content.instructor.feedback) : "",
            content.flags.length ? "<h4>Review flags</h4>" + ul(content.flags) : "",
          ].join("")
        : "",
    ),
    quiz
      ? h3(`CONFIDENTIAL / ${quiz.code} / ANSWER KEY`) +
        quiz.questions
          .map((q) => `<p><strong>${esc(q.id)} — ${letters[q.answer]}</strong> ${esc(q.options[q.answer] ?? "")}</p>${q.rationale ? `<p><em>Rationale:</em> ${esc(q.rationale)}</p>` : ""}`)
          .join("") +
        (quiz.flags.length ? ul(quiz.flags) : "")
      : "",
    ...assessments.map(({ meta, content }) =>
      content
        ? [
            h3(`Marking guide — ${meta.id} ${meta.title} (${meta.mode}, ${meta.weight}%)`),
            table(["Criterion", "Max", "Evidence expected"], content.criteria.map((c) => [c.name, String(c.points), c.evidence])),
            content.guidance.length ? "<h4>Marking guidance</h4>" + ul(content.guidance) : "",
            "<h4>Level anchors (criterion points = maximum × level ÷ 4)</h4>",
            table(["Level", "Evidence anchor", "Credit"], RUBRIC_LEVELS.map(([lvl, a, c]) => [String(lvl), a, c])),
            content.flags.length ? "<h4>Review flags</h4>" + ul(content.flags) : "",
          ].join("")
        : "",
    ),
  ].join("");
}

/** Plain-text brief for the assignment record (rendered with preserved line breaks). */
export function assessmentInstructions(bp: Blueprint, meta: BlueprintAssessment, content: AssessmentContent): string {
  const lines = [
    `${meta.id} | ${meta.mode.toUpperCase()} | ${meta.weight}% of course grade`,
    `Due: ${dueLabel(bp, meta)} • Outcomes: ${meta.outcomes.join(", ")}${content.length ? ` • Length: ${content.length}` : ""}`,
    "",
    "ASSESSMENT TASK",
    ...content.task,
  ];
  if (content.deliverables.length) lines.push("", "REQUIRED DELIVERABLES", ...content.deliverables.map((d) => `• ${d}`));
  if (content.submission) lines.push("", "SUBMISSION PACKAGE", content.submission);
  lines.push("", "ANALYTIC RUBRIC — 100 POINTS", ...content.criteria.map((c) => `• ${c.name} — ${c.points} pts: ${c.evidence}`));
  lines.push("", "LEVELS (criterion points = maximum × level ÷ 4)", ...RUBRIC_LEVELS.map(([lvl, a]) => `${lvl} — ${a}`));
  if (content.integrity) lines.push("", "ACADEMIC INTEGRITY", content.integrity);
  lines.push("", "The institution determines pass criteria, late-work rules, reassessment and final grade approval.");
  return lines.join("\n").slice(0, 20_000);
}
