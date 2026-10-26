import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../../../middleware/auth.js";
import {
  ENTITIES,
  SETTINGS,
  accessLogs,
  copyTemplate,
  createEntity,
  deleteEntity,
  downloadFile,
  getEntity,
  getSettings,
  listEntity,
  reorderEntity,
  restoreTemplate,
  saveSettings,
  settingsHistory,
  sysMeta,
  templateHistory,
  templateVersion,
  updateEntity,
  uploadFile,
  type EntityKey,
  type SettingsKey,
} from "./sysconfig.js";

export const sysconfigRouter: Router = Router();

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
const notFound = (message: string) => Object.assign(new Error(message), { status: 404, code: "NOT_FOUND" });
const entityOf = (req: Request) => {
  const e = req.params.entity ?? "";
  if (!Object.hasOwn(ENTITIES, e)) throw notFound("Unknown System Configuration list");
  return e as EntityKey;
};
const settingsOf = (req: Request) => {
  const k = req.params.key ?? "";
  if (!Object.hasOwn(SETTINGS, k)) throw notFound("Unknown settings page");
  return k as SettingsKey;
};
const Body = z.record(z.unknown());
const q = (v: unknown) => (typeof v === "string" ? v : undefined);

sysconfigRouter.get("/meta", handle((req) => sysMeta(user(req))));

sysconfigRouter.post(
  "/files",
  handle((req) => uploadFile(user(req), z.object({ name: z.string().max(200), mime: z.string().max(120), base64: z.string().max(12_000_000) }).parse(req.body)), 201),
);
sysconfigRouter.get("/files/:id", handle((req) => downloadFile(user(req), req.params.id!)));

sysconfigRouter.get("/settings/:key", handle((req) => getSettings(user(req), settingsOf(req))));
sysconfigRouter.put("/settings/:key", handle((req) => saveSettings(user(req), settingsOf(req), Body.parse(req.body))));
sysconfigRouter.get("/settings/:key/history", handle((req) => settingsHistory(user(req), settingsOf(req))));

sysconfigRouter.get("/access-logs", handle((req) => accessLogs(user(req), { from: q(req.query.from), to: q(req.query.to), campus: q(req.query.campus), user: q(req.query.user), outcome: q(req.query.outcome) })));

sysconfigRouter.get("/document-templates/:id/history", handle((req) => templateHistory(user(req), req.params.id!)));
sysconfigRouter.get("/document-templates/:id/history/:versionId", handle((req) => templateVersion(user(req), req.params.id!, req.params.versionId!)));
sysconfigRouter.post("/document-templates/:id/restore/:versionId", handle((req) => restoreTemplate(user(req), req.params.id!, req.params.versionId!)));
sysconfigRouter.post("/document-templates/:id/copy", handle((req) => copyTemplate(user(req), req.params.id!), 201));

sysconfigRouter.get("/e/:entity", handle((req) => listEntity(user(req), entityOf(req), { parentId: q(req.query.parentId), q: q(req.query.q) })));
sysconfigRouter.post("/e/:entity", handle((req) => createEntity(user(req), entityOf(req), Body.parse(req.body) as Record<string, unknown> & { parentId?: string }), 201));
sysconfigRouter.put("/e/:entity/order", handle((req) => reorderEntity(user(req), entityOf(req), z.object({ ids: z.array(z.string()).max(1000) }).parse(req.body).ids)));
sysconfigRouter.get("/e/:entity/:id", handle((req) => getEntity(user(req), entityOf(req), req.params.id!)));
sysconfigRouter.patch("/e/:entity/:id", handle((req) => updateEntity(user(req), entityOf(req), req.params.id!, Body.parse(req.body))));
sysconfigRouter.delete("/e/:entity/:id", handle((req) => deleteEntity(user(req), entityOf(req), req.params.id!)));
