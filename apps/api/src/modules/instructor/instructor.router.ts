import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRoles, type AuthedRequest } from "../../middleware/auth.js";
import {
  buildInstructorBootstrap,
  buildInstructorScreen,
  runInstructorAction,
} from "./instructor.service.js";
import { submissionsRouter } from "./submissions.router.js";

export const instructorRouter: Router = Router();

instructorRouter.use(requireAuth, requireRoles("instructor", "admin", "registrar"));
instructorRouter.use(submissionsRouter);

instructorRouter.get("/assigned-work", async (req, res, next) => {
  try {
    const { listAssignedWork } = await import("./assigned-work.service.js");
    res.json({ items: await listAssignedWork((req as AuthedRequest).user) });
  } catch (error) {
    next(error);
  }
});

instructorRouter.patch("/labs/:id/status", async (req, res, next) => {
  try {
    const body = z.object({ status: z.enum(["In Progress", "Completed", "Cancelled"]) }).parse(req.body);
    const { updateAssignedLabStatus } = await import("../labs/lab-flow.service.js");
    res.json(await updateAssignedLabStatus((req as unknown as AuthedRequest).user, z.string().uuid().parse(req.params.id), body.status));
  } catch (error) {
    next(error);
  }
});

instructorRouter.patch("/practicum/hours/:id", async (req, res, next) => {
  try {
    const body = z.object({ status: z.enum(["approved", "rejected"]) }).parse(req.body);
    const { reviewAssignedPracticumHours } = await import("./practicum.service.js");
    res.json(await reviewAssignedPracticumHours((req as unknown as AuthedRequest).user, z.string().uuid().parse(req.params.id), body.status));
  } catch (error) { next(error); }
});

instructorRouter.post("/practicum/evaluations/:id/submit", async (req, res, next) => {
  try {
    const body = z.object({ score: z.number().int().min(1).max(5), notes: z.string().trim().min(3).max(4000) }).parse(req.body);
    const { submitAssignedPracticumEvaluation } = await import("./practicum.service.js");
    res.json(await submitAssignedPracticumEvaluation((req as unknown as AuthedRequest).user, z.string().uuid().parse(req.params.id), body.score, body.notes));
  } catch (error) { next(error); }
});

const caseStatusBody = z.object({ status: z.enum(["open", "in_progress", "monitoring", "resolved", "closed"]) });
const appointmentStatusBody = z.object({ status: z.enum(["requested", "confirmed", "completed", "cancelled", "no_show"]) });
const crmLeadUpdateBody = z.object({
  stage: z.enum(["Contacted", "Qualified", "Applied", "Lost"]).optional(),
  nextFollowUp: z.string().date().nullable().optional(),
  notes: z.string().trim().max(5000).optional(),
}).refine((body) => Object.keys(body).length > 0, "At least one lead update is required");

instructorRouter.get("/crm/leads", async (req, res, next) => {
  try {
    const { listAssignedCrmLeads } = await import("./assigned-crm.service.js");
    res.json({ items: await listAssignedCrmLeads((req as AuthedRequest).user) });
  } catch (error) {
    next(error);
  }
});

instructorRouter.patch("/crm/leads/:id", async (req, res, next) => {
  try {
    const body = crmLeadUpdateBody.parse(req.body);
    const { updateAssignedCrmLead } = await import("./assigned-crm.service.js");
    res.json(await updateAssignedCrmLead((req as unknown as AuthedRequest).user, z.string().uuid().parse(req.params.id), body));
  } catch (error) {
    next(error);
  }
});

instructorRouter.get("/success/cases", async (req, res, next) => {
  try {
    const { listAssignedSuccessCases } = await import("../student-success/assigned-success.service.js");
    res.json({ items: await listAssignedSuccessCases((req as AuthedRequest).user) });
  } catch (error) {
    next(error);
  }
});

instructorRouter.patch("/success/cases/:id/status", async (req, res, next) => {
  try {
    const { status } = caseStatusBody.parse(req.body);
    const { updateAssignedCaseStatus } = await import("../student-success/assigned-success.service.js");
    res.json(await updateAssignedCaseStatus((req as unknown as AuthedRequest).user, z.string().uuid().parse(req.params.id), status));
  } catch (error) {
    next(error);
  }
});

instructorRouter.get("/success/appointments", async (req, res, next) => {
  try {
    const { listAssignedAppointments } = await import("../student-success/assigned-success.service.js");
    res.json({ items: await listAssignedAppointments((req as AuthedRequest).user) });
  } catch (error) {
    next(error);
  }
});

instructorRouter.patch("/success/appointments/:id/status", async (req, res, next) => {
  try {
    const { status } = appointmentStatusBody.parse(req.body);
    const { updateAssignedAppointmentStatus } = await import("../student-success/assigned-success.service.js");
    res.json(await updateAssignedAppointmentStatus((req as unknown as AuthedRequest).user, z.string().uuid().parse(req.params.id), status));
  } catch (error) {
    next(error);
  }
});

instructorRouter.post("/ai-draft", async (req, res, next) => {
  try {
    const { AiDraftRequest, generateAiDraft } = await import("./aiDraft.js");
    const body = AiDraftRequest.parse(req.body);
    res.json(await generateAiDraft((req as AuthedRequest).user, body));
  } catch (err) {
    next(err);
  }
});

const queryPath = (req: { query: Record<string, unknown> }) => (typeof req.query.path === "string" ? req.query.path : "");
const bodyPath = (req: { body?: unknown }) => {
  const path = (req.body as { path?: unknown } | undefined)?.path;
  return typeof path === "string" ? path : "";
};

instructorRouter.get("/ai-course", async (req, res, next) => {
  try {
    const { getAiCourse } = await import("./aiCourse.js");
    res.json(await getAiCourse((req as AuthedRequest).user, queryPath(req)));
  } catch (err) {
    next(err);
  }
});

instructorRouter.get("/ai-course/item", async (req, res, next) => {
  try {
    const { previewAiCourseItem } = await import("./aiCourse.js");
    res.json(await previewAiCourseItem((req as AuthedRequest).user, queryPath(req), String(req.query.key || "")));
  } catch (err) {
    next(err);
  }
});

instructorRouter.post("/ai-course/blueprint", async (req, res, next) => {
  try {
    const { startAiCourseBlueprint } = await import("./aiCourse.js");
    res.json(await startAiCourseBlueprint((req as AuthedRequest).user, bodyPath(req), req.body));
  } catch (err) {
    next(err);
  }
});

instructorRouter.put("/ai-course/blueprint", async (req, res, next) => {
  try {
    const { saveAiCourseBlueprint } = await import("./aiCourse.js");
    res.json(await saveAiCourseBlueprint((req as AuthedRequest).user, bodyPath(req), req.body));
  } catch (err) {
    next(err);
  }
});

instructorRouter.post("/ai-course/approve", async (req, res, next) => {
  try {
    const { approveAiCourseBlueprint } = await import("./aiCourse.js");
    res.json(await approveAiCourseBlueprint((req as AuthedRequest).user, bodyPath(req)));
  } catch (err) {
    next(err);
  }
});

instructorRouter.post("/ai-course/reopen", async (req, res, next) => {
  try {
    const { reopenAiCourseBlueprint } = await import("./aiCourse.js");
    res.json(await reopenAiCourseBlueprint((req as AuthedRequest).user, bodyPath(req)));
  } catch (err) {
    next(err);
  }
});

instructorRouter.post("/ai-course/run", async (req, res, next) => {
  try {
    const { resumeAiCourse } = await import("./aiCourse.js");
    res.json(await resumeAiCourse((req as AuthedRequest).user, bodyPath(req), { key: (req.body as { key?: unknown })?.key }));
  } catch (err) {
    next(err);
  }
});

instructorRouter.post("/ai-course/publish", async (req, res, next) => {
  try {
    const { publishAiCourse } = await import("./aiCourse.js");
    res.json(await publishAiCourse((req as AuthedRequest).user, bodyPath(req)));
  } catch (err) {
    next(err);
  }
});

instructorRouter.delete("/ai-course", async (req, res, next) => {
  try {
    const { discardAiCourse } = await import("./aiCourse.js");
    res.json(await discardAiCourse((req as AuthedRequest).user, queryPath(req)));
  } catch (err) {
    next(err);
  }
});

instructorRouter.get("/lms-quiz-results", async (req, res, next) => {
  try {
    const { aiQuizResults } = await import("./aiCourse.js");
    res.json(await aiQuizResults((req as AuthedRequest).user, queryPath(req), String(req.query.activityId || "")));
  } catch (err) {
    next(err);
  }
});

instructorRouter.get("/sis/bootstrap", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    res.json(await buildInstructorBootstrap(user));
  } catch (err) {
    next(err);
  }
});

instructorRouter.get("/sis/screen", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const pathRaw = String(req.query.path ?? "");
    if (!pathRaw.startsWith("/instructor")) {
      res.status(400).json({ error: { message: "path must start with /instructor" } });
      return;
    }
    // Merge top-level filter query params into path so directory filters always reach the builder.
    const qIndex = pathRaw.indexOf("?");
    const pathname = qIndex >= 0 ? pathRaw.slice(0, qIndex) : pathRaw;
    const embedded = new URLSearchParams(qIndex >= 0 ? pathRaw.slice(qIndex + 1) : "");
    const     filterKeys = [
      "status",
      "campus",
      "program",
      "pathway",
      "schedule",
      "programTerm",
      "admissionTerm",
      "nationality",
      "agent",
      "advisor",
      "startDate",
      "endDate",
      "letter",
      "q",
      "page",
      "perPage",
      "term",
      "course",
      "faculty",
      "mode",
      "sectionId",
      "type",
      "show",
    ];
    for (const key of filterKeys) {
      const v = req.query[key];
      if (v == null) continue;
      const raw = Array.isArray(v) ? v[0] : v;
      if (raw == null || String(raw).trim() === "") continue;
      embedded.set(key, String(raw));
    }
    const qs = embedded.toString();
    const path = qs ? `${pathname}?${qs}` : pathname;
    const studentId = req.query.studentId != null ? String(req.query.studentId) : null;
    res.json(await buildInstructorScreen(path, user, { studentId }));
  } catch (err) {
    next(err);
  }
});

instructorRouter.post("/sis/action", async (req, res, next) => {
  try {
    const body = z
      .object({
        path: z.string().min(1),
        action: z.string().min(1),
        rowKey: z.string().optional(),
      })
      .parse(req.body);
    const user = (req as AuthedRequest).user;
    if (!body.path.startsWith("/instructor")) {
      res.status(400).json({ error: { message: "path must start with /instructor" } });
      return;
    }
    res.json(await runInstructorAction(user, body));
  } catch (err) {
    next(err);
  }
});

instructorRouter.get("/tax-documents", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const { listInstructorTaxDocuments } = await import("./taxDocuments.js");
    res.json(await listInstructorTaxDocuments(user));
  } catch (err) {
    next(err);
  }
});

instructorRouter.get("/tax-documents/:id/pdf", async (req, res, next) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    const { getInstructorTaxPdf } = await import("./taxDocuments.js");
    const { sendPdf } = await import("../../lib/taxPdf.js");
    const { pdf, filename } = await getInstructorTaxPdf(user, z.string().uuid().parse(req.params.id));
    sendPdf(res, pdf, filename);
  } catch (err) {
    next(err);
  }
});
