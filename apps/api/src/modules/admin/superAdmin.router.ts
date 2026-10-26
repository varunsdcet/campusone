import { Router, type RequestHandler } from "express";
import type { SessionClaims } from "@myheritage/contracts";
import type { AuthedRequest } from "../../middleware/auth.js";
import {
  AccessLevelBody,
  CAMPUSES,
  FacultyProfilePatch,
  PasswordBody,
  PERMISSION_MODULES,
  PROFILE_TYPES,
  SecurityQuestionsBody,
  StudentSearchQuery,
  TimeZoneBody,
  UserBody,
  UserListQuery,
  assertPermission,
  changeOwnPassword,
  deleteAccessLevel,
  getFacultyProfile,
  getSecurityQuestions,
  getTimeZone,
  getUser,
  listAccessLevels,
  listAccomplishments,
  listUsers,
  patchFacultyProfile,
  saveSecurityQuestions,
  saveTimeZone,
  saveUser,
  searchStudents,
  studentSearchOptions,
  upsertAccessLevel,
} from "./superAdmin.service.js";

export const superAdminRouter: Router = Router();

type Gate = Parameters<typeof assertPermission>;

function gate(module: Gate[1], mode: Gate[2]): RequestHandler {
  return async (req, _res, next) => {
    try {
      await assertPermission((req as AuthedRequest).user, module, mode);
      next();
    } catch (err) {
      next(err);
    }
  };
}

function gateOther(mode: Gate[2]): RequestHandler {
  return async (req, _res, next) => {
    const user = (req as AuthedRequest).user;
    if (req.params.id === "me" || req.params.id === user.accountId) return next();
    try {
      await assertPermission(user, "facultyProfiles", mode);
      next();
    } catch (err) {
      next(err);
    }
  };
}

const viewUsers = gate("userManagement", "view");
const editUsers = gate("userManagement", "edit");
const viewStudents = gate("studentRecords", "view");

function handle(fn: (user: SessionClaims, req: Parameters<RequestHandler>[0]) => Promise<unknown>): RequestHandler {
  return async (req, res, next) => {
    try {
      res.json(await fn((req as AuthedRequest).user, req));
    } catch (err) {
      next(err);
    }
  };
}

superAdminRouter.get(
  "/meta",
  viewUsers,
  handle(async () => ({ permissionModules: PERMISSION_MODULES, profileTypes: PROFILE_TYPES, campuses: CAMPUSES })),
);

superAdminRouter.get("/access-levels", viewUsers, handle(async (user) => ({ items: await listAccessLevels(user.institutionId) })));
superAdminRouter.post("/access-levels", editUsers, handle((user, req) => upsertAccessLevel(user, null, AccessLevelBody.parse(req.body))));
superAdminRouter.put(
  "/access-levels/:id",
  editUsers,
  handle((user, req) => upsertAccessLevel(user, String(req.params.id), AccessLevelBody.parse(req.body))),
);
superAdminRouter.delete("/access-levels/:id", editUsers, handle((user, req) => deleteAccessLevel(user, String(req.params.id))));

superAdminRouter.get("/users", viewUsers, handle((user, req) => listUsers(user.institutionId, UserListQuery.parse(req.query))));
superAdminRouter.get("/users/:id", viewUsers, handle((user, req) => getUser(user.institutionId, String(req.params.id))));
superAdminRouter.post("/users", editUsers, handle((user, req) => saveUser(user, null, UserBody.parse(req.body))));
superAdminRouter.put("/users/:id", editUsers, handle((user, req) => saveUser(user, String(req.params.id), UserBody.parse(req.body))));

superAdminRouter.get("/students/options", viewStudents, handle((user) => studentSearchOptions(user.institutionId)));
superAdminRouter.get(
  "/students/search",
  viewStudents,
  handle((user, req) => searchStudents(user, StudentSearchQuery.parse(req.query))),
);

superAdminRouter.get(
  "/faculty/:id",
  gateOther("view"),
  handle((user, req) => getFacultyProfile(user.institutionId, req.params.id === "me" ? user.accountId : String(req.params.id))),
);
superAdminRouter.patch(
  "/faculty/:id",
  gateOther("edit"),
  handle((user, req) =>
    patchFacultyProfile(user, req.params.id === "me" ? user.accountId : String(req.params.id), FacultyProfilePatch.parse(req.body)),
  ),
);

superAdminRouter.get("/me/accomplishments", handle((user) => listAccomplishments(user)));
superAdminRouter.put("/me/password", handle((user, req) => changeOwnPassword(user, PasswordBody.parse(req.body))));
superAdminRouter.get("/me/security-questions", handle((user) => getSecurityQuestions(user)));
superAdminRouter.put(
  "/me/security-questions",
  handle((user, req) => saveSecurityQuestions(user, SecurityQuestionsBody.parse(req.body))),
);
superAdminRouter.get("/me/timezone", handle((user) => getTimeZone(user)));
superAdminRouter.put("/me/timezone", handle((user, req) => saveTimeZone(user, TimeZoneBody.parse(req.body))));
