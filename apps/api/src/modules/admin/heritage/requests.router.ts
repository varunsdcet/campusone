import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../../../middleware/auth.js";
import { decideRequest, deleteRequest, getRequest, listRequests, requestCounts, requestMeta, updateRequest } from "./requests.js";

export const requestsRouter: Router = Router();

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

const text = (max: number) => z.string().max(max).optional();
const ListQuery = z.object({
  request: text(20),
  user: text(120),
  form: text(120),
  status: text(20),
  type: text(40),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(500).default(50),
});
const EditBody = z.object({
  profile: z
    .object({
      familyName: text(100),
      givenName: text(100),
      middleName: text(100),
      preferredName: text(100),
      phone: text(30),
      primaryEmail: text(200),
      emergencyContactName: text(120),
      emergencyContactPhone: text(30),
    })
    .optional(),
  loa: z.object({ reason: text(2000), startsOn: text(10), endsOn: text(10) }).optional(),
  service: z.object({ subject: text(200), details: text(4000) }).optional(),
});
const DecisionBody = z.object({
  comments: text(4000),
  settings: z
    .object({
      type: text(40),
      absenceStart: text(10),
      returning: text(10),
      programProfile: text(80),
      enrolmentsAction: text(60),
      changeStatus: text(60),
      returningStatus: text(60),
    })
    .optional(),
});
const num = (req: Request) => z.coerce.number().int().min(1).parse(req.params.number);

requestsRouter.get("/meta", handle((req) => requestMeta(user(req))));
requestsRouter.get("/counts", handle((req) => requestCounts(user(req))));
requestsRouter.get("/", handle((req) => listRequests(user(req), ListQuery.parse(req.query))));
requestsRouter.get("/:number", handle((req) => getRequest(user(req), num(req))));
requestsRouter.patch("/:number", handle((req) => updateRequest(user(req), num(req), EditBody.parse(req.body))));
requestsRouter.post("/:number/approve", handle((req) => decideRequest(user(req), num(req), "approve", DecisionBody.parse(req.body))));
requestsRouter.post("/:number/decline", handle((req) => decideRequest(user(req), num(req), "decline", DecisionBody.parse(req.body))));
requestsRouter.delete("/:number", handle((req) => deleteRequest(user(req), num(req))));
