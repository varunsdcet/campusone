import { Router } from "express";

export const catalogRouter: Router = Router();

catalogRouter.get("/screens", (_req, res) => {
  res.json({
    groups: ["Shared", "Student", "Teacher", "Admin", "Applicant", "Employer", "Mobile"],
    note: "Canonical screen catalogue mirrored by apps/web/src/lib/screens.ts",
    count: 120,
  });
});
