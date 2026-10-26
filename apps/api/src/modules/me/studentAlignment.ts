/* Student-portal readers that reuse the admin Student Management sources (student-meta status, transcript CGPA, Flags & Holds, dashboard content blocks). */

import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { getTranscriptSummary } from "../academic/program-plan.service.js";
import { loadProfile, rows, statusOf, type StudentMetaRow } from "../admin/heritage/students.core.js";
import { STU } from "../admin/heritage/students.spec.js";
import { flagView } from "../admin/heritage/students.js";
import { effectiveAccess, studentMetaMap } from "../admin/superAdmin.service.js";

/* ------------------------------------------------------------------ */
/* Current program profile                                              */
/* ------------------------------------------------------------------ */

const CURRENT_STATUSES = new Set(["Active Student", "Registered Student"]);

/**
 * Admin "New Program Profile" adds another Student row for the same person, so a person can own several.
 * Pick deterministically: never a "Duplicate profiles" row if another exists, then the profile with live
 * enrolments, then one whose admin status is Active/Registered, then the most recently created.
 */
export async function currentStudent(institutionId: string, personId: string) {
  const candidates = await prisma.student.findMany({
    where: { institutionId, personId },
    include: { _count: { select: { enrolments: { where: { status: "enrolled" } } } } },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  if (candidates.length <= 1) return candidates[0] ?? null;
  const meta = await studentMetaMap(institutionId);
  const tier = (st: (typeof candidates)[number]) => {
    const status = statusOf((meta[st.id] ?? {}) as StudentMetaRow, st._count.enrolments);
    if (status === "Duplicate profiles") return 0;
    if (st._count.enrolments > 0) return 3;
    if (CURRENT_STATUSES.has(status)) return 2;
    return 1;
  };
  return [...candidates].sort((a, b) => tier(b) - tier(a))[0] ?? null;
}

export async function currentStudentId(institutionId: string, personId: string) {
  return (await currentStudent(institutionId, personId))?.id ?? "";
}

export async function personStudentIds(institutionId: string, personId: string) {
  const list = await prisma.student.findMany({
    where: { institutionId, personId },
    select: { id: true, studentNumber: true },
    orderBy: { createdAt: "asc" },
  });
  return list;
}

/* ------------------------------------------------------------------ */
/* Status + CGPA exactly as the admin student header shows them         */
/* ------------------------------------------------------------------ */

export async function adminStatusAndCgpa(institutionId: string, studentId: string) {
  const [metaMap, enrolled, transcript] = await Promise.all([
    studentMetaMap(institutionId),
    prisma.enrolment.count({ where: { institutionId, studentId, status: "enrolled" } }),
    getTranscriptSummary(institutionId, studentId).catch(() => null),
  ]);
  const meta = (metaMap[studentId] ?? {}) as StudentMetaRow;
  return { status: statusOf(meta, enrolled), cgpa: transcript?.cgpa ?? null, meta, enrolled };
}

/* ------------------------------------------------------------------ */
/* Flags & Holds                                                        */
/* ------------------------------------------------------------------ */

export function htmlToText(html: string) {
  return html
    .replace(/<(br|\/p|\/div|\/li|\/h\d)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** Active, unresolved admin flags for the given student rows (same rule as the admin Flags & Holds queue count). */
export async function activeFlags(institutionId: string, studentIds: string[]) {
  if (!studentIds.length) return [];
  const list = (await rows(institutionId, STU.FLAG, studentIds)).map(flagView);
  return list
    .filter((f) => f.status === "Active" && f.resolved !== "Yes")
    .map((f) => ({ ...f, isHold: f.applyHold === "Yes", messageText: htmlToText(f.message) }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function assertNoActiveStudentHold(institutionId: string, studentId: string, action: string) {
  const hold = (await activeFlags(institutionId, [studentId])).find((flag) => flag.isHold);
  if (hold) {
    throw Object.assign(new Error(`${action} is blocked by the active hold “${hold.name}”. Resolve or dismiss the hold first.`), {
      code: "STUDENT_HOLD",
      status: 409,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Admin dashboard content blocks (Dashboard › Content Blocks)          */
/* ------------------------------------------------------------------ */

const BLOCK_SCREEN = "DASH:BLOCK";
const SCOPE_KEYS = ["campus", "status", "program", "rate", "nationality", "advisor"] as const;
type ScopeKey = (typeof SCOPE_KEYS)[number];
type Scope = { mode: "all" | "select"; values: string[] };

const str = (v: unknown) => (typeof v === "string" ? v : "");

function parseJson(json: string): Record<string, unknown> {
  try {
    const v = JSON.parse(json) as unknown;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function vancouverToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Vancouver", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export type StudentAnnouncement = { id: string; title: string; body: string; content: string; updatedAt: string; source: "admin" };

/**
 * Blocks the admin dashboard would show this student: Active, inside the timeframe, open to "Everyone" or to the
 * student's access level, and — when the admin narrowed Student Access Settings — matching campus / status /
 * program / rate category / nationality / advisor.
 */
export async function studentAnnouncements(user: SessionClaims, studentId: string | null): Promise<StudentAnnouncement[]> {
  const inst = user.institutionId;
  const records = await prisma.heritageRecord.findMany({
    where: { institutionId: inst, screenId: BLOCK_SCREEN, deletedAt: null, singletonKey: null },
    orderBy: { createdAt: "asc" },
  });
  if (!records.length) return [];
  const access = await effectiveAccess(inst, user.accountId);
  const level = access.accessLevel ?? "";
  const day = vancouverToday();

  const blocks = records
    .map((r) => {
      const d = parseJson(r.dataJson);
      const rawScopes = (d.studentAccess ?? {}) as Record<string, unknown>;
      const scopes = Object.fromEntries(
        SCOPE_KEYS.map((k) => {
          const v = (rawScopes[k] ?? {}) as Record<string, unknown>;
          const values = Array.isArray(v.values) ? v.values.map(String) : [];
          return [k, { mode: v.mode === "select" && values.length ? "select" : "all", values } as Scope];
        }),
      ) as Record<ScopeKey, Scope>;
      return {
        id: r.id,
        name: str(d.name),
        content: str(d.content),
        status: str(d.status) || "Active",
        timeframe: str(d.timeframe) || "Immediately",
        startDate: str(d.startDate),
        endDate: str(d.endDate),
        access: str(d.access) || "Everyone",
        accessLevels: Array.isArray(d.accessLevels) ? d.accessLevels.map(String) : [],
        scopes,
        order: typeof d._order === "number" ? d._order : Number.MAX_SAFE_INTEGER,
        updatedAt: r.updatedAt.toISOString(),
      };
    })
    .filter((b) => {
      if (b.status !== "Active") return false;
      if (b.timeframe !== "Immediately") {
        if (b.startDate && day < b.startDate) return false;
        if (b.endDate && day > b.endDate) return false;
      }
      return b.access === "Everyone" || b.accessLevels.includes(level);
    })
    .sort((a, b) => a.order - b.order);

  const scoped = blocks.filter((b) => b.access !== "Everyone" && SCOPE_KEYS.some((k) => b.scopes[k].mode === "select"));
  let facts: Record<ScopeKey, string[]> | null = null;
  if (scoped.length) {
    if (!studentId) return blocks.filter((b) => !scoped.includes(b)).map(present);
    const st = await prisma.student.findFirst({ where: { id: studentId, institutionId: inst }, include: { cohort: true } });
    const { status, meta } = await adminStatusAndCgpa(inst, studentId);
    const profile = await loadProfile(inst, studentId);
    const advisors = profile.advisors.length
      ? await prisma.account.findMany({ where: { id: { in: profile.advisors }, institutionId: inst }, include: { person: true } })
      : [];
    facts = {
      campus: [meta.campus ?? st?.cohort?.campus ?? ""],
      status: [status],
      program: [st?.programName ?? ""],
      rate: [meta.rateCategory ?? ""],
      nationality: [meta.country ?? ""],
      advisor: advisors.map((a) => `${a.person.givenName} ${a.person.familyName}`),
    };
  }
  const matches = (b: (typeof blocks)[number]) =>
    b.access === "Everyone" ||
    !facts ||
    SCOPE_KEYS.every((k) => b.scopes[k].mode === "all" || facts![k].some((v) => v && b.scopes[k].values.includes(v)));

  return blocks.filter(matches).map(present);

  function present(b: (typeof blocks)[number]): StudentAnnouncement {
    const text = htmlToText(b.content).replace(/\n+/g, " ");
    return {
      id: `dash:${b.id}`,
      title: b.name,
      body: text.length > 400 ? `${text.slice(0, 397)}…` : text,
      content: b.content,
      updatedAt: b.updatedAt,
      source: "admin",
    };
  }
}

/* ------------------------------------------------------------------ */
/* Course content progress (same items + store as /student/courses/:id/content) */
/* ------------------------------------------------------------------ */

export async function contentProgress(user: SessionClaims, studentId: string) {
  const enrolments = await prisma.enrolment.findMany({
    where: { institutionId: user.institutionId, studentId, status: "enrolled" },
    include: {
      section: {
        include: {
          course: true,
          term: true,
          assignments: { orderBy: { dueAt: "asc" } },
          classSessions: { orderBy: { startsAt: "asc" } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  if (!enrolments.length) return [];
  const states = await prisma.sisScreenState.findMany({
    where: {
      institutionId: user.institutionId,
      path: { in: enrolments.map((e) => `/student/content-progress/${user.accountId}/${e.sectionId}`) },
    },
  });
  const completedBySection = new Map(
    states.map((s) => {
      let done: string[] = [];
      try {
        done = (JSON.parse(s.payloadJson) as { completed?: string[] }).completed ?? [];
      } catch {
        done = [];
      }
      return [s.path.split("/").pop() ?? "", new Set(done)];
    }),
  );
  return enrolments.map((e) => {
    const done = completedBySection.get(e.sectionId) ?? new Set<string>();
    const items = [
      ...e.section.classSessions.map((s) => ({
        id: `session:${s.id}`,
        kind: s.sessionKind === "lab" ? "Lab" : "Lecture",
        title: s.title,
        when: s.startsAt,
        href: s.sessionKind === "lab" ? "/student/labs" : `/student/f/st-11-lecture-detail?sessionId=${s.id}`,
      })),
      ...e.section.assignments.map((a) => ({
        id: `assignment:${a.id}`,
        kind: "Assignment",
        title: a.title,
        when: a.dueAt,
        href: `/student/assignments/${a.id}`,
      })),
    ].map((i) => ({ ...i, completed: done.has(i.id) }));
    const completedCount = items.filter((i) => i.completed).length;
    return {
      sectionId: e.sectionId,
      courseCode: e.section.course.code,
      courseTitle: e.section.course.title,
      sectionCode: e.section.code,
      termCode: e.section.term.code,
      items,
      completedCount,
      totalCount: items.length,
      progressPct: items.length ? Math.round((completedCount / items.length) * 100) : null,
      next: items.find((i) => !i.completed) ?? null,
    };
  });
}
