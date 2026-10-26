import { citeOrRefuse } from "./coach.js";
import type { CoachAction, GroundedCoachFact, GroundedCoachResult } from "./types.js";

/** Teaching Operations Assistant — instructor Ask CampusOne capability. */
export type FacultyOpsIntent =
  | "dashboard"
  | "schedule"
  | "roster"
  | "attendance"
  | "content"
  | "lesson"
  | "assignment"
  | "quiz"
  | "gradebook"
  | "final_grades"
  | "student_support"
  | "at_risk"
  | "message"
  | "groups"
  | "badges"
  | "availability"
  | "analytics"
  | "evaluation"
  | "audit"
  | "admin"
  | "policy"
  | "write_preview"
  | "overview";

export function isFacultyAssistantQuestion(question: string) {
  const q = question.toLowerCase();
  return (
    /missing|not submitted|need help|declining|check-in|which students|roster|outstanding|draft grade|intervention|at[- ]?risk|attendance|class list|teaching|gradebook|quiz|badge|office hours|morning summary|today.?s class|final grade|lesson plan|message|remind/.test(
      q,
    ) ||
    /what classes|show my schedule|next class|who might need|prepare final|validate.*gradebook|create.*quiz|mark .*absent|mark .*present/.test(
      q,
    )
  );
}

export function facultyOpsIntent(question: string, contextPath = ""): FacultyOpsIntent {
  const q = question.toLowerCase().trim();
  const path = contextPath.toLowerCase();

  // Pasted / echoed prior assistant meta-replies → real dashboard (never write_preview).
  if (
    /aren'?t in the current signal set|what i can('t| not) confirm|what i can see right now|what i can do from here|unlock the full dashboard|without those screens loaded/.test(
      q,
    ) ||
    (/here'?s what i can help with from this screen/.test(q) && q.length > 200)
  ) {
    return "dashboard";
  }

  if (
    /morning summary|teaching summary|what should i focus|action required|dashboard|pending teaching|what can you (help|do)|help with|capabilities|from this screen|teaching operations/.test(
      q,
    )
  ) {
    return "dashboard";
  }

  // Write-style commands → preview only (Phase 1 does not mutate).
  // Do NOT match bare "confirm" (shows up in normal prose like "What I can't confirm").
  if (
    /^(mark |save |submit |send |publish |post |assign |delete |hide |release |enter \d)/.test(q) ||
    /mark (everyone|all|[a-z][a-z]+) (present|absent|late|excused)/.test(q) ||
    /\b(send (it|the message|the reminder|now)|don'?t send|confirm (this|and|save|send|yes)|yes,? confirm)\b/.test(q)
  ) {
    return "write_preview";
  }

  if (/today.?s class|classes am i teaching|next class|schedule|this week|classroom|room|schedule change/.test(q)) {
    return "schedule";
  }
  if (/class list|roster|enrolled|withdrew|retake|cohort|find student|newly enrolled|joined after/.test(q)) {
    return "roster";
  }
  if (/attendance|absent|late|excused|missed .*class|below 80%|consecutive absence/.test(q) || path.includes("attendance")) {
    return "attendance";
  }
  if (/final grade|submit final|prepare final|validate the gradebook/.test(q)) return "final_grades";
  if (/gradebook|ungraded|enter .*mark|publish .*mark|below 60%|grade distribution|weight/.test(q) || path.includes("grade")) {
    return "gradebook";
  }
  if (/quiz|question bank|multiple-choice|true.?or.?false|moodle xml/.test(q)) return "quiz";
  if (/assignment|submission|rubric|due this week|not submitted|missing work/.test(q)) return "assignment";
  if (/lesson plan|discussion question|case study|exit.?ticket|opening activity|classroom|make.?up activity/.test(q)) {
    return "lesson";
  }
  if (/section called|create a lesson|study guide|h5p|discussion forum|course content|resource|week \d/.test(q)) {
    return "content";
  }
  if (/at[- ]?risk|need help|declining|not logged in|outreach list|who might need/.test(q)) return "at_risk";
  if (/academic summary|this student|intervention|supportive message|student success/.test(q) || /\/students\//.test(path)) {
    return "student_support";
  }
  if (/message|inbox|draft a (message|reminder)|unread|notify|announce/.test(q) || path.includes("message")) {
    return "message";
  }
  if (/group|project team|balanced project/.test(q)) return "groups";
  if (/badge|competenc/.test(q)) return "badges";
  if (/office hours|availability|booked for office/.test(q)) return "availability";
  if (/analytics|engagement|completion rate|participation|rarely accessed/.test(q)) return "analytics";
  if (/evaluation|course evaluation/.test(q)) return "evaluation";
  if (/audit|who changed|activity log|gradebook this week/.test(q)) return "audit";
  if (/pending course schedule|room change|teaching.?assignment|grading scheme|archival/.test(q)) return "admin";
  if (/policy|attendance policy|academic warning|late assignment|withdrawal|loa|misconduct/.test(q)) return "policy";
  return "overview";
}

function pageAwareHint(contextPath: string): string | null {
  const p = contextPath.toLowerCase();
  if (p.includes("attendance")) {
    return "Page context: Attendance — you can ask to preview marks, absences, or low-attendance lists for this screen.";
  }
  if (p.includes("gradebook") || p.includes("grade")) {
    return "Page context: Gradebook — ask about missing marks, weights, or students below a threshold.";
  }
  if (p.includes("section") || p.includes("roster") || p.includes("class")) {
    return "Page context: Class list — ask about enrolled, withdrawn, or retake students in your authorized sections.";
  }
  if (p.includes("message") || p.includes("mail")) {
    return "Page context: Messages — ask for unread threads or draft replies (send only after you approve).";
  }
  if (p.includes("content") || p.includes("module") || p.includes("lms")) {
    return "Page context: Course content — ask to draft lessons/quizzes; publication stays with you.";
  }
  return null;
}

function factsOf(facts: GroundedCoachFact[], ...kinds: GroundedCoachFact["kind"][]) {
  return kinds.flatMap((kind) => facts.filter((f) => f.kind === kind));
}

function card(title: string, lines: string[]) {
  if (!lines.length) return `**${title}**\n- None from live records right now.`;
  return `**${title}**\n${lines.map((l) => `- ${l}`).join("\n")}`;
}

function actionsFor(intent: FacultyOpsIntent): CoachAction[] {
  const base: CoachAction[] = [
    { label: "Open sections", href: "/instructor/sections" },
    { label: "Ask CampusOne", href: "/instructor/ask" },
  ];
  if (intent === "attendance" || intent === "write_preview") {
    return [{ label: "Open attendance", href: "/instructor/attendance" }, ...base];
  }
  if (intent === "gradebook" || intent === "final_grades" || intent === "assignment") {
    return [
      { label: "Open gradebook", href: "/instructor/gradebook" },
      { label: "Open assessments", href: "/instructor/assessments" },
      ...base,
    ];
  }
  if (intent === "message") {
    return [{ label: "Open messages", href: "/instructor/messages" }, ...base];
  }
  if (intent === "schedule" || intent === "dashboard") {
    return [
      { label: "Open calendar", href: "/instructor/calendar" },
      { label: "Open attendance", href: "/instructor/attendance" },
      { label: "Open gradebook", href: "/instructor/gradebook" },
      ...base,
    ];
  }
  if (intent === "badges") {
    return [{ label: "Badges / Accomplishments", href: "/instructor/f/t82-badges-accomplishments" }, ...base];
  }
  if (intent === "availability") {
    return [{ label: "Availability", href: "/instructor/f/t04-profile-availability" }, ...base];
  }
  if (intent === "at_risk" || intent === "student_support" || intent === "roster") {
    return [
      { label: "Open students", href: "/instructor/f/t09-my-students" },
      { label: "Open gradebook", href: "/instructor/gradebook" },
      ...base,
    ];
  }
  return base;
}

function writePreviewText(question: string): string {
  const short =
    question.trim().length > 160 ? `${question.trim().slice(0, 157).replace(/\s+\S*$/, "")}…` : question.trim();
  return [
    "Teaching Operations Assistant — action preview (not executed)",
    "",
    `You asked: “${short}”`,
    "",
    "Phase 1 stays read-only / draft. No attendance, grade, message, or publication write was applied.",
    "",
    "**Before any write, confirm:**",
    "- Course / offering",
    "- Students affected",
    "- Date and note (if attendance)",
    "- That you are authorized for this section",
    "",
    "Open the matching screen below, review the list, then save yourself — or ask again with “show me the changes before saving” after you switch to a write-enabled workflow.",
  ].join("\n");
}

function groupMissingLines(rows: Array<{ text: string }>) {
  const groups = new Map<string, string[]>();
  const loose: string[] = [];
  for (const row of rows) {
    const m = row.text.match(
      /^(.*?)\s+has not submitted [“"]([^”"]+)[”"] for ([^(]+?)(?:\s*\(due ([^)]+)\))?\.\s*$/i,
    );
    if (!m) {
      loose.push(row.text);
      continue;
    }
    const [, who, assignment, course, due] = m;
    const key = `${assignment.trim()} · ${course.trim()}${due ? ` · due ${due.trim()}` : ""}`;
    const list = groups.get(key) ?? [];
    list.push(who.trim());
    groups.set(key, list);
  }
  return [
    ...[...groups.entries()].map(([key, names]) => `${key}: ${names.join(", ")}`),
    ...loose,
  ];
}

function dashboardText(facts: GroundedCoachFact[], missingRows: Array<{ text: string }> = []) {
  const sessions = factsOf(facts, "session").map((f) => f.text);
  const allCourses = factsOf(facts, "course");
  const primaryCourses = allCourses.filter((f) => !/retake/i.test(f.text) && !/EXRETAKE/i.test(f.title + f.text));
  const retakeCourses = allCourses.filter((f) => /retake/i.test(f.text) || /EXRETAKE/i.test(f.title + f.text));
  const courseLines = [
    ...primaryCourses.slice(0, 5).map((f) => f.text),
    ...(retakeCourses.length
      ? [`${retakeCourses.length} retake section(s) also on your load — ask “show retake students” for detail.`]
      : []),
  ];
  const grades = factsOf(facts, "grade").map((f) => f.text);
  const mail = factsOf(facts, "mail").map((f) => f.text);
  const attendance = factsOf(facts, "attendance").map((f) => f.text);
  const assignments = factsOf(facts, "assignment").map((f) => f.text);
  const roster = factsOf(facts, "roster")
    .filter((f) => !/retake/i.test(f.text) && !/EXRETAKE/i.test(f.title + f.text))
    .map((f) => f.text);
  const missing = groupMissingLines(missingRows.slice(0, 40)).slice(0, 8);

  return [
    "Teaching Operations Assistant — live teaching dashboard (authorized sections only)",
    "",
    card(
      "Today / this week",
      sessions.length
        ? sessions
        : [
            "No timed class sessions on the calendar for today/this week. Your teaching load is listed under My courses — open Calendar if you expect join links or room times.",
          ],
    ),
    "",
    card("My courses", courseLines.length ? courseLines : allCourses.slice(0, 6).map((f) => f.text)),
    "",
    card("Class lists", roster.slice(0, 4)),
    "",
    card("Attendance signals", attendance.slice(0, 6)),
    "",
    card("Assignments due / grading", [...assignments, ...grades].slice(0, 6)),
    "",
    card(
      "Missing submissions",
      missing.length ? missing : ["No missing-submission signals in the current tool set."],
    ),
    "",
    card("Messages", mail.slice(0, 3)),
    "",
    "I can also draft outreach, preview attendance/grade writes (confirm on screen), and open gradebook / attendance / calendar from Next steps.",
  ].join("\n");
}

export function facultyAssistantAnswer(input: {
  question: string;
  rows: Array<{ id: string; title: string; uri: string; text: string }>;
  facts?: GroundedCoachFact[];
  contextPath?: string;
}): GroundedCoachResult {
  const facts = input.facts ?? [];
  const intent = facultyOpsIntent(input.question, input.contextPath);
  const pageHint = pageAwareHint(input.contextPath || "");

  if (intent === "write_preview") {
    const sources =
        (facts.length
          ? facts.slice(0, 4).map(({ id, title, uri }) => ({ id, title, uri }))
          : [{ id: "faculty:write", title: "Your sections", uri: "/instructor/sections" }]);
    const answer = citeOrRefuse({
      text: [writePreviewText(input.question), pageHint].filter(Boolean).join("\n\n"),
      sources,
      tier: "draft",
    });
    return {
      ...answer,
      suggestedActions: actionsFor(intent),
      claims: [
        {
          kind: "action",
          text: "Write preview only — instructor must confirm on the operational screen.",
          evidenceIds: [],
        },
      ],
    };
  }

  if (intent === "dashboard" || intent === "overview" || intent === "schedule") {
    const selected =
      intent === "schedule"
        ? [...factsOf(facts, "session"), ...factsOf(facts, "course")].slice(0, 10)
        : facts.slice(0, 16);
    const text =
      intent === "dashboard" || intent === "overview"
        ? dashboardText(facts, input.rows)
        : [
            "Teaching Operations Assistant — schedule from your authorized sections:",
            "",
            ...selected.map((f, i) => `${i + 1}. ${f.text}`),
            pageHint ? `\n${pageHint}` : "",
          ]
            .filter(Boolean)
            .join("\n");
    const sourceFacts = selected.length ? selected : facts.slice(0, 3);
    const sources = [
      ...sourceFacts.map(({ id, title, uri }) => ({ id, title, uri })),
      ...input.rows.slice(0, 4).map(({ id, title, uri }) => ({ id, title, uri })),
    ];
    if (!sources.length) {
      sources.push({ id: "faculty:empty", title: "Your sections", uri: "/instructor/sections" });
    }
    const answer = citeOrRefuse({ text, sources, tier: "read_only" });
    return {
      ...answer,
      suggestedActions: actionsFor(intent),
      claims: [
        {
          kind: "fact",
          text: `${sourceFacts.length || facts.length} live teaching fact(s).`,
          evidenceIds: sources.map((s) => s.id),
        },
      ],
    };
  }

  // Missing submissions / at-risk — keep dashboard context so we never claim schedule/attendance are unavailable when facts exist
  if ((intent === "assignment" || intent === "at_risk" || intent === "student_support") && input.rows.length) {
    const lines = input.rows.slice(0, 12).map((row, index) => `${index + 1}. ${row.text}`);
    const contextLines = [
      ...factsOf(facts, "session").slice(0, 3).map((f) => f.text),
      ...factsOf(facts, "course").slice(0, 3).map((f) => f.text),
      ...factsOf(facts, "attendance").slice(0, 4).map((f) => f.text),
      ...factsOf(facts, "grade").slice(0, 2).map((f) => f.text),
    ];
    const answer = citeOrRefuse({
      text: [
        intent === "at_risk"
          ? "Student Attention — rule-based signals from your authorized sections:"
          : "Teaching Operations Assistant — missing work in your authorized sections:",
        "",
        ...lines,
        "",
        contextLines.length ? "**Also on your load right now**" : "",
        ...contextLines.map((l) => `- ${l}`),
        "",
        "Risk uses observable academic indicators only (attendance, missing work, draft grades). No medical or personal diagnosis.",
        "Draft outreach is a suggestion — you send messages yourself after review.",
        pageHint || "",
      ]
        .filter(Boolean)
        .join("\n"),
      sources: [
        ...input.rows.map(({ id, title, uri }) => ({ id, title, uri })),
        ...facts.slice(0, 6).map(({ id, title, uri }) => ({ id, title, uri })),
      ],
      tier: "draft",
    });
    return {
      ...answer,
      suggestedActions: actionsFor(intent),
      claims: [
        {
          kind: "fact",
          text: `${input.rows.length} authorized section signal(s) surfaced.`,
          evidenceIds: input.rows.map((r) => r.id),
        },
        {
          kind: "action",
          text: "Review the list and send any check-in from Messages yourself.",
          evidenceIds: [],
        },
      ],
    };
  }

  // Intent-specific fact packs
  const kindMap: Partial<Record<FacultyOpsIntent, GroundedCoachFact["kind"][]>> = {
    roster: ["roster", "course"],
    attendance: ["attendance", "session", "roster"],
    gradebook: ["grade", "assignment", "course"],
    final_grades: ["grade", "assignment", "course"],
    message: ["mail", "notification"],
    badges: ["course", "portal"],
    availability: ["session", "portal"],
    analytics: ["course", "assignment", "attendance", "grade"],
    content: ["course", "assignment"],
    lesson: ["course", "assignment"],
    quiz: ["assignment", "course"],
    groups: ["roster", "course"],
    evaluation: ["course", "notification"],
    audit: ["grade", "attendance", "portal"],
    admin: ["course", "session", "approval"],
    policy: ["institution", "portal"],
    at_risk: ["attendance", "grade", "assignment", "roster"],
    student_support: ["roster", "attendance", "grade", "assignment"],
  };

  const kinds = kindMap[intent] || ["course", "session", "assignment", "grade", "attendance", "mail"];
  let selected = kinds.flatMap((k) => factsOf(facts, k)).slice(0, 10);
  if (!selected.length) selected = facts.slice(0, 6);

  const lead: Record<string, string> = {
    roster: "Class list — students in your authorized sections only:",
    attendance: "Attendance — live marks from your sections:",
    gradebook: "Gradebook — draft and published items you can access:",
    final_grades: "Final-grade preparation — validation cues from live records (submit only after you confirm on the grade submission screen):",
    message: "Communication — inbox signals (send requires your approval):",
    badges: "Badges & competencies — open Badges / Accomplishments to create bases or award:",
    availability: "Office hours / availability — from your profile schedule:",
    analytics: "Course activity signals from authorized sections:",
    content: "Course content — I can draft structure; you approve publication:",
    lesson: "Lesson prep — suggestions should be checked against the approved outline:",
    quiz: "Quiz / question bank — AI items stay drafts until you review:",
    groups: "Groups — recommendations need your approval before changes:",
    evaluation: "Course evaluation — anonymity rules still apply:",
    audit: "Audit / change history — recorded evidence only:",
    admin: "Administrative items within instructor authority:",
    policy: "Policy questions should cite campus knowledge documents when available:",
    at_risk: "Student Attention — observable academic indicators only:",
    student_support: "Student support snapshot — course-scoped records only:",
    assignment: "Assignments & submissions:",
  };

  if (!selected.length && !input.rows.length) {
    const answer = citeOrRefuse({
      text: [
        "No matching teaching records were found in your assigned sections yet.",
        "Open Sections to confirm your load, then ask again.",
        pageHint || "",
      ]
        .filter(Boolean)
        .join("\n"),
      sources: [{ id: "faculty:empty", title: "Your sections", uri: "/instructor/sections" }],
      tier: "read_only",
    });
    return {
      ...answer,
      suggestedActions: actionsFor(intent),
      claims: [{ kind: "uncertainty", text: "No faculty facts for this intent.", evidenceIds: ["faculty:empty"] }],
    };
  }

  const lines = selected.map((f, i) => `${i + 1}. ${f.text}`);
  const answer = citeOrRefuse({
    text: [
      lead[intent] || "Teaching Operations Assistant — live campus records:",
      "",
      ...lines,
      "",
      pageHint || "Ask a follow-up, or open the matching workspace from Next steps.",
    ]
      .filter(Boolean)
      .join("\n"),
    sources: selected.map(({ id, title, uri }) => ({ id, title, uri })),
    tier: intent === "lesson" || intent === "content" || intent === "quiz" || intent === "message" ? "draft" : "read_only",
  });
  return {
    ...answer,
    suggestedActions: actionsFor(intent),
    claims: [
      {
        kind: "fact",
        text: `${selected.length} grounded fact(s) for intent ${intent}.`,
        evidenceIds: selected.map((s) => s.id),
      },
    ],
  };
}
