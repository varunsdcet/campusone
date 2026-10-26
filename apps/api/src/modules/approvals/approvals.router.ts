import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { ApprovalInboxResponse, DecideApprovalRequest } from "@myheritage/contracts";
import { canDecideApproval, decideApproval, parseApproverRoles } from "@myheritage/auth";
import { prisma } from "@myheritage/db";
import { requireAuth, requireRoles, type AuthedRequest } from "../../middleware/auth.js";
import { assertPermission } from "../admin/superAdmin.service.js";
import { applyApprovedRequest, settleRejectedApproval } from "./approvals.service.js";

export const approvalsRouter: Router = Router();

const GRADE_PUBLISH_TYPES = new Set(["grade.publish", "grade_publish"]);

/** Every Staff access level carries the `registrar` role, so the role alone does not prove the level may act on requests. */
const requireUserRequests = (mode: "view" | "edit") => (req: Request, _res: Response, next: NextFunction) => {
  assertPermission((req as AuthedRequest).user, "userRequests", mode).then(() => next(), next);
};

approvalsRouter.get("/", requireAuth, requireRoles("admin", "registrar"), requireUserRequests("view"), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const rows = (
      await prisma.approvalRequest.findMany({
        where: { institutionId: user.institutionId, status: { in: ["pending", "approved"] } },
        orderBy: { createdAt: "desc" },
      })
    ).filter((r) => canDecideApproval(user.roles, parseApproverRoles(r.requiredApproverRolesJson)));

    const studentIdOf = (subjectRef: string) => subjectRef.replace(/^student:/, "");
    const studentIds = [...new Set(rows.map((r) => studentIdOf(r.subjectRef)))];
    const students = studentIds.length
      ? await prisma.student.findMany({
          where: { institutionId: user.institutionId, id: { in: studentIds } },
          include: { person: true },
        })
      : [];
    const byId = new Map(students.map((s) => [s.id, s]));

    const otherIds = [
      ...new Set(rows.filter((r) => !byId.has(studentIdOf(r.subjectRef))).map((r) => r.subjectRef.replace(/^section:/, ""))),
    ];
    const requesterIds = [...new Set(rows.map((r) => r.requestedBy))];
    const [sections, requesters] = await Promise.all([
      otherIds.length
        ? prisma.section.findMany({
            where: { institutionId: user.institutionId, id: { in: otherIds } },
            select: { id: true, code: true, course: { select: { code: true, title: true } } },
          })
        : [],
      requesterIds.length
        ? prisma.account.findMany({
            where: { institutionId: user.institutionId, id: { in: requesterIds } },
            select: { id: true, email: true, person: { select: { givenName: true, familyName: true } } },
          })
        : [],
    ]);
    const sectionById = new Map(
      sections.map((s) => [s.id, `${s.code.includes(s.course.code) ? s.code : `${s.course.code} ${s.code}`} — ${s.course.title}`]),
    );
    const requesterById = new Map(
      requesters.map((a) => [a.id, `${a.person.givenName} ${a.person.familyName}`.trim() || a.email]),
    );

    const gradeIdsOf = (r: (typeof rows)[number]) => {
      if (!GRADE_PUBLISH_TYPES.has(r.type)) return [];
      const ids = (JSON.parse(r.proposedDiffJson) as { gradeItemIds?: unknown }).gradeItemIds;
      return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
    };
    const allGradeIds = [...new Set(rows.flatMap(gradeIdsOf))];
    const gradeItems = allGradeIds.length
      ? await prisma.gradeItem.findMany({
          where: { institutionId: user.institutionId, id: { in: allGradeIds } },
          select: {
            id: true,
            score: true,
            maxScore: true,
            letter: true,
            feedback: true,
            student: { select: { studentNumber: true, person: { select: { givenName: true, familyName: true } } } },
            assignment: {
              select: {
                title: true,
                section: { select: { id: true, code: true, course: { select: { code: true, title: true } } } },
              },
            },
          },
        })
      : [];
    const gradeById = new Map(gradeItems.map((g) => [g.id, g]));
    const sectionLabelOf = (s: { code: string; course: { code: string; title: string } }) =>
      `${s.code.includes(s.course.code) ? s.code : `${s.course.code} ${s.code}`} — ${s.course.title}`;
    const gradeMetaOf = (r: (typeof rows)[number]) => {
      const items = gradeIdsOf(r)
        .map((id) => gradeById.get(id))
        .filter((g): g is NonNullable<typeof g> => Boolean(g));
      if (!items.length) return {};
      const sectionLabels = [...new Set(items.map((g) => sectionLabelOf(g.assignment.section)))];
      return {
        gradeSection: sectionLabels.join("; "),
        gradeRows: items.map((g) => ({
          studentName: `${g.student.person.givenName} ${g.student.person.familyName}`.trim(),
          studentNumber: g.student.studentNumber,
          assignment: g.assignment.title,
          score: g.score,
          maxScore: g.maxScore,
          letter: g.letter,
          feedback: g.feedback,
        })),
      };
    };

    res.json(
      ApprovalInboxResponse.parse({
        items: rows.map((r) => {
          const proposedDiff = JSON.parse(r.proposedDiffJson) as Record<string, unknown>;
          const student = byId.get(studentIdOf(r.subjectRef));
          const gradeMeta = gradeMetaOf(r);
          const currentValues =
            student && r.type === "student_profile_change"
              ? {
                  givenName: student.person.givenName,
                  familyName: student.person.familyName,
                  middleName: student.person.middleName,
                  preferredName: student.person.preferredName,
                  primaryEmail: student.person.email,
                  personalEmail: student.person.personalEmail,
                  phone: student.person.phone,
                  dateOfBirth: student.person.dateOfBirth,
                  emergencyContactName: student.person.emergencyContactName,
                  emergencyContactPhone: student.person.emergencyContactPhone,
                }
              : null;
          return {
            id: r.id,
            institutionId: r.institutionId,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
            rowVersion: r.rowVersion,
            type: r.type,
            subjectRef: r.subjectRef,
            proposedDiff: {
              ...proposedDiff,
              _meta: {
                ...(student
                  ? {
                      studentNumber: student.studentNumber,
                      studentName: `${student.person.givenName} ${student.person.familyName}`,
                      currentValues,
                    }
                  : {}),
                ...gradeMeta,
                subjectLabel: sectionById.get(r.subjectRef.replace(/^section:/, "")) ?? gradeMeta.gradeSection ?? null,
                requestedByName: requesterById.get(r.requestedBy) ?? null,
                requestedByMe: r.requestedBy === user.accountId,
                decidedByMe: (JSON.parse(r.decisionsJson) as Array<{ actorId?: string }>).some(
                  (d) => d.actorId === user.accountId,
                ),
              },
            },
            requestedBy: r.requestedBy,
            requiredApproverRoles: JSON.parse(r.requiredApproverRolesJson),
            requiredCount: r.requiredCount,
            status: r.status,
            decisions: JSON.parse(r.decisionsJson),
          };
        }),
      }),
    );
  } catch (err) {
    next(err);
  }
});

approvalsRouter.post(
  "/:id/decide",
  requireAuth,
  requireRoles("admin", "registrar"),
  requireUserRequests("edit"),
  async (req, res, next) => {
    try {
      const user = (req as AuthedRequest).user;
      const id = z.string().uuid().parse(req.params.id);
      const body = DecideApprovalRequest.parse(req.body);
      const updated = await decideApproval({
        approvalId: id,
        institutionId: user.institutionId,
        actorId: user.accountId,
        actorRoles: user.roles,
        decision: body.decision,
        comment: body.comment,
      });
      if (updated.status === "rejected") await settleRejectedApproval(user.institutionId, id, body.comment);
      // Grade publication has no useful intermediate state for staff: once the
      // required reviewer approves it, publish it atomically through the same
      // audited apply path so the student can see the marks immediately.
      const final = updated.status === "approved" && GRADE_PUBLISH_TYPES.has(updated.type)
        ? await applyApprovedRequest(user.institutionId, id, user.accountId)
        : updated;
      res.json({ id: final.id, status: final.status });
    } catch (err) {
      next(err);
    }
  },
);

approvalsRouter.post(
  "/:id/apply",
  requireAuth,
  requireRoles("admin", "registrar"),
  requireUserRequests("edit"),
  async (req, res, next) => {
    try {
      const user = (req as AuthedRequest).user;
      const id = z.string().uuid().parse(req.params.id);
      const updated = await applyApprovedRequest(user.institutionId, id, user.accountId);
      res.json({ id: updated.id, status: updated.status });
    } catch (err) {
      next(err);
    }
  },
);
