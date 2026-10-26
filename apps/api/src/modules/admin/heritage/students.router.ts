import { Router, type NextFunction, type Request, type Response } from "express";
import type { AuthedRequest } from "../../../middleware/auth.js";
import { addFee, applyPayment, createDisbursement, removeDisbursement, removeFee, updateDisbursement, updateFee } from "./finance.ledger.js";
import {
  addFlag,
  archiveStudentProfile,
  attendance,
  auditTrail,
  changeStatus,
  counts,
  createStudent,
  deleteFlag,
  deleteFlagGlobal,
  directory,
  dismissFlag,
  downloadStudentFile,
  header,
  listFlags,
  newProgramProfile,
  overview,
  setRateCategory,
  studentsMeta,
  updateFlag,
  uploadStudentFile,
} from "./students.js";
import {
  addCase,
  addCorrespondence,
  addRequirement,
  assessmentOptions,
  deleteCorrespondence,
  deleteRequirement,
  getCorrespondence,
  generateStudentDocument,
  listActions,
  listCases,
  listCorrespondence,
  listRequirements,
  requirementDetail,
  reviewRequirement,
  sendNotification,
  updateCorrespondence,
  updateRequirement,
  uploadRequirement,
} from "./students.comms.js";
import { addTest, enrolProgram, finalMarks, listTests, programPlan, transcriptPdf } from "./students.plan.js";
import { graduateStudent } from "../../academic/graduation.service.js";
import {
  academicAlerts,
  resolveAcademicAlert,
  approveGradeSubmission,
  badgeQueue,
  bulkLog,
  decideBadge,
  declineGradeSubmission,
  gradeSubmission,
  gradeSubmissions,
  leaveOfAbsence,
  pendingEntryMarks,
  studentAssessments,
  studentFlags,
  studentRequirements,
  transcriptChanges,
  decideTranscriptChange,
  withdrawRequests,
} from "./students.queues.js";
import {
  addAward,
  assertEntryOf,
  awards,
  createInvoice,
  createPlan,
  deletePlan,
  disbursements,
  financeAudit,
  financeOverview,
  financeTransactions,
  getAgent,
  invoices,
  issueRefund,
  paymentPlans,
  receipt,
  regenerateReceipt,
  setAgent,
  taxDocuments,
  updateAward,
  updatePlan,
} from "./students.finance.js";
import { assertStudentCampusAccess } from "./students.core.js";

export const studentsRouter: Router = Router();

studentsRouter.param("id", async (req, _res, next, id) => {
  try {
    await assertStudentCampusAccess((req as unknown as AuthedRequest).user, String(id));
    next();
  } catch (error) {
    next(error);
  }
});

const user = (req: Request) => (req as unknown as AuthedRequest).user;
type Q = Record<string, unknown>;
const handle =
  (fn: (req: Request) => Promise<unknown>, status = 200) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(status).json(await fn(req));
    } catch (err) {
      next(err);
    }
  };
const pdf = (fn: (req: Request) => Promise<{ pdf: Buffer; filename: string }>) =>
  handle(async (req) => {
    const out = await fn(req);
    return { filename: out.filename, mime: "application/pdf", base64: out.pdf.toString("base64") };
  });
const p = (req: Request, k: string) => String(req.params[k] ?? "");
const body = (req: Request) => (req.body ?? {}) as Q;
const query = (req: Request) => req.query as Q;
const owned = (req: Request) => assertEntryOf(user(req), p(req, "id"), p(req, "entryId"));

/* Directory, create, meta, counts */
studentsRouter.get("/meta", handle((req) => studentsMeta(user(req))));
studentsRouter.get("/counts", handle((req) => counts(user(req))));
studentsRouter.get("/directory", handle((req) => directory(user(req), query(req))));
studentsRouter.post("/", handle((req) => createStudent(user(req), body(req)), 201));

/* Global queues */
studentsRouter.get("/queues/alerts", handle((req) => academicAlerts(user(req), query(req))));
studentsRouter.post("/queues/alerts/:alertId/resolve", handle((req) => resolveAcademicAlert(user(req), p(req, "alertId"))));
studentsRouter.get("/queues/flags", handle((req) => studentFlags(user(req), query(req))));
studentsRouter.post("/queues/flags/:flagId/dismiss", handle((req) => dismissFlag(user(req), p(req, "flagId"))));
studentsRouter.delete("/queues/flags/:flagId", handle((req) => deleteFlagGlobal(user(req), p(req, "flagId"))));
studentsRouter.get("/queues/assessments", handle((req) => studentAssessments(user(req), query(req))));
studentsRouter.get("/queues/requirements", handle((req) => studentRequirements(user(req), query(req))));
studentsRouter.get("/queues/leave", handle((req) => leaveOfAbsence(user(req), query(req))));
studentsRouter.get("/queues/withdraw", handle((req) => withdrawRequests(user(req), query(req))));
studentsRouter.get("/queues/grades", handle((req) => gradeSubmissions(user(req), query(req))));
studentsRouter.get("/queues/grades/:approvalId", handle((req) => gradeSubmission(user(req), p(req, "approvalId"))));
studentsRouter.post("/queues/grades/:approvalId/approve", handle((req) => approveGradeSubmission(user(req), p(req, "approvalId"), body(req))));
studentsRouter.post("/queues/grades/:approvalId/decline", handle((req) => declineGradeSubmission(user(req), p(req, "approvalId"))));
studentsRouter.get("/queues/transcript-changes", handle((req) => transcriptChanges(user(req))));
studentsRouter.post("/queues/transcript-changes/:changeId/decide", handle((req) => decideTranscriptChange(user(req), p(req, "changeId"), body(req))));
studentsRouter.get("/queues/entry-marks", handle((req) => pendingEntryMarks(user(req))));
studentsRouter.get("/queues/badges", handle((req) => badgeQueue(user(req), query(req))));
studentsRouter.post("/queues/badges/:badgeId/decide", handle((req) => decideBadge(user(req), p(req, "badgeId"), body(req))));
studentsRouter.get("/queues/bulk-log", handle((req) => bulkLog(user(req))));

/* Profile: Status & Profile */
studentsRouter.get("/:id/header", handle((req) => header(user(req), p(req, "id"))));
studentsRouter.get("/:id/overview", handle((req) => overview(user(req), p(req, "id"))));
studentsRouter.post("/:id/files", handle((req) => uploadStudentFile(user(req), p(req, "id"), body(req)), 201));
studentsRouter.get("/:id/files/:fileId", handle((req) => downloadStudentFile(user(req), p(req, "id"), p(req, "fileId"))));
studentsRouter.post("/:id/status", handle((req) => changeStatus(user(req), p(req, "id"), body(req))));
studentsRouter.post("/:id/graduation", handle((req) => graduateStudent(user(req), p(req, "id"))));
studentsRouter.put("/:id/rate-category", handle((req) => setRateCategory(user(req), p(req, "id"), body(req))));
studentsRouter.post("/:id/program-profile", handle((req) => newProgramProfile(user(req), p(req, "id"), body(req)), 201));
studentsRouter.get("/:id/flags", handle((req) => listFlags(user(req), p(req, "id"), query(req))));
studentsRouter.post("/:id/flags", handle((req) => addFlag(user(req), p(req, "id"), body(req)), 201));
studentsRouter.put("/:id/flags/:flagId", handle((req) => updateFlag(user(req), p(req, "id"), p(req, "flagId"), body(req))));
studentsRouter.delete("/:id/flags/:flagId", handle((req) => deleteFlag(user(req), p(req, "id"), p(req, "flagId"))));
studentsRouter.get("/:id/attendance", handle((req) => attendance(user(req), p(req, "id"), query(req))));
studentsRouter.get("/:id/audit", handle((req) => auditTrail(user(req), p(req, "id"), query(req))));

/* Profile: Communication & Workflows */
studentsRouter.get("/:id/correspondence", handle((req) => listCorrespondence(user(req), p(req, "id"), query(req))));
studentsRouter.post("/:id/correspondence", handle((req) => addCorrespondence(user(req), p(req, "id"), body(req)), 201));
studentsRouter.get("/:id/correspondence/:corrId", handle((req) => getCorrespondence(user(req), p(req, "id"), p(req, "corrId"))));
studentsRouter.put("/:id/correspondence/:corrId", handle((req) => updateCorrespondence(user(req), p(req, "id"), p(req, "corrId"), body(req))));
studentsRouter.delete("/:id/correspondence/:corrId", handle((req) => deleteCorrespondence(user(req), p(req, "id"), p(req, "corrId"))));
studentsRouter.post("/:id/notifications", handle((req) => sendNotification(user(req), p(req, "id"), body(req))));
studentsRouter.post("/:id/documents/generate", pdf((req) => generateStudentDocument(user(req), p(req, "id"), body(req))));
studentsRouter.get("/:id/actions", handle((req) => listActions(user(req), p(req, "id"), query(req))));
studentsRouter.get("/:id/assessments", handle((req) => listCases(user(req), p(req, "id"), query(req))));
studentsRouter.get("/:id/assessments/available", handle((req) => assessmentOptions(user(req), p(req, "id"))));
studentsRouter.post("/:id/assessments", handle((req) => addCase(user(req), p(req, "id"), body(req)), 201));
studentsRouter.get("/:id/requirements", handle((req) => listRequirements(user(req), p(req, "id"), query(req))));
studentsRouter.post("/:id/requirements", handle((req) => addRequirement(user(req), p(req, "id"), body(req)), 201));
studentsRouter.get("/:id/requirements/:reqId", handle((req) => requirementDetail(user(req), p(req, "id"), p(req, "reqId"))));
studentsRouter.put("/:id/requirements/:reqId", handle((req) => updateRequirement(user(req), p(req, "id"), p(req, "reqId"), body(req))));
studentsRouter.delete("/:id/requirements/:reqId", handle((req) => deleteRequirement(user(req), p(req, "id"), p(req, "reqId"))));
studentsRouter.post("/:id/requirements/:reqId/upload", handle((req) => uploadRequirement(user(req), p(req, "id"), p(req, "reqId"), body(req))));
studentsRouter.post("/:id/requirements/:reqId/review", handle((req) => reviewRequirement(user(req), p(req, "id"), p(req, "reqId"), body(req))));

/* Profile: Program Plan + Grades & Transcript */
studentsRouter.get("/:id/plan", handle((req) => programPlan(user(req), p(req, "id"))));
studentsRouter.post("/:id/plan/enrol", handle((req) => enrolProgram(user(req), p(req, "id"), body(req)), 201));
studentsRouter.get("/:id/tests", handle((req) => listTests(user(req), p(req, "id"))));
studentsRouter.post("/:id/tests", handle((req) => addTest(user(req), p(req, "id"), body(req)), 201));
studentsRouter.get("/:id/final-marks", handle((req) => finalMarks(user(req), p(req, "id"), query(req))));
studentsRouter.post("/:id/transcript", pdf((req) => transcriptPdf(user(req), p(req, "id"), body(req))));

/* Profile: Finance */
studentsRouter.get("/:id/finance/overview", handle((req) => financeOverview(user(req), p(req, "id"), query(req))));
studentsRouter.post("/:id/finance/fees", handle((req) => addFee(user(req), p(req, "id"), body(req)), 201));
studentsRouter.put("/:id/finance/fees/:entryId", handle(async (req) => (await owned(req), updateFee(user(req), p(req, "entryId"), body(req)))));
studentsRouter.delete("/:id/finance/fees/:entryId", handle(async (req) => (await owned(req), removeFee(user(req), p(req, "entryId")))));
studentsRouter.post("/:id/finance/payments", handle((req) => applyPayment(user(req), p(req, "id"), body(req)), 201));
studentsRouter.get("/:id/finance/agent", handle((req) => getAgent(user(req), p(req, "id"))));
studentsRouter.put("/:id/finance/agent", handle((req) => setAgent(user(req), p(req, "id"), body(req))));
studentsRouter.get("/:id/finance/transactions", handle((req) => financeTransactions(user(req), p(req, "id"), query(req))));
studentsRouter.post("/:id/finance/refunds", handle((req) => issueRefund(user(req), p(req, "id"), body(req))));
studentsRouter.get("/:id/finance/receipts/:entryId", pdf((req) => receipt(user(req), p(req, "id"), p(req, "entryId"))));
studentsRouter.post("/:id/finance/receipts/:entryId", handle((req) => regenerateReceipt(user(req), p(req, "id"), p(req, "entryId"))));
studentsRouter.get("/:id/finance/invoices", handle((req) => invoices(user(req), p(req, "id"))));
studentsRouter.post("/:id/finance/invoices", handle((req) => createInvoice(user(req), p(req, "id"), body(req)), 201));
studentsRouter.get("/:id/finance/disbursements", handle((req) => disbursements(user(req), p(req, "id"))));
studentsRouter.post("/:id/finance/disbursements", handle((req) => createDisbursement(user(req), p(req, "id"), body(req)), 201));
studentsRouter.put("/:id/finance/disbursements/:entryId", handle(async (req) => (await owned(req), updateDisbursement(user(req), p(req, "entryId"), body(req)))));
studentsRouter.delete("/:id/finance/disbursements/:entryId", handle(async (req) => (await owned(req), removeDisbursement(user(req), p(req, "entryId")))));
studentsRouter.get("/:id/finance/awards", handle((req) => awards(user(req), p(req, "id"))));
studentsRouter.post("/:id/finance/awards", handle((req) => addAward(user(req), p(req, "id"), body(req)), 201));
studentsRouter.put("/:id/finance/awards/:awardId", handle((req) => updateAward(user(req), p(req, "id"), p(req, "awardId"), body(req))));
studentsRouter.get("/:id/finance/plans", handle((req) => paymentPlans(user(req), p(req, "id"), query(req))));
studentsRouter.post("/:id/finance/plans", handle((req) => createPlan(user(req), p(req, "id"), body(req)), 201));
studentsRouter.put("/:id/finance/plans/:planId", handle((req) => updatePlan(user(req), p(req, "id"), p(req, "planId"), body(req))));
studentsRouter.delete("/:id/finance/plans/:planId", handle((req) => deletePlan(user(req), p(req, "id"), p(req, "planId"))));
studentsRouter.get("/:id/finance/tax", handle((req) => taxDocuments(user(req), p(req, "id"))));
studentsRouter.get("/:id/finance/audit", handle((req) => financeAudit(user(req), p(req, "id"), query(req))));

/* Keep the generic profile archival route last so it cannot shadow nested resources. */
studentsRouter.delete("/:id", handle((req) => archiveStudentProfile(user(req), p(req, "id"))));
