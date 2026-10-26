import { Router } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../../../middleware/auth.js";
import {
  contextOptions,
  createRecord,
  deleteRecord,
  exportCsv,
  getScreen,
  listAudit,
  refs,
  registryOverview,
  runAction,
  saveSingleton,
  updateRecord,
  verifyGate,
  type ScreenQuery,
} from "./service.js";
import { reportsRouter } from "./reports.router.js";
import { locationRouter } from "./location.router.js";
import { sysconfigRouter } from "./sysconfig.router.js";
import { financeRouter } from "./finance.router.js";
import { requestsRouter } from "./requests.router.js";
import { workshopsRouter } from "./workshops.router.js";
import { programsRouter } from "./programs.router.js";
import { dashboardRouter } from "./dashboard.router.js";
import { myCoursesRouter } from "./myCourses.router.js";
import { coursesRouter } from "./courses.router.js";
import { studentsRouter } from "./students.router.js";
import { opsRouter } from "./ops.router.js";
import { canView, effectiveAccess } from "../superAdmin.service.js";

export const heritageRouter: Router = Router();

heritageRouter.use("/dashboard", dashboardRouter);
heritageRouter.use("/reports", reportsRouter);
heritageRouter.use("/location", locationRouter);
heritageRouter.use("/sysconfig", sysconfigRouter);
heritageRouter.use("/financial", financeRouter);
heritageRouter.use("/requests", requestsRouter);
heritageRouter.use("/workshops", workshopsRouter);
heritageRouter.use("/my-courses", myCoursesRouter);
heritageRouter.use("/programs", programsRouter);
heritageRouter.use("/courses", coursesRouter);
heritageRouter.use("/students", studentsRouter);
heritageRouter.use("/ops", opsRouter);

const DataBody = z.object({ ctx: z.string().max(200).optional(), data: z.record(z.unknown()).default({}) });
const ActionBody = z.object({
  actionId: z.string().min(1).max(40),
  recordIds: z.array(z.string().max(200)).max(500).optional(),
  ctx: z.string().max(200).optional(),
  note: z.string().max(2000).optional(),
  status: z.string().max(80).optional(),
});

function screenQuery(q: Record<string, unknown>): ScreenQuery {
  const filters: Record<string, string> = {};
  for (const [k, v] of Object.entries(q)) if (k.startsWith("f.") && typeof v === "string") filters[k.slice(2)] = v;
  return {
    ctx: typeof q.ctx === "string" ? q.ctx : undefined,
    q: typeof q.q === "string" ? q.q : undefined,
    letter: typeof q.letter === "string" && /^[A-Za-z]$/.test(q.letter) ? q.letter : undefined,
    page: q.page ? Number(q.page) || 1 : 1,
    perPage: q.perPage ? Number(q.perPage) || 25 : 25,
    filters,
  };
}

const user = (req: unknown) => (req as AuthedRequest).user;

heritageRouter.get("/registry", (_req, res) => {
  res.json(registryOverview());
});

async function canSeeStudents(u: AuthedRequest["user"]) {
  const access = await effectiveAccess(u.institutionId, u.accountId);
  return canView(access.permissions.studentRecords);
}

heritageRouter.get("/refs", async (req, res, next) => {
  try {
    const [out, students] = await Promise.all([refs(user(req)), canSeeStudents(user(req))]);
    res.json(students ? out : { ...out, students: [] });
  } catch (err) {
    next(err);
  }
});

heritageRouter.get("/context-options", async (req, res, next) => {
  try {
    const type = String(req.query.type ?? "");
    if (type === "student" && !(await canSeeStudents(user(req)))) {
      res.json({ items: [] });
      return;
    }
    res.json({ items: await contextOptions(user(req), type, String(req.query.q ?? "")) });
  } catch (err) {
    next(err);
  }
});

heritageRouter.post("/verify-password", async (req, res, next) => {
  try {
    const body = z.object({ password: z.string().min(1).max(200) }).parse(req.body);
    res.json(await verifyGate(user(req), body.password));
  } catch (err) {
    next(err);
  }
});

heritageRouter.get("/screens/:id", async (req, res, next) => {
  try {
    res.json(await getScreen(user(req), req.params.id, screenQuery(req.query as Record<string, unknown>)));
  } catch (err) {
    next(err);
  }
});

heritageRouter.get("/screens/:id/export", async (req, res, next) => {
  try {
    const out = await exportCsv(user(req), req.params.id, screenQuery(req.query as Record<string, unknown>));
    res.json(out);
  } catch (err) {
    next(err);
  }
});

heritageRouter.get("/screens/:id/audit", async (req, res, next) => {
  try {
    res.json(
      await listAudit(user(req), req.params.id, {
        ctx: typeof req.query.ctx === "string" ? req.query.ctx : undefined,
        recordId: typeof req.query.recordId === "string" ? req.query.recordId : undefined,
      }),
    );
  } catch (err) {
    next(err);
  }
});

heritageRouter.post("/screens/:id/records", async (req, res, next) => {
  try {
    res.status(201).json(await createRecord(user(req), req.params.id, DataBody.parse(req.body)));
  } catch (err) {
    next(err);
  }
});

heritageRouter.put("/screens/:id/singleton", async (req, res, next) => {
  try {
    res.json(await saveSingleton(user(req), req.params.id, DataBody.parse(req.body)));
  } catch (err) {
    next(err);
  }
});

heritageRouter.patch("/screens/:id/records/:recordId", async (req, res, next) => {
  try {
    res.json(await updateRecord(user(req), req.params.id, decodeURIComponent(req.params.recordId), DataBody.parse(req.body)));
  } catch (err) {
    next(err);
  }
});

heritageRouter.delete("/screens/:id/records/:recordId", async (req, res, next) => {
  try {
    res.json(await deleteRecord(user(req), req.params.id, decodeURIComponent(req.params.recordId), typeof req.query.note === "string" ? req.query.note : undefined));
  } catch (err) {
    next(err);
  }
});

heritageRouter.post("/screens/:id/actions", async (req, res, next) => {
  try {
    res.json(await runAction(user(req), req.params.id, ActionBody.parse(req.body)));
  } catch (err) {
    next(err);
  }
});
