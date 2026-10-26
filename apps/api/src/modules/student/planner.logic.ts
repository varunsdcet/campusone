export type PlannerDraftSession = {
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  sectionId?: string;
  assignmentId?: string;
};

export type PlannerDraft = {
  title: string;
  rationale: string;
  sessions: PlannerDraftSession[];
};

export function localDateKey(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function attendanceProjection(attended: number, counted: number, targetPercent = 80) {
  const safeTarget = Math.min(100, Math.max(1, targetPercent));
  const target = safeTarget / 100;
  const rate = counted ? Math.round((attended / counted) * 1000) / 10 : 100;
  const canMiss = Math.max(0, Math.floor(attended / target - counted));
  const neededConsecutive = rate >= safeTarget || target >= 1
    ? 0
    : Math.max(0, Math.ceil(((target * counted - attended) / (1 - target)) - 1e-9));
  return { attended, counted, rate, targetPercent: safeTarget, canMiss, neededConsecutive };
}

function cleanJson(raw: string) {
  return raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

export function parsePlannerDraft(raw: string, allowedSectionIds: Set<string>, allowedAssignmentIds: Set<string>): PlannerDraft {
  const parsed = JSON.parse(cleanJson(raw)) as Record<string, unknown>;
  const source = Array.isArray(parsed.sessions) ? parsed.sessions : [];
  const sessions = source.slice(0, 21).map((value) => {
    const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const title = String(row.title ?? "").trim().slice(0, 140);
    const scheduledAt = String(row.scheduledAt ?? "").trim();
    const durationMinutes = Number(row.durationMinutes);
    const date = new Date(scheduledAt);
    if (!title || !Number.isFinite(date.getTime()) || !Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 180) return null;
    const requestedSection = String(row.sectionId ?? "").trim();
    const requestedAssignment = String(row.assignmentId ?? "").trim();
    return {
      title,
      scheduledAt: date.toISOString(),
      durationMinutes,
      ...(allowedSectionIds.has(requestedSection) ? { sectionId: requestedSection } : {}),
      ...(allowedAssignmentIds.has(requestedAssignment) ? { assignmentId: requestedAssignment } : {}),
    };
  }).filter((row): row is PlannerDraftSession => Boolean(row));
  if (!sessions.length) throw new Error("AI returned no usable study sessions");
  return {
    title: String(parsed.title ?? "My study plan").trim().slice(0, 100) || "My study plan",
    rationale: String(parsed.rationale ?? "Balanced around your official timetable and deadlines.").trim().slice(0, 600),
    sessions,
  };
}

export type StudyAidKind = "summary" | "flashcards" | "quiz" | "checklist";
export type StudyAidItem = { front: string; back: string; source: string; options?: string[]; answerIndex?: number };

const STUDY_AID_FORMATS: Record<StudyAidKind, string> = {
  flashcards: [
    'Write 10-12 flashcards. "front" is one precise question (max 20 words). "back" is a specific answer in 2-4 sentences (max 70 words) with concrete facts, steps, a small example or a number - never a vague restatement.',
    "Mix the card types: definition, how it works step by step, why or when to use it, compare and contrast with a related concept, a worked example with a tiny concrete input and its result, cost or complexity or trade-offs, and a common mistake.",
    "One idea per card; no two cards may test the same fact.",
  ].join(" "),
  quiz: [
    'Write 6-8 multiple-choice questions. "front" is the question. "options" is an array of exactly 4 distinct answer choices of similar length, with one clearly correct and three plausible wrong ones built from real misconceptions. "answerIndex" is the 0-based index of the correct option. "back" explains in 1-2 sentences why that option is correct and why the most tempting wrong option fails.',
    "At most two questions may be pure recall; the rest must ask the student to apply, trace, predict an outcome, compare or diagnose a scenario. Vary the position of the correct answer.",
  ].join(" "),
  summary:
    'Write 4-6 summary sections. "front" is a short section heading. "back" is 2-4 sentences explaining that part in plain language.',
  checklist:
    'Write 6-10 revision checklist items. "front" is one concrete thing the student should be able to do (start with a verb). "back" is how the student can check they have mastered it.',
};

export function studyAidPrompt(kind: StudyAidKind) {
  const shape = kind === "quiz"
    ? '{"title":"...","items":[{"front":"...","options":["...","...","...","..."],"answerIndex":0,"back":"...","source":"..."}]}'
    : '{"title":"...","items":[{"front":"...","back":"...","source":"..."}]}';
  return [
    `Create a ${kind} study aid for a college student, in clear English.`,
    STUDY_AID_FORMATS[kind],
    "Base the content on officialSourceText and studentNotes. officialSourceText is often only a one-line lesson description: treat it as the scope, then teach the topic at university-course depth using accurate, standard subject knowledge. Stay inside the topic (relatedLessons and syllabusOutline show the neighbouring material).",
    'Every question must be self-contained and name the concept explicitly - never "it", "them", "this lesson" or "the activity". Do not ask about the classroom activity itself (what students will trace, build or discuss); ask about the subject knowledge it teaches.',
    "Never claim to reveal teacher answer keys, graded assessment answers or teacher-only material.",
    `Return JSON only, with this shape: ${shape}. Every item "source" must repeat the supplied source reference.`,
  ].join(" ");
}

export function parseStudyAid(raw: string, kind: StudyAidKind, reference: string, random: () => number = Math.random): { title: string; items: StudyAidItem[] } {
  const parsed = JSON.parse(cleanJson(raw)) as { title?: unknown; items?: unknown };
  const rows = Array.isArray(parsed.items) ? parsed.items.slice(0, 30) : [];
  const seen = new Set<string>();
  const items = rows.map((value): StudyAidItem | null => {
    const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const front = String(row.front ?? row.question ?? "").trim().slice(0, 500);
    const back = String(row.back ?? row.explanation ?? row.answer ?? "").trim().slice(0, 2000);
    const key = front.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) return null;
    seen.add(key);
    if ((kind === "flashcards" || kind === "quiz") && /^(it|they|them|this|these|those|that)\b/i.test(front)) return null;
    if (kind !== "quiz") return front && back ? { front, back, source: reference } : null;
    const options = Array.isArray(row.options) ? row.options.map((option) => String(option ?? "").trim().slice(0, 300)).filter(Boolean) : [];
    const answerIndex = Number(row.answerIndex);
    if (!front || options.length < 2 || options.length > 6 || new Set(options).size !== options.length) return null;
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) return null;
    const shuffled = options.map((option, index) => ({ option, index, sort: random() })).sort((a, b) => a.sort - b.sort);
    return { front, back: back || `Correct answer: ${options[answerIndex]}`, source: reference, options: shuffled.map((row) => row.option), answerIndex: shuffled.findIndex((row) => row.index === answerIndex) };
  }).filter((row): row is StudyAidItem => Boolean(row));
  return { title: String(parsed.title ?? "").trim().slice(0, 140) || `${kind} study aid`, items };
}
