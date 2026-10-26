export type LmsActivityKind = "activity" | "resource";

export type LmsActivityType = {
  code: string;
  label: string;
  kind: LmsActivityKind | string;
  help?: string;
  color?: string;
  iconTone?: "light" | "dark" | "paper";
};

export const LMS_ACTIVITY_TYPE_META: Record<
  string,
  { help: string; color: string; iconTone?: "light" | "dark" | "paper" }
> = {
  assignment: {
    color: "#e91e8c",
    help: "The assignment activity lets a teacher communicate tasks, collect work, and provide grades and feedback.",
  },
  bigbluebutton: {
    color: "#0d47a1",
    help: "Create a live BigBlueButton room for real-time classes, with optional recordings.",
  },
  book: {
    color: "#2196f3",
    help: "The book resource is a multi-page content module with chapters and subchapters.",
  },
  chat: {
    color: "#43a047",
    help: "The chat activity allows participants to have a real-time synchronous discussion.",
  },
  checklist: {
    color: "#ffffff",
    iconTone: "paper",
    help: "Create a checklist of tasks for students to complete and track.",
  },
  choice: {
    color: "#43a047",
    help: "The choice activity lets a teacher ask a single question and offer a selection of responses.",
  },
  database: {
    color: "#ff7043",
    help: "The database activity lets participants create, maintain and search a collection of entries.",
  },
  externaltool: {
    color: "#42a5f5",
    help: "The external tool activity lets students interact with LTI-compliant learning resources.",
  },
  feedback: {
    color: "#66bb6a",
    help: "The feedback activity lets you create a custom survey for collecting responses.",
  },
  file: {
    color: "#42a5f5",
    help: "The file resource lets a teacher provide a file as a course resource.",
  },
  folder: {
    color: "#42a5f5",
    help: "The folder resource displays a set of related files inside a single folder.",
  },
  forum: {
    color: "#ef5350",
    help: "The forum activity enables students and teachers to exchange ideas by posting comments.",
  },
  glossary: {
    color: "#ef5350",
    help: "The glossary activity allows participants to create and maintain a list of definitions.",
  },
  h5p: {
    color: "#1e88e5",
    help: "Upload and display an H5P interactive content package.",
  },
  imscp: {
    color: "#42a5f5",
    help: "Add a package of content that follows the IMS Content Packaging standard.",
  },
  interactive: {
    color: "#212121",
    help: "Create H5P interactive content in the editor, such as videos, quizzes and presentations.",
  },
  journal: {
    color: "#ef5350",
    help: "The journal activity enables one-to-one private writing between a student and the teacher.",
  },
  label: {
    color: "#42a5f5",
    help: "The label resource inserts text and multimedia among activity links on the course page.",
  },
  lesson: {
    color: "#42a5f5",
    help: "The lesson activity presents content and practice questions in a flexible, branched path.",
  },
  mcgrawhill: {
    color: "#42a5f5",
    help: "Connect McGraw Hill Campus content and tools to this course.",
  },
  page: {
    color: "#42a5f5",
    help: "The page resource creates a web page that can display text, images, sound, video and links.",
  },
  quiz: {
    color: "#e91e8c",
    help: "The quiz activity lets a teacher create quizzes comprising questions of various types.",
  },
  scorm: {
    color: "#42a5f5",
    help: "A SCORM package is a bundle of web content that follows the SCORM standard.",
  },
  survey: {
    color: "#43a047",
    help: "The survey activity provides verified survey instruments for gathering data from students.",
  },
  turnitin: {
    color: "#ffffff",
    iconTone: "paper",
    help: "Collect submissions through Turnitin for originality checking and grading.",
  },
  url: {
    color: "#1e88e5",
    help: "The URL resource lets a teacher provide a web link as a course resource.",
  },
  wiki: {
    color: "#ff7043",
    help: "The wiki activity lets participants add and edit a collection of web pages.",
  },
  workshop: {
    color: "#e91e8c",
    help: "The workshop activity enables collection, review and peer assessment of student work.",
  },
};

export const DEFAULT_LMS_ACTIVITY_TYPES: LmsActivityType[] = [
  { code: "assignment", label: "Assignment", kind: "activity" },
  { code: "bigbluebutton", label: "BigBlueButton", kind: "activity" },
  { code: "book", label: "Book", kind: "resource" },
  { code: "chat", label: "Chat", kind: "activity" },
  { code: "checklist", label: "Checklist", kind: "activity" },
  { code: "choice", label: "Choice", kind: "activity" },
  { code: "database", label: "Database", kind: "activity" },
  { code: "externaltool", label: "External tool", kind: "activity" },
  { code: "feedback", label: "Feedback", kind: "activity" },
  { code: "file", label: "File", kind: "resource" },
  { code: "folder", label: "Folder", kind: "resource" },
  { code: "forum", label: "Forum", kind: "activity" },
  { code: "glossary", label: "Glossary", kind: "activity" },
  { code: "h5p", label: "H5P", kind: "activity" },
  { code: "imscp", label: "IMS content package", kind: "resource" },
  { code: "interactive", label: "Interactive Content", kind: "activity" },
  { code: "journal", label: "Journal", kind: "activity" },
  { code: "label", label: "Label", kind: "resource" },
  { code: "lesson", label: "Lesson", kind: "activity" },
  { code: "mcgrawhill", label: "McGraw Hill Campus", kind: "activity" },
  { code: "page", label: "Page", kind: "resource" },
  { code: "quiz", label: "Quiz", kind: "activity" },
  { code: "scorm", label: "SCORM package", kind: "activity" },
  { code: "survey", label: "Survey", kind: "activity" },
  { code: "turnitin", label: "Turnitin Assignment", kind: "activity" },
  { code: "url", label: "URL", kind: "resource" },
  { code: "wiki", label: "Wiki", kind: "activity" },
  { code: "workshop", label: "Workshop", kind: "activity" },
];

export function decorateLmsActivityTypes(types?: Array<{ code: string; label: string; kind: string }>): LmsActivityType[] {
  const source = types?.length ? types : DEFAULT_LMS_ACTIVITY_TYPES;
  const byCode = new Map(source.map((type) => [type.code, type]));
  for (const type of DEFAULT_LMS_ACTIVITY_TYPES) {
    if (!byCode.has(type.code)) byCode.set(type.code, type);
  }
  const ordered = [
    ...DEFAULT_LMS_ACTIVITY_TYPES.map((type) => byCode.get(type.code)).filter((type): type is LmsActivityType => Boolean(type)),
    ...[...byCode.values()].filter((type) => !DEFAULT_LMS_ACTIVITY_TYPES.some((item) => item.code === type.code)),
  ];
  return ordered.map((type) => {
    const catalog = DEFAULT_LMS_ACTIVITY_TYPES.find((item) => item.code === type.code);
    const meta = LMS_ACTIVITY_TYPE_META[type.code];
    return {
      ...type,
      label: catalog?.label || type.label,
      kind: catalog?.kind || type.kind,
      help: meta?.help,
      color: meta?.color,
      iconTone: meta?.iconTone,
    };
  });
}
