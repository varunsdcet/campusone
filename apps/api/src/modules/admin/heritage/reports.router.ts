import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../../../middleware/auth.js";
import {
  catalog,
  createCategory,
  createTemplate,
  deleteCategory,
  deleteRun,
  deleteSchedule,
  deleteTemplate,
  exportRun,
  getCategory,
  getRun,
  getSchedule,
  getTemplate,
  listRuns,
  listSchedules,
  reportMeta,
  reportOptions,
  runScheduleNow,
  runTemplate,
  updateCategory,
  updateSchedule,
  updateTemplate,
  type Template,
} from "./reports.js";

export const reportsRouter: Router = Router();

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

const CategoryBody = z.object({ name: z.string().trim().min(1, "Category Name is required").max(120) });
const Conditions = z.record(z.string().max(200)).default({});
const TemplateBody = z
  .object({
    name: z.string().max(200),
    description: z.string().max(2000),
    categoryId: z.string().max(80),
    active: z.enum(["Yes", "No"]),
    separateWorkbooksBy: z.string().max(40),
    availableTo: z.string().max(40),
    language: z.string().max(40),
    reportGroup: z.string().max(60),
    exportType: z.string().max(20),
    source: z.string().max(40),
    conditionsTitle: z.string().max(120),
    filters: z.array(z.string().max(40)).max(20),
    showTotalsDefault: z.enum(["Yes", "No"]),
    columns: z.array(z.string().max(60)).max(60),
    graph: z.object({ type: z.string().max(20), groupBy: z.string().max(60).default(""), measure: z.string().max(60).default("") }),
  })
  .partial();
const ScheduleBody = z.object({
  enabled: z.boolean().default(false),
  frequency: z.string().max(20).optional(),
  weekday: z.coerce.number().int().min(0).max(6).optional(),
  monthDay: z.coerce.number().int().min(1).max(28).optional(),
  time: z.string().max(5).optional(),
  recipients: z.string().max(2000).optional(),
  format: z.string().max(20).optional(),
  startDate: z.string().max(10).optional(),
  endDate: z.string().max(10).optional(),
  datePreset: z.string().max(30).optional(),
});
const RunBody = z.object({
  conditions: Conditions,
  save: z.boolean().default(true),
  dates: z.object({ enabled: z.boolean().default(false), preset: z.string().max(30).optional(), from: z.string().max(10).optional(), to: z.string().max(10).optional() }).optional(),
  schedule: ScheduleBody.optional(),
});

reportsRouter.get("/meta", handle((req) => reportMeta(user(req))));
reportsRouter.get("/options", handle((req) => reportOptions(user(req))));
reportsRouter.get(
  "/catalog",
  handle((req) => catalog(user(req), { q: typeof req.query.q === "string" ? req.query.q : undefined, runnable: req.query.runnable === "1" })),
);

reportsRouter.get("/categories/:id", handle((req) => getCategory(user(req), req.params.id!)));
reportsRouter.post("/categories", handle((req) => createCategory(user(req), CategoryBody.parse(req.body)), 201));
reportsRouter.patch("/categories/:id", handle((req) => updateCategory(user(req), req.params.id!, CategoryBody.parse(req.body))));
reportsRouter.delete("/categories/:id", handle((req) => deleteCategory(user(req), req.params.id!)));

reportsRouter.get("/templates/:id", handle((req) => getTemplate(user(req), req.params.id!)));
reportsRouter.post("/templates", handle((req) => createTemplate(user(req), TemplateBody.parse(req.body) as Partial<Template>), 201));
reportsRouter.patch("/templates/:id", handle((req) => updateTemplate(user(req), req.params.id!, TemplateBody.parse(req.body) as Partial<Template>)));
reportsRouter.delete("/templates/:id", handle((req) => deleteTemplate(user(req), req.params.id!)));
reportsRouter.post("/templates/:id/run", handle((req) => runTemplate(user(req), req.params.id!, RunBody.parse(req.body))));

reportsRouter.get(
  "/runs",
  handle((req) =>
    listRuns(user(req), {
      templateId: typeof req.query.templateId === "string" ? req.query.templateId : undefined,
      scheduleId: typeof req.query.scheduleId === "string" ? req.query.scheduleId : undefined,
      limit: req.query.limit ? Number(req.query.limit) || 50 : 50,
    }),
  ),
);
reportsRouter.get("/runs/:id", handle((req) => getRun(user(req), req.params.id!)));
reportsRouter.delete("/runs/:id", handle((req) => deleteRun(user(req), req.params.id!)));
reportsRouter.get("/runs/:id/export", handle((req) => exportRun(user(req), req.params.id!, typeof req.query.format === "string" ? req.query.format : undefined)));

reportsRouter.get("/schedules", handle((req) => listSchedules(user(req))));
reportsRouter.get("/schedules/:id", handle((req) => getSchedule(user(req), req.params.id!)));
reportsRouter.patch(
  "/schedules/:id",
  handle((req) => updateSchedule(user(req), req.params.id!, ScheduleBody.extend({ active: z.boolean().optional(), conditions: Conditions.optional() }).parse(req.body))),
);
reportsRouter.delete("/schedules/:id", handle((req) => deleteSchedule(user(req), req.params.id!)));
reportsRouter.post("/schedules/:id/run-now", handle((req) => runScheduleNow(user(req), req.params.id!)));
