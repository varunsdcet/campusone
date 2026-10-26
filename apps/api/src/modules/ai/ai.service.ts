import type { RoleName, SessionClaims } from "@myheritage/contracts";
import { prisma } from "@myheritage/db";
import type { GroundedCoachFact } from "@myheritage/ai";
import { currentStudentId } from "../me/studentAlignment.js";
import { isGovernmentIdDocument } from "../applicant/applicationForm.js";

const rolePrefixes: Array<{ prefix: string; role: RoleName }> = [
  { prefix: "/student", role: "student" },
  { prefix: "/instructor", role: "instructor" },
  { prefix: "/admin", role: "admin" },
  { prefix: "/applicant", role: "applicant" },
  { prefix: "/employer", role: "employer" },
];

function hasRole(user: SessionClaims, role: RoleName) {
  return role === "admin"
    ? user.roles.includes("admin") || user.roles.includes("registrar")
    : user.roles.includes(role);
}

export function resolveCoachRole(user: SessionClaims, contextPath?: string): RoleName {
  if (contextPath) {
    const requested = rolePrefixes.find(({ prefix }) => contextPath === prefix || contextPath.startsWith(`${prefix}/`));
    if (!requested || !hasRole(user, requested.role)) {
      throw Object.assign(new Error("Coach context is not available for this role"), {
        code: "FORBIDDEN",
        status: 403,
      });
    }
    if (requested.role === "admin" && !user.roles.includes("admin") && user.roles.includes("registrar")) {
      return "registrar";
    }
    return requested.role;
  }

  const role = (["student", "instructor", "admin", "registrar", "applicant", "employer"] as RoleName[]).find(
    (candidate) => user.roles.includes(candidate),
  );
  if (!role) {
    throw Object.assign(new Error("Coach is not available for this account"), {
      code: "FORBIDDEN",
      status: 403,
    });
  }
  return role;
}

function homeFor(role: RoleName) {
  return role === "registrar" ? "/admin" : `/${role}`;
}

function safePortalRecord(text: string) {
  return !/(?:passport|social security|\bssn\b|\bsin\b)/i.test(text);
}

function campusDate(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  })
    .format(value)
    .replace(/\.$/, "");
}

function moneyCad(amount: number) {
  return `CAD ${amount.toFixed(2)}`;
}

export async function buildCoachFacts(user: SessionClaims, role: RoleName): Promise<GroundedCoachFact[]> {
  const [person, institution] = await Promise.all([
    prisma.person.findFirst({
      where: { id: user.personId, institutionId: user.institutionId },
      select: { id: true, givenName: true, familyName: true },
    }),
    prisma.institution.findFirst({
      where: { institutionId: user.institutionId },
      select: { id: true, name: true, timezone: true },
    }),
  ]);
  if (!person) {
    throw Object.assign(new Error("Account profile not found"), { code: "NOT_FOUND", status: 404 });
  }

  const campusTimeZone = institution?.timezone ?? "UTC";
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  const facts: GroundedCoachFact[] = [
    {
      id: `profile:${person.id}`,
      title: "Your campus profile",
      uri: homeFor(role),
      text: `${person.givenName} ${person.familyName} is signed in to the ${role} workspace.`,
      kind: "profile",
    },
  ];
  if (institution) {
    facts.push({
      id: `institution:${institution.id}`,
      title: institution.name,
      uri: homeFor(role),
      text: `${institution.name} uses ${institution.timezone} as its campus timezone.`,
      kind: "institution",
    });
  }

  if (role === "student") {
    const student = await prisma.student.findFirst({
      where: { id: await currentStudentId(user.institutionId, user.personId), institutionId: user.institutionId },
      select: { id: true, studentNumber: true, programName: true, standing: true },
    });
    if (!student) throw Object.assign(new Error("Student record not found"), { code: "NOT_FOUND", status: 404 });
    facts.push({
      id: `student:${student.id}`,
      title: "Your student record",
      uri: "/student/profile",
      text: `Program: ${student.programName}; academic standing: ${student.standing}.`,
      kind: "profile",
    });

    const [enrolments, assignments, sessions, grades, planItems, ledger, loa, attendance, mailUnread] =
      await Promise.all([
        prisma.enrolment.findMany({
          where: {
            institutionId: user.institutionId,
            studentId: student.id,
            status: { in: ["enrolled", "completed"] },
          },
          include: { section: { include: { course: true } } },
          take: 10,
        }),
        prisma.assignment.findMany({
          where: {
            institutionId: user.institutionId,
            section: {
              institutionId: user.institutionId,
              enrolments: {
                some: {
                  institutionId: user.institutionId,
                  studentId: student.id,
                  status: { in: ["enrolled", "completed"] },
                },
              },
            },
          },
          include: { section: { include: { course: true } } },
          orderBy: [{ dueAt: "asc" }, { title: "asc" }],
          take: 8,
        }),
        prisma.classSession.findMany({
          where: {
            institutionId: user.institutionId,
            startsAt: { gte: now, lte: weekAhead },
            section: {
              institutionId: user.institutionId,
              enrolments: {
                some: {
                  institutionId: user.institutionId,
                  studentId: student.id,
                  status: "enrolled",
                },
              },
            },
          },
          include: { section: { include: { course: true } } },
          orderBy: { startsAt: "asc" },
          take: 8,
        }),
        prisma.gradeItem.findMany({
          where: { institutionId: user.institutionId, studentId: student.id, status: "published" },
          include: { assignment: { include: { section: { include: { course: true } } } } },
          orderBy: { publishedAt: "desc" },
          take: 6,
        }),
        prisma.programPlanItem.findMany({
          where: {
            institutionId: user.institutionId,
            plan: { institutionId: user.institutionId, studentId: student.id, status: "active" },
          },
          orderBy: { sortOrder: "asc" },
          take: 12,
        }),
        prisma.financeLedgerEntry.findMany({
          where: { institutionId: user.institutionId, studentId: student.id },
          orderBy: { postedAt: "desc" },
          take: 40,
        }),
        prisma.leaveOfAbsenceRequest.findMany({
          where: { institutionId: user.institutionId, studentId: student.id },
          orderBy: { createdAt: "desc" },
          take: 3,
        }),
        prisma.attendanceRecord.findMany({
          where: { institutionId: user.institutionId, studentId: student.id },
          include: { section: { include: { course: true } } },
          orderBy: { recordedAt: "desc" },
          take: 6,
        }),
        prisma.mailThreadPlacement.count({
          where: {
            institutionId: user.institutionId,
            accountId: user.accountId,
            readAt: null,
            folder: { kind: "inbox" },
          },
        }),
      ]);

    const balance = ledger.reduce((sum, e) => (e.kind === "charge" ? sum + Number(e.amountCad) : sum - Number(e.amountCad)), 0);
    const openCharges = ledger.filter((e) => e.kind === "charge" && e.status === "open").slice(0, 4);
    const nextPlan = planItems.find((item) => item.status === "not_started" || item.status === "in_progress");
    const overdueAssignments = assignments.filter((a) => a.dueAt && a.dueAt < now).slice(0, 4);

    facts.push(
      ...enrolments.map((entry) => ({
        id: `course:${entry.sectionId}`,
        title: `${entry.section.course.code} - ${entry.section.course.title}`,
        uri: `/student/courses/${entry.sectionId}`,
        text: `${entry.section.course.code} (${entry.section.code}) is ${entry.status}.`,
        kind: "course" as const,
      })),
      ...assignments.map((assignment) => ({
        id: `assignment:${assignment.id}`,
        title: `${assignment.section.course.code} - ${assignment.title}`,
        uri: `/student/assignments/${assignment.id}`,
        text: `${assignment.title} for ${assignment.section.course.code}${
          assignment.dueAt ? ` is due ${campusDate(assignment.dueAt, campusTimeZone)}` : " has no published due date"
        }.`,
        kind: "assignment" as const,
      })),
      ...overdueAssignments.map((assignment) => ({
        id: `assignment-overdue:${assignment.id}`,
        title: `Overdue · ${assignment.title}`,
        uri: `/student/assignments/${assignment.id}`,
        text: `${assignment.title} for ${assignment.section.course.code} is overdue (was due ${campusDate(assignment.dueAt!, campusTimeZone)}).`,
        kind: "assignment" as const,
      })),
      ...sessions.map((session) => ({
        id: `session:${session.id}`,
        title: `${session.section.course.code} - ${session.title}`,
        uri: "/student/calendar",
        text: `${session.title} for ${session.section.course.code} starts ${campusDate(session.startsAt, campusTimeZone)}${
          session.location ? ` at ${session.location}` : ""
        }.`,
        kind: "session" as const,
      })),
      ...grades.map((grade) => ({
        id: `grade:${grade.id}`,
        title: `${grade.assignment.section.course.code} - ${grade.assignment.title}`,
        uri: "/student/grades",
        text: `${grade.assignment.title} has a published score of ${grade.score ?? "not scored"}/${grade.maxScore}${
          grade.letter ? ` (${grade.letter})` : ""
        }.`,
        kind: "grade" as const,
      })),
      ...planItems.slice(0, 8).map((item) => ({
        id: `program-item:${item.id}`,
        title: `${item.courseCode} · ${item.title}`,
        uri: "/student/program-plan",
        text: `${item.courseCode} (${item.title}) is ${item.status.replace(/_/g, " ")}${
          item.scheduleText ? ` — ${item.scheduleText}` : ""
        }.`,
        kind: "program" as const,
      })),
      ...attendance.map((row) => ({
        id: `attendance:${row.id}`,
        title: `${row.section.course.code} · ${row.meetingLabel}`,
        uri: "/student/attendance",
        text: `${row.section.course.code} ${row.meetingLabel}: marked ${row.status} on ${campusDate(row.recordedAt, campusTimeZone)}.`,
        kind: "attendance" as const,
      })),
      ...loa.map((row) => ({
        id: `loa:${row.id}`,
        title: "Leave of absence request",
        uri: "/student/leave-of-absence",
        text: `LOA ${row.startsOn} to ${row.endsOn} is ${row.status}${row.decisionNote ? ` — ${row.decisionNote}` : ""}.`,
        kind: "request" as const,
      })),
    );

    if (nextPlan) {
      facts.push({
        id: `program-next:${nextPlan.id}`,
        title: "Next program plan course",
        uri: "/student/program-plan",
        text: `Your next plan item is ${nextPlan.courseCode} (${nextPlan.title}), status ${nextPlan.status.replace(/_/g, " ")}.`,
        kind: "program",
      });
    }

    facts.push({
      id: `finance:balance:${student.id}`,
      title: "Financial balance",
      uri: "/student/fees",
      text: `Outstanding balance is ${moneyCad(balance)} across ${ledger.length} ledger entries.`,
      kind: "finance",
    });
    facts.push(
      ...openCharges.map((entry) => ({
        id: `finance:${entry.id}`,
        title: entry.label,
        uri: "/student/fees",
        text: `${entry.label}: ${moneyCad(Number(entry.amountCad))} (${entry.status})${
          entry.dueAt ? `, due ${campusDate(entry.dueAt, campusTimeZone)}` : ""
        }.`,
        kind: "finance" as const,
      })),
    );
    facts.push({
      id: `mail:unread:${user.accountId}`,
      title: "Unread mail",
      uri: "/student/mail",
      text: `You have ${mailUnread} unread inbox message(s).`,
      kind: "mail",
    });
  } else if (role === "instructor") {
    const sectionsRaw = await prisma.section.findMany({
      where: { institutionId: user.institutionId, instructorPersonId: user.personId },
      include: {
        course: true,
        assignments: true,
        enrolments: {
          where: { status: "enrolled" },
          include: { student: { include: { person: true } } },
          take: 40,
        },
        _count: { select: { enrolments: true } },
      },
      take: 20,
    });
    const sections = [...sectionsRaw].sort((a, b) => {
      const ar = /retake/i.test(a.code) ? 1 : 0;
      const br = /retake/i.test(b.code) ? 1 : 0;
      if (ar !== br) return ar - br;
      return a.course.code.localeCompare(b.course.code);
    });

    const sectionIds = sections.map((s) => s.id);
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const [todaySessions, weekSessions, todayAbsent, recentAbsent, draftGrades, mailUnread, badgeBases] =
      await Promise.all([
        prisma.classSession.findMany({
          where: {
            institutionId: user.institutionId,
            sectionId: { in: sectionIds },
            startsAt: { gte: dayStart, lte: dayEnd },
          },
          include: { section: { include: { course: true } } },
          orderBy: { startsAt: "asc" },
          take: 8,
        }),
        prisma.classSession.findMany({
          where: {
            institutionId: user.institutionId,
            sectionId: { in: sectionIds },
            startsAt: { gte: dayStart, lte: weekEnd },
          },
          include: { section: { include: { course: true } } },
          orderBy: { startsAt: "asc" },
          take: 16,
        }),
        prisma.attendanceRecord.findMany({
          where: {
            institutionId: user.institutionId,
            sectionId: { in: sectionIds },
            status: { in: ["absent", "late", "excused"] },
            recordedAt: { gte: dayStart, lte: dayEnd },
          },
          include: {
            student: { include: { person: true } },
            section: { include: { course: true } },
          },
          take: 20,
        }),
        prisma.attendanceRecord.findMany({
          where: {
            institutionId: user.institutionId,
            sectionId: { in: sectionIds },
            status: { in: ["absent", "late"] },
            recordedAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
          },
          include: {
            student: { include: { person: true } },
            section: { include: { course: true } },
          },
          take: 80,
        }),
        prisma.gradeItem.count({
          where: {
            institutionId: user.institutionId,
            status: "draft",
            assignment: { section: { institutionId: user.institutionId, instructorPersonId: user.personId } },
          },
        }),
        prisma.mailThreadPlacement.count({
          where: {
            institutionId: user.institutionId,
            accountId: user.accountId,
            readAt: null,
            folder: { kind: "inbox" },
          },
        }),
        prisma.badgeDefinition.count({ where: { institutionId: user.institutionId } }),
      ]);

    const dueSoon = sections
      .flatMap((s) =>
        s.assignments
          .filter((a) => a.dueAt && a.dueAt >= now && a.dueAt <= weekEnd)
          .map((a) => ({ section: s, assignment: a })),
      )
      .sort((a, b) => a.assignment.dueAt!.getTime() - b.assignment.dueAt!.getTime())
      .slice(0, 8);

    facts.push(
      ...sections.map((section) => ({
        id: `section:${section.id}`,
        title: `${section.course.code} - ${section.code}`,
        uri: `/instructor/sections/${section.id}`,
        text: `${section.course.code} ${section.code} (${section.course.title}) has ${section._count.enrolments} enrolled and ${section.assignments.length} assignments.`,
        kind: "course" as const,
      })),
      ...todaySessions.map((session) => ({
        id: `session:${session.id}`,
        title: `${session.section.course.code} - ${session.title}`,
        uri: "/instructor/calendar",
        text: `Today: ${session.title} for ${session.section.course.code} at ${campusDate(session.startsAt, campusTimeZone)}${
          session.location ? ` · room ${session.location}` : ""
        }.`,
        kind: "session" as const,
      })),
      ...weekSessions
        .filter((s) => !todaySessions.some((t) => t.id === s.id))
        .slice(0, 8)
        .map((session) => ({
          id: `session-week:${session.id}`,
          title: `${session.section.course.code} - ${session.title}`,
          uri: "/instructor/calendar",
          text: `This week: ${session.title} for ${session.section.course.code} at ${campusDate(session.startsAt, campusTimeZone)}${
            session.location ? ` · ${session.location}` : ""
          }.`,
          kind: "session" as const,
        })),
    );

    for (const section of sections.filter((s) => !/retake/i.test(s.code)).slice(0, 3)) {
      const names = section.enrolments
        .slice(0, 8)
        .map((e) => `${e.student.person.givenName} ${e.student.person.familyName}`)
        .join(", ");
      facts.push({
        id: `roster:${section.id}`,
        title: `Class list · ${section.course.code}`,
        uri: `/instructor/sections/${section.id}`,
        text: `${section.course.code} ${section.code} class list (${section.enrolments.length} shown): ${names || "no enrolled students"}.`,
        kind: "roster",
      });
    }

    if (todayAbsent.length) {
      facts.push(
        ...todayAbsent.map((row) => ({
          id: `attendance:${row.id}`,
          title: `Absent · ${row.section.course.code}`,
          uri: "/instructor/attendance",
          text: `${row.student.person.givenName} ${row.student.person.familyName} is marked ${row.status} for ${row.section.course.code} (${row.meetingLabel}).`,
          kind: "attendance" as const,
        })),
      );
    } else if (sectionIds.length) {
      facts.push({
        id: `attendance:today-none:${user.personId}`,
        title: "Attendance today",
        uri: "/instructor/attendance",
        text: "No absent/late/excused attendance marks recorded for your sections today yet.",
        kind: "attendance",
      });
    }

    const absenceCount = new Map<string, { name: string; course: string; count: number }>();
    for (const row of recentAbsent) {
      const key = `${row.studentId}:${row.sectionId}`;
      const name = `${row.student.person.givenName} ${row.student.person.familyName}`;
      const course = row.section.course.code;
      const prev = absenceCount.get(key);
      if (prev) prev.count += 1;
      else absenceCount.set(key, { name, course, count: 1 });
    }
    const multiAbsent = [...absenceCount.entries()]
      .filter(([, v]) => v.count >= 2)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8);
    for (const [key, v] of multiAbsent) {
      facts.push({
        id: `attendance-risk:${key}`,
        title: `Attendance attention · ${v.course}`,
        uri: "/instructor/attendance",
        text: `${v.name} has ${v.count} absent/late marks in ${v.course} over the last 30 days (rule: ≥2).`,
        kind: "attendance",
      });
    }

    for (const item of dueSoon) {
      facts.push({
        id: `assignment-due:${item.assignment.id}`,
        title: `${item.section.course.code} · ${item.assignment.title}`,
        uri: "/instructor/assessments",
        text: `${item.assignment.title} for ${item.section.course.code} is due ${campusDate(item.assignment.dueAt!, campusTimeZone)}.`,
        kind: "assignment",
      });
    }

    facts.push({
      id: `gradebook:${user.personId}`,
      title: "Your gradebook",
      uri: "/instructor/gradebook",
      text: `${draftGrades} grade items in your assigned sections remain in draft (awaiting grading or publish).`,
      kind: "grade",
    });
    facts.push({
      id: `mail:unread:${user.accountId}`,
      title: "Unread mail",
      uri: "/instructor/messages",
      text: `You have ${mailUnread} unread inbox message(s).`,
      kind: "mail",
    });
    facts.push({
      id: `badges:bases:${user.institutionId}`,
      title: "Badge bases",
      uri: "/instructor/f/t82-badges-accomplishments",
      text: `${badgeBases} institution badge base(s) are defined. Create or award from Badges / Accomplishments.`,
      kind: "portal",
    });
    facts.push({
      id: `teaching-ops:${user.personId}`,
      title: "Teaching Operations",
      uri: "/instructor/ask",
      text: `Teaching load: ${sections.length} section(s), ${todaySessions.length} class(es) today, ${multiAbsent.length} student(s) with ≥2 recent absences, ${draftGrades} draft grade item(s), ${mailUnread} unread message(s).`,
      kind: "portal",
    });
  } else if (role === "admin" || role === "registrar") {
    const [students, sections, pendingApprovals, auditEvents, pendingLoa, draftGradeCount, recentStudents, programs] =
      await Promise.all([
        prisma.student.count({ where: { institutionId: user.institutionId } }),
        prisma.section.count({ where: { institutionId: user.institutionId } }),
        prisma.approvalRequest.count({ where: { institutionId: user.institutionId, status: "pending" } }),
        prisma.auditEvent.count({ where: { institutionId: user.institutionId } }),
        prisma.leaveOfAbsenceRequest.findMany({
          where: { institutionId: user.institutionId, status: "pending" },
          include: { student: { include: { person: true } } },
          take: 8,
        }),
        prisma.gradeItem.count({
          where: { institutionId: user.institutionId, status: "draft" },
        }),
        prisma.student.findMany({
          where: { institutionId: user.institutionId },
          include: { person: true },
          orderBy: { updatedAt: "desc" },
          take: 8,
        }),
        prisma.program.findMany({
          where: { institutionId: user.institutionId },
          orderBy: { name: "asc" },
          take: 8,
        }),
      ]);

    facts.push(
      {
        id: `operations:students:${user.institutionId}`,
        title: "Student operations",
        uri: "/admin/students",
        text: `${students} student records are currently held by the institution.`,
        kind: "institution",
      },
      {
        id: `operations:sections:${user.institutionId}`,
        title: "Academic operations",
        uri: "/admin/sections",
        text: `${sections} course sections are configured.`,
        kind: "course",
      },
      {
        id: `operations:approvals:${user.institutionId}`,
        title: "Approval inbox",
        uri: "/admin/approvals",
        text: `${pendingApprovals} approval requests are pending human review.`,
        kind: "approval",
      },
      {
        id: `operations:audit:${user.institutionId}`,
        title: "Audit activity",
        uri: "/admin/audit",
        text: `${auditEvents} audit events are available for governance review.`,
        kind: "institution",
      },
      {
        id: `operations:pending-grades:${user.institutionId}`,
        title: "Pending grade items",
        uri: "/admin/approvals",
        text: `${draftGradeCount} grade items remain in draft across the institution.`,
        kind: "grade",
      },
      ...recentStudents.map((student) => ({
        id: `roster:student:${student.id}`,
        title: `${student.person.givenName} ${student.person.familyName}`,
        uri: "/admin/students",
        text: `${student.person.givenName} ${student.person.familyName} (${student.studentNumber}) — ${student.programName}, standing ${student.standing}.`,
        kind: "roster" as const,
      })),
      ...pendingLoa.map((row) => ({
        id: `request:loa:${row.id}`,
        title: `Pending LOA · ${row.student.studentNumber}`,
        uri: "/admin/approvals",
        text: `Pending LOA for ${row.student.person.givenName} ${row.student.person.familyName}: ${row.startsOn} to ${row.endsOn}.`,
        kind: "request" as const,
      })),
      ...programs.map((program) => ({
        id: `program:${program.id}`,
        title: program.name,
        uri: "/admin/programs",
        text: `Program ${program.name} (${program.code}) · ${program.awardLevel}.`,
        kind: "program" as const,
      })),
    );
  } else if (role === "applicant") {
    const application = await prisma.admissionsApplication.findFirst({
      where: { institutionId: user.institutionId, accountId: user.accountId },
      include: { documents: true, offers: true, timeline: { orderBy: { occurredAt: "desc" }, take: 5 } },
    });
    if (application) {
      facts.push({
        id: `application:${application.id}`,
        title: application.programName,
        uri: "/applicant/application",
        text: `Your ${application.programName} application for ${application.intakeTerm} is ${application.status.replace(/_/g, " ")} at ${application.progressPct}% complete.`,
        kind: "portal",
      });
      facts.push(
        ...application.documents.filter((doc) => !isGovernmentIdDocument(doc.label)).map((doc) => ({
          id: `document:${doc.id}`,
          title: doc.label,
          uri: "/applicant/documents",
          text: `${doc.label} is ${doc.status.replace(/_/g, " ")}${doc.fileName ? ` (${doc.fileName})` : ""}.`,
          kind: "portal" as const,
        })),
      );
      facts.push(
        ...application.offers.map((offer) => ({
          id: `offer:${offer.id}`,
          title: offer.title,
          uri: "/applicant/offers",
          text: `${offer.title} is ${offer.status}${offer.conditions ? ` — ${offer.conditions}` : ""}.`,
          kind: "portal" as const,
        })),
      );
      facts.push(
        ...application.timeline.map((event) => ({
          id: `timeline:${event.id}`,
          title: event.title,
          uri: "/applicant/timeline",
          text: [event.title, event.detail].filter(Boolean).join(" — "),
          kind: "portal" as const,
        })),
      );
    }
  } else if (role === "employer") {
    const org = await prisma.employerOrg.findFirst({
      where: { institutionId: user.institutionId, accountId: user.accountId },
      include: {
        placements: { include: { hours: true, evaluations: true } },
        agreements: true,
      },
    });
    if (org) {
      facts.push({
        id: `employer:${org.id}`,
        title: org.name,
        uri: "/employer",
        text: `${org.name} · ${org.siteName} has ${org.placements.length} placements.`,
        kind: "portal",
      });
      facts.push(
        ...org.placements.map((placement) => ({
          id: `placement:${placement.id}`,
          title: placement.studentName,
          uri: "/employer/placements",
          text: `${placement.studentName} is on ${placement.programName} (${placement.status}).`,
          kind: "portal" as const,
        })),
      );
      const pendingHours = org.placements.flatMap((p) => p.hours.filter((h) => h.status === "pending"));
      if (pendingHours.length) {
        facts.push({
          id: `hours:pending:${org.id}`,
          title: "Hours awaiting sign-off",
          uri: "/employer/hours",
          text: `${pendingHours.length} hour log(s) are pending approval.`,
          kind: "portal",
        });
      }
      const dueEvals = org.placements.flatMap((p) => p.evaluations.filter((e) => e.status === "due"));
      if (dueEvals.length) {
        facts.push({
          id: `evaluations:due:${org.id}`,
          title: "Evaluations due",
          uri: "/employer/evaluations",
          text: `${dueEvals.length} clinical evaluation(s) are due.`,
          kind: "portal",
        });
      }
      facts.push(
        ...org.agreements.map((agreement) => ({
          id: `agreement:${agreement.id}`,
          title: agreement.title,
          uri: "/employer/agreements",
          text: `${agreement.title} is ${agreement.status}${agreement.renewsOn ? ` (renews ${agreement.renewsOn})` : ""}.`,
          kind: "portal" as const,
        })),
      );
    }
  } else {
    const portalRole = role;
    const records = await prisma.portalRecord.findMany({
      where: {
        institutionId: user.institutionId,
        role: portalRole,
        OR: [{ audienceAccountId: null }, { audienceAccountId: user.accountId }],
      },
      orderBy: [{ screenPath: "asc" }, { sortOrder: "asc" }],
      take: 20,
    });
    facts.push(
      ...records
        .filter((record) => safePortalRecord(`${record.primaryText} ${record.secondaryText ?? ""}`))
        .map((record) => ({
          id: `portal:${record.id}`,
          title: record.primaryText,
          uri: record.href?.startsWith("/") ? record.href : homeFor(role),
          text: [record.primaryText, record.secondaryText, record.metaText].filter(Boolean).join(" - "),
          kind: "portal" as const,
        })),
    );
  }

  const unread = await prisma.notification.count({
    where: { institutionId: user.institutionId, recipientAccountId: user.accountId, readAt: null },
  });
  const notificationUri =
    role === "applicant" || role === "employer" ? homeFor(role) : `${homeFor(role)}/notifications`;
  facts.push({
    id: `notifications:${user.accountId}`,
    title: "Your notifications",
    uri: notificationUri,
    text: `You have ${unread} unread notifications.`,
    kind: "notification",
  });

  return facts;
}
