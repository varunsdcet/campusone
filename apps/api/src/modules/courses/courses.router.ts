import { Router } from "express";
import { prisma } from "@myheritage/db";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { courseStatus } from "../../lib/courseStatus.js";
import { institutionTerms, sectionTerm, termLabel, type TermRef } from "../../lib/sectionTerm.js";
import { ymdIn } from "../../lib/workshopPolicy.js";
import { sectionOfferings } from "./sectionOffering.js";
import {
  DEFAULT_TZ,
  dateBoundsFromSessions,
  deliveryFromSessions,
  instructorDisplayName,
  roomFromSessions,
  scheduleTextFromSessions,
} from "./sectionSchedule.js";
import { personStudentIds } from "../me/studentAlignment.js";
import { enrolmentMark } from "../academic/program-plan.service.js";
import { facultySectionIds } from "../instructor/sectionFaculty.js";

export const coursesRouter: Router = Router();

async function offeredTerms(institutionId: string, sections: Array<{ id: string; term: TermRef }>) {
  const [offerings, terms] = await Promise.all([sectionOfferings(institutionId, sections.map((s) => s.id)), institutionTerms(institutionId)]);
  return (s: { id: string; term: TermRef }) => sectionTerm(s.term, { startsOn: offerings.get(s.id)?.startsOn, endsOn: offerings.get(s.id)?.endsOn }, terms);
}

/**
 * Shared instructor course selectors (gradebook, submissions, and older course views) must use the
 * same assignment rules as the main My Courses screen. A newly-created section is useful before its
 * first enrolment, and additional faculty are stored in session settings rather than Section's lead
 * instructor field.
 */
export async function instructorCourseItems(user: AuthedRequest["user"]) {
  const assignedIds = await facultySectionIds(user);
  const sections = await prisma.section.findMany({
    where: { institutionId: user.institutionId, id: { in: [...assignedIds] } },
    include: {
      course: true,
      term: true,
      _count: { select: { enrolments: { where: { status: "enrolled" } } } },
    },
  });
  const termOf = await offeredTerms(user.institutionId, sections);
  return sections.map((section) => ({
    sectionId: section.id,
    code: section.course.code,
    title: section.course.title,
    credits: section.course.credits,
    termCode: termOf(section)?.code ?? "",
    enrolmentCount: section._count.enrolments,
    status: "teaching",
  }));
}

coursesRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const roles = user.roles;

    if (roles.includes("admin") || roles.includes("registrar")) {
      const sections = await prisma.section.findMany({
        where: { institutionId: user.institutionId },
        include: {
          course: true,
          term: true,
          _count: { select: { enrolments: true } },
        },
      });
      const instructors = await prisma.person.findMany({
        where: {
          id: { in: [...new Set(sections.map((s) => s.instructorPersonId))] },
          institutionId: user.institutionId,
        },
      });
      const nameById = new Map(instructors.map((p) => [p.id, `${p.givenName} ${p.familyName}`]));
      const termOf = await offeredTerms(user.institutionId, sections);
      res.json({
        items: sections.map((s) => ({
          sectionId: s.id,
          code: s.course.code,
          title: s.course.title,
          credits: s.course.credits,
          termCode: termOf(s)?.code ?? "",
          instructorName: nameById.get(s.instructorPersonId) ?? "TBA",
          enrolmentCount: s._count.enrolments,
          status: "active",
        })),
      });
      return;
    }

    if (roles.includes("instructor")) {
      res.json({
        items: await instructorCourseItems(user),
      });
      return;
    }

    const studentIds = (await personStudentIds(user.institutionId, user.personId)).map((student) => student.id);
    if (!studentIds.length) {
      res.json({ items: [] });
      return;
    }

    const allEnrolments = await prisma.enrolment.findMany({
      where: {
        institutionId: user.institutionId,
        studentId: { in: studentIds },
        status: { in: ["enrolled", "completed", "waitlisted"] },
      },
      include: {
        section: {
          include: {
            course: true,
            term: true,
            academicBlock: true,
            classSessions: { orderBy: { startsAt: "asc" } },
          },
        },
        gradeItems: {
          where: { institutionId: user.institutionId, status: "published" },
          select: { score: true, maxScore: true, letter: true, assignment: { select: { weightPercent: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    // One login can own several program profiles. Courses belong to the person-facing portal,
    // so include every profile and collapse accidental duplicate enrolments for the same section.
    const statusRank: Record<string, number> = { enrolled: 3, waitlisted: 2, completed: 1 };
    const bySection = new Map<string, (typeof allEnrolments)[number]>();
    for (const enrolment of allEnrolments) {
      const previous = bySection.get(enrolment.sectionId);
      if (!previous || (statusRank[enrolment.status] ?? 0) > (statusRank[previous.status] ?? 0)) {
        bySection.set(enrolment.sectionId, enrolment);
      }
    }
    const enrolments = [...bySection.values()];

    const instructorIds = [...new Set(enrolments.map((e) => e.section.instructorPersonId))];
    const instructors = await prisma.person.findMany({
      where: { id: { in: instructorIds }, institutionId: user.institutionId },
    });
    const personById = new Map(instructors.map((p) => [p.id, p]));

    const planItems = await prisma.programPlanItem.findMany({
      where: {
        institutionId: user.institutionId,
        plan: { studentId: { in: studentIds }, institutionId: user.institutionId },
        OR: [
          { sectionId: { in: enrolments.map((e) => e.sectionId) } },
          { courseCode: { in: [...new Set(enrolments.map((e) => e.section.course.code))] } },
        ],
      },
    });
    const planBySection = new Map(planItems.filter((i) => i.sectionId).map((i) => [i.sectionId!, i]));
    const planByCode = new Map(planItems.map((i) => [i.courseCode, i]));
    const [offerings, institution, terms] = await Promise.all([
      sectionOfferings(user.institutionId, enrolments.map((e) => e.sectionId)),
      prisma.institution.findFirst({ where: { id: user.institutionId }, select: { timezone: true } }),
      institutionTerms(user.institutionId),
    ]);
    const tz = institution?.timezone || DEFAULT_TZ;
    const today = ymdIn(new Date(), tz);

    const rows = enrolments
      .map((e) => {
        const scored = e.gradeItems.filter((grade) => grade.score != null && grade.maxScore > 0);
        const progressPercent =
          scored.length > 0
            ? Number(
                (
                  (scored.reduce((sum, grade) => sum + (grade.score ?? 0) / grade.maxScore, 0) / scored.length) *
                  100
                ).toFixed(1),
              )
            : null;
        const sessions = e.section.classSessions;
        const fromSessions = dateBoundsFromSessions(sessions, tz);
        const plan = planBySection.get(e.sectionId) ?? planByCode.get(e.section.course.code);
        const offering = offerings.get(e.sectionId);
        const startsOn =
          offering?.startsOn || plan?.startsOn || e.section.academicBlock?.startsOn || fromSessions.startsOn || e.section.term.startsOn;
        const endsOn =
          offering?.endsOn || plan?.endsOn || e.section.academicBlock?.endsOn || fromSessions.endsOn || e.section.term.endsOn;
        const term = sectionTerm(e.section.term, { startsOn, endsOn }, terms);
        return {
          termCode: term?.code ?? "",
          course: {
            sectionId: e.sectionId,
            courseCode: e.section.course.code,
            courseTitle: e.section.course.title,
            sectionCode: e.section.code,
            termName: termLabel(term),
            credits: e.section.course.credits,
            instructorName: instructorDisplayName(personById.get(e.section.instructorPersonId)) ?? "TBA",
            enrolmentStatus: e.status as "enrolled" | "completed" | "waitlisted",
            courseStatus: courseStatus({ status: e.status, startsOn, endsOn, averagePercent: progressPercent, letter: enrolmentMark(e.status, e.gradeItems).letter }, today),
            progressPercent,
            deliveryMethod: offering?.deliveryMethod || deliveryFromSessions(sessions),
            location: offering?.location || roomFromSessions(sessions) || "TBD",
            scheduleText: offering?.scheduleText || scheduleTextFromSessions(sessions, tz) || plan?.scheduleText || null,
            startsOn,
            endsOn,
          },
        };
      })
      .sort((a, b) => {
        const rank = (code: string) => (/^ACSW\s*500$/i.test(code) ? 0 : 1);
        const diff = rank(a.course.courseCode) - rank(b.course.courseCode);
        if (diff !== 0) return diff;
        return a.course.courseCode.localeCompare(b.course.courseCode);
      });
    const courses = rows.map((r) => r.course);

    res.json({
      courses,
      items: rows.map(({ course, termCode }) => ({
        sectionId: course.sectionId,
        code: course.courseCode,
        title: course.courseTitle,
        credits: course.credits,
        termCode,
        instructorName: course.instructorName,
        status: course.enrolmentStatus,
        courseStatus: course.courseStatus,
        progressPercent: course.progressPercent,
      })),
    });
  } catch (err) {
    next(err);
  }
});
