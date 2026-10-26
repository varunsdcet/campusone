import { Router, type NextFunction, type Request, type Response } from "express";
import { prisma } from "@myheritage/db";
import { requireAuth, requireRoles, type AuthedRequest } from "../../middleware/auth.js";
import { assertPermission } from "../admin/superAdmin.service.js";
import { issueSelfpacedCertificate } from "./selfpaced.service.js";
import {
  enrolFreeProgram,
  enrolPaidProgram,
  getMySelfpacedState,
  listMySelfpacedEnrolments,
  listSelfpacedPrograms,
  publicInstitutionId,
  registerSelfpacedLearner,
  saveMySelfpacedState,
  saveSelfpacedProgram,
  setSelfpacedProgramStatus,
} from "./catalogue.service.js";

export const selfpacedRouter: Router = Router();

const requireSelfpacedAccess = (mode: "view" | "edit") => async (req: Request, _res: Response, next: NextFunction) => {
  try {
    await assertPermission((req as AuthedRequest).user, "courseManagement", mode);
    next();
  } catch (error) {
    next(error);
  }
};

selfpacedRouter.get("/programs", async (_req, res, next) => {
  try {
    res.json({ items: await listSelfpacedPrograms(await publicInstitutionId()) });
  } catch (err) {
    next(err);
  }
});

selfpacedRouter.get("/programs/:slug", async (req, res, next) => {
  try {
    const item = (await listSelfpacedPrograms(await publicInstitutionId())).find((program) => program.slug === req.params.slug);
    if (!item) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Program not found." } });
    res.json(item);
  } catch (err) {
    next(err);
  }
});

selfpacedRouter.post("/register", async (req, res, next) => {
  try {
    res.status(201).json(await registerSelfpacedLearner(req.body));
  } catch (err) {
    next(err);
  }
});

selfpacedRouter.get("/enrolments", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.json({ items: await listMySelfpacedEnrolments((req as AuthedRequest).user) });
  } catch (err) {
    next(err);
  }
});

selfpacedRouter.post("/enrolments/free", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.status(201).json(await enrolFreeProgram((req as AuthedRequest).user, String(req.body?.slug || "")));
  } catch (err) {
    next(err);
  }
});

selfpacedRouter.post("/enrolments/paid", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.status(201).json(await enrolPaidProgram((req as AuthedRequest).user, req.body));
  } catch (err) {
    next(err);
  }
});

selfpacedRouter.get("/state", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.json(await getMySelfpacedState((req as AuthedRequest).user));
  } catch (err) {
    next(err);
  }
});

selfpacedRouter.put("/state", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    res.json(await saveMySelfpacedState((req as AuthedRequest).user, req.body));
  } catch (err) {
    next(err);
  }
});

selfpacedRouter.get("/admin/programs", requireAuth, requireRoles("admin", "registrar"), requireSelfpacedAccess("view"), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    res.json({ items: await listSelfpacedPrograms(user.institutionId, true) });
  } catch (err) {
    next(err);
  }
});

selfpacedRouter.post("/admin/programs", requireAuth, requireRoles("admin", "registrar"), requireSelfpacedAccess("edit"), async (req, res, next) => {
  try {
    res.status(201).json(await saveSelfpacedProgram((req as AuthedRequest).user, req.body));
  } catch (err) {
    next(err);
  }
});

selfpacedRouter.put("/admin/programs/:slug", requireAuth, requireRoles("admin", "registrar"), requireSelfpacedAccess("edit"), async (req, res, next) => {
  try {
    res.json(await saveSelfpacedProgram((req as AuthedRequest).user, req.body, req.params.slug));
  } catch (err) {
    next(err);
  }
});

selfpacedRouter.post("/admin/programs/:slug/status", requireAuth, requireRoles("admin", "registrar"), requireSelfpacedAccess("edit"), async (req, res, next) => {
  try {
    const status = String(req.body?.status || "");
    if (!["draft", "review", "published"].includes(status)) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid status." } });
    res.json(await setSelfpacedProgramStatus((req as AuthedRequest).user, req.params.slug, status as "draft" | "review" | "published"));
  } catch (err) {
    next(err);
  }
});

selfpacedRouter.post("/certificates", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    const out = await issueSelfpacedCertificate((req as AuthedRequest).user, req.body);
    res.status(out.created ? 201 : 200).json(out);
  } catch (err) {
    next(err);
  }
});

selfpacedRouter.get("/admin/english-test-registrations", requireAuth, requireRoles("admin", "registrar"), requireSelfpacedAccess("view"), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const rows = await prisma.sisScreenState.findMany({
      where: { institutionId: user.institutionId, path: { startsWith: "selfpaced:english-test:" } },
      orderBy: { createdAt: "desc" },
      take: 250,
    });
    res.json({
      items: rows.flatMap((row) => {
        try {
          return [{ ...JSON.parse(row.payloadJson), rowVersion: row.rowVersion }];
        } catch {
          return [];
        }
      }),
    });
  } catch (err) {
    next(err);
  }
});
