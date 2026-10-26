import { prisma } from "@myheritage/db";

type Data = Record<string, unknown>;

const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const parse = (json: string): Data => {
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" ? (v as Data) : {};
  } catch {
    return {};
  }
};
const order = (d: Data) => (typeof d._order === "number" ? d._order : Number.MAX_SAFE_INTEGER);

async function records(institutionId: string, screenId: string, where: { contextKey?: string | { in: string[] } } = {}) {
  const rows = await prisma.heritageRecord.findMany({ where: { institutionId, screenId, deletedAt: null, ...where }, orderBy: { createdAt: "asc" } });
  return rows.map((r) => ({ id: r.id, contextKey: r.contextKey, createdAt: r.createdAt, data: parse(r.dataJson) }));
}

/** Program Management records (by id, then by name) and the SIS Program they are synced to. */
async function programFor(institutionId: string, student: { id: string; programName: string; cohort: { programId: string } | null }) {
  const programs = await records(institutionId, "PM:PROGRAM");
  const enrolments = (await records(institutionId, "STU:ENROL", { contextKey: student.id })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const byId = new Map(programs.map((p) => [p.id, p]));
  const name = s(student.programName).trim().toLowerCase();
  const pm =
    enrolments.map((e) => byId.get(s(e.data.programId))).find(Boolean) ??
    (name && name !== "not assigned" ? programs.find((p) => s(p.data.name).trim().toLowerCase() === name || s(p.data.abbreviation).trim().toLowerCase() === name) : undefined);
  let prismaId = s(pm?.data._prismaId) || student.cohort?.programId || "";
  if (!prismaId && name && name !== "not assigned") {
    const match = await prisma.program.findFirst({ where: { institutionId, OR: [{ name: { equals: student.programName.trim(), mode: "insensitive" } }, { code: { equals: student.programName.trim(), mode: "insensitive" } }] } });
    prismaId = match?.id ?? "";
  }
  return { pm, prismaId };
}

/**
 * Courses that make up a Program Management program: the default (or first active major) pathway outline, falling back
 * to the courses scheduled for the program's sessions.
 */
async function outlineCourseIds(institutionId: string, pmProgramId: string) {
  const pathways = await records(institutionId, "PM:PATHWAY", { contextKey: pmProgramId });
  const rank = (d: Data) => (d.defaultOutline === true ? 0 : 2) + (s(d.status) === "Active" ? 0 : 1) + (s(d.type) && s(d.type) !== "Major" ? 4 : 0);
  for (const pathway of pathways.sort((a, b) => rank(a.data) - rank(b.data))) {
    const courses = (await records(institutionId, "PM:PATHWAY_COURSE", { contextKey: pathway.id })).sort((a, b) => order(a.data) - order(b.data));
    const ids = courses.map((c) => s(c.data.course)).filter(Boolean);
    if (ids.length) return { ids: [...new Set(ids)], label: s(pathway.data.abbreviation) || s(pathway.data.name) || "Program Outline" };
  }
  const schedules = (await records(institutionId, "PM:SCHEDULE")).filter((x) => s(x.data.program) === pmProgramId);
  if (!schedules.length) return null;
  const sessions = await records(institutionId, "PM:SESSION", { contextKey: { in: schedules.map((x) => x.id) } });
  const ids = [...new Set(sessions.sort((a, b) => s(a.data.startDate).localeCompare(s(b.data.startDate))).map((x) => s(x.data.course)).filter(Boolean))];
  return ids.length ? { ids, label: "Program Outline" } : null;
}

async function versionFromOutline(institutionId: string, programId: string, outline: { ids: string[]; label: string }) {
  const existing = await prisma.programVersion.findFirst({ where: { institutionId, programId, label: outline.label } });
  if (existing) return existing.id;
  const courses = await prisma.course.findMany({ where: { institutionId, id: { in: outline.ids } }, select: { id: true, code: true, title: true, credits: true } });
  const byId = new Map(courses.map((c) => [c.id, c]));
  const ordered = outline.ids.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c));
  if (!ordered.length) return null;
  const version = await prisma.programVersion.create({
    data: {
      institutionId,
      programId,
      label: outline.label,
      effectiveOn: new Date().toISOString().slice(0, 10),
      totalCredits: ordered.reduce((n, c) => n + c.credits, 0),
      requirements: {
        create: ordered.map((c, i) => ({ institutionId, courseId: c.id, courseCode: c.code, title: c.title, credits: c.credits, kind: "required", sortOrder: i })),
      },
    },
  });
  return version.id;
}

/**
 * The canonical name of a real program (SIS program name / code, or a Program Management program name /
 * abbreviation). Degree progress resolves a student's program from this name, so unknown names are rejected.
 */
export async function knownProgramName(institutionId: string, raw: string) {
  const want = raw.trim().toLowerCase();
  const [programs, pm] = await Promise.all([
    prisma.program.findMany({ where: { institutionId }, select: { code: true, name: true } }),
    records(institutionId, "PM:PROGRAM"),
  ]);
  const local = pm.map((p) => ({ name: s(p.data.name).trim(), abbreviation: s(p.data.abbreviation).trim() })).filter((p) => p.name);
  if (!programs.length && !local.length) return raw.trim();
  const sis = programs.find((p) => p.name.trim().toLowerCase() === want || p.code.trim().toLowerCase() === want);
  if (sis) return sis.name;
  const match = local.find((p) => p.name.toLowerCase() === want || (p.abbreviation && p.abbreviation.toLowerCase() === want));
  if (match) return match.name;
  throw Object.assign(new Error(`Program "${raw.trim()}" was not found. Choose one of the institution's programs.`), { status: 400, code: "VALIDATION_ERROR" });
}

/**
 * Students created or enrolled through Student Management carry a program name and Program Management enrolment, but
 * no ProgramVersion. Resolve one from the synced SIS Program (its latest active version, else one built from the
 * program outline) and link it, so degree progress and what-if planning work for them too.
 */
export async function ensureProgramVersion(institutionId: string, studentId: string, opts: { relink?: boolean } = {}) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, institutionId },
    select: { id: true, programName: true, programVersionId: true, programVersion: { select: { programId: true } }, cohort: { select: { programId: true } } },
  });
  if (!student) return null;
  if (student.programVersionId && !opts.relink) return student.programVersionId;
  const { pm, prismaId } = await programFor(institutionId, student);
  if (!prismaId) return student.programVersionId;
  if (student.programVersionId && student.programVersion?.programId === prismaId) return student.programVersionId;
  const active = await prisma.programVersion.findFirst({ where: { institutionId, programId: prismaId, status: "active", requirements: { some: {} } }, orderBy: { effectiveOn: "desc" } });
  let versionId = active?.id ?? null;
  if (!versionId && pm) {
    const outline = await outlineCourseIds(institutionId, pm.id);
    if (outline) versionId = await versionFromOutline(institutionId, prismaId, outline);
  }
  if (!versionId) return student.programVersionId;
  await prisma.student.update({ where: { id: student.id }, data: { programVersionId: versionId, rowVersion: { increment: 1 } } });
  return versionId;
}
