import { randomUUID } from "crypto";
import { prisma } from "@myheritage/db";
import { POLICY, isAbsentStatus, type CaseKind } from "./policy.js";
import {
  accountIdForPerson,
  accountIdsForStudents,
  adminAccountIds,
  notifyAccount,
  notifyAccounts,
} from "./notify.js";
import { notificationJoinUrl, sessionJoinUrl } from "../../lib/liveClass.js";

async function upsertOpenCase(input: {
  institutionId: string;
  subjectType: string;
  subjectRef: string;
  caseKind: CaseKind;
  severity: string;
  title: string;
  detail: string;
  missCount?: number;
  meta?: Record<string, unknown>;
}) {
  const existing = await prisma.complianceCase.findFirst({
    where: {
      institutionId: input.institutionId,
      subjectType: input.subjectType,
      subjectRef: input.subjectRef,
      caseKind: input.caseKind,
      status: "open",
    },
  });
  if (existing) {
    return prisma.complianceCase.update({
      where: { id: existing.id },
      data: {
        severity: input.severity,
        title: input.title,
        detail: input.detail,
        missCount: input.missCount ?? existing.missCount,
        metaJson: JSON.stringify(input.meta ?? {}),
        rowVersion: { increment: 1 },
      },
    });
  }
  return prisma.complianceCase.create({
    data: {
      id: randomUUID(),
      institutionId: input.institutionId,
      subjectType: input.subjectType,
      subjectRef: input.subjectRef,
      caseKind: input.caseKind,
      severity: input.severity,
      status: "open",
      title: input.title,
      detail: input.detail,
      missCount: input.missCount ?? 0,
      metaJson: JSON.stringify(input.meta ?? {}),
    },
  });
}

/** Consecutive calendar days with an absent attendance mark (most recent first). */
function consecutiveAbsentDays(labels: string[]): number {
  const isoDay = /^(\d{4})-(\d{2})-(\d{2})$/;
  const days = [
    ...new Set(
      labels
        .map((l) => String(l || "").trim().slice(0, 10))
        .filter((d) => isoDay.test(d)),
    ),
  ].sort().reverse();
  if (!days.length) return 0;
  let streak = 0;
  const cursor = new Date(`${days[0]}T12:00:00`);
  if (Number.isNaN(cursor.getTime())) return 0;
  for (const day of days) {
    const expected = cursor.toISOString().slice(0, 10);
    if (day !== expected) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export async function escalateStudentMisses(institutionId: string) {
  const absences = await prisma.attendanceRecord.findMany({
    where: { institutionId },
    orderBy: { recordedAt: "desc" },
    take: 5000,
  });
  const byStudent = new Map<string, string[]>();
  for (const row of absences) {
    if (!isAbsentStatus(row.status)) continue;
    const list = byStudent.get(row.studentId) ?? [];
    list.push(row.meetingLabel || row.recordedAt.toISOString().slice(0, 10));
    byStudent.set(row.studentId, list);
  }

  let warned = 0;
  let paused = 0;

  for (const [studentId, labels] of byStudent) {
    const streak = consecutiveAbsentDays(labels);
    if (streak < POLICY.MISS_WARN_DAYS) continue;

    const student = await prisma.student.findFirst({
      where: { id: studentId, institutionId },
      include: { person: { include: { accounts: true } } },
    });
    if (!student) continue;
    const name = `${student.person.givenName} ${student.person.familyName}`.trim();
    const account =
      student.person.accounts.find((a) => a.status === "active" || a.status === "paused") ??
      student.person.accounts[0];

    if (streak >= POLICY.MISS_PAUSE_DAYS) {
      await upsertOpenCase({
        institutionId,
        subjectType: "student",
        subjectRef: studentId,
        caseKind: POLICY.CASE_KINDS.STUDENT_MISS_PAUSE,
        severity: "critical",
        title: `Login paused — ${streak} consecutive missed class days`,
        detail: `${name} (${student.studentNumber}) missed ${streak} consecutive class days. Login is paused until an explanation is submitted.`,
        missCount: streak,
        meta: { studentNumber: student.studentNumber, name },
      });
      if (account && account.status !== "paused") {
        await prisma.account.update({ where: { id: account.id }, data: { status: "paused" } });
      }
      await prisma.student.update({
        where: { id: studentId },
        data: { standing: "alert" },
      });
      if (account) {
        await notifyAccount({
          institutionId,
          accountId: account.id,
          title: "Login paused — missed classes",
          body: `College policy: after ${POLICY.MISS_PAUSE_DAYS} consecutive missed class days your access is paused. Submit an explanation to restore access.`,
          templateKey: "compliance.miss.pause",
        });
      }
      const admins = await adminAccountIds(institutionId);
      await notifyAccounts({
        institutionId,
        accountIds: admins,
        title: `Student paused: ${name}`,
        body: `${name} reached ${streak} consecutive absences. Login paused pending explanation.`,
        templateKey: "compliance.miss.pause.staff",
      });
      paused += 1;
      continue;
    }

    await upsertOpenCase({
      institutionId,
      subjectType: "student",
      subjectRef: studentId,
      caseKind: POLICY.CASE_KINDS.STUDENT_MISS_WARN,
      severity: "warning",
      title: `Attendance warning — ${streak} consecutive misses`,
      detail: `${name} (${student.studentNumber}) has ${streak} consecutive missed class days. One more miss pauses login.`,
      missCount: streak,
      meta: { studentNumber: student.studentNumber, name },
    });
    if (student.standing === "good") {
      await prisma.student.update({ where: { id: studentId }, data: { standing: "warning" } });
    }
    if (account) {
      await notifyAccount({
        institutionId,
        accountId: account.id,
        title: "Attendance warning",
        body: `You have missed ${streak} consecutive class days. Per college policy a red flag is raised; after ${POLICY.MISS_PAUSE_DAYS} days login is paused.`,
        templateKey: "compliance.miss.warn",
      });
    }
    warned += 1;
  }

  return { warned, paused };
}

export async function teacherAttendanceSla(institutionId: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const todayLabel = start.toISOString().slice(0, 10);

  const sessions = await prisma.classSession.findMany({
    where: {
      institutionId,
      startsAt: { gte: start, lte: end },
    },
    include: {
      section: {
        include: {
          course: true,
          enrolments: { where: { status: "enrolled" }, select: { id: true } },
        },
      },
    },
  });

  let flagged = 0;
  const now = new Date();

  for (const session of sessions) {
    if (!session.section.enrolments.length) continue;
    if (!(session.startsAt instanceof Date) || Number.isNaN(session.startsAt.getTime())) continue;
    const ends = session.endsAt ?? new Date(session.startsAt.getTime() + 90 * 60 * 1000);
    if (Number.isNaN(ends.getTime()) || ends > now) continue;

    const recorded = await prisma.attendanceRecord.count({
      where: {
        institutionId,
        sectionId: session.sectionId,
        OR: [{ meetingLabel: todayLabel }, { classSessionId: session.id }],
      },
    });
    if (recorded > 0) continue;

    const instructorAccountId = await accountIdForPerson(institutionId, session.section.instructorPersonId);
    if (!instructorAccountId) continue;

    await upsertOpenCase({
      institutionId,
      subjectType: "instructor",
      subjectRef: instructorAccountId,
      caseKind: POLICY.CASE_KINDS.TEACHER_ATTENDANCE_SLA,
      severity: "warning",
      title: `Attendance not submitted — ${session.section.course.code}`,
      detail: `${session.title} (${session.section.code}) ended without attendance. Submit attendance or provide an explanation.`,
      meta: {
        sectionId: session.sectionId,
        classSessionId: session.id,
        courseCode: session.section.course.code,
      },
    });
    await notifyAccount({
      institutionId,
      accountId: instructorAccountId,
      title: "Attendance SLA — action required",
      body: `Attendance was not submitted for ${session.section.course.code} (${session.section.code}) today before end of session. Your accountability inbox is locked on this item until resolved.`,
      templateKey: "compliance.teacher.attendance",
    });
    const admins = await adminAccountIds(institutionId);
    await notifyAccounts({
      institutionId,
      accountIds: admins,
      title: `Teacher attendance missing: ${session.section.course.code}`,
      body: `Instructor did not submit attendance for ${session.section.code} on ${todayLabel}.`,
      templateKey: "compliance.teacher.attendance.staff",
    });
    flagged += 1;
  }

  return { flagged };
}

export async function teacherGradeSla(institutionId: string) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - POLICY.GRADE_SLA_DAYS_AFTER_DUE);

  const assignments = await prisma.assignment.findMany({
    where: {
      institutionId,
      dueAt: { lte: cutoff },
    },
    include: {
      section: {
        include: {
          course: true,
          enrolments: { where: { status: "enrolled" } },
        },
      },
      gradeItems: true,
    },
    take: 200,
  });

  let flagged = 0;
  for (const asg of assignments) {
    const enrolled = asg.section.enrolments.length;
    if (!enrolled) continue;
    const complete = asg.gradeItems.filter(
      (g) => g.score != null && g.status !== "draft",
    ).length;
    if (complete >= enrolled) continue;

    const instructorAccountId = await accountIdForPerson(institutionId, asg.section.instructorPersonId);
    if (!instructorAccountId) continue;

    await upsertOpenCase({
      institutionId,
      subjectType: "instructor",
      subjectRef: instructorAccountId,
      caseKind: POLICY.CASE_KINDS.TEACHER_GRADE_SLA,
      severity: "warning",
      title: `Grades overdue — ${asg.section.course.code} · ${asg.title}`,
      detail: `${complete}/${enrolled} grades submitted for ${asg.title} (due ${asg.dueAt?.toISOString().slice(0, 10) ?? "—"}). Submit grades or explain the delay.`,
      meta: {
        assignmentId: asg.id,
        sectionId: asg.sectionId,
        missing: enrolled - complete,
      },
    });
    await notifyAccount({
      institutionId,
      accountId: instructorAccountId,
      title: "Grade submission SLA",
      body: `${asg.section.course.code}: ${asg.title} is past the grade submission window with missing scores. Open the accountability inbox to submit or explain.`,
      templateKey: "compliance.teacher.grades",
    });
    flagged += 1;
  }

  return { flagged };
}

export async function studentWorkMissFlags(institutionId: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const dueToday = await prisma.assignment.findMany({
    where: {
      institutionId,
      dueAt: { gte: start, lte: end },
    },
    include: {
      section: { include: { course: true, enrolments: { where: { status: "enrolled" } } } },
      gradeItems: true,
      submissions: true,
    },
  });

  let flagged = 0;
  for (const asg of dueToday) {
    for (const enr of asg.section.enrolments) {
      const submitted = asg.submissions.some(
        (s) => s.studentId === enr.studentId && (s.status === "submitted" || s.status === "returned"),
      );
      const graded = asg.gradeItems.some((g) => g.studentId === enr.studentId && g.score != null);
      if (submitted || graded) continue;

      await upsertOpenCase({
        institutionId,
        subjectType: "student",
        subjectRef: enr.studentId,
        caseKind: POLICY.CASE_KINDS.STUDENT_WORK_MISS,
        severity: "warning",
        title: `Missing work — ${asg.section.course.code}`,
        detail: `No submission for “${asg.title}” due today.`,
        meta: { assignmentId: asg.id, sectionId: asg.sectionId },
      });
      const ids = await accountIdsForStudents(institutionId, [enr.studentId]);
      await notifyAccounts({
        institutionId,
        accountIds: ids,
        title: "Assignment due today — not submitted",
        body: `${asg.section.course.code}: “${asg.title}” was due today and is still missing.`,
        templateKey: "compliance.work.miss",
      });
      flagged += 1;
    }
  }

  return { flagged };
}

export async function sendPreclassReminders(institutionId: string) {
  const now = Date.now();
  let sent = 0;

  for (const minutes of POLICY.PRECLASS_MINUTES) {
    const windowStart = new Date(now + (minutes - 2) * 60_000);
    const windowEnd = new Date(now + (minutes + 2) * 60_000);
    const sessions = await prisma.classSession.findMany({
      where: {
        institutionId,
        startsAt: { gte: windowStart, lte: windowEnd },
      },
      include: {
        section: {
          include: {
            course: true,
            enrolments: { where: { status: "enrolled" }, select: { studentId: true } },
          },
        },
      },
    });

    for (const session of sessions) {
      const marker = `#session:${session.id}:${minutes}`;
      const dup = await prisma.notification.findFirst({
        where: {
          institutionId,
          templateKey: `compliance.preclass.${minutes}`,
          body: { contains: marker },
          createdAt: { gte: new Date(now - 30 * 60_000) },
        },
      });
      if (dup) continue;

      const studentIds = session.section.enrolments.map((e) => e.studentId);
      const studentAccounts = await accountIdsForStudents(institutionId, studentIds);
      const instructorAccountId = await accountIdForPerson(institutionId, session.section.instructorPersonId);
      const when = session.startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const title = `Class in ${minutes} minutes`;
      const body = `${session.section.course.code}: ${session.title} starts at ${when}.${session.joinUrl ? ` Join: ${notificationJoinUrl(sessionJoinUrl(session.sectionId, session.joinUrl))}` : ""}\n${marker}`;
      await notifyAccounts({
        institutionId,
        accountIds: studentAccounts,
        title,
        body,
        templateKey: `compliance.preclass.${minutes}`,
      });
      if (instructorAccountId) {
        await notifyAccount({
          institutionId,
          accountId: instructorAccountId,
          title,
          body,
          templateKey: `compliance.preclass.instructor.${minutes}`,
        });
      }
      sent += studentAccounts.length + (instructorAccountId ? 1 : 0);
    }
  }

  return { sent };
}

export async function sendDailyClassDigest(institutionId: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const hour = new Date().getHours();
  // Send once in the morning window only (06:00–08:59 local server time).
  if (hour < 6 || hour >= 9) return { sent: 0, sessions: 0, skipped: true as const };

  const already = await prisma.notification.count({
    where: {
      institutionId,
      templateKey: "compliance.daily.schedule",
      createdAt: { gte: start },
    },
  });
  if (already > 0) return { sent: 0, sessions: 0, skipped: true as const };

  const sessions = await prisma.classSession.findMany({
    where: { institutionId, startsAt: { gte: start, lte: end } },
    include: {
      section: {
        include: {
          course: true,
          enrolments: { where: { status: "enrolled" }, select: { studentId: true } },
        },
      },
    },
    orderBy: { startsAt: "asc" },
  });

  const byStudent = new Map<string, string[]>();
  for (const session of sessions) {
    const line = `${session.startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · ${session.section.course.code} · ${session.title}`;
    for (const e of session.section.enrolments) {
      const list = byStudent.get(e.studentId) ?? [];
      list.push(line);
      byStudent.set(e.studentId, list);
    }
  }

  let sent = 0;
  for (const [studentId, lines] of byStudent) {
    const ids = await accountIdsForStudents(institutionId, [studentId]);
    if (!ids.length) continue;
    await notifyAccounts({
      institutionId,
      accountIds: ids,
      title: "Today’s class schedule",
      body: lines.join("\n"),
      templateKey: "compliance.daily.schedule",
    });
    sent += 1;
  }
  return { sent, sessions: sessions.length, skipped: false as const };
}

export async function notifyMissedClassAfterStart(institutionId: string) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 20 * 60_000);
  const windowEnd = new Date(now.getTime() - 5 * 60_000);

  const sessions = await prisma.classSession.findMany({
    where: {
      institutionId,
      startsAt: { gte: windowStart, lte: windowEnd },
    },
    include: {
      section: {
        include: {
          course: true,
          enrolments: { where: { status: "enrolled" } },
        },
      },
      attendanceRecords: true,
    },
  });

  let notified = 0;
  for (const session of sessions) {
    const presentIds = new Set(
      session.attendanceRecords
        .filter((r) => !isAbsentStatus(r.status))
        .map((r) => r.studentId),
    );
    // If no attendance yet, treat all enrolled as potentially missing and nudge once.
    const missing = session.section.enrolments.filter((e) => !presentIds.has(e.studentId));
    if (!missing.length) continue;

    const studentAccounts = await accountIdsForStudents(
      institutionId,
      missing.map((m) => m.studentId),
    );
    await notifyAccounts({
      institutionId,
      accountIds: studentAccounts,
      title: "You may have missed class",
      body: `${session.section.course.code}: “${session.title}” started. If you were absent, open MyHeritage to confirm or contact your instructor.`,
      templateKey: "compliance.miss.reminder",
    });

    const instructorAccountId = await accountIdForPerson(institutionId, session.section.instructorPersonId);
    if (instructorAccountId) {
      await notifyAccount({
        institutionId,
        accountId: instructorAccountId,
        title: `Roster check — ${session.section.course.code}`,
        body: `${missing.length} student(s) not marked present for “${session.title}”. Review attendance.`,
        templateKey: "compliance.miss.instructor",
      });
    }
    notified += studentAccounts.length;
  }

  return { notified };
}

export async function runComplianceSweep(institutionId?: string) {
  const institutions = institutionId
    ? [{ id: institutionId }]
    : await prisma.institution.findMany({ select: { id: true } });

  const summary = {
    institutions: institutions.length,
    warned: 0,
    paused: 0,
    attendanceSla: 0,
    gradeSla: 0,
    workMiss: 0,
    preclass: 0,
    digest: 0,
    missReminders: 0,
    errors: [] as string[],
  };

  for (const inst of institutions) {
    const step = async <T,>(name: string, fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn();
      } catch (err) {
        summary.errors.push(`${name}:${err instanceof Error ? err.message : String(err)}`);
        return null;
      }
    };

    const miss = await step("miss", () => escalateStudentMisses(inst.id));
    const att = await step("attendance", () => teacherAttendanceSla(inst.id));
    const grades = await step("grades", () => teacherGradeSla(inst.id));
    const work = await step("work", () => studentWorkMissFlags(inst.id));
    const pre = await step("preclass", () => sendPreclassReminders(inst.id));
    const digest = await step("digest", () => sendDailyClassDigest(inst.id));
    const missRem = await step("missReminders", () => notifyMissedClassAfterStart(inst.id));
    if (miss) {
      summary.warned += miss.warned;
      summary.paused += miss.paused;
    }
    if (att) summary.attendanceSla += att.flagged;
    if (grades) summary.gradeSla += grades.flagged;
    if (work) summary.workMiss += work.flagged;
    if (pre) summary.preclass += pre.sent;
    if (digest) summary.digest += digest.sent;
    if (missRem) summary.missReminders += missRem.notified;
  }

  return summary;
}
