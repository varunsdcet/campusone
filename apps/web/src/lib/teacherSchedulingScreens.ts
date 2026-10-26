import type { TeacherScreenConfig } from "@/lib/teacherCatalog";

type Opt = { label: string; value: string; group?: string };

export const PROGRAM_FILTER_OPTIONS: Opt[] = [
  { label: "All Programs", value: "" },
  { label: "CAPA: Certificate in Accounting and Payroll Administrator", value: "CAPA", group: "Accounting/Payroll" },
  { label: "DAP: Diploma in Accounting and Payroll administrator", value: "DAP", group: "Accounting/Payroll" },
  { label: "BTT: Bank Teller Training", value: "BTT", group: "Business" },
  { label: "COA: Certificate Office Administration", value: "COA", group: "Business" },
  { label: "CSMS: Corporate Sales Management Strategies Certificate", value: "CSMS", group: "Business" },
  { label: "DIB: Diploma in International Business", value: "DIB", group: "Business" },
  { label: "DMM: Digital Marketing Management", value: "DMM", group: "Business" },
  { label: "HRA: Human Resources Administration", value: "HRA", group: "Business" },
  { label: "MA: Marketing Administration", value: "MA", group: "Business" },
  { label: "OA: Office Administration", value: "OA", group: "Business" },
  { label: "RSMS: Retail Sales Management Strategies Certificate", value: "RSMS", group: "Business" },
  { label: "NSA: Network Support Administrator", value: "NSA", group: "Computer Science" },
  { label: "NST: Network Support Technician", value: "NST", group: "Computer Science" },
  {
    label: "ECEA (Option 2): Child Growth Development Part I & II + Interpersonal Communication",
    value: "ECEA2",
    group: "Early Childhood Educator Assistant",
  },
  { label: "HCA: Health Care Assistant", value: "HCA", group: "Health Science" },
  { label: "MOA: Medical Office Assistant", value: "MOA", group: "Health Science" },
];

export const PROGRAM_SELECT_OPTIONS: Opt[] = [
  { label: "-- Select Program --", value: "" },
  { label: "CAPA: Certificate in Accounting and Payroll Administrator", value: "CAPA", group: "Accounting/Payroll" },
  { label: "DAP: Diploma in Accounting and Payroll administrator", value: "DAP", group: "Accounting/Payroll" },
  { label: "COA: Certificate Office Administration", value: "COA", group: "Business" },
  { label: "DIB: Diploma in International Business", value: "DIB", group: "Business" },
  { label: "DMM: Digital Marketing Management", value: "DMM", group: "Business" },
  { label: "HRA: Human Resources Administration", value: "HRA", group: "Business" },
  { label: "MA: Marketing Administration", value: "MA", group: "Business" },
  { label: "OA: Office Administration", value: "OA", group: "Business" },
  { label: "NSA: Network Support Administrator", value: "NSA", group: "Computer Science" },
  { label: "NST: Network Support Technician", value: "NST", group: "Computer Science" },
  {
    label: "ECEA (Option 2): Child Growth Development Part I & II + Interpersonal Communication",
    value: "ECEA2",
    group: "Early Childhood Educator Assistant",
  },
  {
    label: "ECEA option1: Child Growth Development part 1 & 2",
    value: "ECEA1",
    group: "Early Childhood Educator Assistant",
  },
  { label: "HCA: Health Care Assistant", value: "HCA", group: "Health Science" },
];

export const TERM_SELECT_OPTIONS: Opt[] = [
  { label: "-- Select Term --", value: "" },
  { label: "3rd Term-2026: Sep. 1, 2026 - Dec. 31, 2026", value: "3rd-2026" },
  { label: "2nd Term-2026: May. 1, 2026 - Aug. 31, 2026", value: "2nd-2026" },
  { label: "1st Term-2026: Jan. 1, 2026 - Apr. 30, 2026", value: "1st-2026" },
  { label: "3rd Term-2025: Sep. 1, 2025 - Dec. 31, 2025", value: "3rd-2025" },
  { label: "2nd Term-2025: May. 1, 2025 - Aug. 31, 2025", value: "2nd-2025" },
  { label: "1st Term-2025: Jan. 1, 2025 - Apr. 30, 2025", value: "1st-2025" },
  { label: "2024-03-18: Mar. 18, 2024 - Dec. 31, 2024", value: "2024-03-18" },
  { label: "2024-03-16: Mar. 18, 2024 - Oct. 6, 2024", value: "2024-03-16" },
  { label: "2024-02-12: Feb. 12, 2024 - Oct. 11, 2024", value: "2024-02-12" },
  { label: "2024-02-05: Feb. 5, 2024 - Dec. 31, 2024", value: "2024-02-05a" },
  { label: "2024-02-05: Feb. 5, 2024 - Nov. 1, 2024", value: "2024-02-05b" },
  { label: "2024-02-05: Feb. 5, 2024 - Oct. 10, 2024", value: "2024-02-05c" },
  { label: "2024-02-05: Feb. 5, 2024 - Oct. 9, 2024", value: "2024-02-05d" },
  { label: "2023-12-04: Dec. 4, 2023 - Oct. 11, 2024", value: "2023-12-04" },
  { label: "2023-11-06: Nov. 6, 2023 - Aug. 30, 2024", value: "2023-11-06a" },
  { label: "2023-11-06: Nov. 6, 2023 - May. 23, 2024", value: "2023-11-06b" },
  {
    label: "Bank Teller Program - September 13 to September 21: Sep. 12, 2023 - Sep. 23, 2023",
    value: "btt-2023-09",
  },
];

const VIS: Opt[] = [
  { label: "Hidden", value: "Hidden" },
  { label: "Internal", value: "Internal" },
  { label: "Public", value: "Public" },
];

const SHOW: Opt[] = [
  { label: "Visible", value: "Visible" },
  { label: "Hidden", value: "Hidden" },
];

function daysBeforeOptions(includeAlways = false): Opt[] {
  const base: Opt[] = [];
  if (includeAlways) base.push({ label: "Always Available", value: "Always Available" });
  base.push({ label: "First day of class", value: "First day of class" });
  for (let i = 1; i <= 30; i++) {
    base.push({
      label: `${i} day${i === 1 ? "" : "s"} before start date`,
      value: `${i} day${i === 1 ? "" : "s"} before start date`,
    });
  }
  return base;
}

const LENGTH_UNITS: Opt[] = [
  { label: "Weeks", value: "Weeks" },
  { label: "Months", value: "Months" },
];

const LENGTH_NUMBERS: Opt[] = Array.from({ length: 96 }, (_, i) => ({
  label: String(i + 1),
  value: String(i + 1),
}));

export const DEFAULT_MASTER_SCHEDULE_ROWS: NonNullable<
  NonNullable<TeacherScreenConfig["masterScheduling"]>["rows"]
> = [
  {
    id: "ms-dib-nov-2026",
    dateRange: "Nov. 2, 2026 (Mon.) - Apr. 3, 2028 (Mon.)",
    session: "DIB: Session NOV-2026",
    duration: "72 Weeks",
    program: "DIB: Diploma in International Business",
    canDelete: true,
  },
  {
    id: "ms-hca-vic-nov-2026",
    dateRange: "Nov. 2, 2026 (Mon.) - Apr. 23, 2027 (Fri.)",
    session: "HCA-Victoria: Session NOV-2026",
    duration: "25 Weeks",
    program: "HCA: Health Care Assistant",
    canDelete: true,
  },
  {
    id: "ms-dib-oct-2025",
    dateRange: "Oct. 5, 2026 (Mon.) - Apr. 11, 2028 (Tue.)",
    session: "DIB: Session OCT-2025",
    duration: "18 months",
    program: "DIB: Diploma in International Business",
    canDelete: false,
  },
  {
    id: "ms-dib-oct-2026",
    dateRange: "Oct. 5, 2026 (Mon.) - Mar. 6, 2028 (Mon.)",
    session: "DIB: Session OCT-2026",
    duration: "72 Weeks",
    program: "DIB: Diploma in International Business",
    canDelete: true,
  },
  {
    id: "ms-moa-oct-2026",
    dateRange: "Oct. 5, 2026 (Mon.) - Jun. 30, 2027 (Wed.)",
    session: "MOA: Session OCT 2026",
    duration: "36 Weeks",
    program: "MOA: Medical Office Assistant",
    canDelete: true,
  },
  {
    id: "ms-hca-sep-2026",
    dateRange: "Sep. 21, 2026 (Mon.) - Mar. 5, 2027 (Fri.)",
    session: "HCA: Session SEP-2026",
    duration: "25 Weeks",
    program: "HCA: Health Care Assistant",
    canDelete: true,
  },
  {
    id: "ms-dib-sep-2026",
    dateRange: "Sep. 8, 2026 (Tue.) - Feb. 8, 2028 (Tue.)",
    session: "DIB: Session SEP-2026",
    duration: "72 Weeks",
    program: "DIB: Diploma in International Business",
    canDelete: false,
  },
  {
    id: "ms-dap-sep-2026",
    dateRange: "Sep. 8, 2026 (Tue.) - May. 25, 2027 (Tue.)",
    session: "DAP: Session SEP-2026",
    duration: "35 Weeks",
    program: "DAP: Diploma in Accounting and Payroll administrator",
    canDelete: true,
  },
];

const lmsOptions: Opt[] = [
  { label: "Disabled", value: "Disabled" },
  { label: "Moodle", value: "Moodle" },
];

const holidayOptions: Opt[] = [
  { label: "Extend", value: "Extend" },
  { label: "Blend", value: "Blend" },
];

const automateOptions: Opt[] = [
  { label: "Disabled", value: "Disabled" },
  { label: "Enabled", value: "Enabled" },
];

function deliveryFields(includeHolidays: boolean) {
  const fields: NonNullable<TeacherScreenConfig["form"]>["groups"][number]["fields"] = [
    { label: "Enable LMS", value: "Disabled", type: "select", options: lmsOptions },
    {
      label: "Student Course Availability",
      value: "First day of class",
      type: "select",
      options: daysBeforeOptions(false),
    },
    {
      label: "Faculty Course Availability",
      value: "7 days before start date",
      type: "select",
      options: daysBeforeOptions(true),
    },
  ];
  if (includeHolidays) {
    fields.push({ label: "Holidays Option", value: "Extend", type: "select", options: holidayOptions });
  }
  fields.push({
    label: "Automate Attendance Grading",
    value: "Disabled",
    type: "select",
    options: automateOptions,
  });
  return fields;
}

export const SCHEDULING_SCREENS: Record<string, TeacherScreenConfig> = {
  "/instructor/f/t52-academic-calendars": {
    path: "/instructor/f/t52-academic-calendars",
    figmaId: "4:14049",
    title: "Manage Academic Calendars",
    subtitle: "Academic calendars",
    breadcrumbs: ["Home", "Academic Calendars"],
    activeHref: "/instructor/f/t13-program-management",
    archetype: "academicCalendars",
    primaryAction: "Create Academic Calendar",
    primaryActionHref: "/instructor/f/t73-create-academic-calendar",
    academicCalendars: {
      emptyMessage: "No academic calendars were found.",
      rows: [],
    },
  },

  "/instructor/f/t53-master-scheduling": {
    path: "/instructor/f/t53-master-scheduling",
    figmaId: "4:14305",
    title: "Master Scheduling",
    subtitle: "Master schedules by program",
    breadcrumbs: ["Home", "Scheduling"],
    activeHref: "/instructor/f/t13-program-management",
    archetype: "masterScheduling",
    primaryAction: "Create Master Schedule",
    primaryActionHref: "/instructor/f/t71-create-master-schedule",
    secondaryAction: "Create Term Schedule",
    secondaryActionHref: "/instructor/f/t72-create-term-schedule",
    masterScheduling: {
      programFilterLabel: "Filter Program",
      programFilterValue: "",
      programOptions: PROGRAM_FILTER_OPTIONS,
      rows: DEFAULT_MASTER_SCHEDULE_ROWS,
    },
  },

  "/instructor/f/t71-create-master-schedule": {
    path: "/instructor/f/t71-create-master-schedule",
    figmaId: "4:14306",
    title: "Create Master Schedule",
    subtitle: "STEP 1 OF 3",
    breadcrumbs: ["Home", "Scheduling", "Create Schedule"],
    activeHref: "/instructor/f/t13-program-management",
    archetype: "form",
    primaryAction: "Continue",
    secondaryAction: "Cancel",
    secondaryActionHref: "/instructor/f/t53-master-scheduling",
    form: {
      stepLabel: "STEP 1 OF 3",
      submitLabel: "Continue",
      groups: [
        {
          title: "Master Schedule Details",
          fields: [
            { label: "Program", value: "", type: "select", options: PROGRAM_SELECT_OPTIONS },
            {
              label: "Schedule Abbreviation",
              value: "",
              type: "text",
              hint: "Short code shown on schedule listings",
            },
            {
              label: "Schedule Description",
              value: "",
              type: "textarea",
              optional: true,
              hint: "Optional",
            },
            {
              label: "Schedule Length",
              value: "48",
              type: "pair",
              options: LENGTH_NUMBERS,
              unitValue: "Months",
              unitOptions: LENGTH_UNITS,
            },
            {
              label: "Full-time Calculation",
              value: "By courses taken per term",
              type: "select",
              options: [
                { label: "By courses taken per term", value: "By courses taken per term" },
                { label: "By program of study definition", value: "By program of study definition" },
              ],
            },
            {
              label: "Full-time Minimum (per term)",
              value: "1",
              type: "select",
              options: LENGTH_NUMBERS.slice(0, 12),
            },
            {
              label: "Always full-time, if final term of study.",
              value: "false",
              type: "checkbox",
            },
          ],
        },
        {
          title: "Enrolment Conditions",
          fields: [
            {
              label: "Enrolment Limit",
              value: "No Limit",
              type: "select",
              options: [
                { label: "No Limit", value: "No Limit" },
                { label: "Set Limit", value: "Set Limit" },
              ],
            },
          ],
        },
        { title: "Course Delivery Settings", fields: deliveryFields(true) },
      ],
    },
  },

  "/instructor/f/t72-create-term-schedule": {
    path: "/instructor/f/t72-create-term-schedule",
    figmaId: "4:14307",
    title: "Create Term Schedule",
    subtitle: "STEP 1 OF 3",
    breadcrumbs: ["Home", "Scheduling", "Create Schedule"],
    activeHref: "/instructor/f/t13-program-management",
    archetype: "form",
    primaryAction: "Continue",
    secondaryAction: "Cancel",
    secondaryActionHref: "/instructor/f/t53-master-scheduling",
    form: {
      stepLabel: "STEP 1 OF 3",
      submitLabel: "Continue",
      groups: [
        {
          title: "Master Schedule Details",
          fields: [
            { label: "Term", value: "", type: "select", options: TERM_SELECT_OPTIONS },
            {
              label: "Schedule Description",
              value: "",
              type: "textarea",
              optional: true,
              hint: "Optional",
            },
          ],
        },
        { title: "Course Delivery Settings", fields: deliveryFields(false) },
      ],
    },
  },

  "/instructor/f/t73-create-academic-calendar": {
    path: "/instructor/f/t73-create-academic-calendar",
    figmaId: "4:14050",
    title: "Create Academic Calendar",
    subtitle: "Create an academic calendar",
    breadcrumbs: ["Home", "Academic Calendars", "Create Calendar"],
    activeHref: "/instructor/f/t13-program-management",
    archetype: "form",
    primaryAction: "Save Academic Calendar",
    secondaryAction: "Cancel",
    secondaryActionHref: "/instructor/f/t52-academic-calendars",
    form: {
      submitLabel: "Save Academic Calendar",
      groups: [
        {
          title: "Academic Calendar Details",
          fields: [
            { label: "Name", value: "", type: "text", hint: "Language: English" },
            { label: "Description", value: "", type: "textarea", hint: "Language: English · rich text" },
            { label: "Start Date", value: "", type: "text", hint: "YYYY-MM-DD" },
            { label: "End Date", value: "", type: "text", hint: "YYYY-MM-DD" },
            {
              label: "Status",
              value: "Inactive",
              type: "select",
              options: [
                { label: "Inactive", value: "Inactive" },
                { label: "Active", value: "Active" },
              ],
            },
            { label: "Calendar Access", value: "Public", type: "select", options: VIS },
          ],
        },
        {
          title: "Calendar Visibility / Usage Settings",
          fields: [
            { label: "Navigation Usage", value: "Visible", type: "select", options: SHOW },
            { label: "Module Usage", value: "Visible", type: "select", options: SHOW },
            { label: "Calendar Page", value: "Visible", type: "select", options: SHOW },
          ],
        },
        {
          title: "Display Options",
          fields: [
            { label: "Show Name", value: "Visible", type: "select", options: SHOW },
            { label: "Show Description", value: "Visible", type: "select", options: SHOW },
            { label: "Show Dates", value: "Visible", type: "select", options: SHOW },
            { label: "Show Programs", value: "Visible", type: "select", options: SHOW },
            { label: "Show Courses", value: "Visible", type: "select", options: SHOW },
            { label: "Show Sessions / Offerings", value: "Visible", type: "select", options: SHOW },
            { label: "Show Terms", value: "Visible", type: "select", options: SHOW },
            { label: "Show Deadlines", value: "Visible", type: "select", options: SHOW },
            { label: "Show Penalties", value: "Visible", type: "select", options: SHOW },
            { label: "Show Holidays", value: "Visible", type: "select", options: SHOW },
          ],
        },
        {
          title: "Programs Output",
          fields: [
            {
              label: "Programs",
              value: "All Programs",
              type: "select",
              options: [
                { label: "All Programs", value: "All Programs" },
                { label: "Selected Programs", value: "Selected Programs" },
              ],
            },
            { label: "Program Length", value: "Public", type: "select", options: VIS },
            { label: "Program Credits", value: "Public", type: "select", options: VIS },
            { label: "Program Enrolment Average (per term)", value: "Hidden", type: "select", options: VIS },
          ],
        },
        {
          title: "Courses Output",
          fields: [
            { label: "Description", value: "Public", type: "select", options: VIS },
            { label: "Syllabus", value: "Internal", type: "select", options: VIS },
            { label: "Credits", value: "Public", type: "select", options: VIS },
            { label: "Course Length", value: "Public", type: "select", options: VIS },
            { label: "Hours per Day", value: "Public", type: "select", options: VIS },
            { label: "Prerequisites", value: "Public", type: "select", options: VIS },
            { label: "Tuition", value: "Internal", type: "select", options: VIS },
            { label: "Textbooks", value: "Internal", type: "select", options: VIS },
            { label: "Grading Scheme", value: "Internal", type: "select", options: VIS },
            { label: "Transfer Courses", value: "Internal", type: "select", options: VIS },
          ],
        },
        {
          title: "Sessions / Offerings Output",
          fields: [
            {
              label: "Output Format",
              value: "List in Course Details",
              type: "select",
              options: [
                { label: "List in Course Details", value: "List in Course Details" },
                { label: "Separate Listing", value: "Separate Listing" },
              ],
            },
            { label: "Delivery Method Filter", value: "Public", type: "select", options: VIS },
            { label: "Term Filter", value: "Public", type: "select", options: VIS },
            { label: "Delivery Method", value: "Public", type: "select", options: VIS },
            { label: "Course Schedule", value: "Public", type: "select", options: VIS },
            { label: "Continuous Courses", value: "Public", type: "select", options: VIS },
            { label: "Self-Enrolment Open Date", value: "Internal", type: "select", options: VIS },
            { label: "Self-Enrolment Recently Open", value: "Hidden", type: "select", options: VIS },
            { label: "Closed Self-Enrolment", value: "Public", type: "select", options: VIS },
            { label: "Course Dates", value: "Hidden", type: "select", options: VIS },
            { label: "Session Location", value: "Internal", type: "select", options: VIS },
            { label: "Class Size", value: "Public", type: "select", options: VIS },
            { label: "Session Tuition", value: "Internal", type: "select", options: VIS },
            { label: "Instructor(s)", value: "Internal", type: "select", options: VIS },
          ],
        },
      ],
    },
  },
};
