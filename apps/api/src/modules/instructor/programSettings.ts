import {
  DEFAULT_FACULTY_PROGRAMS,
  DEFAULT_FACULTIES,
  type FacultyProgramRecord,
  type FacultyRecord,
} from "./facultiesPrograms.js";

export const PROGRAM_SETTINGS_PATH = "/instructor/f/t83-program-settings";
export const BADGES_PATH = "/instructor/f/t82-badges-accomplishments";

export const PROGRAM_SETTINGS_TABS = [
  "Program Settings",
  "Program Pathway",
  "Fees & Tuition Price List",
  "Deadlines & Penalties",
  "Commission Rates",
  "Audit Changes",
] as const;

export type ProgramSettingsTab = (typeof PROGRAM_SETTINGS_TABS)[number];

export type FormField = {
  label: string;
  value: string;
  type?: "text" | "select" | "textarea" | "number" | "checkbox" | "pair";
  options?: Array<{ label: string; value: string }>;
  unitValue?: string;
  unitOptions?: Array<{ label: string; value: string }>;
  language?: string;
  hint?: string;
  visibleWhen?: string;
  visibleValue?: string;
  prefix?: string;
};

export type PathwayCourse = {
  id: string;
  code: string;
  name: string;
  hours?: string;
  credits?: string;
  schedule?: string;
  prerequisites?: string;
};

export type FeeRow = {
  id: string;
  type: string;
  domestic: string;
  international: string;
};

export type DeadlineRow = {
  id: string;
  days: string;
  baseDate: string;
  type: string;
  penalty: string;
  note: string;
};

export type CommissionRow = {
  id: string;
  calculation: string;
  condition: string;
  domestic: string;
  international: string;
};

export type AuditRow = {
  id: string;
  date: string;
  current?: boolean;
  changedBy: string;
  changes: string;
  canRestore: boolean;
  former?: string;
  updated?: string;
  studentRecords?: number;
  scheduleRecords?: number;
};

export type PathwayState = {
  type: string;
  name: string;
  abbreviation: string;
  status: string;
  defaultOutline: boolean;
  effectiveDating: boolean;
  columnMode: "hours" | "credits";
  courses: PathwayCourse[];
  electives: Array<{ id: string; course: string; prerequisites: string }>;
  electiveGroups: Array<{ id: string; name: string }>;
};

export type ProgramSettingsRecord = {
  id: string;
  facultyId: string;
  facultyName: string;
  name: string;
  legalName: string;
  abbreviation: string;
  programType: string;
  active: boolean;
  scheduleType: string;
  financialScheme: string;
  financialUtilization: string;
  prerequisiteProgram: string;
  primaryPrograms: string;
  allowApplications: string;
  allowCourseSelection: string;
  enrolmentLeniency: string;
  allowPrerequisitePrograms: string;
  maxEnrolledCourses: string;
  maxEnrolledUnit: string;
  maxEnrolledPerDay: string;
  maxCourseAttempts: string;
  repeatCredited: string;
  repeatFailed: string;
  tierPrerequisites: string;
  dropPenalties: string;
  completionDateCalc: string;
  fullTimeCalc: string;
  fullTimeMin: string;
  alwaysFullTime: boolean;
  gpaCalc: string;
  enrolmentAverage: string;
  programLength: string;
  programLengthUnit: string;
  avgCredits: string;
  programCredits: string;
  standingAnalysis: string;
  completionMinimum: string;
  includePrereqStanding: boolean;
  courseRequirement: string;
  graduationAverageType: string;
  requiredAverage: string;
  averageCalculation: string;
  pathway: PathwayState;
  fees: FeeRow[];
  deadlines: DeadlineRow[];
  commissions: CommissionRow[];
  audits: AuditRow[];
};

const WEEKDAY =
  "Monday: 9:00 AM – 1:00 PM\nTuesday: 9:00 AM – 1:00 PM\nWednesday: 9:00 AM – 1:00 PM\nThursday: 9:00 AM – 1:00 PM\nFriday: 9:00 AM – 1:00 PM";

export const PATHWAY_COURSE_CATALOG: Array<{ id: string; label: string }> = [
  { id: "c-dap-prac", label: "0: DAP Practicum" },
  { id: "c-moa-we", label: "0: MOA Work Experience" },
  { id: "c-we", label: "0: Work Experience" },
  { id: "c-prac", label: "000: Practicum" },
  { id: "c-ecom", label: "101: ECOM" },
  { id: "c-sdfsg", label: "101:sdfsg: ecom" },
  { id: "c-abcd", label: "121: ABCD" },
  { id: "c-acsw100", label: "ACSW 100: Addictions Fundamentals" },
  { id: "c-acsw200", label: "ACSW 200: Social Service Work Fundamentals" },
  { id: "c-acsw300", label: "ACSW 300: Self-Care Techniques" },
  { id: "c-acsw400", label: "ACSW 400: Resources and Networking" },
  { id: "c-acsw500", label: "ACSW 500: Family Studies" },
  { id: "c-acsw600", label: "ACSW 600: Relapse Prevention" },
  { id: "c-acsw700", label: "ACSW 700: Child and Youth Populations" },
  { id: "c-admn104a", label: "ADMN 104: Introduction to Keyboarding" },
  { id: "c-admn104b", label: "ADMN 104: Keyboarding" },
  { id: "c-admn110", label: "ADMN 110: Office Administration" },
  { id: "c-admn114", label: "ADMN 114: Customer Service" },
  { id: "c-bcom105", label: "BCOM 105: Business Communications" },
  { id: "c-beth190", label: "BETH 190: Business Ethics" },
  { id: "c-blaw101", label: "BLAW 101: Business Law" },
  { id: "c-bmgt101", label: "BMGT 101: Introduction to Human Resources" },
  { id: "c-comp101", label: "COMP 101: Introduction to Computers" },
  { id: "c-comp102", label: "COMP 102: Introduction to Word Processing" },
  { id: "c-math100", label: "MATH 100: Business Mathematics" },
  { id: "c-dap101", label: "DAP 101: Financial Accounting" },
  { id: "c-dap105", label: "DAP 105: Computerized Accounting with QuickBooks" },
  { id: "c-dap106", label: "DAP 106: Modern Office Technology" },
  { id: "c-dap108", label: "DAP 108: Income Tax Fundamentals" },
  { id: "c-dap110", label: "DAP 110: Payroll Compliance" },
  { id: "c-empl111", label: "EMPL 111: Career Employment & Strategies" },
  { id: "c-dib115", label: "DIB 115: Customer Service" },
  { id: "c-btt101", label: "BTT 101: Bank Teller Training" },
];

function emptyPathway(abbr: string, mode: "hours" | "credits"): PathwayState {
  return {
    type: "Major",
    name: "Default",
    abbreviation: abbr,
    status: "ACTIVE",
    defaultOutline: true,
    effectiveDating: false,
    columnMode: mode,
    courses: [],
    electives: [],
    electiveGroups: [],
  };
}

function baseFromFacultyProgram(p: FacultyProgramRecord, faculties: FacultyRecord[]): ProgramSettingsRecord {
  const faculty = faculties.find((f) => f.id === p.facultyId);
  const type = /diploma/i.test(p.name) ? "Diploma" : "Certificate";
  return {
    id: p.id,
    facultyId: p.facultyId,
    facultyName: faculty?.name || "",
    name: p.name,
    legalName: "",
    abbreviation: p.abbreviation,
    programType: type,
    active: p.active,
    scheduleType: "Self-Paced",
    financialScheme: "By Program",
    financialUtilization: "Hours Completed",
    prerequisiteProgram: "No",
    primaryPrograms: "Any Eligible Program",
    allowApplications: "Yes",
    allowCourseSelection: "No",
    enrolmentLeniency: "0",
    allowPrerequisitePrograms: "No",
    maxEnrolledCourses: "No Limit",
    maxEnrolledUnit: "Courses",
    maxEnrolledPerDay: "No Limit",
    maxCourseAttempts: "No Limit",
    repeatCredited: "No restrictions",
    repeatFailed: "No restrictions",
    tierPrerequisites: "No restrictions",
    dropPenalties: "Always requires approval",
    completionDateCalc: "By course schedule",
    fullTimeCalc: "By courses taken per term",
    fullTimeMin: "3",
    alwaysFullTime: false,
    gpaCalc: "Indifferent",
    enrolmentAverage: "1",
    programLength: "48",
    programLengthUnit: "Months",
    avgCredits: "0.00",
    programCredits: "0.00",
    standingAnalysis: "Upon completion of each term",
    completionMinimum: "No Minimum",
    includePrereqStanding: false,
    courseRequirement: "All Courses Credited",
    graduationAverageType: "Grade Point Average",
    requiredAverage: "0.0000",
    averageCalculation: "All Courses",
    pathway: emptyPathway(p.abbreviation, "credits"),
    fees: [],
    deadlines: [],
    commissions: [],
    audits: [
      {
        id: `${p.id}-created`,
        date: "2020-01-20 13:55:11",
        changedBy: "System User",
        changes: "Program Created",
        canRestore: true,
        studentRecords: 0,
        scheduleRecords: 0,
      },
    ],
  };
}

function dapCourses(): PathwayCourse[] {
  const rows: Array<[string, string, string, string]> = [
    ["dap-bcom105", "BCOM 105", "Business Communications", "80"],
    ["dap-comp102", "COMP 102", "Introduction to Word Processing", "40"],
    ["dap-math100", "MATH 100", "Business Mathematics", "40"],
    ["dap-dap101", "DAP 101", "Financial Accounting", "40"],
    ["dap-dap105", "DAP 105", "Computerized Accounting with QuickBooks", "40"],
    ["dap-dap106", "DAP 106", "Modern Office Technology", "40"],
    ["dap-dap110", "DAP 110", "Payroll Compliance", "40"],
    ["dap-bmgt101", "BMGT 101", "Introduction to Human Resources", "80"],
    ["dap-empl111", "EMPL 111", "Career Employment & Strategies", "40"],
    ["dap-dap108", "DAP 108", "Income Tax Fundamentals", "80"],
    ["dap-dib115", "DIB 115", "Customer Service", "40"],
    ["dap-comp101", "COMP 101", "Introduction to Computers", "20"],
    ["dap-prac", "DAP Practicum", "DAP Practicum", "140"],
  ];
  return rows.map(([id, code, name, hours]) => ({
    id,
    code,
    name,
    hours,
    schedule: WEEKDAY,
  }));
}

function specialized(programs: FacultyProgramRecord[], faculties: FacultyRecord[]): ProgramSettingsRecord[] {
  const byId = new Map(programs.map((p) => [p.id, baseFromFacultyProgram(p, faculties)]));

  const capa = byId.get("prog-capa");
  if (capa) {
    Object.assign(capa, {
      scheduleType: "Sequential",
      financialScheme: "By Program",
      financialUtilization: "Hours Completed",
      programType: "Certificate",
      programLength: "5",
      programLengthUnit: "Months",
      standingAnalysis: "Upon completion of each term",
      pathway: { ...emptyPathway("CAPA", "hours"), status: "ACTIVE" },
      audits: [
        {
          id: "capa-a1",
          date: "2021-08-05 15:12:00",
          current: true,
          changedBy: "Sofie Romo",
          changes: "Name",
          canRestore: false,
          former: "Certificate in Accounting and Payroll Administration",
          updated: "Certificate in Accounting and Payroll Administrator",
          studentRecords: 46,
          scheduleRecords: 1,
        },
        {
          id: "capa-a2",
          date: "2021-08-05 16:11:17",
          changedBy: "Sofie Romo",
          changes: "Name",
          canRestore: true,
          former: "Certificate in Accounting and Payroll Administration",
          updated: "Certificate in Accounting and Payroll Administrator",
          studentRecords: 46,
          scheduleRecords: 1,
        },
        {
          id: "capa-a3",
          date: "2021-07-14 12:38:21",
          changedBy: "Sofie Romo",
          changes: "Abbreviation",
          canRestore: true,
          former: "CAP",
          updated: "CAPA",
          studentRecords: 46,
          scheduleRecords: 1,
        },
        {
          id: "capa-a4",
          date: "2021-07-14 11:09:15",
          changedBy: "Sofie Romo",
          changes: "Program Created",
          canRestore: true,
          studentRecords: 46,
          scheduleRecords: 1,
        },
      ],
    } satisfies Partial<ProgramSettingsRecord>);
  }

  const dap = byId.get("prog-dap");
  if (dap) {
    Object.assign(dap, {
      scheduleType: "Sequential",
      financialScheme: "By Program",
      financialUtilization: "Hours Completed",
      prerequisiteProgram: "Yes",
      primaryPrograms: "Any Eligible Program",
      allowApplications: "Yes",
      allowCourseSelection: "No",
      enrolmentLeniency: "0",
      programType: "Diploma",
      fullTimeMin: "1",
      programLength: "48",
      pathway: {
        ...emptyPathway("DAP", "hours"),
        status: "ACTIVE",
        courses: dapCourses(),
      },
    } satisfies Partial<ProgramSettingsRecord>);
  }

  const btt = byId.get("prog-btt");
  if (btt) {
    Object.assign(btt, {
      scheduleType: "Self-Paced",
      financialScheme: "By Program",
      financialUtilization: "Hours Completed",
      maxCourseAttempts: "1",
      fullTimeMin: "22",
      programType: "Certificate",
      pathway: {
        ...emptyPathway("BTT", "credits"),
        status: "ACTIVE",
        courses: [{ id: "btt-101", code: "BTT 101", name: "Bank Teller Training", credits: "0.00", prerequisites: "" }],
      },
      fees: [
        { id: "btt-fee-app", type: "Application Fee", domestic: "50.00", international: "50.00" },
        { id: "btt-fee-tui", type: "Tuition Fee", domestic: "400.00", international: "400.00" },
      ],
      audits: [
        {
          id: "btt-a1",
          date: "2020-08-19 11:46:40",
          current: true,
          changedBy: "Tanveer Dhesi",
          changes: "Schedule type",
          canRestore: false,
          former: "Sequential",
          updated: "Self-Paced",
          studentRecords: 36,
          scheduleRecords: 0,
        },
        {
          id: "btt-a2",
          date: "2020-01-30 13:54:17",
          changedBy: "System User",
          changes: "Financial Scheme",
          canRestore: true,
          former: "By Course",
          updated: "By Course",
          studentRecords: 36,
          scheduleRecords: 0,
        },
        {
          id: "btt-a3",
          date: "2020-01-20 13:55:11",
          changedBy: "Tanveer Dhesi",
          changes: "Program Created",
          canRestore: true,
          studentRecords: 36,
          scheduleRecords: 0,
        },
      ],
    } satisfies Partial<ProgramSettingsRecord>);
  }

  return [...byId.values()];
}

function asRecordArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function stringIds(value: unknown) {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

export function seedProgramSettings(programs: FacultyProgramRecord[], faculties: FacultyRecord[]) {
  return specialized(programs, faculties);
}

export function mergeProgramSettings(
  seed: ProgramSettingsRecord[],
  overlay?: Record<string, unknown> | null,
): ProgramSettingsRecord[] {
  const editsRaw =
    overlay?.programSettingEdits && typeof overlay.programSettingEdits === "object"
      ? (overlay.programSettingEdits as Record<string, Partial<ProgramSettingsRecord>>)
      : {};
  const extra = asRecordArray<ProgramSettingsRecord>(overlay?.extraProgramSettings).filter((p) => p?.id);
  const extraIds = new Set(extra.map((p) => p.id));
  const deleted = new Set(stringIds(overlay?.deletedProgramSettingIds));

  const apply = (row: ProgramSettingsRecord): ProgramSettingsRecord => {
    const e = editsRaw[row.id];
    const merged: ProgramSettingsRecord = e ? { ...row, ...e, id: row.id, pathway: { ...row.pathway, ...(e.pathway || {}) } } : { ...row, pathway: { ...row.pathway } };

    const extraCourses = asRecordArray<PathwayCourse>(overlay?.[`pathwayCourses:${row.id}`]);
    const deletedCourses = new Set(stringIds(overlay?.[`deletedPathwayCourses:${row.id}`]));
    if (extraCourses.length || deletedCourses.size) {
      const keep = merged.pathway.courses.filter((c) => !deletedCourses.has(c.id));
      const keepIds = new Set(keep.map((c) => c.id));
      merged.pathway = {
        ...merged.pathway,
        courses: [...keep, ...extraCourses.filter((c) => !keepIds.has(c.id) && !deletedCourses.has(c.id))],
      };
    }

    const extraFees = asRecordArray<FeeRow>(overlay?.[`fees:${row.id}`]);
    const deletedFees = new Set(stringIds(overlay?.[`deletedFees:${row.id}`]));
    const feeEdits =
      overlay?.[`feeEdits:${row.id}`] && typeof overlay[`feeEdits:${row.id}`] === "object"
        ? (overlay[`feeEdits:${row.id}`] as Record<string, Partial<FeeRow>>)
        : {};
    const fees = [...extraFees, ...merged.fees.filter((f) => !extraFees.some((x) => x.id === f.id))]
      .filter((f) => !deletedFees.has(f.id))
      .map((f) => ({ ...f, ...(feeEdits[f.id] || {}) }));
    merged.fees = fees;

    const extraDeadlines = asRecordArray<DeadlineRow>(overlay?.[`deadlines:${row.id}`]);
    merged.deadlines = [...extraDeadlines, ...merged.deadlines.filter((d) => !extraDeadlines.some((x) => x.id === d.id))];

    const extraCommissions = asRecordArray<CommissionRow>(overlay?.[`commissions:${row.id}`]);
    merged.commissions = [
      ...extraCommissions,
      ...merged.commissions.filter((c) => !extraCommissions.some((x) => x.id === c.id)),
    ];

    const extraElectives = asRecordArray<{ id: string; course: string; prerequisites: string }>(
      overlay?.[`electives:${row.id}`],
    );
    if (extraElectives.length) merged.pathway.electives = [...extraElectives, ...merged.pathway.electives];

    const extraGroups = asRecordArray<{ id: string; name: string }>(overlay?.[`electiveGroups:${row.id}`]);
    if (extraGroups.length) merged.pathway.electiveGroups = [...extraGroups, ...merged.pathway.electiveGroups];

    return merged;
  };

  return [
    ...extra.filter((p) => !deleted.has(p.id)).map(apply),
    ...seed.filter((p) => !deleted.has(p.id) && !extraIds.has(p.id)).map(apply),
  ];
}

function opts(...labels: string[]) {
  return labels.map((label) => ({ label, value: label }));
}

function settingsGroups(row: ProgramSettingsRecord): Array<{ title: string; fields: FormField[] }> {
  return [
    {
      title: "Program Details",
      fields: [
        { label: "Program Faculty", value: row.facultyName, type: "select", options: DEFAULT_FACULTIES.map((f) => ({ label: f.name, value: f.name })) },
        { label: "Program Name", value: row.name, type: "text", language: "English" },
        { label: "Legal Program Name", value: row.legalName, type: "text", language: "English" },
        { label: "Abbreviation", value: row.abbreviation, type: "text", language: "English" },
        { label: "Program Type", value: row.programType, type: "select", options: opts("Certificate", "Diploma", "Bachelor", "Masters", "Not Applicable", "Online study", "Visitor") },
        { label: "Active / Inactive", value: row.active ? "Active" : "Inactive", type: "select", options: opts("Active", "Inactive") },
      ],
    },
    {
      title: "Program Delivery Settings",
      fields: [
        { label: "Schedule Type", value: row.scheduleType, type: "select", options: opts("Self-Paced", "Tiers", "Sequential") },
        { label: "Financial Scheme", value: row.financialScheme, type: "select", options: opts("By Course", "By Program", "By Timeframe") },
        { label: "Financial Utilization", value: row.financialUtilization, type: "select", options: opts("Hours Completed", "Courses Completed", "Credits Completed") },
        { label: "Prerequisite Program", value: row.prerequisiteProgram, type: "select", options: opts("No", "Yes") },
        { label: "Primary Programs", value: row.primaryPrograms, type: "select", options: opts("Any Eligible Program", "Select Programs"), visibleWhen: "Prerequisite Program", visibleValue: "Yes" },
        { label: "Allow Applications", value: row.allowApplications, type: "select", options: opts("Yes", "No"), visibleWhen: "Prerequisite Program", visibleValue: "Yes" },
        { label: "Allow Course Selection", value: row.allowCourseSelection, type: "select", options: opts("No", "Yes"), visibleWhen: "Prerequisite Program", visibleValue: "Yes" },
        { label: "Enrolment Leniency", value: row.enrolmentLeniency, type: "number", visibleWhen: "Prerequisite Program", visibleValue: "Yes" },
        { label: "Allow Prerequisite Programs", value: row.allowPrerequisitePrograms, type: "select", options: opts("No", "Yes") },
      ],
    },
    {
      title: "Program Enrolment Conditions",
      fields: [
        { label: "Maximum Enrolled Courses", value: row.maxEnrolledCourses, type: "pair", options: [{ label: "No Limit", value: "No Limit" }, ...Array.from({ length: 15 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) }))], unitValue: row.maxEnrolledUnit, unitOptions: opts("Courses", "Credits"), hint: "per term" },
        { label: "Maximum Enrolled Per Day", value: row.maxEnrolledPerDay, type: "select", options: [{ label: "No Limit", value: "No Limit" }, ...Array.from({ length: 15 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) }))] },
        { label: "Maximum Course Attempts", value: row.maxCourseAttempts, type: "select", options: [{ label: "No Limit", value: "No Limit" }, ...Array.from({ length: 20 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) }))] },
        { label: "Repeat Credited Courses", value: row.repeatCredited, type: "select", options: opts("No restrictions", "Disable self-enrolment") },
        { label: "Repeat Failed Courses", value: row.repeatFailed, type: "select", options: opts("No restrictions", "Must enrol") },
        { label: "Tier Prerequisites", value: row.tierPrerequisites, type: "select", options: opts("No restrictions", "Force prerequisite tiers") },
        { label: "Drop / Withdraw Penalties", value: row.dropPenalties, type: "select", options: opts("Always requires approval", "Instant approval for non-penalty tuition adjustments", "Instant approval for all penalties") },
      ],
    },
    {
      title: "Program Calculations & Statistical Details",
      fields: [
        { label: "Completion Date Calculation", value: row.completionDateCalc, type: "select", options: opts("By course schedule", "By last credited course", "Fixed program length") },
        { label: "Full-time Calculation", value: row.fullTimeCalc, type: "select", options: opts("By courses taken per term", "By program of study definition") },
        { label: "Full-time Minimum", value: row.fullTimeMin, type: "select", options: Array.from({ length: 30 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) })), hint: "per term" },
        { label: "Always full-time, if final term of study.", value: row.alwaysFullTime ? "true" : "false", type: "checkbox" },
        { label: "GPA Calculation", value: row.gpaCalc, type: "select", options: opts("Indifferent", "Weighted by Credit Value", "Weighted by Course Hours") },
        { label: "Enrolment Average", value: row.enrolmentAverage, type: "select", options: Array.from({ length: 16 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) })), hint: "per term" },
        { label: "Program Length", value: row.programLength, type: "pair", options: Array.from({ length: 120 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) })), unitValue: row.programLengthUnit, unitOptions: opts("Days", "Weeks", "Months", "Years") },
        { label: "Average Credits per Course", value: row.avgCredits, type: "number" },
        { label: "Total Program Credits", value: row.programCredits, type: "number" },
      ],
    },
    {
      title: "Program Academic Standing Settings",
      fields: [
        { label: "Standing Analysis", value: row.standingAnalysis, type: "select", options: opts("Upon completion of each course", "Upon completion of each term") },
        { label: "Completion Minimum", value: row.completionMinimum, type: "select", options: [{ label: "No Minimum", value: "No Minimum" }, ...Array.from({ length: 20 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) }))] },
        { label: "Include pre-requisite / qualifying programs in standing analysis.", value: row.includePrereqStanding ? "true" : "false", type: "checkbox" },
      ],
    },
    {
      title: "Program Graduation Conditions",
      fields: [
        { label: "Course Requirement", value: row.courseRequirement, type: "select", options: opts("All Courses Credited", "Minimum Courses Credited", "Select Courses Credited") },
        { label: "Graduation Average Type", value: row.graduationAverageType, type: "select", options: opts("Grade Point Average", "Average Percentage") },
        { label: "Required Average", value: row.requiredAverage, type: "number" },
        { label: "Average Calculation", value: row.averageCalculation, type: "select", options: opts("All Courses", "Program Plan Courses Only", "Maximum Courses", "Select Courses") },
      ],
    },
  ];
}

function parseQuery(path: string) {
  const i = path.indexOf("?");
  return i < 0 ? new URLSearchParams() : new URLSearchParams(path.slice(i + 1));
}

/** Format audit timestamps like "THURSDAY, JANUARY 30, 2020 - 09:54". */
export function formatAuditWhen(date: string): string {
  const m = date.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return date.toUpperCase();
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = m[4] ?? "00";
  const minute = m[5] ?? "00";
  const utc = new Date(Date.UTC(year, month - 1, day, Number(hour), Number(minute)));
  const weekday = utc.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toUpperCase();
  const monthName = utc.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" }).toUpperCase();
  return `${weekday}, ${monthName} ${day}, ${year} - ${hour}:${minute}`;
}

export function settingsHref(programId: string, tab?: string) {
  const qs = new URLSearchParams({ programId });
  if (tab && tab !== "Program Settings") qs.set("tab", tab);
  return `${PROGRAM_SETTINGS_PATH}?${qs.toString()}`;
}

export function buildProgramSettingsPayload(
  programs: FacultyProgramRecord[],
  faculties: FacultyRecord[],
  overlay: Record<string, unknown> | null | undefined,
  path: string,
) {
  const merged = mergeProgramSettings(seedProgramSettings(programs.length ? programs : DEFAULT_FACULTY_PROGRAMS, faculties), overlay);
  const qs = parseQuery(path);
  const programId = qs.get("programId") || merged[0]?.id || "prog-capa";
  const row = merged.find((p) => p.id === programId) || merged[0];
  if (!row) {
    return {
      title: "PROGRAM SETTINGS",
      breadcrumbs: ["Home", "Faculties & Programs", "Program Settings"],
      archetype: "programSettings",
      programSettings: { tabs: [...PROGRAM_SETTINGS_TABS], empty: "Program not found." },
    };
  }
  const modal = (qs.get("modal") || "").trim();
  const ledgerId = qs.get("ledgerId") || "";
  const auditId = qs.get("auditId") || "";
  const activeTabRaw = (qs.get("tab") || "").trim();
  const activeTab = (PROGRAM_SETTINGS_TABS as readonly string[]).includes(activeTabRaw)
    ? activeTabRaw
    : "Program Settings";
  const fee = row.fees.find((f) => f.id === ledgerId);
  const audit = auditId ? row.audits.find((a) => a.id === auditId) : undefined;
  const hasComparison = Boolean(audit && (audit.former != null || audit.updated != null));

  return {
    title: `PROGRAM SETTINGS: ${row.name.toUpperCase()}`,
    breadcrumbs: ["Home", "Faculties & Programs", "Program Settings"],
    primaryAction: "Save Program",
    secondaryAction: "Back",
    secondaryActionHref: "/instructor/f/t13-program-management",
    archetype: "programSettings",
    programSettings: {
      programId: row.id,
      programName: row.name,
      activeTab,
      tabs: [...PROGRAM_SETTINGS_TABS],
      groups: settingsGroups(row),
      pathway: {
        identity: `${row.abbreviation}: ${row.pathway.name.toUpperCase()}`,
        status: row.pathway.status,
        selected: row.pathway.name,
        pathways: [row.pathway.name],
        columnMode: row.pathway.columnMode,
        courses: row.pathway.courses,
        electives: row.pathway.electives,
        electiveEmpty: "No electives have been assigned to this program outline.",
        availableCourses: PATHWAY_COURSE_CATALOG,
        edit: {
          type: row.pathway.type,
          name: row.pathway.name,
          abbreviation: row.pathway.abbreviation,
          defaultOutline: row.pathway.defaultOutline,
          status: row.pathway.status === "ACTIVE" ? "Active" : row.pathway.status,
          effectiveDating: row.pathway.effectiveDating,
          tierSettings: "Enforce program plan settings.",
          courseSettings: "Enforce program plan settings.",
        },
      },
      fees: row.fees,
      feesEmpty: "No ledger or tuition types currently exist for this program.",
      deadlines: row.deadlines.map((d) => ({
        id: d.id,
        condition: `${d.days} day(s) from ${d.baseDate}`,
        type: d.type,
        penalty: d.penalty,
      })),
      deadlinesEmpty: "No deadlines exist for this program.",
      commissions: row.commissions.map((c) => ({
        id: c.id,
        calculation: c.calculation,
        condition: c.condition,
        rates: `Domestic ${c.domestic}% · International ${c.international}%`,
      })),
      commissionsEmpty: "No agent commission rates currently exist for this program.",
      audits: row.audits,
      footerDate: "Sep. 19, 2026",
      modal,
      modalData: {
        addTerm: {
          title: "ADD TERM",
          fields: [
            { label: "Term Name", value: "", type: "text", language: "English" },
            { label: "Term Condition", value: "Courses Completed", type: "select", options: opts("Courses Completed", "Credits Completed", "Hours Completed") },
            { label: "Required Courses", value: "0", type: "number" },
            { label: "Rate Categories", value: "All Rate Categories", type: "select", options: opts("All Rate Categories") },
            { label: "Term Order", value: "Top", type: "select", options: opts("Top", "Bottom") },
          ],
          submit: "Save Term",
        },
        addLedger: {
          title: modal === "edit-ledger" ? "EDIT LEDGER / TUITION TYPE" : "ADD LEDGER / TUITION TYPE",
          fields: [
            {
              label: "Tuition / Ledger Type",
              value: fee?.type || "",
              type: "select",
              options: [{ label: "-- Select Tuition / Ledger Type --", value: "" }, ...opts("Application Fee", "Tuition Fee", "Material Fee", "Exam Fee", "Other")],
            },
            { label: "Domestic", value: fee?.domestic || "0.00", type: "number", prefix: "$" },
            { label: "International", value: fee?.international || "0.00", type: "number", prefix: "$" },
          ],
          submit: "Save Ledger / Tuition Type",
          ledgerId: fee?.id || "",
        },
        addDeadline: {
          title: "ADD PROGRAM DEADLINE",
          fields: [
            { label: "Days to Deadline", value: "0", type: "number" },
            { label: "Deadline Base Date", value: "Term Start Date", type: "select", options: opts("Term Start Date", "Term End Date", "Enrolment Date") },
            { label: "Deadline Type", value: "Due Deadline", type: "select", options: opts("Due Deadline", "Drop Deadline", "Withdraw Deadline") },
            { label: "Late Fee", value: "None", type: "select", options: opts("None", "Flat Fee", "Percentage") },
            { label: "NOTE / DESCRIPTION", value: "", type: "textarea" },
          ],
          submit: "Save Deadline",
        },
        addCommission: {
          title: "ADD AGENT COMMISSION RATE",
          fields: [
            { label: "Commission Calculation", value: "Percentage", type: "select", options: opts("Percentage", "Flat Amount") },
            { label: "Commission Condition", value: "Base Rate", type: "select", options: opts("Base Rate", "After Fees") },
            { label: "Domestic", value: "", type: "number", hint: "%" },
            { label: "International", value: "", type: "number", hint: "%" },
          ],
          submit: "Save Commission Rate",
        },
        createPathway: {
          title: "CREATE PROGRAM PATHWAY",
          fields: [
            { label: "Type", value: "Major", type: "select", options: opts("Major", "Minor", "Concentration") },
            { label: "Name", value: "", type: "text" },
            { label: "Abbreviation", value: "", type: "text" },
            { label: "Default outline", value: "false", type: "checkbox" },
            { label: "Status", value: "Draft", type: "select", options: opts("Draft", "Active", "Inactive") },
            { label: "Enable effective dating", value: "false", type: "checkbox" },
            { label: "Tier Settings", value: "Enforce program plan settings.", type: "select", options: opts("Enforce program plan settings.", "Custom") },
            { label: "Course Settings", value: "Enforce program plan settings.", type: "select", options: opts("Enforce program plan settings.", "Custom") },
          ],
          submit: "Save Program Pathway",
        },
        createTier: {
          title: "CREATE TIER",
          fields: [
            { label: "Tier Name", value: "", type: "text", language: "English" },
            { label: "Description", value: "", type: "text", language: "English" },
            { label: "Required Courses", value: "All Courses", type: "select", options: opts("All Courses", "Minimum Courses") },
            { label: "Open Electives", value: "None", type: "select", options: opts("None", "1", "2", "3") },
            { label: "Sub-Tier", value: "No", type: "select", options: opts("No", "Yes"), hint: "Used for course grouping only" },
            { label: "Tier Average", value: "None", type: "select", options: opts("None", "Grade Point Average") },
            { label: "Required Grades", value: "None", type: "select", options: opts("None", "Passing") },
          ],
          submit: "Save Tier",
        },
        createElectiveGroup: {
          title: "CREATE ELECTIVE GROUP",
          fields: [{ label: "Group Name", value: "", type: "text", language: "English" }],
          submit: "Save Elective Group",
        },
        auditReview: audit
          ? {
              when: audit.date,
              whenLabel: formatAuditWhen(audit.date),
              by: audit.changedBy,
              field: audit.changes,
              // Only surface comparison values that exist in source data — never invent them.
              former: hasComparison ? (audit.former ?? null) : null,
              updated: hasComparison ? (audit.updated ?? null) : null,
              hasComparison,
            }
          : null,
        assignedRecords: audit
          ? { studentRecords: audit.studentRecords ?? 0, scheduleRecords: audit.scheduleRecords ?? 0 }
          : { studentRecords: 0, scheduleRecords: 0 },
        restoreRecord: {
          title: "RESTORE RECORD",
          message: "Are you sure you want to restore this program history record?",
          confirmLabel: "Confirm Restore",
          cancelLabel: "Cancel",
          auditId: audit?.id || "",
        },
      },
    },
  };
}

function parseFields(rowKey?: string): Record<string, string> {
  if (!rowKey) return {};
  try {
    const parsed = JSON.parse(rowKey) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = String(v);
    }
    return out;
  } catch {
    return {};
  }
}

function programIdFrom(path: string, fields: Record<string, string>) {
  return parseQuery(path).get("programId") || fields.programId || fields.__programId || "";
}

export function applyProgramSettingsPatch(
  action: string,
  rowKey: string | undefined,
  path: string,
): { message: string; result: Record<string, unknown>; patch: (prev: Record<string, unknown>) => Record<string, unknown> } | null {
  const lower = action.toLowerCase();
  const fields = parseFields(rowKey);
  const programId = programIdFrom(path, fields);
  if (!programId) return null;
  const now = Date.now().toString(36);

  if (lower.includes("save program settings") || (lower === "save program" && path.includes("program-settings"))) {
    const row: Partial<ProgramSettingsRecord> = {
      facultyName: fields["Program Faculty"] || "",
      name: fields["Program Name"] || "",
      legalName: fields["Legal Program Name"] || "",
      abbreviation: fields.Abbreviation || "",
      programType: fields["Program Type"] || "",
      active: !/inactive/i.test(fields["Active / Inactive"] || "Active"),
      scheduleType: fields["Schedule Type"] || "",
      financialScheme: fields["Financial Scheme"] || "",
      financialUtilization: fields["Financial Utilization"] || "",
      prerequisiteProgram: fields["Prerequisite Program"] || "No",
      primaryPrograms: fields["Primary Programs"] || "",
      allowApplications: fields["Allow Applications"] || "",
      allowCourseSelection: fields["Allow Course Selection"] || "",
      enrolmentLeniency: fields["Enrolment Leniency"] || "0",
      allowPrerequisitePrograms: fields["Allow Prerequisite Programs"] || "No",
      maxEnrolledCourses: fields["Maximum Enrolled Courses"] || "No Limit",
      maxEnrolledUnit: fields["Maximum Enrolled Courses Unit"] || "Courses",
      maxEnrolledPerDay: fields["Maximum Enrolled Per Day"] || "No Limit",
      maxCourseAttempts: fields["Maximum Course Attempts"] || "No Limit",
      repeatCredited: fields["Repeat Credited Courses"] || "",
      repeatFailed: fields["Repeat Failed Courses"] || "",
      tierPrerequisites: fields["Tier Prerequisites"] || "",
      dropPenalties: fields["Drop / Withdraw Penalties"] || "",
      completionDateCalc: fields["Completion Date Calculation"] || "",
      fullTimeCalc: fields["Full-time Calculation"] || "",
      fullTimeMin: fields["Full-time Minimum"] || "3",
      alwaysFullTime: fields["Always full-time, if final term of study."] === "true",
      gpaCalc: fields["GPA Calculation"] || "",
      enrolmentAverage: fields["Enrolment Average"] || "1",
      programLength: fields["Program Length"] || "48",
      programLengthUnit: fields["Program Length Unit"] || "Months",
      avgCredits: fields["Average Credits per Course"] || "0.00",
      programCredits: fields["Total Program Credits"] || "0.00",
      standingAnalysis: fields["Standing Analysis"] || "",
      completionMinimum: fields["Completion Minimum"] || "No Minimum",
      includePrereqStanding: fields["Include pre-requisite / qualifying programs in standing analysis."] === "true",
      courseRequirement: fields["Course Requirement"] || "",
      graduationAverageType: fields["Graduation Average Type"] || "",
      requiredAverage: fields["Required Average"] || "0.0000",
      averageCalculation: fields["Average Calculation"] || "",
    };
    return {
      message: `Program settings saved · ${row.name || programId}`,
      result: { programId },
      patch: (prev) => {
        const edits =
          prev.programSettingEdits && typeof prev.programSettingEdits === "object"
            ? { ...(prev.programSettingEdits as Record<string, Partial<ProgramSettingsRecord>>) }
            : {};
        edits[programId] = { ...(edits[programId] || {}), ...row };
        return { ...prev, programSettingEdits: edits };
      },
    };
  }

  if (lower.includes("save ledger") || lower.includes("save tuition")) {
    const id = fields.ledgerId || `fee-${now}`;
    const fee: FeeRow = {
      id,
      type: fields["Tuition / Ledger Type"] || "Tuition Fee",
      domestic: fields.Domestic || "0.00",
      international: fields.International || "0.00",
    };
    return {
      message: `Ledger saved · ${fee.type}`,
      result: { id },
      patch: (prev) => {
        const key = `fees:${programId}`;
        const editsKey = `feeEdits:${programId}`;
        const extras = asRecordArray<FeeRow>(prev[key]);
        const edits =
          prev[editsKey] && typeof prev[editsKey] === "object"
            ? { ...(prev[editsKey] as Record<string, Partial<FeeRow>>) }
            : {};
        if (extras.some((f) => f.id === id) || fields.ledgerId) {
          edits[id] = fee;
          return {
            ...prev,
            [key]: extras.map((f) => (f.id === id ? fee : f)),
            [editsKey]: edits,
          };
        }
        extras.unshift(fee);
        return { ...prev, [key]: extras.slice(0, 40), [editsKey]: { ...edits, [id]: fee } };
      },
    };
  }

  if (lower.includes("delete ledger") || lower.includes("delete tuition")) {
    const id = (rowKey || fields.ledgerId || "").trim();
    return {
      message: "Ledger deleted",
      result: { id },
      patch: (prev) => {
        const delKey = `deletedFees:${programId}`;
        const deleted = stringIds(prev[delKey]);
        if (!deleted.includes(id)) deleted.push(id);
        return {
          ...prev,
          [delKey]: deleted,
          [`fees:${programId}`]: asRecordArray<FeeRow>(prev[`fees:${programId}`]).filter((f) => f.id !== id),
        };
      },
    };
  }

  if (lower.includes("save deadline")) {
    const row: DeadlineRow = {
      id: `dl-${now}`,
      days: fields["Days to Deadline"] || "0",
      baseDate: fields["Deadline Base Date"] || "Term Start Date",
      type: fields["Deadline Type"] || "Due Deadline",
      penalty: fields["Late Fee"] || "None",
      note: fields["NOTE / DESCRIPTION"] || "",
    };
    return {
      message: "Deadline saved",
      result: { id: row.id },
      patch: (prev) => {
        const key = `deadlines:${programId}`;
        return { ...prev, [key]: [row, ...asRecordArray<DeadlineRow>(prev[key])].slice(0, 40) };
      },
    };
  }

  if (lower.includes("save commission")) {
    const row: CommissionRow = {
      id: `com-${now}`,
      calculation: fields["Commission Calculation"] || "Percentage",
      condition: fields["Commission Condition"] || "Base Rate",
      domestic: fields.Domestic || "0",
      international: fields.International || "0",
    };
    return {
      message: "Commission rate saved",
      result: { id: row.id },
      patch: (prev) => {
        const key = `commissions:${programId}`;
        return { ...prev, [key]: [row, ...asRecordArray<CommissionRow>(prev[key])].slice(0, 40) };
      },
    };
  }

  if (lower.includes("save courses") || lower.includes("add courses")) {
    const selected = (fields.selectedCourses || fields.courses || "")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    const extras: PathwayCourse[] = selected.map((label, i) => {
      const [code, ...rest] = label.split(":");
      return {
        id: `pc-${now}-${i}`,
        code: (code || label).trim(),
        name: rest.join(":").trim() || label,
        hours: "40",
        credits: "0.00",
        schedule: WEEKDAY,
        prerequisites: "",
      };
    });
    return {
      message: extras.length ? `Added ${extras.length} course(s)` : "No courses selected",
      result: { count: extras.length },
      patch: (prev) => {
        const key = `pathwayCourses:${programId}`;
        return { ...prev, [key]: [...extras, ...asRecordArray<PathwayCourse>(prev[key])].slice(0, 80) };
      },
    };
  }

  if (lower.includes("delete pathway course") || lower.includes("delete course")) {
    const id = (rowKey || fields.courseId || "").trim();
    return {
      message: "Course removed from pathway",
      result: { id },
      patch: (prev) => {
        const delKey = `deletedPathwayCourses:${programId}`;
        const deleted = stringIds(prev[delKey]);
        if (!deleted.includes(id)) deleted.push(id);
        return { ...prev, [delKey]: deleted };
      },
    };
  }

  if (lower.includes("save program pathway") || lower.includes("copy program pathway")) {
    const pathwayPatch: Partial<PathwayState> = {
      type: fields.Type || "Major",
      name: fields.Name || "Default",
      abbreviation: fields.Abbreviation || "",
      status: /active/i.test(fields.Status || "Active") ? "ACTIVE" : fields.Status || "Draft",
      defaultOutline: fields["Default outline"] === "true",
      effectiveDating: fields["Enable effective dating"] === "true",
    };
    return {
      message: lower.includes("copy") ? "Pathway copied" : "Pathway saved",
      result: { programId },
      patch: (prev) => {
        const edits =
          prev.programSettingEdits && typeof prev.programSettingEdits === "object"
            ? { ...(prev.programSettingEdits as Record<string, Partial<ProgramSettingsRecord>>) }
            : {};
        const current = edits[programId] || {};
        edits[programId] = { ...current, pathway: { ...(current.pathway || {}), ...pathwayPatch } as PathwayState };
        return { ...prev, programSettingEdits: edits };
      },
    };
  }

  if (lower.includes("save elective group")) {
    const group = { id: `eg-${now}`, name: fields["Group Name"] || "Elective Group" };
    return {
      message: `Elective group saved · ${group.name}`,
      result: group,
      patch: (prev) => {
        const key = `electiveGroups:${programId}`;
        return { ...prev, [key]: [group, ...asRecordArray<{ id: string; name: string }>(prev[key])] };
      },
    };
  }

  if (lower.includes("save electives")) {
    const selected = (fields.selectedCourses || fields.electives || "")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((label, i) => ({ id: `el-${now}-${i}`, course: label, prerequisites: "" }));
    return {
      message: selected.length ? `Added ${selected.length} elective(s)` : "No electives selected",
      result: { count: selected.length },
      patch: (prev) => {
        const key = `electives:${programId}`;
        return { ...prev, [key]: [...selected, ...asRecordArray<{ id: string; course: string; prerequisites: string }>(prev[key])] };
      },
    };
  }

  if (lower.includes("save term") && path.includes("program-settings")) {
    const term = { id: `pt-${now}`, name: fields["Term Name"] || "New Term" };
    return {
      message: `Term saved · ${term.name || "Untitled"}`,
      result: term,
      patch: (prev) => {
        const key = `terms:${programId}`;
        return { ...prev, [key]: [term, ...asRecordArray<{ id: string; name: string }>(prev[key])] };
      },
    };
  }

  if (lower.includes("save tier")) {
    const tier = { id: `tier-${now}`, name: fields["Tier Name"] || "New Tier" };
    return {
      message: `Tier saved · ${tier.name}`,
      result: tier,
      patch: (prev) => {
        const key = `tiers:${programId}`;
        return { ...prev, [key]: [tier, ...asRecordArray<{ id: string; name: string }>(prev[key])] };
      },
    };
  }

  if (
    lower.includes("confirm restore") ||
    (lower.includes("restore") && (lower.includes("audit") || lower.includes("record") || lower.includes("history")))
  ) {
    return {
      message: "Audit version restored",
      result: { auditId: fields.auditId || rowKey || "" },
      patch: (prev) => prev,
    };
  }

  return null;
}

export function buildHccBadgesPayload(path: string) {
  const qs = parseQuery(path);
  const user = qs.get("user") || "";
  const badge = qs.get("badge") || "All Badges";
  const status = qs.get("status") || "Pending";
  return {
    title: "BADGES / ACCOMPLISHMENTS",
    breadcrumbs: ["Home", "Badges / Accomplishments"],
    archetype: "hccBadges",
    hccBadges: {
      userFilter: user,
      badgeFilter: badge,
      statusFilter: status,
      badgeOptions: ["All Badges"],
      statusOptions: ["Pending", "Awarded", "Denied", "All"],
      rows: [] as Array<{ id: string; student: string; badge: string; status: string }>,
      empty: "No badges / accomplishments were found.",
    },
  };
}
