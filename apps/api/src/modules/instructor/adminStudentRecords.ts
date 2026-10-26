/* Instructor views over admin Student Management records (STU:* heritage records, leave of absence, withdraw requests). */

import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { getTranscriptSummary } from "../academic/program-plan.service.js";
import { studentsInfo, type StudentInfo } from "../admin/heritage/finance.core.js";
import { add, metaOf, rows, s, statusOf, stuAudit, type Row } from "../admin/heritage/students.core.js";
import { caseView, reqView } from "../admin/heritage/students.comms.js";
import { flagView } from "../admin/heritage/students.js";
import { STU } from "../admin/heritage/students.spec.js";
import { sanitizeHtml } from "../admin/heritage/sysconfig.js";

export const INSTRUCTOR_ALERTS_PATH = "/instructor/f/t44-academic-alerts";
export const INSTRUCTOR_FLAGS_PATH = "/instructor/f/t45-student-flags";

type Tone = "danger" | "warning" | "info" | "muted";
type RowTone = Tone | "active" | "success" | "draft";

export type ScopeSection = {
  id: string;
  code: string;
  courseCode: string;
  enrolments: Array<{ studentId: string; status: string }>;
};

export type StudentScope = {
  all: boolean;
  ids: string[];
  sectionIds: string[];
  courses: Map<string, string[]>;
};

export const detailHref = (studentId: string) =>
  `/instructor/f/t22-student-detail-full-page?studentId=${encodeURIComponent(studentId)}`;

export function seesAllStudents(user: SessionClaims) {
  return user.roles.includes("admin") || user.roles.includes("registrar");
}

/** Instructors see students enrolled (any enrolment status) in sections they teach; admin/registrar see every student. */
export function studentScope(user: SessionClaims, sections: ScopeSection[]): StudentScope {
  const courses = new Map<string, string[]>();
  for (const sec of sections) {
    const label = sec.code.startsWith(sec.courseCode) ? sec.code : `${sec.courseCode} ${sec.code}`;
    for (const e of sec.enrolments) {
      const list = courses.get(e.studentId) ?? [];
      if (!list.includes(label)) list.push(label);
      courses.set(e.studentId, list);
    }
  }
  return { all: seesAllStudents(user), ids: [...courses.keys()], sectionIds: sections.map((x) => x.id), courses };
}

const inScope = (scope: StudentScope, studentId: string) => scope.all || scope.courses.has(studentId);

async function scopedRows(inst: string, screen: string, scope: StudentScope): Promise<Row[]> {
  if (scope.all) return rows(inst, screen);
  return scope.ids.length ? rows(inst, screen, scope.ids) : [];
}

const studentWhere = (scope: StudentScope) => (scope.all ? {} : { studentId: { in: scope.ids } });

const studentCell = (info: StudentInfo | undefined) => (info ? `${info.name} · ${info.number}` : "Unknown student");
const courseCell = (scope: StudentScope, info: StudentInfo | undefined, id: string) =>
  scope.courses.get(id)?.join(", ") || info?.program || "—";
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
const day = (v: string | Date | null | undefined) => {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10);
};

export function plainText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMeta(text: string | null): Record<string, unknown> {
  if (!text) return {};
  try {
    const v = JSON.parse(text) as unknown;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/* Same buckets as admin Student Management › Leave of Absence / Course Withdraw Requests queues (students.queues.ts). */
export function loaStatus(status: string, startsOn: string, endsOn: string) {
  const st = status.toLowerCase();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.INSTITUTION_TZ || "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  if (st === "pending") return "Pending";
  if (["rejected", "declined"].includes(st)) return "Declined";
  if (["approved", "applied", "active"].includes(st)) {
    if (endsOn && endsOn < today) return "Completed";
    if (startsOn && startsOn > today) return "Approved";
    return "Active";
  }
  if (st === "completed") return "Completed";
  return status;
}

export function withdrawStatus(status: string) {
  const st = status.toLowerCase();
  if (["open", "pending", "submitted", "in_review"].includes(st)) return "Pending";
  if (["resolved", "approved", "completed"].includes(st)) return "Approved";
  if (["rejected", "declined"].includes(st)) return "Declined";
  return status;
}

const WITHDRAW_TYPE = { contains: "withdraw", mode: "insensitive" as const };

function statusTone(status: string): RowTone {
  if (/declin|reject|denied|unmet|missing/i.test(status)) return "danger";
  if (/pending|review|no response|open/i.test(status)) return "warning";
  if (/approv|complete|active|met|submitted/i.test(status)) return "success";
  return "muted";
}

function alertTone(data: Record<string, unknown>): Tone {
  const hint = `${s(data.priority)} ${s(data.type)}`;
  if (/high|danger|risk/i.test(hint)) return "danger";
  if (/low|info|success/i.test(hint)) return "info";
  return "warning";
}

/** Matches the admin Academic Alerts queue default filter (Status Active, Resolved No). */
const isOpenAlert = (r: Row) => (s(r.data.status) || "Active") === "Active" && (s(r.data.resolved) || "No") === "No";

function countSummary(statuses: string[]) {
  const by = new Map<string, number>();
  for (const st of statuses) by.set(st, (by.get(st) ?? 0) + 1);
  return [...by.entries()].map(([k, n]) => `${n} ${k.toLowerCase()}`).join(" · ");
}

function emptyQueue(title: string, crumbs: string[], empty: string) {
  return { title, breadcrumbs: crumbs, archetype: "hccEmpty", hccEmpty: { empty } };
}

function tableQueue(
  title: string,
  noun: string,
  rowsOut: Array<{ cells: string[]; badge?: string; badgeTone?: RowTone; href?: string }>,
  statuses: string[],
) {
  return {
    title,
    archetype: "table",
    rows: rowsOut,
    countLabel: `${rowsOut.length} ${noun}(s)${statuses.length ? ` · ${countSummary(statuses)}` : ""}`,
  };
}

/* ------------------------------------------------------------------ */
/* Academic Alerts (STU:ALERT + unlinked legacy instructor alerts)      */
/* ------------------------------------------------------------------ */

type AlertItem = {
  id: string;
  studentId: string;
  name: string;
  course: string;
  tag: string;
  tagTone: Tone;
  body: string;
  avatar: string;
  href?: string;
  createdAt: Date;
};

/** Instructor-created alerts saved before they were mirrored into STU:ALERT. */
async function legacyPortalAlerts(inst: string, linked: Set<string>) {
  const recs = await prisma.portalRecord.findMany({
    where: { institutionId: inst, screenPath: INSTRUCTOR_ALERTS_PATH, role: "instructor" },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return recs
    .filter((r) => !linked.has(r.id))
    .map((r) => ({ r, meta: parseMeta(r.metaText) }))
    .filter((x) => s(x.meta.studentId));
}

async function loadAlertItems(user: SessionClaims, scope: StudentScope, onlyStudent?: string): Promise<AlertItem[]> {
  const inst = user.institutionId;
  const records = onlyStudent ? await rows(inst, STU.ALERT, onlyStudent) : await scopedRows(inst, STU.ALERT, scope);
  const linked = new Set(records.map((r) => s(r.data.portalRecordId)).filter(Boolean));
  const open = records.filter(isOpenAlert);
  const legacy = (await legacyPortalAlerts(inst, linked)).filter((x) => {
    const sid = s(x.meta.studentId);
    return onlyStudent ? sid === onlyStudent : inScope(scope, sid);
  });
  const info = await studentsInfo(inst, [...new Set([...open.map((r) => r.contextKey), ...legacy.map((x) => s(x.meta.studentId))])]);
  const items: AlertItem[] = [
    ...open.map((r) => {
      const st = info.get(r.contextKey);
      const name = st?.name ?? "Unknown student";
      return {
        id: r.id,
        studentId: r.contextKey,
        name,
        course: [st?.number, courseCell(scope, st, r.contextKey)].filter(Boolean).join(" · "),
        tag: (s(r.data.type) || "ACADEMIC ALERT").toUpperCase(),
        tagTone: alertTone(r.data),
        body: plainText(s(r.data.description)),
        avatar: initials(name),
        href: detailHref(r.contextKey),
        createdAt: r.createdAt,
      };
    }),
    ...legacy.map(({ r, meta }) => {
      const sid = s(meta.studentId);
      const st = info.get(sid);
      const name = st?.name ?? r.primaryText;
      return {
        id: r.id,
        studentId: sid,
        name,
        course: [st?.number, s(meta.course) || courseCell(scope, st, sid)].filter(Boolean).join(" · "),
        tag: (s(meta.tag) || "ACADEMIC ALERT").toUpperCase(),
        tagTone: alertTone({ priority: meta.priority ?? meta.tagTone, type: meta.tag }),
        body: r.secondaryText ?? "",
        avatar: initials(name),
        href: detailHref(sid),
        createdAt: r.createdAt,
      };
    }),
  ];
  return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function buildInstructorAlertQueue(user: SessionClaims, sections: ScopeSection[]) {
  const items = (await loadAlertItems(user, studentScope(user, sections))).map(({ studentId: _s, createdAt: _c, ...item }) => item);
  return {
    title: "Academic Alerts",
    subtitle: `${items.length} active student${items.length === 1 ? "" : "s"}`,
    archetype: "alertList",
    primaryAction: "Create alert",
    alertList: { badge: `${items.length} ACTIVE`, items },
    countLabel: `${items.length} alert(s)`,
  };
}

export async function instructorAlertCount(user: SessionClaims, sections: ScopeSection[]) {
  return (await loadAlertItems(user, studentScope(user, sections))).length;
}

/* ------------------------------------------------------------------ */
/* Student Assessments (STU:ASSESS)                                     */
/* ------------------------------------------------------------------ */

export async function buildInstructorAssessmentQueue(user: SessionClaims, sections: ScopeSection[]) {
  const inst = user.institutionId;
  const scope = studentScope(user, sections);
  const list = (await scopedRows(inst, STU.ASSESS, scope)).map(caseView).sort((a, b) => b.date.localeCompare(a.date));
  if (!list.length) return emptyQueue("STUDENT ASSESSMENTS", ["Home", "Student Assessments"], "No assessments were found.");
  const info = await studentsInfo(inst, [...new Set(list.map((c) => c.studentId))]);
  return tableQueue(
    "Student Assessments",
    "assessment",
    list.map((c) => {
      const st = info.get(c.studentId);
      return {
        cells: [studentCell(st), courseCell(scope, st, c.studentId), `#${c.number} · ${c.assessment}`, c.status, "—", c.advisor ? `Advisor: ${c.advisor}` : "Advisor: Unassigned"],
        href: detailHref(c.studentId),
      };
    }),
    list.map((c) => c.status),
  );
}

/* ------------------------------------------------------------------ */
/* Student Requirements (STU:REQ)                                       */
/* ------------------------------------------------------------------ */

async function requirementViews(inst: string, list: Row[]) {
  const taskIds = list.map((r) => s(r.data.taskId)).filter(Boolean);
  const done = new Set(
    (taskIds.length
      ? await prisma.requiredTask.findMany({ where: { institutionId: inst, id: { in: taskIds }, completedAt: { not: null } }, select: { id: true } })
      : []
    ).map((t) => t.id),
  );
  return list.map((r) => reqView(r, done.has(s(r.data.taskId)))).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

export async function buildInstructorRequirementQueue(user: SessionClaims, sections: ScopeSection[]) {
  const inst = user.institutionId;
  const scope = studentScope(user, sections);
  const list = await requirementViews(inst, await scopedRows(inst, STU.REQ, scope));
  if (!list.length) return emptyQueue("STUDENT REQUIREMENTS", ["Home", "Student Requirements"], "No requirement requests were found.");
  const info = await studentsInfo(inst, [...new Set(list.map((r) => r.studentId))]);
  return tableQueue(
    "Student Requirements",
    "requirement",
    list.map((r) => ({
      cells: [
        studentCell(info.get(r.studentId)),
        r.name,
        r.dataType || "—",
        day(r.expiryDate) || "—",
        r.status,
        r.submittedAt ? `${r.submission} · ${day(r.submittedAt)}` : r.submission,
      ],
      href: detailHref(r.studentId),
    })),
    list.map((r) => r.status),
  );
}

/* ------------------------------------------------------------------ */
/* Leave of Absence (LeaveOfAbsenceRequest)                             */
/* ------------------------------------------------------------------ */

export async function buildInstructorLeaveQueue(user: SessionClaims, sections: ScopeSection[]) {
  const inst = user.institutionId;
  const scope = studentScope(user, sections);
  const loas =
    scope.all || scope.ids.length
      ? await prisma.leaveOfAbsenceRequest.findMany({ where: { institutionId: inst, ...studentWhere(scope) }, orderBy: { createdAt: "desc" }, take: 2000 })
      : [];
  if (!loas.length) return emptyQueue("LEAVE OF ABSENCE", ["Home", "Leave of Absence"], "No leave of absence students were found.");
  const info = await studentsInfo(inst, [...new Set(loas.map((l) => l.studentId))]);
  const mapped = loas.map((l) => ({ l, status: loaStatus(l.status, l.startsOn, l.endsOn) }));
  return tableQueue(
    "Leave of Absence (LOA)",
    "leave request",
    mapped.map(({ l, status }) => {
      const st = info.get(l.studentId);
      return {
        cells: [studentCell(st), st?.program || "—", l.reason || "—", day(l.startsOn) || "—", day(l.endsOn) || "—", status],
        badge: status,
        badgeTone: statusTone(status),
        href: detailHref(l.studentId),
      };
    }),
    mapped.map((x) => x.status),
  );
}

/* ------------------------------------------------------------------ */
/* Course Withdraw Requests (ServiceRequest type *withdraw*)            */
/* ------------------------------------------------------------------ */

export async function buildInstructorWithdrawQueue(
  user: SessionClaims,
  sections: ScopeSection[],
  grades: Array<{ studentId: string; courseCode: string; score: number | null; maxScore: number }>,
) {
  const inst = user.institutionId;
  const scope = studentScope(user, sections);
  const list =
    scope.all || scope.ids.length
      ? await prisma.serviceRequest.findMany({ where: { institutionId: inst, type: WITHDRAW_TYPE, ...studentWhere(scope) }, orderBy: { createdAt: "desc" }, take: 2000 })
      : [];
  if (!list.length) return emptyQueue("COURSE WITHDRAW REQUESTS", ["Home", "Course Withdraw Requests"], "No course withdraw requests were found.");
  const ids = [...new Set(list.map((r) => r.studentId))];
  const [info, attendance] = await Promise.all([
    studentsInfo(inst, ids),
    scope.sectionIds.length
      ? prisma.attendanceRecord.findMany({ where: { institutionId: inst, studentId: { in: ids }, sectionId: { in: scope.sectionIds } }, select: { studentId: true, status: true } })
      : Promise.resolve([] as Array<{ studentId: string; status: string }>),
  ]);
  const myCourses = [...new Set(sections.map((x) => x.courseCode))];
  const mapped = list.map((r) => {
    const st = info.get(r.studentId);
    const text = `${r.subject} ${r.details}`.toUpperCase();
    const course = myCourses.find((c) => text.includes(c.toUpperCase()));
    const scored = grades.filter((g) => g.studentId === r.studentId && (!course || g.courseCode === course) && g.score != null && g.maxScore > 0);
    const grade = scored.length ? `${Math.round((scored.reduce((n, g) => n + (g.score ?? 0) / g.maxScore, 0) / scored.length) * 1000) / 10}%` : "—";
    const att = attendance.filter((a) => a.studentId === r.studentId);
    const attPct = att.length ? `${Math.round((att.filter((a) => /present|late/i.test(a.status)).length / att.length) * 100)}%` : "—";
    const status = withdrawStatus(r.status);
    return {
      status,
      row: {
        cells: [studentCell(st), course ?? courseCell(scope, st, r.studentId), `${status} · ${r.subject || r.type}`, r.details || "—", grade, attPct],
        href: detailHref(r.studentId),
      },
    };
  });
  return tableQueue(
    "Withdraw Requests",
    "withdraw request",
    mapped.map((x) => x.row),
    mapped.map((x) => x.status),
  );
}

/* ------------------------------------------------------------------ */
/* Student detail (admin status / CGPA / flags / alerts / reqs / leave) */
/* ------------------------------------------------------------------ */

type DetailFlag = { title: string; body: string; when: string; tone: Tone };

/** Flags that only exist in the instructor portal (Create Flag before STU:FLAG mirroring). */
async function legacyInstructorFlags(inst: string, student: { studentNumber: string; studentName: string }): Promise<DetailFlag[]> {
  const matches = (label: string) => Boolean(label) && (label.includes(student.studentNumber) || label.includes(student.studentName));
  const [portal, overlay] = await Promise.all([
    prisma.portalRecord.findMany({ where: { institutionId: inst, screenPath: INSTRUCTOR_FLAGS_PATH, role: "instructor" }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.sisScreenState.findUnique({ where: { institutionId_path: { institutionId: inst, path: INSTRUCTOR_FLAGS_PATH } } }),
  ]);
  const out: DetailFlag[] = [];
  for (const r of portal) {
    if (!matches(r.primaryText)) continue;
    const meta = parseMeta(r.metaText);
    out.push({
      title: `${(r.secondaryText || "Student flag").toUpperCase()}${s(meta.hold) === "Yes" ? " · HOLD" : ""}`,
      body: `Instructor flag · ${s(meta.status) || "Unresolved"}`,
      when: s(meta.date) || day(r.createdAt),
      tone: s(meta.hold) === "Yes" ? "danger" : "warning",
    });
  }
  const extra = overlay ? parseMeta(overlay.payloadJson).extraRows : undefined;
  for (const row of Array.isArray(extra) ? (extra as Array<{ cells?: unknown; badgeTone?: unknown }>) : []) {
    const cells = Array.isArray(row.cells) ? row.cells.map((c) => s(c)) : [];
    if (!matches(cells[0] ?? "")) continue;
    out.push({
      title: (cells[1] || "Student flag").toUpperCase(),
      body: cells[2] || "Flag recorded from instructor workspace.",
      when: `Instructor flag · ${cells[3] || "—"} priority · ${cells[4] || "Active"}`,
      tone: s(row.badgeTone) === "danger" ? "danger" : s(row.badgeTone) === "warning" ? "warning" : "info",
    });
  }
  return out;
}

export async function loadStudentAdminDetail(user: SessionClaims, student: { studentId: string; studentNumber: string; studentName: string }) {
  const inst = user.institutionId;
  const id = student.studentId;
  const scope: StudentScope = { all: true, ids: [id], sectionIds: [], courses: new Map() };
  const [row, meta, transcript, flagRows, alerts, reqRows, loas, withdraws, legacyFlags] = await Promise.all([
    prisma.student.findFirst({ where: { id, institutionId: inst }, select: { _count: { select: { enrolments: { where: { status: "enrolled" } } } } } }),
    metaOf(inst, id),
    getTranscriptSummary(inst, id).catch(() => null),
    rows(inst, STU.FLAG, id),
    loadAlertItems(user, scope, id),
    rows(inst, STU.REQ, id),
    prisma.leaveOfAbsenceRequest.findMany({ where: { institutionId: inst, studentId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.serviceRequest.findMany({ where: { institutionId: inst, studentId: id, type: WITHDRAW_TYPE }, orderBy: { createdAt: "desc" }, take: 50 }),
    legacyInstructorFlags(inst, student),
  ]);

  const flagList = flagRows.map(flagView).sort((a, b) => b.date.localeCompare(a.date));
  const openFlags = flagList.filter((f) => f.status === "Active" && f.resolved !== "Yes");
  const adminFlagKeys = new Set(flagList.map((f) => `${f.name}|${plainText(f.message)}`.toLowerCase()));
  const flags: DetailFlag[] = [
    ...flagList.map((f) => {
      const open = f.status === "Active" && f.resolved !== "Yes";
      return {
        title: `${f.name.toUpperCase()}${f.applyHold === "Yes" ? " · HOLD" : ""}`,
        body: plainText(f.message) || "—",
        when: `${day(f.date)} · ${f.status}${f.resolved === "Yes" ? " · Resolved" : ""}`,
        tone: (open ? (f.applyHold === "Yes" ? "danger" : "warning") : "muted") as Tone,
      };
    }),
    ...alerts.map((a) => ({ title: `ACADEMIC ALERT · ${a.tag}`, body: a.body || "—", when: day(a.createdAt), tone: a.tagTone })),
    ...legacyFlags.filter((f) => !adminFlagKeys.has(`${f.title}|${f.body}`.toLowerCase())),
  ];

  const requirements = (await requirementViews(inst, reqRows)).map((r) => ({
    code: r.dataType || "Requirement",
    title: r.name,
    credits: "—",
    kind: [r.submission, r.expiryDate ? `expires ${day(r.expiryDate)}` : ""].filter(Boolean).join(" · "),
    status: r.status,
  }));

  const leave = [
    ...loas.map((l) => ({
      title: `Leave of absence · ${day(l.startsOn) || "—"} → ${day(l.endsOn) || "—"}`,
      body: l.reason || "—",
      status: loaStatus(l.status, l.startsOn, l.endsOn),
      when: day(l.createdAt),
    })),
    ...withdraws.map((r) => ({
      title: r.subject || "Course withdraw request",
      body: r.details || "—",
      status: withdrawStatus(r.status),
      when: day(r.createdAt),
    })),
  ];

  return {
    status: statusOf(meta, row?._count.enrolments ?? 0),
    cgpa: transcript?.cgpa ?? null,
    openFlagCount: openFlags.length,
    holdCount: openFlags.filter((f) => f.applyHold === "Yes").length,
    alerts: alerts.map((a) => ({ title: a.tag, body: a.body || "—", tone: a.tagTone })),
    flags,
    requirements,
    leave,
  };
}

/* ------------------------------------------------------------------ */
/* Instructor writes mirrored into admin records                        */
/* ------------------------------------------------------------------ */

export async function recordAdminAlert(
  user: SessionClaims,
  input: { studentId: string; type: string; description: string; priority: string; course?: string | null; portalRecordId?: string | null },
) {
  const description = sanitizeHtml(input.description.slice(0, 20000));
  const rec = await add(
    user,
    STU.ALERT,
    {
      description,
      type: input.type,
      priority: input.priority,
      course: input.course ?? "",
      status: "Active",
      resolved: "No",
      source: "instructor",
      portalRecordId: input.portalRecordId ?? "",
      date: new Date().toISOString(),
    },
    input.studentId,
  );
  await stuAudit(user, "Profile Changes", input.studentId, "Academic alert added", { Type: input.type, Description: description, Priority: input.priority, Source: "Instructor portal" }, rec.id);
  return rec;
}

export async function recordAdminFlag(user: SessionClaims, input: { studentId: string; name: string; message: string; priority: string }) {
  const name = input.name.trim().slice(0, 200) || "Student flag";
  const message = sanitizeHtml(input.message.slice(0, 20000));
  const applyHold = /hold/i.test(name) ? "Yes" : "No";
  const rec = await add(
    user,
    STU.FLAG,
    { name, message, applyHold, resolved: "No", status: "Active", templateId: "", priority: input.priority, source: "instructor", date: new Date().toISOString() },
    input.studentId,
  );
  await stuAudit(user, "Profile Changes", input.studentId, "Flag / hold added", { "Flag Name": name, Message: message, "Applies Hold": applyHold, Source: "Instructor portal" }, rec.id);
  return rec;
}
