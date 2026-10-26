import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../../../middleware/auth.js";
import { assertPermission } from "../superAdmin.service.js";
import {
  attendanceDay,
  courseHistory,
  decideSchedule,
  evaluationList,
  gradeSubmission,
  gradeSubmissions,
  myCoursesCounts,
  myCoursesNav,
  myRepository,
  mySchedule,
  pendingSchedules,
  saveCourseAttendance,
} from "../../instructor/myCourses.js";
import { audit } from "./service.js";

export const myCoursesRouter: Router = Router();

const user = (req: unknown) => (req as AuthedRequest).user;
const handle =
  (fn: (req: Request) => Promise<unknown>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await fn(req));
    } catch (err) {
      next(err);
    }
  };
const view = (fn: (req: Request) => Promise<unknown>) =>
  handle(async (req) => {
    await assertPermission(user(req), "courseManagement", "view");
    return fn(req);
  });

const text = (max: number) => z.string().max(max).optional();
const ScheduleQuery = z.object({ term: text(120), status: text(60) });
const AttendanceQuery = z.object({ date: text(10), student: text(120), course: text(60) });
const AttendanceBody = z.object({
  date: text(10),
  marks: z.array(z.object({ sectionId: text(60), studentId: text(60), status: text(10), note: text(500) })).max(5000),
});
const GradesQuery = z.object({ course: text(60), status: text(40) });
const ScheduleDecisionBody = z.object({ decision: z.enum(["accept", "decline"]), comment: text(1000) });

myCoursesRouter.get("/counts", view((req) => myCoursesCounts(user(req))));
myCoursesRouter.get("/nav", view((req) => myCoursesNav(user(req))));
myCoursesRouter.get("/schedule", view((req) => mySchedule(user(req), ScheduleQuery.parse(req.query))));
myCoursesRouter.get("/evaluations", view((req) => evaluationList(user(req))));
myCoursesRouter.get("/attendance", view((req) => attendanceDay(user(req), AttendanceQuery.parse(req.query))));
myCoursesRouter.put(
  "/attendance",
  handle(async (req) => {
    const u = user(req);
    await assertPermission(u, "courseManagement", "edit");
    const body = AttendanceBody.parse(req.body);
    const saved = await saveCourseAttendance(u, body);
    await audit(u, "MC02", "my-courses", "attendance.saved", { after: { date: body.date, saved: saved.saved, cleared: saved.cleared } });
    return saved;
  }),
);
myCoursesRouter.get("/repository", view((req) => myRepository(user(req), { course: String(req.query.course ?? "").slice(0, 120) })));
myCoursesRouter.get("/pending-schedules", view((req) => pendingSchedules(user(req), { type: String(req.query.type ?? "").slice(0, 40) })));
myCoursesRouter.post(
  "/pending-schedules/:id/decide",
  handle(async (req) => {
    const u = user(req);
    await assertPermission(u, "courseManagement", "edit");
    const id = z.string().uuid().parse(req.params.id);
    const body = ScheduleDecisionBody.parse(req.body);
    return decideSchedule(u, id, body);
  }),
);
myCoursesRouter.get("/grades", view((req) => gradeSubmissions(user(req), GradesQuery.parse(req.query))));
myCoursesRouter.get("/grades/:sectionId", view((req) => gradeSubmission(user(req), String(req.params.sectionId).slice(0, 60))));
myCoursesRouter.get("/history", view((req) => courseHistory(user(req))));
