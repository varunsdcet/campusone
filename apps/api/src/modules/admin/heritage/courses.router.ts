import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../../../middleware/auth.js";
import { courseCounts, courseMeta, deleteEntity, downloadFile, getEntity, listEntity, saveEntity, uploadFile } from "./courses.js";
import {
  activeCourses,
  addCourseTextbook,
  bulkUpdate,
  courseDirectory,
  courseHistory,
  courseRecords,
  courseTextbooks,
  courseVersion,
  deleteCourse,
  deleteSession,
  getCourse,
  getSession,
  listSessions,
  pendingChanges,
  removeCourseTextbook,
  restoreCourse,
  saveCourse,
  saveSession,
} from "./courses.catalog.js";
import {
  assignEvaluation,
  assignedList,
  backupsList,
  editAssignment,
  evaluationResults,
  pullContent,
  pullSources,
  pushContent,
  pushTargets,
  releaseResults,
  repositoryContent,
  repositoryHistory,
  repositoryList,
  restoreBackup,
  saveRepositoryContent,
  unassignEvaluation,
} from "./courses.content.js";

export const coursesRouter: Router = Router();

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
const q = (v: unknown) => (typeof v === "string" ? v.slice(0, 200) : undefined);
const n = (v: unknown) => (typeof v === "string" && v ? Number(v) || undefined : undefined);
const id = (req: Request, key = "id") => z.string().min(1).max(80).parse(req.params[key]);
const Body = z.record(z.unknown());
const body = (req: Request) => Body.parse(req.body ?? {});

coursesRouter.get("/meta", handle((req) => courseMeta(user(req))));
coursesRouter.get("/counts", handle((req) => courseCounts(user(req))));

coursesRouter.post("/files", handle((req) => uploadFile(user(req), z.object({ name: z.string().max(300), mime: z.string().max(200), base64: z.string().max(12_000_000), accept: z.string().max(300).optional() }).parse(req.body)), 201));
coursesRouter.get("/files/:id", handle((req) => downloadFile(user(req), id(req))));

/* Courses & Sessions */
coursesRouter.get("/directory", handle((req) => courseDirectory(user(req), q(req.query.q) ?? "")));
coursesRouter.post("/bulk", handle((req) => bulkUpdate(user(req), z.object({ type: z.string().max(80).optional(), value: z.unknown(), courseIds: z.array(z.string().max(80)).max(2000).optional() }).parse(req.body))));
coursesRouter.post("/courses", handle((req) => saveCourse(user(req), null, body(req)), 201));
coursesRouter.get("/courses/:id", handle((req) => getCourse(user(req), id(req))));
coursesRouter.patch("/courses/:id", handle((req) => saveCourse(user(req), id(req), body(req))));
coursesRouter.delete("/courses/:id", handle((req) => deleteCourse(user(req), id(req))));
coursesRouter.get("/courses/:id/history", handle((req) => courseHistory(user(req), id(req))));
coursesRouter.get("/courses/:id/history/:vid", handle((req) => courseVersion(user(req), id(req), id(req, "vid"))));
coursesRouter.post("/courses/:id/history/:vid/restore", handle((req) => restoreCourse(user(req), id(req), id(req, "vid"))));
coursesRouter.get("/courses/:id/records", handle((req) => courseRecords(user(req), id(req))));
coursesRouter.get("/courses/:id/sessions", handle((req) => listSessions(user(req), id(req), q(req.query.status) ?? "")));
coursesRouter.post("/courses/:id/sessions", handle((req) => saveSession(user(req), id(req), null, body(req)), 201));
coursesRouter.get("/courses/:id/textbooks", handle((req) => courseTextbooks(user(req), id(req))));
coursesRouter.post("/courses/:id/textbooks", handle((req) => addCourseTextbook(user(req), id(req), body(req)), 201));
coursesRouter.delete("/courses/:id/textbooks/:bookId", handle((req) => removeCourseTextbook(user(req), id(req), id(req, "bookId"))));
coursesRouter.get("/sessions/:id", handle((req) => getSession(user(req), id(req))));
coursesRouter.patch(
  "/sessions/:id",
  handle(async (req) => {
    const s = await getSession(user(req), id(req));
    return saveSession(user(req), s.courseId, s.id, body(req));
  }),
);
coursesRouter.delete("/sessions/:id", handle((req) => deleteSession(user(req), id(req))));

/* Pending / Active */
coursesRouter.get("/pending", handle((req) => pendingChanges(user(req), { campus: q(req.query.campus), course: q(req.query.course), term: q(req.query.term), status: q(req.query.status), type: q(req.query.type) })));
coursesRouter.get(
  "/active",
  handle((req) =>
    activeCourses(user(req), { campus: q(req.query.campus), course: q(req.query.course), term: q(req.query.term), student: q(req.query.student), faculty: q(req.query.faculty), page: n(req.query.page), perPage: n(req.query.perPage) }),
  ),
);

/* Repository / Backups */
coursesRouter.get("/repository", handle((req) => repositoryList(user(req), { course: q(req.query.course), filter: q(req.query.filter), campus: q(req.query.campus), page: n(req.query.page), perPage: n(req.query.perPage) })));
coursesRouter.get("/repository/:id/content", handle((req) => repositoryContent(user(req), id(req))));
coursesRouter.put("/repository/:id/content", handle((req) => saveRepositoryContent(user(req), id(req), body(req))));
coursesRouter.get("/repository/:id/push", handle((req) => pushTargets(user(req), id(req), q(req.query.method) ?? "")));
coursesRouter.post("/repository/:id/push", handle((req) => pushContent(user(req), id(req), z.object({ sectionIds: z.array(z.string().max(80)).max(500) }).parse(req.body))));
coursesRouter.get("/repository/:id/pull", handle((req) => pullSources(user(req), id(req))));
coursesRouter.post("/repository/:id/pull", handle((req) => pullContent(user(req), id(req), z.object({ sectionId: z.string().max(80) }).parse(req.body))));
coursesRouter.get("/repository/:id/history", handle((req) => repositoryHistory(user(req), id(req))));
coursesRouter.get("/backups", handle((req) => backupsList(user(req), { campus: q(req.query.campus), course: q(req.query.course), term: q(req.query.term), status: q(req.query.status), page: n(req.query.page), perPage: n(req.query.perPage) })));
coursesRouter.post("/backups/:id/restore", handle((req) => restoreBackup(user(req), id(req))));

/* Evaluations */
coursesRouter.post("/evaluations/:id/assign", handle((req) => assignEvaluation(user(req), id(req), body(req)), 201));
coursesRouter.get("/assigned", handle((req) => assignedList(user(req), { evaluation: q(req.query.evaluation), campus: q(req.query.campus), term: q(req.query.term), course: q(req.query.course), page: n(req.query.page), perPage: n(req.query.perPage) })));
coursesRouter.patch("/assigned/:id", handle((req) => editAssignment(user(req), id(req), body(req))));
coursesRouter.delete("/assigned/:id", handle((req) => unassignEvaluation(user(req), id(req))));
coursesRouter.get("/assigned/:id/results", handle((req) => evaluationResults(user(req), id(req))));
coursesRouter.post("/assigned/:id/release", handle((req) => releaseResults(user(req), id(req))));

/* Configuration records */
coursesRouter.get("/e/:entity", handle((req) => listEntity(user(req), id(req, "entity"), { parentId: q(req.query.parentId), q: q(req.query.q) })));
coursesRouter.get("/e/:entity/:id", handle((req) => getEntity(user(req), id(req, "entity"), id(req))));
coursesRouter.post("/e/:entity", handle((req) => saveEntity(user(req), id(req, "entity"), null, body(req)), 201));
coursesRouter.patch("/e/:entity/:id", handle((req) => saveEntity(user(req), id(req, "entity"), id(req), body(req))));
coursesRouter.delete("/e/:entity/:id", handle((req) => deleteEntity(user(req), id(req, "entity"), id(req))));
