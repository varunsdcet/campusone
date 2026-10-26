import { Router } from "express";
import { prisma } from "@myheritage/db";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { buildPortalView } from "./portal.service.js";
import { currentTerm } from "../../lib/currentTerm.js";

export const portalRouter: Router = Router();

portalRouter.get("/view", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const path = String(req.query.path ?? "");
    if (!path.startsWith("/")) {
      res.status(400).json({ error: { message: "path query required, e. and /student/courses" } });
      return;
    }
    const view = await buildPortalView(user, path);
    res.json(view);
  } catch (err) {
    next(err);
  }
});

portalRouter.get("/bootstrap", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const institution = await prisma.institution.findFirst({ where: { institutionId: user.institutionId } });
    const term = await currentTerm(user.institutionId);
    const person = await prisma.person.findUnique({ where: { id: user.personId } });
    res.json({
      institution: institution
        ? {
            name: institution.name,
            city: institution.city,
            region: institution.region,
            currency: institution.currency,
          }
        : null,
      term: term ? { code: term.code, name: term.name, startsOn: term.startsOn, endsOn: term.endsOn } : null,
      user: {
        personId: user.personId,
        accountId: user.accountId,
        roles: user.roles,
        givenName: person?.givenName ?? "",
        familyName: person?.familyName ?? "",
      },
    });
  } catch (err) {
    next(err);
  }
});
