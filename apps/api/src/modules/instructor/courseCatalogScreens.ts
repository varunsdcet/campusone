import { prisma } from "@myheritage/db";

export const COURSE_GROUPS_PATH = "/instructor/f/t59-course-groups-types";
const COURSE_GROUPS_STORE = "/instructor/catalog/course-groups";

export type CourseGroup = { id: string; name: string; abbreviation: string; createdAt: string };

type Db = Pick<typeof prisma, "sisScreenState">;

function validationError(message: string, status = 400, code = "VALIDATION_ERROR") {
  return Object.assign(new Error(message), { status, code });
}

export async function loadCourseGroups(institutionId: string, db: Db = prisma): Promise<CourseGroup[]> {
  const row = await db.sisScreenState.findUnique({
    where: { institutionId_path: { institutionId, path: COURSE_GROUPS_STORE } },
  });
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.payloadJson) as { groups?: unknown };
    return Array.isArray(parsed.groups)
      ? (parsed.groups as CourseGroup[]).filter((g) => g && typeof g.name === "string")
      : [];
  } catch {
    return [];
  }
}

export async function saveCourseGroup(
  institutionId: string,
  fields: Record<string, unknown>,
  db: Db = prisma,
): Promise<CourseGroup> {
  const name = String(fields["Course Group Name"] ?? fields.Name ?? "").trim();
  const abbreviation = String(fields.Abbreviation ?? "").trim().toUpperCase();
  if (!name) throw validationError("Course Group Name is required");
  if (name.length > 120) throw validationError("Course Group Name must be 120 characters or fewer");
  if (abbreviation.length > 20) throw validationError("Abbreviation must be 20 characters or fewer");
  const groups = await loadCourseGroups(institutionId, db);
  if (name.toLowerCase() === "no grouping" || groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
    throw validationError(`A course group named "${name}" already exists`, 409, "CONFLICT");
  }
  if (abbreviation && groups.some((g) => g.abbreviation === abbreviation)) {
    throw validationError(`The abbreviation "${abbreviation}" is already used`, 409, "CONFLICT");
  }
  const group: CourseGroup = {
    id: `cg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    abbreviation,
    createdAt: new Date().toISOString(),
  };
  const payloadJson = JSON.stringify({ groups: [...groups, group] });
  await db.sisScreenState.upsert({
    where: { institutionId_path: { institutionId, path: COURSE_GROUPS_STORE } },
    create: { institutionId, path: COURSE_GROUPS_STORE, payloadJson },
    update: { payloadJson },
  });
  return group;
}

export async function buildCourseGroupsList(institutionId: string, db: Db = prisma) {
  const groups = await loadCourseGroups(institutionId, db);
  const rows = [
    { cells: ["No Grouping", "—", "Default for courses without a group", "ACTIVE"], badge: "ACTIVE", badgeTone: "active" },
    ...groups
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((g) => ({
        cells: [g.name, g.abbreviation || "—", `Added ${g.createdAt.slice(0, 10)}`, "ACTIVE"],
        badge: "ACTIVE",
        badgeTone: "active",
      })),
  ];
  return {
    title: "Course Groups",
    subtitle: "Groups used to organise courses in the catalog",
    breadcrumbs: ["Home", "Course Management", "Course Groups"],
    countLabel: `${rows.length} course group${rows.length === 1 ? "" : "s"}`,
    rows,
    emptyMessage: "No course groups yet. Use Add Course Group to create one.",
  };
}

export function buildCourseBackups(sectionCount: number) {
  return {
    title: "Course Backups",
    subtitle: "Archived copies of your course content",
    breadcrumbs: ["Home", "Course Management", "Course Backups"],
    countLabel: "0 backups",
    rows: [],
    emptyMessage: sectionCount
      ? "No course backups have been created for your courses. Backups are made by the registrar when a course is archived."
      : "No course sections are assigned to you, so there are no course backups to show.",
  };
}
