import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../../../middleware/auth.js";
import {
  adminWorkshops,
  attendanceDay,
  attendanceWeek,
  availableWorkshops,
  completedWorkshops,
  createEnrolment,
  createEnrolments,
  deleteCategory,
  deleteEnrolment,
  deleteRole,
  deleteWorkshop,
  getRole,
  getWorkshop,
  getWorkshopImage,
  listCategories,
  listEnrolments,
  listRoles,
  myWorkshops,
  saveAttendance,
  saveCategory,
  saveRole,
  saveWorkshop,
  searchStudents,
  setEnrolmentStatus,
  workshopCounts,
  workshopMeta,
} from "./workshops.js";

export const workshopsRouter: Router = Router();

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

const text = (max: number) => z.string().max(max).optional();
const id = (req: Request) => z.string().uuid().parse(req.params.id);

const EnrolmentQuery = z.object({
  student: text(120),
  workshop: text(60),
  status: text(20),
  letter: text(3),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(500).default(50),
});
const AttendanceQuery = z.object({ date: text(10), student: text(120), workshop: text(60) });
const Session = z.object({ day: text(12), start: text(5), end: text(5) });
const WorkshopBody = z.object({
  categoryId: text(60),
  title: text(300),
  code: text(60),
  image: z.object({ name: z.string().max(300), dataUrl: z.string().max(3_000_000) }).nullable().optional(),
  settings: z
    .object({
      introduction: text(5000),
      descriptionHtml: text(250_000),
      adminStatus: text(20),
      campus: text(200),
      instructors: z.array(z.string().max(60)).max(30).optional(),
      classroom: text(60),
      enrolmentCutoff: text(16),
      rolesMode: text(20),
      roleIds: z.array(z.string().max(60)).max(50).optional(),
      maxEnrolments: z.union([z.number(), z.string().max(10)]).optional(),
      sameAsClassroom: z.boolean().optional(),
      privacy: text(40),
      approval: text(40),
      hours: z.union([z.number(), z.string().max(10)]).optional(),
      continuous: z.boolean().optional(),
      startDate: text(10),
      endDate: text(10),
      scheduleType: text(40),
      sessions: z.array(Session).max(7).optional(),
      dailyStart: text(5),
      dailyEnd: text(5),
      feeCollection: text(40),
      defaultFee: z.union([z.number(), z.string().max(20)]).optional(),
      domesticFee: z.union([z.number(), z.string().max(20)]).optional(),
      internationalFee: z.union([z.number(), z.string().max(20)]).optional(),
      gradingScheme: text(200),
      lms: text(20),
      campusAccess: text(200),
      accessLevels: text(200),
      studentStatuses: text(200),
      programOfStudy: text(300),
      grades: text(20),
      badges: text(20),
    })
    .default({}),
});
const CategoryBody = z.object({ name: text(200), abbreviation: text(40) });
const RoleBody = z.object({
  name: text(200),
  status: text(20),
  outcomes: z.array(z.object({ value: text(4000), grantsCompletion: text(5) })).max(50).optional(),
  competencies: z.array(z.string().max(200)).max(100).optional(),
});
const EnrolBody = z.object({ studentId: text(60), workshopId: text(60), roleId: text(60), note: text(2000) });
const BulkEnrolBody = z.object({ studentIds: z.array(z.string().uuid()).min(1).max(50), workshopId: text(60), roleId: text(60), note: text(2000) });
const StatusBody = z.object({ status: z.enum(["pending", "approved", "declined", "dropped"]), note: text(2000) });
const AttendanceBody = z.object({
  date: text(10),
  marks: z.array(z.object({ workshopId: text(60), studentId: text(60), status: text(10), note: text(500) })).max(5000),
});

workshopsRouter.get("/meta", handle((req) => workshopMeta(user(req))));
workshopsRouter.get("/counts", handle((req) => workshopCounts(user(req))));
workshopsRouter.get("/students", handle((req) => searchStudents(user(req), String(req.query.q ?? "").slice(0, 120))));

workshopsRouter.get("/enrolments", handle((req) => listEnrolments(user(req), EnrolmentQuery.parse(req.query))));
workshopsRouter.post("/enrolments", handle((req) => createEnrolment(user(req), EnrolBody.parse(req.body)), 201));
workshopsRouter.post("/enrolments/bulk", handle((req) => createEnrolments(user(req), BulkEnrolBody.parse(req.body))));
workshopsRouter.post(
  "/enrolments/:id/status",
  handle((req) => {
    const body = StatusBody.parse(req.body);
    return setEnrolmentStatus(user(req), id(req), body.status, body.note);
  }),
);
workshopsRouter.delete("/enrolments/:id", handle((req) => deleteEnrolment(user(req), id(req))));

workshopsRouter.get("/mine", handle((req) => myWorkshops(user(req), String(req.query.filter ?? ""))));
workshopsRouter.get("/available", handle((req) => availableWorkshops(user(req))));
workshopsRouter.get("/completed", handle((req) => completedWorkshops(user(req))));

workshopsRouter.get("/attendance", handle((req) => attendanceDay(user(req), AttendanceQuery.parse(req.query))));
workshopsRouter.get("/attendance/week", handle((req) => attendanceWeek(user(req), AttendanceQuery.parse(req.query))));
workshopsRouter.put("/attendance", handle((req) => saveAttendance(user(req), AttendanceBody.parse(req.body))));

workshopsRouter.get("/categories", handle((req) => listCategories(user(req))));
workshopsRouter.post("/categories", handle((req) => saveCategory(user(req), null, CategoryBody.parse(req.body)), 201));
workshopsRouter.put("/categories/:id", handle((req) => saveCategory(user(req), id(req), CategoryBody.parse(req.body))));
workshopsRouter.delete("/categories/:id", handle((req) => deleteCategory(user(req), id(req))));

workshopsRouter.get("/roles", handle((req) => listRoles(user(req))));
workshopsRouter.get("/roles/:id", handle((req) => getRole(user(req), id(req))));
workshopsRouter.post("/roles", handle((req) => saveRole(user(req), null, RoleBody.parse(req.body)), 201));
workshopsRouter.put("/roles/:id", handle((req) => saveRole(user(req), id(req), RoleBody.parse(req.body))));
workshopsRouter.delete("/roles/:id", handle((req) => deleteRole(user(req), id(req))));

workshopsRouter.get(
  "/catalog",
  handle((req) => adminWorkshops(user(req), { status: String(req.query.status ?? ""), completion: String(req.query.completion ?? ""), q: String(req.query.q ?? "").slice(0, 120) })),
);
workshopsRouter.post("/catalog", handle((req) => saveWorkshop(user(req), null, WorkshopBody.parse(req.body) as never), 201));
workshopsRouter.get("/catalog/:id", handle((req) => getWorkshop(user(req), id(req))));
workshopsRouter.get("/catalog/:id/image", handle((req) => getWorkshopImage(user(req), id(req))));
workshopsRouter.put("/catalog/:id", handle((req) => saveWorkshop(user(req), id(req), WorkshopBody.parse(req.body) as never)));
workshopsRouter.delete("/catalog/:id", handle((req) => deleteWorkshop(user(req), id(req))));
