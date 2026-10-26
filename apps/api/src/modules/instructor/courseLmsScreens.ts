/** Course LMS — Question Bank, Groups, Competencies, course-level badge creation. */

import { LMS_ACTIVITY_TYPES } from "../../lib/lifecycle-status.js";
import { externalJoinUrl } from "../../lib/liveClass.js";
import type { AiDraftStoryboard } from "./aiDraftContent.js";
import type { LmsQuizData } from "./lmsQuiz.js";

export const COURSE_LMS_TABS = ["Course", "Class List", "Attendance", "Grades", "Badges", "More"] as const;

export const COURSE_LMS_MORE_MENU = [
  { id: "competency-breakdown", label: "Competency breakdown" },
  { id: "logs", label: "Logs" },
  { id: "live-logs", label: "Live logs" },
  { id: "activity-report", label: "Activity report" },
  { id: "course-participation", label: "Course participation" },
  { id: "competencies", label: "Course competencies" },
  { id: "filters", label: "Filters" },
  { id: "settings", label: "Edit settings" },
  { id: "groups", label: "Groups" },
  { id: "question-bank", label: "Question bank" },
  { id: "reuse", label: "Course reuse" },
] as const;

export const QUESTION_TYPES = [
  { label: "Multiple choice", value: "Multiple choice", code: "M" },
  { label: "True/False", value: "True/False", code: "T" },
  { label: "Short answer", value: "Short answer", code: "S" },
  { label: "Numerical", value: "Numerical", code: "N" },
  { label: "Calculated", value: "Calculated", code: "C" },
  { label: "Essay", value: "Essay", code: "E" },
  { label: "Matching", value: "Matching", code: "A" },
  { label: "Random short-answer matching", value: "Random short-answer matching", code: "R" },
  { label: "Embedded answers (Cloze)", value: "Embedded answers (Cloze)", code: "Z" },
  { label: "Calculated multichoice", value: "Calculated multichoice", code: "K" },
  { label: "Drag and drop into text", value: "Drag and drop into text", code: "D" },
] as const;

export type CourseLmsActivity = {
  id: string;
  type: string;
  name: string;
  note?: string;
  body?: string;
  fileName?: string;
  /** Uploaded file (`LMS:FILE` record) — templates only carry a fileName, so no fileId means nothing to download. */
  fileId?: string;
  fileMime?: string;
  fileSize?: number;
  modified?: string;
  hidden?: boolean;
  /** Live class launcher (`/live/<sectionId>`) or an external HTTPS meeting link. */
  joinUrl?: string | null;
  /** Narrated slideshow ("AI video lesson") played by the avatar player. */
  storyboard?: AiDraftStoryboard;
  description?: string;
  /** URL activities: validated absolute http(s) link. */
  url?: string;
  /** Raw add/edit form values so the settings form reopens as the instructor left it. */
  settings?: Record<string, string>;
  /** Graded workspace assignment backed by an `Assignment` row. */
  assignmentId?: string;
  assignment?: {
    instructions?: string;
    availableFrom?: string;
    dueAt?: string;
    cutoffAt?: string;
    gradeBy?: string;
    maxScore?: number;
    weightPercent?: number;
    fileSubmissions?: boolean;
    onlineText?: boolean;
    maxFiles?: number;
    maxFileBytes?: number;
    acceptedTypes?: string;
  };
  /** Auto-graded quiz. Holds the answer key — never send this field to students. */
  quiz?: LmsQuizData;
};

export type CourseLmsQuestion = {
  id: string;
  type: string;
  typeCode: string;
  text: string;
  name: string;
  status: string;
  version: string;
  createdByFirst: string;
  createdByLast: string;
  date: string;
  comments: number;
  needsChecking: string;
  facilityIndex: string;
  discriminativeEfficiency: string;
  usage: number;
  mark?: string;
  feedback?: string;
  answers?: string[];
  correct?: number;
  trueFalse?: string;
  shortAnswer?: string;
  pairs?: Array<{ q: string; a: string }>;
};

export type CourseLmsGroup = {
  id: string;
  name: string;
  members: Array<{ id: string; name: string }>;
};

export type CourseLmsBadge = {
  id: string;
  name: string;
  version?: string;
  language?: string;
  description?: string;
  criteria?: string;
  awardedStudentIds?: string[];
};

export type CourseLmsReporting = {
  generatedAt: string;
  logs: Array<{
    id: string;
    at: string;
    participant: string;
    action: string;
    activity: string;
    source: string;
    detail?: string;
  }>;
  activities: Array<{
    id: string;
    name: string;
    type: string;
    completions: number;
    submissions: number;
    attempts: number;
    responses: number;
    lastActivityAt?: string;
  }>;
  participation: Array<{
    studentId: string;
    name: string;
    studentNumber: string;
    status: string;
    completed: number;
    submissions: number;
    quizAttempts: number;
    choiceResponses: number;
    lastActivityAt?: string;
  }>;
  competencies: Array<{
    id: string;
    name: string;
    resource: string;
    linkedActivities: number;
    participants: number;
    completed: number;
    progressPercent: number;
  }>;
};

export type CourseLmsState = {
  session: string;
  location: string;
  ended?: boolean;
  endedMessage?: string;
  finalMarksLabel?: string;
  finalMarksHref?: string;
  /** Live classroom launcher for this offering — same room for teacher + students. */
  joinUrl?: string | null;
  moreMenu: Array<{ id: string; label: string }>;
  topics: Array<{
    id: string;
    title: string;
    summary?: string;
    accessRestrictions?: string;
    activities: CourseLmsActivity[];
  }>;
  activityTypes?: Array<{ code: string; label: string; kind: string }>;
  gradeColumns: string[];
  gradeWeights?: string[];
  gradeEmpty?: string;
  attendanceDates?: string[];
  evaluationRows?: Array<{ component: string; weight: string }>;
  logParticipants?: string[];
  reporting?: CourseLmsReporting;
  questionBank: {
    category: string;
    categoryHelp: string;
    categories: Array<{ label: string; value: string }>;
    showQuestionText: boolean;
    showSubcategories: boolean;
    showOld: boolean;
    pageSize: number;
    totalPages: number;
    questions: CourseLmsQuestion[];
  };
  groups: CourseLmsGroup[];
  availableUsers: Array<{ id: string; name: string }>;
  competencies: Array<{
    id: string;
    name: string;
    resource?: string;
    description?: string;
    levels?: string[];
    assessments?: Array<{ id: string; competencyId: string; studentId: string; level: string; updatedAt: string }>;
  }>;
  competencyEmpty: string;
  badges: CourseLmsBadge[];
  badgeForm: {
    issuerName: string;
    issuerContact: string;
    languages: Array<{ label: string; value: string }>;
    imageTypes: string[];
  };
};

type LmsInput = {
  code: string;
  title: string;
  session: string;
  location: string;
  instructorFirst: string;
  instructorLast: string;
  ended?: boolean;
  sectionCode?: string;
  joinUrl?: string | null;
};

const ACSW_PROMPTS = [
  "Which statement best describes a core duty of a social service worker?",
  "Identify an ethical boundary in client intake interviews.",
  "What is the primary purpose of a case note?",
  "Select the most appropriate referral for housing instability.",
  "Which practice supports trauma-informed care?",
  "True or false: confidentiality has no exceptions in crisis work.",
  "Describe one self-care strategy used after a difficult session.",
  "Match the population with the most relevant community resource.",
  "What should be documented after a mandated report?",
  "Which response is most client-centred during intake?",
];

/** Family Studies FINAL EXAM bank (student attempt parity with HCC Moodle). */
export const ACSW500_FINAL_EXAM_QUESTIONS: Array<{
  id: string;
  text: string;
  answers: string[];
  mark: string;
}> = [
  {
    id: "fe-q1",
    text: "According to the ACSW500 outline, students should be able to:",
    answers: [
      "Prescribe medication for substance use disorders",
      "Conduct criminal investigations related to addiction",
      "Describe addiction pathways within family systems",
      "Diagnose psychiatric disorders independently",
    ],
    mark: "1.00",
  },
  {
    id: "fe-q2",
    text: "Family systems practice in addiction work primarily focuses on:",
    answers: [
      "Isolating the identified client from relatives",
      "Relational patterns that maintain or interrupt substance use",
      "Court-ordered punishment of family members",
      "Replacing clinical assessment with peer opinion only",
    ],
    mark: "1.00",
  },
  {
    id: "fe-q3",
    text: "A culturally responsive approach with families means practitioners:",
    answers: [
      "Apply one universal treatment script to every household",
      "Ignore cultural context to remain 'neutral'",
      "Adapt engagement and assessment to family values and context",
      "Defer all decisions to institutional policy without dialogue",
    ],
    mark: "1.00",
  },
  {
    id: "fe-q4",
    text: "Which professional skill is included in the ACSW500 learning objectives?",
    answers: [
      "Surgical triage in emergency rooms",
      "Professional communication that supports recovery-oriented care",
      "Independent pharmacy dispensing",
      "Forensic autopsies for overdose deaths",
    ],
    mark: "1.00",
  },
  {
    id: "fe-q5",
    text: "Assessment of family and relational risk should include:",
    answers: [
      "Only the client's employment history",
      "Safety, supports, stressors, and interaction patterns",
      "Financial audits of unrelated third parties",
      "Random social media scraping without consent",
    ],
    mark: "1.00",
  },
  {
    id: "fe-q6",
    text: "Recovery-oriented care with families emphasizes:",
    answers: [
      "Hope, strengths, and meaningful participation in change",
      "Permanent exclusion from community supports",
      "One-time lectures without follow-up",
      "Withholding information from all caregivers always",
    ],
    mark: "1.00",
  },
  {
    id: "fe-q7",
    text: "When documenting family sessions, workers should:",
    answers: [
      "Record clear, factual notes tied to goals and risk",
      "Omit all safety concerns to protect privacy",
      "Use only informal chat messages as the chart",
      "Avoid naming any participants present",
    ],
    mark: "1.00",
  },
  {
    id: "fe-q8",
    text: "Which treatment model focuses on family relationships and interactions?",
    answers: [
      "Family systems / relational models",
      "Solo pharmacological titration only",
      "Unsupervised peer punishment circles",
      "Hardware repair apprenticeship models",
    ],
    mark: "1.00",
  },
  {
    id: "fe-q9",
    text: "Trauma-informed family practice requires workers to:",
    answers: [
      "Force disclosure of every trauma detail immediately",
      "Prioritize safety, choice, and trust in engagement",
      "Ignore triggers to 'push through' material",
      "Exclude caregivers from all planning permanently",
    ],
    mark: "1.00",
  },
  {
    id: "fe-q10",
    text: "A key boundary in family addiction work is:",
    answers: [
      "Sharing client secrets casually with neighbours",
      "Maintaining confidentiality with lawful exceptions explained",
      "Lending personal money to every relative present",
      "Diagnosing without any assessment interview",
    ],
    mark: "1.00",
  },
  {
    id: "fe-q11",
    text: "Referral planning for families affected by substance use should consider:",
    answers: [
      "Housing, counselling, peer support, and cultural resources",
      "Only inpatient detox with no aftercare",
      "Ignoring waitlists and community capacity",
      "Replacing all clinical care with internet quizzes",
    ],
    mark: "1.00",
  },
];

export function studentQuizQuestionsForActivity(activityName: string, courseCode: string) {
  if (/final\s*exam/i.test(activityName) && (/ACSW\s*500/i.test(courseCode) || /family/i.test(activityName))) {
    return ACSW500_FINAL_EXAM_QUESTIONS;
  }
  const prompts = ACSW_PROMPTS;
  return prompts.slice(0, 8).map((text, i) => ({
    id: `quiz-${courseCode.replace(/\s+/g, "-").toLowerCase()}-q${i + 1}`,
    text,
    answers: [
      "Option A — best practice response",
      "Option B — unsafe or incomplete response",
      "Option C — unrelated administrative task",
      "Option D — punitive-only approach",
    ],
    mark: "1.00",
  }));
}

export function gradeSchemeFromLms(lms: CourseLmsState): Array<{ title: string; weightPercent: number }> {
  const cols = lms.gradeColumns || [];
  const weights = lms.gradeWeights || [];
  const out: Array<{ title: string; weightPercent: number }> = [];
  for (let i = 0; i < cols.length; i += 1) {
    const title = cols[i]!;
    if (/^student$/i.test(title) || /standing/i.test(title)) continue;
    const raw = (weights[i] || "").replace(/%/g, "").trim();
    const weightPercent = Number.parseFloat(raw);
    if (!Number.isFinite(weightPercent)) continue;
    out.push({ title, weightPercent });
  }
  return out;
}

function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  return {
    first: parts[0] || "Elena",
    last: parts.slice(1).join(" ") || "Vance",
  };
}

export function buildQuestionBank(code: string, instructorFirst: string, instructorLast: string): CourseLmsQuestion[] {
  const pageSize = 10;
  const total = 16 * pageSize;
  const questions: CourseLmsQuestion[] = [];
  for (let i = 0; i < total; i += 1) {
    const kind = QUESTION_TYPES[i % QUESTION_TYPES.length];
    const chapter = Math.floor(i / 10) + 1;
    const qn = (i % 10) + 1;
    questions.push({
      id: `qb-${code.replace(/\s+/g, "-").toLowerCase()}-${i + 1}`,
      type: kind.value,
      typeCode: kind.code,
      text: ACSW_PROMPTS[i % ACSW_PROMPTS.length],
      name: `Ch${chapter} Q${qn} — ${kind.value}`,
      status: "Ready",
      version: "v1",
      createdByFirst: instructorFirst,
      createdByLast: instructorLast,
      date: "27 Apr 2026",
      comments: i % 7 === 0 ? 1 : 0,
      needsChecking: "-",
      facilityIndex: "N/A",
      discriminativeEfficiency: "N/A",
      usage: i % 5 === 0 ? 2 : i % 3 === 0 ? 1 : 0,
    });
  }
  return questions;
}

function act(type: string, name: string, extra: Partial<CourseLmsActivity> = {}): CourseLmsActivity {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return { id: extra.id || `act-${slug}`, type, name, ...extra };
}

const FAMILY_STUDIES_DESC =
  "ACSW 500 Family Studies examines addiction within family systems, relational dynamics, and recovery processes. Students explore assessment frameworks, treatment models, and culturally responsive approaches that support individuals and families navigating substance use and related challenges.";

const FAMILY_STUDIES_OBJECTIVES =
  "By the end of this course, learners will be able to: (1) describe family systems concepts relevant to addiction practice; (2) apply assessment techniques for family and relational risk; (3) compare treatment models used with families affected by substance use; and (4) demonstrate professional communication that supports recovery-oriented care.";

/** Moodle-parity ACSW 500 / Family Studies course outline (Resources → Days). */
export function acsw500Topics(): CourseLmsState["topics"] {
  const day = (n: number, activities: CourseLmsActivity[]) => ({
    id: `topic-day-${n}`,
    title: `DAY ${n}`,
    activities,
  });
  return [
    {
      id: "topic-resources",
      title: "RESOURCES",
      activities: [
        act("PAGE", "Brief Course Description", {
          body: FAMILY_STUDIES_DESC,
          modified: "Tuesday, 15 September 2026, 6:40 PM",
        }),
        act("PAGE", "Learning Objectives", {
          body: FAMILY_STUDIES_OBJECTIVES,
          modified: "Tuesday, 15 September 2026, 6:40 PM",
        }),
        act("BIGBLUEBUTTON", "BIGBLUEBUTTON Online Class Link", {
          id: "act-class-link",
          note: "This room is ready. You can join the session now.",
        }),
        act("FILE", "Course Syllabus", {
          id: "act-course-syllabus",
          fileName: "ACSW500-Family-Studies-Syllabus.pdf",
        }),
      ],
    },
    {
      id: "topic-eval",
      title: "EVALUATION CRITERIA",
      activities: [
        act("PAGE", "Evaluation", {
          id: "act-evaluation-criteria",
          body: "EVALUATION",
          modified: "Tuesday, 15 September 2026, 8:30 PM",
        }),
      ],
    },
    day(1, [
      act("FOLDER", "Lecture", { fileName: "ACSW500_Day1_Lecture.pdf" }),
      act("FILE", "Learning Manual", { fileName: "ACSW500_Day1_Manual.pdf" }),
    ]),
    day(2, [
      act("FOLDER", "Lecture", { fileName: "ACSW500_Day2_Lecture.pdf" }),
      act("FILE", "Learning Manual", { fileName: "ACSW500_Day2_Manual.pdf" }),
      act("QUIZ", "Quiz 1"),
    ]),
    day(3, [
      act("FOLDER", "Lecture", { fileName: "ACSW500_Day3_Lecture.pdf" }),
      act("FILE", "Learning Manual", { fileName: "ACSW500_Day3_Manual.pdf" }),
    ]),
    day(4, [
      act("FOLDER", "Lecture", { fileName: "ACSW500_Day4_Lecture.pdf" }),
      act("FILE", "Learning Manual", { fileName: "ACSW500_Day4_Manual.pdf" }),
      act("QUIZ", "MID TERM"),
    ]),
    day(5, [
      act("FOLDER", "Lecture", { fileName: "ACSW500_Day5_Lecture.pdf" }),
      act("FILE", "Learning Manual", { fileName: "ACSW500_Day5_Manual.pdf" }),
    ]),
    day(6, [
      act("FOLDER", "Lecture", { fileName: "ACSW500_Day6_Lecture.pdf" }),
      act("FILE", "Learning Manual", { fileName: "ACSW500_Day6_Manual.pdf" }),
      act("QUIZ", "Quiz 2"),
    ]),
    day(7, [
      act("FOLDER", "Lecture", { fileName: "ACSW500_Day7_Lecture.pdf" }),
      act("FILE", "Learning Manual", { fileName: "ACSW500_Day7_Manual.pdf" }),
    ]),
    day(8, [
      act("FOLDER", "Lecture", { fileName: "ACSW500_Day8_Lecture.pdf" }),
      act("FILE", "Learning Manual", { fileName: "ACSW500_Day8_Manual.pdf" }),
      act("QUIZ", "FINAL EXAM", {
        id: "act-final-exam",
        note: "Grading method: Highest grade",
      }),
    ]),
  ];
}

export function acsw500EvaluationRows(): Array<{ component: string; weight: string }> {
  return [
    { component: "Class Participation", weight: "20%" },
    { component: "Quizzes", weight: "20%" },
    { component: "Mid-term Exam", weight: "30%" },
    { component: "Final Exam", weight: "30%" },
    { component: "Total", weight: "100%" },
  ];
}

function acswTopics(): CourseLmsState["topics"] {
  const desc =
    "Social Service Work Fundamentals introduces the values, ethics, and core practices of social service work in community settings. Students examine the history of the profession, fields of practice, and the helping relationship, with emphasis on client-centred, trauma-informed, and culturally responsive work.";
  const objectives =
    "By the end of this course, learners will be able to: (1) describe the origins and current scope of social service work; (2) apply ethical decision-making to intake and case recording; (3) identify community resources across diverse populations; and (4) demonstrate professional communication in classroom and practicum-style scenarios.";
  return [
    {
      id: "topic-resources",
      title: "Resources",
      activities: [
        act("PAGE", "Brief Course Description", {
          body: desc,
          modified: "Monday, 2 March 2026, 2:13 PM",
        }),
        act("PAGE", "Learning Objectives", { body: objectives, modified: "Monday, 2 March 2026, 2:13 PM" }),
        act("BIGBLUEBUTTON", "Class Link"),
      ],
    },
    {
      id: "topic-eval",
      title: "Evaluation Criteria",
      activities: [
        act("FILE", "Evaluation Criteria", { fileName: "ACSW-200-Evaluation-Criteria.pdf" }),
      ],
    },
    {
      id: "topic-week-1",
      title: "Week 1",
      activities: [
        act("FOLDER", "Table of Content and Chapter 01, 02, 03 PDF", {
          fileName: "ACSW200_Ch01-03.pdf",
        }),
        act("PAGE", "Chapter 1 Class Overview & Learning Objectives"),
        act("PAGE", "Chapter 2 Overview & Learning Objectives"),
        act("PAGE", "Chapter 3 Overview & Learning Objectives"),
        act("QUIZ", "Chapter 01 Quiz"),
        act("QUIZ", "Chapter 02 Quiz"),
        act("QUIZ", "Chapter 03 Quiz"),
      ],
    },
    {
      id: "topic-week-2",
      title: "Week 2",
      activities: [
        act("FOLDER", "Chapter 04,05 PDF", { fileName: "ACSW200_Ch04-05.pdf" }),
        act("PAGE", "Chapter 4 Overview & Learning Objectives"),
        act("PAGE", "Chapter 5 Overview & Learning Objectives"),
        act("QUIZ", "Chapter 04 Quiz"),
        act("QUIZ", "Chapter 05 Quiz"),
      ],
    },
    {
      id: "topic-week-3",
      title: "Week 3",
      activities: [
        act("FOLDER", "Chapter 06, 07 PDF"),
        act("PAGE", "Chapter 6 Overview & Learning Objectives"),
        act("PAGE", "Chapter 7 Overview & Learning Objectives"),
        act("QUIZ", "Chapter 06 Quiz"),
        act("QUIZ", "Chapter 07 Quiz"),
      ],
    },
    {
      id: "topic-week-4",
      title: "Week 4",
      activities: [
        act("FOLDER", "Chapter 08, 09 PDF"),
        act("PAGE", "Chapter 8 Overview & Learning Objectives"),
        act("PAGE", "Chapter 9 Overview & Learning Objectives"),
        act("QUIZ", "Chapter 08 Quiz"),
        act("QUIZ", "Chapter 09 Quiz"),
      ],
    },
    {
      id: "topic-week-5",
      title: "Week 5",
      activities: [
        act("FOLDER", "Chapter 10, 11 PDF"),
        act("PAGE", "Chapter 10 Overview & Learning Objectives"),
        act("PAGE", "Chapter 11 Overview & Learning Objectives"),
        act("QUIZ", "Chapter 10 Quiz"),
        act("QUIZ", "Chapter 11 Quiz"),
      ],
    },
    {
      id: "topic-week-6",
      title: "Week 6",
      activities: [
        act("FOLDER", "Chapter 12, 13 PDF"),
        act("PAGE", "Chapter 12 Overview & Learning Objectives"),
        act("PAGE", "Chapter 13 Overview & Learning Objectives"),
        act("QUIZ", "Chapter 12 Quiz"),
        act("QUIZ", "Chapter 13 Quiz"),
      ],
    },
  ];
}

export function isFamilyStudiesCourse(code: string, title = "") {
  return /ACSW\s*500/i.test(code) || /family\s*studies/i.test(`${code} ${title}`);
}

export function buildCourseLms(input: LmsInput): CourseLmsState {
  const category = `Default for ${input.code}`;
  const questions = buildQuestionBank(input.code, input.instructorFirst, input.instructorLast);
  const isAcsw200 = /ACSW\s*200/i.test(input.code);
  const isAcsw500 = isFamilyStudiesCourse(input.code, input.title);
  if (isAcsw200) {
    questions.pop();
    questions.unshift({
      id: `qb-${input.code.replace(/\s+/g, "-").toLowerCase()}-settlement`,
      type: "Multiple choice",
      typeCode: "M",
      text: "1. Group practice and community work were historically informed by _____.",
      name: "1. Group practice and community work were historically informed by _____.",
      status: "Ready",
      version: "v1",
      createdByFirst: "Manisha",
      createdByLast: "Manisha",
      date: "23 February 2026, 4:17 PM",
      comments: 0,
      needsChecking: "-",
      facilityIndex: "N/A",
      discriminativeEfficiency: "N/A",
      usage: 1,
      mark: "1",
      feedback: "",
      answers: ["settlement houses", "friendly visiting", "charity organization societies", "casework"],
      correct: 0,
    });
  }
  const quizCols = Array.from({ length: 13 }, (_, i) => `Chapter ${String(i + 1).padStart(2, "0")} Quiz`);
  const meetUrl = input.joinUrl || null;
  const baseTopics = isAcsw500
    ? acsw500Topics()
    : isAcsw200
      ? acswTopics()
      : [
          { id: "topic-0", title: "Topic 0", activities: [act("FORUM", "Announcements")] },
          { id: "topic-1", title: "Topic 1", activities: [] },
          { id: "topic-2", title: "Topic 2", activities: [] },
          { id: "topic-3", title: "Topic 3", activities: [] },
          { id: "topic-4", title: "Topic 4", activities: [] },
          { id: "topic-5", title: "Topic 5", activities: [] },
        ];
  const topics = baseTopics.map((topic) => ({
    ...topic,
    activities: topic.activities.map((activity) =>
      activity.type.toUpperCase() === "BIGBLUEBUTTON"
        ? {
            ...activity,
            joinUrl: meetUrl,
            note: activity.note || "This room is ready. You can join the session now.",
          }
        : activity,
    ),
  }));
  const acswCategories = [
    { label: `Course: ${input.code} (ACSWAPR26-01)`, value: `course-${input.code}` },
    { label: "Top for Social Service Work Fundamentals", value: "top" },
    { label: category, value: category },
    { label: "Final Exam Quiz", value: "final-exam" },
    { label: "Quiz 1 (30)", value: "quiz-1" },
    { label: "Quiz 2 (28)", value: "quiz-2" },
    { label: "Quiz 3 (19)", value: "quiz-3" },
    { label: "Quiz 4 (30)", value: "quiz-4" },
    { label: "Quiz 5 (30)", value: "quiz-5" },
    { label: "Quiz 6 (30)", value: "quiz-6" },
    { label: "Quiz 7 (29)", value: "quiz-7" },
    { label: "Quiz 9 (30)", value: "quiz-9" },
    { label: "Quiz 10 (30)", value: "quiz-10" },
    { label: "Quiz 11 (30)", value: "quiz-11" },
    { label: "Quiz 12 (25)", value: "quiz-12" },
    { label: "Diversity and Populations (15)", value: "diversity" },
    { label: "Ethics and Professionalism (15)", value: "ethics" },
    { label: "Fields of Practice (15)", value: "fields" },
    { label: "General Concepts (15)", value: "general" },
    { label: "History and Origins (15)", value: "history" },
  ];

  return {
    session: input.session,
    location: input.location,
    joinUrl: meetUrl,
    ended: input.ended ?? isAcsw200,
    endedMessage: "Your course has ended.",
    finalMarksLabel: "Click here to submit your final marks.",
    finalMarksHref: "/instructor/gradebook",
    moreMenu: COURSE_LMS_MORE_MENU.map((item) => ({ ...item })),
    topics,
    activityTypes: LMS_ACTIVITY_TYPES.map((t) => ({ code: t.code, label: t.label, kind: t.kind })),
    gradeColumns: isAcsw500
      ? ["Student", "Quiz 1", "MID TERM", "Quiz 2", "FINAL EXAM", "Participation", "Current Standing"]
      : isAcsw200
        ? ["Student", ...quizCols, "Final Exam", "Class Participation", "Current Standing"]
        : ["Student", "Chapter 1 Quiz", "Final Exam Quiz", "Class Participation", "Current Standing"],
    gradeWeights: isAcsw500
      ? ["", "10.00%", "30.00%", "10.00%", "30.00%", "20.00%", ""]
      : isAcsw200
        ? ["", ...Array.from({ length: 13 }, () => "5.00%"), "25.00%", "10.00%", ""]
        : ["", "5.00%", "25.00%", "5.00%", ""],
    gradeEmpty: "No students are currently registered in this course offering.",
    attendanceDates: isAcsw500
      ? ["Sep 18, 2026 (Mon)", "Sep 19, 2026 (Tue)", "Sep 20, 2026 (Wed)", "Sep 21, 2026 (Thu)"]
      : ["Apr 27, 2026 (Mon)", "Apr 28, 2026 (Tue)", "Apr 29, 2026 (Wed)", "Apr 30, 2026 (Thu)"],
    evaluationRows: isAcsw500
      ? acsw500EvaluationRows()
      : isAcsw200
        ? [
            ...quizCols.map((c) => ({ component: c, weight: "5%" })),
            { component: "Final Exam", weight: "25%" },
            { component: "Class Participation", weight: "10%" },
            { component: "Total", weight: "100%" },
          ]
        : [],
    logParticipants: ["All participants", "Monica Dahiya", "Guest user"],
    questionBank: {
      category,
      categoryHelp: `The default category for questions shared in context '${input.code}'.`,
      categories: isAcsw200 || isAcsw500
        ? acswCategories
        : [
            { label: category, value: category },
            { label: "Top", value: "Top" },
          ],
      showQuestionText: true,
      showSubcategories: true,
      showOld: false,
      pageSize: 10,
      totalPages: 16,
      questions,
    },
    groups: [],
    availableUsers: [
      { id: "u-instructor", name: `${input.instructorFirst} ${input.instructorLast}` },
    ],
    competencies: [],
    competencyEmpty: "No competencies have been linked to this course.",
    badges: [],
    badgeForm: {
      issuerName: "Heritage Community College",
      issuerContact: "support@myhccbc.com",
      languages: [{ label: "English", value: "English" }],
      imageTypes: ["Image (GIF) .gif", "Image (JPEG) .jpe .jpeg .jpg", "Image (PNG) .png"],
    },
  };
}

export function instructorNameParts(displayName: string) {
  return splitName(displayName);
}

export function mergeCourseLmsOverlay(
  lms: CourseLmsState,
  overlay?: Record<string, unknown> | null,
): CourseLmsState {
  if (!overlay) return lms;
  const extraQuestions = Array.isArray(overlay.extraQuestions)
    ? (overlay.extraQuestions as CourseLmsQuestion[]).filter((q) => q && typeof q.id === "string")
    : [];
  const questionEdits =
    overlay.questionEdits && typeof overlay.questionEdits === "object"
      ? (overlay.questionEdits as Record<string, Partial<CourseLmsQuestion>>)
      : {};
  const extraGroups = Array.isArray(overlay.extraGroups)
    ? (overlay.extraGroups as CourseLmsGroup[]).filter((g) => g && typeof g.id === "string")
    : [];
  const extraBadges = Array.isArray(overlay.extraCourseBadges)
    ? (overlay.extraCourseBadges as CourseLmsBadge[]).filter((b) => b && typeof b.id === "string")
    : [];
  const extraCompetencies = Array.isArray(overlay.extraCompetencies)
    ? (overlay.extraCompetencies as CourseLmsState["competencies"]).filter(
        (c) => c && typeof c.id === "string",
      )
    : [];
  const competencyEdits = overlay.competencyEdits && typeof overlay.competencyEdits === "object"
    ? (overlay.competencyEdits as Record<string, Partial<CourseLmsState["competencies"][number]>>)
    : {};
  const competencyAssessments = overlay.competencyAssessments && typeof overlay.competencyAssessments === "object"
    ? (overlay.competencyAssessments as Record<string, CourseLmsState["competencies"][number]["assessments"]>)
    : {};
  const deletedCompetencyIds = new Set(
    Array.isArray(overlay.deletedCompetencyIds)
      ? (overlay.deletedCompetencyIds as unknown[]).filter((id): id is string => typeof id === "string")
      : [],
  );
  const badgeEdits = overlay.courseBadgeEdits && typeof overlay.courseBadgeEdits === "object"
    ? (overlay.courseBadgeEdits as Record<string, Partial<CourseLmsBadge>>)
    : {};
  const deletedCourseBadgeIds = new Set(
    Array.isArray(overlay.deletedCourseBadgeIds)
      ? (overlay.deletedCourseBadgeIds as unknown[]).filter((id): id is string => typeof id === "string")
      : [],
  );
  const deletedGroupIds = new Set(
    Array.isArray(overlay.deletedGroupIds)
      ? (overlay.deletedGroupIds as unknown[]).filter((id): id is string => typeof id === "string")
      : [],
  );
  const groupMembers =
    overlay.groupMembers && typeof overlay.groupMembers === "object"
      ? (overlay.groupMembers as Record<string, Array<{ id: string; name: string }>>)
      : {};

  const groups = [...extraGroups, ...lms.groups]
    .filter((g) => !deletedGroupIds.has(g.id))
    .map((g) => ({ ...g, members: groupMembers[g.id] ?? g.members }));

  const topicEdits =
    overlay.topicActivities && typeof overlay.topicActivities === "object"
      ? (overlay.topicActivities as Record<string, CourseLmsActivity[]>)
      : {};
  const extraTopics = Array.isArray(overlay.extraTopics)
    ? (overlay.extraTopics as CourseLmsState["topics"]).filter((t) => t && typeof t.id === "string")
    : [];
  const topicTitles =
    overlay.topicTitles && typeof overlay.topicTitles === "object"
      ? (overlay.topicTitles as Record<string, string>)
      : {};
  const topicSummaries =
    overlay.topicSummaries && typeof overlay.topicSummaries === "object"
      ? (overlay.topicSummaries as Record<string, string>)
      : {};
  const topicRestrictions =
    overlay.topicRestrictions && typeof overlay.topicRestrictions === "object"
      ? (overlay.topicRestrictions as Record<string, string>)
      : {};
  const hiddenActivityIds = new Set(
    Array.isArray(overlay.hiddenActivityIds)
      ? (overlay.hiddenActivityIds as unknown[]).filter((id): id is string => typeof id === "string")
      : [],
  );
  const deletedActivityIds = new Set(
    Array.isArray(overlay.deletedActivityIds)
      ? (overlay.deletedActivityIds as unknown[]).filter((id): id is string => typeof id === "string")
      : [],
  );
  const activityEdits =
    overlay.activityEdits && typeof overlay.activityEdits === "object"
      ? (overlay.activityEdits as Record<string, Partial<CourseLmsActivity>>)
      : {};
  const topics = [...lms.topics, ...extraTopics.filter((t) => !lms.topics.some((base) => base.id === t.id))].map(
    (topic) => ({
      ...topic,
      title: topicTitles[topic.id] || topic.title,
      summary: topicSummaries[topic.id] ?? topic.summary,
      accessRestrictions: topicRestrictions[topic.id] || undefined,
      activities: [...topic.activities, ...(topicEdits[topic.id] || [])]
        .filter((activity) => !deletedActivityIds.has(activity.id))
        .map((activity) => ({ ...activity, ...(activityEdits[activity.id] || {}) }))
        .map((activity) => {
          const type = String(activity.type || "").toUpperCase();
          const hidden = hiddenActivityIds.has(activity.id) || activity.hidden;
          if (type === "BIGBLUEBUTTON") {
            return {
              ...activity,
              hidden,
              joinUrl: externalJoinUrl(activity.joinUrl) || lms.joinUrl || null,
              note: activity.note || "This room is ready. You can join the session now.",
            };
          }
          return { ...activity, hidden };
        }),
    }),
  );

  return {
    ...lms,
    topics,
    questionBank: {
      ...lms.questionBank,
      questions: [
        ...extraQuestions.map((q) => ({ ...q, ...(questionEdits[q.id] || {}) })),
        ...lms.questionBank.questions
          .filter((q) => !extraQuestions.some((extra) => extra.id === q.id))
          .map((q) => ({ ...q, ...(questionEdits[q.id] || {}) })),
      ],
    },
    groups,
    competencies: [...extraCompetencies, ...lms.competencies]
      .filter((item, index, all) => !deletedCompetencyIds.has(item.id) && all.findIndex((candidate) => candidate.id === item.id) === index)
      .map((item) => ({ ...item, ...(competencyEdits[item.id] || {}), assessments: competencyAssessments[item.id] || item.assessments || [] })),
    badges: [...extraBadges, ...lms.badges]
      .filter((item, index, all) => !deletedCourseBadgeIds.has(item.id) && all.findIndex((candidate) => candidate.id === item.id) === index)
      .map((item) => ({ ...item, ...(badgeEdits[item.id] || {}) })),
  };
}

function bumpQuestionVersion(version?: string) {
  const n = Number(String(version || "v1").replace(/\D/g, "")) || 1;
  return `v${n + 1}`;
}

export function questionFromFields(fields: Record<string, string>, code: string, instructor: string): CourseLmsQuestion {
  const { first, last } = splitName(instructor);
  const typeLabel = fields.Type || fields["Question type"] || "Multiple choice";
  const kind = QUESTION_TYPES.find((t) => t.value === typeLabel) || QUESTION_TYPES[0];
  const name = (fields.Name || fields["Question name"] || `New ${kind.value}`).trim();
  const existingId = (fields.Id || fields.id || "").trim();
  return {
    id: existingId || `qb-new-${Date.now().toString(36)}`,
    type: kind.value,
    typeCode: kind.code,
    text: (fields.Text || fields.Question || name).trim(),
    name,
    status: fields.Status || "Ready",
    version: existingId ? bumpQuestionVersion(fields.Version) : "v1",
    createdByFirst: fields.CreatedByFirst || first,
    createdByLast: fields.CreatedByLast || last,
    date:
      fields.Date ||
      new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    comments: Number(fields.Comments || "0") || 0,
    needsChecking: "",
    facilityIndex: "",
    discriminativeEfficiency: "",
    usage: Number(fields.Usage || "0") || 0,
    mark: fields.Mark || "1",
    feedback: fields.Feedback || "",
    answers: [fields.Answer1 || "", fields.Answer2 || "", fields.Answer3 || "", fields.Answer4 || ""],
    correct: Math.max(0, Number(fields.Correct || "1") - 1) || 0,
    trueFalse: fields.TrueFalse || "True",
    shortAnswer: fields.ShortAnswer || "",
    pairs: [
      { q: fields.Match1 || "", a: fields.Match1A || "" },
      { q: fields.Match2 || "", a: fields.Match2A || "" },
      { q: fields.Match3 || "", a: fields.Match3A || "" },
    ],
  };
}

export function groupFromFields(fields: Record<string, string>): CourseLmsGroup {
  return {
    id: `grp-${Date.now().toString(36)}`,
    name: (fields.Name || fields["Group name"] || "New group").trim(),
    members: [],
  };
}

export function badgeFromFields(fields: Record<string, string>): CourseLmsBadge {
  return {
    id: `badge-${Date.now().toString(36)}`,
    name: (fields.Name || "Untitled badge").trim(),
    version: (fields.Version || "").trim() || undefined,
    language: (fields.Language || "English").trim(),
    description: (fields.Description || "").trim(),
    criteria: (fields.Criteria || "").trim(),
    awardedStudentIds: (fields.StudentIds || "").split(",").map((value) => value.trim()).filter(Boolean),
  };
}

export function competencyFromFields(fields: Record<string, string>) {
  let levels: string[] = [];
  try {
    const parsed = JSON.parse(fields.Levels || "[]") as unknown;
    if (Array.isArray(parsed)) levels = parsed.filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
  } catch {
    levels = [];
  }
  return {
    id: (fields.Id || fields.id || "").trim() || `comp-${Date.now().toString(36)}`,
    name: (fields.Name || fields.Competency || "Course competency").trim(),
    resource: fields.Resource || fields.Activity || "",
    description: (fields.Description || "").trim(),
    levels,
    assessments: [],
  };
}
