/** Course Textbooks + Course Content Repository (MySIS-parity). */

export const TEXTBOOKS_LIST_PATH = "/instructor/f/t57-course-textbooks";
export const REPOSITORY_LIST_PATH = "/instructor/f/t37-course-repository";

export type TextbookRecord = {
  id: string;
  name: string;
  detail?: string;
  format: string;
  isbn: string;
  domestic: string;
  international: string;
  courses: Array<{ id: string; label: string }>;
};

export type RepositoryCourseRecord = {
  id: string;
  courseId?: string;
  number: string;
  name: string;
  lms: string;
  status: "Active" | "Inactive";
  courseTypes: string;
  push: number;
  pull: number;
  history?: number;
  note?: string;
  isDefault?: string;
  courseFormat?: string;
  sections?: string;
};

export const TEXTBOOK_FORMATS = [
  { label: "Not Set", value: "Not Set" },
  { label: "Print", value: "Print" },
  { label: "e-Book", value: "e-Book" },
  { label: "Print / e-Book", value: "Print / e-Book" },
  { label: "Loose-leaf", value: "Loose-leaf" },
];

export const REPOSITORY_FILTERS = [
  { label: "Master Repository", value: "Master Repository" },
  { label: "Campus Repository", value: "Campus Repository" },
  { label: "Shared Repository", value: "Shared Repository" },
];

export const COURSE_TYPE_OPTIONS = [
  { label: "All Course Types", value: "All Course Types" },
  { label: "All Types", value: "All Types" },
  { label: "Lecture", value: "Lecture" },
  { label: "Online", value: "Online" },
];

export const DEFAULT_YES_NO = [
  { label: "Yes", value: "Yes" },
  { label: "No", value: "No" },
];

export const COURSE_FORMAT_OPTIONS = [
  { label: "Topics", value: "Topics" },
  { label: "Weeks", value: "Weeks" },
];

export const SECTION_COUNT_OPTIONS = Array.from({ length: 20 }, (_, i) => {
  const n = String(i + 1);
  return { label: n, value: n };
});

export const NAMED_CONTENT_COURSES: Array<{ number: string; name: string }> = [
  { number: "0", name: "DAP Practicum" },
  { number: "0", name: "MOA Work Experience" },
  { number: "0", name: "Work Experience" },
  { number: "000", name: "Practicum" },
  { number: "101", name: "ECOM" },
  { number: "101sdfdsrg", name: "ecom" },
  { number: "121", name: "ABCD" },
  { number: "ACSW 100", name: "Addictions Fundamentals" },
  { number: "ACSW 100", name: "Addictions Fundamentals (Campus)" },
  { number: "ACSW 200", name: "Social Service Work Fundamentals" },
  { number: "ACSW 300", name: "Self-Care Techniques" },
  { number: "ACSW 400", name: "Resources and Networking" },
  { number: "ACSW 500", name: "Family Studies" },
  { number: "ACSW 600", name: "Relapse Prevention" },
  { number: "ACSW 700", name: "Child and Youth Populations" },
  { number: "ADMN 104", name: "Introduction to Keyboarding" },
  { number: "ADMN 110", name: "Office Administration" },
  { number: "ADMN 114", name: "Customer Service" },
  { number: "BCOM 105", name: "Business Communications" },
  { number: "BETH 190", name: "Business Ethics" },
  { number: "BLAW 101", name: "Business Law" },
  { number: "BMGT 101", name: "Introduction to Human Resources" },
  { number: "BMGT 106", name: "Introduction to Business Management" },
  { number: "BMGT 112", name: "Introduction to Organizational Behaviour" },
  { number: "CAPA-DAP 105", name: "Computerized Accounting" },
  { number: "CAPA-DAP 106", name: "Modern Office Technology" },
  { number: "CAPA-DAP 110", name: "Payroll Compliance Basics" },
  { number: "CAPA-DIB 112", name: "Business Communication Theory" },
  { number: "COMP 101", name: "Introduction to Computers" },
  { number: "COMC 150", name: "Professional Report Writing" },
  { number: "CAPS 190", name: "Capstone Project" },
];

const FILLER_PREFIXES = ["ACC", "BUS", "NURS", "HCA", "MOA", "MARK", "ECON", "FIN", "HRM", "IT"];

/** PDF Screen 200 — Course Textbooks inventory (title + format; author/edition in detail). */
const PDF_TEXTBOOKS: Array<{ name: string; detail: string; format: string }> = [
  {
    name: "A Guide to Writing for Human Service Professionals Second Edition",
    detail: "Morley Glicken · 2nd Edition",
    format: "Print / e-Book",
  },
  {
    name: "ABC's of Relationship Selling Through Service",
    detail: "Charles M. Futrell · Latest Edition",
    format: "Print",
  },
  {
    name: "Accounting: Theory and Practice",
    detail: "Glautier & Underdown",
    format: "Print / e-Book",
  },
  {
    name: "Advertising & Promotion",
    detail: "Belch & Belch",
    format: "e-Book",
  },
  {
    name: "Business Communication Now",
    detail: "Flatley / Rentz / Lentz",
    format: "Print / e-Book",
  },
  {
    name: "Business Ethics",
    detail: "Canadian Edition",
    format: "Print",
  },
  {
    name: "Business Foundations: A Changing World",
    detail: "Ferrell / Hirt / Ferrell",
    format: "Print / e-Book",
  },
  {
    name: "Business Statistics in Practice",
    detail: "Bowerman / O'Connell / Murphree",
    format: "e-Book",
  },
  {
    name: "Canadian Business and Society",
    detail: "Sexty · Latest Canadian Edition",
    format: "Print",
  },
  {
    name: "Canadian Business Law Today",
    detail: "Willes & Willes",
    format: "Print / e-Book",
  },
  {
    name: "Canadian Human Resource Management",
    detail: "Schwind / Uggerslev / Wagar",
    format: "Print / e-Book",
  },
  {
    name: "Canadian Income Tax",
    detail: "Byrd & Chen",
    format: "Print",
  },
  {
    name: "Career Achievement: Growing Your Goals",
    detail: "Lisa Harpe",
    format: "e-Book",
  },
  {
    name: "Choices: Interviewing and Counseling Skills for Canadians",
    detail: "Shebib · Canadian Edition",
    format: "Print / e-Book",
  },
  {
    name: "College English and Business Communication",
    detail: "Sue C. Camp",
    format: "Print",
  },
  {
    name: "Compensation",
    detail: "Milkovich / Newman / Gerhart",
    format: "Print / e-Book",
  },
  {
    name: "Computer Accounting with QuickBooks",
    detail: "Donna Kay",
    format: "e-Book",
  },
  {
    name: "Concepts of Fitness and Wellness",
    detail: "Corbin / Welk",
    format: "Print",
  },
  {
    name: "Customer Service",
    detail: "Timm · Latest Edition",
    format: "Print / e-Book",
  },
  {
    name: "Digital Marketing Fundamentals",
    detail: "Chaffey & Ellis-Chadwick",
    format: "e-Book",
  },
  {
    name: "Employee Training and Development",
    detail: "Raymond Noe",
    format: "Print / e-Book",
  },
  {
    name: "Essentials of Contemporary Management",
    detail: "Jones & George · Canadian Edition",
    format: "Print",
  },
  {
    name: "Essentials of Understanding Psychology",
    detail: "Robert Feldman",
    format: "Print / e-Book",
  },
  {
    name: "Financial Markets and Institutions",
    detail: "Saunders & Cornett",
    format: "e-Book",
  },
  {
    name: "First Course in Applied Behavior Analysis",
    detail: "Paul Chance",
    format: "Print",
  },
  {
    name: "Foundations of Child and Youth Care",
    detail: "Stuart · Canadian Edition",
    format: "Print / e-Book",
  },
  {
    name: "Foundations of Mental Health Care",
    detail: "Morrison-Valfre",
    format: "Print",
  },
  {
    name: "Fundamentals for Practice with High Risk Populations",
    detail: "Corcoran",
    format: "Print / e-Book",
  },
];

function slugTextbook(name: string) {
  return `tb-${name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export const DEFAULT_TEXTBOOKS: TextbookRecord[] = PDF_TEXTBOOKS.map((book, index) => {
  const baseIsbn = 9780134000000 + index * 137;
  const isbn = String(baseIsbn).replace(/(\d{3})(\d{10})/, "$1-$2");
  const domestic = (79 + (index % 12) * 9 + (index % 3) * 4).toFixed(2);
  const international = (Number(domestic) + 24 + (index % 5) * 3).toFixed(2);
  return {
    id: slugTextbook(book.name),
    name: book.name,
    detail: book.detail,
    format: book.format,
    isbn,
    domestic,
    international,
    courses: [],
  };
});

function slugCourse(number: string, name: string) {
  return `repo-${number}-${name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function money(n: number) {
  return n.toFixed(2);
}

export function courseOptionLabel(number: string, name: string) {
  return `${number}: ${name}`;
}

export function contentCourseOptions() {
  return [
    { label: "-- Select Course --", value: "" },
    ...buildRepositoryCatalog().map((c) => ({
      label: courseOptionLabel(c.number, c.name),
      value: c.id,
    })),
  ];
}

export function buildRepositoryCatalog(): RepositoryCourseRecord[] {
  const named = NAMED_CONTENT_COURSES.map((c, index) => toRepoCourse(c.number, c.name, index));
  const rows = [...named];
  let i = named.length;
  while (rows.length < 127) {
    const prefix = FILLER_PREFIXES[i % FILLER_PREFIXES.length];
    const num = 100 + (i % 80);
    const number = `${prefix} ${num}`;
    const name = `${prefix} Content Module ${num}`;
    const course = toRepoCourse(number, name, i);
    // Keep the first occurrence's id unchanged: stored overlays reference repository ids.
    if (rows.some((r) => r.id === course.id)) course.id = `${course.id}-${i}`;
    rows.push(course);
    i += 1;
  }
  return rows;
}

function toRepoCourse(number: string, name: string, index: number): RepositoryCourseRecord {
  // PDF Screen 208: first ACSW 100 row is Inactive; campus copy stays Active with history.
  const forceInactive = number === "ACSW 100" && !/campus/i.test(name);
  const displayName = name.replace(/\s*\(Campus\)\s*$/i, "").trim();
  const pdfStats = PDF_REPO_STATS[`${number}|${name}`] ?? PDF_REPO_STATS[`${number}|${displayName}`];
  const history = pdfStats
    ? pdfStats.history
    : forceInactive
      ? undefined
      : index % 6 === 0
        ? undefined
        : (index * 2) % 11 || 1;
  return {
    id: slugCourse(number, name),
    number,
    name: displayName,
    lms: "Moodle",
    status: forceInactive || index % 8 === 3 ? "Inactive" : "Active",
    courseTypes: "All Types",
    push: pdfStats ? pdfStats.push : forceInactive ? 1 : (index * 3) % 12,
    pull: pdfStats ? pdfStats.pull : forceInactive ? 8 : (index * 7) % 16,
    history,
    isDefault: "Yes",
    courseFormat: "Topics",
    sections: "10",
  };
}

/** Exact PUSH/PULL/HISTORY counts from PDF Screen 208 visible rows. */
const PDF_REPO_STATS: Record<string, { push: number; pull: number; history?: number }> = {
  "0|DAP Practicum": { push: 4, pull: 11 },
  "ACSW 100|Addictions Fundamentals": { push: 1, pull: 8 },
  "ACSW 100|Addictions Fundamentals (Campus)": { push: 1, pull: 8, history: 3 },
  "ACSW 200|Social Service Work Fundamentals": { push: 2, pull: 8, history: 2 },
  "ACSW 300|Self-Care Techniques": { push: 2, pull: 8, history: 2 },
  "ACSW 400|Resources and Networking": { push: 1, pull: 8, history: 1 },
  "ACSW 500|Family Studies": { push: 3, pull: 8, history: 6 },
  "ADMN 104|Introduction to Keyboarding": { push: 1, pull: 10, history: 10 },
};

export function moneyLabel(value: string) {
  const n = Number.parseFloat(String(value).replace(/[^0-9.]/g, ""));
  return `$${Number.isFinite(n) ? money(n) : "0.00"}`;
}

export function mergeTextbookList(
  seed: TextbookRecord[],
  overlay?: Record<string, unknown> | null,
): TextbookRecord[] {
  const deleted = new Set(
    Array.isArray(overlay?.deletedTextbookIds)
      ? (overlay!.deletedTextbookIds as unknown[]).filter((id): id is string => typeof id === "string")
      : [],
  );
  const extras = Array.isArray(overlay?.extraTextbooks)
    ? (overlay!.extraTextbooks as TextbookRecord[]).filter((t) => t && typeof t.id === "string")
    : [];
  const extraIds = new Set(extras.map((t) => t.id));
  const edits =
    overlay?.textbookEdits && typeof overlay.textbookEdits === "object"
      ? (overlay.textbookEdits as Record<string, Partial<TextbookRecord>>)
      : {};
  const apply = (t: TextbookRecord): TextbookRecord => {
    const e = edits[t.id];
    if (!e) return { ...t, courses: [...(t.courses ?? [])] };
    return {
      id: t.id,
      name: typeof e.name === "string" && e.name.trim() ? e.name : t.name,
      detail: typeof e.detail === "string" ? e.detail : t.detail,
      format: typeof e.format === "string" && e.format.trim() ? e.format : t.format,
      isbn: typeof e.isbn === "string" && e.isbn.trim() ? e.isbn : t.isbn,
      domestic: typeof e.domestic === "string" && e.domestic.trim() ? e.domestic : t.domestic,
      international:
        typeof e.international === "string" && e.international.trim() ? e.international : t.international,
      courses: Array.isArray(e.courses) ? e.courses : [...(t.courses ?? [])],
    };
  };
  return [
    ...extras.filter((t) => !deleted.has(t.id)).map(apply),
    ...seed.filter((t) => !deleted.has(t.id) && !extraIds.has(t.id)).map(apply),
  ];
}

export function mergeRepositoryList(
  seed: RepositoryCourseRecord[],
  overlay?: Record<string, unknown> | null,
): RepositoryCourseRecord[] {
  const deleted = new Set(
    Array.isArray(overlay?.deletedRepositoryIds)
      ? (overlay!.deletedRepositoryIds as unknown[]).filter((id): id is string => typeof id === "string")
      : [],
  );
  const extras = Array.isArray(overlay?.extraRepositoryCourses)
    ? (overlay!.extraRepositoryCourses as RepositoryCourseRecord[]).filter((c) => c && typeof c.id === "string")
    : [];
  const extraIds = new Set(extras.map((c) => c.id));
  const edits =
    overlay?.repositoryEdits && typeof overlay.repositoryEdits === "object"
      ? (overlay.repositoryEdits as Record<string, Partial<RepositoryCourseRecord>>)
      : {};
  const counts =
    overlay?.repositoryActionCounts && typeof overlay.repositoryActionCounts === "object"
      ? (overlay.repositoryActionCounts as Record<string, { push?: number; pull?: number; history?: number }>)
      : {};
  const apply = (c: RepositoryCourseRecord): RepositoryCourseRecord => {
    const e = edits[c.id];
    const n = counts[c.id];
    const next: RepositoryCourseRecord = {
      ...c,
      ...(e ?? {}),
      id: c.id,
      number: typeof e?.number === "string" && e.number.trim() ? e.number : c.number,
      name: typeof e?.name === "string" && e.name.trim() ? e.name : c.name,
      lms: typeof e?.lms === "string" && e.lms.trim() ? e.lms : c.lms,
      status: e?.status === "Inactive" || e?.status === "Active" ? e.status : c.status,
      courseTypes: typeof e?.courseTypes === "string" && e.courseTypes.trim() ? e.courseTypes : c.courseTypes,
      push: typeof n?.push === "number" ? n.push : c.push,
      pull: typeof n?.pull === "number" ? n.pull : c.pull,
      history: typeof n?.history === "number" ? n.history : c.history,
    };
    return next;
  };
  return [
    ...extras.filter((c) => !deleted.has(c.id)).map(apply),
    ...seed.filter((c) => !deleted.has(c.id) && !extraIds.has(c.id)).map(apply),
  ];
}

function queryParam(path: string, key: string) {
  const query = path.includes("?") ? path.slice(path.indexOf("?") + 1) : "";
  return new URLSearchParams(query).get(key)?.trim() || "";
}

export function buildCourseTextbooksList(overlay?: Record<string, unknown> | null) {
  const textbooks = mergeTextbookList(DEFAULT_TEXTBOOKS, overlay);
  return {
    title: "Course Textbooks",
    subtitle: "Course textbooks",
    primaryAction: "Add Textbook",
    primaryActionHref: "/instructor/f/t79-add-textbook",
    courseTextbooks: {
      textbooks,
    },
  };
}

export function buildAddTextbookForm(overlay?: Record<string, unknown> | null, path = "") {
  const textbookId = queryParam(path, "textbookId");
  const existing = textbookId
    ? mergeTextbookList(DEFAULT_TEXTBOOKS, overlay).find((t) => t.id === textbookId)
    : undefined;
  const courseOptions = contentCourseOptions();
  return {
    title: existing ? "Edit Textbook" : "Add Textbook",
    subtitle: "Add a textbook",
    primaryAction: "Save Textbook",
    secondaryAction: "Cancel",
    secondaryActionHref: TEXTBOOKS_LIST_PATH,
    form: {
      submitLabel: "Save Textbook",
      groups: [
        {
          title: "Textbook Details",
          fields: [
            { label: "Textbook Name", value: existing?.name ?? "", type: "text" as const },
            { label: "ISBN", value: existing?.isbn ?? "", type: "text" as const },
            {
              label: "Format",
              value: existing?.format || "Not Set",
              type: "select" as const,
              options: TEXTBOOK_FORMATS,
            },
          ],
        },
        {
          title: "Textbook Fees",
          fields: [
            {
              label: "Domestic",
              value: existing?.domestic || "0.00",
              type: "text" as const,
              prefix: "$",
            },
            {
              label: "International",
              value: existing?.international || "0.00",
              type: "text" as const,
              prefix: "$",
            },
          ],
        },
      ],
      linkedCourses: {
        title: "Textbook Courses",
        addLabel: "ADD",
        emptyLabel: "No courses linked yet. Use ADD to associate this textbook.",
        courseOptions,
        rows: existing?.courses ?? [],
      },
    },
  };
}

export function buildContentRepositoryList(overlay?: Record<string, unknown> | null) {
  const courses = mergeRepositoryList(buildRepositoryCatalog(), overlay);
  return {
    title: "Course Content Repository",
    subtitle: "Course content repository",
    primaryAction: "Create Content Course",
    primaryActionHref: "/instructor/f/t80-create-content-course",
    contentRepository: {
      courseFilterPlaceholder: "Enter Course Name / Number Here",
      searchLabel: "Search Repository",
      repositoryFilter: "Master Repository",
      repositoryOptions: REPOSITORY_FILTERS,
      resultsLabel: `Results: ${courses.length}`,
      perPage: "50",
      perPageOptions: [
        { label: "25", value: "25" },
        { label: "50", value: "50" },
        { label: "100", value: "100" },
      ],
      page: "1",
      courses,
    },
  };
}

export function buildCreateContentCourseForm(overlay?: Record<string, unknown> | null, path = "") {
  const courseId = queryParam(path, "courseId");
  const existing = courseId
    ? mergeRepositoryList(buildRepositoryCatalog(), overlay).find((c) => c.id === courseId)
    : undefined;
  const options = contentCourseOptions();
  const editing = Boolean(existing);
  return {
    title: editing ? "Edit Content Course" : "Create Content Course",
    subtitle: "Create a content course",
    primaryAction: editing ? "Save Content Course" : "Create Content Course",
    secondaryAction: "Cancel",
    secondaryActionHref: REPOSITORY_LIST_PATH,
    form: {
      submitLabel: editing ? "Save Content Course" : "Create Content Course",
      warning:
        "Duplicate courses that are set to active will be deactivated automatically. Customized campus course assignment will be automatically modified if duplicated.",
      groups: [
        {
          title: "Course Content Repository Settings",
          fields: [
            {
              label: "Course",
              value: existing?.id ?? "",
              type: "select" as const,
              options,
            },
            {
              label: "Note / Name",
              value: existing?.note || existing?.name || "",
              type: "text" as const,
              visibleWhen: "Course",
            },
            {
              label: "Course Types",
              value: existing?.courseTypes === "All Types" ? "All Course Types" : existing?.courseTypes || "All Course Types",
              type: "select" as const,
              options: COURSE_TYPE_OPTIONS,
              visibleWhen: "Course",
            },
            {
              label: "Default",
              value: existing?.isDefault || "Yes",
              type: "select" as const,
              options: DEFAULT_YES_NO,
              visibleWhen: "Course",
            },
            {
              label: "Course Format",
              value: existing?.courseFormat || "Topics",
              type: "select" as const,
              options: COURSE_FORMAT_OPTIONS,
              visibleWhen: "Course",
            },
            {
              label: "Sections / Weeks",
              value: existing?.sections || "10",
              type: "select" as const,
              options: SECTION_COUNT_OPTIONS,
              visibleWhen: "Course",
            },
          ],
        },
      ],
    },
  };
}

export function textbookFromFields(fields: Record<string, unknown>, fallbackId?: string): TextbookRecord {
  const name = String(fields["Textbook Name"] || fields.Name || "Untitled textbook").trim();
  const isbn = String(fields.ISBN || "").trim() || "—";
  const format = String(fields.Format || "Not Set").trim() || "Not Set";
  const domestic = normalizeMoney(String(fields.Domestic || "0.00"));
  const international = normalizeMoney(String(fields.International || "0.00"));
  const rawCourses = fields.__linkedCourses;
  const courses = Array.isArray(rawCourses)
    ? rawCourses
        .map((row) => {
          if (!row || typeof row !== "object") return null;
          const r = row as { id?: string; label?: string; courseId?: string; courseLabel?: string };
          const id = String(r.id || r.courseId || "").trim();
          const label = String(r.label || r.courseLabel || "").trim();
          if (!id && !label) return null;
          return { id: id || slugCourse(label, label), label: label || id };
        })
        .filter((row): row is { id: string; label: string } => Boolean(row))
    : [];
  return {
    id: fallbackId || `tb-${Date.now().toString(36)}`,
    name,
    format,
    isbn,
    domestic,
    international,
    courses,
  };
}

export function repositoryCourseFromFields(
  fields: Record<string, unknown>,
  catalog: RepositoryCourseRecord[],
  fallbackId?: string,
): RepositoryCourseRecord {
  const selectedId = String(fields.Course || fields.courseId || "").trim();
  const selected = catalog.find((c) => c.id === selectedId);
  const note = String(fields["Note / Name"] || "").trim();
  const courseTypes = String(fields["Course Types"] || "All Types").trim() || "All Types";
  const format = String(fields["Course Format"] || "Topics").trim() || "Topics";
  const sections = String(fields["Sections / Weeks"] || "10").trim() || "10";
  const isDefault = String(fields.Default || "Yes").trim() || "Yes";
  const number = String(fields["Course Number"] || selected?.number || selectedId || "0").trim();
  const name = note || String(fields["Course Title"] || selected?.name || "Content Course").trim();
  const requestedStatus = String(fields.Status || "").trim();
  return {
    id: fallbackId || `repo-${Date.now().toString(36)}`,
    courseId: selected?.courseId || selectedId || undefined,
    number,
    name,
    lms: selected?.lms || "Moodle",
    status: requestedStatus ? (/inactive/i.test(requestedStatus) ? "Inactive" : "Active") : selected?.status || "Active",
    courseTypes: courseTypes === "All Course Types" ? "All Types" : courseTypes,
    push: selected?.push ?? 0,
    pull: selected?.pull ?? 0,
    history: selected?.history,
    note,
    isDefault,
    courseFormat: format,
    sections,
  };
}

function normalizeMoney(raw: string) {
  const n = Number.parseFloat(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}
