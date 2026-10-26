/* Program Management (PR01–PR20): field definitions for every captured form, popup and conditional state. */

export type Data = Record<string, unknown>;

export type Kind = "text" | "textarea" | "html" | "number" | "date" | "datetime" | "select" | "bool" | "multi" | "ref" | "refMulti" | "person" | "people" | "weekly" | "rows";

export type RefTarget =
  | "faculties"
  | "programTypes"
  | "programs"
  | "terms"
  | "tiers"
  | "electiveGroups"
  | "feeTerms"
  | "scheduleFeeTerms"
  | "schedules"
  | "course"
  | "classroom";

export type Field = {
  key: string;
  label: string;
  kind: Kind;
  required?: boolean;
  options?: readonly string[];
  /** Option list resolved from the shared lists in /meta (campuses, statuses, ledger types, …). */
  dyn?: string;
  dynExtra?: readonly string[];
  ref?: RefTarget;
  min?: number;
  max?: number;
  integer?: boolean;
  dflt?: unknown;
  when?: { key: string; equals: string | boolean | readonly string[]; not?: boolean };
  section?: string;
  group?: string;
  sub?: string;
  suffix?: string;
  hint?: string;
  lang?: boolean;
  placeholder?: string;
  rowFields?: Field[];
};

export type EntityKey =
  | "faculties"
  | "programTypes"
  | "programs"
  | "pathways"
  | "pathwayCourses"
  | "tiers"
  | "electiveGroups"
  | "electives"
  | "feeTerms"
  | "fees"
  | "deadlines"
  | "commissions"
  | "terms"
  | "calendars"
  | "programSchedules"
  | "termSchedules"
  | "scheduleFeeTerms"
  | "scheduleFees"
  | "sessions";

export type EntityDef = {
  screen: string;
  audit: string;
  label: string;
  parent?: { entity: EntityKey | "schedule"; label: string };
  fields: Field[];
  unique: Array<{ key: string; label: string; scope: "all" | "parent"; within?: string }>;
  search: string[];
  sortable?: boolean;
};

export const PM = {
  faculty: "PM:FACULTY",
  programType: "PM:PROGRAM_TYPE",
  program: "PM:PROGRAM",
  pathway: "PM:PATHWAY",
  pathwayCourse: "PM:PATHWAY_COURSE",
  tier: "PM:TIER",
  electiveGroup: "PM:ELECTIVE_GROUP",
  elective: "PM:ELECTIVE",
  courseSchedule: "PM:COURSE_SCHEDULE",
  feeTerm: "PM:FEE_TERM",
  fee: "PM:FEE",
  deadline: "PM:DEADLINE",
  commission: "PM:COMMISSION",
  term: "PM:TERM",
  calendar: "PM:CALENDAR",
  schedule: "PM:SCHEDULE",
  scheduleFeeTerm: "PM:SCHED_FEE_TERM",
  scheduleFee: "PM:SCHED_FEE",
  session: "PM:SESSION",
  seed: "PM:SEED",
} as const;

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

const ACTIVE = ["Inactive", "Active"] as const;
const NO_YES = ["No", "Yes"] as const;
const YES_NO = ["Yes", "No"] as const;
const DIS_EN = ["Disabled", "Enabled"] as const;
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => String(from + i));
const withFirst = (first: string, from: number, to: number) => [first, ...range(from, to)];

const f = (key: string, label: string, kind: Kind, extra: Partial<Field> = {}): Field => ({ key, label, kind, ...extra });
const sel = (key: string, label: string, options: readonly string[], extra: Partial<Field> = {}): Field => ({ key, label, kind: "select", options, dflt: options[0], required: true, ...extra });

/* ------------------------------------------------------------------ */
/* Shared option sets                                                   */
/* ------------------------------------------------------------------ */

export const SCHEDULE_TYPES = ["Self-Paced", "Tiers", "Sequential"] as const;
export const FINANCIAL_SCHEMES = ["By Course", "By Program", "By Timeframe"] as const;
export const DROP_PENALTIES = ["Always requires approval", "Instant approval for non-penalty tuition adjustments", "Instant approval for all penalties"] as const;
export const COMPLETION_DATE_CALC = ["By course schedule", "By course length (hours per day)", "By course length (weeks)"] as const;
export const FULL_TIME_CALC = ["By courses taken per term", "By program of study definition"] as const;
export const GPA_CALC = ["Indifferent", "Weighted by Credit Value", "Weighted by Course Hours"] as const;
export const LENGTH_UNITS = ["Days", "Weeks", "Months", "Years"] as const;
export const COURSE_REQUIREMENT = ["All Courses Credited", "Minimum Courses Credited", "Select Courses Credited"] as const;
export const AVERAGE_TYPES = ["Grade Point Average", "Average Percentage"] as const;
export const AVERAGE_CALC = ["All Courses", "Program Plan Courses Only", "Maximum Courses", "Select Courses"] as const;
export const DEADLINE_BASES = ["Term Start Date", "Course Start Date", "Student Start Date", "Fee Posting Date"] as const;
export const DEADLINE_TYPES = ["Due Deadline", "Penalty Deadline", "Enrolment Deadline", "Waitlist Deadline", "Aging Deadline"] as const;
export const AVAILABILITY = [
  "Always Available",
  "First day of class",
  "1 day before start date",
  "2 days before start date",
  "3 days before start date",
  "5 days before start date",
  "7 days before start date",
  "14 days before start date",
] as const;
export const DELIVERY_METHODS = ["Not Set", "Lecture", "Online"] as const;
export const BULK_CATEGORIES = ["Change Dates", "Course Size / Limit", "Delivery Method", "LMS / Import Options", "Grading Scheme", "Instructor(s)", "Location / Room", "Wait List Settings"] as const;
export const OUTPUT_VIS = ["Hidden", "Internal", "Public"] as const;
export const FILTER_VIS = ["Students Only", "Faculty & Staff Only", "Internal Only", "Public", "Hidden"] as const;
export const SHOW_VIS = ["Visible", "Hidden"] as const;
export const COHORT_ASSIGNMENT = [
  "Random",
  "By total credits, then performance",
  "By total credits, then student name",
  "By performance, then total credits",
  "By program completion percentage",
  "By student name",
] as const;

/* ------------------------------------------------------------------ */
/* Row field sets (designations, deadlines, enrolment conditions)       */
/* ------------------------------------------------------------------ */

export const DESIGNATION_FIELDS: Field[] = [
  f("label", "Designation Label", "text", { required: true, lang: true, section: "Designation Details" }),
  sel("designationType", "Designation Type", ["Standing", "Honours"], { section: "Designation Details" }),
  sel("disciplinaryAction", "Disciplinary Action", ["None", "Alert / Warning", "Probation", "Suspension", "Withdrawal", "Expulsion"], { section: "Designation Details" }),
  sel("coursesCompleted", "Courses Completed", range(0, 60), { section: "Designation Conditions" }),
  sel("termsCompleted", "Terms Completed", range(0, 20), { section: "Designation Conditions" }),
  sel("averageCondition", "Designation Condition", AVERAGE_TYPES, { section: "Average Condition" }),
  f("requiredAverage", "Required Average", "number", { min: 0, max: 100, dflt: null, section: "Average Condition" }),
  f("averagePrevious", "Previous Designation", "select", {
    dyn: "designationLabels",
    dynExtra: ["None", "Standing", "Honours", "Probation"],
    dflt: "None",
    required: true,
    section: "Average Condition",
    hint: "Standard states and other designations already added to this program are available here.",
  }),
  sel("improvementLeniency", "Improvement Leniency", ["No Leniency", "No Limit", "Custom Average Condition", "1 Term", "2 Terms", "3 Terms", "4 Terms", "5 Terms"], { section: "Average Condition" }),
  f("averageConsecutive", "Apply consecutive conditions", "bool", { dflt: false, section: "Average Condition" }),
  sel("failingGrades", "Failing Grades", withFirst("Ignore Fails", 1, 20), { section: "Failing Grade Conditions" }),
  f("retroactiveFails", "Retroactively count failing grades from last suspension", "bool", { dflt: false, section: "Failing Grade Conditions" }),
  f("failingPrevious", "Previous Designation", "select", {
    dyn: "designationLabels",
    dynExtra: ["None", "Probation", "Suspension", "Withdrawal"],
    dflt: "None",
    required: true,
    section: "Failing Grade Conditions",
    hint: "Standard states and other designations already added to this program are available here.",
  }),
  f("failingConsecutive", "Apply consecutive conditions", "bool", { dflt: false, section: "Failing Grade Conditions" }),
  f("changeStatus", "Change Student Status", "select", { dyn: "statuses", dynExtra: ["Do not change"], dflt: "Do not change", required: true, section: "Designation Consequences" }),
  sel("previousInfractions", "Previous Infractions", ["None", "Probation", "Suspension", "Withdrawal"], { section: "Designation Consequences" }),
  f("standingFlag", "Standing Flag", "select", { dyn: "flags", dynExtra: ["None"], dflt: "None", required: true, section: "Designation Consequences" }),
];

export const DEADLINE_FIELDS: Field[] = [
  f("days", "Days to Deadline", "number", { integer: true, min: -365, max: 365, required: true, dflt: 0, hint: "Negative values fall before the base date." }),
  sel("baseDate", "Deadline Base Date", DEADLINE_BASES),
  sel("type", "Deadline Type", DEADLINE_TYPES),
  sel("lateFee", "Late Fee", ["None", "Percentage", "Fixed Amount"], { when: { key: "type", equals: "Due Deadline" } }),
  f("lateFeeAmount", "Late Fee Amount", "number", { min: 0, max: 100000, required: true, when: { key: "lateFee", equals: ["Percentage", "Fixed Amount"] } }),
  sel("academicPenalty", "Academic Penalty", ["None", "Dropped Grade", "Failed Grade"], { when: { key: "type", equals: "Penalty Deadline" } }),
  sel("financialPenalty", "Financial Penalty", ["None", "Percentage"], { when: { key: "type", equals: "Penalty Deadline" } }),
  f("penaltyRate", "Penalty Rate", "number", { min: 0, max: 100, required: true, suffix: "%", when: { key: "financialPenalty", equals: "Percentage" } }),
  sel("collectionStatus", "Collection Status", ["No Alert", "Overdue"], { when: { key: "type", equals: "Aging Deadline" } }),
  sel("sendToCollections", "Send to Collections", NO_YES, { when: { key: "type", equals: "Aging Deadline" } }),
  f("note", "Note / Description", "textarea"),
];

export const ENROLMENT_CONDITION_FIELDS: Field[] = [
  f("enrolStart", "Enrolment Start Date", "datetime", { required: true, section: "Enrolment Timeframe" }),
  f("customEnd", "Specify custom enrolment end date", "bool", { dflt: false, section: "Enrolment Timeframe" }),
  f("enrolEnd", "Enrolment Deadline", "datetime", { required: true, when: { key: "customEnd", equals: true }, section: "Enrolment Timeframe" }),
  f("useCohorts", "Use enrolment cohorts", "bool", { dflt: false, section: "Enrolment Timeframe" }),
  sel("cohorts", "Number of Cohorts", range(2, 20), { when: { key: "useCohorts", equals: true }, section: "Cohort Settings" }),
  sel("cohortAssignment", "Cohort Assignment", COHORT_ASSIGNMENT, { when: { key: "useCohorts", equals: true }, section: "Cohort Settings" }),
  sel("interval", "Time Intervals", ["30 minutes", "1 hour", "2 hours", "3 hours", "4 hours"], { when: { key: "useCohorts", equals: true }, section: "Cohort Settings" }),
  sel("lockCohorts", "Lock Cohorts", DIS_EN, { when: { key: "useCohorts", equals: true }, section: "Cohort Settings" }),
  sel("allowOverride", "Allow Override", ["Enabled", "Disabled"], { when: { key: "useCohorts", equals: true }, section: "Cohort Settings" }),
  sel("programScope", "Program of Study", ["All", "Select Program(s)"], { section: "Program Eligibility" }),
  f("programs", "Select Program(s)", "refMulti", { ref: "programs", required: true, dflt: [], when: { key: "programScope", equals: "Select Program(s)" }, section: "Program Eligibility" }),
  sel("coursesCompleted", "Courses Completed", withFirst("Any", 1, 60), { section: "Completion & Standing Conditions" }),
  f("includeCoursesInProgress", "Include courses in progress", "bool", { dflt: false, section: "Completion & Standing Conditions" }),
  sel("termsCompleted", "Terms Completed", withFirst("Any", 1, 20), { section: "Completion & Standing Conditions" }),
  f("includeTermsInProgress", "Include terms in progress", "bool", { dflt: false, section: "Completion & Standing Conditions" }),
  f("creditsRequired", "Credits Required", "number", { min: 0, max: 1000, dflt: null, section: "Completion & Standing Conditions" }),
  f("includeCreditsInProgress", "Include course credits in progress", "bool", { dflt: false, section: "Completion & Standing Conditions" }),
  f("includeTransferCredits", "Include transfer credits", "bool", { dflt: false, section: "Completion & Standing Conditions" }),
  f("gpaRequired", "GPA Required", "number", { min: 0, max: 100, dflt: null, section: "Completion & Standing Conditions" }),
];

/* ------------------------------------------------------------------ */
/* Entities                                                             */
/* ------------------------------------------------------------------ */

const FEE_TERM_BASE: Field[] = [
  f("name", "Term Name", "text", { required: true, lang: true }),
  sel("condition", "Term Condition", ["Courses Completed", "Hours Completed", "Days Completed"]),
  f("requiredCourses", "Required Courses", "number", { integer: true, min: 0, max: 500, required: true, when: { key: "condition", equals: "Courses Completed" } }),
  f("requiredHours", "Required Hours", "number", { integer: true, min: 0, max: 100000, required: true, when: { key: "condition", equals: "Hours Completed" } }),
  f("requiredDays", "Required Days", "number", { integer: true, min: 0, max: 10000, required: true, when: { key: "condition", equals: "Days Completed" } }),
];

const SESSION_FIELDS: Field[] = [
  f("course", "Course", "ref", { ref: "course", required: true }),
  f("linkSchedule", "Link to Other Schedule", "ref", { ref: "schedules", section: "Session Settings", placeholder: "Do not link" }),
  f("sessionName", "Session Name", "text", { section: "Session Settings", hint: "Optional" }),
  sel("classPeriod", "Class / Batch Period", ["Morning", "Afternoon", "Evening", "Flexible"], { section: "Session Settings", dflt: "Morning" }),
  sel("sessionType", "Session Type", ["Primary Session", "Secondary Session"], { section: "Session Settings" }),
  f("campus", "Campus / Location", "select", { dyn: "campuses", dynExtra: ["Not Set"], dflt: "Not Set", required: true, section: "Session Settings" }),
  f("classroom", "Classroom", "ref", { ref: "classroom", section: "Session Settings" }),
  sel("deliveryMethod", "Delivery Method", DELIVERY_METHODS, { section: "Session Settings" }),
  f("maxEnrolments", "Maximum Enrolments", "number", { integer: true, min: 0, max: 10000, dflt: null, section: "Session Settings" }),
  f("sameAsClassroom", "Same as classroom size", "bool", { dflt: false, section: "Session Settings" }),
  sel("selfEnrolment", "Student Self-Enrolment", ["Disabled", "Enabled"], { section: "Session Settings" }),
  f("feedIn", "This is a feed-in course session", "bool", { dflt: false, section: "Session Settings" }),
  f("instructors", "Faculty Members (Multiple Select)", "people", {
    dflt: [],
    section: "Session Instruction & Accesses",
    placeholder: "Search and add faculty members",
    hint: "Select faculty members one by one. Every selected faculty stays as a removable chip.",
  }),
  f("assistants", "Teaching Assistant(s)", "people", { dflt: [], section: "Session Instruction & Accesses" }),
  f("guests", "Guest(s)", "people", { dflt: [], section: "Session Instruction & Accesses" }),
  f("startDate", "Start Date", "date", { section: "Session Schedule" }),
  f("endDate", "End Date", "date", { section: "Session Schedule" }),
  f("recalculate", "Re-calculate future course schedules for primary sessions", "bool", { dflt: false, section: "Session Schedule" }),
  f("term", "Term", "ref", { ref: "terms", section: "Session Schedule" }),
  sel("scheduleType", "Schedule Type", ["Weekly Schedule"], { section: "Session Schedule" }),
  f("weekly", "Weekly Schedule", "weekly", { dflt: {}, section: "Session Schedule" }),
  f("gradingScheme", "Grading Scheme", "select", { dyn: "gradingSchemes", section: "Grading Scheme" }),
  sel("attendanceGrading", "Attendance Grading", DIS_EN, { section: "Attendance / Participation" }),
  sel("scannerEnrolment", "Scanner Enrolment", DIS_EN, { section: "Attendance / Participation" }),
  sel("enableLms", "Enable LMS", ["Disabled", "Moodle"], { section: "Course Content" }),
  sel("waitlist", "Wait List", DIS_EN),
  f("waitlistSize", "Wait List Size", "number", { integer: true, min: 0, max: 1000, dflt: null }),
];

const MASTER_DETAILS: Field[] = [
  f("program", "Program", "ref", { ref: "programs", required: true, section: "Master Schedule Details" }),
  f("abbreviation", "Schedule Abbreviation", "text", { required: true, section: "Master Schedule Details", hint: "Short code shown in the Master Scheduling directory and on session offering codes." }),
  f("description", "Schedule Description", "text", { section: "Master Schedule Details", hint: "Optional" }),
  f("length", "Schedule Length", "number", { integer: true, min: 0, max: 520, dflt: null, section: "Master Schedule Details", group: "Schedule Length", sub: "Length" }),
  sel("lengthUnit", "Length Unit", LENGTH_UNITS, { dflt: "Weeks", section: "Master Schedule Details", group: "Schedule Length", sub: "Unit" }),
  sel("fullTimeCalc", "Full-time Calculation", FULL_TIME_CALC, { section: "Master Schedule Details" }),
  sel("fullTimeMin", "Full-time Minimum", range(0, 30), { section: "Master Schedule Details", suffix: "per term" }),
  f("alwaysFullTime", "Always full-time, if final term of study", "bool", { dflt: false, section: "Master Schedule Details" }),
  sel("enrolmentLimit", "Enrolment Limit", ["No Limit", "Set Limit"], { section: "Enrolment Conditions" }),
  f("enrolmentLimitValue", "Enrolment Limit Value", "number", { integer: true, min: 1, max: 10000, required: true, when: { key: "enrolmentLimit", equals: "Set Limit" }, section: "Enrolment Conditions" }),
];

const DELIVERY: Field[] = [
  sel("enableLms", "Enable LMS", ["Disabled", "Moodle"], { section: "Course Delivery Settings" }),
  sel("studentAvailability", "Student Course Availability", AVAILABILITY, { section: "Course Delivery Settings" }),
  sel("facultyAvailability", "Faculty Course Availability", AVAILABILITY, { section: "Course Delivery Settings" }),
];

export const ENTITIES: Record<EntityKey, EntityDef> = {
  faculties: {
    screen: PM.faculty,
    audit: "PR01",
    label: "Faculty",
    search: ["name", "abbreviation"],
    unique: [{ key: "name", label: "Faculty Name", scope: "all" }],
    fields: [
      f("name", "Faculty Name", "text", { required: true, lang: true, section: "Faculty Details" }),
      f("abbreviation", "Faculty Abbreviation", "text", { section: "Faculty Details" }),
      sel("active", "Active / Inactive", ACTIVE, { dflt: "Active", section: "Faculty Details" }),
    ],
  },
  programTypes: {
    screen: PM.programType,
    audit: "PR13",
    label: "Program type",
    search: ["name", "abbreviation"],
    sortable: true,
    unique: [{ key: "name", label: "Program Type Name", scope: "all" }],
    fields: [
      f("name", "Program Type Name", "text", { required: true, lang: true }),
      f("abbreviation", "Abbreviation", "text", { lang: true }),
      sel("active", "Active / Inactive", ACTIVE, { dflt: "Active" }),
    ],
  },
  programs: {
    screen: PM.program,
    audit: "PR02",
    label: "Program",
    search: ["name", "abbreviation", "legalName"],
    unique: [{ key: "name", label: "Program Name", scope: "all" }],
    fields: [
      f("faculty", "Program Faculty", "ref", { ref: "faculties", required: true, section: "Program Details" }),
      f("name", "Program Name", "text", { required: true, lang: true, section: "Program Details" }),
      f("legalName", "Legal Program Name", "text", { lang: true, section: "Program Details" }),
      f("abbreviation", "Abbreviation", "text", { required: true, lang: true, section: "Program Details" }),
      f("programType", "Program Type", "ref", { ref: "programTypes", required: true, section: "Program Details" }),
      sel("active", "Active / Inactive", ACTIVE, { dflt: "Active", section: "Program Details" }),

      sel("scheduleType", "Schedule Type", SCHEDULE_TYPES, { section: "Program Delivery Settings" }),
      sel("financialScheme", "Financial Scheme", FINANCIAL_SCHEMES, { dflt: "By Program", section: "Program Delivery Settings" }),
      sel("financialUtilization", "Financial Utilization", ["Hours Completed", "Days Completed"], { section: "Program Delivery Settings", when: { key: "financialScheme", equals: "By Course", not: true } }),
      sel("prerequisiteProgram", "Prerequisite Program", NO_YES, { section: "Program Delivery Settings" }),
      f("primaryPrograms", "Primary Programs", "select", { dyn: "programNames", dynExtra: ["Any Eligible Program"], dflt: "Any Eligible Program", required: true, section: "Program Delivery Settings", when: { key: "prerequisiteProgram", equals: "Yes" } }),
      sel("allowApplications", "Allow Applications", YES_NO, { section: "Program Delivery Settings", when: { key: "prerequisiteProgram", equals: "Yes" } }),
      sel("allowCourseSelection", "Allow Course Selection", NO_YES, { section: "Program Delivery Settings", when: { key: "prerequisiteProgram", equals: "Yes" } }),
      sel("enrolmentLeniency", "Enrolment Leniency", range(0, 10), { section: "Program Delivery Settings", when: { key: "prerequisiteProgram", equals: "Yes" } }),
      sel("allowPrerequisitePrograms", "Allow Prerequisite Programs", NO_YES, { section: "Program Delivery Settings" }),

      sel("maxEnrolledCourses", "Maximum Enrolled Courses", withFirst("No Limit", 1, 30), { section: "Program Enrolment Conditions", group: "Maximum Enrolled Courses", sub: "Per term" }),
      sel("maxEnrolledUnit", "Maximum Enrolled Courses Unit", ["Courses", "Credits"], { section: "Program Enrolment Conditions", group: "Maximum Enrolled Courses", sub: "Unit" }),
      sel("maxEnrolledPerDay", "Maximum Enrolled Per Day", withFirst("No Limit", 1, 10), { section: "Program Enrolment Conditions" }),
      sel("maxCourseAttempts", "Maximum Course Attempts", withFirst("No Limit", 1, 10), { section: "Program Enrolment Conditions" }),
      sel("repeatCredited", "Repeat Credited Courses", ["No restrictions", "Disable self-enrolment", "1 Attempt", "2 Attempts", "3 Attempts", "4 Attempts", "5 Attempts"], { section: "Program Enrolment Conditions" }),
      sel("repeatFailed", "Repeat Failed Courses", ["No restrictions", "Must enrol"], { section: "Program Enrolment Conditions" }),
      sel("tierPrerequisites", "Tier Prerequisites", ["No restrictions", "Force prerequisite tiers"], { section: "Program Enrolment Conditions" }),
      sel("dropPenalties", "Drop / Withdraw Penalties", DROP_PENALTIES, { section: "Program Enrolment Conditions" }),

      sel("completionDateCalc", "Completion Date Calculation", COMPLETION_DATE_CALC, { section: "Program Calculations & Statistical Details", when: { key: "scheduleType", equals: "Sequential" } }),
      sel("fullTimeCalc", "Full-time Calculation", FULL_TIME_CALC, { section: "Program Calculations & Statistical Details" }),
      sel("fullTimeMin", "Full-time Minimum", range(0, 30), { dflt: "3", section: "Program Calculations & Statistical Details", suffix: "per term" }),
      f("alwaysFullTime", "Always full-time, if final term of study", "bool", { dflt: false, section: "Program Calculations & Statistical Details" }),
      sel("gpaCalc", "GPA Calculation", GPA_CALC, { section: "Program Calculations & Statistical Details" }),
      sel("enrolmentAverage", "Enrolment Average", range(0, 30), { dflt: "1", section: "Program Calculations & Statistical Details", suffix: "per term" }),
      f("programLength", "Program Length", "number", { min: 0, max: 1000, dflt: null, section: "Program Calculations & Statistical Details", group: "Program Length", sub: "Length" }),
      sel("programLengthUnit", "Program Length Unit", LENGTH_UNITS, { dflt: "Months", section: "Program Calculations & Statistical Details", group: "Program Length", sub: "Unit" }),
      f("avgCredits", "Average Credits per Course", "number", { min: 0, max: 100, dflt: 0, section: "Program Calculations & Statistical Details" }),
      f("programCredits", "Total Program Credits", "number", { min: 0, max: 10000, dflt: 0, section: "Program Calculations & Statistical Details" }),

      sel("standingAnalysis", "Standing Analysis", ["Upon completion of each course", "Upon completion of each term"], { dflt: "Upon completion of each term", section: "Program Academic Standing Settings" }),
      sel("completionMinimum", "Completion Minimum", withFirst("No Minimum", 1, 30), { section: "Program Academic Standing Settings" }),
      f("includePrereqStanding", "Include pre-requisite / qualifying programs in standing analysis", "bool", { dflt: false, section: "Program Academic Standing Settings" }),

      sel("courseRequirement", "Course Requirement", COURSE_REQUIREMENT, { section: "Program Graduation Conditions" }),
      sel("graduationAverageType", "Graduation Average Type", AVERAGE_TYPES, { section: "Program Graduation Conditions" }),
      f("requiredAverage", "Required Average", "number", { min: 0, max: 100, dflt: 0, section: "Program Graduation Conditions" }),
      sel("averageCalculation", "Average Calculation", AVERAGE_CALC, { section: "Program Graduation Conditions" }),
      sel("repeatCourses", "Repeat Courses", ["Count Highest Attempt", "Count All Attempts"], { section: "Program Graduation Conditions" }),
      sel("financeClearance", "Finance Clearance Required", YES_NO, { section: "Program Graduation Conditions" }),

      f("academicChair", "Academic Chair", "person", { section: "Program Chair & Lead Accesses", hint: "Start typing the user's name." }),
      f("programLead", "Program Lead", "person", { section: "Program Chair & Lead Accesses", hint: "Start typing the user's name." }),
      f("instructors", "Faculty Members (Multiple Select)", "people", {
        dflt: [],
        section: "Program Chair & Lead Accesses",
        hint: "Search and select faculty members one by one. Every selected name stays as a removable chip. New course sessions inherit this list.",
      }),

      sel("campusScope", "Campus", ["All Campuses", "Select Campuses"], { section: "Program Permissions" }),
      f("campuses", "Select Campuses", "multi", { dyn: "campuses", required: true, dflt: [], section: "Program Permissions", when: { key: "campusScope", equals: "Select Campuses" } }),

      f("designations", "Designations", "rows", { dflt: [], rowFields: DESIGNATION_FIELDS }),
    ],
  },
  pathways: {
    screen: PM.pathway,
    audit: "PR06",
    label: "Program pathway",
    parent: { entity: "programs", label: "Program" },
    search: ["name", "abbreviation"],
    unique: [{ key: "name", label: "Pathway Name", scope: "parent" }],
    fields: [
      sel("type", "Type", ["Major", "Minor", "Microcredential"], { section: "Program Pathway Details" }),
      f("name", "Name", "text", { required: true, section: "Program Pathway Details" }),
      f("abbreviation", "Abbreviation", "text", { required: true, section: "Program Pathway Details" }),
      f("defaultOutline", "Default outline", "bool", { dflt: false, section: "Program Pathway Details" }),
      sel("status", "Status", ["Draft", "Active"], { section: "Program Pathway Details" }),
      f("effectiveDating", "Enable effective dating", "bool", { dflt: false, section: "Program Pathway Details" }),
      sel("tierSettings", "Tier Settings", ["Enforce program plan settings", "Enforce program outline settings"], { section: "Program Plan Behaviour" }),
      sel("courseSettings", "Course Settings", ["Enforce program plan settings", "Enforce program outline settings"], { section: "Program Plan Behaviour" }),
    ],
  },
  pathwayCourses: {
    screen: PM.pathwayCourse,
    audit: "PR04",
    label: "Pathway course",
    parent: { entity: "pathways", label: "Program pathway" },
    search: [],
    sortable: true,
    unique: [{ key: "course", label: "Course", scope: "parent" }],
    fields: [
      f("course", "Course", "ref", { ref: "course", required: true }),
      f("tier", "Tier", "ref", { ref: "tiers" }),
      f("hours", "Hours", "number", { min: 0, max: 10000, dflt: null }),
    ],
  },
  tiers: {
    screen: PM.tier,
    audit: "PR11",
    label: "Tier",
    parent: { entity: "pathways", label: "Program pathway" },
    search: ["name"],
    sortable: true,
    unique: [{ key: "name", label: "Tier Name", scope: "parent" }],
    fields: [
      f("name", "Tier Name", "text", { required: true, lang: true, section: "Tier Details" }),
      f("description", "Description", "text", { lang: true, section: "Tier Details" }),
      sel("requiredCourses", "Required Courses", withFirst("All Courses", 1, 40), { section: "Tier Details" }),
      sel("openElectives", "Open Electives", withFirst("None", 1, 20), { section: "Tier Details" }),
      sel("subTier", "Sub-Tier", NO_YES, { section: "Tier Details", hint: "Used for course grouping only" }),
      sel("tierAverage", "Tier Average", ["None", "Grade Point Average", "Average Percentage"], { section: "Outcome Requirements / Prerequisites" }),
      sel("requiredGrades", "Required Grades", ["None", "Letter Grade", "Percentage"], { section: "Outcome Requirements / Prerequisites" }),
    ],
  },
  electiveGroups: {
    screen: PM.electiveGroup,
    audit: "PR12",
    label: "Elective group",
    parent: { entity: "pathways", label: "Program pathway" },
    search: ["name"],
    unique: [{ key: "name", label: "Group Name", scope: "parent" }],
    fields: [f("name", "Group Name", "text", { required: true, lang: true })],
  },
  electives: {
    screen: PM.elective,
    audit: "PR12",
    label: "Elective",
    parent: { entity: "pathways", label: "Program pathway" },
    search: [],
    unique: [{ key: "course", label: "Elective Course", scope: "parent" }],
    fields: [
      f("course", "Elective Course", "ref", { ref: "course", required: true }),
      f("group", "Elective Group", "ref", { ref: "electiveGroups", placeholder: "No Group" }),
    ],
  },
  feeTerms: {
    screen: PM.feeTerm,
    audit: "PR07",
    label: "Fee term",
    parent: { entity: "programs", label: "Program" },
    search: ["name"],
    sortable: true,
    unique: [{ key: "name", label: "Term Name", scope: "parent" }],
    fields: [
      ...FEE_TERM_BASE,
      sel("rateScope", "Rate Categories", ["All Rate Categories", "Select Rate Categories"]),
      f("rateCategories", "Selected Rate Categories", "multi", { dyn: "rateCategories", required: true, dflt: [], when: { key: "rateScope", equals: "Select Rate Categories" } }),
    ],
  },
  fees: {
    screen: PM.fee,
    audit: "PR07",
    label: "Ledger / tuition type",
    parent: { entity: "programs", label: "Program" },
    search: ["ledgerType"],
    sortable: true,
    unique: [],
    fields: [
      f("ledgerType", "Tuition / Ledger Type", "select", { dyn: "ledgerTypes", required: true }),
      f("feeTerm", "Ledger / Tuition Type Term", "ref", { ref: "feeTerms", placeholder: "No Term" }),
      f("domestic", "Domestic", "number", { min: 0, max: 10_000_000, required: true, dflt: 0 }),
      f("international", "International", "number", { min: 0, max: 10_000_000, required: true, dflt: 0 }),
    ],
  },
  deadlines: {
    screen: PM.deadline,
    audit: "PR08",
    label: "Program deadline",
    parent: { entity: "programs", label: "Program" },
    search: ["type", "note"],
    unique: [],
    fields: DEADLINE_FIELDS.map((x) => ({ ...x, section: "Program Deadline Details" })),
  },
  commissions: {
    screen: PM.commission,
    audit: "PR09",
    label: "Commission rate",
    parent: { entity: "programs", label: "Program" },
    search: ["calculation", "condition"],
    unique: [],
    fields: [
      sel("calculation", "Commission Calculation", ["Percentage", "Fixed Amount"]),
      sel("condition", "Commission Condition", ["Base Rate", "Number of Courses", "Calendar Year"]),
      f("courseFrom", "Course Range — From", "number", { integer: true, min: 0, max: 500, required: true, when: { key: "condition", equals: "Number of Courses" }, group: "Course Range", sub: "From" }),
      f("courseTo", "Course Range — To", "number", { integer: true, min: 0, max: 500, required: true, when: { key: "condition", equals: "Number of Courses" }, group: "Course Range", sub: "To" }),
      sel("calendarYear", "Calendar Year", range(2015, 2040), { dflt: String(new Date().getFullYear()), when: { key: "condition", equals: "Calendar Year" } }),
      f("domestic", "Domestic", "number", { min: 0, max: 10_000_000, required: true, dflt: 0 }),
      f("international", "International", "number", { min: 0, max: 10_000_000, required: true, dflt: 0 }),
    ],
  },
  terms: {
    screen: PM.term,
    audit: "PR14",
    label: "Term",
    search: ["name", "abbreviation"],
    unique: [
      { key: "name", label: "Term Name", scope: "all" },
      { key: "abbreviation", label: "Term Abbreviation", scope: "all" },
    ],
    fields: [
      f("name", "Term Name", "text", { required: true, lang: true, section: "Term Details" }),
      f("abbreviation", "Term Abbreviation", "text", { required: true, lang: true, section: "Term Details" }),
      f("campuses", "Campuses", "multi", { dyn: "campuses", required: true, dflt: [], section: "Term Details" }),
      f("startDate", "Start Date", "date", { required: true, section: "Primary Dates" }),
      f("endDate", "End Date", "date", { required: true, section: "Primary Dates" }),
      f("midtermDate", "Midterm Date", "date", { section: "Other Dates" }),
      f("lastInstructionDate", "Last Instruction Date", "date", { section: "Other Dates" }),
      f("examStartDate", "Exam Start Date", "date", { section: "Other Dates" }),
      f("examEndDate", "Exam End Date", "date", { section: "Other Dates" }),
      f("censusDate", "Census Date", "date", { section: "Other Dates" }),
      f("eventDates", "Custom Event Dates", "rows", { dflt: [], rowFields: [f("name", "Event Name", "text", { required: true }), f("date", "Event Date", "date", { required: true })] }),
      f("enrolmentConditions", "Enrolment Conditions", "rows", { dflt: [], rowFields: ENROLMENT_CONDITION_FIELDS }),
      f("deadlines", "Deadlines", "rows", { dflt: [], rowFields: DEADLINE_FIELDS }),
    ],
  },
  calendars: {
    screen: PM.calendar,
    audit: "PR16",
    label: "Academic calendar",
    search: ["name"],
    unique: [{ key: "name", label: "Name", scope: "all" }],
    fields: [
      f("name", "Name", "text", { required: true, lang: true, section: "Academic Calendar Details" }),
      f("description", "Description", "html", { lang: true, section: "Academic Calendar Details" }),
      f("startDate", "Start Date", "date", { required: true, section: "Academic Calendar Details" }),
      f("endDate", "End Date", "date", { required: true, section: "Academic Calendar Details" }),
      sel("status", "Status", ACTIVE, { section: "Academic Calendar Details" }),
      sel("access", "Calendar Access", ["Public", "Internal"], { section: "Academic Calendar Details" }),
      sel("navigationUsage", "Navigation Usage", SHOW_VIS, { section: "Academic Calendar Details" }),
      sel("moduleUsage", "Module Usage", SHOW_VIS, { section: "Academic Calendar Details" }),
      sel("calendarPage", "Calendar Page", SHOW_VIS, { section: "Academic Calendar Details" }),
      ...(
        [
          ["showName", "Show Name"],
          ["showDescription", "Show Description"],
          ["showDates", "Show Dates"],
          ["showPrograms", "Show Programs"],
          ["showCourses", "Show Courses"],
          ["showSessions", "Show Sessions / Offerings"],
          ["showTerms", "Show Terms"],
          ["showDeadlines", "Show Deadlines"],
          ["showPenalties", "Show Penalties"],
          ["showHolidays", "Show Holidays"],
        ] as const
      ).map(([key, label]) => sel(key, label, SHOW_VIS, { section: "Display Options" })),
      sel("programScope", "Programs", ["All Programs", "Select Programs"], { section: "Programs Output" }),
      f("programs", "Select Program(s)", "refMulti", { ref: "programs", required: true, dflt: [], when: { key: "programScope", equals: "Select Programs" }, section: "Programs Output" }),
      sel("outProgramLength", "Program Length", OUTPUT_VIS, { section: "Programs Output" }),
      sel("outProgramCredits", "Program Credits", OUTPUT_VIS, { section: "Programs Output" }),
      sel("outProgramEnrolmentAverage", "Program Enrolment Average — per term", OUTPUT_VIS, { section: "Programs Output" }),
      ...(
        [
          ["outCourseDescription", "Description"],
          ["outCourseSyllabus", "Syllabus"],
          ["outCourseCredits", "Credits"],
          ["outCourseLength", "Course Length"],
          ["outCourseHoursPerDay", "Hours per Day"],
          ["outCoursePrerequisites", "Prerequisites"],
          ["outCourseTuition", "Tuition"],
          ["outCourseTextbooks", "Textbooks"],
          ["outCourseGradingScheme", "Grading Scheme"],
          ["outCourseTransfer", "Transfer Courses"],
        ] as const
      ).map(([key, label]) => sel(key, label, OUTPUT_VIS, { section: "Courses Output" })),
      sel("outputFormat", "Output Format", ["List in Course Details", "Schedule View"], { section: "Sessions / Offerings Output" }),
      sel("deliveryMethodFilter", "Delivery Method Filter", FILTER_VIS, { dflt: "Hidden", section: "Sessions / Offerings Output" }),
      sel("termFilter", "Term Filter", FILTER_VIS, { dflt: "Hidden", section: "Sessions / Offerings Output" }),
      ...(
        [
          ["outDeliveryMethod", "Delivery Method"],
          ["outCourseSchedule", "Course Schedule"],
          ["outContinuousCourses", "Continuous Courses"],
          ["outSelfEnrolmentOpen", "Self-Enrolment Open Date"],
          ["outSelfEnrolmentRecent", "Self-Enrolment Recently Open"],
          ["outClosedSelfEnrolment", "Closed Self-Enrolment"],
          ["outCourseDates", "Course Dates"],
          ["outSessionLocation", "Session Location"],
          ["outClassSize", "Class Size"],
          ["outSessionTuition", "Tuition"],
          ["outInstructors", "Instructor(s)"],
        ] as const
      ).map(([key, label]) => sel(key, label, OUTPUT_VIS, { section: "Sessions / Offerings Output" })),
    ],
  },
  programSchedules: {
    screen: PM.schedule,
    audit: "PR17",
    label: "Master schedule",
    search: ["abbreviation", "description"],
    unique: [{ key: "abbreviation", label: "Schedule Abbreviation", scope: "all", within: "program" }],
    fields: [
      ...MASTER_DETAILS,
      ...DELIVERY,
      sel("holidays", "Holidays Option", ["Extend", "Blend"], { section: "Course Delivery Settings" }),
      sel("attendanceGrading", "Automate Attendance Grading", DIS_EN, { section: "Course Delivery Settings" }),
      sel("automatedEnrolment", "Automated Enrolment", DIS_EN, { section: "Availability & Enrolment Settings" }),
      sel("requiredCoreCourses", "Required Core Courses", withFirst("All Courses", 1, 40), { section: "Availability & Enrolment Settings" }),
      sel("practicumDelivery", "Delivery Method", ["Within schedule timeframe", "Custom delivery"], { section: "Practicum / Co-op Settings" }),
      sel("practicumEnrolment", "Enrolment Method", ["Automated", "Manual"], { section: "Practicum / Co-op Settings" }),
      f("practicumStatus", "Student Status", "select", { dyn: "statuses", dynExtra: ["Do not change"], dflt: "Do not change", required: true, section: "Practicum / Co-op Settings" }),
      f("teachOut", "Teach-out this schedule", "bool", { dflt: false, section: "Teach-out Settings" }),
    ],
  },
  termSchedules: {
    screen: PM.schedule,
    audit: "PR18",
    label: "Term schedule",
    search: ["description"],
    unique: [{ key: "term", label: "Term", scope: "all" }],
    fields: [
      f("term", "Term", "ref", { ref: "terms", required: true, section: "Master Schedule Details" }),
      f("description", "Schedule Description", "text", { section: "Master Schedule Details", hint: "Optional" }),
      ...DELIVERY,
      sel("attendanceGrading", "Automate Attendance Grading", DIS_EN, { section: "Course Delivery Settings" }),
    ],
  },
  scheduleFeeTerms: {
    screen: PM.scheduleFeeTerm,
    audit: "PR20",
    label: "Fee term",
    parent: { entity: "schedule", label: "Schedule" },
    search: ["name"],
    sortable: true,
    unique: [{ key: "name", label: "Term Name", scope: "parent" }],
    fields: FEE_TERM_BASE.map((x) => (x.key === "condition" ? { ...x, dflt: "Days Completed" } : x)),
  },
  scheduleFees: {
    screen: PM.scheduleFee,
    audit: "PR20",
    label: "Ledger / tuition type",
    parent: { entity: "schedule", label: "Schedule" },
    search: ["ledgerType"],
    sortable: true,
    unique: [],
    fields: [
      f("ledgerType", "Tuition / Ledger Type", "select", { dyn: "ledgerTypes", required: true }),
      f("feeTerm", "Ledger / Tuition Type Term", "ref", { ref: "scheduleFeeTerms", placeholder: "No Term" }),
      f("domestic", "Domestic", "number", { min: 0, max: 10_000_000, required: true, dflt: 0 }),
      f("international", "International", "number", { min: 0, max: 10_000_000, required: true, dflt: 0 }),
    ],
  },
  sessions: {
    screen: PM.session,
    audit: "PR19",
    label: "Session",
    parent: { entity: "schedule", label: "Schedule" },
    search: ["sessionName"],
    unique: [],
    fields: SESSION_FIELDS,
  },
};

/** Captured Program Types listing, in its displayed order. */
export const SEED_PROGRAM_TYPES = [
  ["Online study", "OS"],
  ["Visitor", "VIS"],
  ["Certificate", "CERT"],
  ["Diploma", "DIP"],
  ["Bachelor", "BA"],
  ["Masters", "MA"],
  ["Not Applicable", "N/A"],
] as const;

/** Ledger / tuition types visible in the captured Add Ledger popup; used until Financial Management defines its own. */
export const CAPTURED_LEDGER_TYPES = ["Application Fee", "Assessment Fee", "Fine", "Lab/Books/Supplies", "Misc.", "Re-attempt Fees", "Shipping charges", "Textbooks", "Tuition Fee"] as const;

/** Pass / Fail scheme rows captured on Edit Session. */
export const PASS_FAIL_ROWS = [
  { letter: "P", credit: "Yes", condition: "Pass" },
  { letter: "F", credit: "No", condition: "Fail" },
  { letter: "DR", credit: "No", condition: "Dropped" },
  { letter: "I", credit: "No", condition: "Incomplete" },
  { letter: "W", credit: "No", condition: "Withdrawn" },
] as const;
