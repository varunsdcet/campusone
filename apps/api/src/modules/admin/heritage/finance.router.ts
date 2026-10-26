import { Router, type NextFunction, type Request, type Response } from "express";
import type { AuthedRequest } from "../../../middleware/auth.js";
import { sendPdf } from "../../../lib/taxPdf.js";
import "./finance.config.js";
import {
  addFee,
  allocatePayment,
  applyPayment,
  createDisbursement,
  feeSectionOptions,
  generateReceipt,
  receiptInfo,
  receiptPdf,
  refundFee,
  refundPayment,
  removeDisbursement,
  removeFee,
  updateDisbursement,
  updateFee,
} from "./finance.ledger.js";
import {
  alertAction,
  allocateFunds,
  createAdjustment,
  createAward,
  createBonus,
  createFund,
  createPlan,
  deleteBonus,
  deleteFund,
  deletePlan,
  getStudentAgent,
  payCommission,
  recallCollection,
  removeFundAllocation,
  reviewAdjustment,
  sendToCollections,
  setStudentAgent,
  updateAward,
  updateFund,
  updatePlan,
} from "./finance.records.js";
import { addCreditNote, courseItems, courseOptions, createInvoice, deleteInvoice, generateDocument, getInvoice, invoicePdf, unpaidFees, updateInvoice } from "./finance.invoices.js";
import {
  financeMeta,
  listAdjustments,
  listAlerts,
  listAwards,
  listCommissions,
  listDisbursements,
  listFees,
  listFunds,
  listInvoices,
  listPlans,
  listTransactions,
  searchStudents,
  studentAudit,
  studentAwards,
  studentDisbursements,
  studentHeader,
  studentInvoices,
  studentOverview,
  studentPlans,
  studentTransactions,
} from "./finance.views.js";

export const financeRouter: Router = Router();

type User = AuthedRequest["user"];
type Body = Record<string, unknown>;
const user = (req: Request) => (req as unknown as AuthedRequest).user;
const body = (req: Request): Body => (req.body && typeof req.body === "object" && !Array.isArray(req.body) ? (req.body as Body) : {});
const p = (req: Request, k: string) => String(req.params[k] ?? "");

const handle =
  (fn: (u: User, req: Request) => Promise<unknown>, status = 200) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(status).json(await fn(user(req), req));
    } catch (err) {
      next(err);
    }
  };
const pdf =
  (fn: (u: User, req: Request) => Promise<{ pdf: Buffer; filename: string }>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const out = await fn(user(req), req);
      sendPdf(res, out.pdf, out.filename);
    } catch (err) {
      next(err);
    }
  };

const r = financeRouter;

r.get("/meta", handle((u) => financeMeta(u)));
r.get("/students", handle((u, req) => searchStudents(u, req.query)));
r.get("/courses", handle((u) => courseOptions(u)));

r.get("/transactions", handle((u, req) => listTransactions(u, req.query)));
r.get("/transactions/:id/receipt", handle((u, req) => receiptInfo(u, p(req, "id"))));
r.post("/transactions/:id/receipt", handle((u, req) => generateReceipt(u, p(req, "id"))));
r.get("/transactions/:id/receipt.pdf", pdf((u, req) => receiptPdf(u, p(req, "id"))));
r.post("/transactions/:id/refund", handle((u, req) => refundPayment(u, p(req, "id"), body(req))));
r.post("/transactions/:id/allocate", handle((u, req) => allocatePayment(u, p(req, "id"))));

r.get("/fees", handle((u, req) => listFees(u, req.query)));
r.patch("/fees/:id", handle((u, req) => updateFee(u, p(req, "id"), body(req))));
r.delete("/fees/:id", handle((u, req) => removeFee(u, p(req, "id"))));
r.post("/fees/:id/refund", handle((u, req) => refundFee(u, p(req, "id"), body(req))));

r.get("/invoices", handle((u, req) => listInvoices(u, req.query)));
r.post("/invoices", handle((u, req) => createInvoice(u, body(req)), 201));
r.get("/invoices/:id", handle((u, req) => getInvoice(u, p(req, "id"))));
r.get("/invoices/:id/pdf", pdf((u, req) => invoicePdf(u, p(req, "id"))));
r.patch("/invoices/:id", handle((u, req) => updateInvoice(u, p(req, "id"), body(req))));
r.post("/invoices/:id/credit-notes", handle((u, req) => addCreditNote(u, p(req, "id"), body(req)), 201));
r.delete("/invoices/:id", handle((u, req) => deleteInvoice(u, p(req, "id"))));

r.get("/disbursements", handle((u, req) => listDisbursements(u, req.query)));
r.patch("/disbursements/:id", handle((u, req) => updateDisbursement(u, p(req, "id"), body(req))));
r.delete("/disbursements/:id", handle((u, req) => removeDisbursement(u, p(req, "id"))));

r.get("/awards", handle((u, req) => listAwards(u, req.query)));
r.patch("/awards/:id", handle((u, req) => updateAward(u, p(req, "id"), body(req))));

r.get("/adjustments", handle((u, req) => listAdjustments(u, req.query)));
r.post("/adjustments", handle((u, req) => createAdjustment(u, body(req)), 201));
r.post("/adjustments/:id/review", handle((u, req) => reviewAdjustment(u, p(req, "id"), body(req))));

r.get("/commissions", handle((u, req) => listCommissions(u, req.query)));
r.post("/commissions/bonus", handle((u, req) => createBonus(u, body(req)), 201));
r.post("/commissions/pay", handle((u, req) => payCommission(u, body(req))));
r.delete("/commissions/bonus/:id", handle((u, req) => deleteBonus(u, p(req, "id"))));

r.get("/plans", handle((u, req) => listPlans(u, req.query)));
r.patch("/plans/:id", handle((u, req) => updatePlan(u, p(req, "id"), body(req))));
r.delete("/plans/:id", handle((u, req) => deletePlan(u, p(req, "id"))));
r.post("/collections/:id/recall", handle((u, req) => recallCollection(u, p(req, "id"))));

r.get("/funds", handle((u, req) => listFunds(u, req.query)));
r.post("/funds", handle((u, req) => createFund(u, body(req)), 201));
r.patch("/funds/:id", handle((u, req) => updateFund(u, p(req, "id"), body(req))));
r.delete("/funds/:id", handle((u, req) => deleteFund(u, p(req, "id"))));
r.post("/funds/:id/allocate", handle((u, req) => allocateFunds(u, p(req, "id"), body(req))));
r.delete("/funds/:id/allocations/:allocId", handle((u, req) => removeFundAllocation(u, p(req, "id"), p(req, "allocId"))));

r.get("/alerts", handle((u, req) => listAlerts(u, req.query)));
r.post("/alerts/:id/:action", handle((u, req) => alertAction(u, p(req, "id"), p(req, "action"))));

r.post("/documents", pdf((u, req) => generateDocument(u, body(req))));

r.get("/student/:sid", handle((u, req) => studentHeader(u, p(req, "sid"))));
r.get("/student/:sid/overview", handle((u, req) => studentOverview(u, p(req, "sid"), req.query)));
r.post("/student/:sid/fees", handle((u, req) => addFee(u, p(req, "sid"), body(req)), 201));
r.get("/student/:sid/fee-sections", handle((u, req) => feeSectionOptions(u, p(req, "sid"))));
r.post("/student/:sid/payments", handle((u, req) => applyPayment(u, p(req, "sid"), body(req)), 201));
r.get("/student/:sid/transactions", handle((u, req) => studentTransactions(u, p(req, "sid"), req.query)));
r.get("/student/:sid/invoices", handle((u, req) => studentInvoices(u, p(req, "sid"))));
r.get("/student/:sid/unpaid-fees", handle((u, req) => unpaidFees(u, p(req, "sid"), String(req.query.term ?? ""))));
r.post("/student/:sid/course-items", handle((u, req) => courseItems(u, p(req, "sid"), body(req))));
r.get("/student/:sid/disbursements", handle((u, req) => studentDisbursements(u, p(req, "sid"))));
r.post("/student/:sid/disbursements", handle((u, req) => createDisbursement(u, p(req, "sid"), body(req)), 201));
r.get("/student/:sid/awards", handle((u, req) => studentAwards(u, p(req, "sid"))));
r.post("/student/:sid/awards", handle((u, req) => createAward(u, p(req, "sid"), body(req)), 201));
r.get("/student/:sid/plans", handle((u, req) => studentPlans(u, p(req, "sid"), req.query)));
r.post("/student/:sid/plans", handle((u, req) => createPlan(u, p(req, "sid"), body(req)), 201));
r.post("/student/:sid/collections", handle((u, req) => sendToCollections(u, p(req, "sid"), body(req)), 201));
r.get("/student/:sid/audit", handle((u, req) => studentAudit(u, p(req, "sid"), req.query)));
r.get("/student/:sid/agent", handle((u, req) => getStudentAgent(u, p(req, "sid"))));
r.put("/student/:sid/agent", handle((u, req) => setStudentAgent(u, p(req, "sid"), body(req))));
