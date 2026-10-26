import { prisma } from "@myheritage/db";

export const COURSE_RESOURCES_PATH = "/instructor/f/t60-course-resources-management";
export const ADD_RESOURCE_CATEGORY_PATH = "/instructor/f/t60b-add-course-resource-category";
export const ADD_COURSE_RESOURCE_PATH = "/instructor/f/t60c-add-course-resource";
export const BADGES_LIST_PATH = "/instructor/f/t82-badges-accomplishments";
export const ADD_BADGE_PATH = "/instructor/f/t70-add-badge";
export const GRADING_SCHEMES_PATH = "/instructor/f/t61-grading-schemes";
export const ADD_GRADING_SCHEME_PATH = "/instructor/f/t64-add-grading-scheme";

export type GradeRow = {
  letter: string;
  percent: string;
  gradePoint: string;
  credit: string;
  condition: string;
};

export const DIB_DAP_GRADES: GradeRow[] = [
  { letter: "A+", percent: "100.00", gradePoint: "3.00", credit: "Yes", condition: "None" },
  { letter: "A", percent: "90.00", gradePoint: "3.00", credit: "Yes", condition: "None" },
  { letter: "A-", percent: "80.00", gradePoint: "3.00", credit: "Yes", condition: "None" },
  { letter: "B+", percent: "79.00", gradePoint: "3.00", credit: "Yes", condition: "None" },
  { letter: "B", percent: "75.00", gradePoint: "3.00", credit: "Yes", condition: "None" },
  { letter: "B-", percent: "70.00", gradePoint: "3.00", credit: "Yes", condition: "None" },
];

export async function listCourseOptions(institutionId: string) {
  const courses = await prisma.course.findMany({
    where: { institutionId },
    orderBy: [{ code: "asc" }, { title: "asc" }],
    take: 200,
    select: { id: true, code: true, title: true },
  });
  return [
    { label: "-- Select Course --", value: "" },
    ...courses.map((c) => ({
      label: `(HCC) ${c.code}: ${c.title}`,
      value: c.id,
    })),
  ];
}

export async function listCourseResourcesPayload(institutionId: string) {
  const [categories, resources] = await Promise.all([
    prisma.courseResourceCategory.findMany({
      where: { institutionId },
      orderBy: { name: "asc" },
    }),
    prisma.courseResource.findMany({
      where: { institutionId },
      include: { course: { select: { code: true, title: true } }, category: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const rows = [
    ...categories.map((c) => ({
      id: c.id,
      kind: "category" as const,
      name: c.name,
      meta: `Category · ${c.language}`,
    })),
    ...resources.map((r) => ({
      id: r.id,
      kind: "resource" as const,
      name: r.name,
      meta: [
        r.course ? `(HCC) ${r.course.code}: ${r.course.title}` : "No course",
        r.category?.name,
        r.allowQuantities ? "Quantities: Yes" : "Quantities: No",
      ]
        .filter(Boolean)
        .join(" · "),
    })),
  ];
  return {
    title: "MANAGE COURSE RESOURCES",
    breadcrumbs: ["Home", "Course Resources"],
    archetype: "hccCourseResources",
    primaryAction: "Create Resource",
    primaryActionHref: ADD_COURSE_RESOURCE_PATH,
    secondaryAction: "Create Category",
    secondaryActionHref: ADD_RESOURCE_CATEGORY_PATH,
    hccCourseResources: {
      empty: "No resources currently exist.",
      rows,
      categoryCount: categories.length,
      resourceCount: resources.length,
    },
  };
}

export function buildAddResourceCategoryForm() {
  return {
    title: "ADD COURSE RESOURCE CATEGORY",
    breadcrumbs: ["Home", "Course Resources", "Add Course Resource Category"],
    archetype: "form",
    primaryAction: "Save Resource Category",
    secondaryAction: "Cancel",
    secondaryActionHref: COURSE_RESOURCES_PATH,
    form: {
      submitLabel: "Save Resource Category",
      groups: [
        {
          title: "Resource Category Details",
          fields: [
            { label: "Category Name", value: "", type: "text", language: "English" },
          ],
        },
      ],
    },
  };
}

export async function buildAddCourseResourceForm(institutionId: string) {
  const courseOptions = await listCourseOptions(institutionId);
  return {
    title: "CREATE CONTENT COURSE",
    breadcrumbs: ["Home", "Course Resources", "Add Course Resource"],
    archetype: "form",
    primaryAction: "Save Resource",
    secondaryAction: "Cancel",
    secondaryActionHref: COURSE_RESOURCES_PATH,
    form: {
      submitLabel: "Save Resource",
      groups: [
        {
          title: "Course Content Repository Settings",
          fields: [
            {
              label: "Course",
              value: "",
              type: "select",
              options: courseOptions,
            },
            { label: "Resource Name", value: "", type: "text", language: "English" },
            {
              label: "Allow Resource Quantities",
              value: "No",
              type: "select",
              options: [
                { label: "No", value: "No" },
                { label: "Yes", value: "Yes" },
              ],
            },
          ],
        },
      ],
    },
  };
}

export async function createResourceCategory(institutionId: string, name: string) {
  const trimmed = name.trim() || "Untitled category";
  return prisma.courseResourceCategory.create({
    data: { institutionId, name: trimmed, language: "English" },
  });
}

export async function createCourseResource(
  institutionId: string,
  input: { courseId?: string; name: string; allowQuantities: boolean },
) {
  return prisma.courseResource.create({
    data: {
      institutionId,
      courseId: input.courseId || null,
      name: input.name.trim() || "Untitled resource",
      language: "English",
      allowQuantities: input.allowQuantities,
    },
  });
}

async function programOptionsForBadges(institutionId: string) {
  const programs = await prisma.program.findMany({
    where: { institutionId },
    orderBy: [{ code: "asc" }, { name: "asc" }],
    take: 100,
    select: { code: true, name: true },
  });
  return [
    { label: "All Programs", value: "All Programs" },
    ...programs.map((p) => ({
      label: `${p.code}: ${p.name}`,
      value: p.code,
    })),
  ];
}

export async function listBadgesPayload(institutionId: string) {
  const [badges, awards] = await Promise.all([
    prisma.badgeDefinition.findMany({
      where: { institutionId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.studentBadge.findMany({
      where: { institutionId },
      include: { student: { include: { person: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);
  return {
    title: "BADGES & ACCOMPLISHMENTS",
    breadcrumbs: ["Home", "Badges & Accomplishments"],
    archetype: "hccBadges",
    primaryAction: "Add Badge / Accomplishment",
    primaryActionHref: ADD_BADGE_PATH,
    hccBadges: {
      empty:
        badges.length || awards.length
          ? undefined
          : "No badges / accomplishments were found.",
      definitions: badges.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        badgeType: b.badgeType,
        approvalMode: b.approvalMode,
        status: b.status,
      })),
      rows: awards.map((a) => ({
        id: a.id,
        student: `${a.student.person.givenName} ${a.student.person.familyName}`,
        badge: a.title,
        status: a.status === "earned" ? "Awarded" : a.status === "denied" ? "Denied" : "Pending",
      })),
      badgeOptions: ["All Badges", ...badges.map((b) => b.name)],
      statusOptions: ["Pending", "Awarded", "Denied", "All"],
    },
  };
}

export async function buildAddBadgeFormPayload(institutionId?: string) {
  const programOptions = institutionId
    ? await programOptionsForBadges(institutionId)
    : [
        { label: "All Programs", value: "All Programs" },
        { label: "DAP", value: "DAP" },
        { label: "DIB", value: "DIB" },
      ];
  return {
    title: "ADD BADGE / ACCOMPLISHMENT",
    breadcrumbs: ["Home", "Badges & Accomplishments", "Add Badge / Accomplishment"],
    archetype: "form",
    primaryAction: "Save Badge / Accomplishment",
    secondaryAction: "Cancel",
    secondaryActionHref: BADGES_LIST_PATH,
    form: {
      submitLabel: "Save Badge / Accomplishment",
      groups: [
        {
          title: "Create Base",
          fields: [
            { label: "Name", value: "", type: "text", language: "English" },
            { label: "Description", value: "", type: "textarea", language: "English" },
            { label: "Badge Text", value: "", type: "textarea", language: "English" },
            { label: "Badge Image", value: "", type: "file", language: "English" },
            { label: "Version", value: "", type: "text" },
            {
              label: "Language",
              value: "English",
              type: "select",
              options: [
                { label: "English", value: "English" },
                { label: "French", value: "French" },
              ],
            },
          ],
        },
        {
          title: "Issuer",
          fields: [
            { label: "Issuer Name", value: "Heritage Community College", type: "text" },
            { label: "Contact", value: "", type: "text" },
          ],
        },
        {
          title: "Badge / Accomplishment Settings",
          fields: [
            {
              label: "Badge Approval",
              value: "Instant / Automated",
              type: "select",
              options: [
                { label: "Instant / Automated", value: "Instant / Automated" },
                { label: "Manual review", value: "Manual review" },
              ],
            },
            {
              label: "Badge Type",
              value: "Designation / Academic Performance",
              type: "select",
              options: [
                { label: "Designation / Academic Performance", value: "Designation / Academic Performance" },
                { label: "Participation", value: "Participation" },
                { label: "Skill", value: "Skill" },
              ],
            },
            {
              label: "Program(s)",
              value: "All Programs",
              type: "select",
              options: programOptions,
            },
            {
              label: "Courses Completed",
              value: "Any",
              type: "select",
              options: [
                { label: "Any", value: "Any" },
                { label: "All required", value: "All required" },
              ],
            },
            {
              label: "Terms Completed",
              value: "Any",
              type: "select",
              options: [
                { label: "Any", value: "Any" },
                { label: "Minimum 1", value: "Minimum 1" },
              ],
            },
            {
              label: "Required Average Type",
              value: "None",
              type: "select",
              options: [
                { label: "None", value: "None" },
                { label: "GPA", value: "GPA" },
                { label: "Percent", value: "Percent" },
              ],
            },
          ],
        },
      ],
    },
  };
}

export async function createBadgeDefinition(
  institutionId: string,
  fields: Record<string, string>,
) {
  const name = (fields.Name || "Untitled badge").trim();
  const descriptionParts = [
    (fields.Description || "").trim(),
    fields.Version ? `Version: ${fields.Version.trim()}` : "",
    fields.Language ? `Language: ${fields.Language.trim()}` : "",
    fields["Issuer Name"] ? `Issuer: ${fields["Issuer Name"].trim()}` : "",
    fields.Contact ? `Contact: ${fields.Contact.trim()}` : "",
  ].filter(Boolean);
  return prisma.badgeDefinition.create({
    data: {
      institutionId,
      name,
      description: descriptionParts.join("\n"),
      badgeText: (fields["Badge Text"] || "").trim(),
      imageUrl: (fields["Badge Image"] || "").trim() || null,
      approvalMode: fields["Badge Approval"] || "Instant / Automated",
      badgeType: fields["Badge Type"] || "Designation / Academic Performance",
      programsRule: fields["Program(s)"] || "All Programs",
      coursesRule: fields["Courses Completed"] || "Any",
      termsRule: fields["Terms Completed"] || "Any",
      averageType: fields["Required Average Type"] || "None",
    },
  });
}

export const badgeCodeOf = (definitionId: string) => `BADGE-${definitionId.slice(0, 8).toUpperCase()}`;

/**
 * Issues a badge definition to students as StudentBadge rows. "Instant / Automated" badges are earned at once;
 * any other approval mode leaves them pending for Student Management → Badges / Accomplishments.
 * Students who already earned it are skipped; a pending or declined row is re-issued.
 */
export async function awardBadge(institutionId: string, definitionId: string, studentIds: string[]) {
  const def = await prisma.badgeDefinition.findFirst({ where: { id: definitionId, institutionId } });
  if (!def) throw Object.assign(new Error("Badge not found"), { status: 404, code: "NOT_FOUND" });
  if (def.status !== "active") throw Object.assign(new Error(`${def.name} is not active`), { status: 400, code: "VALIDATION_ERROR" });
  const instant = def.approvalMode === "Instant / Automated";
  const code = badgeCodeOf(def.id);
  const ids = [...new Set(studentIds.filter(Boolean))];
  const existing = new Map(
    (await prisma.studentBadge.findMany({ where: { institutionId, code, studentId: { in: ids } }, select: { id: true, studentId: true, status: true } })).map((b) => [b.studentId, b]),
  );
  const data = {
    title: def.name,
    description: def.badgeText || def.description || null,
    status: instant ? "earned" : "pending",
    earnedAt: instant ? new Date() : null,
  };
  let issued = 0;
  let skipped = 0;
  for (const studentId of ids) {
    const prev = existing.get(studentId);
    if (prev?.status === "earned") {
      skipped += 1;
      continue;
    }
    if (prev) await prisma.studentBadge.update({ where: { id: prev.id }, data: { ...data, rowVersion: { increment: 1 } } });
    else await prisma.studentBadge.create({ data: { institutionId, studentId, code, ...data } });
    issued += 1;
  }
  return { name: def.name, instant, issued, skipped };
}

export function gradeEntriesFromScheme(
  schemeId: string,
  overlay?: Record<string, unknown> | null,
): GradeRow[] {
  const stored = overlay?.schemeGrades as Record<string, GradeRow[]> | undefined;
  if (stored?.[schemeId]?.length) return stored[schemeId]!;
  if (schemeId === "scheme-dib-dap") return DIB_DAP_GRADES.map((g) => ({ ...g }));
  return [];
}
