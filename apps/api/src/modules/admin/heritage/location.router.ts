import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../../../middleware/auth.js";
import {
  SETTINGS_TABS,
  campusDirectory,
  createEntity,
  deleteEntity,
  downloadFile,
  getBrandSettings,
  getEntity,
  listEntity,
  locationMeta,
  saveBrandSettings,
  updateEntity,
  uploadFile,
  type EntityKey,
  type SettingsTab,
} from "./location.js";

export const locationRouter: Router = Router();

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
const bad = (message: string) => Object.assign(new Error(message), { status: 400, code: "VALIDATION_ERROR" });

const SLUGS: Record<string, EntityKey> = {
  brands: "brands",
  "email-services": "emailServices",
  regions: "regions",
  provinces: "provinces",
  campuses: "campuses",
  classrooms: "classrooms",
  "classroom-types": "classroomTypes",
  ministries: "ministries",
  institutions: "institutions",
  agreements: "agreements",
  "bridge-programs": "bridgePrograms",
  "transfer-courses": "transferCourses",
};
const entityOf = (req: Request) => {
  const e = SLUGS[req.params.entity ?? ""];
  if (!e) throw Object.assign(new Error("Unknown Location Management list"), { status: 404, code: "NOT_FOUND" });
  return e;
};
const tabOf = (req: Request) => {
  const t = req.params.tab ?? "";
  if (!(t in SETTINGS_TABS)) throw bad("Unknown settings tab");
  return t as SettingsTab;
};
const Body = z.record(z.unknown());
const q = (v: unknown) => (typeof v === "string" ? v : undefined);

locationRouter.get("/meta", handle((req) => locationMeta(user(req))));
locationRouter.get("/campus-directory", handle((req) => campusDirectory(user(req), { brand: q(req.query.brand), region: q(req.query.region) })));

locationRouter.post(
  "/files",
  handle((req) => uploadFile(user(req), z.object({ name: z.string().max(200), mime: z.string().max(120), base64: z.string().max(12_000_000) }).parse(req.body)), 201),
);
locationRouter.get("/files/:id", handle((req) => downloadFile(user(req), req.params.id!)));

locationRouter.get("/brands/:id/settings/:tab", handle((req) => getBrandSettings(user(req), req.params.id!, tabOf(req))));
locationRouter.put("/brands/:id/settings/:tab", handle((req) => saveBrandSettings(user(req), req.params.id!, tabOf(req), Body.parse(req.body))));

locationRouter.get(
  "/:entity",
  handle((req) => listEntity(user(req), entityOf(req), { parentId: q(req.query.parentId), q: q(req.query.name) ?? q(req.query.q), page: Number(req.query.page) || 1, perPage: Number(req.query.perPage) || 0 })),
);
locationRouter.post("/:entity", handle((req) => createEntity(user(req), entityOf(req), Body.parse(req.body) as Record<string, unknown> & { parentId?: string }), 201));
locationRouter.get("/:entity/:id", handle((req) => getEntity(user(req), entityOf(req), req.params.id!)));
locationRouter.patch("/:entity/:id", handle((req) => updateEntity(user(req), entityOf(req), req.params.id!, Body.parse(req.body))));
locationRouter.delete("/:entity/:id", handle((req) => deleteEntity(user(req), entityOf(req), req.params.id!)));
