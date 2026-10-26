import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@myheritage/db";
import { hashPassword } from "@myheritage/auth";
import { requireAuth, requireRoles, type AuthedRequest } from "../../middleware/auth.js";
import { getSisScreen, runSisAction, getCampusOverview } from "./sis.service.js";
import { superAdminRouter } from "./superAdmin.router.js";
import { assertPermission, canView, effectiveAccess, type PermissionModuleKey } from "./superAdmin.service.js";
import { heritageRouter } from "./heritage/heritage.router.js";
import { enrolInSection, quoteSectionFee, seatRule } from "./heritage/enrolment.js";
import { S as CM, settingsOf } from "./heritage/courses.js";
import { knownProgramName } from "../academic/program-version.js";
import { termLabel } from "../../lib/sectionTerm.js";
import { loadSectionTerms } from "../instructor/myCoursesFacts.js";
import {
  UpsertCohortBody,
  GeneratePlanBody,
  LedgerPostBody,
  LedgerAdjustBody,
  GenerateTaxBody,
  ExtracurricularBody,
  StudentDocumentBody,
  RetakeBody,
  MailPolicyBody,
  listCohorts,
  upsertCohort,
  generateProgramPlan,
  listLedger,
  postLedgerEntry,
  adjustLedgerEntry,
  listTaxDocumentsAdmin,
  generateT2202,
  getAdminTaxPdf,
  listExtracurricularAdmin,
  upsertExtracurricular,
  deleteExtracurricular,
  listStudentDocumentsAdmin,
  upsertStudentDocument,
  deleteStudentDocument,
  listRetakes,
  createRetake,
  getMailPolicy,
  updateMailPolicy,
  listProgramsLite,
  listStudentsLite,
  listSectionsLite,
  listFinancialTerms,
} from "./registrar-gaps.service.js";

export const adminRouter: Router = Router();

const CreateUser = z.object({
  email: z.string().email(),
  givenName: z.string().min(1),
  familyName: z.string().min(1),
  role: z.enum(["student", "instructor", "admin", "registrar", "applicant", "employer"]),
  password: z.string().min(8).max(200),
  studentNumber: z.string().optional(),
  programName: z.string().optional(),
  intakeTerm: z.string().optional(),
});

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

async function generatedStudentNumber(institutionId: string, offset = 0) {
  const year = new Date().getFullYear();
  const prefix = `ST-${year}-`;
  const rows = await prisma.student.findMany({
    where: { institutionId, studentNumber: { startsWith: prefix } },
    select: { studentNumber: true },
  });
  const used = new Set(rows.map((row) => row.studentNumber));
  let sequence = rows.length + 1 + offset;
  while (used.has(`${prefix}${String(sequence).padStart(3, "0")}`)) sequence += 1;
  return `${prefix}${String(sequence).padStart(3, "0")}`;
}

const CreateSection = z.object({
  courseCode: z.string().min(2),
  courseTitle: z.string().min(2),
  credits: z.number().positive().default(3),
  sectionCode: z.string().min(2),
  instructorEmail: z.string().email(),
  termCode: z.string().default("2026F"),
});

const CreateEnrolment = z
  .object({
    studentEmail: z.string().email().optional(),
    studentId: z.string().uuid().optional(),
    sectionId: z.string().uuid(),
    postFee: z.boolean().optional().default(false),
  })
  .refine((b) => b.studentEmail || b.studentId, { message: "studentEmail or studentId is required", path: ["studentEmail"] });

const CreateBulkEnrolment = z.object({
  studentIds: z.array(z.string().uuid()).min(1, "Select at least one student").max(100),
  sectionId: z.string().uuid(),
  postFee: z.boolean().optional().default(false),
});

const CreateAssignment = z.object({
  sectionId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  maxScore: z.number().positive().max(10_000).default(100),
  weightPercent: z.number().positive().max(100).default(10),
  dueAt: z.string().datetime().optional(),
});

adminRouter.use(requireAuth, requireRoles("admin", "registrar"));
adminRouter.use("/super", superAdminRouter);
adminRouter.use("/heritage", heritageRouter);

/** Access-level module behind each legacy route: GET needs view, any other method needs edit. */
const LEGACY_PERMISSIONS: Array<[RegExp, PermissionModuleKey]> = [
  [/^\/users(\/|$)/, "userManagement"],
  [/^\/(sections|sections-lite|assignments)(\/|$)/, "courseManagement"],
  [/^\/(programs-lite|cohorts)(\/|$)/, "programManagement"],
  [/^\/curriculum(\/|$)/, "programManagement"],
  [/^\/(enrolments|students-lite|extracurricular|student-documents|retakes)(\/|$)/, "studentRecords"],
  [/^\/degree-scenarios(\/|$)/, "studentRecords"],
  [/^\/(financial-terms|finance|tax-documents)(\/|$)/, "financialManagement"],
  [/^\/mail-policy(\/|$)/, "emailMessaging"],
];

adminRouter.use(async (req, _res, next) => {
  const hit = LEGACY_PERMISSIONS.find(([pattern]) => pattern.test(req.path));
  if (!hit) return next();
  try {
    await assertPermission((req as AuthedRequest).user, hit[1], req.method === "GET" ? "view" : "edit");
    next();
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/campus-overview", async (req, res, next) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    const [overview, access] = await Promise.all([getCampusOverview(user.institutionId), effectiveAccess(user.institutionId, user.accountId)]);
    res.json(canView(access.permissions.userRequests) ? overview : { ...overview, pendingApprovals: 0, pendingGrades: 0 });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/users", async (req, res, next) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    const accounts = await prisma.account.findMany({
      where: { institutionId: user.institutionId },
      include: { person: true },
      orderBy: { email: "asc" },
    });
    const students = await prisma.student.findMany({ where: { institutionId: user.institutionId } });
    const byPerson = new Map(students.map((s) => [s.personId, s]));
    res.json({
      items: accounts.map((a) => ({
        accountId: a.id,
        personId: a.personId,
        email: a.email,
        givenName: a.person.givenName,
        familyName: a.person.familyName,
        roles: JSON.parse(a.rolesJson) as string[],
        status: a.status,
        studentNumber: byPerson.get(a.personId)?.studentNumber ?? null,
        programName: byPerson.get(a.personId)?.programName ?? null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/users", async (req, res, next) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    const body = CreateUser.parse(req.body);
    const access = await assertPermission(user, "userManagement", "edit");
    if ((body.role === "admin" || body.role === "registrar") && !access.administrator) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "Only administrators can create admin or registrar accounts" } });
      return;
    }
    const email = body.email.trim().toLowerCase();
    const existing = await prisma.account.findFirst({
      where: { institutionId: user.institutionId, email },
    });
    if (existing) {
      res.status(409).json({ error: { message: "Account already exists" } });
      return;
    }

    if (body.role === "student" && body.programName?.trim()) {
      body.programName = await knownProgramName(user.institutionId, body.programName);
    }

    const personId = randomUUID();
    const accountId = randomUUID();
    const passwordHash = await hashPassword(body.password);
    const role = body.role === "registrar" ? "registrar" : body.role;
    const portalHref =
      role === "instructor"
        ? "/instructor"
        : role === "student"
          ? "/student"
          : role === "applicant"
            ? "/applicant"
            : role === "employer"
              ? "/employer"
              : role === "admin" || role === "registrar"
                ? "/admin"
                : "/login";

    let studentNumber: string | null = null;
    let studentId: string | null = null;
    const requestedStudentNumber = body.studentNumber?.trim() || null;
    if (body.role === "student" && requestedStudentNumber) {
      const clash = await prisma.student.findFirst({ where: { institutionId: user.institutionId, studentNumber: requestedStudentNumber } });
      if (clash) throw Object.assign(new Error(`Student number ${requestedStudentNumber} is already in use`), { status: 409, code: "CONFLICT" });
    }
    const intake = body.role === "applicant"
      ? await prisma.term.findFirst({
          where: {
            institutionId: user.institutionId,
            ...(body.intakeTerm?.trim() ? { name: body.intakeTerm.trim() } : { endsOn: { gte: new Date().toISOString().slice(0, 10) } }),
          },
          orderBy: { startsOn: "asc" },
          select: { name: true },
        })
      : null;
    if (body.role === "applicant" && body.intakeTerm?.trim() && !intake) {
      throw Object.assign(new Error("The selected intake term does not exist"), { status: 400, code: "VALIDATION_ERROR" });
    }

    const create = async (generatedOffset: number) => prisma.$transaction(async (tx) => {
      await tx.person.create({
        data: {
          id: personId,
          institutionId: user.institutionId,
          givenName: body.givenName.trim(),
          familyName: body.familyName.trim(),
          email,
        },
      });
      await tx.account.create({
        data: {
          id: accountId,
          institutionId: user.institutionId,
          personId,
          email,
          passwordHash,
          status: "active",
          rolesJson: JSON.stringify([role]),
        },
      });

      if (role === "student") {
        studentNumber = requestedStudentNumber || await generatedStudentNumber(user.institutionId, generatedOffset);
        const student = await tx.student.create({
          data: {
            institutionId: user.institutionId,
            personId,
            studentNumber,
            programName: body.programName?.trim() || "General Studies",
            standing: "good",
          },
        });
        studentId = student.id;
      }

      if (role === "applicant") {
        await tx.admissionsApplication.create({
          data: {
            institutionId: user.institutionId,
            accountId,
            personId,
            programName: body.programName?.trim() || "General Studies",
            intakeTerm: intake?.name ?? "Not assigned",
            status: "draft",
            progressPct: 10,
            documents: {
              create: [
                { institutionId: user.institutionId, label: "Official transcript", status: "missing" },
              ],
            },
            timeline: {
              create: [
                {
                  institutionId: user.institutionId,
                  title: "Application started",
                  detail: "Account provisioned by campus admin",
                },
              ],
            },
          },
        });
      }

      if (role === "employer") {
        await tx.employerOrg.create({
          data: {
            institutionId: user.institutionId,
            accountId,
            name: body.programName?.trim() || `${body.givenName} ${body.familyName} Org`,
            siteName: "Primary practicum site",
            contactEmail: email,
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          institutionId: user.institutionId,
          actorId: user.accountId,
          eventName: "admin.user.create",
          purpose: "provision",
          afterJson: JSON.stringify({ email, role, accountId, portalHref }),
          source: "api",
          correlationId: randomUUID(),
        },
      });

      const loginHint =
        role === "student" && studentNumber
          ? `Sign in at /login with email ${email} or student number ${studentNumber}.`
          : `Sign in at /login with email ${email}.`;

      await tx.notification.create({
        data: {
          institutionId: user.institutionId,
          recipientAccountId: accountId,
          channel: "in_app",
          title: "Welcome to MyHeritage",
          body: `${loginHint} Temporary password was set by your administrator. Portal: ${portalHref}`,
          templateKey: "account.welcome",
        },
      });
    });
    const attempts = requestedStudentNumber ? 1 : 5;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        await create(attempt);
        break;
      } catch (error) {
        if (role !== "student" || requestedStudentNumber || !isUniqueConflict(error) || attempt === attempts - 1) throw error;
      }
    }

    try {
      const { sendMailViaHumanitix, mailConfigured } = await import("../../lib/mailer.js");
      if (mailConfigured()) {
        const web = (process.env.WEB_ORIGIN ?? "http://localhost:3000").split(",")[0];
        await sendMailViaHumanitix({
          email,
          title: "Welcome to MyHeritage",
          message: [
            `Hello ${body.givenName},`,
            "",
            `Your ${role} account is ready.`,
            `Sign in: ${web}/login`,
            `Email: ${email}`,
            studentNumber ? `Student number: ${studentNumber}` : "",
            `After sign-in you land on: ${web}${portalHref}`,
            "",
            "Use the temporary password your administrator shared with you.",
            "",
            "— MyHeritage",
          ]
            .filter(Boolean)
            .join("\n"),
        });
      }
    } catch (err) {
      console.error("welcome mail failed", err);
    }

    res.status(201).json({
      accountId,
      personId,
      email,
      role,
      studentId,
      studentNumber,
      portalHref,
      loginHint:
        role === "student" && studentNumber
          ? `Login at /login with ${email} or ${studentNumber} → ${portalHref}`
          : `Login at /login with ${email} → ${portalHref}`,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/sections", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const sections = await prisma.section.findMany({
      where: { institutionId: user.institutionId },
      include: { course: true, term: true, enrolments: { where: { status: { in: ["enrolled", "waitlisted"] } }, select: { status: true } } },
      orderBy: { code: "asc" },
    });
    const instructors = await prisma.person.findMany({
      where: { id: { in: [...new Set(sections.map((s) => s.instructorPersonId))] } },
    });
    const names = new Map(instructors.map((p) => [p.id, `${p.givenName} ${p.familyName}`]));
    const [settings, terms] = await Promise.all([settingsOf(user.institutionId, CM.session, sections.map((s) => s.id)), loadSectionTerms(user.institutionId, sections)]);
    res.json({
      items: sections.map((s) => {
        const rule = seatRule(settings.get(s.id)?.data);
        const term = terms.get(s.id);
        return {
          sectionId: s.id,
          code: s.code,
          courseCode: s.course.code,
          courseTitle: s.course.title,
          credits: s.course.credits,
          termCode: term?.code ?? "",
          termName: termLabel(term),
          instructorName: names.get(s.instructorPersonId) ?? "TBA",
          instructorPersonId: s.instructorPersonId,
          enrolmentCount: s.enrolments.filter((e) => e.status === "enrolled").length,
          waitlistCount: s.enrolments.filter((e) => e.status === "waitlisted").length,
          capacity: rule.capacity,
          waitlistEnabled: rule.waitlist,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/sections", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const body = CreateSection.parse(req.body);
    const instructor = await prisma.account.findFirst({
      where: { institutionId: user.institutionId, email: body.instructorEmail.toLowerCase() },
      include: { person: true },
    });
    if (!instructor) {
      res.status(404).json({ error: { message: "Instructor account not found. Create the teacher first." } });
      return;
    }
    const roles = JSON.parse(instructor.rolesJson) as string[];
    if (!roles.includes("instructor") && !roles.includes("admin")) {
      res.status(400).json({ error: { message: "Target account is not an instructor" } });
      return;
    }

    const existing = await prisma.section.findFirst({
      where: { institutionId: user.institutionId, code: body.sectionCode },
    });
    if (existing) {
      res.status(409).json({ error: { message: "Section code already exists" } });
      return;
    }

    const { section, course } = await prisma.$transaction(async (tx) => {
      let term = await tx.term.findFirst({
        where: { institutionId: user.institutionId, code: body.termCode },
      });
      if (!term) {
        term = await tx.term.create({
          data: {
            institutionId: user.institutionId,
            code: body.termCode,
            name: body.termCode,
            startsOn: "2026-09-01",
            endsOn: "2026-12-18",
          },
        });
      }
      let course = await tx.course.findFirst({
        where: { institutionId: user.institutionId, code: body.courseCode.toUpperCase() },
      });
      if (!course) {
        course = await tx.course.create({
          data: {
            institutionId: user.institutionId,
            code: body.courseCode.toUpperCase(),
            title: body.courseTitle,
            credits: body.credits,
          },
        });
      }
      const section = await tx.section.create({
        data: {
          institutionId: user.institutionId,
          courseId: course.id,
          termId: term.id,
          code: body.sectionCode,
          instructorPersonId: instructor.personId,
        },
      });
      await tx.auditEvent.create({
        data: {
          institutionId: user.institutionId,
          actorId: user.accountId,
          eventName: "Section.created",
          purpose: "admin_mutation",
          afterJson: JSON.stringify({ sectionId: section.id, code: section.code, courseCode: course.code, termCode: term.code, instructorPersonId: instructor.personId }),
          source: "admin.sections",
          correlationId: randomUUID(),
        },
      });
      return { section, course };
    });

    await prisma.notification.create({
      data: {
        institutionId: user.institutionId,
        recipientAccountId: instructor.id,
        channel: "in_app",
        title: `Section assigned · ${section.code}`,
        body: `You are teaching ${course.code} ${course.title}.`,
        templateKey: "section.assigned",
      },
    });

    res.status(201).json({
      sectionId: section.id,
      code: section.code,
      courseCode: course.code,
      instructorEmail: instructor.email,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete("/sections/:sectionId", async (req, res, next) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    const sectionId = String(req.params.sectionId || "");
    const section = await prisma.section.findFirst({
      where: { id: sectionId, institutionId: user.institutionId },
      include: { _count: { select: { enrolments: true } } },
    });
    if (!section) {
      res.status(404).json({ error: { message: "Section not found" } });
      return;
    }
    if (section._count.enrolments > 0) {
      res.status(409).json({
        error: { message: `Cannot delete section with ${section._count.enrolments} enrolment(s)` },
      });
      return;
    }
    await prisma.$transaction(async (tx) => {
      const assignments = await tx.assignment.findMany({
        where: { sectionId: section.id, institutionId: user.institutionId },
        select: { id: true },
      });
      const assignmentIds = assignments.map((a) => a.id);
      if (assignmentIds.length) {
        const submissions = await tx.submission.findMany({
          where: { assignmentId: { in: assignmentIds }, institutionId: user.institutionId },
          select: { id: true },
        });
        const submissionIds = submissions.map((s) => s.id);
        if (submissionIds.length) {
          await tx.fileObject.deleteMany({ where: { submissionId: { in: submissionIds }, institutionId: user.institutionId } });
          await tx.submission.deleteMany({ where: { id: { in: submissionIds } } });
        }
        await tx.gradeItem.deleteMany({ where: { assignmentId: { in: assignmentIds }, institutionId: user.institutionId } });
        await tx.assignment.deleteMany({ where: { id: { in: assignmentIds } } });
      }
      await tx.classSession.deleteMany({ where: { sectionId: section.id, institutionId: user.institutionId } });
      await tx.section.delete({ where: { id: section.id } });
      await tx.auditEvent.create({
        data: {
          institutionId: user.institutionId,
          actorId: user.accountId,
          eventName: "Section.deleted",
          purpose: "admin_mutation",
          afterJson: JSON.stringify({ sectionId: section.id, code: section.code }),
          source: "admin.sections",
          correlationId: randomUUID(),
        },
      });
    });
    res.json({ ok: true, sectionId: section.id, code: section.code });
  } catch (err) {
    next(err);
  }
});

async function enrolmentStudent(institutionId: string, by: { studentEmail?: string; studentId?: string }) {
  if (by.studentId) {
    const student = await prisma.student.findFirst({ where: { id: by.studentId, institutionId } });
    if (!student) throw Object.assign(new Error("Student not found"), { status: 404, code: "NOT_FOUND" });
    return student;
  }
  const email = (by.studentEmail ?? "").trim().toLowerCase();
  const account = await prisma.account.findFirst({ where: { institutionId, email } });
  const personId = account?.personId ?? (await prisma.person.findFirst({ where: { institutionId, email } }))?.id;
  if (!personId) throw Object.assign(new Error("Student account not found"), { status: 404, code: "NOT_FOUND" });
  const student = await prisma.student.findFirst({ where: { institutionId, personId } });
  if (!student) throw Object.assign(new Error("Student profile missing for account"), { status: 404, code: "NOT_FOUND" });
  return student;
}

adminRouter.get("/enrolments/quote", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const sectionId = String(req.query.sectionId ?? "");
    if (!z.string().uuid().safeParse(sectionId).success) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "sectionId is required" } });
      return;
    }
    const studentEmail = String(req.query.studentEmail ?? "").trim();
    const studentId = String(req.query.studentId ?? "").trim();
    const student = studentEmail || studentId ? await enrolmentStudent(user.institutionId, { studentEmail, studentId }).catch(() => null) : null;
    res.json(await quoteSectionFee(user.institutionId, sectionId, student?.id ?? null));
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/enrolments/students", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const students = await prisma.student.findMany({
      where: { institutionId: user.institutionId },
      include: { person: true },
      orderBy: [{ person: { familyName: "asc" } }, { person: { givenName: "asc" } }, { studentNumber: "asc" }],
    });
    res.json({
      items: students.map((student) => ({
        id: student.id,
        studentNumber: student.studentNumber,
        givenName: student.person.givenName,
        familyName: student.person.familyName,
        email: student.person.email,
        programName: student.programName,
      })),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/enrolments/section/:sectionId", async (req, res, next) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    const sectionId = z.string().uuid().parse(req.params.sectionId);
    const section = await prisma.section.findFirst({
      where: { id: sectionId, institutionId: user.institutionId },
      include: { course: true },
    });
    if (!section) throw Object.assign(new Error("Section not found"), { status: 404, code: "NOT_FOUND" });
    const enrolments = await prisma.enrolment.findMany({
      where: { institutionId: user.institutionId, sectionId, status: { in: ["enrolled", "waitlisted"] } },
      include: { student: { include: { person: true } } },
      orderBy: { createdAt: "desc" },
    });
    const latestByStudent = new Map<string, (typeof enrolments)[number]>();
    for (const enrolment of enrolments) if (!latestByStudent.has(enrolment.studentId)) latestByStudent.set(enrolment.studentId, enrolment);
    const items = [...latestByStudent.values()]
      .map((enrolment) => ({
        enrolmentId: enrolment.id,
        studentId: enrolment.studentId,
        studentNumber: enrolment.student.studentNumber,
        givenName: enrolment.student.person.givenName,
        familyName: enrolment.student.person.familyName,
        email: enrolment.student.person.email,
        programName: enrolment.student.programName,
        status: enrolment.status,
        enrolledAt: enrolment.createdAt.toISOString(),
      }))
      .sort((a, b) => a.status.localeCompare(b.status) || a.familyName.localeCompare(b.familyName) || a.givenName.localeCompare(b.givenName));
    res.json({
      section: { id: section.id, code: section.code, courseCode: section.course.code, courseTitle: section.course.title },
      counts: {
        enrolled: items.filter((item) => item.status === "enrolled").length,
        waitlisted: items.filter((item) => item.status === "waitlisted").length,
        total: items.length,
      },
      items,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/enrolments/bulk", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const body = CreateBulkEnrolment.parse(req.body);
    const studentIds = [...new Set(body.studentIds)];
    const students = await prisma.student.findMany({
      where: { institutionId: user.institutionId, id: { in: studentIds } },
      include: { person: true },
    });
    const byId = new Map(students.map((student) => [student.id, student]));
    const results: Array<Record<string, unknown>> = [];
    const failures: Array<Record<string, unknown>> = [];
    for (const studentId of studentIds) {
      const student = byId.get(studentId);
      if (!student) {
        failures.push({ studentId, code: "NOT_FOUND", message: "Student profile not found" });
        continue;
      }
      const studentName = `${student.person.givenName} ${student.person.familyName}`.trim();
      try {
        const result = await enrolInSection(user, {
          studentId,
          sectionId: body.sectionId,
          postFee: body.postFee,
          source: "admin.enrolments.bulk",
          skipExisting: true,
        });
        results.push({ ...result, studentName, studentNumber: student.studentNumber });
      } catch (err) {
        const issue = err as { code?: string; message?: string };
        failures.push({
          studentId,
          studentName,
          studentNumber: student.studentNumber,
          code: issue.code ?? "ENROL_FAILED",
          message: issue.message ?? "Enrolment failed",
        });
      }
    }
    res.status(201).json({
      results,
      failures,
      summary: {
        requested: studentIds.length,
        enrolled: results.filter((result) => result.status === "enrolled").length,
        waitlisted: results.filter((result) => result.status === "waitlisted").length,
        existing: results.filter((result) => result.status === "existing").length,
        failed: failures.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/enrolments", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const body = CreateEnrolment.parse(req.body);
    const student = await enrolmentStudent(user.institutionId, body);
    const result = await enrolInSection(user, {
      studentId: student.id,
      sectionId: body.sectionId,
      postFee: body.postFee,
      source: "admin.enrolments",
    });
    res.status(201).json({
      enrolmentId: result.enrolmentId,
      sectionId: result.sectionId,
      studentId: result.studentId,
      courseCode: result.courseCode,
      status: result.status,
      fee: result.fee,
      feeNote: result.feeNote,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/assignments", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const body = CreateAssignment.parse(req.body);
    const section = await prisma.section.findFirst({
      where: { id: body.sectionId, institutionId: user.institutionId },
    });
    if (!section) {
      res.status(404).json({ error: { message: "Section not found" } });
      return;
    }
    const assignment = await prisma.$transaction(async (tx) => {
      const created = await tx.assignment.create({
        data: {
          institutionId: user.institutionId,
          sectionId: body.sectionId,
          title: body.title,
          maxScore: body.maxScore,
          weightPercent: body.weightPercent,
          dueAt: body.dueAt ? new Date(body.dueAt) : null,
        },
      });
      await tx.auditEvent.create({
        data: {
          institutionId: user.institutionId,
          actorId: user.accountId,
          eventName: "Assignment.created",
          purpose: "admin_mutation",
          afterJson: JSON.stringify({ assignmentId: created.id, sectionId: created.sectionId, title: created.title, maxScore: created.maxScore, weightPercent: created.weightPercent }),
          source: "admin.assignments",
          correlationId: randomUUID(),
        },
      });
      return created;
    });
    res.status(201).json({ assignmentId: assignment.id, title: assignment.title, sectionId: assignment.sectionId });
  } catch (err) {
    next(err);
  }
});

const SisActionBody = z.object({
  path: z.string().min(1),
  action: z.string().min(1),
  rowKey: z.string().optional(),
  note: z.string().optional(),
});

adminRouter.get("/sis/screen", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const path = String(req.query.path ?? "").trim();
    if (!path.startsWith("/admin")) {
      res.status(400).json({ error: { message: "path must be an /admin route" } });
      return;
    }
    const view = await getSisScreen(user, path);
    res.json(view);
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/sis/action", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const body = SisActionBody.parse(req.body);
    if (!body.path.startsWith("/admin")) {
      res.status(400).json({ error: { message: "path must be an /admin route" } });
      return;
    }
    if (/\/admin\/f\/fn-|\/admin\/financ/i.test(body.path)) {
      await assertPermission(user, "financialManagement", "edit");
    }
    const view = await runSisAction(user, body);
    res.json(view);
  } catch (err) {
    next(err);
  }
});

// --- PART D registrar / finance / records gaps (live writes, no hardcoding) ---

adminRouter.get("/programs-lite", async (req, res, next) => {
  try {
    res.json(await listProgramsLite((req as AuthedRequest).user.institutionId));
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/students-lite", async (req, res, next) => {
  try {
    res.json(await listStudentsLite((req as AuthedRequest).user.institutionId));
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/sections-lite", async (req, res, next) => {
  try {
    res.json(await listSectionsLite((req as AuthedRequest).user.institutionId));
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/financial-terms", async (req, res, next) => {
  try {
    res.json(await listFinancialTerms((req as AuthedRequest).user.institutionId));
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/cohorts", async (req, res, next) => {
  try {
    res.json(await listCohorts((req as AuthedRequest).user.institutionId));
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/cohorts", async (req, res, next) => {
  try {
    const body = UpsertCohortBody.parse(req.body);
    const row = await upsertCohort((req as AuthedRequest).user, body);
    res.status(body.id ? 200 : 201).json(row);
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/cohorts/generate-plan", async (req, res, next) => {
  try {
    const body = GeneratePlanBody.parse(req.body);
    res.json(await generateProgramPlan((req as AuthedRequest).user, body));
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/finance/ledger", async (req, res, next) => {
  try {
    const studentId = typeof req.query.studentId === "string" ? req.query.studentId : undefined;
    res.json(await listLedger((req as AuthedRequest).user.institutionId, studentId));
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/finance/ledger", async (req, res, next) => {
  try {
    const body = LedgerPostBody.parse(req.body);
    const row = await postLedgerEntry((req as AuthedRequest).user, body);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/finance/ledger/adjust", async (req, res, next) => {
  try {
    const body = LedgerAdjustBody.parse(req.body);
    res.json(await adjustLedgerEntry((req as AuthedRequest).user, body));
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/tax-documents", async (req, res, next) => {
  try {
    res.json(await listTaxDocumentsAdmin((req as AuthedRequest).user.institutionId));
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/tax-documents/:id/pdf", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const { sendPdf } = await import("../../lib/taxPdf.js");
    const { pdf, filename } = await getAdminTaxPdf((req as unknown as AuthedRequest).user, id);
    sendPdf(res, pdf, filename);
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/tax-documents/generate", async (req, res, next) => {
  try {
    const body = GenerateTaxBody.parse(req.body);
    const row = await generateT2202((req as AuthedRequest).user, body);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/extracurricular", async (req, res, next) => {
  try {
    const studentId = typeof req.query.studentId === "string" ? req.query.studentId : undefined;
    res.json(await listExtracurricularAdmin((req as AuthedRequest).user.institutionId, studentId));
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/extracurricular", async (req, res, next) => {
  try {
    const body = ExtracurricularBody.parse(req.body);
    const row = await upsertExtracurricular((req as AuthedRequest).user, body);
    res.status(body.id ? 200 : 201).json(row);
  } catch (err) {
    next(err);
  }
});

adminRouter.delete("/extracurricular/:id", async (req, res, next) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    const id = z.string().uuid().parse(req.params.id);
    res.json(await deleteExtracurricular(user, id));
  } catch (err) {
    next(err);
  }
});

const CurriculumBody = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("version"), programId: z.string().uuid(), label: z.string().trim().min(1).max(120), effectiveOn: z.string().date(), totalCredits: z.number().min(0).max(300), status: z.string().trim().min(1).max(40).default("active") }),
  z.object({ kind: z.literal("requirement"), programVersionId: z.string().uuid(), courseId: z.string().uuid().nullable().optional(), courseCode: z.string().trim().min(1).max(30), title: z.string().trim().min(1).max(200), credits: z.number().min(0).max(60), requirementKind: z.enum(["required", "elective", "capstone"]).default("required"), sortOrder: z.number().int().min(0).max(10000).default(0) }),
  z.object({ kind: z.literal("prerequisite"), courseId: z.string().uuid(), requiredCourseId: z.string().uuid() }),
  z.object({ kind: z.literal("corequisite"), courseId: z.string().uuid(), requiredCourseId: z.string().uuid() }),
  z.object({ kind: z.literal("offering"), courseId: z.string().uuid(), termCode: z.string().trim().min(1).max(40), termName: z.string().trim().min(1).max(120), seatsOpen: z.number().int().min(0), seatsTotal: z.number().int().positive(), status: z.string().trim().min(1).max(40).default("published") }),
]);

adminRouter.get("/curriculum", async (req, res, next) => {
  try {
    const institutionId = (req as AuthedRequest).user.institutionId;
    const [programs, versions, courses, requirements, prerequisites, corequisites, offerings] = await Promise.all([
      prisma.program.findMany({ where: { institutionId }, orderBy: { name: "asc" } }),
      prisma.programVersion.findMany({ where: { institutionId }, include: { program: true }, orderBy: { effectiveOn: "desc" } }),
      prisma.course.findMany({ where: { institutionId }, orderBy: { code: "asc" } }),
      prisma.degreeRequirement.findMany({ where: { institutionId }, include: { programVersion: { include: { program: true } } }, orderBy: [{ programVersionId: "asc" }, { sortOrder: "asc" }] }),
      prisma.coursePrerequisite.findMany({ where: { institutionId }, include: { course: true, prerequisiteCourse: true } }),
      prisma.courseCorequisite.findMany({ where: { institutionId }, include: { course: true, corequisiteCourse: true } }),
      prisma.courseOffering.findMany({ where: { institutionId }, include: { course: true }, orderBy: { termCode: "desc" } }),
    ]);
    res.json({ programs, versions, courses, requirements, prerequisites, corequisites, offerings });
  } catch (err) { next(err); }
});

adminRouter.post("/curriculum", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const body = CurriculumBody.parse(req.body);
    const ownsCourse = async (id: string) => Boolean(await prisma.course.findFirst({ where: { id, institutionId: user.institutionId }, select: { id: true } }));
    let item: unknown;
    if (body.kind === "version") {
      const program = await prisma.program.findFirst({ where: { id: body.programId, institutionId: user.institutionId } });
      if (!program) throw Object.assign(new Error("Program not found"), { status: 400 });
      item = await prisma.programVersion.create({ data: { institutionId: user.institutionId, programId: body.programId, label: body.label, effectiveOn: body.effectiveOn, totalCredits: body.totalCredits, status: body.status } });
    } else if (body.kind === "requirement") {
      const version = await prisma.programVersion.findFirst({ where: { id: body.programVersionId, institutionId: user.institutionId } });
      if (!version || (body.courseId && !(await ownsCourse(body.courseId)))) throw Object.assign(new Error("Program version or course not found"), { status: 400 });
      item = await prisma.degreeRequirement.create({ data: { institutionId: user.institutionId, programVersionId: body.programVersionId, courseId: body.courseId ?? null, courseCode: body.courseCode, title: body.title, credits: body.credits, kind: body.requirementKind, sortOrder: body.sortOrder } });
    } else if (body.kind === "prerequisite") {
      if (body.courseId === body.requiredCourseId || !(await ownsCourse(body.courseId)) || !(await ownsCourse(body.requiredCourseId))) throw Object.assign(new Error("Select two different courses from this institution"), { status: 400 });
      item = await prisma.coursePrerequisite.create({ data: { institutionId: user.institutionId, courseId: body.courseId, prerequisiteCourseId: body.requiredCourseId } });
    } else if (body.kind === "corequisite") {
      if (body.courseId === body.requiredCourseId || !(await ownsCourse(body.courseId)) || !(await ownsCourse(body.requiredCourseId))) throw Object.assign(new Error("Select two different courses from this institution"), { status: 400 });
      item = await prisma.courseCorequisite.create({ data: { institutionId: user.institutionId, courseId: body.courseId, corequisiteCourseId: body.requiredCourseId } });
    } else {
      if (!(await ownsCourse(body.courseId)) || body.seatsOpen > body.seatsTotal) throw Object.assign(new Error("Course not found or open seats exceed total seats"), { status: 400 });
      item = await prisma.courseOffering.create({ data: { institutionId: user.institutionId, courseId: body.courseId, termCode: body.termCode, termName: body.termName, seatsOpen: body.seatsOpen, seatsTotal: body.seatsTotal, status: body.status } });
    }
    await prisma.auditEvent.create({ data: { institutionId: user.institutionId, actorId: user.accountId, eventName: `admin.curriculum.${body.kind}.create`, purpose: "curriculum_management", afterJson: JSON.stringify(item), source: "api", correlationId: randomUUID() } });
    res.status(201).json(item);
  } catch (err) { next(err); }
});

adminRouter.delete("/curriculum/:kind/:id", async (req, res, next) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    const id = z.string().uuid().parse(req.params.id);
    const kind = z.enum(["version", "requirement", "prerequisite", "corequisite", "offering"]).parse(req.params.kind);
    const where = { id, institutionId: user.institutionId };
    const result = kind === "version" ? await prisma.programVersion.deleteMany({ where }) : kind === "requirement" ? await prisma.degreeRequirement.deleteMany({ where }) : kind === "prerequisite" ? await prisma.coursePrerequisite.deleteMany({ where }) : kind === "corequisite" ? await prisma.courseCorequisite.deleteMany({ where }) : await prisma.courseOffering.deleteMany({ where });
    if (!result.count) throw Object.assign(new Error("Curriculum record not found"), { status: 404, code: "NOT_FOUND" });
    await prisma.auditEvent.create({ data: { institutionId: user.institutionId, actorId: user.accountId, eventName: `admin.curriculum.${kind}.delete`, purpose: "curriculum_management", afterJson: JSON.stringify({ id }), source: "api", correlationId: randomUUID() } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

adminRouter.get("/degree-scenarios", async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const rows = await prisma.degreePlanScenario.findMany({
      where: { institutionId: user.institutionId },
      include: { student: { include: { person: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    res.json({ items: rows.map((row) => ({ id: row.id, label: row.label, status: row.status, reviewNote: row.reviewNote, reviewedAt: row.reviewedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), studentId: row.studentId, studentNumber: row.student.studentNumber, studentName: `${row.student.person.givenName} ${row.student.person.familyName}`.trim(), assumptions: JSON.parse(row.assumptionsJson), result: JSON.parse(row.resultJson) })) });
  } catch (err) { next(err); }
});

adminRouter.patch("/degree-scenarios/:id/review", async (req, res, next) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    const id = z.string().uuid().parse(req.params.id);
    const body = z.object({ status: z.enum(["approved", "rejected"]), note: z.string().trim().min(3).max(2000) }).parse(req.body);
    const current = await prisma.degreePlanScenario.findFirst({ where: { id, institutionId: user.institutionId } });
    if (!current) throw Object.assign(new Error("Degree scenario not found"), { status: 404, code: "NOT_FOUND" });
    if (current.status !== "draft") throw Object.assign(new Error("This scenario has already been reviewed"), { status: 409, code: "CONFLICT" });
    const claimed = await prisma.degreePlanScenario.updateMany({ where: { id, institutionId: user.institutionId, status: "draft" }, data: { status: body.status, reviewNote: body.note, reviewedAt: new Date(), reviewedById: user.accountId, rowVersion: { increment: 1 } } });
    if (claimed.count !== 1) throw Object.assign(new Error("The scenario changed while reviewing it"), { status: 409, code: "CONFLICT" });
    res.json({ ok: true, id, status: body.status });
  } catch (err) { next(err); }
});

adminRouter.get("/student-documents", async (req, res, next) => {
  try {
    const studentId = typeof req.query.studentId === "string" ? req.query.studentId : undefined;
    res.json(await listStudentDocumentsAdmin((req as AuthedRequest).user.institutionId, studentId));
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/student-documents", async (req, res, next) => {
  try {
    const body = StudentDocumentBody.parse(req.body);
    const row = await upsertStudentDocument((req as AuthedRequest).user, body);
    res.status(body.id ? 200 : 201).json(row);
  } catch (err) {
    next(err);
  }
});

adminRouter.delete("/student-documents/:id", async (req, res, next) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    const id = z.string().uuid().parse(req.params.id);
    res.json(await deleteStudentDocument(user, id));
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/retakes", async (req, res, next) => {
  try {
    res.json(await listRetakes((req as AuthedRequest).user.institutionId));
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/retakes", async (req, res, next) => {
  try {
    const body = RetakeBody.parse(req.body);
    const row = await createRetake((req as AuthedRequest).user, body);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/mail-policy", async (req, res, next) => {
  try {
    res.json(await getMailPolicy((req as AuthedRequest).user.institutionId));
  } catch (err) {
    next(err);
  }
});

adminRouter.put("/mail-policy", async (req, res, next) => {
  try {
    const body = MailPolicyBody.parse(req.body);
    res.json(await updateMailPolicy((req as AuthedRequest).user, body));
  } catch (err) {
    next(err);
  }
});
