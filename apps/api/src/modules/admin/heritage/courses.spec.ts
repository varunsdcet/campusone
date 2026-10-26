/* Course Management (C01–C30): field definitions for every form and popup, rendered by the shared field grid. */

export type Data = Record<string, unknown>;

export type Kind = "text" | "number" | "select" | "bool" | "textarea" | "html" | "date" | "time" | "multi" | "multiList" | "people" | "file" | "rows" | "ref" | "dual";

export type Field = {
  key: string;
  label: string;
  kind: Kind;
  required?: boolean;
  options?: readonly string[];
  /** Options come from `meta.lists[dyn]`. */
  dyn?: string;
  dynExtra?: string[];
  /** Options come from `meta.refs[ref]` (stored value is the record id). */
  ref?: string;
  min?: number;
  max?: number;
  integer?: boolean;
  dflt?: unknown;
  when?: { key: string; equals: string | boolean | string[]; not?: boolean };
  section?: string;
  group?: string;
  sub?: string;
  suffix?: string;
  hint?: string;
  lang?: boolean;
  placeholder?: string;
  accept?: string;
  rowFields?: Field[];
  rowLabel?: string;
  addLabel?: string;
  rowSave?: string;
  columns?: string[];
  /** Shown on the create form only (Repository: Course Format, Sections / Weeks). */
  createOnly?: boolean;
};

export const ACTIVE = ["Active", "Inactive"] as const;
export const YES_NO = ["Yes", "No"] as const;
export const NO_YES = ["No", "Yes"] as const;
export const EN_DIS = ["Enabled", "Disabled"] as const;
export const DIS_EN = ["Disabled", "Enabled"] as const;
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const PRIMARY_CATEGORY = "primary";
export const UNASSIGNED = "Unassigned";

export const INTAKE_TYPES = ["Standard", "Continuous Feed-In"] as const;
export const ENROLMENT_PERMISSIONS = ["No permission required", "Instructor approval", "Department approval"] as const;
export const SYLLABUS_PRIVACY = ["Private", "Enrolled Students", "Public"] as const;
export const COST_CALCULATIONS = ["Total Amount", "Per Credit", "Per Hour"] as const;
export const TIMES_OF_DAY = ["Morning", "Afternoon", "Evening"] as const;
export const REPOSITORY_SETTINGS = ["Use brand settings", "Course-specific", "Disabled"] as const;
export const TRANSCRIPT = ["Visible on Transcript", "Hidden from Transcript"] as const;
export const COUNT_CREDITS = ["Normal", "Elective Credit", "Do Not Count"] as const;
export const PRIOR_EXPERIENCE = ["Eligible", "Not Eligible"] as const;
export const NORMAL_EXEMPT = ["Normal", "Exempt"] as const;
export const REPEAT_ENROLMENT = ["Use program settings", "Allow repeat enrolment", "Do not allow repeat enrolment"] as const;
export const TEXTBOOK_OPT_OUT = ["System Default", "Enabled", "Disabled"] as const;
export const RECURRING_FEE = ["One Time", "Customize"] as const;
export const SCHEDULE_TYPES = ["Simple Weekly Schedule"] as const;
export const WITHDRAWAL = ["Use default deadline settings", "Custom deadline"] as const;
export const SCANNER = ["Automated attendance scanner enrolment disabled", "Automated attendance scanner enrolment enabled"] as const;
export const SESSION_STATUSES = ["Not Started", "In Progress", "Completed"] as const;
export const TEMPLATE_STATUSES = ["Draft", "Active"] as const;
export const LINKING_CONDITIONS = ["Optional Enrolment", "Mandatory Enrolment"] as const;
export const LEARNING_STYLES = ["Face to Face", "Online", "Blended / Hybrid", "Self-Paced"] as const;
export const TEXTBOOK_FORMATS = ["Print", "e-Text / Digital", "Print + e-Text"] as const;
export const GRADE_CONDITIONS = ["Pass", "Fail", "Incomplete", "Withdrawn", "In Progress"] as const;
export const COURSE_FORMATS = ["Topics", "Weekly"] as const;
export const REPOSITORY_FILTERS = ["Master Repository", "Default Repositories"] as const;
export const BADGE_APPROVAL = ["Instant / Automated", "Requires Approval"] as const;
export const BADGE_TYPES = ["Course", "Workshop", "Entry / Progress Test", "Designation / Academic Performance"] as const;
export const AVERAGE_TYPES = ["None", "Grade Point Average", "Average Percentage"] as const;
export const COURSES_COMPLETED = ["Any", "None", ...Array.from({ length: 20 }, (_, i) => String(i + 1))] as const;
export const TERMS_COMPLETED = ["Any", ...Array.from({ length: 12 }, (_, i) => String(i + 1))] as const;
export const QUESTION_TYPES = ["Multiple Choice", "Text Comments"] as const;
export const ANSWER_DEFAULT = ["Not Default", "Default"] as const;
export const GRADES_VISIBILITY = ["Evaluation optional", "Evaluation mandatory for final grades release"] as const;
export const CHANGE_STATUSES = ["Pending Review", "Approved", "Declined"] as const;
export const CHANGE_TYPES = ["New Session / Offering", "Session / Offering Change", "Course Change"] as const;
export const BACKUP_STATUSES = ["Available Backups", "All Backups"] as const;
export const BULK_UPDATES = ["Credit Value"] as const;
export const ALL_CAMPUSES = "All Campuses";
export const ALL_COURSE_TYPES = "All Course Types";
export const ALL_PROGRAMS = "All Programs";

const f = (key: string, label: string, kind: Kind, extra: Partial<Field> = {}): Field => ({ key, label, kind, ...extra });
const sel = (key: string, label: string, options: readonly string[], extra: Partial<Field> = {}): Field => ({ key, label, kind: "select", options, dflt: options[0], required: true, ...extra });
const money = (key: string, label: string, extra: Partial<Field> = {}): Field => f(key, label, "number", { min: 0, max: 1_000_000, suffix: "CAD", ...extra });

/* ------------------------------------------------------------------ */
/* Course (Add / Edit Course and the Course Settings tab)               */
/* ------------------------------------------------------------------ */

const D = "Course Details";
const O = "Course Outline / Description";
const A = "Course Chair & Lead Accesses";
const T = "Course Tuition";
const S = "Default Course Schedule";
const G = "Grading & Course Content Settings";
const M = "Miscellaneous Conditions";

export const COURSE_FIELDS: Field[] = [
  f("category", "Course Category", "ref", { ref: "courseCategories", required: true, section: D, placeholder: "-- Select Category --" }),
  f("group", "Course Group", "ref", { ref: "courseGroups", section: D, placeholder: "No Grouping" }),
  f("name", "Course Name", "text", { required: true, section: D }),
  f("number", "Course Number", "text", { required: true, section: D }),
  f("credits", "Course Credit Value", "number", { required: true, min: 0, max: 100, section: D, dflt: 3 }),
  sel("intakeType", "Course In-take Type", INTAKE_TYPES, { section: D }),
  sel("enrolmentPermission", "Course Enrolment Permission", ENROLMENT_PERMISSIONS, { section: D }),
  f("description", "Course Description", "textarea", { section: O }),
  f("syllabus", "Course Syllabus", "file", { section: O, accept: ".pdf,.doc,.docx,image/*", hint: "PDF, Word or image, up to 8 MB." }),
  sel("syllabusPrivacy", "Course Syllabus Privacy", SYLLABUS_PRIVACY, { section: O }),
  f("overridePermissions", "Over-ride course category permissions", "bool", { section: A }),
  f("academicChair", "Academic Chair", "people", { section: A, placeholder: "Start typing a user name", when: { key: "overridePermissions", equals: true } }),
  f("courseLead", "Course Lead", "people", { section: A, placeholder: "Start typing a user name", when: { key: "overridePermissions", equals: true } }),
  f("tuitionIncluded", "Course tuition included in the program cost", "bool", { section: T }),
  sel("costCalculation", "Course Cost Calculation", COST_CALCULATIONS, { section: T, when: { key: "tuitionIncluded", equals: false } }),
  money("domestic", "Domestic", { section: T, group: "Course Cost", sub: "Domestic", when: { key: "tuitionIncluded", equals: false } }),
  money("international", "International", { section: T, group: "Course Cost", sub: "International", when: { key: "tuitionIncluded", equals: false } }),
  f("totalHours", "Total Course Hours", "number", { min: 0, max: 5000, section: S }),
  f("hoursPerDay", "Hours per Day", "number", { min: 0, max: 24, section: S }),
  f("weekdays", "Weekly Schedule", "multi", { options: WEEKDAYS, section: S }),
  sel("timeOfDay", "Time of Day", TIMES_OF_DAY, { section: S }),
  f("customizeWeekly", "Customize weekly schedule", "bool", { section: S }),
  f("gradingScheme", "Grading Scheme", "ref", { ref: "gradingSchemes", section: G, placeholder: "-- Select Grading Scheme --" }),
  sel("repositorySettings", "Repository Settings", REPOSITORY_SETTINGS, { section: G }),
  sel("transcript", "Transcript", TRANSCRIPT, { section: M }),
  sel("countCredits", "Count Credits", COUNT_CREDITS, { section: M }),
  sel("priorExperience", "Prior Experience", PRIOR_EXPERIENCE, { section: M }),
  sel("registrationLimits", "Registration Limits", NORMAL_EXEMPT, { section: M }),
  sel("repeatEnrolment", "Repeat Enrolment Condition", REPEAT_ENROLMENT, { section: M }),
  sel("commissions", "Commissions", NORMAL_EXEMPT, { section: M }),
  sel("promotionCalculation", "Promotion Calculation", NORMAL_EXEMPT, { section: M }),
  sel("fullTimeCalculation", "Full-time Calculation", NORMAL_EXEMPT, { section: M }),
  sel("textbookOptOut", "Textbook Opt-Out", TEXTBOOK_OPT_OUT, { section: M }),
];

/* ------------------------------------------------------------------ */
/* Session / Offering                                                    */
/* ------------------------------------------------------------------ */

const SS = "Session Settings";
const SI = "Session Instruction & Accesses";
const SC = "Session Schedule";
const SD = "Additional Session Dates";
const ST = "Session Tuition";
const SG = "Grading";
const SP = "Self-Enrolment Permissions";
const SA = "Attendance / Participation";
const SL = "Course Content";

export const EXAM_FIELDS: Field[] = [
  f("date", "Exam Date", "date", { required: true }),
  f("start", "Exam Start Time", "time"),
  f("end", "Exam Finish Time", "time"),
  f("location", "Exam Location", "ref", { ref: "classrooms", placeholder: "Not Set" }),
];

/** `meetings` (weekday + start / finish) is edited by the weekly timetable control on the session form. */
export const SESSION_FIELDS: Field[] = [
  f("name", "Session Name", "text", { section: SS, hint: "Optional — a session code is generated when left blank." }),
  sel("classPeriod", "Class / Batch Period", ["Morning", "Afternoon", "Evening", "Flexible"], { section: SS, dflt: "Morning" }),
  f("sessionType", "Session Type", "ref", { ref: "courseTypes", section: SS, placeholder: "-- Select Session Type --" }),
  f("campus", "Campus / Location", "ref", { ref: "campuses", required: true, section: SS }),
  f("classroom", "Classroom", "ref", { ref: "classrooms", section: SS, placeholder: "Not Set" }),
  f("sameAsClassroom", "Same as classroom size", "bool", { section: SS }),
  f("maxEnrolments", "Maximum Enrolments", "number", { min: 0, max: 5000, integer: true, section: SS, dflt: 30 }),
  f("minEnrolments", "Minimum Enrolments", "number", { min: 0, max: 5000, integer: true, section: SS }),
  sel("waitlist", "Enrolment Waitlist", EN_DIS, { section: SS }),
  sel("reserved", "Reserved Enrolments", DIS_EN, { section: SS }),
  sel("selfEnrolment", "Student Self-Enrolment", EN_DIS, { section: SS }),
  f("instructors", "Faculty Members (Multiple Select)", "people", {
    dflt: [],
    section: SI,
    placeholder: "Search and add faculty members",
    hint: "Select faculty members one by one. Every selected faculty stays as a removable chip.",
  }),
  f("assistants", "Teaching Assistant(s)", "people", { section: SI, placeholder: "Type a name and select the user" }),
  f("guests", "Guest(s)", "people", { section: SI, placeholder: "Type a name and select the user" }),
  f("continuous", "This is a continuous feed-in course session", "bool", { section: SC }),
  f("startDate", "Start Date", "date", { required: true, section: SC }),
  f("endDate", "End Date", "date", { required: true, section: SC, when: { key: "continuous", equals: false } }),
  sel("scheduleType", "Schedule Type", SCHEDULE_TYPES, { section: SC }),
  f("autoMedian", "Automatically calculate median date", "bool", { section: SD, dflt: true }),
  f("medianDate", "Median Date", "date", { section: SD, when: { key: "autoMedian", equals: false } }),
  sel("medianGrading", "Median Grading", DIS_EN, { section: SD }),
  f("exams", "Exam Dates", "rows", { section: SD, rowFields: EXAM_FIELDS, rowLabel: "Exam Date", addLabel: "+ Add Exam Date", rowSave: "Save Exam Date", columns: ["date", "start", "end", "location"] }),
  f("tuitionIncluded", "Course tuition included in the program cost", "bool", { section: ST, dflt: true }),
  money("domestic", "Domestic", { section: ST, group: "Session Fee", sub: "Domestic", when: { key: "tuitionIncluded", equals: false } }),
  money("international", "International", { section: ST, group: "Session Fee", sub: "International", when: { key: "tuitionIncluded", equals: false } }),
  f("gradingScheme", "Grading Scheme", "ref", { ref: "gradingSchemes", section: SG, placeholder: "-- Select Grading Scheme --" }),
  f("overrideSelfEnrolStart", "Over-ride self-enrolment start date", "bool", { section: SP }),
  f("selfEnrolStart", "Self-Enrolment Start Date", "date", { section: SP, when: { key: "overrideSelfEnrolStart", equals: true } }),
  f("customizePermissions", "Customize enrolment permissions", "bool", { section: SP }),
  f("allowExternal", "Allow external / direct student enrolment", "bool", { section: SP }),
  sel("withdrawal", "Course Withdrawal", WITHDRAWAL, { section: SP }),
  f("withdrawalDate", "Withdrawal Deadline", "date", { section: SP, when: { key: "withdrawal", equals: "Custom deadline" } }),
  sel("attendanceGrading", "Attendance Grading", DIS_EN, { section: SA }),
  sel("scannerEnrolment", "Scanner Enrolment", SCANNER, { section: SA }),
  sel("enableLms", "Enable LMS", DIS_EN, { section: SL }),
];

/* ------------------------------------------------------------------ */
/* Generic entities                                                      */
/* ------------------------------------------------------------------ */

export type EntityKey =
  | "categories"
  | "groups"
  | "types"
  | "textbooks"
  | "tests"
  | "competencies"
  | "gradingSchemes"
  | "evaluations"
  | "questions"
  | "repository"
  | "prereqTemplates"
  | "linkedCourses"
  | "transferCourses"
  | "resourceCategories"
  | "resources"
  | "badges";

export type EntityDef = {
  screen: string;
  audit: string;
  label: string;
  /** Records belong to a course (contextKey = course id). */
  parent?: "course";
  search: string[];
  unique: Array<{ key: string; label: string }>;
  fields: Field[];
  save: string;
  /** Records are persisted in a dedicated table instead of the configuration store. */
  table?: "resourceCategory" | "resource" | "badge" | "transfer";
};

export const GRADE_ROW_FIELDS: Field[] = [
  f("letter", "Letter", "text", { required: true }),
  f("percent", "Percent", "number", { min: 0, max: 100, hint: "Minimum percentage for this grade." }),
  f("gradePoint", "Grade Point", "number", { min: 0, max: 10 }),
  sel("credit", "Credit", YES_NO),
  sel("condition", "Condition", GRADE_CONDITIONS),
];

export const TEXTBOOK_COURSE_FIELDS: Field[] = [
  f("course", "Course Name", "ref", { ref: "courses", required: true }),
  sel("optOut", "Opt In/Out", TEXTBOOK_OPT_OUT),
  sel("recurringFee", "Recurring Textbook Fee", RECURRING_FEE),
];

export const ANSWER_FIELDS: Field[] = [
  f("answer", "Answer", "text", { required: true, lang: true }),
  sel("dflt", "Default", ANSWER_DEFAULT),
  f("referencing", "Referencing", "ref", {
    ref: "questions",
    placeholder: "None",
    hint: "Optionally reference another saved Question Bank question.",
  }),
  f("score", "Score", "number", { min: -100, max: 100 }),
];

export const ENTITIES: Record<EntityKey, EntityDef> = {
  categories: {
    screen: "CM:CATEGORY",
    audit: "C19",
    label: "Course category",
    search: ["name", "abbreviation"],
    unique: [{ key: "name", label: "Course Category Name" }],
    save: "Save Course Category",
    fields: [
      f("parent", "Parent Category", "ref", { ref: "categoryParents", required: true, dflt: PRIMARY_CATEGORY, section: "Course Category Details" }),
      f("faculty", "Category Faculty", "select", { dyn: "faculties", dynExtra: [UNASSIGNED], dflt: UNASSIGNED, required: true, section: "Course Category Details" }),
      f("name", "Course Category Name", "text", { required: true, lang: true, section: "Course Category Details" }),
      f("abbreviation", "Abbreviation", "text", { lang: true, section: "Course Category Details" }),
      sel("active", "Active / Inactive", ACTIVE, { section: "Course Category Details" }),
      f("academicChair", "Academic Chair", "people", { section: "Category Chair & Lead Accesses", placeholder: "Start typing a user name" }),
      f("courseLead", "Course Lead", "people", { section: "Category Chair & Lead Accesses", placeholder: "Start typing a user name" }),
    ],
  },
  groups: {
    screen: "CM:GROUP",
    audit: "C20",
    label: "Course group",
    search: ["name", "abbreviation"],
    unique: [{ key: "name", label: "Course Group Name" }],
    save: "Save Course Group",
    fields: [
      f("name", "Course Group Name", "text", { required: true, lang: true, section: "Course Group Details" }),
      f("abbreviation", "Abbreviation", "text", { lang: true, section: "Course Group Details" }),
    ],
  },
  types: {
    screen: "CM:TYPE",
    audit: "C21",
    label: "Course type",
    search: ["name", "abbreviation"],
    unique: [{ key: "name", label: "Course Type Name" }],
    save: "Save Course Type",
    fields: [
      f("name", "Course Type Name", "text", { required: true, lang: true, section: "Course Type Details" }),
      f("abbreviation", "Abbreviation", "text", { lang: true, section: "Course Type Details" }),
      sel("active", "Active / Inactive", ACTIVE, { section: "Course Type Details" }),
      sel("learningStyle", "Learning Style", LEARNING_STYLES, { section: "Course Type Details" }),
      sel("asynchronous", "Asynchronous", NO_YES, { section: "Course Type Details" }),
      f("customizePermissions", "Customize enrolment permissions", "bool", { section: "Course Type Details" }),
    ],
  },
  textbooks: {
    screen: "CM:TEXTBOOK",
    audit: "C15",
    label: "Textbook",
    search: ["name", "isbn"],
    unique: [{ key: "isbn", label: "ISBN" }],
    save: "Save Textbook",
    fields: [
      f("name", "Textbook Name", "text", { required: true, section: "Textbook Details" }),
      f("isbn", "ISBN", "text", { section: "Textbook Details" }),
      sel("format", "Format", TEXTBOOK_FORMATS, { section: "Textbook Details" }),
      money("domestic", "Domestic", { section: "Textbook Fees", group: "Textbook Fees", sub: "Domestic" }),
      money("international", "International", { section: "Textbook Fees", group: "Textbook Fees", sub: "International" }),
      f("courses", "Textbook Courses", "rows", {
        section: "Textbook Courses",
        rowFields: TEXTBOOK_COURSE_FIELDS,
        rowLabel: "Course",
        addLabel: "ADD",
        rowSave: "Save Course",
        columns: ["course", "optOut", "recurringFee"],
      }),
    ],
  },
  tests: {
    screen: "CM:TEST",
    audit: "C16",
    label: "Entry / progress test",
    search: ["name"],
    unique: [{ key: "name", label: "Test Name" }],
    save: "Save Entry / Progress Test",
    fields: [
      f("name", "Test Name", "text", { required: true, section: "Entry / Progress Test Details" }),
      f("enableLms", "Enable Moodle LMS for this Entry / Progress Test", "bool", { section: "Entry / Progress Test Details" }),
      money("domestic", "Domestic", { section: "Test Fees", group: "Test Fees", sub: "Domestic" }),
      money("international", "International", { section: "Test Fees", group: "Test Fees", sub: "International" }),
      f("gradingScheme", "Grading Scheme", "ref", { ref: "gradingSchemes", required: true, section: "Grading" }),
      f("instructors", "Instructor Name", "people", { section: "Instructor(s)", placeholder: "Start typing an instructor name" }),
    ],
  },
  competencies: {
    screen: "CM:COMPETENCY",
    audit: "C25",
    label: "Competency",
    search: ["name"],
    unique: [{ key: "name", label: "Name" }],
    save: "Save Competency",
    fields: [f("name", "Name", "text", { required: true, lang: true, section: "Competency Details" }), sel("status", "Status", ACTIVE, { section: "Competency Details" })],
  },
  gradingSchemes: {
    screen: "CM:GRADING",
    audit: "C26",
    label: "Grading scheme",
    search: ["name"],
    unique: [{ key: "name", label: "Grading Scheme Name" }],
    save: "Save Grading Scheme",
    fields: [
      f("name", "Grading Scheme Name", "text", { required: true, section: "Grading Scheme Details" }),
      f("isDefault", "This is the default grading scheme", "bool", { section: "Grading Scheme Details" }),
      sel("useLetters", "Use Letter Grades", YES_NO, { section: "Grading Scheme Details" }),
      sel("usePercentages", "Use Percentages", YES_NO, { section: "Grading Scheme Details" }),
      f("roundUp", "Enable round-up options for marginal letter grades in final standings", "bool", { section: "Grading Scheme Details" }),
      sel("useGradePoints", "Use Grade Points", YES_NO, { section: "Grading Scheme Details" }),
      sel("active", "Active / Inactive", ACTIVE, { section: "Grading Scheme Details" }),
      f("grades", "Grades", "rows", {
        section: "Grades",
        rowFields: GRADE_ROW_FIELDS,
        rowLabel: "Grade",
        addLabel: "Add",
        rowSave: "Save Grade",
        columns: ["letter", "percent", "gradePoint", "credit", "condition"],
      }),
    ],
  },
  evaluations: {
    screen: "CM:EVALUATION",
    audit: "C27",
    label: "Evaluation",
    search: ["title"],
    unique: [{ key: "title", label: "Evaluation Title" }],
    save: "Save Evaluation",
    fields: [
      f("title", "Evaluation Title", "text", { required: true, section: "Evaluation Details" }),
      f("description", "Description", "html", { section: "Evaluation Details" }),
      sel("active", "Active / Inactive", ACTIVE, { section: "Evaluation Details" }),
      sel("autoAssign", "Auto-Assignment Status", DIS_EN, { section: "Automatic Assignment / Release" }),
      f("availabilityDays", "Availability", "number", { min: 0, max: 365, integer: true, suffix: "days before course end date", dflt: 2, section: "Automatic Assignment / Release", when: { key: "autoAssign", equals: "Enabled" } }),
      f("expiresDays", "Expires", "number", { min: 1, max: 365, integer: true, suffix: "days after evaluation released", dflt: 14, section: "Automatic Assignment / Release", when: { key: "autoAssign", equals: "Enabled" } }),
      f("campuses", "Assign to Campuses", "multiList", { ref: "campuses", section: "Automatic Assignment / Release", hint: "Leave empty for all campuses. Ctrl + Click to select several.", when: { key: "autoAssign", equals: "Enabled" } }),
      f("courses", "Assign to Courses", "multiList", { ref: "courses", section: "Automatic Assignment / Release", hint: "Leave empty for all courses. Ctrl + Click to select several.", when: { key: "autoAssign", equals: "Enabled" } }),
      sel("autoRelease", "Auto-Release Status", DIS_EN, { section: "Automatic Assignment / Release" }),
      f("releaseDays", "Release Results", "number", { min: 0, max: 365, integer: true, suffix: "days after course end date", dflt: 1, section: "Automatic Assignment / Release", when: { key: "autoRelease", equals: "Enabled" }, hint: "Course must be complete before results are released." }),
      sel("gradesVisibility", "Grades Visibility", GRADES_VISIBILITY, { section: "Final Grades Release" }),
    ],
  },
  questions: {
    screen: "CM:QUESTION",
    audit: "C28",
    label: "Question",
    search: ["question", "type"],
    unique: [],
    save: "Save Question",
    fields: [
      sel("type", "Question Type", QUESTION_TYPES),
      f("question", "Question", "textarea", { required: true, lang: true }),
      f("answers", "Answers", "rows", {
        rowFields: ANSWER_FIELDS,
        rowLabel: "Answer",
        addLabel: "Add",
        rowSave: "Save Answer",
        columns: ["answer", "dflt", "referencing", "score"],
        when: { key: "type", equals: "Multiple Choice" },
      }),
    ],
  },
  repository: {
    screen: "CM:REPOSITORY",
    audit: "C11",
    label: "Content course",
    search: ["name", "_course"],
    unique: [],
    save: "Save Content Repository",
    fields: [
      f("course", "Course", "ref", { ref: "courses", required: true, section: "Content Course" }),
      f("name", "Note / Name", "text", { section: "Content Course" }),
      sel("campusesMode", "Campuses", [ALL_CAMPUSES, "Selected Campuses"], { section: "Content Course" }),
      f("campuses", "Selected Campuses", "multi", { ref: "campuses", required: true, section: "Content Course", when: { key: "campusesMode", equals: "Selected Campuses" } }),
      sel("typesMode", "Course Types", [ALL_COURSE_TYPES, "Selected Course Types"], { section: "Content Course" }),
      f("types", "Selected Course Types", "multi", { ref: "courseTypes", required: true, section: "Content Course", when: { key: "typesMode", equals: "Selected Course Types" } }),
      sel("isDefault", "Default", YES_NO, { section: "Content Course" }),
      sel("format", "Course Format", COURSE_FORMATS, { section: "Content Course", createOnly: true }),
      f("sections", "Sections / Weeks", "number", { min: 1, max: 52, integer: true, dflt: 10, section: "Content Course", createOnly: true }),
    ],
  },
  prereqTemplates: {
    screen: "CM:PREREQ",
    audit: "C05",
    label: "Prerequisite template",
    parent: "course",
    search: ["name"],
    unique: [{ key: "name", label: "Template Name" }],
    save: "Save Template",
    fields: [f("name", "Template Name", "text", { required: true }), sel("status", "Template Status", TEMPLATE_STATUSES), f("effectiveDating", "Enable effective dating", "bool")],
  },
  linkedCourses: {
    screen: "CM:LINKED",
    audit: "C06",
    label: "Linked course",
    parent: "course",
    search: ["_course"],
    unique: [{ key: "course", label: "Linked Course" }],
    save: "Save Linked Course",
    fields: [f("course", "Select Linked Course", "ref", { ref: "courses", required: true }), sel("condition", "Linking Condition", LINKING_CONDITIONS)],
  },
  transferCourses: {
    screen: "LOC:TRANSFER_COURSE",
    audit: "C07",
    label: "Transfer course",
    parent: "course",
    table: "transfer",
    search: ["name", "number", "_institution"],
    unique: [],
    save: "Save Transfer Course",
    fields: [
      f("institution", "Transfer Institution", "ref", { ref: "institutions", required: true }),
      f("name", "Transfer Course Name", "text", { required: true }),
      f("number", "Transfer Course Number", "text", { required: true }),
      f("credits", "Transfer Course Credits", "number", { min: 0, max: 100 }),
    ],
  },
  resourceCategories: {
    screen: "CM:RESOURCE_CATEGORY",
    audit: "C22",
    label: "Resource category",
    table: "resourceCategory",
    search: ["name"],
    unique: [{ key: "name", label: "Category Name" }],
    save: "Save Resource Category",
    fields: [f("name", "Category Name", "text", { required: true, lang: true })],
  },
  resources: {
    screen: "CM:RESOURCE",
    audit: "C22",
    label: "Course resource",
    table: "resource",
    search: ["name", "_course", "_category"],
    unique: [],
    save: "Save Resource",
    fields: [
      f("category", "Resource Category", "ref", { ref: "resourceCategories", placeholder: "-- No Category --", section: "Resource Details" }),
      f("course", "Course", "ref", { ref: "courses", required: true, section: "Resource Details" }),
      f("name", "Resource Name", "text", { required: true, lang: true, section: "Resource Details" }),
      sel("allowQuantities", "Allow Resource Quantities", NO_YES, { section: "Resource Details" }),
    ],
  },
  badges: {
    screen: "CM:BADGE",
    audit: "C24",
    label: "Badge / accomplishment",
    table: "badge",
    search: ["name", "badgeType"],
    unique: [{ key: "name", label: "Name" }],
    save: "Save Badge / Accomplishment",
    fields: [
      f("name", "Name", "text", { required: true, lang: true, section: "Badge / Accomplishment Details" }),
      f("description", "Description", "text", { lang: true, section: "Badge / Accomplishment Details" }),
      f("badgeText", "Badge Text", "html", { section: "Badge / Accomplishment Details" }),
      f("image", "Badge Image", "file", { accept: "image/*", section: "Badge / Accomplishment Details" }),
      sel("approval", "Badge Approval", BADGE_APPROVAL, { section: "Badge Criteria" }),
      sel("badgeType", "Badge Type", BADGE_TYPES, { section: "Badge Criteria" }),
      sel("programsMode", "Program(s)", [ALL_PROGRAMS, "Select Programs"], { section: "Badge Criteria" }),
      f("programs", "Selected Programs", "multiList", { dyn: "programs", required: true, section: "Badge Criteria", when: { key: "programsMode", equals: "Select Programs" }, hint: "Ctrl + Click to select several." }),
      sel("coursesCompleted", "Courses Completed", COURSES_COMPLETED, { section: "Badge Criteria" }),
      sel("termsCompleted", "Terms Completed", TERMS_COMPLETED, { section: "Badge Criteria" }),
      sel("averageType", "Required Average Type", AVERAGE_TYPES, { section: "Badge Criteria" }),
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Popups served outside the entity engine                              */
/* ------------------------------------------------------------------ */

export const COURSE_TEXTBOOK_FIELDS: Field[] = [
  f("textbook", "Select Textbook", "ref", { ref: "textbooks", required: true }),
  sel("optOut", "Textbook Opt-Out", TEXTBOOK_OPT_OUT),
  sel("recurringFee", "Recurring Textbook Fee", RECURRING_FEE),
];
