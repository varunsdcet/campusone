export const COURSE_CONFIG_PATH = "/instructor/f/t66-course-configurations";

export const ENROLLMENT_PERMISSION_OPTIONS = [
  "No permission required",
  "Instructor approval",
  "Department approval",
  "Prerequisite gate",
] as const;

export const SYLLABUS_PRIVACY_OPTIONS = [
  "Private",
  "Enrolled students",
  "Institution",
  "Public",
] as const;

export const REPOSITORY_SETTING_OPTIONS = [
  "Use brand settings",
  "Course-specific",
  "Section-specific",
  "Disabled",
] as const;

export const TEXTBOOK_OPT_OUT_OPTIONS = [
  "System Default",
  "Allow opt-out",
  "No opt-out",
] as const;

export type CourseConfigRecord = {
  id: string;
  name: string;
  abbreviation: string;
  enrollmentPermission: string;
  syllabusPrivacy: string;
  repositorySettings: string;
  textbookOptOut: string;
  active: boolean;
};

export const DEFAULT_COURSE_CONFIGS: CourseConfigRecord[] = [
  {
    id: "course-dap-practicum",
    name: "DAP PRACTICUM",
    abbreviation: "0",
    enrollmentPermission: "No permission required",
    syllabusPrivacy: "Private",
    repositorySettings: "Use brand settings",
    textbookOptOut: "System Default",
    active: true,
  },
  {
    id: "course-capa-dap-105",
    name: "Computerized Accounting",
    abbreviation: "CAPA-DAP 105",
    enrollmentPermission: "No permission required",
    syllabusPrivacy: "Private",
    repositorySettings: "Use brand settings",
    textbookOptOut: "System Default",
    active: true,
  },
  {
    id: "course-capa-dap-106",
    name: "Modern Office Technology",
    abbreviation: "CAPA-DAP 106",
    enrollmentPermission: "Instructor approval",
    syllabusPrivacy: "Enrolled students",
    repositorySettings: "Course-specific",
    textbookOptOut: "Allow opt-out",
    active: true,
  },
  {
    id: "course-capa-dap-110",
    name: "Payroll Compliance Basics",
    abbreviation: "CAPA-DAP 110",
    enrollmentPermission: "No permission required",
    syllabusPrivacy: "Private",
    repositorySettings: "Use brand settings",
    textbookOptOut: "System Default",
    active: true,
  },
  {
    id: "course-capa-dib-112",
    name: "Business Communication Theory",
    abbreviation: "CAPA-DIB 112",
    enrollmentPermission: "No permission required",
    syllabusPrivacy: "Institution",
    repositorySettings: "Use brand settings",
    textbookOptOut: "No opt-out",
    active: true,
  },
];

function stringIds(value: unknown) {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

function asConfig(value: unknown): CourseConfigRecord | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<CourseConfigRecord>;
  if (typeof row.id !== "string" || !row.id.trim()) return null;
  return {
    id: row.id,
    name: typeof row.name === "string" && row.name.trim() ? row.name : row.id,
    abbreviation: typeof row.abbreviation === "string" ? row.abbreviation : "",
    enrollmentPermission:
      typeof row.enrollmentPermission === "string" && row.enrollmentPermission.trim()
        ? row.enrollmentPermission
        : "No permission required",
    syllabusPrivacy: typeof row.syllabusPrivacy === "string" && row.syllabusPrivacy.trim() ? row.syllabusPrivacy : "Private",
    repositorySettings:
      typeof row.repositorySettings === "string" && row.repositorySettings.trim()
        ? row.repositorySettings
        : "Use brand settings",
    textbookOptOut:
      typeof row.textbookOptOut === "string" && row.textbookOptOut.trim() ? row.textbookOptOut : "System Default",
    active: typeof row.active === "boolean" ? row.active : true,
  };
}

export function mergeCourseConfigList(
  overlay: Record<string, unknown> | null | undefined,
  dbCourses: Array<{ id: string; code: string; title: string }>,
): CourseConfigRecord[] {
  const deleted = new Set(stringIds(overlay?.deletedCourseConfigIds));
  const extras = Array.isArray(overlay?.extraCourseConfigs)
    ? (overlay!.extraCourseConfigs as unknown[]).map(asConfig).filter((row): row is CourseConfigRecord => Boolean(row))
    : [];
  const extraIds = new Set(extras.map((row) => row.id));
  const extraCodes = new Set(extras.map((row) => row.abbreviation.toLowerCase()));
  const extraNames = new Set(extras.map((row) => row.name.toLowerCase()));
  const editsRaw =
    overlay?.courseConfigEdits && typeof overlay.courseConfigEdits === "object"
      ? (overlay.courseConfigEdits as Record<string, Partial<CourseConfigRecord>>)
      : {};
  const apply = (row: CourseConfigRecord): CourseConfigRecord => {
    const e = editsRaw[row.id];
    if (!e) return { ...row };
    return {
      id: row.id,
      name: typeof e.name === "string" && e.name.trim() ? e.name : row.name,
      abbreviation: typeof e.abbreviation === "string" && e.abbreviation.trim() ? e.abbreviation : row.abbreviation,
      enrollmentPermission:
        typeof e.enrollmentPermission === "string" && e.enrollmentPermission.trim()
          ? e.enrollmentPermission
          : row.enrollmentPermission,
      syllabusPrivacy: typeof e.syllabusPrivacy === "string" && e.syllabusPrivacy.trim() ? e.syllabusPrivacy : row.syllabusPrivacy,
      repositorySettings:
        typeof e.repositorySettings === "string" && e.repositorySettings.trim()
          ? e.repositorySettings
          : row.repositorySettings,
      textbookOptOut: typeof e.textbookOptOut === "string" && e.textbookOptOut.trim() ? e.textbookOptOut : row.textbookOptOut,
      active: typeof e.active === "boolean" ? e.active : row.active,
    };
  };
  const rows = [
    ...extras.filter((row) => !deleted.has(row.id)).map(apply),
    ...DEFAULT_COURSE_CONFIGS.filter((row) => !deleted.has(row.id) && !extraIds.has(row.id)).map(apply),
  ];
  const seen = new Set(rows.flatMap((row) => [row.id, row.abbreviation.toLowerCase(), row.name.toLowerCase()]));
  for (const course of dbCourses) {
    if (deleted.has(course.id)) continue;
    if (extraIds.has(course.id) || extraCodes.has(course.code.toLowerCase()) || extraNames.has(course.title.toLowerCase())) {
      continue;
    }
    if (seen.has(course.id) || seen.has(course.code.toLowerCase()) || seen.has(course.title.toLowerCase())) continue;
    rows.push(
      apply({
        id: course.id,
        name: course.title,
        abbreviation: course.code,
        enrollmentPermission: "No permission required",
        syllabusPrivacy: "Private",
        repositorySettings: "Use brand settings",
        textbookOptOut: "System Default",
        active: true,
      }),
    );
  }
  return rows;
}

export function selectOptions(labels: readonly string[]) {
  return labels.map((label) => ({ label, value: label }));
}
