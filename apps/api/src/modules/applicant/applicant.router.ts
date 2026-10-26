import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { buildApplicantView, getApplicationForm, runApplicantAction, saveApplicationForm } from "./applicant.service.js";

export const applicantRouter: Router = Router();

applicantRouter.get("/application/form", requireAuth, async (req, res, next) => {
  try {
    res.json(await getApplicationForm((req as AuthedRequest).user));
  } catch (err) {
    next(err);
  }
});

applicantRouter.put("/application/form", requireAuth, async (req, res, next) => {
  try {
    res.json(await saveApplicationForm((req as AuthedRequest).user, req.body));
  } catch (err) {
    next(err);
  }
});

applicantRouter.get("/bootstrap", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const view = await buildApplicantView(user, "/applicant");
    res.json({ live: true, home: view });
  } catch (err) {
    next(err);
  }
});

applicantRouter.get("/view", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const path = String(req.query.path ?? "/applicant");
    const view = await buildApplicantView(user, path);
    res.json(view);
  } catch (err) {
    next(err);
  }
});

const ActionBody = z.object({
  action: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
  path: z.string().optional(),
});

applicantRouter.post("/action", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const body = ActionBody.parse(req.body);
    const result = await runApplicantAction(user, body.action, body.payload);
    const view = await buildApplicantView(user, body.path ?? "/applicant");
    res.json({ ...result, view });
  } catch (err) {
    next(err);
  }
});
