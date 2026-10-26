import type { Blueprint, BlueprintAssessment, BlueprintLesson, BlueprintModule, CourseBrief, LessonContent } from "./aiCourseSpec.js";
import { quizCode } from "./aiCourseSpec.js";

/**
 * Prompts for the AI course builder. The few-shot examples are taken from the CAP 101 – Applied Business
 * Capstone Project pack (learner manual, quiz booklet, instructor guide) and define the house format.
 */

export const SYSTEM_PROMPT = `You are a senior instructional designer writing complete, classroom-ready course material for Heritage Community College (Canada).
Reply with ONLY one JSON object — no prose, no markdown fences, no comments.
House rules:
- Write in clear Canadian English for adult post-secondary learners. Teach the content fully; never write placeholders such as "the instructor explains" or "content goes here".
- Do not invent institutional policy: pass marks, attendance percentages, late penalties, credit values, accreditation, certifications or mandatory host/employer signatures. If something needs a policy, say "Requires institutional approval" — unless the SOURCE OUTLINE states it.
- Do not invent URLs, citations, statistics about real markets, or quotations from real people. Any company, person, interview or dataset you create is fictional and must be labelled synthetic.
- Keep every number internally consistent with the facts you are given. Show working for calculations.
- Synchronous/offline courses are text-led: do not add video, audio or narration scripts to them.
- Self-paced courses include a narrated video storyboard only when the task explicitly requests it. The storyboard must teach the same approved lesson content and must not introduce new facts.
- Plain text inside JSON strings: no HTML, no markdown symbols (#, **, |).`;

function deliveryNote(delivery: Blueprint["course"]["delivery"]) {
  return delivery === "synchronous"
    ? "Delivery: SYNCHRONOUS/OFFLINE live sessions. Lessons are instructor-led with guided reading, supervised workshops and live checkpoints. Do not generate video, audio or narration scripts."
    : "Delivery: SELF-PACED (asynchronous). Each lesson is a guided self-study unit with a course-specific AI narrated video storyboard, reading, worked examples, independent practice, self-checks and an exit reflection. Never refer to live classes or breakout rooms.";
}

function sourceBlock(outline: string, max: number) {
  const text = outline.trim();
  return text
    ? `SOURCE OUTLINE (supplied by the institution — follow it where it states titles, outcomes, tasks, hours, topics, assessments or policies; fill only the gaps):\n"""\n${text.slice(0, max)}\n"""`
    : "No source outline was supplied: design the curriculum from the course title, description and audience.";
}

/* ------------------------------------------------------------------ Blueprint ------------------------------------------------------------------ */

const BLUEPRINT_EXAMPLE = `{
  "description": "An integrative business capstone in which learners investigate a bounded business problem, evaluate evidence and alternatives, construct a feasible solution, test a controlled pilot and defend an implementation recommendation.",
  "audience": "Business diploma learners in their final term",
  "prerequisites": "Introductory business concepts, basic spreadsheet skills and written communication; official prerequisites require institutional approval",
  "outcomes": [
    "Define a bounded business problem, stakeholder needs, measurable success criteria and a defensible project charter.",
    "Collect, evaluate and interpret business evidence while identifying limitations and protecting confidential information.",
    "Build and explain an assumption-driven financial model, break-even calculation, cash forecast and sensitivity analysis."
  ],
  "modules": [
    {
      "title": "Capstone launch, problem framing and project charter",
      "purpose": "Learners turn a manager's request into a bounded decision question, baseline and charter.",
      "topics": ["What makes a capstone decision-ready", "Problem statements, baselines and SMART outcomes", "Stakeholders, scope and evidence access", "Team agreements and charter approval"],
      "outcomes": ["CLO1"],
      "milestone": "A1: approved project charter, scope, team agreement and evidence log",
      "lessons": [
        {"title": "What makes a capstone decision-ready?", "focus": "Connect a business decision to evidence, constraints and action; a justified no-go is valid."},
        {"title": "Problem statement, baseline and SMART outcomes", "focus": "Separate symptoms from causes; define metrics with denominators and guardrails."}
      ]
    }
  ],
  "quiz_weight": 10,
  "assessments": [
    {"title": "Project charter and team agreement", "mode": "Team", "weight": 5, "due_module": 1, "outcomes": ["CLO1"], "summary": "900–1,200-word charter with decision, baseline, three measurable outcomes, scope, stakeholders, roles and risks."},
    {"title": "Individual financial feasibility model", "mode": "Individual", "weight": 15, "due_module": 6, "outcomes": ["CLO3"], "summary": "12-month spreadsheet model with break-even, cash forecast and three sensitivities plus a 700–900-word interpretation."}
  ],
  "assumptions": ["Default cohort of 24 learners in six teams of four"],
  "approval_required": ["Pass criteria and grading scale", "Attendance and make-up rules", "Late-work and reassessment rules"]
}`;

export function blueprintPrompt(brief: CourseBrief, course: { code: string; title: string; credits?: number | null; description: string }) {
  const lessons = brief.modules * brief.lessonsPerModule;
  const minutes = Math.round((brief.hours * 60) / lessons);
  return [
    `TASK: Create the course BLUEPRINT only (no lesson text yet) for ${course.code} – ${course.title}.`,
    course.description ? `Catalogue description: ${course.description}` : "",
    `Total instructional time: ${brief.hours} hours (${brief.hours * 60} minutes). Delivery method: ${brief.deliveryMethod}. Breakdown: ${brief.breakdown}.`,
    deliveryNote(brief.delivery),
    brief.audience ? `Audience: ${brief.audience}` : "",
    `Structure (fixed by the system — do not change): exactly ${brief.modules} modules, each with exactly ${brief.lessonsPerModule} lessons (${lessons} lessons of about ${minutes} minutes). Every module ends with a ${brief.quizQuestions}-question module quiz.`,
    brief.includeCase ? "One fictional business case will run through the whole course; design modules so each one advances a single evolving project from problem framing to final presentation." : "",
    brief.notes ? `Designer notes: ${brief.notes}` : "",
    sourceBlock(brief.outline, 30_000),
    `Requirements:
1. 5–9 measurable course learning outcomes (start with an action verb). If the source lists tasks or outcomes, use them as the outcomes, in order.
2. Exactly ${brief.modules} modules in teaching order. Each module: title, purpose (1–2 sentences), topics (3–8 items), outcomes (CLO ids it teaches), milestone (the learner output of the module) and exactly ${brief.lessonsPerModule} lessons with title and one-sentence focus. Lessons must progress logically and not repeat.
3. quiz_weight is the total course weight of all module quizzes together (whole number). assessments lists every OTHER graded component (2–12 items) with title, mode (Team or Individual), weight (whole number), due_module (module number), outcomes and a one-sentence summary. quiz_weight + all assessment weights must equal exactly 100. If the source lists quizzes as an assessment, use that weight as quiz_weight and do not repeat it in assessments.
4. Every outcome must be taught by at least one module and assessed by at least one assessment.
5. approval_required lists institutional decisions this design does not make.
Return JSON with keys: description, audience, prerequisites, outcomes, modules, quiz_weight, assessments, assumptions, approval_required.
Shape example (from CAP 101 — follow the shape and quality, not the subject):
${BLUEPRINT_EXAMPLE}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function blueprintSummary(bp: Blueprint) {
  return [
    `Course: ${bp.course.code} – ${bp.course.title} (${bp.course.hours} hours, ${bp.modules.length} modules).`,
    bp.course.description ? `Description: ${bp.course.description}` : "",
    `Outcomes: ${bp.outcomes.map((o) => `${o.id} ${o.text}`).join(" | ")}`,
    `Modules: ${bp.modules.map((m) => `${m.id} ${m.title} → ${m.milestone}`).join(" | ")}`,
    `Assessments: ${bp.assessments.map((a) => `${a.id} ${a.title} (${a.mode}, ${a.weight}%, due ${a.dueModule})`).join(" | ")}; module quizzes ${bp.quizWeight}%.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/* ------------------------------------------------------------------ Case ------------------------------------------------------------------ */

export function casePrompt(bp: Blueprint, outline: string) {
  return [
    "TASK: Create ONE fictional organization case that every lesson, activity and assessment of this course will reuse.",
    blueprintSummary(bp),
    sourceBlock(outline, 6_000),
    `Requirements:
- A small Canadian organization (fictional name and fictional city area) whose decision fits this course. State that it is entirely fictional.
- Include: overview (2–3 paragraphs), problem, products/offerings, customer segments, current operations, 2–4 data tables (e.g. three historical periods H1–H3 with volumes, price, unit cost, fixed cost, service issues; supplier or option cards), 4–6 synthetic interview extracts with an "analyze" prompt each, three improvement options, constraints, data limitations.
- facts: 12–25 short, stable facts (prices, costs, capacity, counts) that later lessons must reuse exactly.
- instructor_calculations: 6–12 key checks. Each has label, expression (numbers and + - * / ( ) only, e.g. "(180-105)*120-7500"), result (the number) and unit. The system recalculates every expression.
- Values must be consistent across tables, facts and calculations. Use CAD.
Return JSON with keys: name, synthetic_notice, overview, problem, products, customer_segments, operations, data_tables [{title, columns, rows}], interviews [{role, quote, analyze}], options [{title, summary}], constraints, limitations, facts, instructor_calculations [{label, expression, result, unit}].`,
  ].join("\n\n");
}

/* ------------------------------------------------------------------ Lesson ------------------------------------------------------------------ */

const LESSON_EXAMPLE = `{
  "objectives": ["Distinguish a symptom from an evidenced cause in a business problem", "Write a baseline with a defined measure, period and denominator", "Draft SMART outcomes paired with a quality guardrail"],
  "outcomes": ["CLO1"],
  "core_reading": [
    "A symptom is something undesirable that you observe; a cause is an explanation that still needs evidence. Declining retention, slow responses and low profit are symptoms. Do not label a cause as proven because it sounds plausible. Write a problem statement with the affected group, the current condition, the consequence and the boundary of the investigation.",
    "A baseline describes the starting point using a defined measure and period. A target specifies the result to seek and by when. Define the denominator: 'late deliveries fell' means little unless you say how late is defined and how many deliveries were due. Distinguish percentage-point changes from relative percentage changes when comparing rates.",
    "Use SMART as a drafting check: specific, measurable, achievable, relevant and time-bound. Achievable does not mean guaranteed. Explain why the target is reasonable and which assumptions it depends on. Include at least one guardrail so that improving one metric does not quietly damage another.",
    "Your scope should be narrow enough to investigate and pilot during this course. State what is out of scope, such as entering a new country or delivering a live commercial launch. These exclusions are a management control, not an admission of weak ambition."
  ],
  "key_learning": ["A symptom is not yet an established cause.", "Every metric needs a definition, period and denominator.", "Pair each improvement target with a quality or risk guardrail."],
  "worked_example": "In H3, 14 of 120 deliveries were late: 14 ÷ 120 = 11.67%. A proposed pilot target is at most 5% late over four simulated service rounds, with the wrong-item rate no higher than the H3 baseline of 6 ÷ 120 = 5%. These are proposed targets, not verified future results.",
  "common_error": "'Increase satisfaction' is an intention, not a measurable outcome.",
  "session_plan": [
    {"activity": "Retrieval and decision briefing", "minutes": 15},
    {"activity": "Live concept teaching with slides", "minutes": 35},
    {"activity": "Guided reading and annotation", "minutes": 20},
    {"activity": "Worked case and discussion", "minutes": 25},
    {"activity": "Supervised applied workshop", "minutes": 45},
    {"activity": "Exit evidence and reflection", "minutes": 10}
  ],
  "practical_method": ["Name the affected group and the observed symptom.", "Define the metric, period and denominator for the baseline.", "Draft a time-bound target and one guardrail.", "List what is out of scope."],
  "workshop": ["Individually rewrite the case symptom as a problem statement with a boundary.", "Calculate the H3 late and wrong-item rates and record the working.", "Draft three SMART outcomes with guardrails and compare them in your team."],
  "evidence": "Problem statement, baseline table and three outcome statements in the team charter draft.",
  "self_check": [{"question": "A rate falls from 12% to 8%. Is that a 4% or a 33% improvement?", "model_response": "It is a 4 percentage-point decrease and a 33.3% relative decrease; state which one you mean."}],
  "exit_record": "Which metric still lacks a clear definition? Which assumption does your target depend on? Who owns the next action?",
  "glossary": [{"term": "Baseline", "definition": "The measured starting point for a metric over a defined period."}, {"term": "Guardrail", "definition": "A metric that must not worsen while another is improved."}],
  "instructor": {
    "facilitation": ["Open by asking one learner to restate the sponsor's decision.", "Circulate during the workshop and ask each learner to explain one denominator."],
    "misconceptions": ["Treating a plausible cause as proven.", "Confusing percentage points with relative change."],
    "model_answers": ["Late rate H3 = 14/120 = 11.67%; wrong-item rate = 6/120 = 5.00%."],
    "feedback": ["Praise targets that include a period and guardrail; return vague targets with a request for a denominator."]
  },
  "review_flags": []
}`;

export function lessonPrompt(input: {
  bp: Blueprint;
  mod: BlueprintModule;
  lesson: BlueprintLesson;
  caseText: string;
  covered: string[];
  isLast: boolean;
}) {
  const { bp, mod, lesson } = input;
  const sync = bp.course.delivery === "synchronous";
  const quizMinutes = Math.min(bp.quizMinutes, Math.floor(lesson.minutes / 2));
  const planMinutes = lesson.minutes - (input.isLast ? quizMinutes : 0);
  const storyboardRule = sync
    ? "- Do not return video, audio or narration content."
    : `- storyboard: a course-specific narrated video lecture with 5–10 slides. Each slide needs a concise heading, 2–4 short bullets and 2–4 complete spoken-narration sentences. Teach only facts already present in this generated lesson; do not invent citations, policies or statistics. Aim for 5–10 minutes and use plain Canadian English.`;
  return [
    `TASK: Write the complete learner and instructor material for ONE ${sync ? "live session" : "self-study unit"}: ${lesson.id} "${lesson.title}".`,
    deliveryNote(bp.course.delivery),
    blueprintSummary(bp),
    `This module: ${mod.id} ${mod.title}. Purpose: ${mod.purpose} Topics: ${mod.topics.join("; ")}. Milestone: ${mod.milestone}. Outcomes: ${mod.outcomes.join(", ")}.`,
    `This lesson focus: ${lesson.focus || lesson.title}. Lesson length: ${lesson.minutes} minutes.`,
    `Lessons in this module: ${mod.lessons.map((l) => `${l.id} ${l.title}`).join(" | ")}.`,
    input.covered.length ? `Already covered earlier in the course (do not re-teach; build on it): ${input.covered.join(" | ")}` : "",
    input.caseText ? `${input.caseText}\nUse ONLY these case facts and numbers; do not invent new figures that conflict with them.` : "",
    `Requirements:
- objectives: 2–4 measurable learning objectives.
- outcomes: the CLO ids this lesson serves (from: ${bp.outcomes.map((o) => o.id).join(", ")}).
- core_reading: 4–7 substantial paragraphs (650–1,000 words total) that actually teach the concepts, with definitions and business reasoning.
- key_learning: 3–5 takeaways. worked_example: a concrete example with numbers and working where relevant. common_error: one error to avoid.
- session_plan: ${sync ? "live components" : "self-study activities"} whose minutes add up to EXACTLY ${planMinutes}.${input.isLast ? ` Do not include the module quiz; the system adds the ${quizMinutes}-minute ${quizCode(mod.number)} quiz to this lesson.` : ""}
- practical_method: 3–5 steps. workshop: 3–5 ${sync ? "supervised workshop" : "independent practice"} steps producing a tangible output. evidence: what the learner submits or keeps.
- self_check: 1–3 questions with model responses. exit_record: 2–3 reflection prompts. glossary: 2–6 terms.
- ${storyboardRule.slice(2)}
- instructor: facilitation notes, expected misconceptions, model answers (with calculations), feedback guidance — instructor-only.
- review_flags: list anything a subject expert must verify (claims, numbers, policies). Empty list if none.
Return JSON with keys: objectives, outcomes, core_reading, key_learning, worked_example, common_error, session_plan, practical_method, workshop, evidence, self_check, exit_record, glossary, storyboard, instructor, review_flags. For synchronous/offline delivery set storyboard to null.
Gold example (CAP 101, M01-L02, synchronous 150 minutes — match this depth and style for the requested lesson):
${LESSON_EXAMPLE}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** What earlier lessons taught, so the next lesson builds instead of repeating. */
export function coveredSummary(done: Array<{ lesson: BlueprintLesson; content: LessonContent | null }>) {
  return done.map(({ lesson, content }) => `${lesson.id} ${lesson.title}${content?.keyLearning.length ? `: ${content.keyLearning.slice(0, 2).join("; ")}` : ""}`).slice(-12);
}

/* ------------------------------------------------------------------ Quiz ------------------------------------------------------------------ */

const QUIZ_EXAMPLE = `{"questions": [
  {"question": "Which statement is a measurable outcome?", "options": ["Improve service significantly", "Reduce late deliveries from 12% to 8% by a stated date, using the same definition", "Become the best provider", "Work harder on delivery"], "answer": 1, "rationale": "It includes a baseline, target, period and consistent measure.", "lesson_id": "M01-L02", "difficulty": "medium"},
  {"question": "A rate falls from 12% to 8%. The percentage-point decrease is:", "options": ["8 percentage points", "33.3 percentage points", "50 percentage points", "4 percentage points"], "answer": 3, "rationale": "Subtract the two percentages; relative reduction is a different calculation.", "lesson_id": "M01-L02", "difficulty": "medium"},
  {"question": "A sponsor adds a second city after charter approval. The first step is to:", "options": ["Assess scope, time, cost and risk impacts through a change request", "Delete the original objectives", "Hide the request from the instructor", "Accept without analysis"], "answer": 0, "rationale": "Scope changes need an explicit impact assessment and decision.", "lesson_id": "M01-L03", "difficulty": "hard"}
]}`;

export function quizPrompt(bp: Blueprint, mod: BlueprintModule, lessons: Array<{ lesson: BlueprintLesson; content: LessonContent }>) {
  const material = lessons
    .map(({ lesson, content }) =>
      [
        `[${lesson.id}] ${lesson.title}`,
        `Objectives: ${content.objectives.join("; ")}`,
        content.reading.join(" ").slice(0, 3500),
        content.keyLearning.length ? `Key learning: ${content.keyLearning.join("; ")}` : "",
        content.workedExample ? `Worked example: ${content.workedExample}` : "",
        content.commonError ? `Common error: ${content.commonError}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
  return [
    `TASK: Write module quiz ${quizCode(mod.number)} for ${mod.id} "${mod.title}" — exactly ${bp.quizQuestions} single-best-answer questions based ONLY on the approved lesson content below.`,
    `APPROVED LESSON CONTENT:\n${material}`,
    `Requirements:
- Exactly ${bp.quizQuestions} questions; each has exactly 4 distinct options, one correct answer ("answer" = 0-based index), a one-sentence rationale and the lesson_id it tests.
- At least 40% application or scenario questions; include calculation questions only when the lesson taught the method, and check your arithmetic.
- Cover every lesson of the module. No duplicate questions, no trick wording, no "all of the above"/"none of the above", no facts that were not taught.
- Distractors must be plausible but clearly wrong to a learner who studied the lesson.
Return JSON: {"questions": [{question, options, answer, rationale, lesson_id, difficulty}]}.
Gold example (CAP 101 Q01):
${QUIZ_EXAMPLE}`,
  ].join("\n\n");
}

/* ------------------------------------------------------------------ Assessment ------------------------------------------------------------------ */

const ASSESSMENT_EXAMPLE = `{
  "task": ["Produce a 900–1,200-word charter plus compact tables. Choose the approved real-client or supplied-simulation route. Define the decision, baseline, three measurable outcomes, scope and exclusions, stakeholders, evidence access, deliverables, schedule, roles, risks and team operating agreement.", "Submit a contribution-log baseline. The instructor returns scope approval or changes; approval is not a guarantee that the initial solution is correct."],
  "deliverables": ["Project charter (PDF or DOCX)", "Stakeholder and evidence-access table", "Team operating agreement", "Contribution-log baseline"],
  "submission": "One PDF or DOCX charter plus tables; one shared team submission listing all members.",
  "length": "900–1,200 words plus tables",
  "criteria": [
    {"name": "Problem, baseline and outcomes", "points": 25, "evidence": "A bounded decision question, defined baseline and three measurable outcomes with guardrails."},
    {"name": "Scope and feasibility", "points": 20, "evidence": "Explicit exclusions, manageable deliverables and a plausible workflow within the course hours."},
    {"name": "Stakeholders and evidence access", "points": 20, "evidence": "Relevant roles, missing voices, permissions and simulation fallback."},
    {"name": "Roles, schedule and team agreement", "points": 20, "evidence": "Owners, reviewers, response rules, review dates and contribution evidence."},
    {"name": "Risks and professional presentation", "points": 15, "evidence": "Material early risks, readable structure and clearly labelled assumptions."}
  ],
  "marking_guidance": ["Score each criterion 0–4 against the common anchors; points = maximum × level ÷ 4.", "Do not penalise a justified narrow scope."],
  "integrity": "Cite sources, disclose material AI or tool assistance and do not fabricate data, interviews or references."
}`;

export function assessmentPrompt(bp: Blueprint, meta: BlueprintAssessment, caseText: string, outline: string) {
  const mod = bp.modules.find((m) => m.id === meta.dueModule);
  return [
    `TASK: Write the complete brief and marking rubric for assessment ${meta.id} "${meta.title}" (${meta.mode}, ${meta.weight}% of the course grade, due at the end of ${meta.dueModule}${mod ? ` ${mod.title}` : ""}).`,
    deliveryNote(bp.course.delivery),
    blueprintSummary(bp),
    `Assessment purpose: ${meta.summary}. Outcomes assessed: ${meta.outcomes.map((id) => `${id} ${bp.outcomes.find((o) => o.id === id)?.text ?? ""}`).join(" | ")}.`,
    caseText ? `${caseText}\nThe assessment must use this case (or an instructor-approved real organization).` : "",
    outline.trim() ? sourceBlock(outline, 4_000) : "",
    `Requirements:
- task: 1–3 paragraphs of complete student instructions with the expected length.
- deliverables, submission package, length.
- criteria: 4–6 analytic rubric criteria whose points add up to EXACTLY 100, each with the evidence expected for full credit.
- marking_guidance for instructors and an academic-integrity statement.
- Do not set due dates, late penalties or pass marks.
Return JSON with keys: task, deliverables, submission, length, criteria, marking_guidance, integrity.
Gold example (CAP 101 A1 Project charter and team agreement):
${ASSESSMENT_EXAMPLE}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
