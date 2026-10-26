import { randomUUID } from "node:crypto";
import { Router } from "express";
import {
  DegreeProgressResponse,
  WhatIfScenarioRequest,
  WhatIfScenarioResponse,
} from "@myheritage/contracts";
import { prisma } from "@myheritage/db";
import { writeAuditAndOutbox } from "@myheritage/events";
import { requireAuth, requireRoles, type AuthedRequest } from "../../middleware/auth.js";
import { computeDegreeProgress, impactIfDropCourse } from "./degree-progress.service.js";
import {
  ensureStudentProgramPlan,
  getCourseHistory,
  getProgramPlan,
  getTranscriptSummary,
} from "./program-plan.service.js";
import { ensureProgramVersion } from "./program-version.js";
import { currentStudentId } from "../me/studentAlignment.js";

export const academicRouter: Router = Router();

academicRouter.use(requireAuth, requireRoles("student"));

/** A program enrolment implies a program plan; a missing one is created when the student views it. */
async function hasProgramEnrolment(institutionId: string, studentId: string) {
  return (await prisma.heritageRecord.count({ where: { institutionId, screenId: "STU:ENROL", contextKey: studentId, deletedAt: null } })) > 0;
}

async function ownStudent(user: AuthedRequest["user"]) {
  const student = await prisma.student.findFirst({
    where: { id: await currentStudentId(user.institutionId, user.personId), institutionId: user.institutionId },
  });
  if (!student) {
    throw Object.assign(new Error("Student record not found"), { code: "NOT_FOUND", status: 404 });
  }
  return student;
}

academicRouter.get("/degree-progress", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const student = await ownStudent(user);
    const progress = await computeDegreeProgress({
      institutionId: user.institutionId,
      studentId: student.id,
    }).catch((error: unknown) => {
      if ((error as { code?: string })?.code === "NO_PROGRAM") {
        return { studentId: student.id, programAssigned: false as const, message: "No program assigned yet" };
      }
      throw error;
    });
    res.json(DegreeProgressResponse.parse(progress));
  } catch (error) {
    next(error);
  }
});

academicRouter.get("/program-plan", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const student = await ownStudent(user);
    let plan = await getProgramPlan(user.institutionId, student.id);
    if (!plan.planId && (await hasProgramEnrolment(user.institutionId, student.id))) {
      await ensureProgramVersion(user.institutionId, student.id);
      if (await ensureStudentProgramPlan(user.institutionId, student.id)) plan = await getProgramPlan(user.institutionId, student.id);
    }
    res.json(plan);
  } catch (error) {
    next(error);
  }
});

academicRouter.get("/course-history", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const student = await ownStudent(user);
    const history = await getCourseHistory(user.institutionId, student.id);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

academicRouter.get("/transcript-summary", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const student = await ownStudent(user);
    const summary = await getTranscriptSummary(user.institutionId, student.id);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

academicRouter.get("/transfer-credits", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const student = await ownStudent(user);
    const rows = await prisma.transferCredit.findMany({
      where: { institutionId: user.institutionId, studentId: student.id },
      include: { course: { select: { code: true, title: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      items: rows.map((row) => ({
        id: row.id,
        externalCode: row.externalCode,
        externalTitle: row.externalTitle,
        credits: row.credits,
        equivalentCourse: row.course ? { code: row.course.code, title: row.course.title } : null,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

academicRouter.post("/degree-scenarios", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const parsed = WhatIfScenarioRequest.safeParse(req.body);
    if (!parsed.success) {
      throw Object.assign(new Error("Invalid what-if scenario"), {
        code: "VALIDATION_ERROR",
        status: 400,
        issues: parsed.error.issues,
      });
    }
    const student = await ownStudent(user);
    const baseline = await computeDegreeProgress({
      institutionId: user.institutionId,
      studentId: student.id,
    });
    const projected = await computeDegreeProgress({
      institutionId: user.institutionId,
      studentId: student.id,
      dropCourseCodes: parsed.data.dropCourseCodes,
      failCourseCodes: parsed.data.failCourseCodes,
      addCourseCodes: parsed.data.addCourseCodes,
    });

    const impactSummary: string[] = [];
    for (const code of parsed.data.dropCourseCodes) {
      const impact = await impactIfDropCourse({
        institutionId: user.institutionId,
        studentId: student.id,
        courseCode: code,
      });
      impactSummary.push(...impact.impactSummary);
    }
    if (!impactSummary.length) {
      impactSummary.push(
        `Projected completion ${baseline.projectedCompletionTerm ?? "unknown"} → ${projected.projectedCompletionTerm ?? "unknown"}.`,
        `Remaining credits ${baseline.remainingCredits} → ${projected.remainingCredits}.`,
      );
    }

    const label =
      parsed.data.label ||
      (parsed.data.dropCourseCodes[0]
        ? `Drop ${parsed.data.dropCourseCodes.join(", ")}`
        : "What-if academic plan");

    let scenarioId: string | null = null;
    if (parsed.data.save) {
      scenarioId = randomUUID();
      await prisma.$transaction(async (tx) => {
        await tx.degreePlanScenario.create({
          data: {
            id: scenarioId!,
            institutionId: user.institutionId,
            studentId: student.id,
            label,
            assumptionsJson: JSON.stringify(parsed.data),
            resultJson: JSON.stringify(projected),
            status: "draft",
          },
        });
        await writeAuditAndOutbox(tx, {
          institutionId: user.institutionId,
          actorId: user.accountId,
          eventName: "DegreePlanScenario.created",
          purpose: "what_if_plan_draft",
          before: null,
          after: { scenarioId, label },
          source: "academic.degree-scenarios",
          correlationId: (req as AuthedRequest).correlationId,
          outboxPayload: { scenarioId, studentId: student.id },
        });
      });
    }

    res.json(
      WhatIfScenarioResponse.parse({
        scenarioId,
        label,
        baseline,
        projected,
        impactSummary,
        claims: projected.claims,
      }),
    );
  } catch (error) {
    next(error);
  }
});

academicRouter.get("/advising/appointments", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const student = await ownStudent(user);
    const { listAdvisorAppointments } = await import("../ai/domain-actions.service.js");
    res.json({ items: await listAdvisorAppointments({ institutionId: user.institutionId, studentId: student.id }) });
  } catch (error) {
    next(error);
  }
});

academicRouter.get("/success/cases", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const student = await ownStudent(user);
    const { listStudentSuccessCases } = await import("../student-success/assigned-success.service.js");
    res.json({ items: await listStudentSuccessCases(user, student.id) });
  } catch (error) {
    next(error);
  }
});

academicRouter.post("/advising/appointments", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const student = await ownStudent(user);
    const { AdvisingAppointmentRequest } = await import("@myheritage/contracts");
    const parsed = AdvisingAppointmentRequest.safeParse(req.body);
    if (!parsed.success) {
      throw Object.assign(new Error("Invalid advising appointment"), {
        code: "VALIDATION_ERROR",
        status: 400,
        issues: parsed.error.issues,
      });
    }
    const { createAdvisorAppointment } = await import("../ai/domain-actions.service.js");
    const created = await createAdvisorAppointment({
      institutionId: user.institutionId,
      studentId: student.id,
      topic: parsed.data.topic,
      startsAt: parsed.data.startsAt,
      notes: parsed.data.notes,
      actorAccountId: user.accountId,
      correlationId: (req as AuthedRequest).correlationId,
    });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});
