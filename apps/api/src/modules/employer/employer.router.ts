import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { buildEmployerView, runEmployerAction } from "./employer.service.js";

export const employerRouter: Router = Router();

employerRouter.get("/bootstrap", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const view = await buildEmployerView(user, "/employer");
    res.json({ live: true, home: view });
  } catch (err) {
    next(err);
  }
});

employerRouter.get("/view", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const path = String(req.query.path ?? "/employer");
    const view = await buildEmployerView(user, path);
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

employerRouter.post("/action", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const body = ActionBody.parse(req.body);
    const result = await runEmployerAction(user, body.action, body.payload);
    const view = await buildEmployerView(user, body.path ?? "/employer");
    res.json({ ...result, view });
  } catch (err) {
    next(err);
  }
});
