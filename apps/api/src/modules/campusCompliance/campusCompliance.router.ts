import { Router } from "express";
import { z } from "zod";
import { prisma } from "@myheritage/db";
import { requireAuth, requireRoles, type AuthedRequest } from "../../middleware/auth.js";
import { runComplianceSweep } from "./sweep.js";
import {
  createClassSessionWithNotifications,
  mobileJoinReport,
  recordSessionJoin,
  upcomingSessionsForPerson,
} from "./sessions.js";
import { buildComplianceInbox, submitExplanation } from "./inbox.js";
import { POLICY } from "./policy.js";
import { currentStudentId } from "../me/studentAlignment.js";

export const campusComplianceRouter: Router = Router();

campusComplianceRouter.post(
  "/sweep",
  requireAuth,
  requireRoles("admin", "registrar"),
  async (req, res, next) => {
    try {
      const user = (req as AuthedRequest).user;
      const summary = await runComplianceSweep(user.institutionId);
      res.json({ ok: true, summary, policy: POLICY });
    } catch (err) {
      next(err);
    }
  },
);

campusComplianceRouter.get("/inbox", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    res.json(
      await buildComplianceInbox({
        institutionId: user.institutionId,
        accountId: user.accountId,
        personId: user.personId,
        roles: user.roles,
      }),
    );
  } catch (err) {
    next(err);
  }
});

campusComplianceRouter.post("/explain", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const body = z
      .object({
        caseId: z.string().uuid(),
        explanation: z.string().min(10).max(4000),
      })
      .parse(req.body);
    const result = await submitExplanation({
      institutionId: user.institutionId,
      accountId: user.accountId,
      personId: user.personId,
      roles: user.roles,
      caseId: body.caseId,
      explanation: body.explanation,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

campusComplianceRouter.get("/upcoming", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const hours = Number(req.query.hours ?? 24);
    const items = await upcomingSessionsForPerson({
      institutionId: user.institutionId,
      personId: user.personId,
      roles: user.roles,
      withinHours: Number.isFinite(hours) ? hours : 24,
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

campusComplianceRouter.post(
  "/sessions",
  requireAuth,
  requireRoles("instructor", "admin"),
  async (req, res, next) => {
    try {
      const user = (req as AuthedRequest).user;
      const body = z
        .object({
          sectionId: z.string().uuid(),
          title: z.string().min(1).max(200),
          startsAt: z.string().datetime(),
          endsAt: z.string().datetime().optional().nullable(),
          location: z.string().max(200).optional().nullable(),
          joinUrl: z.string().url().optional().nullable(),
          deliveryMode: z.string().optional(),
          sessionKind: z.string().optional(),
          notifyStudentIds: z.array(z.string().uuid()).optional(),
        })
        .parse(req.body);
      const result = await createClassSessionWithNotifications({
        institutionId: user.institutionId,
        sectionId: body.sectionId,
        title: body.title,
        startsAt: new Date(body.startsAt),
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        location: body.location,
        joinUrl: body.joinUrl,
        deliveryMode: body.deliveryMode,
        sessionKind: body.sessionKind,
        notifyStudentIds: body.notifyStudentIds,
        createdByAccountId: user.accountId,
      });
      res.status(201).json({
        ok: true,
        session: {
          id: result.session.id,
          title: result.session.title,
          startsAt: result.session.startsAt.toISOString(),
          joinUrl: result.session.joinUrl,
        },
        notified: result.notified,
      });
    } catch (err) {
      next(err);
    }
  },
);

campusComplianceRouter.post("/sessions/:id/join", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const result = await recordSessionJoin({
      institutionId: user.institutionId,
      classSessionId: z.string().uuid().parse(req.params.id),
      accountId: user.accountId,
      personId: user.personId,
      roles: user.roles,
      userAgent: String(req.header("user-agent") ?? ""),
    });
    res.json({
      ok: true,
      clientKind: result.clientKind,
      joinUrl: result.joinUrl,
      eventId: result.event.id,
    });
  } catch (err) {
    next(err);
  }
});

campusComplianceRouter.get(
  "/mobile-joins",
  requireAuth,
  requireRoles("admin", "registrar", "instructor"),
  async (req, res, next) => {
    try {
      const user = (req as AuthedRequest).user;
      const days = Number(req.query.days ?? 7);
      const institutionWide = user.roles.includes("admin") || user.roles.includes("registrar");
      res.json(
        await mobileJoinReport(
          user.institutionId,
          Number.isFinite(days) ? days : 7,
          institutionWide ? undefined : user.personId,
        ),
      );
    } catch (err) {
      next(err);
    }
  },
);

campusComplianceRouter.get("/pause-status", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const account = await prisma.account.findFirst({
      where: { id: user.accountId },
      select: { status: true },
    });
    const student = await prisma.student.findFirst({
      where: { id: await currentStudentId(user.institutionId, user.personId), institutionId: user.institutionId },
      select: { id: true },
    });
    const open = student
      ? await prisma.complianceCase.findMany({
          where: {
            institutionId: user.institutionId,
            subjectType: "student",
            subjectRef: student.id,
            status: "open",
            caseKind: POLICY.CASE_KINDS.STUDENT_MISS_PAUSE,
          },
        })
      : [];
    res.json({
      accountStatus: account?.status ?? "active",
      paused: account?.status === "paused",
      cases: open.map((c) => ({
        id: c.id,
        title: c.title,
        detail: c.detail,
        missCount: c.missCount,
      })),
      explainPath: POLICY.STUDENT_EXPLAIN_PATH,
    });
  } catch (err) {
    next(err);
  }
});
