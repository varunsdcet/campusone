import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { studentCareerOpportunityHref } from "../../lib/careerOpportunityLink.js";
import { currentTerm } from "../../lib/currentTerm.js";
import {
  toPortalRowsFromAssessments,
  toPortalRowsFromAttendance,
  toPortalRowsFromCredentials,
  toPortalRowsFromFinance,
  toPortalRowsFromLectures,
  toPortalRowsFromPracticum,
  toPortalRowsFromResources,
  toPortalRowsFromServices,
} from "../student/surfaces.service.js";
import {
  activeFlags,
  adminStatusAndCgpa,
  contentProgress,
  currentStudent,
  personStudentIds,
  studentAnnouncements,
} from "../me/studentAlignment.js";

function studentFor(user: SessionClaims) {
  return currentStudent(user.institutionId, user.personId);
}

export type PortalRow = {
  primary: string;
  secondary?: string;
  meta?: string;
  href?: string;
};

export type PortalAction = {
  label: string;
  href?: string;
  action?: string;
  payload?: Record<string, unknown>;
  variant?: "primary" | "secondary" | "ai";
};

export type PortalView = {
  path: string;
  title: string;
  subtitle: string;
  role: "student" | "instructor" | "admin" | "applicant" | "employer";
  active: string;
  breadcrumb: string[];
  metrics: Array<{ label: string; value: string; hint?: string }>;
  sections: Array<{ title: string; rows: PortalRow[] }>;
  actions: PortalAction[];
  live: true;
};

function roleFor(user: SessionClaims, path: string): PortalView["role"] {
  const requested: PortalView["role"] = path.startsWith("/admin")
    ? "admin"
    : path.startsWith("/instructor") || path.startsWith("/m/instructor")
      ? "instructor"
      : path.startsWith("/applicant")
        ? "applicant"
        : path.startsWith("/employer")
          ? "employer"
          : "student";
  const permitted =
    (requested === "admin" && (user.roles.includes("admin") || user.roles.includes("registrar"))) ||
    (requested === "instructor" && user.roles.includes("instructor")) ||
    (requested === "applicant" && user.roles.includes("applicant")) ||
    (requested === "employer" && user.roles.includes("employer")) ||
    (requested === "student" && user.roles.includes("student"));
  if (!permitted) {
    throw Object.assign(new Error("Forbidden"), { code: "FORBIDDEN", status: 403 });
  }
  return requested;
}

function titleFromPath(path: string): string {
  const leaf = path.split("/").filter(Boolean).pop() ?? "Home";
  if (leaf === "student" || leaf === "instructor" || leaf === "admin" || leaf === "applicant" || leaf === "employer") {
    return "Home";
  }
  return leaf
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function institutionMeta(institutionId: string) {
  const [institution, term] = await Promise.all([
    prisma.institution.findFirst({ where: { institutionId } }),
    currentTerm(institutionId),
  ]);
  return {
    institutionName: institution?.name ?? "Heritage College",
    campus: institution ? `${institution.city}, ${institution.region}` : "Surrey, BC",
    termName: term?.name ?? "Fall 2026",
    termCode: term?.code ?? "2026F",
  };
}

async function portalRows(institutionId: string, path: string, accountId?: string) {
  const rows = await prisma.portalRecord.findMany({
    where: {
      institutionId,
      screenPath: path,
      OR: [{ audienceAccountId: null }, ...(accountId ? [{ audienceAccountId: accountId }] : [])],
    },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((r) => ({
    primary: r.primaryText,
    secondary: r.secondaryText ?? undefined,
    meta: r.metaText ?? undefined,
    href: r.href ?? undefined,
  }));
}

async function coursesFor(user: SessionClaims): Promise<PortalRow[]> {
  if (user.roles.includes("admin") || user.roles.includes("registrar")) {
    const sections = await prisma.section.findMany({
      where: { institutionId: user.institutionId },
      include: { course: true, term: true, _count: { select: { enrolments: true } } },
    });
    return sections.map((s) => ({
      primary: `${s.course.code} · ${s.course.title}`,
      secondary: `${s.code} · ${s.term.code} · ${s._count.enrolments} enrolled`,
      meta: "Active",
      href: `/admin/sections`,
    }));
  }
  if (user.roles.includes("instructor")) {
    const sections = await prisma.section.findMany({
      where: { institutionId: user.institutionId, instructorPersonId: user.personId },
      include: { course: true, term: true, _count: { select: { enrolments: true } } },
    });
    return sections.map((s) => ({
      primary: `${s.course.code} · ${s.course.title}`,
      secondary: `${s.code} · ${s._count.enrolments} students`,
      meta: s.term.code,
      href: `/instructor/sections/${s.id}`,
    }));
  }
  const student = await studentFor(user);
  if (!student) return [];
  const enrolments = await prisma.enrolment.findMany({
    where: { institutionId: user.institutionId, studentId: student.id, status: "enrolled" },
    include: { section: { include: { course: true, term: true } } },
  });
  const instructorIds = [...new Set(enrolments.map((e) => e.section.instructorPersonId))];
  const instructors = await prisma.person.findMany({
    where: { id: { in: instructorIds }, institutionId: user.institutionId },
  });
  const names = new Map(instructors.map((p) => [p.id, `${p.givenName} ${p.familyName}`]));
  return enrolments.map((e) => ({
    primary: `${e.section.course.code} · ${e.section.course.title}`,
    secondary: `${e.section.code} · ${names.get(e.section.instructorPersonId) ?? "TBA"} · ${e.section.course.credits} credits`,
    meta: e.status,
    href: `/student/courses/${e.sectionId}`,
  }));
}

async function gradesFor(user: SessionClaims): Promise<{ metrics: PortalView["metrics"]; rows: PortalRow[] }> {
  const student = await studentFor(user);
  if (!student) return { metrics: [], rows: [] };
  const grades = await prisma.gradeItem.findMany({
    where: { institutionId: user.institutionId, studentId: student.id, status: "published" },
    include: { assignment: { include: { section: { include: { course: true } } } } },
    orderBy: { updatedAt: "desc" },
  });
  const published = grades.filter((g) => g.status === "published");
  const rows = published.map((g) => ({
    primary: `${g.assignment.section.course.code} · ${g.assignment.title}`,
    secondary: `Status: ${g.status}`,
    meta: g.score != null ? `${g.score}/${g.maxScore} ${g.letter ?? ""}`.trim() : "Pending",
    href: "/student/grades",
  }));
  const avg =
    published.length > 0
      ? (published.reduce((n, g) => n + ((g.score ?? 0) / g.maxScore) * 100, 0) / published.length).toFixed(1)
      : "—";
  return {
    metrics: [
      { label: "Items", value: String(published.length) },
      { label: "Published", value: String(published.length) },
      { label: "Avg %", value: String(avg) },
    ],
    rows,
  };
}

async function calendarFor(user: SessionClaims): Promise<PortalRow[]> {
  let sectionIds: string[] = [];
  if (user.roles.includes("admin") || user.roles.includes("registrar")) {
    const sections = await prisma.section.findMany({
      where: { institutionId: user.institutionId },
      select: { id: true },
    });
    sectionIds = sections.map((section) => section.id);
  } else if (user.roles.includes("instructor")) {
    const sections = await prisma.section.findMany({
      where: { institutionId: user.institutionId, instructorPersonId: user.personId },
      select: { id: true },
    });
    sectionIds = sections.map((section) => section.id);
  } else {
    const student = await studentFor(user);
    if (student) {
      const enrolments = await prisma.enrolment.findMany({
        where: {
          institutionId: user.institutionId,
          studentId: student.id,
          status: { in: ["enrolled", "completed"] },
        },
        select: { sectionId: true },
      });
      sectionIds = enrolments.map((enrolment) => enrolment.sectionId);
    }
  }
  const assignments = await prisma.assignment.findMany({
    where: {
      institutionId: user.institutionId,
      sectionId: { in: sectionIds },
      dueAt: { not: null },
    },
    include: { section: { include: { course: true } } },
    orderBy: { dueAt: "asc" },
    take: 20,
  });
  const rows = assignments.map((a) => ({
    primary: `${a.section.course.code} · ${a.title}`,
    secondary: a.dueAt ? new Date(a.dueAt).toLocaleString() : "TBA",
    meta: "Deadline",
    href: user.roles.includes("instructor") ? "/instructor/assessments" : "/student/assessments",
  }));
  return rows;
}

async function notificationsFor(user: SessionClaims): Promise<PortalRow[]> {
  const items = await prisma.notification.findMany({
    where: { institutionId: user.institutionId, recipientAccountId: user.accountId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return items.map((n) => ({
    primary: n.title,
    secondary: n.body,
    meta: n.readAt ? "Read" : "Unread",
    href: user.roles.includes("instructor")
      ? "/instructor/notifications"
      : user.roles.includes("admin") || user.roles.includes("registrar")
        ? "/admin/notifications"
        : "/student/notifications",
  }));
}

async function messagesFor(user: SessionClaims): Promise<PortalRow[]> {
  const threads = await prisma.messageThread.findMany({
    where: {
      institutionId: user.institutionId,
      participantAccountIdsJson: { contains: user.accountId },
    },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { updatedAt: "desc" },
    take: 30,
  });
  return threads.map((t) => ({
    primary: t.subject,
    secondary: t.messages[0]?.body ?? "No messages yet",
    meta: t.messages[0] ? new Date(t.messages[0].createdAt).toLocaleString() : "",
    href: user.roles.includes("instructor") ? "/instructor/messages" : "/student/messages",
  }));
}

async function approvalsFor(user: SessionClaims): Promise<PortalRow[]> {
  const items = await prisma.approvalRequest.findMany({
    where: { institutionId: user.institutionId },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  return items.map((a) => ({
    primary: `${a.type} · ${a.status}`,
    secondary: a.subjectRef,
    meta: new Date(a.createdAt).toLocaleString(),
    href: "/admin/approvals",
  }));
}

async function peopleFor(user: SessionClaims): Promise<PortalRow[]> {
  const people = await prisma.person.findMany({
    where: { institutionId: user.institutionId },
    include: { accounts: true, students: true },
    orderBy: { familyName: "asc" },
  });
  return people.map((p) => {
    const roles = p.accounts[0] ? JSON.parse(p.accounts[0].rolesJson) as string[] : [];
    return {
      primary: `${p.givenName} ${p.familyName}`,
      secondary: p.email,
      meta: roles.join(", ") || (p.students[0]?.studentNumber ?? "Person"),
      href: "/admin/users",
    };
  });
}

async function rosterFor(user: SessionClaims): Promise<PortalRow[]> {
  const sections = await prisma.section.findMany({
    where: user.roles.includes("instructor")
      ? { institutionId: user.institutionId, instructorPersonId: user.personId }
      : { institutionId: user.institutionId },
    include: {
      course: true,
      enrolments: { include: { student: { include: { person: true } } } },
    },
  });
  const rows: PortalRow[] = [];
  for (const s of sections) {
    for (const e of s.enrolments) {
      rows.push({
        primary: `${e.student.person.givenName} ${e.student.person.familyName}`,
        secondary: `${s.course.code} · ${e.student.studentNumber} · ${e.student.programName}`,
        meta: e.student.standing,
        href: "/instructor/roster",
      });
    }
  }
  return rows;
}

export async function buildPortalView(user: SessionClaims, path: string): Promise<PortalView> {
  const role = roleFor(user, path);
  if (role === "applicant") {
    const { buildApplicantView } = await import("../applicant/applicant.service.js");
    return buildApplicantView(user, path);
  }
  if (role === "employer") {
    const { buildEmployerView } = await import("../employer/employer.service.js");
    return buildEmployerView(user, path);
  }
  const meta = await institutionMeta(user.institutionId);
  const title = titleFromPath(path);
  const active =
    path.includes("/approvals")
      ? "Approvals Inbox"
      : path.endsWith(`/${role}`) || path === `/${role}`
        ? role === "admin"
          ? "Overview"
          : "Home"
        : title;
  const breadcrumb = [role === "instructor" ? "Teacher" : role[0]!.toUpperCase() + role.slice(1), title];

  const base: PortalView = {
    path,
    title,
    subtitle: `${meta.termName} · ${meta.campus}`,
    role,
    active,
    breadcrumb,
    metrics: [
      { label: "Institution", value: meta.institutionName },
      { label: "Term", value: meta.termCode },
      { label: "Campus", value: meta.campus },
    ],
    sections: [],
    actions: [],
    live: true,
  };

  const normalized = path.replace(/\/demo$/, "").replace(/\/$/, "") || path;

  if (role === "student") {
    const { buildMobileScreen } = await import("./mobileScreens.js");
    const mobile = await buildMobileScreen(user, normalized, base);
    if (mobile) return mobile;
  }

  if (role === "student" && (normalized.endsWith("/continue") || normalized.endsWith("/modules"))) {
    const student = await studentFor(user);
    const progress = student ? await contentProgress(user, student.id) : [];
    const totalItems = progress.reduce((n, c) => n + c.totalCount, 0);
    const doneItems = progress.reduce((n, c) => n + c.completedCount, 0);
    base.metrics = [
      { label: "Enrolled courses", value: String(progress.length) },
      { label: "Items completed", value: totalItems ? `${doneItems}/${totalItems}` : "—" },
      { label: "Term", value: meta.termCode },
    ];
    if (normalized.endsWith("/continue")) {
      base.title = "Continue learning";
      const ordered = [...progress].sort(
        (a, b) => Number(Boolean(b.next)) - Number(Boolean(a.next)) || (a.progressPct ?? 0) - (b.progressPct ?? 0),
      );
      base.sections = [
        {
          title: "Pick up where you left off",
          rows: ordered.map((c) => ({
            primary: `${c.courseCode} · ${c.courseTitle}`,
            secondary: c.next
              ? `Next: ${c.next.kind} · ${c.next.title}`
              : c.totalCount
                ? "All published content completed"
                : "No content published yet",
            meta: c.progressPct != null ? `${c.progressPct}% · ${c.completedCount}/${c.totalCount}` : "—",
            href: c.next?.href ?? `/student/courses/${c.sectionId}`,
          })),
        },
      ];
    } else {
      base.title = "Modules";
      base.sections = progress.map((c) => ({
        title: `${c.courseCode} · ${c.courseTitle}${c.progressPct != null ? ` — ${c.progressPct}% complete` : ""}`,
        rows: c.items.map((i) => ({
          primary: i.title,
          secondary: `${i.kind}${i.when ? ` · ${new Date(i.when).toLocaleDateString()}` : ""}`,
          meta: i.completed ? "Completed" : "Not started",
          href: i.href,
        })),
      }));
      if (!base.sections.length) base.sections = [{ title: "Modules", rows: [] }];
    }
    base.actions = [
      { label: "My courses", href: "/student/courses" },
      { label: "View grades", href: "/student/grades", variant: "secondary" },
    ];
    return base;
  }

  // Domain-backed screens
  if (
    normalized.endsWith("/courses") ||
    normalized.endsWith("/sections") ||
    normalized.includes("/courses/") ||
    normalized.includes("/sections/") ||
    normalized.endsWith("/continue") ||
    normalized.endsWith("/modules")
  ) {
    const rows = await coursesFor(user);
    base.metrics = [
      { label: "Sections", value: String(rows.length) },
      { label: "Term", value: meta.termCode },
      { label: "Campus", value: meta.campus },
    ];
    base.sections = [{ title: "Live catalogue", rows }];
    base.actions = [
      { label: "Open home", href: `/${role === "admin" ? "admin" : role === "instructor" ? "instructor" : "student"}` },
      ...(role === "student"
        ? [{ label: "View grades", href: "/student/grades", variant: "secondary" as const }]
        : role === "instructor"
          ? [{ label: "Open gradebook", href: "/instructor/gradebook", variant: "secondary" as const }]
          : [{ label: "Approvals", href: "/admin/approvals", variant: "secondary" as const }]),
    ];
    return base;
  }

  if (normalized.endsWith("/grades") || normalized.endsWith("/submissions")) {
    if (role === "student" || path.startsWith("/m/student")) {
      const g = await gradesFor(user);
      base.metrics = g.metrics.length ? g.metrics : base.metrics;
      base.sections = [{ title: "Grade items", rows: g.rows }];
      base.actions = [
        { label: "Ask about a grade", href: "/student/messages" },
        { label: "Courses", href: "/student/courses", variant: "secondary" },
      ];
      return base;
    }
    if (role === "instructor" || path.startsWith("/m/instructor")) {
      const sections = await coursesFor(user);
      base.sections = [{ title: "Sections ready for grading", rows: sections }];
      base.actions = [
        { label: "Open gradebook", href: "/instructor/gradebook" },
        { label: "Attendance", href: "/instructor/attendance", variant: "secondary" },
      ];
      return base;
    }
  }

  if (role === "student" && (normalized.endsWith("/assessments") || normalized.includes("st-06-assessments"))) {
    const rows = await toPortalRowsFromAssessments(user);
    base.metrics = [
      { label: "Assessments", value: String(rows.length) },
      { label: "Term", value: meta.termCode },
      { label: "Campus", value: meta.campus },
    ];
    base.sections = [{ title: "Assigned assessments", rows }];
    base.actions = [{ label: "Open assessments", href: "/student/assessments" }];
    return base;
  }

  if (role === "student" && normalized.endsWith("/attendance")) {
    const rows = await toPortalRowsFromAttendance(user);
    const present = rows.filter((r) => (r.secondary ?? "").includes("present")).length;
    base.metrics = [
      { label: "Records", value: String(rows.length) },
      { label: "Present", value: String(present) },
      { label: "Term", value: meta.termCode },
    ];
    base.sections = [{ title: "Your attendance", rows }];
    base.actions = [{ label: "Courses", href: "/student/courses", variant: "secondary" }];
    return base;
  }

  if (role === "student" && (normalized.endsWith("/lectures") || normalized.includes("st-11-lecture"))) {
    const rows = await toPortalRowsFromLectures(user, "lecture");
    base.sections = [{ title: "Lectures", rows }];
    base.actions = [{ label: "Schedule", href: "/student/calendar", variant: "secondary" }];
    return base;
  }

  if (role === "student" && (normalized.endsWith("/labs") || normalized.includes("st-13-lab"))) {
    const rows = await toPortalRowsFromLectures(user, "lab");
    base.sections = [{ title: "Labs", rows }];
    base.actions = [{ label: "Open labs", href: "/student/labs" }];
    return base;
  }

  if (role === "student" && (normalized.endsWith("/fees") || normalized.includes("finance"))) {
    const rows = await toPortalRowsFromFinance(user);
    base.sections = [{ title: "Ledger", rows }];
    base.actions = [{ label: "Fees", href: "/student/fees" }];
    return base;
  }

  if (role === "student" && (normalized.includes("st-19-credentials") || normalized.endsWith("/credentials"))) {
    const rows = await toPortalRowsFromCredentials(user);
    base.sections = [{ title: "Credentials", rows }];
    base.actions = [{ label: "Degree progress", href: "/student/degree", variant: "secondary" }];
    return base;
  }

  if (role === "student" && (normalized.endsWith("/library") || normalized.includes("resources"))) {
    const rows = await toPortalRowsFromResources(user);
    base.sections = [{ title: "Resources", rows }];
    base.actions = [{ label: "Library", href: "/student/library" }];
    return base;
  }

  if (role === "student" && normalized.includes("st-16-services")) {
    const rows = await toPortalRowsFromServices(user);
    base.sections = [{ title: "Service requests", rows }];
    base.actions = [{ label: "Services", href: "/student/f/st-16-services" }];
    return base;
  }

  if (role === "student" && (normalized.includes("st-17-practicum") || normalized.endsWith("/practicum"))) {
    const rows = await toPortalRowsFromPracticum(user);
    base.sections = [{ title: "Practicum", rows }];
    base.actions = [{ label: "Practicum", href: "/student/f/st-17-practicum" }];
    return base;
  }

  if (role === "student" && (normalized.includes("st-20-career") || normalized.endsWith("/career"))) {
    const opportunities = await prisma.careerOpportunity.findMany({
      where: { institutionId: user.institutionId, status: "open" },
      orderBy: { updatedAt: "desc" },
      take: 40,
    });
    const rows = opportunities.map((o) => {
      let skills: string[] = [];
      try {
        const parsed = JSON.parse(o.skillsJson) as unknown;
        skills = Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
      } catch {
        skills = [];
      }
      const href = studentCareerOpportunityHref(o.href);
      return {
        primary: o.title,
        secondary: `${o.employerName}${skills.length ? ` · ${skills.join(", ")}` : ""}`,
        meta: o.status,
        ...(href ? { href } : {}),
      };
    });
    base.title = "Career services";
    base.subtitle = "Coaching, co-op roles, and work-integrated learning";
    base.metrics = [
      { label: "Open roles", value: String(rows.length) },
      { label: "Term", value: meta.termCode },
      { label: "Campus", value: meta.campus },
    ];
    base.sections = [{ title: "Career opportunities", rows }];
    base.actions = [
      { label: "Open career hub", href: "/student/career", variant: "primary" },
      { label: "Message Career Services", href: "/student/messages", variant: "secondary" },
      { label: "Ask Heritage", href: "/student/ask", variant: "ai" },
    ];
    return base;
  }

  if (role === "student" && normalized.includes("leave-of-absence")) {
    const profiles = await personStudentIds(user.institutionId, user.personId);
    const requests = profiles.length
      ? await prisma.leaveOfAbsenceRequest.findMany({
          where: { institutionId: user.institutionId, studentId: { in: profiles.map((p) => p.id) } },
          orderBy: { createdAt: "desc" },
          take: 30,
        })
      : [];
    base.sections = [
      {
        title: "Leave of absence requests",
        rows: requests.map((r) => ({
          primary: `${r.startsOn} – ${r.endsOn}`,
          secondary: r.decisionNote ? `${r.reason} · ${r.decisionNote}` : r.reason,
          meta: r.status,
        })),
      },
    ];
    base.actions = [
      { label: "Student services", href: "/student/f/st-16-services", variant: "secondary" },
      { label: "Holds", href: "/student/holds", variant: "secondary" },
    ];
    return base;
  }

  if (role === "student" && normalized.endsWith("/holds")) {
    const [student, profiles] = await Promise.all([
      studentFor(user),
      personStudentIds(user.institutionId, user.personId),
    ]);
    const flags = await activeFlags(user.institutionId, profiles.map((p) => p.id));
    const numberOf = new Map(profiles.map((p) => [p.id, p.studentNumber]));
    const toRow = (f: (typeof flags)[number]): PortalRow => ({
      primary: f.name,
      secondary: f.messageText || undefined,
      meta: [
        new Date(f.date).toLocaleDateString(),
        profiles.length > 1 ? numberOf.get(f.studentId) : undefined,
      ]
        .filter(Boolean)
        .join(" · "),
    });
    const holds = flags.filter((f) => f.isHold);
    const others = flags.filter((f) => !f.isHold);
    const header = student ? await adminStatusAndCgpa(user.institutionId, student.id) : null;
    base.title = "Holds";
    base.metrics = [
      { label: "Active holds", value: String(holds.length) },
      { label: "Active flags", value: String(others.length) },
      { label: "Status", value: header?.status ?? "—" },
    ];
    base.sections = [
      { title: "Holds", rows: holds.map(toRow) },
      { title: "Flags", rows: others.map(toRow) },
    ];
    base.actions = [
      { label: "Student services", href: "/student/f/st-16-services", variant: "secondary" },
      { label: "Profile", href: "/student/profile", variant: "secondary" },
    ];
    return base;
  }

  if (role === "student" && (normalized.endsWith("/documents") || normalized.includes("tax-document"))) {
    const [credentials, taxDocs] = await Promise.all([
      toPortalRowsFromCredentials(user),
      (async () => {
        const { listTaxDocuments } = await import("../student/surfaces.service.js");
        const data = await listTaxDocuments(user);
        return data.documents.map((d) => ({
          primary: d.title,
          secondary: `${d.docType} · ${d.taxYear}`,
          meta: d.status,
          href: "/student/f/st-26-tax-documents",
        }));
      })(),
    ]);
    base.sections = [
      { title: "Credentials", rows: credentials },
      { title: "Tax documents", rows: taxDocs },
    ];
    base.actions = [
      { label: "Tax documents", href: "/student/f/st-26-tax-documents" },
      { label: "Credentials", href: "/student/f/st-19-credentials", variant: "secondary" },
    ];
    return base;
  }

  if (role === "student" && normalized.endsWith("/advising")) {
    const student = await studentFor(user);
    const appointments = student
      ? await prisma.advisingAppointment.findMany({
          where: { institutionId: user.institutionId, studentId: student.id },
          orderBy: { startsAt: "asc" },
          take: 30,
        })
      : [];
    const rows = appointments.map((a) => ({
      primary: a.topic,
      secondary: a.notes ?? a.status,
      meta: a.startsAt ? new Date(a.startsAt).toLocaleString() : a.status,
      href: "/student/advising",
    }));
    base.sections = [{ title: "Advising appointments", rows }];
    base.actions = [{ label: "Open advising", href: "/student/advising" }];
    return base;
  }

  if (normalized.endsWith("/calendar") || normalized.endsWith("/schedule")) {
    const rows = await calendarFor(user);
    base.sections = [{ title: "Upcoming", rows }];
    base.actions = [{ label: "Assessments", href: role === "instructor" ? "/instructor/assessments" : "/student/assessments" }];
    return base;
  }

  if (role === "student" && normalized.endsWith("/announcements")) {
    const student = await studentFor(user);
    const [campus, inbox] = await Promise.all([studentAnnouncements(user, student?.id ?? null), notificationsFor(user)]);
    base.title = "Announcements";
    base.metrics = [
      { label: "Announcements", value: String(campus.length) },
      { label: "Unread notifications", value: String(inbox.filter((r) => r.meta === "Unread").length) },
      { label: "Term", value: meta.termCode },
    ];
    base.sections = [
      {
        title: "Campus announcements",
        rows: campus.map((a) => ({
          primary: a.title,
          secondary: a.body,
          meta: new Date(a.updatedAt).toLocaleDateString(),
        })),
      },
      { title: "Your notifications", rows: inbox },
    ];
    base.actions = [{ label: "Notifications", href: "/student/notifications", variant: "secondary" }];
    return base;
  }

  if (normalized.endsWith("/notifications") || (role === "student" && normalized.endsWith("/announcements"))) {
    const rows = await notificationsFor(user);
    base.title = normalized.endsWith("/announcements") ? "Announcements" : base.title;
    base.metrics = [
      { label: "Unread", value: String(rows.filter((r) => r.meta === "Unread").length) },
      { label: "Total", value: String(rows.length) },
      { label: "Term", value: meta.termCode },
    ];
    base.sections = [
      {
        title: normalized.endsWith("/announcements") ? "Campus announcements" : "Inbox",
        rows: rows.map((row) => ({
          ...row,
          href: normalized.endsWith("/announcements") ? "/student/announcements" : row.href,
        })),
      },
    ];
    base.actions = [
      {
        label: normalized.endsWith("/announcements") ? "Open announcements" : "Messages",
        href: normalized.endsWith("/announcements")
          ? "/student/announcements"
          : role === "instructor"
            ? "/instructor/messages"
            : "/student/messages",
        variant: "secondary",
      },
    ];
    return base;
  }

  if (normalized.endsWith("/messages")) {
    const rows = await messagesFor(user);
    base.sections = [{ title: "Threads", rows }];
    base.actions = [
      { label: "Notifications", href: role === "instructor" ? "/instructor/notifications" : "/student/notifications", variant: "secondary" },
    ];
    return base;
  }

  if (normalized.endsWith("/approvals")) {
    const rows = await approvalsFor(user);
    base.metrics = [
      { label: "Pending", value: String(rows.filter((r) => r.primary.includes("pending")).length) },
      { label: "Total", value: String(rows.length) },
      { label: "Term", value: meta.termCode },
    ];
    base.sections = [{ title: "Approval queue", rows }];
    base.actions = [{ label: "Open inbox UI", href: "/admin/approvals" }];
    return base;
  }

  if (normalized.endsWith("/users") || normalized.endsWith("/students") || normalized.endsWith("/profile")) {
    if (role === "admin") {
      const rows = await peopleFor(user);
      base.metrics = [
        { label: "People", value: String(rows.length) },
        { label: "Institution", value: meta.institutionName },
        { label: "Term", value: meta.termCode },
      ];
      base.sections = [{ title: "Directory", rows }];
      base.actions = [{ label: "Search", href: "/admin/search", variant: "secondary" }];
      return base;
    }
    const person = await prisma.person.findUnique({ where: { id: user.personId } });
    const student = role === "student" ? await studentFor(user) : null;
    const header = student ? await adminStatusAndCgpa(user.institutionId, student.id) : null;
    base.sections = [
      {
        title: "Profile",
        rows: [
          {
            primary: `${person?.givenName ?? ""} ${person?.familyName ?? ""}`.trim() || "Account",
            secondary: person?.email,
            meta: student?.studentNumber ?? user.roles.join(", "),
          },
          ...(student
            ? [
                {
                  primary: student.programName,
                  secondary: `Status: ${header?.status ?? "—"}${header?.cgpa != null ? ` · CGPA ${header.cgpa.toFixed(2)}` : ""}`,
                  meta: student.studentNumber,
                },
              ]
            : []),
        ],
      },
    ];
    base.actions = [{ label: "Security", href: role === "student" ? "/student/profile" : `/${role}/profile`, variant: "secondary" }];
    return base;
  }

  if (normalized.endsWith("/roster") || (role === "instructor" && normalized.endsWith("/attendance"))) {
    const rows = await rosterFor(user);
    base.metrics = [
      { label: "Roster size", value: String(rows.length) },
      { label: "Term", value: meta.termCode },
      { label: "Campus", value: meta.campus },
    ];
    base.sections = [{ title: "Students", rows }];
    base.actions = [
      { label: "Gradebook", href: "/instructor/gradebook" },
      { label: "Sections", href: "/instructor/sections", variant: "secondary" },
    ];
    return base;
  }

  // Generic fallback — never serve seeded PortalRecord fixture rows to students.
  if (role === "student") {
    base.sections = [{ title: `${title} records`, rows: [] }];
    base.actions = [{ label: "Home", href: "/student" }];
    if (path.startsWith("/m/")) {
      base.actions = [
        { label: "Mobile home", href: "/m/student" },
        { label: "Desktop", href: "/student", variant: "secondary" },
      ];
    }
    return base;
  }

  // Generic: DB portal records for this path (+ role-wide fallback)
  let rows = await portalRows(user.institutionId, normalized, user.accountId);
  if (!rows.length) {
    // Strip /f/ slug folders to role wildcards
    const roleWild = `/${role}/*`;
    rows = await portalRows(user.institutionId, roleWild, user.accountId);
  }
  base.sections = [{ title: `${title} records`, rows }];
  base.actions = [{ label: "Home", href: role === "admin" ? "/admin" : `/${role}` }];
  if (path.startsWith("/m/")) {
    base.actions = [
      { label: "Mobile home", href: role === "instructor" ? "/m/instructor/home" : "/m/student" },
      { label: "Desktop", href: role === "instructor" ? "/instructor" : "/student", variant: "secondary" },
    ];
  }
  return base;
}
