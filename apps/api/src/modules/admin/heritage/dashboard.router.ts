import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../../../middleware/auth.js";
import { BlockBody, SettingsBody, createBlock, deleteBlock, manageDashboard, reorderBlocks, saveSettings, updateBlock, viewDashboard } from "./dashboard.js";

export const dashboardRouter: Router = Router();

const user = (req: unknown) => (req as AuthedRequest).user;
const handle =
  (fn: (req: Request) => Promise<unknown>, status = 200) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(status).json(await fn(req));
    } catch (err) {
      next(err);
    }
  };

dashboardRouter.get("/", handle((req) => viewDashboard(user(req))));
dashboardRouter.get("/manage", handle((req) => manageDashboard(user(req))));
dashboardRouter.put("/settings", handle((req) => saveSettings(user(req), SettingsBody.parse(req.body))));
dashboardRouter.post("/blocks", handle((req) => createBlock(user(req), BlockBody.parse(req.body)), 201));
dashboardRouter.put("/blocks/order", handle((req) => reorderBlocks(user(req), z.object({ ids: z.array(z.string().max(200)).max(500) }).parse(req.body).ids)));
dashboardRouter.patch("/blocks/:id", handle((req) => updateBlock(user(req), req.params.id!, BlockBody.parse(req.body))));
dashboardRouter.delete("/blocks/:id", handle((req) => deleteBlock(user(req), req.params.id!)));
