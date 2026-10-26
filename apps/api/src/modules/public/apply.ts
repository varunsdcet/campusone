import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@myheritage/db";
import { hashPassword } from "@myheritage/auth";
import { writeAuditAndOutbox } from "@myheritage/events";
import { REQUIRED_APPLICANT_DOCUMENTS } from "../applicant/applicationForm.js";

export const ApplyBody = z.object({
  givenName: z.string().trim().min(1).max(80),
  middleName: z.string().trim().max(80).optional().default(""),
  familyName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
  phone: z.string().trim().max(30).optional().default(""),
  dateOfBirth: z.string().trim().max(10).optional().default(""),
  gender: z.string().trim().max(40).optional().default(""),
  residency: z.string().trim().max(80).optional().default(""),
  country: z.string().trim().max(80).optional().default(""),
  addressLine1: z.string().trim().max(160).optional().default(""),
  addressLine2: z.string().trim().max(80).optional().default(""),
  city: z.string().trim().max(80).optional().default(""),
  region: z.string().trim().max(80).optional().default(""),
  postalCode: z.string().trim().max(20).optional().default(""),
  programCategory: z.string().trim().max(120).optional().default(""),
  programName: z.string().trim().max(180).optional().default(""),
  intakeTerm: z.string().trim().max(120).optional().default(""),
  campus: z.string().trim().max(120).optional().default(""),
  applicationAcknowledgement: z.string().trim().max(40).optional().default(""),
});

const REFUSED =
  "We could not create an account with these details. If you already have an account, sign in or reset your password.";

const fail = (status: number, code: string, message: string) => Object.assign(new Error(message), { status, code });

/** Self-service sign-up only ever grants the applicant role; staff and student accounts are created by the registrar. */
export async function registerApplicant(input: unknown) {
  const parsed = ApplyBody.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    const message =
      field === "password"
        ? "Password must be at least 8 characters."
        : field === "email"
          ? "Enter a valid email address."
          : "Enter your first and last name.";
    throw fail(400, "VALIDATION_ERROR", message);
  }
  const body = parsed.data;
  const institution = await prisma.institution.findFirst({
    where: process.env.PUBLIC_INSTITUTION_ID ? { institutionId: process.env.PUBLIC_INSTITUTION_ID } : {},
    orderBy: { createdAt: "asc" },
    select: { institutionId: true },
  });
  if (!institution) throw fail(503, "UNAVAILABLE", "Online applications are not open right now.");
  const inst = institution.institutionId;

  // Sign-in looks accounts up by e-mail across institutions, so an address may only exist once.
  const [account, person] = await Promise.all([
    prisma.account.findFirst({ where: { email: body.email }, select: { id: true } }),
    prisma.person.findFirst({ where: { institutionId: inst, email: body.email }, select: { id: true } }),
  ]);
  if (account || person) throw fail(409, "APPLY_REFUSED", REFUSED);

  const passwordHash = await hashPassword(body.password);
  const created = await prisma
    .$transaction(async (tx) => {
      const p = await tx.person.create({
        data: { institutionId: inst, givenName: body.givenName, middleName: body.middleName || null, familyName: body.familyName, email: body.email, phone: body.phone || null, dateOfBirth: body.dateOfBirth || null },
      });
      const a = await tx.account.create({
        data: { institutionId: inst, personId: p.id, email: body.email, passwordHash, status: "active", rolesJson: JSON.stringify(["applicant"]) },
      });
      const app = await tx.admissionsApplication.create({
        data: {
          institutionId: inst,
          accountId: a.id,
          personId: p.id,
          programName: body.programName,
          intakeTerm: body.intakeTerm,
          status: "draft",
          progressPct: 0,
          formJson: JSON.stringify({ ...body, password: undefined }),
          documents: { create: REQUIRED_APPLICANT_DOCUMENTS.map((label) => ({ institutionId: inst, label, status: "missing" })) },
          timeline: { create: [{ institutionId: inst, title: "Applicant account created", detail: "Signed up online" }] },
        },
      });
      await writeAuditAndOutbox(tx, {
        institutionId: inst,
        actorId: a.id,
        eventName: "ApplicantAccount.registered",
        purpose: "applicant_mutation",
        before: null,
        after: { accountId: a.id, applicationId: app.id, roles: ["applicant"] },
        source: "public.apply",
        correlationId: randomUUID(),
        outboxPayload: { accountId: a.id, applicationId: app.id },
      });
      return { accountId: a.id, applicationId: app.id };
    })
    .catch((err: { code?: string }) => {
      if (err?.code === "P2002") throw fail(409, "APPLY_REFUSED", REFUSED);
      throw err;
    });
  return { ok: true, ...created, email: body.email, next: "/applicant" };
}
