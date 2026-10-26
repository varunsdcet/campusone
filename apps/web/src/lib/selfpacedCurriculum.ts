/** Topic-wise self-paced content: reading, quiz, matching, evaluation — full program outlines. */

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correct: number;
};

export type MatchingPair = {
  id: string;
  left: string;
  right: string;
};

export type EvaluationRow = {
  component: string;
  weight: string;
};

export type LectureSlide = {
  number: number;
  heading: string;
  bullets: string[];
  narration: string;
};

export type LectureStoryboard = {
  title: string;
  estimated_duration_sec: number;
  slides: LectureSlide[];
};

export type SelfpacedActivity = {
  id: string;
  type: "reading" | "quiz" | "matching" | "evaluation" | "lecture" | "assessment";
  title: string;
  minutes: number;
  html?: string;
  questions?: QuizQuestion[];
  /** Full bank for graded assessments (attempt draws a subset). */
  questionBank?: QuizQuestion[];
  questionCount?: number;
  passMark?: number;
  isFinal?: boolean;
  pairs?: MatchingPair[];
  evaluationRows?: EvaluationRow[];
  storyboard?: LectureStoryboard;
  /** Workplace framing for readings (avoids wrong-sector examples). */
  workplaceHint?: string;
};

export type SelfpacedChapter = {
  id: string;
  title: string;
  summary: string;
  hours: number;
  activities: SelfpacedActivity[];
};

type ChapterSeed = {
  id: string;
  title: string;
  summary: string;
  hours: number;
  focus: string[];
  terms: Array<[string, string]>;
};

function reading(id: string, title: string, minutes: number, html: string): SelfpacedActivity {
  return { id, type: "reading", title, minutes, html };
}

function quiz(id: string, title: string, minutes: number, questions: QuizQuestion[]): SelfpacedActivity {
  return { id, type: "quiz", title, minutes, questions };
}

function matching(id: string, title: string, minutes: number, pairs: MatchingPair[]): SelfpacedActivity {
  return { id, type: "matching", title, minutes, pairs };
}

function evaluation(id: string, title: string, rows: EvaluationRow[]): SelfpacedActivity {
  return { id, type: "evaluation", title, minutes: 8, evaluationRows: rows };
}

function lecture(id: string, title: string, minutes: number, storyboard: LectureStoryboard): SelfpacedActivity {
  return { id, type: "lecture", title, minutes, storyboard };
}

function assessment(
  id: string,
  title: string,
  minutes: number,
  bank: QuizQuestion[],
  opts?: { isFinal?: boolean; questionCount?: number },
): SelfpacedActivity {
  const isFinal = Boolean(opts?.isFinal);
  return {
    id,
    type: "assessment",
    title,
    minutes,
    questionBank: bank,
    questions: bank,
    questionCount: opts?.questionCount || (isFinal ? 40 : 16),
    passMark: 70,
    isFinal,
  };
}

const DEFAULT_EVAL: EvaluationRow[] = [
  { component: "Chapter readings completion", weight: "12%" },
  { component: "Instructor video lectures", weight: "18%" },
  { component: "Chapter quizzes", weight: "25%" },
  { component: "Matching & applied exercises", weight: "15%" },
  { component: "Mid-program checkpoint", weight: "12%" },
  { component: "Final evaluation", weight: "18%" },
];

function makeStoryboard(seed: ChapterSeed): LectureStoryboard {
  const short = seed.title.includes("·") ? seed.title.split("·")[1].trim() : seed.title;
  const f = seed.focus;
  const terms = seed.terms;
  return {
    title: `${short} — Instructor lecture`,
    estimated_duration_sec: 420,
    slides: [
      {
        number: 1,
        heading: `Welcome · ${short}`,
        bullets: [seed.summary, "Taught by your CampusOne instructor avatar", "Watch, then finish the chapter activities"],
        narration: `Welcome to this instructor lecture on ${short}. ${seed.summary} I will walk you through the key ideas, then you can return to your reading, quiz, and matching activities with more confidence.`,
      },
      {
        number: 2,
        heading: "What you will master",
        bullets: f.slice(0, 4),
        narration: `In this chapter, focus on four workplace skills. First, ${f[0]}. Second, ${f[1] || f[0]}. Third, ${f[2] || f[0]}. And finally, ${f[3] || f[1] || f[0]}. Keep these in mind as you watch the rest of the lecture.`,
      },
      {
        number: 3,
        heading: "Key terms",
        bullets: terms.slice(0, 4).map(([left, right]) => `${left}: ${right}`),
        narration: `Let’s lock in the vocabulary. ${terms
          .slice(0, 4)
          .map(([left, right]) => `${left} means ${right}`)
          .join(". ")}. You will see these again in the matching drill.`,
      },
      {
        number: 4,
        heading: "Canadian workplace example",
        bullets: [
          `Apply ${f[0].toLowerCase()} in a real request`,
          "Document the result clearly",
          "Confirm the next owner of the task",
        ],
        narration: `Imagine a busy Canadian workplace. A request arrives late in the day. You clarify the purpose, apply ${f[0].toLowerCase()}, record what you did, and confirm who owns the next step. That calm sequence is what employers expect.`,
      },
      {
        number: 5,
        heading: "Before you continue",
        bullets: ["Finish Reading 1 and 2", "Take the practice quiz", "Complete matching, then the chapter assessment"],
        narration: `When this lecture ends, finish any remaining readings, take the ungraded practice quiz, complete the matching drill, then sit the graded chapter assessment. Pass that assessment and wait for your next unlock date to open the following chapter.`,
      },
    ],
  };
}

function makeQuestions(seed: ChapterSeed, count: number): QuizQuestion[] {
  const short = seed.title.includes("·") ? seed.title.split("·")[1].trim() : seed.title;
  const place = workplaceFor(seed);
  const correctTemplates = [
    (focus: string) => `Follow a clear process for ${focus.toLowerCase()} and document the result`,
    (focus: string) => `Clarify the request, apply ${focus.toLowerCase()}, and confirm the next owner`,
    (focus: string) => `Use the approved checklist for ${focus.toLowerCase()} and keep a privacy-safe record`,
    (focus: string) => `Check requirements first, complete ${focus.toLowerCase()}, then verify accuracy before handoff`,
  ];
  const distractorsFor = (focus: string) => [
    `Skip ${focus.toLowerCase()} and guess the outcome`,
    `Share private details publicly to finish faster`,
    `Leave the task unfinished with no handoff`,
    `Ignore the chapter standards and improvise every time`,
    `Ask a coworker to forge the documentation`,
    `Delete the request so nobody has to follow up`,
    `Escalate every routine task without trying the standard process`,
  ];

  const qs: QuizQuestion[] = [];
  for (let i = 0; i < count; i++) {
    const focus = seed.focus[i % seed.focus.length];
    const termPair = seed.terms.length ? seed.terms[i % seed.terms.length] : null;
    const useTerm = Boolean(termPair) && i % 3 === 2;

    let prompt: string;
    let correctText: string;
    let distractors: string[];

    if (useTerm && termPair) {
      const [term, def] = termPair;
      prompt = `In “${short}”, what does “${term}” mean?`;
      correctText = def;
      distractors = [
        seed.terms[(i + 1) % seed.terms.length]?.[1] || `An unrelated process outside ${short}`,
        seed.terms[(i + 2) % seed.terms.length]?.[1] || "A personal preference with no workplace standard",
        `Skipping documentation for ${focus.toLowerCase()}`,
      ].filter((d) => d && d !== def);
    } else {
      const stems = [
        `You are working in ${place}. What is the best first step for ${focus.toLowerCase()}?`,
        `In “${short}”, which action best demonstrates ${focus.toLowerCase()}?`,
        `A supervisor asks you to apply ${focus.toLowerCase()} under pressure. What should you do?`,
        `Which statement about ${focus.toLowerCase()} is most accurate for this chapter?`,
        `Your team needs evidence you handled ${focus.toLowerCase()} correctly. What do you provide?`,
        `What is the riskiest shortcut when practising ${focus.toLowerCase()}?`,
      ];
      prompt = stems[i % stems.length];
      correctText = correctTemplates[i % correctTemplates.length](focus);
      distractors = distractorsFor(focus);
    }

    while (distractors.length < 3) distractors.push(`Avoid documenting ${focus.toLowerCase()} altogether`);
    const picked = [
      distractors[i % distractors.length],
      distractors[(i + 1) % distractors.length],
      distractors[(i + 2) % distractors.length],
    ];
    const correct = i % 4;
    const ordered: string[] = new Array(4);
    ordered[correct] = correctText;
    let di = 0;
    for (let oi = 0; oi < 4; oi++) {
      if (oi === correct) continue;
      ordered[oi] = picked[di++];
    }
    qs.push({
      id: `${seed.id}-q${i + 1}`,
      prompt,
      options: ordered,
      correct,
    });
  }
  return qs;
}

function makePairs(seed: ChapterSeed): MatchingPair[] {
  const extras: Array<[string, string]> = seed.focus.map((f, i) => [
    `${f.split(" ")[0]} practice`,
    `Hands-on application of ${f.toLowerCase()} with a documented outcome`,
  ]);
  const glossary: Array<[string, string]> = [
    ...seed.terms,
    ...extras,
    ["Handoff note", "Short record of what was done and who owns the next step"],
    ["Quality check", "Final pass for accuracy, privacy, and required fields"],
    ["Escalation path", "Who to ask when the request is unclear or high risk"],
  ];
  const seen = new Set<string>();
  const base: MatchingPair[] = [];
  for (let i = 0; i < glossary.length && base.length < 6; i++) {
    const [left, right] = glossary[i];
    if (seen.has(left)) continue;
    seen.add(left);
    base.push({ id: `m${base.length + 1}`, left, right });
  }
  return base;
}

function workplaceFor(seed: ChapterSeed): string {
  const t = `${seed.title} ${seed.summary}`.toLowerCase();
  if (t.includes("electric") || t.includes("voltage") || t.includes("circuit")) {
    return "a supervised Canadian electrical shop or job site";
  }
  if (t.includes("pharm") || t.includes("dispens") || t.includes("prescription")) {
    return "a Canadian community pharmacy";
  }
  if (t.includes("carpent") || t.includes("framing") || t.includes("red seal")) {
    return "a Canadian construction site";
  }
  if (t.includes("hrm") || t.includes("human resource") || t.includes("talent")) {
    return "a Canadian HR team";
  }
  if (t.includes("computer") || t.includes("spreadsheet") || t.includes("software")) {
    return "a Canadian business office using digital tools";
  }
  return "a busy Canadian office";
}

function richReading(seed: ChapterSeed, part: 1 | 2): string {
  const bullets = seed.focus.map((f) => `<li><strong>${f}</strong> — apply this in ${workplaceFor(seed)}.</li>`).join("");
  const place = workplaceFor(seed);
  if (part === 1) {
    return `<p>${seed.summary}</p>
<h2>Learning objectives</h2>
<ul>${bullets}</ul>
<h2>Why this matters</h2>
<p>Employers expect learners to understand both the concept and the day-to-day workflow. This reading builds the foundation before the instructor lecture and practice activities.</p>
<h2>Core concepts</h2>
<p>Work through each idea carefully. Take notes on definitions, common mistakes, and the handoff points between roles.</p>
<ol>
  <li>Read the workplace context for this chapter.</li>
  <li>Identify the decision points and documentation needed.</li>
  <li>Connect the idea to a tool, form, or conversation you would use on the job.</li>
</ol>
<h2>Worked example</h2>
<p>Imagine ${place}. A request arrives late in the day. You clarify the purpose, choose the right process for ${seed.focus[0].toLowerCase()}, record what you did, and confirm the next owner of the task. Follow your site procedure and supervisor when safety or regulated steps apply.</p>
<h2>Key takeaways</h2>
<ul>
  <li>Accuracy and tone matter as much as speed.</li>
  <li>Clear records protect clients, staff, and the organization.</li>
  <li>Finish reading part 2, then watch the instructor lecture before the practice quiz.</li>
</ul>`;
  }
  return `<p>Part 2 deepens “${seed.title}” with applied practice and quality checks in ${place}.</p>
<h2>Applied checklist</h2>
<ul>${bullets}</ul>
<h2>Quality standards</h2>
<p>Before you mark work complete, verify spelling, required fields, privacy, and that the right person received the update. For trades and health steps, quote the course text and follow your site procedure and supervisor.</p>
<h2>Common mistakes</h2>
<ul>
  <li>Starting work without clarifying the request</li>
  <li>Using the wrong template or tool</li>
  <li>Skipping confirmation or follow-up</li>
</ul>
<h2>Try it yourself</h2>
<p>Write a short action plan for a scenario involving ${seed.focus[1]?.toLowerCase() || seed.focus[0].toLowerCase()}. Include what you would check, who you would notify, and how you would store the record.</p>
<h2>Before the chapter assessment</h2>
<p>Review your notes, watch the lecture, complete the practice quiz and matching drill, then sit the graded chapter assessment.</p>`;
}

/** Full chapter: readings → lecture → practice quiz → matching → graded assessment */
function richChapter(seed: ChapterSeed): SelfpacedChapter {
  const shortTitle = seed.title.includes("·") ? seed.title.split("·")[1].trim() : seed.title;
  const bank = makeQuestions(seed, 48);
  return {
    id: seed.id,
    title: seed.title,
    summary: seed.summary,
    hours: seed.hours,
    activities: [
      reading(`${seed.id}-read-1`, `${shortTitle} — Reading 1 · Foundations`, 18, richReading(seed, 1)),
      reading(`${seed.id}-read-2`, `${shortTitle} — Reading 2 · Application`, 16, richReading(seed, 2)),
      lecture(`${seed.id}-lecture`, `${shortTitle} — Instructor Lecture`, 8, makeStoryboard(seed)),
      quiz(`${seed.id}-practice`, `${shortTitle} — Practice Quiz`, 15, makeQuestions(seed, 5)),
      matching(`${seed.id}-match`, `${shortTitle} — Matching Drill`, 12, makePairs(seed)),
      assessment(`${seed.id}-assess`, `${shortTitle} — Chapter Assessment`, 35, bank, { questionCount: 16 }),
    ],
  };
}

function closingLecture(prefix: string, label: string): SelfpacedActivity {
  return lecture(`${prefix}-closing-lecture`, `${label} — Closing Instructor Lecture`, 10, {
    title: `${label} — Closing lecture`,
    estimated_duration_sec: 480,
    slides: [
      {
        number: 1,
        heading: "Congratulations on reaching the end",
        bullets: ["You completed the chapter pathway", "Readings, quizzes, matching, and lectures", "One final review before your certificate"],
        narration: `Congratulations. You have reached the closing lecture for ${label}. Across this program you practiced readings, quizzes, matching drills, and instructor video lectures. This final talk ties the pathway together before your evaluation checkpoint.`,
      },
      {
        number: 2,
        heading: "What employers notice",
        bullets: ["Clear process and documentation", "Professional tone under pressure", "Privacy and accuracy habits"],
        narration: `Canadian employers notice three habits: you follow a clear process and document the result, you keep a professional tone when work gets busy, and you protect privacy while staying accurate. Those habits are the real certificate behind the branded certificate.`,
      },
      {
        number: 3,
        heading: "How to finish strong",
        bullets: ["Review evaluation weights", "Retake any weak practice quizzes", "Mark the final checkpoint complete"],
        narration: `To finish strong, review the evaluation criteria, re-attempt any practice quizzes you found difficult, then complete the final checkpoint. When those are done, you are ready for your CampusOne branded certificate.`,
      },
      {
        number: 4,
        heading: "Thank you",
        bullets: ["Keep your study log", "Apply one idea at work this week", "Return to any chapter lecture anytime"],
        narration: `Thank you for learning with CampusOne. Keep a short study log, apply one idea from this program at work this week, and remember you can replay any chapter lecture whenever you need a refresher. I am proud of the work you put in.`,
      },
    ],
  });
}

function withEval(prefix: string, label: string, chapters: SelfpacedChapter[]): SelfpacedChapter[] {
  const finalBank = chapters.flatMap((ch) => {
    const assess = ch.activities.find((a) => a.type === "assessment");
    return (assess?.questionBank || assess?.questions || []).slice(0, 8);
  });
  while (finalBank.length < 50) {
    finalBank.push({
      id: `final-extra-${finalBank.length}`,
      prompt: `Program-wide: what best describes professional practice in ${label}?`,
      options: [
        "Skip documentation to save time",
        "Follow process, protect privacy, and confirm handoffs",
        "Share credentials with classmates",
        "Ignore supervisor guidance on site",
      ],
      correct: 1,
    });
  }
  return [
    ...chapters,
    {
      id: `${prefix}-final`,
      title: `${label} · Final Exam`,
      summary: `Timed final exam covering all ${label} chapters. Certificate issues only on a pass.`,
      hours: 4,
      activities: [
        reading(
          `${prefix}-final-prep`,
          "Final exam preparation",
          12,
          `<p>This final exam draws questions from every chapter bank plus exam-only items. Coach is <strong>off</strong> during the attempt. You have up to two attempts with a 48-hour cooldown and remediation between tries.</p>
<ul>
  <li>Review weak chapter assessments first.</li>
  <li>Replay instructor lectures for chapters you scored below 70%.</li>
  <li>Budget about 90 minutes for the timed final.</li>
</ul>`,
        ),
        closingLecture(prefix, label),
        evaluation(`${prefix}-eval-sheet`, "Evaluation Criteria", [
          { component: "Chapter readings & lectures", weight: "20%" },
          { component: "Practice quizzes & matching", weight: "15%" },
          { component: "Chapter assessments", weight: "40%" },
          { component: "Final exam", weight: "25%" },
        ]),
        assessment(`${prefix}-final-exam`, "Final Exam", 90, finalBank, { isFinal: true, questionCount: 40 }),
      ],
    },
  ];
}

function buildFromSeeds(seeds: ChapterSeed[]): SelfpacedChapter[] {
  return seeds.map(richChapter);
}

const capstoneSeeds: ChapterSeed[] = [
  {
    id: "cap-01", title: "Module 1 · Capstone Orientation and Project Charter", hours: 10,
    summary: "Set the project purpose, scope, roles, constraints, and evidence standards for an applied business capstone.",
    focus: ["Problem framing", "Project scope", "Team roles", "Success measures"],
    terms: [["Project charter", "Agreement defining purpose, scope and ownership"], ["Scope", "The agreed boundary of project work"], ["Deliverable", "A concrete project output"], ["Success measure", "Evidence used to judge the result"]],
  },
  {
    id: "cap-02", title: "Module 2 · Client Discovery and Stakeholder Analysis", hours: 10,
    summary: "Gather credible client needs and map the people who influence, use, or approve the proposed solution.",
    focus: ["Discovery interviews", "Stakeholder mapping", "Needs analysis", "Consent and confidentiality"],
    terms: [["Stakeholder", "Person or group affected by the project"], ["Discovery", "Structured fact-finding before solution design"], ["Influence map", "View of stakeholder power and interest"], ["Consent", "Permission to collect or use information"]],
  },
  {
    id: "cap-03", title: "Module 3 · Business Research and Evidence Quality", hours: 10,
    summary: "Build a reliable evidence base using ethical research, source evaluation, and consistent documentation.",
    focus: ["Research questions", "Source credibility", "Primary evidence", "Citation records"],
    terms: [["Primary research", "Evidence collected directly for the project"], ["Secondary research", "Existing published evidence"], ["Triangulation", "Checking a finding with multiple sources"], ["Bias", "A systematic influence on evidence or judgment"]],
  },
  {
    id: "cap-04", title: "Module 4 · Data Analysis and Business Insight", hours: 10,
    summary: "Clean, organize, analyse, and explain business data without overstating what the evidence supports.",
    focus: ["Data cleanup", "Trend analysis", "Root causes", "Insight statements"],
    terms: [["Data validation", "Checks that improve data accuracy"], ["Trend", "A pattern observed over time"], ["Root cause", "Underlying reason a problem occurs"], ["Insight", "Decision-relevant meaning drawn from evidence"]],
  },
  {
    id: "cap-05", title: "Module 5 · Market and Competitive Context", hours: 10,
    summary: "Assess customers, alternatives, competitors, and external forces shaping the client decision.",
    focus: ["Customer segments", "Competitor review", "Value proposition", "External environment"],
    terms: [["Segment", "Customer group with shared needs"], ["Benchmark", "Comparison point for performance"], ["Value proposition", "Reason a customer chooses an offer"], ["Differentiator", "Meaningful advantage over alternatives"]],
  },
  {
    id: "cap-06", title: "Module 6 · Solution Design and Option Appraisal", hours: 10,
    summary: "Generate feasible options and use transparent criteria to recommend the strongest response to the problem.",
    focus: ["Option generation", "Decision criteria", "Feasibility", "Recommendation logic"],
    terms: [["Option appraisal", "Structured comparison of possible solutions"], ["Feasibility", "Whether an option can realistically be delivered"], ["Trade-off", "Benefit accepted at the cost of another benefit"], ["Decision matrix", "Weighted comparison of options"]],
  },
  {
    id: "cap-07", title: "Module 7 · Financial Reasoning and Business Case", hours: 10,
    summary: "Estimate costs, benefits, assumptions, and sensitivity so decision-makers can assess the recommendation.",
    focus: ["Cost estimates", "Benefit estimates", "Break-even thinking", "Sensitivity checks"],
    terms: [["Business case", "Evidence and economics supporting a decision"], ["Fixed cost", "Cost unchanged by activity volume"], ["Break-even", "Point where benefits cover costs"], ["Sensitivity", "How results change when assumptions change"]],
  },
  {
    id: "cap-08", title: "Module 8 · Risk, Ethics and Compliance", hours: 10,
    summary: "Identify operational, financial, privacy, people, and reputation risks and plan proportionate controls.",
    focus: ["Risk register", "Ethical review", "Privacy controls", "Mitigation ownership"],
    terms: [["Risk register", "Record of risks, ratings, controls and owners"], ["Likelihood", "Chance that a risk occurs"], ["Impact", "Consequence if a risk occurs"], ["Mitigation", "Action reducing likelihood or impact"]],
  },
  {
    id: "cap-09", title: "Module 9 · Implementation and Change Plan", hours: 10,
    summary: "Translate the recommendation into sequenced work, ownership, communication, resources, and checkpoints.",
    focus: ["Work breakdown", "Timeline", "Change communication", "Adoption measures"],
    terms: [["Milestone", "Significant delivery checkpoint"], ["Dependency", "Work that relies on another task"], ["Change plan", "Approach for moving people to a new way of working"], ["Adoption", "Extent to which people use the solution"]],
  },
  {
    id: "cap-10", title: "Module 10 · Professional Report Writing", hours: 10,
    summary: "Build an executive-ready report with clear claims, traceable evidence, visuals, and actionable recommendations.",
    focus: ["Executive summary", "Evidence structure", "Data visuals", "Editing and citation"],
    terms: [["Executive summary", "Concise decision-focused overview"], ["Finding", "Statement supported by analysed evidence"], ["Appendix", "Supporting material outside the main report"], ["Citation", "Traceable acknowledgement of a source"]],
  },
  {
    id: "cap-11", title: "Module 11 · Presentation and Stakeholder Pitch", hours: 10,
    summary: "Deliver a concise, evidence-led presentation and respond professionally to challenge and feedback.",
    focus: ["Narrative structure", "Slide design", "Delivery practice", "Question handling"],
    terms: [["Pitch", "Focused presentation intended to secure a decision"], ["Call to action", "Specific next step requested from the audience"], ["Speaker note", "Private prompt supporting delivery"], ["Rehearsal", "Practice used to improve timing and clarity"]],
  },
  {
    id: "cap-12", title: "Module 12 · Capstone Submission and Reflection", hours: 10,
    summary: "Complete quality assurance, submit the integrated capstone package, and reflect on professional growth.",
    focus: ["Quality assurance", "Final submission", "Feedback response", "Professional reflection"],
    terms: [["Quality assurance", "Checks that confirm standards are met"], ["Sign-off", "Formal approval of a deliverable"], ["Reflection", "Evidence-based review of learning and performance"], ["Action plan", "Specific next steps for continued improvement"]],
  },
];

const officeSeeds: ChapterSeed[] = [
  {
    id: "oa-01",
    title: "Chapter 1 · Modern Office Foundations",
    summary: "Roles, workflows, and professional standards in Canadian workplaces.",
    hours: 28,
    focus: ["Workflow ownership", "Professional tone", "Confidentiality", "Handoffs"],
    terms: [
      ["PIPEDA", "Privacy rules for personal information"],
      ["SOP", "Standard operating procedure"],
      ["Agenda", "Meeting purpose and timed points"],
      ["Reception log", "Visitor and front-desk record"],
    ],
  },
  {
    id: "oa-02",
    title: "Chapter 2 · Digital Productivity Suite",
    summary: "Word, Excel, Outlook, and shared drives for real administrative work.",
    hours: 32,
    focus: ["Templates", "Shared calendars", "File naming", "Version control"],
    terms: [
      ["Mail merge", "Personalized letters from a list"],
      ["Pivot table", "Spreadsheet summary by category"],
      ["Shared drive", "Central files with permissions"],
      ["Template", "Reusable document format"],
    ],
  },
  {
    id: "oa-03",
    title: "Chapter 3 · Records & Information Control",
    summary: "Filing systems, retention schedules, and findable records.",
    hours: 30,
    focus: ["Retention", "Indexing", "Access control", "Audit trail"],
    terms: [
      ["Retention schedule", "How long records must be kept"],
      ["Alphabetical filing", "Organize by name"],
      ["Access log", "Who viewed or changed a file"],
      ["Archive", "Long-term storage of inactive records"],
    ],
  },
  {
    id: "oa-04",
    title: "Chapter 4 · Professional Communication",
    summary: "Email, phone, and meeting language for Canadian offices.",
    hours: 30,
    focus: ["Email tone", "Call scripts", "Meeting notes", "Escalation"],
    terms: [
      ["Subject line", "Clear email purpose"],
      ["CC", "Informational copy recipients"],
      ["Action item", "Task assigned after discussion"],
      ["Hold music script", "Consistent phone greeting"],
    ],
  },
  {
    id: "oa-05",
    title: "Chapter 5 · Scheduling & Calendars",
    summary: "Shared calendars, agendas, and conflict-free booking.",
    hours: 28,
    focus: ["Availability checks", "Room booking", "Reminders", "Rescheduling"],
    terms: [
      ["Hard hold", "Confirmed calendar reservation"],
      ["Soft hold", "Tentative booking"],
      ["Buffer time", "Gap between meetings"],
      ["Recurring event", "Series on a schedule"],
    ],
  },
  {
    id: "oa-06",
    title: "Chapter 6 · Customer Service Excellence",
    summary: "Front-line recovery, tone, and professional escalation.",
    hours: 30,
    focus: ["Service recovery", "Active listening", "Complaint logging", "Follow-up"],
    terms: [
      ["Service recovery", "Repair trust after a failure"],
      ["SLA", "Service level agreement timing"],
      ["Ticket", "Tracked service request"],
      ["Empathy statement", "Acknowledge the client’s concern"],
    ],
  },
  {
    id: "oa-07",
    title: "Chapter 7 · Word Processing for Business",
    summary: "Letters, proposals, and consistent document standards.",
    hours: 34,
    focus: ["Styles", "Letter formats", "Headers/footers", "Proofreading"],
    terms: [
      ["Style set", "Consistent heading and body formatting"],
      ["Block letter", "Business letter layout"],
      ["Track changes", "Review edits in a document"],
      ["Boilerplate", "Approved reusable text"],
    ],
  },
  {
    id: "oa-08",
    title: "Chapter 8 · Spreadsheets & Reporting",
    summary: "Trackers, summaries, and clean numbers for managers.",
    hours: 36,
    focus: ["Data cleanup", "Formulas", "Charts", "Weekly reports"],
    terms: [
      ["Absolute reference", "Locked cell in a formula"],
      ["Filter", "Show matching rows only"],
      ["Dashboard", "Summary view of key metrics"],
      ["Data validation", "Limit allowed cell values"],
    ],
  },
  {
    id: "oa-09",
    title: "Chapter 9 · Email & Inbox Workflows",
    summary: "Rules, folders, follow-ups, and professional threads.",
    hours: 28,
    focus: ["Inbox zero habits", "Rules/filters", "Follow-up cadence", "Attachment hygiene"],
    terms: [
      ["Flag", "Mark message for follow-up"],
      ["Distribution list", "Group email recipients"],
      ["Recall", "Attempt to withdraw a sent message"],
      ["Thread", "Related message conversation"],
    ],
  },
  {
    id: "oa-10",
    title: "Chapter 10 · Travel, Expenses & Logistics",
    summary: "Bookings, expense rules, and vendor coordination.",
    hours: 30,
    focus: ["Travel policy", "Expense coding", "Vendor emails", "Approvals"],
    terms: [
      ["Per diem", "Daily allowance for travel costs"],
      ["PO", "Purchase order authorization"],
      ["Itinerary", "Travel schedule details"],
      ["Reconciliation", "Match receipts to claims"],
    ],
  },
  {
    id: "oa-11",
    title: "Chapter 11 · Capstone Office Project",
    summary: "Apply the full office workflow to one realistic Canadian case.",
    hours: 40,
    focus: ["End-to-end process", "Quality checklist", "Stakeholder updates", "Final package"],
    terms: [
      ["Capstone", "Final integrated project"],
      ["Deliverable", "Concrete work product"],
      ["Sign-off", "Formal approval to close"],
      ["Lessons learned", "Post-project improvements"],
    ],
  },
];

const pharmacySeeds: ChapterSeed[] = [
  {
    id: "ph-01",
    title: "Chapter 1 · Pharmacy Operations Basics",
    summary: "Retail and community pharmacy roles, workflow, and safety culture.",
    hours: 30,
    focus: ["Role boundaries", "Workflow stations", "Safety culture", "Privacy"],
    terms: [
      ["DIN", "Drug identification number"],
      ["OTC", "Over-the-counter product"],
      ["Rx", "Prescription"],
      ["Auxiliary label", "Extra caution or usage label"],
    ],
  },
  {
    id: "ph-02",
    title: "Chapter 2 · Prescription Intake",
    summary: "Receiving, verifying, and tracking prescription requests.",
    hours: 32,
    focus: ["Intake checklist", "Missing information", "Status updates", "Queue management"],
    terms: [
      ["Hard copy", "Paper prescription"],
      ["E-prescribe", "Electronic prescription"],
      ["Refill", "Repeat dispense authorization"],
      ["Prior auth", "Payer approval before fill"],
    ],
  },
  {
    id: "ph-03",
    title: "Chapter 3 · Inventory & Expiry Control",
    summary: "Ordering, receiving, FEFO, and cold-chain awareness.",
    hours: 30,
    focus: ["FEFO", "Receiving checks", "Expiry pulls", "Shortage notes"],
    terms: [
      ["FEFO", "First expired, first out"],
      ["Par level", "Minimum stock target"],
      ["Cold chain", "Temperature-controlled handling"],
      ["Recall", "Product withdrawal notice"],
    ],
  },
  {
    id: "ph-04",
    title: "Chapter 4 · Patient Communication",
    summary: "Respectful service, privacy, and escalation pathways.",
    hours: 28,
    focus: ["Greeting scripts", "Privacy at the counter", "Escalation to pharmacist", "Difficult conversations"],
    terms: [
      ["PHI", "Protected health information"],
      ["Counselling", "Pharmacist medication guidance"],
      ["Queue ticket", "Order of service"],
      ["Consent", "Permission to share information"],
    ],
  },
  {
    id: "ph-05",
    title: "Chapter 5 · Dispensing Support",
    summary: "Labels, packaging support, and double-check habits.",
    hours: 34,
    focus: ["Label accuracy", "Counting support", "Bag check prompts", "Ready-for-pickup"],
    terms: [
      ["SIG", "Directions for use"],
      ["NDC/DIN match", "Product identity check"],
      ["Adjudication", "Insurance claim processing"],
      ["Partial fill", "Dispense less than full quantity"],
    ],
  },
  {
    id: "ph-06",
    title: "Chapter 6 · Insurance & Billing Basics",
    summary: "Coverage checks, common reject codes, and polite explanations.",
    hours: 30,
    focus: ["Coverage verification", "Reject handling", "Copay communication", "Documentation"],
    terms: [
      ["BIN/PCN", "Payer routing identifiers"],
      ["Reject code", "Claim denial reason"],
      ["Copay", "Patient portion of cost"],
      ["Coordination of benefits", "Multiple coverage order"],
    ],
  },
  {
    id: "ph-07",
    title: "Chapter 7 · Compounding & Special Handles Intro",
    summary: "Awareness of specialty workflows and when to escalate.",
    hours: 28,
    focus: ["Specialty flags", "Hazard awareness", "Escalation triggers", "Clean workspace"],
    terms: [
      ["Compound", "Custom prepared medication"],
      ["Hazardous drug", "Requires special handling"],
      ["Beyond-use date", "Custom expiry for compounds"],
      ["Cleanroom", "Controlled compounding area"],
    ],
  },
  {
    id: "ph-08",
    title: "Chapter 8 · Ethics & Professional Boundaries",
    summary: "Privacy, honesty, and scope of practice in pharmacy support roles.",
    hours: 26,
    focus: ["Scope of practice", "Honesty with errors", "Privacy incidents", "Team respect"],
    terms: [
      ["Near miss", "Error caught before reaching patient"],
      ["Incident report", "Formal safety documentation"],
      ["Conflict of interest", "Personal bias affecting duty"],
      ["Whistleblowing path", "Reporting serious concerns"],
    ],
  },
  {
    id: "ph-09",
    title: "Chapter 9 · Capstone Pharmacy Shift",
    summary: "Simulate a full shift: intake, inventory, service, and handoff.",
    hours: 36,
    focus: ["Shift opening", "Priority queue", "End-of-day checks", "Handoff notes"],
    terms: [
      ["Shift report", "Handoff summary"],
      ["Cycle count", "Inventory spot check"],
      ["Will-call", "Ready prescriptions awaiting pickup"],
      ["Closing checklist", "End-of-day safety and cash steps"],
    ],
  },
];

const electricalSeeds: ChapterSeed[] = [
  {
    id: "el-01",
    title: "Chapter 1 · Electrical Safety Culture",
    summary: "PPE, lockout awareness, and hazard recognition.",
    hours: 26,
    focus: ["PPE", "Hazard spotting", "Lockout awareness", "Emergency response"],
    terms: [
      ["PPE", "Personal protective equipment"],
      ["LOTO", "Lockout/tagout"],
      ["Arc flash", "Electrical explosion hazard"],
      ["GFCI", "Ground-fault circuit interrupter"],
    ],
  },
  {
    id: "el-02",
    title: "Chapter 2 · Voltage, Current & Resistance",
    summary: "Ohm’s law foundations for entry-level trades pathways.",
    hours: 28,
    focus: ["Ohm’s law", "Series vs parallel", "Units", "Safe measurement setup"],
    terms: [
      ["Volt", "Electrical potential"],
      ["Ampere", "Current flow"],
      ["Ohm", "Resistance unit"],
      ["Watt", "Power unit"],
    ],
  },
  {
    id: "el-03",
    title: "Chapter 3 · Circuits & Components",
    summary: "Conductors, loads, switches, and basic circuit paths.",
    hours: 28,
    focus: ["Open/closed circuits", "Loads", "Switches", "Conductors/insulators"],
    terms: [
      ["Conductor", "Allows current flow"],
      ["Insulator", "Resists current flow"],
      ["Load", "Device using power"],
      ["Short circuit", "Unintended low-resistance path"],
    ],
  },
  {
    id: "el-04",
    title: "Chapter 4 · Meters & Measurement",
    summary: "Multimeter settings, readings, and common mistakes.",
    hours: 30,
    focus: ["Meter settings", "Probe safety", "Reading interpretation", "Zero-energy verify"],
    terms: [
      ["Multimeter", "Measures V/I/R"],
      ["Continuity", "Complete path for current"],
      ["Range", "Meter scale setting"],
      ["Polarity", "Positive/negative orientation"],
    ],
  },
  {
    id: "el-05",
    title: "Chapter 5 · Troubleshooting Method",
    summary: "A methodical fault-finding sequence instead of guessing.",
    hours: 30,
    focus: ["Symptom gather", "Isolate sections", "Verify fix", "Document findings"],
    terms: [
      ["Open circuit", "Broken path, no current"],
      ["Ground fault", "Unwanted path to ground"],
      ["Intermittent", "Fault that comes and goes"],
      ["Root cause", "Underlying reason for failure"],
    ],
  },
  {
    id: "el-06",
    title: "Chapter 6 · Prints & Symbols Intro",
    summary: "Read simple schematics and common electrical symbols.",
    hours: 26,
    focus: ["Symbol recognition", "One-line basics", "Legend use", "Revision checks"],
    terms: [
      ["Schematic", "Circuit diagram"],
      ["Legend", "Symbol key"],
      ["One-line", "Simplified power diagram"],
      ["Revision cloud", "Mark of drawing changes"],
    ],
  },
  {
    id: "el-07",
    title: "Chapter 7 · Workplace Readiness",
    summary: "Jobsite communication, tool care, and Canadian safety habits.",
    hours: 24,
    focus: ["Toolbox talks", "Tool inspection", "Clear communication", "Housekeeping"],
    terms: [
      ["Toolbox talk", "Short safety briefing"],
      ["SDS", "Safety data sheet"],
      ["Near miss", "Almost-incident report"],
      ["Permit", "Authorization for special work"],
    ],
  },
  {
    id: "el-08",
    title: "Chapter 8 · Capstone Fault Scenario",
    summary: "Apply safety, measurement, and troubleshooting to one case.",
    hours: 32,
    focus: ["Plan the test", "Measure safely", "Fix hypothesis", "Report clearly"],
    terms: [
      ["Test plan", "Ordered measurement steps"],
      ["As-found", "Condition before repair"],
      ["As-left", "Condition after repair"],
      ["Sign-off", "Work acceptance"],
    ],
  },
];

const carpentrySeeds: ChapterSeed[] = [
  {
    id: "rc-01",
    title: "Chapter 1 · Red Seal Blueprint Reading",
    summary: "Plans, symbols, scales, and detail callouts.",
    hours: 70,
    focus: ["Scale", "Elevations", "Sections", "Detail callouts"],
    terms: [
      ["Elevation", "Vertical face view"],
      ["Section", "Cut-through view"],
      ["Scale", "Drawing-to-real ratio"],
      ["Detail callout", "Enlarged connection reference"],
    ],
  },
  {
    id: "rc-02",
    title: "Chapter 2 · Materials & Fasteners",
    summary: "Lumber grades, engineered products, and fastening choices.",
    hours: 60,
    focus: ["Lumber selection", "Engineered wood", "Fastener types", "Corrosion notes"],
    terms: [
      ["Joist", "Horizontal floor support"],
      ["Stud", "Vertical wall framing member"],
      ["Header", "Beam over an opening"],
      ["Hurricane tie", "Connector resisting uplift"],
    ],
  },
  {
    id: "rc-03",
    title: "Chapter 3 · Framing Systems",
    summary: "Walls, floors, roofs, and load-path thinking for exam questions.",
    hours: 70,
    focus: ["Load path", "Floor systems", "Wall framing", "Roof basics"],
    terms: [
      ["Bearing wall", "Wall carrying structural load"],
      ["Span", "Distance between supports"],
      ["Rafter", "Roof framing member"],
      ["Blocking", "Short framing for support/nailing"],
    ],
  },
  {
    id: "rc-04",
    title: "Chapter 4 · Code-Aware Detailing",
    summary: "Common code-style distractors and safe detailing habits.",
    hours: 70,
    focus: ["Clearances", "Moisture control", "Stairs/openings awareness", "Exam wording"],
    terms: [
      ["Riser", "Vertical stair face"],
      ["Tread", "Horizontal stair step"],
      ["Flashing", "Water-shedding sheet metal"],
      ["Vapour barrier", "Moisture control layer"],
    ],
  },
  {
    id: "rc-05",
    title: "Chapter 5 · Timed Exam Strategy",
    summary: "Practice pacing, elimination, and Red Seal readiness drills.",
    hours: 70,
    focus: ["Pacing", "Eliminate distractors", "Flag and return", "Final review"],
    terms: [
      ["Stem", "Exam question prompt"],
      ["Distractor", "Plausible wrong option"],
      ["Keyed response", "Official correct answer"],
      ["Blueprint weighting", "Exam topic emphasis"],
    ],
  },
];

function remapSeeds(seeds: ChapterSeed[], prefix: string, tradeLabel: string): ChapterSeed[] {
  return seeds.map((s, i) => ({
    ...s,
    id: `${prefix}-${String(i + 1).padStart(2, "0")}`,
    title: s.title.replace(/^Chapter \d+ · /, `Chapter ${i + 1} · `),
    summary: `${tradeLabel} exam focus — ${s.summary}`,
  }));
}

const plumberSeeds: ChapterSeed[] = [
  {
    id: "pl-01",
    title: "Chapter 1 · Plumbing Code & Safety",
    summary: "Code awareness, PPE, and safe jobsite habits for plumbers.",
    hours: 55,
    focus: ["Code references", "PPE", "Confined space awareness", "Tool safety"],
    terms: [
      ["DWV", "Drain, waste, and vent"],
      ["Rough-in", "Piping before finishes"],
      ["Fixture unit", "Load value for fixtures"],
      ["Backflow", "Reverse flow contamination risk"],
    ],
  },
  {
    id: "pl-02",
    title: "Chapter 2 · Water Supply Systems",
    summary: "Sizing, materials, and pressure considerations on exam stems.",
    hours: 55,
    focus: ["Pipe materials", "Pressure", "Sizing basics", "Isolation valves"],
    terms: [
      ["Potable", "Safe drinking water"],
      ["PRV", "Pressure reducing valve"],
      ["Cross-connection", "Link between potable and non-potable"],
      ["Shutoff", "Valve that isolates a branch"],
    ],
  },
  {
    id: "pl-03",
    title: "Chapter 3 · Drainage & Venting",
    summary: "Traps, vents, and common DWV exam distractors.",
    hours: 55,
    focus: ["Trap seals", "Venting purpose", "Slope", "Cleanouts"],
    terms: [
      ["P-trap", "Trap shape holding water seal"],
      ["Stack", "Vertical drain/vent main"],
      ["Cleanout", "Access for clearing blockages"],
      ["Air admittance", "Mechanical venting device"],
    ],
  },
  {
    id: "pl-04",
    title: "Chapter 4 · Fixtures & Installations",
    summary: "Install sequence, clearances, and finish connections.",
    hours: 55,
    focus: ["Clearances", "Supports", "Sealants", "Commissioning"],
    terms: [
      ["Closet flange", "Toilet connection flange"],
      ["Escutcheon", "Finish cover plate"],
      ["Tailpiece", "Fixture drain connector"],
      ["Stop valve", "Fixture supply shutoff"],
    ],
  },
  {
    id: "pl-05",
    title: "Chapter 5 · Timed Exam Strategy",
    summary: "Pacing, elimination, and Red Seal plumber readiness drills.",
    hours: 55,
    focus: ["Pacing", "Eliminate distractors", "Flag and return", "Final review"],
    terms: [
      ["Stem", "Exam question prompt"],
      ["Distractor", "Plausible wrong option"],
      ["Keyed response", "Official correct answer"],
      ["Blueprint weighting", "Exam topic emphasis"],
    ],
  },
];

const chefSeeds: ChapterSeed[] = [
  {
    id: "ch-01",
    title: "Chapter 1 · Culinary Foundations & Safety",
    summary: "Food safety, mise en place, and professional kitchen standards.",
    hours: 50,
    focus: ["Food safety", "Mise en place", "Knife skills", "Sanitation"],
    terms: [
      ["HACCP", "Hazard analysis critical control points"],
      ["FIFO", "First in, first out stock rotation"],
      ["Mise en place", "Everything in its place"],
      ["Cross-contamination", "Transfer of harmful bacteria"],
    ],
  },
  {
    id: "ch-02",
    title: "Chapter 2 · Stocks, Sauces & Methods",
    summary: "Classical methods and exam-ready cooking science.",
    hours: 50,
    focus: ["Stocks", "Mother sauces", "Moist heat", "Dry heat"],
    terms: [
      ["Roux", "Fat and flour thickener"],
      ["Emulsion", "Stable mix of oil and liquid"],
      ["Braise", "Sear then slow moist cook"],
      ["Reduce", "Concentrate by simmering"],
    ],
  },
  {
    id: "ch-03",
    title: "Chapter 3 · Proteins, Produce & Baking Basics",
    summary: "Doneness, yields, and pastry fundamentals for Red Seal stems.",
    hours: 50,
    focus: ["Doneness", "Yields", "Vegetable cuts", "Baking ratios"],
    terms: [
      ["Carryover cooking", "Heat continuing after removal"],
      ["Proofing", "Final yeast rise"],
      ["Julienne", "Thin matchstick cut"],
      ["Temper", "Gently raise temperature"],
    ],
  },
  {
    id: "ch-04",
    title: "Chapter 4 · Costing & Kitchen Leadership",
    summary: "Portion cost, waste control, and brigade communication.",
    hours: 50,
    focus: ["Food cost", "Waste", "Portion control", "Brigade roles"],
    terms: [
      ["Food cost %", "Ingredient cost over sales"],
      ["Par stock", "Minimum inventory level"],
      ["Brigade", "Kitchen role hierarchy"],
      ["Plate cost", "Cost of one plated dish"],
    ],
  },
  {
    id: "ch-05",
    title: "Chapter 5 · Timed Exam Strategy",
    summary: "Pacing and elimination tactics for the Red Seal chef exam.",
    hours: 50,
    focus: ["Pacing", "Eliminate distractors", "Flag and return", "Final review"],
    terms: [
      ["Stem", "Exam question prompt"],
      ["Distractor", "Plausible wrong option"],
      ["Keyed response", "Official correct answer"],
      ["Blueprint weighting", "Exam topic emphasis"],
    ],
  },
];

const hvacSeeds: ChapterSeed[] = [
  {
    id: "hv-01",
    title: "Chapter 1 · HVAC Safety & Refrigerants",
    summary: "Safe handling, recovery awareness, and jobsite hazards.",
    hours: 55,
    focus: ["PPE", "Refrigerant awareness", "Electrical hazards", "Recovery basics"],
    terms: [
      ["Recovery", "Remove refrigerant into a cylinder"],
      ["Gauge manifold", "Service pressure gauges"],
      ["Lockout", "Isolate energy before service"],
      ["Refrigerant", "Working fluid in the cooling cycle"],
    ],
  },
  {
    id: "hv-02",
    title: "Chapter 2 · Refrigeration Cycle",
    summary: "Compression, condensation, expansion, and evaporation.",
    hours: 55,
    focus: ["Compression", "Condensation", "Expansion", "Evaporation"],
    terms: [
      ["Superheat", "Vapour temperature above saturation"],
      ["Subcooling", "Liquid temperature below saturation"],
      ["TXV", "Thermostatic expansion valve"],
      ["Compressor", "Raises refrigerant pressure"],
    ],
  },
  {
    id: "hv-03",
    title: "Chapter 3 · Airflow & Comfort Systems",
    summary: "Duct basics, airflow, and comfort controls on exam items.",
    hours: 55,
    focus: ["Static pressure", "CFM", "Filters", "Thermostats"],
    terms: [
      ["CFM", "Cubic feet per minute airflow"],
      ["Static pressure", "Resistance in the air path"],
      ["Supply", "Air delivered to the space"],
      ["Return", "Air pulled back to the unit"],
    ],
  },
  {
    id: "hv-04",
    title: "Chapter 4 · Troubleshooting Sequence",
    summary: "Symptom → isolate → verify before replacing parts.",
    hours: 55,
    focus: ["Symptom gather", "Isolate sections", "Verify fix", "Document findings"],
    terms: [
      ["Short cycle", "Unit starts and stops too often"],
      ["Non-condensables", "Air/other gases in the system"],
      ["Restriction", "Blockage in the refrigerant path"],
      ["As-found", "Condition before repair"],
    ],
  },
  {
    id: "hv-05",
    title: "Chapter 5 · Timed Exam Strategy",
    summary: "Pacing and elimination for the Red Seal HVAC exam.",
    hours: 55,
    focus: ["Pacing", "Eliminate distractors", "Flag and return", "Final review"],
    terms: [
      ["Stem", "Exam question prompt"],
      ["Distractor", "Plausible wrong option"],
      ["Keyed response", "Official correct answer"],
      ["Blueprint weighting", "Exam topic emphasis"],
    ],
  },
];

const machinistSeeds: ChapterSeed[] = [
  {
    id: "mc-01",
    title: "Chapter 1 · Shop Safety & Metrology",
    summary: "Safe machining habits and precision measurement basics.",
    hours: 52,
    focus: ["PPE", "Machine guards", "Calipers", "Micrometers"],
    terms: [
      ["Tolerance", "Allowed size variation"],
      ["Vernier", "Fine measuring scale"],
      ["Datum", "Reference for measurement"],
      ["Burr", "Sharp leftover edge after cutting"],
    ],
  },
  {
    id: "mc-02",
    title: "Chapter 2 · Blueprint Reading for Machining",
    summary: "Views, GD&T awareness, and material callouts.",
    hours: 52,
    focus: ["Orthographic views", "Title blocks", "GD&T basics", "Material specs"],
    terms: [
      ["GD&T", "Geometric dimensioning and tolerancing"],
      ["Section view", "Cut-through drawing"],
      ["Surface finish", "Texture requirement"],
      ["Bill of materials", "Parts list"],
    ],
  },
  {
    id: "mc-03",
    title: "Chapter 3 · Lathe & Mill Operations",
    summary: "Speeds, feeds, tooling, and common setup mistakes.",
    hours: 52,
    focus: ["Speeds/feeds", "Tooling", "Workholding", "Setup checks"],
    terms: [
      ["RPM", "Spindle revolutions per minute"],
      ["Feed rate", "Tool advance per revolution/time"],
      ["Chuck", "Workholding device"],
      ["End mill", "Milling cutter"],
    ],
  },
  {
    id: "mc-04",
    title: "Chapter 4 · CNC & Quality Checks",
    summary: "Program awareness, offsets, and inspection habits.",
    hours: 52,
    focus: ["Offsets", "Program prove-out", "Inspection", "Documentation"],
    terms: [
      ["G-code", "CNC motion language"],
      ["Work offset", "Part zero location"],
      ["Tool offset", "Tool length/diameter compensation"],
      ["First article", "Initial inspection piece"],
    ],
  },
  {
    id: "mc-05",
    title: "Chapter 5 · Timed Exam Strategy",
    summary: "Pacing and elimination for the Red Seal machinist exam.",
    hours: 52,
    focus: ["Pacing", "Eliminate distractors", "Flag and return", "Final review"],
    terms: [
      ["Stem", "Exam question prompt"],
      ["Distractor", "Plausible wrong option"],
      ["Keyed response", "Official correct answer"],
      ["Blueprint weighting", "Exam topic emphasis"],
    ],
  },
];

/**
 * Programme outlines published by HCCB are the catalogue source of truth. Reuse the richer
 * practice vocabulary above while keeping the public chapter title, hours, and description
 * exact. This also prevents the player outline from drifting from the chapter count shown on
 * the catalogue card.
 */
function officialSeeds(
  prefix: string,
  chapters: Array<{ title: string; hours: number; summary: string }>,
  practiceReferences: ChapterSeed[],
): ChapterSeed[] {
  return chapters.map((chapter, index) => {
    const practice = practiceReferences[index % practiceReferences.length];
    return {
      id: `${prefix}-${String(index + 1).padStart(2, "0")}`,
      title: `Chapter ${index + 1} · ${chapter.title.trim()}`,
      hours: chapter.hours,
      summary: chapter.summary,
      focus: practice.focus,
      terms: practice.terms,
    };
  });
}

const officialElectricalSeeds = officialSeeds(
  "re",
  [
    {
      title: "Trade Safety, Regulations & Professional Practice",
      hours: 20,
      summary:
        "Build a foundation in Canadian safety legislation, regulatory frameworks, and professional practice for the Red Seal Construction Electrician exam.",
    },
    {
      title: "Canadian Essential Skills and NOC Classification System Review",
      hours: 30,
      summary:
        "Review the Canadian Essential Skills framework and National Occupational Classification system used to define, train, and evaluate Red Seal trades.",
    },
    {
      title: "Sketches, Drawings, Tools, Canadian Codes & Key Study Areas",
      hours: 50,
      summary:
        "Review electrical sketches, drawings, tools, the Canadian Electrical Code, and the core technical competency areas covered by the exam.",
    },
    {
      title: "Specific Trade Exam Review",
      hours: 241,
      summary:
        "Complete an exam-focused review of core Construction Electrician topics, practice questions, and test-taking strategies.",
    },
    {
      title: "Troubleshooting & Maintenance",
      hours: 9,
      summary:
        "Diagnose electrical faults, perform preventive maintenance, interpret system issues, and apply safe repair procedures across common electrical systems.",
    },
  ],
  electricalSeeds,
);

const officialChefSeeds = officialSeeds(
  "ch",
  [
    {
      title: "Canadian Trade Safety Awareness",
      hours: 20,
      summary:
        "Apply Canadian legal and regulatory safety requirements, hazard controls, and practical safety systems in a professional kitchen.",
    },
    {
      title: "Canadian Essential Skills and NOC Classification System Review",
      hours: 20,
      summary:
        "Interpret Canadian Essential Skills and NOC profiles, map skills to Red Seal expectations, and use them for exam and career planning.",
    },
    {
      title: "Trade Mathematics and Cost Control",
      hours: 10,
      summary:
        "Scale recipes, analyze yields and losses, calculate cost metrics, and use trade mathematics to support profitable menu decisions.",
    },
    {
      title: "Tools, Equipment, and Kitchen Operations",
      hours: 60,
      summary:
        "Select and use professional kitchen tools safely, plan equipment setup, and apply standardized Canadian kitchen operations.",
    },
    {
      title: "Food Safety and Sanitation",
      hours: 40,
      summary:
        "Design, apply, and troubleshoot Canadian food-safety and sanitation systems aligned with FOODSAFE principles and Red Seal expectations.",
    },
    {
      title: "Stocks, Soups, and Sauces",
      hours: 10,
      summary:
        "Select, produce, evaluate, and troubleshoot classical and contemporary stocks, soups, and sauces to professional standards.",
    },
    {
      title: "Vegetables, Fruits, and Plant-Based Cookery",
      hours: 20,
      summary:
        "Select, handle, and cook produce, legumes, grains, and plant-based proteins for quality, nutrition, consistency, and cost control.",
    },
    {
      title: "Meat, Poultry, and Game",
      hours: 10,
      summary:
        "Apply butchery classifications, appropriate cooking methods, doneness controls, food safety, and quality troubleshooting.",
    },
    {
      title: "Fish and Seafood",
      hours: 10,
      summary:
        "Classify and select seafood, apply appropriate cooking methods, control safety and quality, and calculate yields and cost.",
    },
    {
      title: "Breakfast and Short Order Cookery",
      hours: 10,
      summary:
        "Plan, organize, and execute high-volume breakfast and short-order service while maintaining safety, speed, and consistent quality.",
    },
    {
      title: "Baking and Desserts",
      hours: 10,
      summary:
        "Analyze formulas, execute and troubleshoot baked products and plated desserts, and apply professional quality and safety standards.",
    },
    {
      title: "Garde Manger",
      hours: 20,
      summary:
        "Plan, produce, plate, and evaluate cold-kitchen preparations with safe mise en place, efficient workflow, and Red Seal reasoning.",
    },
    {
      title: "Menu Planning and Nutrition",
      hours: 20,
      summary:
        "Design nutritionally balanced, cost-effective menus aligned with Canadian dietary guidance and professional kitchen realities.",
    },
    {
      title: "Leadership and Kitchen Management",
      hours: 30,
      summary:
        "Lead kitchen teams, organize brigade systems, coach diverse staff, and manage service, conflict, safety, and performance.",
    },
    {
      title: "Red Seal Exam Review and Practice Testing",
      hours: 60,
      summary:
        "Consolidate exam readiness through targeted review, practice questions, timed simulations, performance diagnosis, and an action plan.",
    },
  ],
  chefSeeds,
);

const officialMachinistSeeds = officialSeeds(
  "mc",
  [
    {
      title: "Specific Trade Exam Review",
      hours: 200,
      summary:
        "Complete sustained Red Seal machinist exam practice, diagnose knowledge gaps across NOA blocks, and apply disciplined exam strategies.",
    },
  ],
  machinistSeeds,
);

export const SELFPACED_CURRICULUM: Record<string, SelfpacedChapter[]> = {
  "cap-101-applied-business-capstone": withEval("cap", "CAP 101 Applied Business Capstone", buildFromSeeds(capstoneSeeds)),
  "office-administration-diploma": withEval("oa", "Office Administration Diploma", buildFromSeeds(officeSeeds)),
  "pharmacy-assistant": withEval("ph", "Pharmacy Assistant", buildFromSeeds(pharmacySeeds)),
  "red-seal-exam-preparation-electrician": withEval(
    "re",
    "Red Seal Electrician Prep",
    buildFromSeeds(officialElectricalSeeds),
  ),
  "red-seal-exam-preparation-carpentry": withEval("rc", "Red Seal Carpentry Prep", buildFromSeeds(carpentrySeeds)),
  "red-seal-exam-preparation-plumber": withEval("pl", "Red Seal Plumber Prep", buildFromSeeds(plumberSeeds)),
  "red-seal-exam-preparation-chef": withEval("ch", "Red Seal Chef Prep", buildFromSeeds(officialChefSeeds)),
  "red-seal-exam-preparation-hvac": withEval("hv", "Red Seal HVAC Prep", buildFromSeeds(hvacSeeds)),
  "red-seal-exam-preparation-machinist": withEval("mc", "Red Seal Machinist Prep", buildFromSeeds(officialMachinistSeeds)),
};

export function getCurriculum(slug: string): SelfpacedChapter[] {
  return SELFPACED_CURRICULUM[slug] || [];
}

/** Installs a validated server-authored outline for an admin-created programme. */
export function installSelfpacedCurriculum(slug: string, chapters: SelfpacedChapter[]) {
  if (!slug || !Array.isArray(chapters) || chapters.length === 0) return;
  SELFPACED_CURRICULUM[slug] = chapters;
}

export function getChapter(slug: string, chapterId: string): SelfpacedChapter | undefined {
  return getCurriculum(slug).find((c) => c.id === chapterId);
}

export function getActivity(
  slug: string,
  chapterId: string,
  activityId: string,
): { chapter: SelfpacedChapter; activity: SelfpacedActivity } | undefined {
  const chapter = getChapter(slug, chapterId);
  const activity = chapter?.activities.find((a) => a.id === activityId);
  if (!chapter || !activity) return undefined;
  return { chapter, activity };
}

export function flattenActivities(slug: string) {
  return getCurriculum(slug).flatMap((ch) => ch.activities.map((activity) => ({ chapter: ch, activity })));
}

export function activityTypeLabel(type: SelfpacedActivity["type"]): string {
  switch (type) {
    case "reading":
      return "Reading";
    case "quiz":
      return "Practice quiz";
    case "matching":
      return "Matching";
    case "lecture":
      return "Lecture";
    case "evaluation":
      return "Evaluation";
    case "assessment":
      return "Assessment";
  }
}
