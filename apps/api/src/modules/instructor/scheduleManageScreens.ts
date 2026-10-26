/** Schedule manage / review-term payloads for instructor SIS (pages 168, 174–191). */

export type ScheduleSessionRow = {
  id: string;
  course: string;
  title?: string;
  instructors: string;
  room: string;
  dates: string;
  schedule: string;
};

export type ScheduleLedgerRow = {
  id: string;
  type: string;
  domestic: string;
  international: string;
};

const DIB_SESSIONS: ScheduleSessionRow[] = [
  { id: "sess-empl-111", course: "EMPL 111", title: "Career Employment & Strategies", instructors: "Not Set", room: "Not Set", dates: "Nov. 2 – Nov. 16, 2026", schedule: "Mon–Fri 08:00–12:00" },
  { id: "sess-beth-190", course: "BETH 190", title: "Business Ethics", instructors: "Not Set", room: "Not Set", dates: "Nov. 17 – Dec. 1, 2026", schedule: "Mon–Fri 08:00–12:00" },
  { id: "sess-comp-101", course: "COMP 101", title: "Introduction to Computers", instructors: "Not Set", room: "Not Set", dates: "Dec. 2 – Dec. 16, 2026", schedule: "Mon–Fri 08:00–12:00" },
  { id: "sess-dap-101", course: "DAP 101", title: "Financial Accounting", instructors: "Not Set", room: "Not Set", dates: "Jan. 5 – Jan. 19, 2027", schedule: "Mon–Fri 08:00–12:00" },
  { id: "sess-bmgt-112", course: "BMGT 112", title: "Introduction to Organizational Behaviour", instructors: "Not Set", room: "Not Set", dates: "Jan. 20 – Feb. 3, 2027", schedule: "Mon–Fri 08:00–12:00" },
  { id: "sess-dib-121", course: "DIB 121", title: "Global Supply and Chain Management", instructors: "Not Set", room: "Not Set", dates: "Feb. 4 – Feb. 18, 2027", schedule: "Mon–Fri 08:00–12:00" },
  { id: "sess-dib-123", course: "DIB 123", title: "Career Choices", instructors: "Not Set", room: "Not Set", dates: "Feb. 19 – Mar. 5, 2027", schedule: "Mon–Fri 08:00–12:00" },
  { id: "sess-bmgt-105", course: "BMGT 105", title: "Introduction to Business Management", instructors: "Not Set", room: "Not Set", dates: "Mar. 8 – Mar. 22, 2027", schedule: "Mon–Fri 08:00–12:00" },
  { id: "sess-math-100", course: "MATH 100", title: "Business Mathematics", instructors: "Not Set", room: "Not Set", dates: "Mar. 23 – Apr. 6, 2027", schedule: "Mon–Fri 08:00–12:00" },
  { id: "sess-dib-116", course: "DIB 116", title: "Leadership", instructors: "Not Set", room: "Not Set", dates: "Apr. 7 – Apr. 21, 2027", schedule: "Mon–Fri 08:00–12:00" },
  { id: "sess-dib-115", course: "DIB 115", title: "Customer Service", instructors: "Not Set", room: "Not Set", dates: "Apr. 22 – May 6, 2027", schedule: "Mon–Fri 08:00–12:00" },
  { id: "sess-dib-117", course: "DIB 117", title: "International Business", instructors: "Not Set", room: "Not Set", dates: "May 7 – May 21, 2027", schedule: "Mon–Fri 08:00–12:00" },
  { id: "sess-dib-105", course: "DIB 105", title: "Business Statistics", instructors: "Not Set", room: "Not Set", dates: "May 24 – Jun. 7, 2027", schedule: "Mon–Fri 08:00–12:00" },
  { id: "sess-dib-101", course: "DIB 101", title: "Fundamentals of Business", instructors: "Not Set", room: "Not Set", dates: "Jun. 8 – Jun. 22, 2027", schedule: "Mon–Fri 08:00–12:00" },
  { id: "sess-dib-114", course: "DIB 114", title: "Managerial Economics", instructors: "Not Set", room: "Not Set", dates: "Jun. 23 – Jul. 7, 2027", schedule: "Mon–Fri 08:00–12:00" },
  { id: "sess-dib-118", course: "DIB 118", title: "Automation Management", instructors: "Not Set", room: "Not Set", dates: "Jul. 8 – Jul. 22, 2027", schedule: "Mon–Fri 08:00–12:00" },
  { id: "sess-dib-124", course: "DIB 124", title: "Management Information System", instructors: "Not Set", room: "Not Set", dates: "Jul. 23 – Aug. 6, 2027", schedule: "Mon–Fri 08:00–12:00" },
  { id: "sess-dib-prac", course: "DIB Practicum", title: "Practicum", instructors: "Not Set", room: "Not Set", dates: "Aug. 9 – Aug. 27, 2027", schedule: "Mon–Fri 08:00–12:00" },
  { id: "sess-dib-119", course: "DIB 119", title: "International Accounting", instructors: "Not Set", room: "Not Set", dates: "Aug. 30 – Sep. 13, 2027", schedule: "Mon–Fri 08:00–12:00" },
  { id: "sess-dib-122", course: "DIB 122", title: "International Marketing", instructors: "Not Set", room: "Not Set", dates: "Sep. 14 – Sep. 28, 2027", schedule: "Mon–Fri 08:00–12:00" },
  { id: "sess-dib-120", course: "DIB 120", title: "International Finance", instructors: "Not Set", room: "Not Set", dates: "Sep. 29 – Oct. 13, 2027", schedule: "Mon–Fri 08:00–12:00" },
  { id: "sess-mark-101", course: "MARK 101", title: "Introduction to Marketing", instructors: "Not Set", room: "Not Set", dates: "Oct. 14 – Oct. 28, 2027", schedule: "Mon–Fri 08:00–12:00" },
];

const DEFAULT_LEDGERS: ScheduleLedgerRow[] = [
  { id: "led-assess", type: "Assessment Fee", domestic: "0.00", international: "150.00" },
  { id: "led-app", type: "Application Fee", domestic: "250.00", international: "250.00" },
  { id: "led-books", type: "Textbooks", domestic: "2400.00", international: "2400.00" },
  { id: "led-tuition", type: "Tuition Fee", domestic: "19000.00", international: "23800.00" },
];

const SCHEDULE_META: Record<
  string,
  {
    programTitle: string;
    dateRange: string;
    abbreviation: string;
    description: string;
    length: string;
    lengthUnit: string;
    sessions?: ScheduleSessionRow[];
  }
> = {
  "ms-dib-nov-2026": {
    programTitle: "Schedule: Diploma in International Business",
    dateRange: "Monday, November 2, 2026 - Monday, April 3, 2028",
    abbreviation: "DIB-NOV26",
    description: "DIB: Session NOV-2026 (72 Weeks)",
    length: "72",
    lengthUnit: "Weeks",
    sessions: DIB_SESSIONS,
  },
  "ms-dap-sep-2026": {
    programTitle: "Schedule: Diploma in Accounting and Payroll administrator",
    dateRange: "Tuesday, September 8, 2026 - Tuesday, May 25, 2027",
    abbreviation: "DAP-SEP26",
    description: "DAP: Session SEP-2026 (35 Weeks)",
    length: "35",
    lengthUnit: "Weeks",
  },
};

function settingsGroups(meta: {
  abbreviation: string;
  description: string;
  length: string;
  lengthUnit: string;
}) {
  return [
    {
      title: "Master Schedule Details",
      fields: [
        { label: "Schedule Description", value: meta.description, type: "text", optional: true, hint: "Optional" },
        { label: "Schedule Abbreviation", value: meta.abbreviation, type: "text", hint: "Short code shown on schedule listings" },
      ],
    },
    {
      title: "Schedule Calculations",
      fields: [
        {
          label: "Schedule Length",
          value: meta.length,
          type: "pair",
          unitValue: meta.lengthUnit,
          unitOptions: [
            { label: "Weeks", value: "Weeks" },
            { label: "Months", value: "Months" },
          ],
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
          label: "Full-time Minimum",
          value: "1",
          type: "select",
          options: Array.from({ length: 12 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) })),
        },
        {
          label: "Always full-time, if final term of study",
          value: "false",
          type: "checkbox",
        },
      ],
    },
    {
      title: "Availability & Enrolment Settings",
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
        {
          label: "Student Course Availability",
          value: "First day of class",
          type: "select",
          options: [
            { label: "First day of class", value: "First day of class" },
            { label: "7 days before start date", value: "7 days before start date" },
          ],
        },
        {
          label: "Faculty Course Availability",
          value: "7 days before start date",
          type: "select",
          options: [
            { label: "First day of class", value: "First day of class" },
            { label: "7 days before start date", value: "7 days before start date" },
          ],
        },
        {
          label: "Automated Enrolment",
          value: "Disabled",
          type: "select",
          options: [
            { label: "Disabled", value: "Disabled" },
            { label: "Enabled", value: "Enabled" },
          ],
        },
        {
          label: "Required Core Courses",
          value: "All Courses",
          type: "select",
          options: [
            { label: "All Courses", value: "All Courses" },
            { label: "Core Only", value: "Core Only" },
          ],
        },
      ],
    },
    {
      title: "Practicum / Co-op Settings",
      fields: [
        {
          label: "Delivery Method",
          value: "Within schedule timeframe",
          type: "select",
          options: [
            { label: "Within schedule timeframe", value: "Within schedule timeframe" },
            { label: "After schedule timeframe", value: "After schedule timeframe" },
          ],
        },
        {
          label: "Enrolment Method",
          value: "Automated",
          type: "select",
          options: [
            { label: "Automated", value: "Automated" },
            { label: "Manual", value: "Manual" },
          ],
        },
        {
          label: "Student Status",
          value: "Do not change",
          type: "select",
          options: [
            { label: "Do not change", value: "Do not change" },
            { label: "Active", value: "Active" },
          ],
        },
      ],
    },
    {
      title: "Teach-out Settings",
      fields: [{ label: "Teach-out this schedule", value: "false", type: "checkbox" }],
    },
  ];
}

export function buildScheduleManagePayload(scheduleIdRaw: string) {
  const scheduleId = scheduleIdRaw || "ms-dib-nov-2026";
  const meta =
    SCHEDULE_META[scheduleId] ||
    SCHEDULE_META["ms-dib-nov-2026"] || {
      programTitle: "Schedule",
      dateRange: "—",
      abbreviation: scheduleId,
      description: "",
      length: "48",
      lengthUnit: "Months",
    };
  const sessions = meta.sessions || DIB_SESSIONS.slice(0, 8);
  return {
    title: meta.programTitle.replace(/^Schedule:\s*/i, "Schedule: "),
    subtitle: "Manage schedule and fees",
    breadcrumbs: ["Home", "Scheduling", "Manage Schedule"],
    scheduleManage: {
      scheduleId,
      programTitle: meta.programTitle,
      dateRange: meta.dateRange,
      activeTab: "Schedule Outline",
      viewMode: "standard" as const,
      addSessionHref: "/instructor/f/t78-add-session-offering",
      totals: {
        courses: sessions.length,
        sessions: sessions.length,
        conflicts: 0,
        enrolled: 1,
      },
      sessions,
      calendar: {
        monthLabel: "November, 2026",
        monthOptions: ["November, 2026", "December, 2026", "January, 2027"],
        nextMonthHint: "Dec.",
        startOffset: 0,
        daysInMonth: 30,
        events: [
          {
            id: "cal-empl",
            sessionId: "sess-empl-111",
            day: 2,
            code: "EMPL 111",
            title: "Career Employment & Strategies",
            time: "08:00–12:00",
            tone: "primary",
          },
          {
            id: "cal-beth",
            sessionId: "sess-beth-190",
            day: 17,
            code: "BETH 190",
            title: "Business Ethics",
            time: "08:00–12:00",
            tone: "accent",
          },
          {
            id: "cal-comp",
            sessionId: "sess-comp-101",
            day: 3,
            code: "COMP 101",
            title: "Introduction to Computers",
            time: "08:00–12:00",
            tone: "muted",
          },
          {
            id: "cal-holiday",
            day: 11,
            code: "HOLIDAY",
            title: "Remembrance Day",
            time: "All day",
            tone: "holiday",
          },
        ],
      },
      fees: {
        ledgers: DEFAULT_LEDGERS.map((l) => ({ ...l })),
        ledgerTypeOptions: ["Assessment Fee", "Application Fee", "Textbooks", "Tuition Fee", "Materials Fee"],
      },
      settings: { groups: settingsGroups(meta) },
    },
  };
}

export function mergeScheduleFeesOverlay(
  base: ScheduleLedgerRow[],
  overlay?: Record<string, unknown> | null,
): ScheduleLedgerRow[] {
  const deleted = new Set(
    Array.isArray(overlay?.deletedLedgerIds)
      ? (overlay!.deletedLedgerIds as unknown[]).filter((id): id is string => typeof id === "string")
      : [],
  );
  const extras = Array.isArray(overlay?.extraLedgers)
    ? (overlay!.extraLedgers as ScheduleLedgerRow[]).filter((r) => r && typeof r.id === "string")
    : [];
  const edits =
    overlay?.ledgerEdits && typeof overlay.ledgerEdits === "object"
      ? (overlay.ledgerEdits as Record<string, Partial<ScheduleLedgerRow>>)
      : {};
  const apply = (row: ScheduleLedgerRow): ScheduleLedgerRow => {
    const e = edits[row.id];
    return e ? { ...row, ...e, id: row.id } : row;
  };
  const extraIds = new Set(extras.map((e) => e.id));
  return [
    ...extras.filter((r) => !deleted.has(r.id)).map(apply),
    ...base.filter((r) => !deleted.has(r.id) && !extraIds.has(r.id)).map(apply),
  ];
}
