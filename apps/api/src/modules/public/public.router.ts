import { Router, type Request, type Response, type NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@myheritage/db";
import { registerApplicant } from "./apply.js";

export const publicRouter: Router = Router();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 30;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimit(bucket: string, max = MAX_REQUESTS, message = "Too many verification attempts. Try again later.") {
  return (req: Request, res: Response, next: NextFunction) => {
    const client = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${bucket}|${client}`;
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      if (hits.size > 10_000) hits.clear();
      hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
      next();
      return;
    }
    entry.count += 1;
    if (entry.count > max) {
      res.status(429).json({ error: { code: "RATE_LIMITED", message } });
      return;
    }
    next();
  };
}

publicRouter.post("/apply", rateLimit("apply", 5, "Too many sign-up attempts from this network. Try again later."), async (req, res, next) => {
  try {
    res.status(201).json(await registerApplicant(req.body));
  } catch (err) {
    next(err);
  }
});

const EnglishTestRegistration = z
  .object({
    institutionName: z.string().trim().min(1).max(160),
    branchProfile: z.string().trim().max(160).default(""),
    siteName: z.string().trim().max(160).default(""),
    voucherCode: z.string().trim().max(80).default(""),
    firstName: z.string().trim().min(1).max(80),
    middleName: z.string().trim().max(80).default(""),
    lastName: z.string().trim().min(1).max(80),
    dateOfBirth: z.string().date(),
    gender: z.string().trim().min(1).max(40),
    highSchoolEnrolled: z.enum(["Yes", "No"]),
    address1: z.string().trim().min(1).max(160),
    address2: z.string().trim().max(160).default(""),
    country: z.string().trim().min(1).max(80),
    province: z.string().trim().min(1).max(80),
    otherProvince: z.string().trim().max(80).default(""),
    city: z.string().trim().min(1).max(80),
    postalCode: z.string().trim().min(1).max(20),
    email: z.string().trim().toLowerCase().email().max(200),
    homePhone: z.string().trim().max(30).default(""),
    mobilePhone: z.string().trim().min(6).max(30),
    studentId: z.string().trim().min(1).max(80),
    confirmStudentId: z.string().trim().min(1).max(80),
    supplementalStudentId: z.string().trim().max(80).default(""),
    resultInstitutions: z.array(z.string().trim().min(1).max(160)).max(10).default([]),
    optOutCollegePlanningEmail: z.boolean().default(false),
    privacyAccepted: z.literal(true),
  })
  .superRefine((value, ctx) => {
    if (value.studentId !== value.confirmStudentId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmStudentId"], message: "Student IDs do not match." });
    }
    if (value.province === "Other" && !value.otherProvince) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["otherProvince"], message: "Specify the province/state." });
    }
  });

publicRouter.post(
  "/english-test-registrations",
  rateLimit("english-test", 5, "Too many English Test registrations from this network. Try again later."),
  async (req, res, next) => {
    try {
      const body = EnglishTestRegistration.parse(req.body);
      const institution = await prisma.institution.findFirst({
        where: process.env.PUBLIC_INSTITUTION_ID ? { institutionId: process.env.PUBLIC_INSTITUTION_ID } : {},
        orderBy: { createdAt: "asc" },
        select: { institutionId: true },
      });
      if (!institution) {
        res.status(503).json({ error: { code: "UNAVAILABLE", message: "English Test registration is not open right now." } });
        return;
      }
      const registrationId = randomUUID();
      const reference = `HET-${new Date().getUTCFullYear()}-${registrationId.slice(0, 8).toUpperCase()}`;
      const submittedAt = new Date().toISOString();
      await prisma.sisScreenState.create({
        data: {
          institutionId: institution.institutionId,
          path: `selfpaced:english-test:${registrationId}`,
          payloadJson: JSON.stringify({ registrationId, reference, status: "received", submittedAt, ...body }),
        },
      });
      res.status(201).json({ ok: true, registrationId, reference, status: "received", submittedAt });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Identity match needs both the student number and the registered family name, so a
 * student number alone never reveals whether a record exists.
 */
publicRouter.get("/verify", rateLimit("verify"), async (req, res, next) => {
  try {
    const studentNumber = String(req.query.studentNumber ?? "").trim();
    const familyName = String(req.query.familyName ?? "").trim();
    if (!studentNumber || !familyName) {
      res.status(400).json({ match: false, error: { message: "studentNumber and familyName required" } });
      return;
    }
    const hit = await prisma.student.findFirst({
      where: {
        studentNumber: { equals: studentNumber, mode: "insensitive" },
        person: { familyName: { equals: familyName, mode: "insensitive" } },
      },
      select: { id: true },
    });
    res.json({ match: Boolean(hit) });
  } catch (err) {
    next(err);
  }
});

const CertificateId = z.string().uuid();

publicRouter.get("/certificates/:id", rateLimit("certificates"), async (req, res, next) => {
  try {
    const id = CertificateId.safeParse(req.params.id);
    const row = id.success
      ? await prisma.credentialRecord.findFirst({
          where: { id: id.data, status: { in: ["earned", "revoked"] } },
          select: {
            id: true,
            title: true,
            status: true,
            earnedAt: true,
            student: { select: { person: { select: { givenName: true, preferredName: true, familyName: true } } } },
          },
        })
      : null;
    if (!row) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "No certificate found" } });
      return;
    }
    const person = row.student.person;
    res.json({
      certificateId: row.id,
      holderName: `${person.preferredName || person.givenName} ${person.familyName}`.trim(),
      title: row.title,
      status: row.status,
      issuedAt: row.earnedAt?.toISOString() ?? null,
    });
  } catch (err) {
    next(err);
  }
});
