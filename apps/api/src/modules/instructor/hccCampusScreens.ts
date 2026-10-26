import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { studentMetaMap } from "../admin/superAdmin.service.js";
import { agentCatalogue, fullName, profilesFor, s as str, staffAccounts, statusOf } from "../admin/heritage/students.core.js";
import { entityRecords } from "../admin/heritage/sysconfig.js";
import { STATUS_TREE } from "../admin/heritage/students.spec.js";
import { dateBoundsFromSessions, instructorDisplayName, scheduleTextFromSessions } from "../courses/sectionSchedule.js";
import { COURSE_STATUS_LABEL } from "../../lib/courseStatus.js";
import { UNASSIGNED_TERM } from "../../lib/sectionTerm.js";
import { FLAG_TYPES, listInstructorFlags } from "./instructorFlags.js";
import { loadSectionRunFacts, type SectionRunFacts } from "./myCoursesFacts.js";
import {
  FILTER_ALL_LABELS,
  NO_VALUE,
  PER_PAGE_OPTS,
  buildFilterMenu,
  selectableValues,
  serializeFilterMenu,
  type FilterKey,
  type FilterMenu,
} from "./studentFilterCatalog.js";

/** Class-session instants are shown in campus wall-clock time, not the server's (UTC) zone. */
const DISPLAY_TZ = process.env.INSTITUTION_TZ || "America/Vancouver";
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
function campusWeekday(d: Date) {
  return WEEKDAY_INDEX[d.toLocaleDateString("en-US", { timeZone: DISPLAY_TZ, weekday: "short" })] ?? d.getUTCDay();
}

/**
 * Status labels used by the instructor side-nav (`statusCounts[label]` lookups). Counts are always
 * computed from real students; these labels only alias admin status names that differ in spacing.
 */
export const STUDENT_STATUS_NAV_LABELS = [
  "New Inquiry",
  "Approved Application",
  "Pre-enrolment Application",
  "CLOA",
  "LOA",
  "Cancelled/ Did not proceed",
  "Follow Up",
  "In-active Leads",
  "Duplicate profiles",
  "Declined Application",
  "Registered Student",
  "Active Student",
  "On-Hold",
  "Leave of Absence",
  "Graduated",
  "Incomplete",
  "Withdrawn Students",
  "Dismissed",
  "Refused Visa",
  "File not Logged (Offshore student)",
  "Prospective Student (Marketing team)",
];

const FLAG_DESCRIPTIONS = [
  "Pending Withdrawn Form",
  "SABC application status to be verified",
  "LPT Missing!",
  "Confirmation Required: Status",
  "Confirmation Required: Intent to Enroll",
  "withdrawal Notice",
  "Check and update in progress classes",
  "SHOULD BE TERMINATED!",
  "Pending Fees",
  "Wrong Information on Documents",
  "Missing LPR",
  "Program start date discrepancy with SA form",
  "Missing English Test",
  "Payment",
  "Needs to update Finance",
  "Missing Contact",
  "No Show to the College since beginning",
  "SEC- Missing",
  "Finance Needs to update",
];

type SectionRow = {
  id: string;
  code: string;
  courseCode: string;
  courseTitle: string;
  termCode: string;
  enrolmentCount: number;
  enrolments: Array<{
    id: string;
    status: string;
    studentId: string;
    studentNumber: string;
    studentName: string;
    email: string;
  }>;
  assignments?: Array<{
    id: string;
    title: string;
    maxScore: number;
    weightPercent: number;
  }>;
};

type SessionRow = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  sectionCode: string;
  courseCode: string;
  joinUrl?: string | null;
};

/** In person / Online / Hybrid from the section's scheduled class sessions. */
function deliveryLabel(sessions: SessionRow[], sectionCode: string) {
  const mine = sessions.filter((s) => s.sectionCode === sectionCode);
  if (!mine.length) return "—";
  const inPerson = mine.some((s) => s.location?.trim());
  const online = mine.some((s) => s.joinUrl?.trim());
  return inPerson && online ? "Hybrid" : online ? "Online" : "In person";
}

function locationLabel(sessions: SessionRow[], sectionCode: string) {
  return sessions.find((s) => s.sectionCode === sectionCode && s.location?.trim())?.location?.trim() || "—";
}

function formatClock(d: Date) {
  return d.toLocaleTimeString("en-US", { timeZone: DISPLAY_TZ, hour: "numeric", minute: "2-digit" }).toLowerCase().replace(" ", "");
}

function formatYmd(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
}

function runRangeLabel(run?: { startsOn: string | null; endsOn: string | null }) {
  return run?.startsOn && run.endsOn
    ? `${formatYmd(run.startsOn)} - ${formatYmd(run.endsOn)}`
    : run?.startsOn
      ? `From ${formatYmd(run.startsOn)}`
      : "";
}

function scheduleLabel(sessions: SessionRow[], sectionCode: string, run?: { startsOn: string | null; endsOn: string | null }) {
  const mine = sessions.filter((s) => s.sectionCode === sectionCode);
  const runRange = runRangeLabel(run);
  if (!mine.length) return runRange ? `${runRange}\nTBA` : "TBA";
  const days = [...new Set(mine.map((s) => campusWeekday(s.startsAt)))].sort();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayLabel =
    days.length >= 4 && days[0] === 1 && days[days.length - 1] === 4
      ? "Mon-Thu"
      : days.length >= 5
        ? "Mon-Fri"
        : days.map((d) => dayNames[d]).join(", ");
  const first = mine[0]!;
  const end = first.endsAt ?? new Date(first.startsAt.getTime() + 90 * 60 * 1000);
  const startIso = first.startsAt.toLocaleDateString("en-US", { timeZone: DISPLAY_TZ, month: "short", day: "numeric", year: "numeric" });
  const endIso = end.toLocaleDateString("en-US", { timeZone: DISPLAY_TZ, month: "short", day: "numeric", year: "numeric" });
  return `${runRange || `${startIso} - ${endIso}`}\n${dayLabel}, ${formatClock(first.startsAt)} - ${formatClock(end)}`;
}

/** Section dates and timing on the same basis as My Courses (offering form, block, class sessions, then term). */
async function runFactsFor(ctx: { user?: { institutionId: string }; sections: SectionRow[] }) {
  return ctx.user?.institutionId
    ? await loadSectionRunFacts(ctx.user.institutionId, ctx.sections.map((s) => s.id))
    : new Map<string, SectionRunFacts>();
}

export async function buildHccMyCourses(
  ctx: {
    user: SessionClaims;
    displayName: string;
    sections: SectionRow[];
    classSessions: SessionRow[];
    term: { code: string; name: string } | null;
    terms?: Array<{ code: string; name: string; startsOn?: string; endsOn?: string }>;
  },
  path = "",
) {
  const qs = path.includes("?") ? new URLSearchParams(path.slice(path.indexOf("?") + 1)) : new URLSearchParams();
  const termFilter = (qs.get("term") || "All Terms").trim() || "All Terms";
  const statusFilter = (qs.get("status") || "Active & Upcoming Courses").trim() || "Active & Upcoming Courses";

  const termMeta = new Map(
    (ctx.terms ?? []).map((t) => [t.code, t] as const),
  );
  // Fallback labels from section codes when terms list is incomplete
  for (const s of ctx.sections) {
    if (!termMeta.has(s.termCode)) {
      termMeta.set(s.termCode, { code: s.termCode, name: s.termCode });
    }
  }

  const termOptions = [
    "All Terms",
    ...[...termMeta.values()]
      .map((t) => t.name || t.code)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b)),
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function termTiming(code: string): "current" | "upcoming" | "ended" | "unknown" {
    if (ctx.term?.code && code === ctx.term.code) return "current";
    const meta = termMeta.get(code);
    if (!meta?.startsOn && !meta?.endsOn) return "unknown";
    const start = meta.startsOn ? new Date(meta.startsOn) : null;
    const end = meta.endsOn ? new Date(meta.endsOn) : null;
    if (end && end < today) return "ended";
    if (start && start > today) return "upcoming";
    if (start && end && start <= today && end >= today) return "current";
    if (start && !end && start <= today) return "current";
    return "unknown";
  }

  const runFacts = await runFactsFor(ctx);
  const sectionTiming = (s: SectionRow) => runFacts.get(s.id)?.timing ?? termTiming(s.termCode);

  // Include sections with no enrolments so a newly created course can be opened and activities added.
  let filtered = ctx.sections;

  if (termFilter !== "All Terms") {
    filtered = filtered.filter((s) => {
      const meta = termMeta.get(s.termCode);
      const label = meta?.name || s.termCode;
      return label === termFilter || s.termCode === termFilter;
    });
  }

  if (/ended/i.test(statusFilter)) {
    filtered = filtered.filter((s) => sectionTiming(s) === "ended");
  } else if (/all courses/i.test(statusFilter)) {
    // no status narrowing
  } else {
    // Active & Upcoming (default)
    filtered = filtered.filter((s) => sectionTiming(s) !== "ended");
  }

  const sectionIds = filtered.map((s) => s.id);
  const attendanceRows =
    sectionIds.length && ctx.user?.institutionId
      ? await prisma.attendanceRecord.findMany({
          where: {
            institutionId: ctx.user.institutionId,
            sectionId: { in: sectionIds },
          },
          orderBy: { recordedAt: "desc" },
          take: 500,
          select: {
            sectionId: true,
            meetingLabel: true,
            status: true,
            recordedAt: true,
          },
        })
      : [];

  const attendanceBySection = new Map<
    string,
    { meetingLabel: string; recordedAt: Date; present: number; total: number }
  >();
  for (const row of attendanceRows) {
    const cur = attendanceBySection.get(row.sectionId);
    if (!cur) {
      attendanceBySection.set(row.sectionId, {
        meetingLabel: row.meetingLabel,
        recordedAt: row.recordedAt,
        present: /present|late/i.test(row.status) ? 1 : 0,
        total: 1,
      });
      continue;
    }
    // Same latest meeting only
    if (row.meetingLabel === cur.meetingLabel && Math.abs(row.recordedAt.getTime() - cur.recordedAt.getTime()) < 86_400_000) {
      cur.total += 1;
      if (/present|late/i.test(row.status)) cur.present += 1;
    }
  }

  const courses = filtered.map((s) => {
    const run = runFacts.get(s.id);
    const timing = sectionTiming(s);
    const status =
      timing === "ended" ? "Ended" : timing === "upcoming" ? COURSE_STATUS_LABEL.not_started : COURSE_STATUS_LABEL.in_progress;
    const att = attendanceBySection.get(s.id);
    const attendanceLabel = att
      ? `Taken ${att.meetingLabel} · ${att.present}/${att.total} present`
      : "Not taken yet";
    const attendanceTone = att ? ("ok" as const) : ("warn" as const);
    return {
      id: s.id,
      code: s.courseCode,
      section: s.code,
      title: s.courseTitle,
      role: "Instructor",
      delivery: run?.delivery || deliveryLabel(ctx.classSessions, s.code),
      students: `Enrolled: ${s.enrolmentCount}`,
      status,
      statusTone: (timing === "ended" ? "muted" : "active") as "muted" | "active",
      location: locationLabel(ctx.classSessions, s.code),
      schedule: scheduleLabel(ctx.classSessions, s.code, run),
      href: `/instructor/sections/${s.id}`,
      term: termMeta.get(s.termCode)?.name || s.termCode,
      attendanceLabel,
      attendanceTone,
      attendanceHref: `/instructor/attendance?sectionId=${encodeURIComponent(s.id)}`,
    };
  });

  return {
    title: "MY COURSES",
    subtitle: "",
    breadcrumbs: ["Home", "My Courses"],
    archetype: "hccMyCourses",
    hccMyCourses: {
      termFilter,
      statusFilter,
      termOptions,
      statusOptions: ["Active & Upcoming Courses", "All Courses", "Ended Courses"],
      courses,
    },
    countLabel: `${courses.length} course(s)`,
  };
}

export async function buildHccCourseEvaluations(
  ctx: {
    sections: SectionRow[];
    classSessions: SessionRow[];
    term: { code: string; name: string } | null;
    user?: { institutionId: string };
  },
  path = "",
) {
  const qs = path.includes("?") ? new URLSearchParams(path.slice(path.indexOf("?") + 1)) : new URLSearchParams();
  const sectionId = (qs.get("sectionId") || "").trim();

  const runFacts = await runFactsFor(ctx);
  const pool = ctx.sections.filter((s) => runFacts.get(s.id)?.timing !== "upcoming");

  if (sectionId) {
    const section = pool.find((s) => s.id === sectionId) ?? ctx.sections.find((s) => s.id === sectionId);
    if (section) {
      const evalRows = ctx.user?.institutionId
        ? await prisma.courseEvaluation.findMany({
            where: {
              institutionId: ctx.user.institutionId,
              OR: [{ sectionId: section.id }, { courseCode: section.courseCode }],
            },
            orderBy: { updatedAt: "desc" },
            take: 80,
          })
        : [];
      const submitted = evalRows.filter((r) => r.status === "submitted" && r.overallRating != null);
      const pending = evalRows.filter((r) => r.status === "pending");
      const avg =
        submitted.length > 0
          ? (submitted.reduce((sum, r) => sum + (r.overallRating ?? 0), 0) / submitted.length).toFixed(1)
          : "—";
      const responseRate =
        evalRows.length > 0 ? `${Math.round((submitted.length / evalRows.length) * 100)}%` : "0%";
      const comments = submitted.slice(0, 20).map((r) => {
        let text = "Student feedback submitted.";
        try {
          const parsed = r.responsesJson ? (JSON.parse(r.responsesJson) as { comment?: string }) : null;
          if (parsed?.comment) text = parsed.comment;
        } catch {
          /* keep default */
        }
        return {
          rating: (r.overallRating ?? 0).toFixed(1),
          text,
          term: `${ctx.term?.name ?? "Term"} · ${r.courseCode}`,
        };
      });
      return {
        title: `${section.courseCode} · Evaluation Results`,
        subtitle: `${section.courseTitle} · ${section.code}`,
        breadcrumbs: ["Home", "Course Evaluations", section.courseCode],
        archetype: "evaluations",
        primaryAction: "Back to evaluations",
        primaryActionHref: "/instructor/f/t36-course-evaluations",
        evaluations: {
          summary: [
            {
              label: "Overall Rating",
              value: String(avg),
              hint: submitted.length ? `From ${submitted.length} response(s)` : "No submitted ratings yet",
            },
            {
              label: "Response Rate",
              value: responseRate,
              hint: `${submitted.length}/${evalRows.length || 0} submitted`,
            },
            { label: "Pending", value: String(pending.length), hint: "Awaiting student response" },
            { label: "Section", value: section.code, hint: section.courseTitle },
          ],
          comments,
        },
        countLabel: `${submitted.length} response(s)`,
      };
    }
  }

  const rows = pool.map((s) => {
    const [dates, schedule] = scheduleLabel(ctx.classSessions, s.code, runFacts.get(s.id)).split("\n");
    return {
      id: s.id,
      course: s.courseCode,
      title: s.courseTitle,
      offering: s.code,
      evaluation: "End of course evaluation",
      dates: dates || "—",
      schedule: schedule || "TBA",
      href: `/instructor/f/t36-course-evaluations?sectionId=${encodeURIComponent(s.id)}`,
    };
  });
  return {
    title: "COURSE EVALUATION RESULTS",
    breadcrumbs: ["Home", "Course Evaluations"],
    archetype: "hccEvaluations",
    hccEvaluations: { rows },
    countLabel: `${rows.length} evaluation(s)`,
  };
}

export async function buildHccCourseHistory(ctx: {
  user?: { institutionId: string };
  displayName?: string;
  sections: SectionRow[];
  classSessions: SessionRow[];
  term: { code: string; name: string } | null;
  terms?: Array<{ code: string; name: string; startsOn?: string; endsOn?: string }>;
}) {
  const termMeta = new Map((ctx.terms ?? []).map((t) => [t.code, t]));
  const runFacts = await runFactsFor(ctx);

  const rows = ctx.sections
    .filter((s) => runFacts.get(s.id)?.timing === "ended")
    .map((s) => {
      const run = runFacts.get(s.id);
      const sessions = ctx.classSessions.filter((c) => c.sectionCode === s.code);
      const [dates, schedule] = scheduleLabel(ctx.classSessions, s.code, run).split("\n");
      return {
        id: s.id,
        course: s.courseCode,
        title: s.courseTitle,
        offering: s.code,
        room: sessions.find((x) => x.location)?.location || "TBA",
        dates: dates || "—",
        schedule: schedule || "TBA",
        instructor: ctx.displayName || "",
        term: termMeta.get(s.termCode)?.name || s.termCode || UNASSIGNED_TERM,
        startsOn: run?.startsOn ?? "",
        href: `/instructor/sections/${s.id}`,
      };
    })
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.offering.localeCompare(b.offering));

  return {
    title: "COURSE HISTORY",
    breadcrumbs: ["Home", "Course History"],
    archetype: "hccCourseHistory",
    hccCourseHistory: {
      rows: rows.map(({ startsOn: _s, ...rest }) => rest),
      empty: rows.length ? undefined : "No course history was found for your faculty record.",
    },
    countLabel: `${rows.length} course(s)`,
  };
}

export async function buildHccGradesSubmission(
  ctx: {
    sections: SectionRow[];
    term: { code: string; name: string } | null;
    grades?: Array<{ sectionCode: string; courseCode: string; status: string; score: number | null }>;
    displayName?: string;
    classSessions?: SessionRow[];
    terms?: Array<{ code: string; startsOn?: string; endsOn?: string }>;
  },
  path = "",
) {
  const qs = path.includes("?") ? new URLSearchParams(path.slice(path.indexOf("?") + 1)) : new URLSearchParams();
  const rawCourse = (qs.get("course") || "All Courses").trim() || "All Courses";
  const termByCode = new Map((ctx.terms ?? []).map((t) => [t.code, t]));
  function sectionDates(section: SectionRow) {
    const bounds = dateBoundsFromSessions((ctx.classSessions ?? []).filter((c) => c.sectionCode === section.code));
    const term = termByCode.get(section.termCode);
    return dateRangeLabel(bounds.startsOn ?? term?.startsOn, bounds.endsOn ?? term?.endsOn);
  }
  const rawStatus = (qs.get("status") || "Submission Required").trim() || "Submission Required";

  const pool = ctx.term
    ? ctx.sections.filter((s) => s.termCode === ctx.term!.code)
    : ctx.sections;

  // Use course codes as select values so the filter never returns a value that is not in the options
  // (that mismatch surfaces as an "invalid" control in the browser).
  const courseCodes = [...new Set(pool.map((s) => s.courseCode))].sort((a, b) => a.localeCompare(b));
  const courseOptions = ["All Courses", ...courseCodes];
  const statusOptions = ["Submission Required", "Submitted", "All Statuses"];

  function resolveCourseFilter(raw: string): string {
    if (!raw || raw === "All Courses") return "All Courses";
    if (courseOptions.includes(raw)) return raw;
    const code = raw.split(/[·|—–-]/)[0]?.trim() || raw;
    if (courseOptions.includes(code)) return code;
    const hit = pool.find(
      (s) =>
        s.courseCode === raw ||
        s.courseCode === code ||
        `${s.courseCode} · ${s.courseTitle}` === raw ||
        `${s.courseCode} (${s.code})` === raw,
    );
    return hit ? hit.courseCode : "All Courses";
  }

  function resolveStatusFilter(raw: string): string {
    if (statusOptions.includes(raw)) return raw;
    const lower = raw.toLowerCase();
    if (lower.includes("all")) return "All Statuses";
    if (lower.includes("submit") && !lower.includes("required")) return "Submitted";
    return "Submission Required";
  }

  const courseFilter = resolveCourseFilter(rawCourse);
  const statusFilter = resolveStatusFilter(rawStatus);

  const grades = ctx.grades ?? [];
  function sectionBoard(section: SectionRow) {
    const enrolled = section.enrolments.filter((e) => e.status === "enrolled");
    const assignmentCount = section.assignments?.length ?? 0;
    const mine = grades.filter((g) => g.sectionCode === section.code);
    const missingFromGrades = mine.filter(
      (g) => g.score == null || g.status === "draft" || g.status === "pending_publish",
    ).length;
    // Expected cells ≈ enrolled × assessments; if no grade rows yet, all are still open.
    const expected = assignmentCount > 0 ? enrolled.length * assignmentCount : enrolled.length;
    const scored = mine.filter((g) => g.score != null && g.status !== "draft" && g.status !== "pending_publish").length;
    const missing = assignmentCount > 0 ? Math.max(expected - scored, missingFromGrades) : enrolled.length;
    const open =
      enrolled.length === 0
        ? false
        : assignmentCount === 0
          ? true
          : missing > 0 || mine.some((g) => g.score == null || g.status === "draft" || g.status === "pending_publish");
    return {
      enrolled: enrolled.length,
      missing,
      status: (open ? "Submission Required" : "Submitted") as "Submission Required" | "Submitted",
    };
  }

  let rows = pool.map((s) => {
    const board = sectionBoard(s);
    return {
      id: s.id,
      course: s.courseCode,
      title: s.courseTitle,
      offering: s.code,
      status: board.status,
      gradingType: board.enrolled
        ? `Final Grades · ${board.enrolled} student(s) · ${board.missing} missing`
        : "Final Grades · no enrolled students",
      dates: sectionDates(s),
      href: `/instructor/gradebook?sectionId=${encodeURIComponent(s.id)}`,
      highlight: board.status === "Submission Required" && board.enrolled > 0,
      studentCount: board.enrolled,
      missingCount: board.missing,
    };
  });

  // Courses that still need grades first so the queue matches the submit workflow.
  rows.sort((a, b) => Number(b.highlight) - Number(a.highlight) || a.course.localeCompare(b.course));

  if (courseFilter !== "All Courses") {
    rows = rows.filter((r) => r.course === courseFilter);
  }
  if (statusFilter !== "All Statuses") {
    rows = rows.filter((r) => r.status === statusFilter);
  }

  return {
    title: "GRADES SUBMISSION",
    breadcrumbs: ["Home", "Grades Submission"],
    archetype: "hccGradesSubmission",
    hccGradesSubmission: {
      courseFilter,
      statusFilter,
      courseOptions,
      statusOptions,
      rows: rows.map(({ highlight: _h, studentCount: _s, missingCount: _m, ...rest }) => rest),
    },
    countLabel: `${rows.length} course(s)`,
  };
}

const GRADE_APPROVAL_TYPES = ["grade_publish", "grade.publish"];
const sectionIdOfSubject = (ref: string) => ref.replace(/^section:/, "");

function isElevated(user: SessionClaims) {
  return (user.roles ?? []).some((r) => r === "admin" || r === "registrar");
}

/** Instructors see their own teaching sections; admin / registrar see the whole institution. */
function teachingScope(user: SessionClaims): string | null {
  return isElevated(user) ? null : user.personId;
}

function dateRangeLabel(startsOn: string | null | undefined, endsOn: string | null | undefined) {
  if (startsOn && endsOn) return startsOn === endsOn ? startsOn : `${startsOn} - ${endsOn}`;
  return startsOn || endsOn || NO_VALUE;
}

/** Pending grade-publish approvals (the same queue admin reviews), scoped to the caller's sections. */
async function loadPendingGradeSubmissions(institutionId: string, scopePersonId: string | null) {
  const approvals = await prisma.approvalRequest.findMany({
    where: { institutionId, type: { in: GRADE_APPROVAL_TYPES }, status: "pending" },
    orderBy: { createdAt: "desc" },
  });
  const sectionIds = [...new Set(approvals.map((a) => sectionIdOfSubject(a.subjectRef)))];
  if (!sectionIds.length) return [];
  const sections = await prisma.section.findMany({
    where: {
      institutionId,
      id: { in: sectionIds },
      ...(scopePersonId ? { instructorPersonId: scopePersonId } : {}),
    },
    include: {
      course: true,
      term: true,
      classSessions: { orderBy: { startsAt: "asc" }, select: { startsAt: true, endsAt: true } },
      enrolments: { where: { status: "enrolled" }, select: { studentId: true } },
    },
  });
  if (!sections.length) return [];
  const sectionById = new Map(sections.map((x) => [x.id, x]));
  const [instructors, requesters, metaMap] = await Promise.all([
    prisma.person.findMany({ where: { id: { in: [...new Set(sections.map((x) => x.instructorPersonId))] } } }),
    prisma.account.findMany({
      where: { id: { in: [...new Set(approvals.map((a) => a.requestedBy))] } },
      include: { person: true },
    }),
    studentMetaMap(institutionId),
  ]);
  const instructorName = new Map(instructors.map((p) => [p.id, instructorDisplayName(p) ?? ""]));
  const requesterName = new Map(
    requesters.map((a) => [a.id, `${a.person.givenName} ${a.person.familyName}`.trim() || a.email]),
  );
  return approvals.flatMap((a) => {
    const sec = sectionById.get(sectionIdOfSubject(a.subjectRef));
    if (!sec) return [];
    const bounds = dateBoundsFromSessions(sec.classSessions);
    const campuses = [
      ...new Set(
        sec.enrolments
          .map((e) => str((metaMap[e.studentId] as Record<string, unknown> | undefined)?.campus).trim())
          .filter(Boolean),
      ),
    ].sort((x, y) => x.localeCompare(y));
    return [
      {
        approvalId: a.id,
        sectionId: sec.id,
        course: sec.course.code,
        title: sec.course.title,
        offering: sec.code,
        instructor: instructorName.get(sec.instructorPersonId) || NO_VALUE,
        campuses,
        dates: dateRangeLabel(bounds.startsOn ?? sec.term.startsOn, bounds.endsOn ?? sec.term.endsOn),
        submittedBy: requesterName.get(a.requestedBy) || NO_VALUE,
        submittedAt: a.createdAt,
      },
    ];
  });
}

export async function buildHccPendingGradeSubmissions(
  ctx: {
    user: SessionClaims;
    displayName: string;
  },
  path = "",
) {
  const qs = path.includes("?") ? new URLSearchParams(path.slice(path.indexOf("?") + 1)) : new URLSearchParams();
  const campusFilter = (qs.get("campus") || "All Campuses").trim() || "All Campuses";
  const courseFilter = (qs.get("course") || "All Courses").trim() || "All Courses";
  const facultyFilter = (qs.get("faculty") || "All Faculty / Instructors").trim() || "All Faculty / Instructors";

  const pending = await loadPendingGradeSubmissions(ctx.user.institutionId, teachingScope(ctx.user));

  const courseOptions = [
    "All Courses",
    ...[...new Set(pending.map((p) => `${p.course} · ${p.title}`))].sort((a, b) => a.localeCompare(b)),
  ];
  const campusOptions = [
    "All Campuses",
    ...[...new Set(pending.flatMap((p) => p.campuses))].sort((a, b) => a.localeCompare(b)),
  ];
  const facultyOptions = [
    "All Faculty / Instructors",
    ...[...new Set(pending.map((p) => p.instructor).filter((n) => n && n !== NO_VALUE))].sort((a, b) =>
      a.localeCompare(b),
    ),
  ];

  let rows = pending.map((p) => ({
    course: p.course,
    title: p.title,
    offering: p.offering,
    instructor: p.instructor,
    campuses: p.campuses,
    dates: p.dates,
    submittedBy: p.submittedBy,
    submittedAt: p.submittedAt.toLocaleDateString("en-US", {
      timeZone: DISPLAY_TZ,
      month: "short",
      day: "numeric",
      year: "numeric",
      weekday: "short",
    }),
    href: `/instructor/gradebook?sectionId=${encodeURIComponent(p.sectionId)}`,
    courseLabel: `${p.course} · ${p.title}`,
  }));

  if (campusFilter !== "All Campuses") {
    rows = rows.filter((r) => r.campuses.includes(campusFilter));
  }
  if (courseFilter !== "All Courses") {
    rows = rows.filter(
      (r) => r.courseLabel === courseFilter || r.course === courseFilter,
    );
  }
  if (facultyFilter !== "All Faculty / Instructors") {
    rows = rows.filter((r) => r.instructor === facultyFilter);
  }

  return {
    title: "PENDING GRADE SUBMISSIONS",
    breadcrumbs: ["Home", "Pending Grade Submissions"],
    archetype: "hccPendingGrades",
    hccPendingGrades: {
      campusFilter,
      courseFilter,
      facultyFilter,
      campusOptions,
      courseOptions,
      facultyOptions,
      rows: rows.map(({ courseLabel: _c, campuses: _camp, ...rest }) => rest),
    },
    countLabel: `${rows.length} submission(s)`,
  };
}

function localIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function attendanceLabel(status: string) {
  const v = (status || "").trim().toLowerCase();
  if (v === "present") return "Present";
  if (v === "absent") return "Absent";
  if (v === "late") return "Late";
  if (v === "excused") return "Excused";
  return "";
}

/** Real class-session timing for the section on the chosen date, else its usual weekly pattern. */
function sessionMetaForDate(sessions: SessionRow[], sectionCode: string, dateIso: string) {
  const mine = sessions.filter((x) => x.sectionCode === sectionCode);
  if (!mine.length) return "No class sessions scheduled for this section";
  const today = mine.filter((x) => localIsoDate(x.startsAt) === dateIso);
  if (today.length) {
    return today
      .map((x) => {
        const time = x.endsAt ? `${formatClock(x.startsAt)} - ${formatClock(x.endsAt)}` : formatClock(x.startsAt);
        return [x.title, time, x.location].filter(Boolean).join(" · ");
      })
      .join("; ");
  }
  const weekly = scheduleTextFromSessions(mine);
  return `No class session on this date${weekly ? ` · Usual schedule: ${weekly.split("\n").join("; ")}` : ""}`;
}

type AttendanceDraft = {
  savedAt?: string;
  finalized?: boolean;
  roster: Array<{ studentId: string; status: string; note?: string; sectionId?: string }>;
};

/** Unsubmitted "Save Draft" roster for this date (stored by the attendance action in screen state). */
async function loadAttendanceDraft(institutionId: string, dateIso: string): Promise<AttendanceDraft | null> {
  const keys = [`/instructor/attendance?date=${dateIso}`, "/instructor/attendance"];
  const states = await prisma.sisScreenState.findMany({ where: { institutionId, path: { in: keys } } });
  for (const key of keys) {
    const st = states.find((x) => x.path === key);
    if (!st) continue;
    let att: AttendanceDraft | undefined;
    try {
      att = (JSON.parse(st.payloadJson) as { attendance?: AttendanceDraft }).attendance;
    } catch {
      att = undefined;
    }
    if (!att || !Array.isArray(att.roster) || att.finalized) continue;
    // The bare path carries no date, so only trust it for drafts saved on the requested day.
    if (key === "/instructor/attendance" && (!att.savedAt || localIsoDate(new Date(att.savedAt)) !== dateIso)) continue;
    return att;
  }
  return null;
}

export async function buildHccAttendance(ctx: {
  user?: SessionClaims;
  sections: SectionRow[];
  classSessions: SessionRow[];
  term: { code: string; name: string } | null;
  dateIso?: string;
  sectionId?: string | null;
}) {
  const dateIso = /^\d{4}-\d{2}-\d{2}$/.test(ctx.dateIso || "") ? ctx.dateIso! : localIsoDate(new Date());
  const selected = ctx.sectionId ? ctx.sections.find((s) => s.id === ctx.sectionId) ?? null : null;
  const inTerm = ctx.term ? ctx.sections.filter((s) => s.termCode === ctx.term!.code) : ctx.sections;
  const termSections = inTerm.length ? inTerm : ctx.sections;
  const current = selected && !termSections.includes(selected) ? [...termSections, selected] : termSections;
  const sectionIds = current.map((s) => s.id);

  const [records, draft] = await Promise.all([
    sectionIds.length && ctx.user?.institutionId
      ? prisma.attendanceRecord.findMany({
          where: { institutionId: ctx.user.institutionId, sectionId: { in: sectionIds }, meetingLabel: dateIso },
          orderBy: { recordedAt: "desc" },
          select: { studentId: true, sectionId: true, status: true, note: true, recordedAt: true },
        })
      : Promise.resolve([]),
    ctx.user?.institutionId ? loadAttendanceDraft(ctx.user.institutionId, dateIso) : Promise.resolve(null),
  ]);
  const recordByKey = new Map<string, (typeof records)[number]>();
  for (const r of records) {
    const key = `${r.sectionId}:${r.studentId}`;
    if (!recordByKey.has(key)) recordByKey.set(key, r);
  }

  const groups = current.map((s) => {
    const enrolled = s.enrolments.filter((e) => e.status === "enrolled");
    const recorded = enrolled.filter((e) => recordByKey.has(`${s.id}:${e.studentId}`));
    const draftFor = (studentId: string) =>
      draft?.roster.find((r) => r.studentId === studentId && (!r.sectionId || r.sectionId === s.id));
    const students = enrolled.map((e) => {
      const rec = recordByKey.get(`${s.id}:${e.studentId}`);
      const pending = rec ? undefined : draftFor(e.studentId);
      return {
        id: e.studentId,
        name: e.studentName,
        studentNumber: e.studentNumber,
        // Empty status leaves both Present/Absent unselected: not yet marked for this date.
        status: rec ? attendanceLabel(rec.status) : pending ? attendanceLabel(pending.status) : "",
        note: rec ? rec.note || "" : pending?.note || "",
      };
    });

    let state: string;
    if (!enrolled.length) {
      state = "No enrolled students";
    } else if (recorded.length) {
      const tally = new Map<string, number>();
      for (const e of recorded) {
        const label = attendanceLabel(recordByKey.get(`${s.id}:${e.studentId}`)!.status);
        tally.set(label, (tally.get(label) ?? 0) + 1);
      }
      const parts = [...tally.entries()].map(([k, v]) => `${v} ${k}`).join(", ");
      const missing = enrolled.length - recorded.length;
      state = `Attendance submitted: ${parts}${missing ? ` · ${missing} not yet marked` : ""}`;
    } else if (students.some((st) => st.status)) {
      const saved = draft?.savedAt ? new Date(draft.savedAt) : null;
      state = `Draft saved${saved && !Number.isNaN(saved.getTime()) ? ` ${saved.toLocaleString("en-US", { timeZone: DISPLAY_TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""} · not submitted yet`;
    } else {
      state = "Attendance not yet taken for this date";
    }

    return {
      sectionId: s.id,
      course: s.courseCode,
      title: s.courseTitle,
      offering: s.code,
      meta: `${sessionMetaForDate(ctx.classSessions, s.code, dateIso)} · ${state}`,
      students,
    };
  });
  const d = new Date(`${dateIso}T12:00:00`);
  const label = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    weekday: "short",
  });
  const prev = new Date(d);
  prev.setDate(d.getDate() - 1);
  const next = new Date(d);
  next.setDate(d.getDate() + 1);
  const navLabel = (x: Date) =>
    x.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const selectedGroup = selected ? groups.find((g) => g.sectionId === selected.id) : undefined;
  const subtitle = selectedGroup
    ? `${selectedGroup.course} (${selectedGroup.offering}) — ${selectedGroup.title} · ${navLabel(d)} · ${sessionMetaForDate(ctx.classSessions, selectedGroup.offering, dateIso)}`
    : current.length
      ? `${current.map((s) => `${s.courseCode} (${s.code})`).join(", ")} · ${navLabel(d)}`
      : "No course sections are assigned to you";
  return {
    title: "COURSE ATTENDANCE",
    subtitle,
    breadcrumbs: ["Home", "Course Attendance"],
    archetype: "hccAttendance",
    primaryAction: "Submit Attendance",
    secondaryAction: "Save Draft",
    hccAttendance: {
      dateFilter: dateIso,
      studentFilter: "",
      courseFilter: selectedGroup ? `${selectedGroup.course} (${selectedGroup.offering})` : "All Courses",
      sectionId: selectedGroup?.sectionId ?? "",
      centerLabel: `ATTENDANCE FOR: ${label.toUpperCase()}`,
      prevLabel: navLabel(prev),
      nextLabel: navLabel(next),
      primaryAction: "Submit Attendance",
      secondaryAction: "Save Draft",
      groups,
    },
  };
}

export async function buildHccRepository() {
  return {
    title: "COURSE CONTENT REPOSITORY",
    breadcrumbs: ["Home", "Content Repository"],
    archetype: "hccRepository",
    hccRepository: {
      placeholder: "Enter Course Name / Number Here",
      rows: [] as Array<{ name: string; lms: string }>,
      empty: "No courses were found in the repository.",
    },
  };
}

export async function buildHccPendingSchedules(
  ctx: {
    user?: { institutionId: string };
    displayName: string;
    sections: SectionRow[];
    classSessions: SessionRow[];
    term: { code: string; name: string } | null;
  },
  path = "",
) {
  const qs = path.includes("?") ? new URLSearchParams(path.slice(path.indexOf("?") + 1)) : new URLSearchParams();
  const changeType = (qs.get("type") || "All Types").trim() || "All Types";
  const show = qs.get("show") === "1" || qs.get("show") === "true";

  const runFacts = await runFactsFor(ctx);
  const source = ctx.sections.filter((s) => runFacts.get(s.id)?.timing !== "ended");

  const allRows = source.map((s) => {
    const sessions = ctx.classSessions.filter((c) => c.sectionCode === s.code);
    const schedule = scheduleLabel(ctx.classSessions, s.code, runFacts.get(s.id));
    const loc = sessions.find((x) => x.location)?.location || "TBA";
    let type = "New Schedule";
    let status = "Needs Confirmation";
    let tone: "warning" | "danger" | "info" | "success" = "warning";
    if (sessions.length && loc !== "TBA") {
      type = "Schedule Update";
      status = "Ready to Approve";
      tone = "info";
    } else if (sessions.length) {
      type = "Schedule Change";
      status = "Conflict Detected";
      tone = "danger";
    }
    const requested = sessions[0]?.startsAt
      ? sessions[0].startsAt.toLocaleDateString("en-US", { timeZone: DISPLAY_TZ, month: "short", day: "numeric", year: "numeric" })
      : new Date().toLocaleDateString("en-US", { timeZone: DISPLAY_TZ, month: "short", day: "numeric", year: "numeric" });
    return {
      id: s.id,
      course: s.courseCode,
      offering: s.code,
      title: s.courseTitle,
      type,
      schedule,
      location: loc,
      requested,
      proposer: "Registrar Scheduling",
      status,
      tone,
      href: `/instructor/sections/${s.id}`,
    };
  });

  const changeTypeOptions = [
    "All Types",
    ...[...new Set(allRows.map((r) => r.type))].sort((a, b) => a.localeCompare(b)),
  ];

  const filtered =
    changeType === "All Types" ? allRows : allRows.filter((r) => r.type === changeType);

  const rows = show ? filtered : [];

  return {
    title: "PENDING COURSE SCHEDULES",
    breadcrumbs: ["Home", "Pending Course Schedules"],
    archetype: "hccPendingSchedules",
    countLabel: show ? `${rows.length} course(s)` : "Click Show Courses to load",
    hccPendingSchedules: {
      changeType,
      changeTypeOptions,
      show,
      rows,
      empty: show
        ? filtered.length === 0
          ? "No pending course schedules match this change type."
          : "No pending course schedules were found."
        : "Choose a change type, then click Show Courses.",
    },
  };
}

export async function buildHccTranscriptPending() {
  return {
    title: "PENDING TRANSCRIPT CHANGES",
    breadcrumbs: ["Home", "Pending Transcript Changes"],
    archetype: "hccTranscriptPending",
    hccTranscriptPending: {
      banner: "Currently no transcript changes are pending.",
    },
  };
}

function parseQueryFromPath(path: string) {
  try {
    return new URL(path, "http://local").searchParams;
  } catch {
    const q = path.includes("?") ? path.slice(path.indexOf("?") + 1) : "";
    return new URLSearchParams(q);
  }
}

/** Status names compare loosely so "Cancelled / Did not proceed" (admin) matches "Cancelled/ Did not proceed" (nav). */
const statusKey = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Admin's Student Statuses catalogue (System Configuration), falling back to the captured tree like admin does. */
async function studentStatusCatalogue(institutionId: string): Promise<string[]> {
  const recs = await entityRecords(institutionId, "studentStatuses");
  if (!recs.length) return STATUS_TREE.flatMap((x) => [x.name, ...(x.children ?? [])]);
  const order = (r: { data: Record<string, unknown> }) => Number(r.data._order ?? 0);
  return recs
    .filter((r) => !str(r.data.parent))
    .sort((a, b) => order(a) - order(b))
    .flatMap((root) => [
      str(root.data.name),
      ...recs
        .filter((c) => str(c.data.parent) === root.id)
        .sort((a, b) => order(a) - order(b))
        .map((c) => str(c.data.name)),
    ])
    .filter(Boolean);
}

function isAllFilter(value: string | null | undefined, allLabel: string) {
  const v = (value || "").trim();
  if (!v) return true;
  const lower = v.toLowerCase();
  if (lower === "all") return true;
  return lower === allLabel.toLowerCase() || lower.startsWith("all ");
}

type DirectoryStudent = {
  id: string;
  name: string;
  familyName: string;
  studentNumber: string;
  status: string;
  advisorNames: string[];
  program: string;
  programTerm: string;
  admissionTerm: string;
  date: string;
  /** Admin's Start / End date semantics: schedule start (or profile creation) and schedule end. */
  start: string;
  end: string;
  campus: string;
  pathway: string;
  schedule: string;
  nationality: string;
  agent: string;
};

/** Enrolments that make a student one of "my students" for the section's instructor. */
const TAUGHT_ENROLMENT_STATUSES = ["enrolled", "completed"];

/**
 * Directory rows built from the same sources the admin Students directory reads: Student / Person,
 * the `student-meta` store (status, campus, pathway, schedule, country, admission term), STU:PROFILE
 * (advisors, agent, schedule dates) and the student's current enrolled term. Nothing is derived or invented.
 */
async function loadDirectoryStudents(institutionId: string, scopePersonId: string | null): Promise<DirectoryStudent[]> {
  const [students, metaMap, advisors, agents] = await Promise.all([
    prisma.student.findMany({
      where: {
        institutionId,
        ...(scopePersonId
          ? {
              enrolments: {
                some: { status: { in: TAUGHT_ENROLMENT_STATUSES }, section: { instructorPersonId: scopePersonId } },
              },
            }
          : {}),
      },
      include: {
        person: true,
        enrolments: {
          where: { status: "enrolled" },
          include: { section: { include: { term: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: [{ person: { familyName: "asc" } }, { person: { givenName: "asc" } }],
      take: 5000,
    }),
    studentMetaMap(institutionId),
    staffAccounts(institutionId),
    agentCatalogue(institutionId),
  ]);
  const profiles = await profilesFor(
    institutionId,
    students.map((x) => x.id),
  );
  const advisorName = new Map(advisors.map((a) => [a.id, a.name]));
  const agentName = new Map(agents.map((a) => [a.id, a.name]));
  const orDash = (v: string | null | undefined) => (v ?? "").trim() || NO_VALUE;

  return students.map((st) => {
    const m = (metaMap[st.id] ?? {}) as Record<string, string | undefined>;
    const p = profiles.get(st.id);
    return {
      id: st.id,
      name: fullName(st.person),
      familyName: st.person.familyName || "",
      studentNumber: st.studentNumber,
      status: statusOf(m, st.enrolments.length),
      advisorNames: (p?.advisors ?? []).map((id) => advisorName.get(id) ?? "").filter(Boolean),
      program: orDash(st.programName),
      programTerm: orDash(st.enrolments[0]?.section.term.name),
      admissionTerm: orDash(m.admissionTerm),
      date: st.createdAt.toLocaleString("en-US", {
        timeZone: DISPLAY_TZ,
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      start: p?.scheduleStart || st.createdAt.toISOString().slice(0, 10),
      end: p?.scheduleEnd || "",
      campus: orDash(m.campus),
      pathway: orDash(m.pathway),
      schedule: orDash(m.schedule),
      nationality: orDash(m.country),
      agent: orDash(p?.agentId ? agentName.get(p.agentId) : ""),
    };
  });
}

export async function buildHccStudentsDirectory(user: SessionClaims, path: string) {
  const qs = parseQueryFromPath(path);
  const statusParam = (qs.get("status") || "").trim();
  const campusParam = (qs.get("campus") || "").trim();
  const programParam = (qs.get("program") || "").trim();
  const pathwayParam = (qs.get("pathway") || "").trim();
  const scheduleParam = (qs.get("schedule") || "").trim();
  const programTermParam = (qs.get("programTerm") || "").trim();
  const admissionTermParam = (qs.get("admissionTerm") || "").trim();
  const nationalityParam = (qs.get("nationality") || "").trim();
  const agentParam = (qs.get("agent") || "").trim();
  const advisorParam = (qs.get("advisor") || "").trim();
  const startDateParam = (qs.get("startDate") || "").trim();
  const endDateParam = (qs.get("endDate") || "").trim();
  const letterParam = (qs.get("letter") || "").trim().toUpperCase();
  const qParam = (qs.get("q") || "").trim().toLowerCase();
  const pageParam = Math.max(1, Number(qs.get("page") || "1") || 1);
  const perPageRaw = Number(qs.get("perPage") || "50") || 50;
  const perPage = PER_PAGE_OPTS.includes(String(perPageRaw)) ? perPageRaw : 50;

  const scope = teachingScope(user);
  const [enriched, statusCatalogue, pendingGrades] = await Promise.all([
    loadDirectoryStudents(user.institutionId, scope),
    studentStatusCatalogue(user.institutionId),
    loadPendingGradeSubmissions(user.institutionId, scope),
  ]);

  const census = new Map<string, { label: string; count: number }>();
  for (const label of statusCatalogue) {
    if (!census.has(statusKey(label))) census.set(statusKey(label), { label, count: 0 });
  }
  for (const st of enriched) {
    const entry = census.get(statusKey(st.status)) ?? { label: st.status, count: 0 };
    entry.count += 1;
    census.set(statusKey(st.status), entry);
  }

  const sidebar = [...census.values()].map((c) => ({
    label: c.label,
    count: c.count,
    href: `/instructor/f/t12-students-view?status=${encodeURIComponent(c.label)}`,
    active: statusParam ? statusKey(statusParam) === statusKey(c.label) : false,
  }));

  const directoryTotal = enriched.length;

  let filtered = enriched;
  if (!isAllFilter(statusParam, "All Statuses")) {
    filtered = filtered.filter((st) => statusKey(st.status) === statusKey(statusParam));
  }
  if (!isAllFilter(campusParam, "All Campuses")) {
    filtered = filtered.filter((st) => st.campus === campusParam);
  }
  if (!isAllFilter(programParam, "All Programs")) {
    filtered = filtered.filter((st) => st.program === programParam);
  }
  if (!isAllFilter(pathwayParam, "All Pathways")) {
    filtered = filtered.filter((st) => st.pathway === pathwayParam);
  }
  if (!isAllFilter(scheduleParam, "All Schedules")) {
    filtered = filtered.filter((st) => st.schedule === scheduleParam);
  }
  if (!isAllFilter(programTermParam, "All Program Terms")) {
    filtered = filtered.filter((st) => st.programTerm === programTermParam);
  }
  if (!isAllFilter(admissionTermParam, "All Admission Terms")) {
    filtered = filtered.filter((st) => st.admissionTerm === admissionTermParam);
  }
  if (!isAllFilter(nationalityParam, "All Nationalities")) {
    filtered = filtered.filter((st) => st.nationality === nationalityParam);
  }
  if (!isAllFilter(agentParam, "All Agents")) {
    filtered = filtered.filter((st) => st.agent === agentParam);
  }
  if (!isAllFilter(advisorParam, "All Advisors")) {
    filtered = filtered.filter((st) => st.advisorNames.includes(advisorParam));
  }
  if (startDateParam) {
    filtered = filtered.filter((st) => st.start >= startDateParam);
  }
  if (endDateParam) {
    filtered = filtered.filter((st) => (st.end || st.start) <= endDateParam);
  }
  if (letterParam && letterParam !== "ALL") {
    filtered = filtered.filter((st) => st.familyName.toUpperCase().startsWith(letterParam));
  }
  if (qParam) {
    filtered = filtered.filter(
      (st) =>
        st.name.toLowerCase().includes(qParam) ||
        st.studentNumber.toLowerCase().includes(qParam) ||
        st.program.toLowerCase().includes(qParam),
    );
  }

  const resultCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(resultCount / perPage));
  const page = Math.min(pageParam, totalPages);
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);

  const rows = pageRows.map((st) => ({
    id: st.id,
    name: st.name,
    studentNumber: st.studentNumber,
    status: st.status,
    advisors: st.advisorNames.join(", ") || NO_VALUE,
    program: st.program,
    programTerm: st.programTerm,
    admissionTerm: st.admissionTerm,
    date: st.date,
    campus: st.campus,
    pathway: st.pathway,
    schedule: st.schedule,
    nationality: st.nationality,
    agent: st.agent,
  }));

  const title =
    statusParam && !isAllFilter(statusParam, "All Statuses")
      ? `STUDENTS: ${statusParam.toUpperCase()}`
      : "STUDENTS";

  const flagCount = await prisma.portalRecord.count({
    where: { institutionId: user.institutionId, screenPath: "/instructor/f/t45-student-flags", role: "instructor" },
  });

  const menus: Record<FilterKey, FilterMenu> = {
    campus: buildFilterMenu(FILTER_ALL_LABELS.campus, enriched.map((st) => st.campus)),
    program: buildFilterMenu(FILTER_ALL_LABELS.program, enriched.map((st) => st.program)),
    pathway: buildFilterMenu(FILTER_ALL_LABELS.pathway, enriched.map((st) => st.pathway)),
    schedule: buildFilterMenu(FILTER_ALL_LABELS.schedule, enriched.map((st) => st.schedule)),
    programTerm: buildFilterMenu(FILTER_ALL_LABELS.programTerm, enriched.map((st) => st.programTerm)),
    admissionTerm: buildFilterMenu(FILTER_ALL_LABELS.admissionTerm, enriched.map((st) => st.admissionTerm)),
    nationality: buildFilterMenu(FILTER_ALL_LABELS.nationality, enriched.map((st) => st.nationality)),
    status: buildFilterMenu(FILTER_ALL_LABELS.status, sidebar.filter((x) => x.count > 0).map((x) => x.label), true),
    agent: buildFilterMenu(FILTER_ALL_LABELS.agent, enriched.map((st) => st.agent)),
    advisor: buildFilterMenu(FILTER_ALL_LABELS.advisor, enriched.flatMap((st) => st.advisorNames)),
  };
  const filterMenus = Object.fromEntries(
    Object.entries(menus).map(([k, m]) => [k, serializeFilterMenu(m)]),
  ) as Record<FilterKey, ReturnType<typeof serializeFilterMenu>>;
  const filterOptions: Record<string, string[]> = Object.fromEntries(
    Object.entries(menus).map(([k, m]) => [k, [m.all, ...selectableValues(m)]]),
  );

  return {
    title,
    breadcrumbs: ["Home", "Students"],
    archetype: "hccStudents",
    hccStudents: {
      filters: {
        campus: campusParam || "All Campuses",
        program: programParam || "All Programs",
        pathway: pathwayParam || "All Pathways",
        schedule: scheduleParam || "All Schedules",
        programTerm: programTermParam || "All Program Terms",
        admissionTerm: admissionTermParam || "All Admission Terms",
        nationality: nationalityParam || "All Nationalities",
        status: statusParam || "All Statuses",
        agent: agentParam || "All Agents",
        advisor: advisorParam || "All Advisors",
        startDate: startDateParam || "",
        endDate: endDateParam || "",
      },
      filterOptions,
      filterMenus,
      perPageOptions: PER_PAGE_OPTS,
      letter: letterParam || "ALL",
      sidebar,
      management: [
        { label: "Browse All Students", href: "/instructor/f/t12-students-view", count: directoryTotal },
        { label: "Create Student Profile", href: "/instructor/f/t43-create-student-profile" },
        { label: "Academic Alerts", href: "/instructor/f/t44-academic-alerts", count: 0 },
        { label: "Student Flags", href: "/instructor/f/t45-student-flags", count: flagCount },
        { label: "Student Assessments", href: "/instructor/f/t46-student-assessments", count: 0 },
        { label: "Student Requirements", href: "/instructor/f/t47-student-requirements", count: 0 },
        { label: "Leave of Absence", href: "/instructor/f/t48-leave-of-absence", count: 0 },
        { label: "Course Withdraw Requests", href: "/instructor/f/t49-course-withdraw-requests", count: 0 },
        { label: "Pending Grade Submissions", href: "/instructor/f/t62-pending-grade-submissions", count: pendingGrades.length },
        { label: "Pending Transcript Changes", href: "/instructor/f/t64-pending-transcript-changes", count: 0 },
        { label: "Pending Entry / Progress Marks", href: "/instructor/f/t62-pending-grade-submissions", count: 0 },
        { label: "Badges / Accomplishments", href: "/instructor/f/t34-accomplishments", count: 0 },
      ],
      results: resultCount,
      perPage,
      page,
      totalPages,
      rows,
      empty: rows.length === 0 ? "No students were found matching your search criteria." : null,
    },
    countLabel: `${resultCount} student(s)`,
  };
}

export async function buildHccStudentFlags(user: SessionClaims) {
  const raised = await listInstructorFlags(user);
  const seesAll = user.roles.includes("admin") || user.roles.includes("registrar");
  const rows = await prisma.portalRecord.findMany({
    where: {
      institutionId: user.institutionId,
      screenPath: "/instructor/f/t45-student-flags",
      role: "instructor",
      ...(seesAll ? {} : { audienceAccountId: user.accountId }),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 60,
  });
  const mapped = rows.map((r) => {
    let meta: { hold?: string; status?: string; date?: string } = {};
    try {
      meta = r.metaText ? (JSON.parse(r.metaText) as typeof meta) : {};
    } catch {
      meta = {};
    }
    return {
      id: r.id,
      student: r.primaryText,
      description: r.secondaryText || "",
      status: meta.status || "Active",
      resolved: "No",
      appliesHold: meta.hold || "No",
      date: meta.date || r.createdAt.toISOString().slice(0, 10),
      canEdit: false,
      href: "",
    };
  });
  const all = [...raised, ...mapped];
  return {
    title: "Student Flags",
    subtitle: seesAll ? `${all.length} student flag(s)` : `${all.length} flag(s) you have raised`,
    breadcrumbs: ["Home", "Student Flags"],
    archetype: "hccFlags",
    hccFlags: {
      campus: "ALL CAMPUSES",
      status: "Active",
      resolved: "No",
      template: "All Flags",
      results: all.length,
      rows: all,
      flagTypes: FLAG_TYPES,
    },
    countLabel: `${all.length} flag(s)`,
  };
}

export async function buildHccEmptyTable(title: string, crumbs: string[], empty: string) {
  return {
    title,
    breadcrumbs: crumbs,
    archetype: "hccEmpty",
    hccEmpty: { empty },
  };
}

/**
 * Real per-status student counts. Pass the session to scope to the instructor's own students
 * (admin / registrar see everyone); a bare institution id counts the whole institution.
 */
export async function loadStudentStatusCounts(who: string | SessionClaims) {
  const institutionId = typeof who === "string" ? who : who.institutionId;
  const scope = typeof who === "string" ? null : teachingScope(who);
  const [students, catalogue, flagCount] = await Promise.all([
    loadDirectoryStudents(institutionId, scope),
    studentStatusCatalogue(institutionId),
    prisma.portalRecord.count({
      where: { institutionId, screenPath: "/instructor/f/t45-student-flags", role: "instructor" },
    }),
  ]);
  const byKey = new Map<string, number>();
  for (const st of students) byKey.set(statusKey(st.status), (byKey.get(statusKey(st.status)) ?? 0) + 1);
  const byLabel: Record<string, number> = {};
  for (const label of [...catalogue, ...STUDENT_STATUS_NAV_LABELS, ...students.map((st) => st.status)]) {
    byLabel[label] = byKey.get(statusKey(label)) ?? 0;
  }
  return { byLabel, total: students.length, flagCount };
}

export { FLAG_DESCRIPTIONS };
