import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { buildXlsx, type XlsxCell } from "../../../lib/xlsx.js";
import { mailConfigured, sendMailViaHumanitix } from "../../../lib/mailer.js";
import { assertPermission, canEdit, effectiveAccess, studentMetaMap } from "../superAdmin.service.js";
import { audit, refs } from "./service.js";

/* ------------------------------------------------------------------ */
/* Vocabulary captured from the Reporting screens                       */
/* ------------------------------------------------------------------ */

const SCREEN = { category: "RPT:CATEGORY", template: "RPT:TEMPLATE", schedule: "RPT:SCHEDULE", run: "RPT:RUN", seed: "RPT:SEED" } as const;

export const REPORT_GROUPS = ["Student / User Reports", "Course Reports", "Financial Reports", "System / Mics Reports"] as const;
type ReportGroup = (typeof REPORT_GROUPS)[number];
export const EXPORT_TYPES = ["Excel", "CSV"] as const;
export const SEPARATE_BY = ["Report Type", "Program", "Campus", "Term", "Status"] as const;
export const AVAILABLE_TO = ["All Staff", "Administrators Only", "Only Me"] as const;
export const LANGUAGES = ["English", "French"] as const;
export const GRAPH_TYPES = ["None", "Bar", "Pie", "Line"] as const;
export const DATE_PRESETS = ["Custom", "Today", "Yesterday", "This Week", "Last Week", "This Month", "Last Month", "Last 30 Days", "This Year"] as const;
export const FREQUENCIES = ["Daily", "Weekly", "Monthly"] as const;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type FilterKey = "showTotals" | "programs" | "pathways" | "campus" | "schedules" | "term" | "course" | "status" | "country" | "rateCategories";
export const FILTERS: Record<FilterKey, { label: string; all: string; option?: string }> = {
  showTotals: { label: "Show Totals", all: "No" },
  programs: { label: "Specify Programs", all: "All Programs", option: "programs" },
  pathways: { label: "Specify Pathways", all: "All Pathways", option: "pathways" },
  campus: { label: "Specify Campus", all: "All Campuses", option: "campuses" },
  schedules: { label: "Specify Schedules", all: "All Schedules", option: "schedules" },
  term: { label: "Specify Term", all: "All Terms", option: "terms" },
  course: { label: "Specify Course", all: "All Courses", option: "courses" },
  status: { label: "Specify Status", all: "All Statuses", option: "statuses" },
  country: { label: "Specify Country", all: "All Countries", option: "countries" },
  rateCategories: { label: "Specify Rate Categories", all: "All Rate Categories", option: "rateCategories" },
};
export const FILTER_ORDER: FilterKey[] = ["showTotals", "programs", "pathways", "campus", "schedules", "term", "course", "status", "country", "rateCategories"];
const DIM: Record<Exclude<FilterKey, "showTotals">, string> = {
  programs: "_program",
  pathways: "_pathway",
  campus: "_campus",
  schedules: "_schedule",
  term: "_term",
  course: "_course",
  status: "_status",
  country: "_country",
  rateCategories: "_rate",
};
const SEPARATE_DIM: Record<string, string> = { Program: "_program", Campus: "_campus", Term: "_term", Status: "_status" };

type Col = { key: string; label: string; numeric?: boolean };
type Cell = string | number;
type Dim = string | string[];
type SourceRow = Record<string, Cell | Dim | Date | undefined> & { _date?: Date };
type Range = { from: Date; to: Date } | null;

const STUDENT_DIMS: FilterKey[] = ["programs", "pathways", "campus", "schedules", "term", "course", "status", "country", "rateCategories"];
const FINANCE_DIMS: FilterKey[] = ["programs", "pathways", "campus", "schedules", "term", "status", "country", "rateCategories"];

type SourceKey = "students" | "attendance" | "attendanceSummary" | "enrolments" | "finalMarks" | "balances" | "financialFlags" | "ledger" | "audit" | "userActivity" | "agents";
type SourceDef = { label: string; groups: ReportGroup[]; filters: FilterKey[]; conditionsTitle: string; columns: Col[]; load: (inst: string, range: Range) => Promise<SourceRow[]> };

const STUDENT_COLS: Col[] = [
  { key: "studentNumber", label: "Student #" },
  { key: "studentName", label: "Student Name" },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function httpError(status: number, message: string, code = "VALIDATION_ERROR") {
  return Object.assign(new Error(message), { status, code });
}
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
const stamp = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 16).replace("T", " ") : "");
const money = (n: number) => Math.round(n * 100) / 100;
const parse = <T>(json: string): T => {
  try {
    return JSON.parse(json) as T;
  } catch {
    return {} as T;
  }
};
const inRange = (d: Date | undefined, range: Range) => !range || (d !== undefined && d >= range.from && d <= range.to);

type StudentDim = {
  number: string;
  name: string;
  email: string;
  phone: string;
  program: string;
  pathway: string;
  campus: string;
  schedule: string;
  status: string;
  country: string;
  rate: string;
  admissionTerm: string;
  terms: string[];
  courses: string[];
  createdAt: Date;
};

async function studentDims(inst: string) {
  const [students, meta] = await Promise.all([
    prisma.student.findMany({
      where: { institutionId: inst },
      include: { person: true, cohort: { include: { program: true } }, enrolments: { include: { section: { include: { term: true, course: true } } } } },
      take: 5000,
    }),
    studentMetaMap(inst),
  ]);
  const map = new Map<string, StudentDim>();
  for (const s of students) {
    const m = meta[s.id] ?? {};
    const international = /international/i.test(m.residency ?? "");
    map.set(s.id, {
      number: s.studentNumber,
      name: `${s.person.familyName}, ${s.person.givenName}`,
      email: s.person.email,
      phone: s.person.phone ?? "",
      program: s.programName || s.cohort?.program.name || "",
      pathway: m.pathway ?? "",
      campus: m.campus || s.cohort?.campus || "",
      schedule: m.schedule || m.delivery || "",
      status: m.status ?? (s.enrolments.length ? "Active Student" : "Registered Student"),
      country: m.country || (international ? "" : "Canada"),
      rate: m.rateCategory || (international ? "International" : "Domestic"),
      admissionTerm: m.admissionTerm ?? "",
      terms: [...new Set([...s.enrolments.map((e) => e.section.term.name), m.admissionTerm ?? ""].filter(Boolean))],
      courses: [...new Set(s.enrolments.map((e) => `${e.section.course.code} — ${e.section.course.title}`))],
      createdAt: s.createdAt,
    });
  }
  return map;
}

function dimsOf(d: StudentDim | undefined, overrides: Partial<Record<string, Dim>> = {}): SourceRow {
  return {
    _program: d?.program ?? "",
    _pathway: d?.pathway ?? "",
    _campus: d?.campus ?? "",
    _schedule: d?.schedule ?? "",
    _term: d?.terms ?? [],
    _course: d?.courses ?? [],
    _status: d?.status ?? "",
    _country: d?.country ?? "",
    _rate: d?.rate ?? "",
    ...overrides,
  };
}

function letterFor(pct: number) {
  const scale: Array<[number, string]> = [
    [90, "A+"],
    [85, "A"],
    [80, "A-"],
    [76, "B+"],
    [72, "B"],
    [68, "B-"],
    [64, "C+"],
    [60, "C"],
    [55, "C-"],
    [50, "D"],
  ];
  return scale.find(([min]) => pct >= min)?.[1] ?? "F";
}

async function ledgerByStudent(inst: string, range: Range) {
  const storedEntries = await prisma.financeLedgerEntry.findMany({
    where: { institutionId: inst, status: { notIn: ["waived", "void"] }, ...(range ? { postedAt: { gte: range.from, lte: range.to } } : {}) },
    include: { financialTerm: true },
    take: 20000,
  });
  const entries = storedEntries.map((entry) => ({ ...entry, amountCad: Number(entry.amountCad) }));
  const by = new Map<string, typeof entries>();
  for (const e of entries) by.set(e.studentId, [...(by.get(e.studentId) ?? []), e]);
  return by;
}

function balanceOf(list: Array<{ kind: string; amountCad: number }>) {
  const sum = (k: string) => money(list.filter((e) => e.kind === k).reduce((a, e) => a + e.amountCad, 0));
  const charges = sum("charge");
  const payments = sum("payment");
  const credits = sum("credit");
  const refunds = sum("refund");
  return { charges, payments, credits, refunds, balance: money(charges + refunds - payments - credits) };
}

/* ------------------------------------------------------------------ */
/* Data sources (the "Data" step of the template builder)               */
/* ------------------------------------------------------------------ */

export const SOURCES: Record<SourceKey, SourceDef> = {
  students: {
    label: "Student profiles",
    groups: ["Student / User Reports"],
    filters: STUDENT_DIMS,
    conditionsTitle: "Student Profiles",
    columns: [
      ...STUDENT_COLS,
      { key: "email", label: "E-mail" },
      { key: "phone", label: "Phone" },
      { key: "program", label: "Program" },
      { key: "pathway", label: "Pathway" },
      { key: "campus", label: "Campus" },
      { key: "schedule", label: "Schedule" },
      { key: "status", label: "Status" },
      { key: "country", label: "Country" },
      { key: "rateCategory", label: "Rate Category" },
      { key: "admissionTerm", label: "Admission Term" },
      { key: "registeredOn", label: "Registered On" },
    ],
    async load(inst) {
      const dims = await studentDims(inst);
      return [...dims.values()].map((d) => ({
        studentNumber: d.number,
        studentName: d.name,
        email: d.email,
        phone: d.phone,
        program: d.program,
        pathway: d.pathway,
        campus: d.campus,
        schedule: d.schedule,
        status: d.status,
        country: d.country,
        rateCategory: d.rate,
        admissionTerm: d.admissionTerm,
        registeredOn: day(d.createdAt),
        ...dimsOf(d),
        _date: d.createdAt,
      }));
    },
  },
  attendance: {
    label: "Attendance records",
    groups: ["Student / User Reports", "Course Reports"],
    filters: STUDENT_DIMS,
    conditionsTitle: "Student Attendance",
    columns: [
      ...STUDENT_COLS,
      { key: "program", label: "Program" },
      { key: "campus", label: "Campus" },
      { key: "term", label: "Term" },
      { key: "course", label: "Course" },
      { key: "section", label: "Section" },
      { key: "sessionDate", label: "Session Date" },
      { key: "meeting", label: "Meeting" },
      { key: "attendance", label: "Attendance" },
    ],
    async load(inst, range) {
      const [dims, records] = await Promise.all([
        studentDims(inst),
        prisma.attendanceRecord.findMany({
          where: { institutionId: inst, ...(range ? { recordedAt: { gte: range.from, lte: range.to } } : {}) },
          include: { section: { include: { course: true, term: true } } },
          orderBy: { recordedAt: "desc" },
          take: 20000,
        }),
      ]);
      return records.map((r) => {
        const d = dims.get(r.studentId);
        const course = `${r.section.course.code} — ${r.section.course.title}`;
        return {
          studentNumber: d?.number ?? "",
          studentName: d?.name ?? "",
          program: d?.program ?? "",
          campus: d?.campus ?? "",
          term: r.section.term.name,
          course,
          section: r.section.code,
          sessionDate: day(r.recordedAt),
          meeting: r.meetingLabel,
          attendance: r.status,
          ...dimsOf(d, { _term: r.section.term.name, _course: course }),
          _date: r.recordedAt,
        };
      });
    },
  },
  attendanceSummary: {
    label: "Attendance summary by student and course",
    groups: ["Student / User Reports", "Course Reports"],
    filters: STUDENT_DIMS,
    conditionsTitle: "Student Attendance",
    columns: [
      ...STUDENT_COLS,
      { key: "program", label: "Program" },
      { key: "term", label: "Term" },
      { key: "course", label: "Course" },
      { key: "present", label: "Present", numeric: true },
      { key: "late", label: "Late", numeric: true },
      { key: "absent", label: "Absent", numeric: true },
      { key: "excused", label: "Excused", numeric: true },
      { key: "sessions", label: "Sessions", numeric: true },
      { key: "attendancePct", label: "Attendance %", numeric: true },
    ],
    async load(inst, range) {
      const rows = await SOURCES.attendance.load(inst, range);
      const groups = new Map<string, SourceRow[]>();
      for (const r of rows) groups.set(`${r.studentNumber}|${r.course}|${r.term}`, [...(groups.get(`${r.studentNumber}|${r.course}|${r.term}`) ?? []), r]);
      return [...groups.values()].map((list) => {
        const first = list[0]!;
        const count = (re: RegExp) => list.filter((r) => re.test(String(r.attendance))).length;
        const present = count(/^present/i);
        const late = count(/late|tardy/i);
        const absent = count(/absent/i);
        const excused = count(/excused/i);
        return {
          studentNumber: first.studentNumber as string,
          studentName: first.studentName as string,
          program: first.program as string,
          term: first.term as string,
          course: first.course as string,
          present,
          late,
          absent,
          excused,
          sessions: list.length,
          attendancePct: list.length ? money(((present + late) / list.length) * 100) : 0,
          ...Object.fromEntries(Object.entries(first).filter(([k]) => k.startsWith("_"))),
        };
      });
    },
  },
  enrolments: {
    label: "Course enrolments",
    groups: ["Course Reports"],
    filters: STUDENT_DIMS,
    conditionsTitle: "Enrolments",
    columns: [
      ...STUDENT_COLS,
      { key: "program", label: "Program" },
      { key: "course", label: "Course" },
      { key: "section", label: "Section" },
      { key: "term", label: "Term" },
      { key: "enrolmentStatus", label: "Enrolment Status" },
      { key: "attempt", label: "Attempt", numeric: true },
      { key: "enrolledOn", label: "Enrolled On" },
    ],
    async load(inst) {
      const [dims, enrolments] = await Promise.all([
        studentDims(inst),
        prisma.enrolment.findMany({ where: { institutionId: inst }, include: { section: { include: { course: true, term: true } } }, take: 20000 }),
      ]);
      return enrolments.map((e) => {
        const d = dims.get(e.studentId);
        const course = `${e.section.course.code} — ${e.section.course.title}`;
        return {
          studentNumber: d?.number ?? "",
          studentName: d?.name ?? "",
          program: d?.program ?? "",
          course,
          section: e.section.code,
          term: e.section.term.name,
          enrolmentStatus: e.status,
          attempt: e.attemptNumber,
          enrolledOn: day(e.createdAt),
          ...dimsOf(d, { _term: e.section.term.name, _course: course }),
          _date: e.createdAt,
        };
      });
    },
  },
  finalMarks: {
    label: "Final marks",
    groups: ["Course Reports"],
    filters: STUDENT_DIMS,
    conditionsTitle: "Final Marks",
    columns: [
      ...STUDENT_COLS,
      { key: "program", label: "Program" },
      { key: "course", label: "Course" },
      { key: "term", label: "Term" },
      { key: "gradedItems", label: "Graded Items", numeric: true },
      { key: "finalMark", label: "Final Mark %", numeric: true },
      { key: "letter", label: "Letter Grade" },
      { key: "enrolmentStatus", label: "Enrolment Status" },
    ],
    async load(inst, range) {
      const [dims, enrolments] = await Promise.all([
        studentDims(inst),
        prisma.enrolment.findMany({
          where: { institutionId: inst },
          include: { section: { include: { course: true, term: true } }, gradeItems: true },
          take: 20000,
        }),
      ]);
      return enrolments.map((e) => {
        const d = dims.get(e.studentId);
        const graded = e.gradeItems.filter((g) => g.score !== null && inRange(g.publishedAt ?? g.updatedAt, range));
        const max = graded.reduce((a, g) => a + g.maxScore, 0);
        const pct = max ? money((graded.reduce((a, g) => a + (g.score ?? 0), 0) / max) * 100) : 0;
        const course = `${e.section.course.code} — ${e.section.course.title}`;
        const last = graded.map((g) => g.publishedAt ?? g.updatedAt).sort((a, b) => b.getTime() - a.getTime())[0];
        return {
          studentNumber: d?.number ?? "",
          studentName: d?.name ?? "",
          program: d?.program ?? "",
          course,
          term: e.section.term.name,
          gradedItems: graded.length,
          finalMark: pct,
          letter: graded.length ? letterFor(pct) : "",
          enrolmentStatus: e.status,
          ...dimsOf(d, { _term: e.section.term.name, _course: course }),
          _date: last ?? e.updatedAt,
        };
      });
    },
  },
  balances: {
    label: "Student balances",
    groups: ["Financial Reports"],
    filters: FINANCE_DIMS,
    conditionsTitle: "Student Balances",
    columns: [
      ...STUDENT_COLS,
      { key: "program", label: "Program" },
      { key: "campus", label: "Campus" },
      { key: "status", label: "Status" },
      { key: "charges", label: "Total Charges", numeric: true },
      { key: "payments", label: "Total Payments", numeric: true },
      { key: "credits", label: "Total Credits", numeric: true },
      { key: "refunds", label: "Total Refunds", numeric: true },
      { key: "balance", label: "Balance", numeric: true },
    ],
    async load(inst, range) {
      const [dims, by] = await Promise.all([studentDims(inst), ledgerByStudent(inst, range)]);
      return [...by.entries()].map(([studentId, list]) => {
        const d = dims.get(studentId);
        return {
          studentNumber: d?.number ?? "",
          studentName: d?.name ?? "",
          program: d?.program ?? "",
          campus: d?.campus ?? "",
          status: d?.status ?? "",
          ...balanceOf(list),
          ...dimsOf(d),
          _date: list.map((e) => e.postedAt).sort((a, b) => b.getTime() - a.getTime())[0],
        };
      });
    },
  },
  financialFlags: {
    label: "Financial flags (outstanding / overdue balances)",
    groups: ["Financial Reports"],
    filters: FINANCE_DIMS,
    conditionsTitle: "Financial Flags",
    columns: [
      ...STUDENT_COLS,
      { key: "program", label: "Program" },
      { key: "campus", label: "Campus" },
      { key: "flag", label: "Flag" },
      { key: "balance", label: "Balance", numeric: true },
      { key: "overdueCharges", label: "Overdue Charges", numeric: true },
      { key: "overdueAmount", label: "Overdue Amount", numeric: true },
      { key: "oldestDue", label: "Oldest Due Date" },
    ],
    async load(inst, range) {
      const [dims, by] = await Promise.all([studentDims(inst), ledgerByStudent(inst, range)]);
      const now = new Date();
      const rows: SourceRow[] = [];
      for (const [studentId, list] of by) {
        const { balance } = balanceOf(list);
        const overdue = list.filter((e) => e.kind === "charge" && e.status !== "paid" && e.dueAt && e.dueAt < now);
        if (balance <= 0 && !overdue.length) continue;
        const d = dims.get(studentId);
        const oldest = overdue.map((e) => e.dueAt!).sort((a, b) => a.getTime() - b.getTime())[0];
        rows.push({
          studentNumber: d?.number ?? "",
          studentName: d?.name ?? "",
          program: d?.program ?? "",
          campus: d?.campus ?? "",
          flag: overdue.length ? "Overdue balance" : "Outstanding balance",
          balance,
          overdueCharges: overdue.length,
          overdueAmount: money(overdue.reduce((a, e) => a + e.amountCad, 0)),
          oldestDue: day(oldest),
          ...dimsOf(d),
          _date: oldest ?? list[0]?.postedAt,
        });
      }
      return rows;
    },
  },
  ledger: {
    label: "Ledger transactions",
    groups: ["Financial Reports"],
    filters: FINANCE_DIMS,
    conditionsTitle: "Ledger Transactions",
    columns: [
      { key: "postedOn", label: "Posted On" },
      ...STUDENT_COLS,
      { key: "type", label: "Type" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount", numeric: true },
      { key: "entryStatus", label: "Status" },
      { key: "financialTerm", label: "Financial Term" },
      { key: "dueOn", label: "Due On" },
    ],
    async load(inst, range) {
      const [dims, by] = await Promise.all([studentDims(inst), ledgerByStudent(inst, range)]);
      return [...by.entries()].flatMap(([studentId, list]) =>
        list.map((e) => {
          const d = dims.get(studentId);
          return {
            postedOn: day(e.postedAt),
            studentNumber: d?.number ?? "",
            studentName: d?.name ?? "",
            type: e.kind,
            description: e.label,
            amount: money(e.amountCad),
            entryStatus: e.status,
            financialTerm: e.financialTerm?.name ?? "",
            dueOn: day(e.dueAt),
            ...dimsOf(d, e.financialTerm ? { _term: [...(d?.terms ?? []), e.financialTerm.name] } : {}),
            _date: e.postedAt,
          };
        }),
      );
    },
  },
  audit: {
    label: "Audit log",
    groups: ["System / Mics Reports"],
    filters: [],
    conditionsTitle: "Audit Log",
    columns: [
      { key: "when", label: "Date / Time (UTC)" },
      { key: "actor", label: "User" },
      { key: "event", label: "Event" },
      { key: "area", label: "Area" },
      { key: "detail", label: "Detail" },
    ],
    async load(inst, range) {
      const when = range ? { createdAt: { gte: range.from, lte: range.to } } : {};
      const [events, entries, accounts] = await Promise.all([
        prisma.auditEvent.findMany({ where: { institutionId: inst, ...when }, orderBy: { createdAt: "desc" }, take: 10000 }),
        prisma.heritageAuditEntry.findMany({ where: { institutionId: inst, ...when }, orderBy: { createdAt: "desc" }, take: 10000 }),
        prisma.account.findMany({ where: { institutionId: inst }, include: { person: true } }),
      ]);
      const names = new Map(accounts.flatMap((a) => [[a.id, `${a.person.givenName} ${a.person.familyName}`] as const, [a.personId, `${a.person.givenName} ${a.person.familyName}`] as const]));
      return [
        ...events.map((e) => ({ when: stamp(e.createdAt), actor: names.get(e.actorId) ?? e.actorId, event: e.eventName, area: e.source, detail: e.purpose, _date: e.createdAt })),
        ...entries.map((e) => ({ when: stamp(e.createdAt), actor: e.actorName, event: e.action, area: `Heritage ${e.screenId}`, detail: e.note ?? "", _date: e.createdAt })),
      ].sort((a, b) => b._date.getTime() - a._date.getTime());
    },
  },
  userActivity: {
    label: "User sign-in activity",
    groups: ["Student / User Reports", "System / Mics Reports"],
    filters: [],
    conditionsTitle: "User Activity",
    columns: [
      { key: "signedIn", label: "Signed In (UTC)" },
      { key: "user", label: "User" },
      { key: "email", label: "E-mail" },
      { key: "roles", label: "Roles" },
      { key: "ipAddress", label: "IP Address" },
      { key: "device", label: "Device" },
      { key: "expires", label: "Session Expires (UTC)" },
    ],
    async load(inst, range) {
      const sessions = await prisma.session.findMany({
        where: { institutionId: inst, ...(range ? { createdAt: { gte: range.from, lte: range.to } } : {}) },
        include: { account: { include: { person: true } } },
        orderBy: { createdAt: "desc" },
        take: 10000,
      });
      return sessions.map((s) => ({
        signedIn: stamp(s.createdAt),
        user: `${s.account.person.givenName} ${s.account.person.familyName}`,
        email: s.account.email,
        roles: (parse<string[]>(s.account.rolesJson) || []).join(", "),
        ipAddress: s.ipAddress,
        device: s.userAgent.slice(0, 120),
        expires: stamp(s.expiresAt),
        _date: s.createdAt,
      }));
    },
  },
  agents: {
    label: "Agents onboarded",
    groups: ["Student / User Reports"],
    filters: [],
    conditionsTitle: "Agents",
    columns: [
      { key: "agent", label: "Agent" },
      { key: "status", label: "Status" },
      { key: "onboardedOn", label: "Onboarded On" },
      { key: "details", label: "Details" },
    ],
    async load(inst) {
      const records = await prisma.heritageRecord.findMany({ where: { institutionId: inst, screenId: "F07", deletedAt: null, singletonKey: null }, orderBy: { createdAt: "desc" } });
      return records.map((r) => {
        const data = parse<Record<string, unknown>>(r.dataJson);
        const title = String(data.name ?? data.agent ?? data.agent_name ?? Object.values(data).find((v) => typeof v === "string" && v) ?? "Agent");
        return {
          agent: title,
          status: r.status,
          onboardedOn: day(r.createdAt),
          details: Object.entries(data)
            .filter(([k, v]) => !k.startsWith("_") && v !== "" && v !== null && typeof v !== "object")
            .map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v)}`)
            .join("; ")
            .slice(0, 400),
          _date: r.createdAt,
        };
      });
    },
  },
};

/* ------------------------------------------------------------------ */
/* Records                                                              */
/* ------------------------------------------------------------------ */

export type Category = { name: string; language: string; system?: boolean };
export type Template = {
  name: string;
  description: string;
  categoryId: string;
  active: "Yes" | "No";
  separateWorkbooksBy: string;
  availableTo: string;
  language: string;
  reportGroup: ReportGroup;
  exportType: string;
  source: SourceKey;
  conditionsTitle: string;
  filters: FilterKey[];
  showTotalsDefault: "Yes" | "No";
  columns: string[];
  graph: { type: string; groupBy: string; measure: string };
  lastConditions?: Record<string, string>;
};
export type ScheduleData = {
  templateId: string;
  templateName: string;
  conditions: Record<string, string>;
  datePreset: string;
  frequency: string;
  weekday: number;
  monthDay: number;
  time: string;
  timezone: string;
  recipients: string;
  format: string;
  startDate: string;
  endDate: string;
  active: boolean;
  nextRunAt: string | null;
  lastRunAt?: string;
  lastRunId?: string;
  lastStatus?: string;
};

type Stored<T> = { id: string; data: T; createdById: string; createdAt: Date; updatedAt: Date };

async function listRecords<T>(inst: string, screen: string): Promise<Stored<T>[]> {
  const rows = await prisma.heritageRecord.findMany({ where: { institutionId: inst, screenId: screen, deletedAt: null, singletonKey: null }, orderBy: { createdAt: "asc" } });
  return rows.map((r) => ({ id: r.id, data: parse<T>(r.dataJson), createdById: r.createdById, createdAt: r.createdAt, updatedAt: r.updatedAt }));
}

async function getRecord<T>(inst: string, screen: string, id: string, label: string): Promise<Stored<T>> {
  const r = await prisma.heritageRecord.findFirst({ where: { id, institutionId: inst, screenId: screen, deletedAt: null } });
  if (!r) throw httpError(404, `${label} not found`, "NOT_FOUND");
  return { id: r.id, data: parse<T>(r.dataJson), createdById: r.createdById, createdAt: r.createdAt, updatedAt: r.updatedAt };
}

async function createRecord(user: SessionClaims, screen: string, data: unknown) {
  return prisma.heritageRecord.create({
    data: { institutionId: user.institutionId, screenId: screen, dataJson: JSON.stringify(data), createdById: user.accountId, updatedById: user.accountId },
  });
}

async function saveRecord(inst: string, actorId: string, id: string, data: unknown) {
  await prisma.heritageRecord.update({ where: { id }, data: { dataJson: JSON.stringify(data), updatedById: actorId, rowVersion: { increment: 1 } } });
}

async function softDelete(user: SessionClaims, id: string) {
  await prisma.heritageRecord.update({ where: { id }, data: { deletedAt: new Date(), updatedById: user.accountId, status: "deleted" } });
}

/* ------------------------------------------------------------------ */
/* Seed: the categories and 12 reports on the captured screens          */
/* ------------------------------------------------------------------ */

const ATTENDANCE_FILTERS: FilterKey[] = ["showTotals", "programs", "pathways", "campus", "term", "course", "status", "country", "rateCategories"];
const SEED_TEMPLATES: Array<{ category: "AGENT REPORT" | "Miscellaneous"; t: Omit<Template, "categoryId" | "description" | "active" | "separateWorkbooksBy" | "availableTo" | "language" | "exportType" | "graph"> & { graph?: Template["graph"] } }> = [
  { category: "AGENT REPORT", t: { name: "Agents onboard", reportGroup: "Student / User Reports", source: "agents", conditionsTitle: "Agents", filters: ["showTotals"], showTotalsDefault: "No", columns: ["agent", "status", "onboardedOn", "details"] } },
  {
    category: "Miscellaneous",
    t: { name: "Attendance Report", reportGroup: "Student / User Reports", source: "attendance", conditionsTitle: "Student Attendance", filters: ATTENDANCE_FILTERS, showTotalsDefault: "No", columns: SOURCES.attendance.columns.map((c) => c.key), graph: { type: "Bar", groupBy: "attendance", measure: "" } },
  },
  {
    category: "Miscellaneous",
    t: { name: "Attendance Report- New", reportGroup: "Student / User Reports", source: "attendanceSummary", conditionsTitle: "Student Attendance", filters: ATTENDANCE_FILTERS, showTotalsDefault: "No", columns: SOURCES.attendanceSummary.columns.map((c) => c.key) },
  },
  { category: "Miscellaneous", t: { name: "Audit Report", reportGroup: "System / Mics Reports", source: "audit", conditionsTitle: "Audit Log", filters: ["showTotals"], showTotalsDefault: "No", columns: SOURCES.audit.columns.map((c) => c.key) } },
  {
    category: "Miscellaneous",
    t: { name: "Enrolment Report", reportGroup: "Course Reports", source: "enrolments", conditionsTitle: "Enrolments", filters: ["showTotals", "programs", "campus", "term", "course", "status"], showTotalsDefault: "No", columns: SOURCES.enrolments.columns.map((c) => c.key), graph: { type: "Bar", groupBy: "course", measure: "" } },
  },
  { category: "Miscellaneous", t: { name: "Final Marks", reportGroup: "Course Reports", source: "finalMarks", conditionsTitle: "Final Marks", filters: ["showTotals", "programs", "term", "course", "status"], showTotalsDefault: "No", columns: SOURCES.finalMarks.columns.map((c) => c.key) } },
  {
    category: "Miscellaneous",
    t: { name: "Financial Flags", reportGroup: "Financial Reports", source: "financialFlags", conditionsTitle: "Financial Flags", filters: ["showTotals", "programs", "campus", "status", "country", "rateCategories"], showTotalsDefault: "Yes", columns: SOURCES.financialFlags.columns.map((c) => c.key) },
  },
  {
    category: "Miscellaneous",
    t: { name: "HCC Email", reportGroup: "Student / User Reports", source: "students", conditionsTitle: "Student Profiles", filters: ["showTotals", "programs", "schedules", "term", "status", "country", "rateCategories"], showTotalsDefault: "Yes", columns: ["studentNumber", "studentName", "email", "program", "status"] },
  },
  { category: "Miscellaneous", t: { name: "New Report", reportGroup: "Student / User Reports", source: "students", conditionsTitle: "Student Profiles", filters: ["showTotals", "programs", "status"], showTotalsDefault: "No", columns: ["studentNumber", "studentName", "program", "status"] } },
  {
    category: "Miscellaneous",
    t: { name: "Student Balance Statements", reportGroup: "Financial Reports", source: "balances", conditionsTitle: "Student Balances", filters: ["showTotals", "programs", "campus", "term", "status", "country", "rateCategories"], showTotalsDefault: "Yes", columns: SOURCES.balances.columns.map((c) => c.key) },
  },
  {
    category: "Miscellaneous",
    t: { name: "Student Profiles", reportGroup: "Student / User Reports", source: "students", conditionsTitle: "Student Profiles", filters: ["showTotals", "programs", "pathways", "campus", "schedules", "term", "status", "country", "rateCategories"], showTotalsDefault: "No", columns: SOURCES.students.columns.map((c) => c.key), graph: { type: "Pie", groupBy: "status", measure: "" } },
  },
  { category: "Miscellaneous", t: { name: "User Activity Report", reportGroup: "System / Mics Reports", source: "userActivity", conditionsTitle: "User Activity", filters: ["showTotals"], showTotalsDefault: "No", columns: SOURCES.userActivity.columns.map((c) => c.key) } },
];

async function ensureSeed(user: SessionClaims) {
  const inst = user.institutionId;
  const done = await prisma.heritageRecord.findFirst({ where: { institutionId: inst, screenId: SCREEN.seed } });
  if (done) return;
  try {
    await prisma.heritageRecord.create({
      data: { institutionId: inst, screenId: SCREEN.seed, singletonKey: "seed", dataJson: "{}", createdById: user.accountId, updatedById: user.accountId },
    });
  } catch {
    return;
  }
  const agent = await createRecord(user, SCREEN.category, { name: "AGENT REPORT", language: "English" } satisfies Category);
  const misc = await createRecord(user, SCREEN.category, { name: "Miscellaneous", language: "English", system: true } satisfies Category);
  for (const { category, t } of SEED_TEMPLATES) {
    await createRecord(user, SCREEN.template, {
      description: "",
      active: "Yes",
      separateWorkbooksBy: "Report Type",
      availableTo: "All Staff",
      language: "English",
      exportType: "Excel",
      graph: { type: "None", groupBy: "", measure: "" },
      ...t,
      categoryId: category === "AGENT REPORT" ? agent.id : misc.id,
    } satisfies Template);
  }
}

async function systemCategoryId(inst: string) {
  const cats = await listRecords<Category>(inst, SCREEN.category);
  return cats.find((c) => c.data.system)?.id ?? cats[0]?.id ?? "";
}

/* ------------------------------------------------------------------ */
/* Catalog + metadata                                                   */
/* ------------------------------------------------------------------ */

function canSee(user: SessionClaims, t: Stored<Template>) {
  if (t.data.availableTo === "Administrators Only") return user.roles.includes("admin");
  if (t.data.availableTo === "Only Me") return t.createdById === user.accountId;
  return true;
}

export async function reportMeta(user: SessionClaims) {
  await assertPermission(user, "reporting", "view");
  return {
    groups: REPORT_GROUPS,
    exportTypes: EXPORT_TYPES,
    separateBy: SEPARATE_BY,
    availableTo: AVAILABLE_TO,
    languages: LANGUAGES,
    graphTypes: GRAPH_TYPES,
    datePresets: DATE_PRESETS,
    frequencies: FREQUENCIES,
    weekdays: WEEKDAYS,
    filters: FILTER_ORDER.map((key) => ({ key, ...FILTERS[key] })),
    sources: Object.entries(SOURCES).map(([key, s]) => ({ key, label: s.label, groups: s.groups, filters: ["showTotals", ...s.filters], conditionsTitle: s.conditionsTitle, columns: s.columns })),
    mail: mailConfigured(),
  };
}

export async function reportOptions(user: SessionClaims) {
  await assertPermission(user, "reporting", "view");
  const [r, meta] = await Promise.all([refs(user), studentMetaMap(user.institutionId)]);
  const schedules = [...new Set(["Full-Time", "Part-Time", ...Object.values(meta).map((m) => m.schedule || m.delivery || "")].filter(Boolean))];
  return {
    programs: r.programs ?? [],
    pathways: r.pathways ?? [],
    campuses: r.campuses ?? [],
    schedules,
    terms: r.terms ?? [],
    courses: r.courses ?? [],
    statuses: r.statuses ?? [],
    countries: r.countries ?? [],
    rateCategories: r.rateCategories ?? [],
  };
}

export async function catalog(user: SessionClaims, opts: { q?: string; runnable?: boolean }) {
  await assertPermission(user, "reporting", "view");
  await ensureSeed(user);
  const inst = user.institutionId;
  const [cats, templates] = await Promise.all([listRecords<Category>(inst, SCREEN.category), listRecords<Template>(inst, SCREEN.template)]);
  const needle = (opts.q ?? "").trim().toLowerCase();
  const fallback = cats.find((c) => c.data.system)?.id;
  const visible = templates.filter((t) => (!opts.runnable || (t.data.active === "Yes" && canSee(user, t))) && (!needle || t.data.name.toLowerCase().includes(needle)));
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  return {
    categories: cats
      .map((c) => ({
        id: c.id,
        name: c.data.name,
        system: Boolean(c.data.system),
        templates: visible
          .filter((t) => (cats.some((x) => x.id === t.data.categoryId) ? t.data.categoryId : fallback) === c.id)
          .map((t) => ({ id: t.id, name: t.data.name, description: t.data.description, active: t.data.active, reportGroup: t.data.reportGroup, availableTo: t.data.availableTo }))
          .sort(byName),
      }))
      .filter((c) => !needle || c.templates.length)
      .sort(byName),
  };
}

/* ------------------------------------------------------------------ */
/* Categories                                                           */
/* ------------------------------------------------------------------ */

async function assertUniqueCategory(inst: string, name: string, exceptId?: string) {
  const cats = await listRecords<Category>(inst, SCREEN.category);
  if (cats.some((c) => c.id !== exceptId && c.data.name.trim().toLowerCase() === name.trim().toLowerCase())) throw httpError(409, `A report category named "${name}" already exists`, "CONFLICT");
}

export async function getCategory(user: SessionClaims, id: string) {
  await assertPermission(user, "reporting", "view");
  const c = await getRecord<Category>(user.institutionId, SCREEN.category, id, "Report category");
  return { id: c.id, name: c.data.name, language: c.data.language, system: Boolean(c.data.system) };
}

export async function createCategory(user: SessionClaims, body: { name: string }) {
  await assertPermission(user, "reporting", "edit");
  await ensureSeed(user);
  const name = body.name.trim();
  await assertUniqueCategory(user.institutionId, name);
  const rec = await createRecord(user, SCREEN.category, { name, language: "English" } satisfies Category);
  await audit(user, "RP03", "", "create report category", { recordId: rec.id, after: { name } });
  return { ok: true, id: rec.id, message: `Category "${name}" saved` };
}

export async function updateCategory(user: SessionClaims, id: string, body: { name: string }) {
  await assertPermission(user, "reporting", "edit");
  const c = await getRecord<Category>(user.institutionId, SCREEN.category, id, "Report category");
  if (c.data.system) throw httpError(400, `"${c.data.name}" is the default category and cannot be renamed`);
  const name = body.name.trim();
  await assertUniqueCategory(user.institutionId, name, id);
  await saveRecord(user.institutionId, user.accountId, id, { ...c.data, name });
  await audit(user, "RP03", "", "update report category", { recordId: id, before: { name: c.data.name }, after: { name } });
  return { ok: true, id, message: `Category "${name}" saved` };
}

export async function deleteCategory(user: SessionClaims, id: string) {
  await assertPermission(user, "reporting", "edit");
  const inst = user.institutionId;
  const c = await getRecord<Category>(inst, SCREEN.category, id, "Report category");
  if (c.data.system) throw httpError(400, `"${c.data.name}" is the default category and cannot be deleted`);
  const target = await systemCategoryId(inst);
  const templates = (await listRecords<Template>(inst, SCREEN.template)).filter((t) => t.data.categoryId === id);
  for (const t of templates) await saveRecord(inst, user.accountId, t.id, { ...t.data, categoryId: target });
  await softDelete(user, id);
  await audit(user, "RP03", "", "delete report category", { recordId: id, before: { name: c.data.name }, note: templates.length ? `${templates.length} template(s) moved to Miscellaneous` : null });
  return { ok: true, message: `Category "${c.data.name}" deleted${templates.length ? `; ${templates.length} report(s) moved to Miscellaneous` : ""}` };
}

/* ------------------------------------------------------------------ */
/* Templates                                                            */
/* ------------------------------------------------------------------ */

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

async function normalizeTemplate(inst: string, input: Partial<Template>, base?: Template, exceptId?: string): Promise<Template> {
  const merged = { ...(base ?? {}), ...input } as Partial<Template>;
  const name = String(merged.name ?? "").trim();
  if (!name) throw httpError(400, "Report Name is required");
  if (name.length > 120) throw httpError(400, "Report Name must be 120 characters or fewer");
  const templates = await listRecords<Template>(inst, SCREEN.template);
  if (templates.some((t) => t.id !== exceptId && t.data.name.trim().toLowerCase() === name.toLowerCase())) throw httpError(409, `A report named "${name}" already exists`, "CONFLICT");

  const reportGroup = pick(merged.reportGroup, REPORT_GROUPS, "Student / User Reports");
  const sourceKey = (merged.source && merged.source in SOURCES ? merged.source : Object.entries(SOURCES).find(([, s]) => s.groups.includes(reportGroup))![0]) as SourceKey;
  const source = SOURCES[sourceKey];
  if (!source.groups.includes(reportGroup)) throw httpError(400, `${source.label} is not available under ${reportGroup}`);

  const cats = await listRecords<Category>(inst, SCREEN.category);
  const categoryId = cats.some((c) => c.id === merged.categoryId) ? merged.categoryId! : (cats.find((c) => c.data.system)?.id ?? "");

  const allowedFilters = new Set<FilterKey>(["showTotals", ...source.filters]);
  const filters = FILTER_ORDER.filter((f) => (merged.filters ?? ["showTotals", ...source.filters]).includes(f) && allowedFilters.has(f));
  const colKeys = new Set(source.columns.map((c) => c.key));
  const columns = (merged.columns ?? []).filter((c) => colKeys.has(c));
  if (!columns.length) throw httpError(400, "Select at least one column in the Data step");

  const graphType = pick(merged.graph?.type, GRAPH_TYPES, "None");
  const groupBy = graphType === "None" ? "" : String(merged.graph?.groupBy ?? "");
  if (graphType !== "None" && !colKeys.has(groupBy)) throw httpError(400, "Choose the column the graph groups by");
  const measure = graphType === "None" ? "" : String(merged.graph?.measure ?? "");
  if (measure && !source.columns.some((c) => c.key === measure && c.numeric)) throw httpError(400, "Graph measure must be a numeric column");

  return {
    name,
    description: String(merged.description ?? "").slice(0, 2000),
    categoryId,
    active: merged.active === "No" ? "No" : "Yes",
    separateWorkbooksBy: pick(merged.separateWorkbooksBy, SEPARATE_BY, "Report Type"),
    availableTo: pick(merged.availableTo, AVAILABLE_TO, "All Staff"),
    language: pick(merged.language, LANGUAGES, "English"),
    reportGroup,
    exportType: pick(merged.exportType, EXPORT_TYPES, "Excel"),
    source: sourceKey,
    conditionsTitle: String(merged.conditionsTitle || source.conditionsTitle).slice(0, 120),
    filters,
    showTotalsDefault: merged.showTotalsDefault === "Yes" ? "Yes" : "No",
    columns,
    graph: { type: graphType, groupBy, measure },
    ...(merged.lastConditions ? { lastConditions: merged.lastConditions } : {}),
  };
}

export async function getTemplate(user: SessionClaims, id: string) {
  await assertPermission(user, "reporting", "view");
  await ensureSeed(user);
  const t = await getRecord<Template>(user.institutionId, SCREEN.template, id, "Report template");
  if (!canSee(user, t)) throw httpError(403, "This report is not available to you", "FORBIDDEN");
  const cats = await listRecords<Category>(user.institutionId, SCREEN.category);
  return { id: t.id, ...t.data, categoryName: cats.find((c) => c.id === t.data.categoryId)?.data.name ?? "Miscellaneous", updatedAt: t.updatedAt.toISOString() };
}

export async function createTemplate(user: SessionClaims, body: Partial<Template>) {
  await assertPermission(user, "reporting", "edit");
  await ensureSeed(user);
  const data = await normalizeTemplate(user.institutionId, body);
  const rec = await createRecord(user, SCREEN.template, data);
  await audit(user, "RP02", "", "create report template", { recordId: rec.id, after: data });
  return { ok: true, id: rec.id, message: `Report template "${data.name}" saved` };
}

export async function updateTemplate(user: SessionClaims, id: string, body: Partial<Template>) {
  await assertPermission(user, "reporting", "edit");
  const t = await getRecord<Template>(user.institutionId, SCREEN.template, id, "Report template");
  const data = await normalizeTemplate(user.institutionId, body, t.data, id);
  await saveRecord(user.institutionId, user.accountId, id, data);
  await audit(user, "RP02", "", "update report template", { recordId: id, before: t.data, after: data });
  return { ok: true, id, message: `Report template "${data.name}" saved` };
}

export async function deleteTemplate(user: SessionClaims, id: string) {
  await assertPermission(user, "reporting", "edit");
  const inst = user.institutionId;
  const t = await getRecord<Template>(inst, SCREEN.template, id, "Report template");
  const schedules = (await listRecords<ScheduleData>(inst, SCREEN.schedule)).filter((s) => s.data.templateId === id);
  for (const s of schedules) await softDelete(user, s.id);
  await softDelete(user, id);
  await audit(user, "RP02", "", "delete report template", { recordId: id, before: { name: t.data.name }, note: schedules.length ? `${schedules.length} schedule(s) removed` : null });
  return { ok: true, message: `Report "${t.data.name}" deleted${schedules.length ? ` with ${schedules.length} schedule(s)` : ""}` };
}

/* ------------------------------------------------------------------ */
/* Running                                                              */
/* ------------------------------------------------------------------ */

function startOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function endOfDay(d: Date) {
  return new Date(startOfDay(d).getTime() + 86_400_000 - 1);
}

export function resolveRange(preset: string, from?: string, to?: string, now = new Date()): Range {
  const today = startOfDay(now);
  const dayMs = 86_400_000;
  switch (preset) {
    case "Today":
      return { from: today, to: endOfDay(today) };
    case "Yesterday":
      return { from: new Date(today.getTime() - dayMs), to: new Date(today.getTime() - 1) };
    case "This Week": {
      const start = new Date(today.getTime() - today.getUTCDay() * dayMs);
      return { from: start, to: endOfDay(today) };
    }
    case "Last Week": {
      const end = new Date(today.getTime() - today.getUTCDay() * dayMs);
      return { from: new Date(end.getTime() - 7 * dayMs), to: new Date(end.getTime() - 1) };
    }
    case "This Month":
      return { from: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)), to: endOfDay(today) };
    case "Last Month": {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
      return { from: start, to: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1) - 1) };
    }
    case "Last 30 Days":
      return { from: new Date(today.getTime() - 29 * dayMs), to: endOfDay(today) };
    case "This Year":
      return { from: new Date(Date.UTC(today.getUTCFullYear(), 0, 1)), to: endOfDay(today) };
    case "Custom": {
      if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw httpError(400, "Enter both a From and a To date");
      const f = new Date(`${from}T00:00:00Z`);
      const t = endOfDay(new Date(`${to}T00:00:00Z`));
      if (f > t) throw httpError(400, "From date must be on or before the To date");
      return { from: f, to: t };
    }
    default:
      return null;
  }
}

function matches(dim: Cell | Dim | Date | undefined, wanted: string, key: FilterKey) {
  const want = wanted.trim().toLowerCase();
  const values = (Array.isArray(dim) ? dim : [dim]).map((v) => String(v ?? "").toLowerCase());
  if (key === "course") return values.some((v) => v === want || v.split(" — ")[0] === want.split(" — ")[0]);
  return values.includes(want);
}

type RunResult = {
  columns: Col[];
  rows: Cell[][];
  separators: string[];
  totals: Cell[] | null;
  graph: { type: string; label: string; points: Array<{ label: string; value: number }> } | null;
  count: number;
};

export async function executeTemplate(inst: string, t: Template, conditions: Record<string, string>, range: Range): Promise<RunResult> {
  const source = SOURCES[t.source];
  let rows = await source.load(inst, range);
  if (range) rows = rows.filter((r) => inRange(r._date, range));
  for (const key of t.filters) {
    if (key === "showTotals") continue;
    const value = conditions[key];
    if (!value || value === FILTERS[key].all) continue;
    rows = rows.filter((r) => matches(r[DIM[key]], value, key));
  }
  const columns = t.columns.map((k) => source.columns.find((c) => c.key === k)!).filter(Boolean);
  const sepDim = SEPARATE_DIM[t.separateWorkbooksBy];
  const out = rows.map((r) => columns.map((c) => (r[c.key] as Cell | undefined) ?? ""));
  const separators = rows.map((r) => {
    const v = sepDim ? r[sepDim] : "";
    return (Array.isArray(v) ? v[0] : String(v ?? "")) || "Unassigned";
  });

  const showTotals = (conditions.showTotals ?? t.showTotalsDefault) === "Yes";
  const totals = showTotals
    ? columns.map((c, i) => (i === 0 ? `Total (${out.length} rows)` : c.numeric ? money(out.reduce((a, r) => a + (typeof r[i] === "number" ? (r[i] as number) : 0), 0)) : ""))
    : null;

  let graph: RunResult["graph"] = null;
  if (t.graph.type !== "None" && t.graph.groupBy) {
    const gi = columns.findIndex((c) => c.key === t.graph.groupBy);
    const mi = t.graph.measure ? columns.findIndex((c) => c.key === t.graph.measure) : -1;
    const byLabel = new Map<string, number>();
    rows.forEach((r, idx) => {
      const label = String((gi >= 0 ? out[idx]![gi] : r[t.graph.groupBy]) || "Unassigned");
      const add = mi >= 0 ? Number(out[idx]![mi]) || 0 : 1;
      byLabel.set(label, (byLabel.get(label) ?? 0) + add);
    });
    const groupLabel = source.columns.find((c) => c.key === t.graph.groupBy)?.label ?? t.graph.groupBy;
    const measureLabel = t.graph.measure ? source.columns.find((c) => c.key === t.graph.measure)?.label : "Count";
    graph = {
      type: t.graph.type,
      label: `${measureLabel} by ${groupLabel}`,
      points: [...byLabel.entries()]
        .map(([label, value]) => ({ label, value: money(value) }))
        .sort((a, b) => (t.graph.type === "Line" ? a.label.localeCompare(b.label) : b.value - a.value))
        .slice(0, 20),
    };
  }
  return { columns, rows: out, separators, totals, graph, count: out.length };
}

type StoredRun = RunResult & {
  templateId: string;
  templateName: string;
  conditions: Record<string, string>;
  range: { from: string; to: string } | null;
  trigger: "manual" | "schedule";
  scheduleId?: string;
  separateWorkbooksBy: string;
  exportType: string;
  actorName: string;
  truncated: boolean;
};

const STORED_ROW_LIMIT = 5000;
const RETURN_ROW_LIMIT = 1000;

async function storeRun(inst: string, actorId: string, run: StoredRun) {
  const rec = await prisma.heritageRecord.create({
    data: {
      institutionId: inst,
      screenId: SCREEN.run,
      contextKey: run.templateId,
      status: run.trigger,
      dataJson: JSON.stringify({ ...run, rows: run.rows.slice(0, STORED_ROW_LIMIT), separators: run.separators.slice(0, STORED_ROW_LIMIT) }),
      createdById: actorId,
      updatedById: actorId,
    },
  });
  return rec;
}

function cleanConditions(t: Template, raw: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const key of t.filters) {
    const v = String(raw[key] ?? "").trim();
    out[key] = key === "showTotals" ? (v === "Yes" || v === "No" ? v : t.showTotalsDefault) : v || FILTERS[key].all;
  }
  return out;
}

async function actorLabel(user: SessionClaims) {
  const p = await prisma.person.findFirst({ where: { id: user.personId }, select: { givenName: true, familyName: true } });
  return p ? `${p.givenName} ${p.familyName}` : "Admin";
}

export type ScheduleInput = {
  enabled: boolean;
  frequency?: string;
  weekday?: number;
  monthDay?: number;
  time?: string;
  recipients?: string;
  format?: string;
  startDate?: string;
  endDate?: string;
  datePreset?: string;
};

export async function runTemplate(
  user: SessionClaims,
  id: string,
  body: { conditions?: Record<string, string>; save?: boolean; dates?: { enabled: boolean; preset?: string; from?: string; to?: string }; schedule?: ScheduleInput },
) {
  await assertPermission(user, "reporting", "view");
  const inst = user.institutionId;
  const t = await getRecord<Template>(inst, SCREEN.template, id, "Report template");
  if (!canSee(user, t)) throw httpError(403, "This report is not available to you", "FORBIDDEN");
  if (t.data.active !== "Yes") throw httpError(400, `"${t.data.name}" is not active`);
  const conditions = cleanConditions(t.data, body.conditions ?? {});
  const range = body.dates?.enabled ? resolveRange(body.dates.preset ?? "Custom", body.dates.from, body.dates.to) : null;

  let scheduleMessage = "";
  if (body.schedule?.enabled) {
    await assertPermission(user, "reporting", "edit");
    const datePreset = body.dates?.enabled && body.dates.preset && body.dates.preset !== "Custom" ? body.dates.preset : (body.schedule.datePreset ?? "None");
    const created = await createSchedule(user, id, t.data.name, conditions, { ...body.schedule, datePreset });
    scheduleMessage = ` Schedule created — next run ${created.nextRunAt ? stamp(new Date(created.nextRunAt)) + " UTC" : "not scheduled"}.`;
  }
  if (body.save !== false) {
    await saveRecord(inst, user.accountId, t.id, { ...t.data, lastConditions: conditions });
  }

  const result = await executeTemplate(inst, t.data, conditions, range);
  const actorName = await actorLabel(user);
  const run: StoredRun = {
    ...result,
    templateId: t.id,
    templateName: t.data.name,
    conditions,
    range: range ? { from: day(range.from), to: day(range.to) } : null,
    trigger: "manual",
    separateWorkbooksBy: t.data.separateWorkbooksBy,
    exportType: t.data.exportType,
    actorName,
    truncated: result.rows.length > STORED_ROW_LIMIT,
  };
  const rec = await storeRun(inst, user.accountId, run);
  await audit(user, "RP01", "", "run report", { recordId: rec.id, note: `${t.data.name}: ${result.count} row(s)` });
  return {
    ok: true,
    runId: rec.id,
    message: `${t.data.name}: ${result.count} row(s).${scheduleMessage}`,
    ...run,
    rows: result.rows.slice(0, RETURN_ROW_LIMIT),
    separators: undefined,
    shownRows: Math.min(result.rows.length, RETURN_ROW_LIMIT),
    createdAt: rec.createdAt.toISOString(),
  };
}

export async function listRuns(user: SessionClaims, opts: { templateId?: string; scheduleId?: string; limit?: number }) {
  await assertPermission(user, "reporting", "view");
  const [rows, templates] = await Promise.all([
    prisma.heritageRecord.findMany({
      where: { institutionId: user.institutionId, screenId: SCREEN.run, deletedAt: null, ...(opts.templateId ? { contextKey: opts.templateId } : {}) },
      orderBy: { createdAt: "desc" },
      take: Math.min(opts.limit ?? 50, 200),
    }),
    listRecords<Template>(user.institutionId, SCREEN.template),
  ]);
  const live = new Set(templates.map((t) => t.id));
  const byId = new Map(templates.map((t) => [t.id, t]));
  return {
    items: rows
      .filter((r) => runVisible(user, r, parse<StoredRun>(r.dataJson), byId))
      .map((r) => {
        const d = parse<StoredRun>(r.dataJson);
        return {
          id: r.id,
          templateId: d.templateId,
          templateName: d.templateName,
          templateExists: live.has(d.templateId),
          trigger: d.trigger,
          scheduleId: d.scheduleId,
          count: d.count,
          actorName: d.actorName,
          range: d.range,
          conditions: d.conditions,
          createdAt: r.createdAt.toISOString(),
        };
      })
      .filter((r) => !opts.scheduleId || r.scheduleId === opts.scheduleId),
  };
}

export async function deleteRun(user: SessionClaims, id: string) {
  await assertPermission(user, "reporting", "edit");
  const { rec, run } = await loadRun(user, id);
  await softDelete(user, rec.id);
  await audit(user, "RP01", "", "delete report run", { recordId: rec.id, note: run.templateName });
  return { ok: true, message: `Run of "${run.templateName}" removed from history` };
}

async function loadRun(user: SessionClaims, id: string) {
  const r = await prisma.heritageRecord.findFirst({ where: { id, institutionId: user.institutionId, screenId: SCREEN.run, deletedAt: null } });
  if (!r) throw httpError(404, "Report run not found", "NOT_FOUND");
  const run = parse<StoredRun>(r.dataJson);
  const templates = await listRecords<Template>(user.institutionId, SCREEN.template);
  if (!runVisible(user, r, run, new Map(templates.map((t) => [t.id, t])))) throw httpError(404, "Report run not found", "NOT_FOUND");
  return { rec: r, run };
}

/** A run inherits its template's audience; runs of deleted templates stay with whoever ran them (and administrators). */
function runVisible(user: SessionClaims, rec: { createdById: string | null }, run: StoredRun, templates: Map<string, Stored<Template>>) {
  const t = templates.get(run.templateId);
  if (t) return canSee(user, t);
  return rec.createdById === user.accountId || user.roles.includes("admin");
}

export async function getRun(user: SessionClaims, id: string) {
  await assertPermission(user, "reporting", "view");
  const { rec, run } = await loadRun(user, id);
  return { runId: rec.id, ...run, rows: run.rows.slice(0, RETURN_ROW_LIMIT), separators: undefined, shownRows: Math.min(run.rows.length, RETURN_ROW_LIMIT), createdAt: rec.createdAt.toISOString() };
}

function csvOf(run: StoredRun) {
  const esc = (v: Cell) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [run.columns.map((c) => esc(c.label)).join(","), ...run.rows.map((r) => r.map(esc).join(","))];
  if (run.totals) lines.push(run.totals.map(esc).join(","));
  return lines.join("\n");
}

function workbookOf(run: StoredRun) {
  const header: XlsxCell[] = run.columns.map((c) => c.label);
  const conditionRows: XlsxCell[][] = [
    [run.templateName],
    ...Object.entries(run.conditions).map(([k, v]) => [FILTERS[k as FilterKey]?.label ?? k, v]),
    ...(run.range ? [["Dates", `${run.range.from} to ${run.range.to}`]] : []),
  ];
  if (run.separateWorkbooksBy === "Report Type" || !run.separators?.length) {
    const rows = [header, ...run.rows, ...(run.totals ? [run.totals] : [])];
    return buildXlsx([
      { name: run.templateName, rows, boldRows: run.totals ? [0, rows.length - 1] : [0] },
      { name: "Conditions", rows: conditionRows, boldRows: [0] },
    ]);
  }
  const groups = new Map<string, Cell[][]>();
  run.rows.forEach((r, i) => groups.set(run.separators[i] ?? "Unassigned", [...(groups.get(run.separators[i] ?? "Unassigned") ?? []), r]));
  return buildXlsx([
    ...[...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, rows]) => ({ name, rows: [header, ...rows] as XlsxCell[][] })),
    { name: "Conditions", rows: conditionRows, boldRows: [0] },
  ]);
}

export async function exportRun(user: SessionClaims, id: string, format?: string) {
  await assertPermission(user, "reporting", "view");
  const { rec, run } = await loadRun(user, id);
  const fmt = (format ?? run.exportType ?? "Excel").toLowerCase();
  const base = `${run.templateName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "report"}-${day(rec.createdAt)}`;
  if (fmt === "csv") return { filename: `${base}.csv`, mime: "text/csv", base64: Buffer.from(csvOf(run), "utf8").toString("base64") };
  return { filename: `${base}.xlsx`, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base64: workbookOf(run).toString("base64") };
}

/* ------------------------------------------------------------------ */
/* Schedules                                                            */
/* ------------------------------------------------------------------ */

function tzOffsetMinutes(at: Date, tz: string) {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
        .formatToParts(at)
        .map((p) => [p.type, p.value]),
    );
    const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    return Math.round((asUtc - at.getTime()) / 60000);
  } catch {
    return 0;
  }
}

function zonedToUtc(dateStr: string, time: string, tz: string) {
  const guess = new Date(`${dateStr}T${time}:00Z`);
  return new Date(guess.getTime() - tzOffsetMinutes(guess, tz) * 60000);
}

export function nextRunAt(s: Pick<ScheduleData, "frequency" | "weekday" | "monthDay" | "time" | "timezone" | "startDate" | "endDate">, after: Date) {
  const startDay = s.startDate && /^\d{4}-\d{2}-\d{2}$/.test(s.startDate) ? s.startDate : "";
  let cursor = new Date(`${startDay && startDay > day(after) ? startDay : day(new Date(after.getTime() - 86_400_000))}T12:00:00Z`);
  for (let i = 0; i < 800; i++, cursor = new Date(cursor.getTime() + 86_400_000)) {
    const d = day(cursor);
    if (s.endDate && d > s.endDate) return null;
    if (s.frequency === "Weekly" && cursor.getUTCDay() !== s.weekday) continue;
    if (s.frequency === "Monthly" && cursor.getUTCDate() !== s.monthDay) continue;
    const at = zonedToUtc(d, s.time, s.timezone);
    if (at > after && (!startDay || d >= startDay)) return at;
  }
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeSchedule(input: ScheduleInput, base?: Partial<ScheduleData>) {
  const frequency = pick(input.frequency ?? base?.frequency, FREQUENCIES, "Weekly");
  const time = String(input.time ?? base?.time ?? "08:00");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw httpError(400, "Run time must be HH:MM (24-hour)");
  const weekday = Math.min(6, Math.max(0, Number(input.weekday ?? base?.weekday ?? 1) || 0));
  const monthDay = Math.min(28, Math.max(1, Number(input.monthDay ?? base?.monthDay ?? 1) || 1));
  const recipients = String(input.recipients ?? base?.recipients ?? "")
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter(Boolean);
  const bad = recipients.filter((e) => !EMAIL_RE.test(e));
  if (bad.length) throw httpError(400, `Invalid recipient e-mail: ${bad.join(", ")}`);
  const startDate = String(input.startDate ?? base?.startDate ?? "");
  const endDate = String(input.endDate ?? base?.endDate ?? "");
  for (const d of [startDate, endDate]) if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw httpError(400, "Schedule dates must be YYYY-MM-DD");
  if (startDate && endDate && endDate < startDate) throw httpError(400, "End date must be on or after the start date");
  const datePreset = pick(input.datePreset ?? base?.datePreset, ["None", ...DATE_PRESETS.filter((p) => p !== "Custom")] as const, "None");
  return { frequency, time, weekday, monthDay, recipients: recipients.join(", "), startDate, endDate, datePreset, format: pick(input.format ?? base?.format, EXPORT_TYPES, "Excel") };
}

async function createSchedule(user: SessionClaims, templateId: string, templateName: string, conditions: Record<string, string>, input: ScheduleInput) {
  const account = await prisma.account.findFirst({ where: { id: user.accountId }, select: { timezone: true } });
  const timezone = account?.timezone || "America/Vancouver";
  const n = normalizeSchedule(input);
  const next = nextRunAt({ ...n, timezone }, new Date());
  const data: ScheduleData = { templateId, templateName, conditions, ...n, timezone, active: true, nextRunAt: next?.toISOString() ?? null };
  const rec = await createRecord(user, SCREEN.schedule, data);
  await audit(user, "RP04", "", "create report schedule", { recordId: rec.id, after: data });
  return { id: rec.id, ...data };
}

function describeSchedule(s: ScheduleData) {
  const when = s.frequency === "Daily" ? "Daily" : s.frequency === "Weekly" ? `Weekly on ${WEEKDAYS[s.weekday]}` : `Monthly on day ${s.monthDay}`;
  return `${when} at ${s.time} (${s.timezone})`;
}

export async function listSchedules(user: SessionClaims) {
  await assertPermission(user, "reporting", "view");
  await ensureSeed(user);
  const inst = user.institutionId;
  const [schedules, accounts] = await Promise.all([
    listRecords<ScheduleData>(inst, SCREEN.schedule),
    prisma.account.findMany({ where: { institutionId: inst }, include: { person: true } }),
  ]);
  const names = new Map(accounts.map((a) => [a.id, `${a.person.givenName} ${a.person.familyName}`]));
  return {
    items: schedules
      .map((s) => ({ id: s.id, ...s.data, description: describeSchedule(s.data), createdBy: names.get(s.createdById) ?? "", createdAt: s.createdAt.toISOString() }))
      .sort((a, b) => (a.nextRunAt ?? "9").localeCompare(b.nextRunAt ?? "9")),
  };
}

export async function getSchedule(user: SessionClaims, id: string) {
  await assertPermission(user, "reporting", "view");
  const s = await getRecord<ScheduleData>(user.institutionId, SCREEN.schedule, id, "Schedule");
  return { id: s.id, ...s.data, description: describeSchedule(s.data) };
}

export async function updateSchedule(user: SessionClaims, id: string, body: ScheduleInput & { active?: boolean; conditions?: Record<string, string> }) {
  await assertPermission(user, "reporting", "edit");
  const inst = user.institutionId;
  const s = await getRecord<ScheduleData>(inst, SCREEN.schedule, id, "Schedule");
  const n = normalizeSchedule(body, s.data);
  let conditions = s.data.conditions;
  if (body.conditions) {
    const t = await getRecord<Template>(inst, SCREEN.template, s.data.templateId, "Report template");
    conditions = cleanConditions(t.data, body.conditions);
  }
  const active = body.active ?? s.data.active;
  const next = active ? nextRunAt({ ...n, timezone: s.data.timezone }, new Date()) : null;
  const data: ScheduleData = { ...s.data, ...n, conditions, active, nextRunAt: next?.toISOString() ?? null };
  await saveRecord(inst, user.accountId, id, data);
  await audit(user, "RP04", "", body.active === undefined ? "update report schedule" : active ? "resume report schedule" : "pause report schedule", { recordId: id, before: s.data, after: data });
  return { ok: true, id, message: active ? `Schedule saved — next run ${next ? stamp(next) + " UTC" : "none (ended)"}` : "Schedule paused" };
}

export async function deleteSchedule(user: SessionClaims, id: string) {
  await assertPermission(user, "reporting", "edit");
  const s = await getRecord<ScheduleData>(user.institutionId, SCREEN.schedule, id, "Schedule");
  await softDelete(user, id);
  await audit(user, "RP04", "", "delete report schedule", { recordId: id, before: s.data });
  return { ok: true, message: `Schedule for "${s.data.templateName}" deleted` };
}

async function executeSchedule(inst: string, actorId: string, actorName: string, scheduleId: string, s: ScheduleData) {
  const t = await prisma.heritageRecord.findFirst({ where: { id: s.templateId, institutionId: inst, screenId: SCREEN.template, deletedAt: null } });
  if (!t) throw new Error("Report template no longer exists");
  const template = parse<Template>(t.dataJson);
  const range = s.datePreset && s.datePreset !== "None" ? resolveRange(s.datePreset) : null;
  const result = await executeTemplate(inst, template, s.conditions, range);
  const run: StoredRun = {
    ...result,
    templateId: s.templateId,
    templateName: template.name,
    conditions: s.conditions,
    range: range ? { from: day(range.from), to: day(range.to) } : null,
    trigger: "schedule",
    scheduleId,
    separateWorkbooksBy: template.separateWorkbooksBy,
    exportType: s.format,
    actorName,
    truncated: result.rows.length > STORED_ROW_LIMIT,
  };
  const rec = await storeRun(inst, actorId, run);
  let mailed = 0;
  const recipients = s.recipients.split(",").map((e) => e.trim()).filter(Boolean);
  if (recipients.length && mailConfigured()) {
    const link = `${(process.env.WEB_PUBLIC_URL ?? "").replace(/\/$/, "")}/admin/reporting/scheduled?run=${rec.id}`;
    for (const email of recipients) {
      try {
        await sendMailViaHumanitix({
          email,
          title: `Scheduled report: ${template.name}`,
          message: `${template.name} ran on ${stamp(rec.createdAt)} UTC and returned ${result.count} row(s).\n\nDownload it from Scheduled Reports: ${link}`,
        });
        mailed++;
      } catch (err) {
        console.error("scheduled report mail failed", email, err);
      }
    }
  }
  return { runId: rec.id, count: result.count, mailed };
}

export async function runScheduleNow(user: SessionClaims, id: string) {
  await assertPermission(user, "reporting", "edit");
  const inst = user.institutionId;
  const s = await getRecord<ScheduleData>(inst, SCREEN.schedule, id, "Schedule");
  const out = await executeSchedule(inst, user.accountId, await actorLabel(user), id, s.data);
  await saveRecord(inst, user.accountId, id, { ...s.data, lastRunAt: new Date().toISOString(), lastRunId: out.runId, lastStatus: `OK — ${out.count} row(s)` });
  await audit(user, "RP04", "", "run report schedule now", { recordId: id, note: `${out.count} row(s), ${out.mailed} e-mail(s)` });
  return { ok: true, runId: out.runId, message: `${s.data.templateName}: ${out.count} row(s)${out.mailed ? `, e-mailed to ${out.mailed} recipient(s)` : ""}` };
}

/** Background sweep: runs every schedule whose next run time has passed. */
export async function runDueReportSchedules(now = new Date()) {
  const due = await prisma.heritageRecord.findMany({ where: { screenId: SCREEN.schedule, deletedAt: null }, take: 500 });
  let ran = 0;
  for (const rec of due) {
    const s = parse<ScheduleData>(rec.dataJson);
    if (!s.active || !s.nextRunAt || new Date(s.nextRunAt) > now) continue;
    let lastStatus: string;
    let lastRunId = s.lastRunId;
    try {
      const creator = await prisma.account.findFirst({
        where: { id: rec.createdById, institutionId: rec.institutionId },
        select: { status: true },
      });
      if (!creator || creator.status !== "active") throw new Error("Schedule owner account is not active");
      const access = await effectiveAccess(rec.institutionId, rec.createdById);
      if (!canEdit(access.permissions.reporting)) throw new Error("Schedule owner no longer has permission to run reports");
      const out = await executeSchedule(rec.institutionId, rec.createdById, "Scheduler", rec.id, s);
      lastStatus = `OK — ${out.count} row(s)${out.mailed ? `, ${out.mailed} e-mail(s)` : ""}`;
      lastRunId = out.runId;
      ran++;
    } catch (err) {
      lastStatus = `Failed — ${err instanceof Error ? err.message : "error"}`;
    }
    const next = nextRunAt(s, now);
    await prisma.heritageRecord.update({
      where: { id: rec.id },
      data: { dataJson: JSON.stringify({ ...s, lastRunAt: now.toISOString(), lastRunId, lastStatus, nextRunAt: next?.toISOString() ?? null }), rowVersion: { increment: 1 } },
    });
    await prisma.heritageAuditEntry.create({
      data: { institutionId: rec.institutionId, screenId: "RP04", contextKey: "", recordId: rec.id, action: "scheduled report run", actorId: rec.createdById, actorName: "Scheduler", note: `${s.templateName}: ${lastStatus}` },
    });
  }
  return { ran };
}
