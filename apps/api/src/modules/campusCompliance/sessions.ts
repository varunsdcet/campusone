import { randomUUID } from "crypto";
import { prisma } from "@myheritage/db";
import { classJoinUrl, notificationJoinUrl, sessionJoinUrl } from "../../lib/liveClass.js";
import { detectClientKind } from "./policy.js";
import {
  accountIdForPerson,
  accountIdsForStudents,
  notifyAccount,
  notifyAccounts,
} from "./notify.js";

export async function createClassSessionWithNotifications(input: {
  institutionId: string;
  sectionId: string;
  title: string;
  startsAt: Date;
  endsAt?: Date | null;
  location?: string | null;
  joinUrl?: string | null;
  deliveryMode?: string;
  sessionKind?: string;
  /** empty = all enrolled; otherwise specific student ids */
  notifyStudentIds?: string[];
  createdByAccountId?: string;
}) {
  const section = await prisma.section.findFirst({
    where: { id: input.sectionId, institutionId: input.institutionId },
    include: {
      course: true,
      enrolments: { where: { status: "enrolled" }, select: { studentId: true } },
    },
  });
  if (!section) {
    throw Object.assign(new Error("Section not found"), { status: 404, code: "NOT_FOUND" });
  }

  const joinUrl = classJoinUrl(section.id, input.joinUrl);

  const session = await prisma.classSession.create({
    data: {
      id: randomUUID(),
      institutionId: input.institutionId,
      sectionId: section.id,
      title: input.title.trim() || `${section.course.code} class`,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      location: input.location ?? null,
      joinUrl,
      deliveryMode: input.deliveryMode || "online",
      sessionKind: input.sessionKind || "lecture",
    },
  });

  const targetIds =
    input.notifyStudentIds?.length
      ? input.notifyStudentIds
      : section.enrolments.map((e) => e.studentId);

  const when = input.startsAt.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const studentAccounts = await accountIdsForStudents(input.institutionId, targetIds);
  await notifyAccounts({
    institutionId: input.institutionId,
    accountIds: studentAccounts,
    title: `Class scheduled — ${section.course.code}`,
    body: `${session.title} on ${when}. Join link: ${notificationJoinUrl(joinUrl)}`,
    templateKey: "compliance.class.created",
  });

  const instructorAccountId = await accountIdForPerson(input.institutionId, section.instructorPersonId);
  if (instructorAccountId) {
    await notifyAccount({
      institutionId: input.institutionId,
      accountId: instructorAccountId,
      title: `Class created — ${section.course.code}`,
      body: `${session.title} · ${when} · ${studentAccounts.length} student(s) notified.`,
      templateKey: "compliance.class.created.instructor",
    });
  }

  return { session, notified: studentAccounts.length };
}

export async function recordSessionJoin(input: {
  institutionId: string;
  classSessionId: string;
  accountId: string;
  personId: string;
  userAgent: string;
  roles: string[];
}) {
  const session = await prisma.classSession.findFirst({
    where: { id: input.classSessionId, institutionId: input.institutionId },
    include: { section: { select: { instructorPersonId: true } } },
  });
  if (!session) {
    throw Object.assign(new Error("Class session not found"), { status: 404, code: "NOT_FOUND" });
  }

  const student = await prisma.student.findFirst({
    where: { institutionId: input.institutionId, personId: input.personId },
  });

  const isStaff = input.roles.includes("admin") || input.roles.includes("registrar");
  const isInstructor = input.roles.includes("instructor") && session.section.instructorPersonId === input.personId;
  const enrolled = student
    ? await prisma.enrolment.findFirst({
        where: {
          institutionId: input.institutionId,
          sectionId: session.sectionId,
          studentId: student.id,
          status: "enrolled",
        },
        select: { id: true },
      })
    : null;
  if (!isStaff && !isInstructor && !enrolled) {
    throw Object.assign(new Error("You are not enrolled in this class session"), { status: 403, code: "FORBIDDEN" });
  }

  const clientKind = detectClientKind(input.userAgent);
  const event = await prisma.sessionJoinEvent.create({
    data: {
      id: randomUUID(),
      institutionId: input.institutionId,
      classSessionId: session.id,
      studentId: enrolled ? student!.id : null,
      accountId: input.accountId,
      clientKind,
      userAgent: input.userAgent.slice(0, 500),
    },
  });

  return { event, clientKind, joinUrl: sessionJoinUrl(session.sectionId, session.joinUrl) };
}

/** `instructorPersonId` limits the report to class sessions of sections that person teaches. */
export async function mobileJoinReport(institutionId: string, days = 7, instructorPersonId?: string) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const ownSessionIds = instructorPersonId
    ? (
        await prisma.classSession.findMany({
          where: { institutionId, section: { instructorPersonId } },
          select: { id: true },
        })
      ).map((s) => s.id)
    : null;
  const rows = await prisma.sessionJoinEvent.findMany({
    where: {
      institutionId,
      joinedAt: { gte: since },
      ...(ownSessionIds ? { classSessionId: { in: ownSessionIds } } : {}),
    },
    orderBy: { joinedAt: "desc" },
    take: 500,
  });

  const sessionIds = [...new Set(rows.map((r) => r.classSessionId))];
  const sessions = await prisma.classSession.findMany({
    where: { id: { in: sessionIds } },
    include: { section: { include: { course: true } } },
  });
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));

  const studentIds = [...new Set(rows.map((r) => r.studentId).filter(Boolean))] as string[];
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    include: { person: true },
  });
  const studentMap = new Map(
    students.map((s) => [
      s.id,
      {
        name: `${s.person.givenName} ${s.person.familyName}`.trim(),
        studentNumber: s.studentNumber,
      },
    ]),
  );

  return {
    since: since.toISOString(),
    totals: {
      joins: rows.length,
      mobile: rows.filter((r) => r.clientKind === "mobile").length,
      desktop: rows.filter((r) => r.clientKind === "desktop").length,
    },
    rows: rows.map((r) => {
      const session = sessionMap.get(r.classSessionId);
      const student = r.studentId ? studentMap.get(r.studentId) : null;
      return {
        id: r.id,
        joinedAt: r.joinedAt.toISOString(),
        clientKind: r.clientKind,
        course: session?.section.course.code ?? "—",
        section: session?.section.code ?? "—",
        title: session?.title ?? "—",
        studentName: student?.name ?? "—",
        studentNumber: student?.studentNumber ?? "—",
      };
    }),
  };
}

export async function upcomingSessionsForPerson(input: {
  institutionId: string;
  personId: string;
  roles: string[];
  withinHours?: number;
}) {
  const withinMs = (input.withinHours ?? 24) * 60 * 60 * 1000;
  const now = new Date();
  const until = new Date(now.getTime() + withinMs);

  let sectionFilter: { instructorPersonId?: string; enrolments?: { some: { student: { personId: string }; status: string } } } =
    {};
  if (input.roles.includes("instructor") && !input.roles.includes("admin")) {
    sectionFilter = { instructorPersonId: input.personId };
  } else if (input.roles.includes("student")) {
    sectionFilter = {
      enrolments: { some: { student: { personId: input.personId }, status: "enrolled" } },
    };
  }

  const sessions = await prisma.classSession.findMany({
    where: {
      institutionId: input.institutionId,
      startsAt: { gte: now, lte: until },
      section: sectionFilter,
    },
    include: { section: { include: { course: true } } },
    orderBy: { startsAt: "asc" },
    take: 8,
  });

  return sessions.map((s) => {
    const mins = Math.max(0, Math.round((s.startsAt.getTime() - now.getTime()) / 60_000));
    return {
      id: s.id,
      title: s.title,
      courseCode: s.section.course.code,
      sectionCode: s.section.code,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt?.toISOString() ?? null,
      joinUrl: sessionJoinUrl(s.sectionId, s.joinUrl),
      minutesUntil: mins,
      label:
        mins < 60
          ? `Starts in ${mins} min`
          : `Starts in ${Math.round(mins / 60)} hr`,
    };
  });
}
