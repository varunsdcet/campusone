import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../../../middleware/auth.js";
import { actionOps, createOps, deleteOps, entityOf, entityRefs, getOps, listOps, moduleOf, opsDashboard, opsMeta, updateOps } from "./ops.js";

export const opsRouter: Router = Router();

const user = (req: unknown) => (req as AuthedRequest).user;
const handle =
  (fn: (req: Request) => unknown, status = 200) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(status).json(await fn(req));
    } catch (err) {
      next(err);
    }
  };
const Body = z.record(z.unknown());
const ent = (req: Request) => entityOf(req.params.entity ?? "");
const id = (req: Request) => req.params.id ?? "";

opsRouter.get("/meta", handle(() => opsMeta()));
opsRouter.get("/dash/:module", handle((req) => opsDashboard(user(req), moduleOf(req.params.module ?? ""))));
opsRouter.get("/e/:entity", handle((req) => listOps(user(req), ent(req), typeof req.query.q === "string" ? req.query.q.slice(0, 200) : "")));
opsRouter.get("/e/:entity/refs", handle((req) => entityRefs(user(req), ent(req))));
opsRouter.get("/e/:entity/:id", handle((req) => getOps(user(req), ent(req), id(req))));
opsRouter.post("/e/:entity", handle((req) => createOps(user(req), ent(req), Body.parse(req.body ?? {})), 201));
opsRouter.patch("/e/:entity/:id", handle((req) => updateOps(user(req), ent(req), id(req), Body.parse(req.body ?? {}))));
opsRouter.post("/e/:entity/:id/actions/:action", handle((req) => actionOps(user(req), ent(req), id(req), req.params.action ?? "")));
opsRouter.delete("/e/:entity/:id", handle((req) => deleteOps(user(req), ent(req), id(req))));
