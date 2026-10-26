import { Router } from "express";
import { prisma } from "@myheritage/db";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { sessionJoinUrl } from "../../lib/liveClass.js";
import { personStudentIds } from "../me/studentAlignment.js";
import { currentTerm } from "../../lib/currentTerm.js";

export const calendarRouter: Router = Router();

calendarRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const roles = user.roles;

    let sectionIds: string[] = [];

    if (roles.includes("instructor")) {
      const sections = await prisma.section.findMany({
        where: { institutionId: user.institutionId, instructorPersonId: user.personId },
        select: { id: true },
      });
      sectionIds = sections.map((s) => s.id);
    } else if (!roles.includes("admin") && !roles.includes("registrar")) {
      const studentIds = (await personStudentIds(user.institutionId, user.personId)).map((student) => student.id);
      if (studentIds.length) {
        const enrolments = await prisma.enrolment.findMany({
          where: { institutionId: user.institutionId, studentId: { in: studentIds }, status: "enrolled" },
          select: { sectionId: true },
        });
        sectionIds = [...new Set(enrolments.map((e) => e.sectionId))];
      }
    } else {
      const sections = await prisma.section.findMany({
        where: { institutionId: user.institutionId },
        select: { id: true },
      });
      sectionIds = sections.map((s) => s.id);
    }

    const term = await currentTerm(user.institutionId);

    const assignments =
      sectionIds.length > 0
        ? await prisma.assignment.findMany({
            where: { institutionId: user.institutionId, sectionId: { in: sectionIds }, dueAt: { not: null } },
            include: { section: { include: { course: true } } },
            orderBy: { dueAt: "asc" },
          })
        : [];

    const sessions =
      sectionIds.length > 0
        ? await prisma.classSession.findMany({
            where: { institutionId: user.institutionId, sectionId: { in: sectionIds } },
            include: { section: { include: { course: true } } },
            orderBy: { startsAt: "asc" },
          })
        : [];

    const deadlineEvents = assignments.map((a) => ({
      id: `asg-${a.id}`,
      title: `${a.title} due`,
      startsAt: a.dueAt!.toISOString(),
      endsAt: a.dueAt!.toISOString(),
      location: "Online submission",
      courseCode: a.section.course.code,
      type: "deadline" as const,
    }));

    const classEvents = sessions.map((session) => ({
      id: `session-${session.id}`,
      classSessionId: session.id,
      title: session.title,
      startsAt: session.startsAt.toISOString(),
      endsAt: session.endsAt?.toISOString() ?? null,
      location: session.location,
      courseCode: session.section.course.code,
      type: "class" as const,
      sessionKind: session.sessionKind === "lab" ? ("lab" as const) : ("lecture" as const),
      joinUrl: sessionJoinUrl(session.sectionId, session.joinUrl),
    }));

    const items = [...classEvents, ...deadlineEvents].sort((a, b) =>
      a.startsAt.localeCompare(b.startsAt),
    );

    res.json({
      items,
      events: items.map((item) => ({
        id: item.id,
        kind: item.type === "class" ? "class" : "assignment_deadline",
        sectionId:
          item.type === "class"
            ? sessions.find((session) => `session-${session.id}` === item.id)?.sectionId ?? null
            : assignments.find((assignment) => `asg-${assignment.id}` === item.id)?.sectionId ?? null,
        classSessionId: "classSessionId" in item ? item.classSessionId : null,
        sessionKind: "sessionKind" in item ? item.sessionKind : null,
        title: item.title,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        location: item.location,
        joinUrl: "joinUrl" in item ? item.joinUrl : null,
      })),
      termCode: term?.code ?? "2026F",
    });
  } catch (err) {
    next(err);
  }
});
