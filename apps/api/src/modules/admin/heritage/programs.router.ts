import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../../../middleware/auth.js";
import {
  ENTITIES,
  addElectives,
  addPathwayCourses,
  addSessions,
  auditRecords,
  auditRestore,
  auditReview,
  bulkUpdate,
  confirmSchedule,
  copyPathway,
  copySchedule,
  createEntity,
  deleteEntity,
  directory,
  getEntity,
  listEntity,
  listSchedules,
  pathwayOutline,
  programAudit,
  programMeta,
  reorderEntity,
  saveCourseSchedule,
  scheduleCourses,
  scheduleDetail,
  updateEntity,
  type EntityKey,
} from "./programs.js";

export const programsRouter: Router = Router();

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
const entityOf = (req: Request) => {
  const e = req.params.entity ?? "";
  if (!Object.hasOwn(ENTITIES, e)) throw Object.assign(new Error("Unknown Program Management list"), { status: 404, code: "NOT_FOUND" });
  return e as EntityKey;
};
const Body = z.record(z.unknown());
const Ids = z.array(z.string().max(80)).max(500);
const q = (v: unknown) => (typeof v === "string" ? v : undefined);
const id = (req: Request, key = "id") => req.params[key] ?? "";

programsRouter.get("/meta", handle((req) => programMeta(user(req))));
programsRouter.get("/directory", handle((req) => directory(user(req))));

programsRouter.get("/programs/:id/audit", handle((req) => programAudit(user(req), id(req))));
programsRouter.get("/programs/:id/audit/records", handle((req) => auditRecords(user(req), id(req))));
programsRouter.get("/programs/:id/audit/:entryId", handle((req) => auditReview(user(req), id(req), id(req, "entryId"))));
programsRouter.post("/programs/:id/audit/:entryId/restore", handle((req) => auditRestore(user(req), id(req), id(req, "entryId"))));

programsRouter.get("/pathways/:id/outline", handle((req) => pathwayOutline(user(req), id(req))));
programsRouter.post(
  "/pathways/:id/courses",
  handle((req) =>
    addPathwayCourses(
      user(req),
      id(req),
      z.object({ courseIds: Ids, group: z.object({ mode: z.enum(["none", "existing", "new"]), tier: z.string().max(80).optional(), name: z.string().max(200).optional() }).optional() }).parse(req.body),
    ),
  ),
);
programsRouter.post("/pathways/:id/copy", handle((req) => copyPathway(user(req), id(req), Body.parse(req.body)), 201));
programsRouter.post("/pathways/:id/electives", handle((req) => addElectives(user(req), id(req), z.object({ group: z.string().max(80).optional(), courseIds: Ids }).parse(req.body))));
programsRouter.put("/course-schedules/:courseId", handle((req) => saveCourseSchedule(user(req), id(req, "courseId"), Body.parse(req.body))));

programsRouter.get("/schedules", handle((req) => listSchedules(user(req), { program: q(req.query.program) })));
programsRouter.get("/schedules/:id", handle((req) => scheduleDetail(user(req), id(req))));
programsRouter.get("/schedules/:id/courses", handle((req) => scheduleCourses(user(req), id(req))));
programsRouter.post("/schedules/:id/confirm", handle((req) => confirmSchedule(user(req), id(req))));
programsRouter.post("/schedules/:id/copy", handle((req) => copySchedule(user(req), id(req), Body.parse(req.body)), 201));
programsRouter.post("/schedules/:id/sessions", handle((req) => addSessions(user(req), id(req), Body.parse(req.body)), 201));
programsRouter.post(
  "/schedules/:id/bulk",
  handle((req) => bulkUpdate(user(req), id(req), z.object({ category: z.string().max(80), sessionIds: Ids, values: Body }).parse(req.body))),
);

programsRouter.get("/e/:entity", handle((req) => listEntity(user(req), entityOf(req), { parentId: q(req.query.parentId), q: q(req.query.q) })));
programsRouter.post("/e/:entity", handle((req) => createEntity(user(req), entityOf(req), Body.parse(req.body) as Record<string, unknown> & { parentId?: string }), 201));
programsRouter.put("/e/:entity/order", handle((req) => reorderEntity(user(req), entityOf(req), z.object({ ids: Ids }).parse(req.body).ids)));
programsRouter.get("/e/:entity/:id", handle((req) => getEntity(user(req), entityOf(req), id(req))));
programsRouter.patch("/e/:entity/:id", handle((req) => updateEntity(user(req), entityOf(req), id(req), Body.parse(req.body))));
programsRouter.delete("/e/:entity/:id", handle((req) => deleteEntity(user(req), entityOf(req), id(req))));
