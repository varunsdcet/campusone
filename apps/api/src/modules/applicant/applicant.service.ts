import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@myheritage/db";
import { ADMISSIONS_STAGE_PROGRESS, type SessionClaims } from "@myheritage/contracts";
import { writeAuditAndOutbox } from "@myheritage/events";
import { submissionStorageRoot } from "../../lib/submissionFiles.js";
import type { PortalRow, PortalView } from "../portal/portal.service.js";
import { listApplicationInterviews, safeInterviewMeetingUrl } from "../admissions/interviewAccess.js";
import {
  APPLICATION_FIELDS,
  applicationCompleteness,
  cleanApplicationForm,
  isGovernmentIdDocument,
  parseFormJson,
  REQUIRED_APPLICANT_DOCUMENTS,
  type FormOptions,
  type FormValues,
} from "./applicationForm.js";

function requireApplicant(user: SessionClaims) {
  if (!user.roles.includes("applicant")) {
    throw Object.assign(new Error("Forbidden"), { code: "FORBIDDEN", status: 403 });
  }
}

function httpError(message: string, code: string, status: number) {
  return Object.assign(new Error(message), { code, status });
}

const extensionByMime: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
};
const MAX_APPLICANT_FILE_BYTES = 10 * 1024 * 1024;

function decodeAndValidateApplicantFile(input: {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  contentBase64: string;
}) {
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    throw httpError("The selected file is empty (0 bytes). Choose a file that has content.", "VALIDATION_ERROR", 400);
  }
  if (input.sizeBytes > MAX_APPLICANT_FILE_BYTES) {
    throw httpError("Files must be 10 MB or smaller", "FILE_TOO_LARGE", 413);
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.contentBase64) || input.contentBase64.length % 4 !== 0) {
    throw httpError("File content is not valid base64", "VALIDATION_ERROR", 400);
  }
  if (path.basename(input.filename) !== input.filename || input.filename.includes("\0")) {
    throw httpError("Filename must not contain a path", "VALIDATION_ERROR", 400);
  }
  const allowedExtensions = extensionByMime[input.mimeType] ?? [];
  const extension = path.extname(input.filename).toLowerCase();
  if (!allowedExtensions.includes(extension)) {
    throw httpError(
      `File type not allowed. Allowed file types: ${Object.values(extensionByMime).flat().join(", ")}`,
      "VALIDATION_ERROR",
      400,
    );
  }

  const content = Buffer.from(input.contentBase64, "base64");
  if (content.byteLength !== input.sizeBytes) {
    throw httpError("Decoded file size does not match sizeBytes", "VALIDATION_ERROR", 400);
  }
  if (content.byteLength > MAX_APPLICANT_FILE_BYTES) {
    throw httpError("Files must be 10 MB or smaller", "FILE_TOO_LARGE", 413);
  }

  const startsWith = (...bytes: number[]) => bytes.every((byte, index) => content[index] === byte);
  const isZip = startsWith(0x50, 0x4b, 0x03, 0x04) || startsWith(0x50, 0x4b, 0x05, 0x06);
  const signatureValid =
    (input.mimeType === "application/pdf" && content.subarray(0, 5).toString() === "%PDF-") ||
    (input.mimeType === "image/png" && startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) ||
    (input.mimeType === "image/jpeg" && startsWith(0xff, 0xd8, 0xff)) ||
    (input.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && isZip) ||
    (input.mimeType === "application/msword" && startsWith(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1));

  if (!signatureValid) {
    throw httpError("File signature does not match the declared type", "VALIDATION_ERROR", 400);
  }
  return content;
}

async function applicationFor(user: SessionClaims) {
  return prisma.admissionsApplication.findFirst({
    where: { institutionId: user.institutionId, accountId: user.accountId },
    include: {
      documents: { orderBy: { label: "asc" } },
      offers: { where: { status: { notIn: ["draft", "withdrawn"] } }, orderBy: { createdAt: "desc" } },
      timeline: { orderBy: { occurredAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function addTimeline(applicationId: string, institutionId: string, title: string, detail?: string) {
  await prisma.applicationTimelineEvent.create({
    data: { institutionId, applicationId, title, detail },
  });
}

type LoadedApplication = NonNullable<Awaited<ReturnType<typeof applicationFor>>>;

/** Wizard answers, with the program/intake columns as the fallback for applications created by Admissions. */
function formValuesOf(app: Pick<LoadedApplication, "formJson" | "programName" | "intakeTerm">): FormValues {
  const values = parseFormJson(app.formJson);
  if (!values.programName && app.programName) values.programName = app.programName;
  if (!values.intakeTerm && app.intakeTerm) values.intakeTerm = app.intakeTerm;
  return values;
}

function completenessOf(app: LoadedApplication) {
  return applicationCompleteness(formValuesOf(app), app.documents);
}

async function formOptions(institutionId: string): Promise<FormOptions> {
  const today = new Date().toISOString().slice(0, 10);
  const [programs, terms] = await Promise.all([
    prisma.program.findMany({ where: { institutionId }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.term.findMany({ where: { institutionId, endsOn: { gte: today } }, select: { name: true }, orderBy: { startsOn: "asc" } }),
  ]);
  return { programs: [...new Set(programs.map((p) => p.name))], intakes: [...new Set(terms.map((t) => t.name))] };
}

async function formPayload(app: LoadedApplication, options: FormOptions) {
  const completeness = completenessOf(app);
  return {
    applicationId: app.id,
    status: app.status,
    editable: app.status === "draft",
    progressPct: completeness.pct,
    values: formValuesOf(app),
    fields: APPLICATION_FIELDS,
    options,
    completeness,
    documents: app.documents
      .filter((d) => !isGovernmentIdDocument(d.label))
      .map((d) => ({ id: d.id, label: d.label, status: d.status, fileName: d.fileName })),
  };
}

async function requireApplication(user: SessionClaims) {
  requireApplicant(user);
  const app = await applicationFor(user);
  if (!app) throw httpError("Application not found", "NOT_FOUND", 404);
  return app;
}

export async function getApplicationForm(user: SessionClaims) {
  const app = await requireApplication(user);
  return formPayload(app, await formOptions(user.institutionId));
}

export async function saveApplicationForm(user: SessionClaims, input: unknown) {
  let app = await requireApplication(user);
  if (app.status !== "draft") throw httpError("This application has been submitted and can no longer be edited", "CONFLICT", 409);
  const options = await formOptions(user.institutionId);
  const before = formValuesOf(app);
  const { values, errors } = cleanApplicationForm(input, options, before);
  const problems = Object.values(errors);
  if (problems.length) throw Object.assign(httpError(problems.join("; "), "VALIDATION_ERROR", 400), { fields: errors });
  const merged = { ...before, ...values };
  const missingChecklist = REQUIRED_APPLICANT_DOCUMENTS.filter((label) => !app.documents.some((document) => document.label === label));
  if (missingChecklist.length) {
    await prisma.applicationDocument.createMany({
      data: missingChecklist.map((label) => ({ institutionId: user.institutionId, applicationId: app.id, label, status: "missing" })),
    });
    app = await requireApplication(user);
  }
  const progressPct = applicationCompleteness(merged, app.documents).pct;
  await prisma.admissionsApplication.update({
    where: { id: app.id },
    data: {
      formJson: JSON.stringify(merged),
      progressPct,
      programName: merged.programName ?? app.programName,
      intakeTerm: merged.intakeTerm ?? app.intakeTerm,
      rowVersion: { increment: 1 },
    },
  });
  const person: Record<string, string | null> = {};
  if (merged.givenName) person.givenName = merged.givenName;
  if (merged.familyName) person.familyName = merged.familyName;
  if (merged.phone) person.phone = merged.phone;
  if (merged.dateOfBirth) person.dateOfBirth = merged.dateOfBirth;
  if (Object.keys(person).length) {
    await prisma.person.update({ where: { id: app.personId }, data: { ...person, rowVersion: { increment: 1 } } });
  }
  await writeAuditAndOutbox(prisma, {
    institutionId: user.institutionId,
    actorId: user.accountId,
    eventName: "ApplicantApplication.formSaved",
    purpose: "applicant_mutation",
    before: { applicationId: app.id, progressPct: app.progressPct },
    after: { applicationId: app.id, progressPct, fields: Object.keys(values) },
    source: "applicant.save_form",
    correlationId: randomUUID(),
    outboxPayload: { applicationId: app.id, progressPct },
  });
  const fresh = await applicationFor(user);
  return { ...(await formPayload(fresh!, options)), savedAt: new Date().toISOString() };
}

export async function buildApplicantView(user: SessionClaims, path: string): Promise<PortalView> {
  requireApplicant(user);
  const app = await applicationFor(user);
  const normalized = path.replace(/\/$/, "") || path;
  const base: PortalView = {
    path: normalized,
    title: "Applicant",
    subtitle: app ? `${app.programName} · ${app.intakeTerm}` : "Admissions portal",
    role: "applicant",
    active: "Home",
    breadcrumb: ["Applicant", "Home"],
    metrics: [
      { label: "Status", value: app?.status ?? "—" },
      { label: "Progress", value: app ? `${app.progressPct}%` : "—" },
      { label: "Documents", value: String(app?.documents.length ?? 0) },
    ],
    sections: [],
    actions: [
      { label: "Ask Heritage", href: "/applicant/ask", variant: "ai" },
      { label: "Search", href: "/applicant/search", variant: "secondary" },
    ],
    live: true,
  };

  if (!app) {
    base.sections = [{ title: "Application", rows: [{ primary: "No application yet", secondary: "Contact admissions" }] }];
    return base;
  }

  if (normalized === "/applicant" || normalized.endsWith("/applicant")) {
    base.title = "Applicant home";
    base.active = "Home";
    base.sections = [
      {
        title: "Next steps",
        rows: [
          {
            primary: app.programName,
            secondary: `Intake ${app.intakeTerm} · ${app.status.replace(/_/g, " ")}`,
            meta: `${app.progressPct}%`,
            href: "/applicant/application",
          },
          {
            primary: "Documents",
            secondary: `${app.documents.filter((d) => d.status === "uploaded" || d.status === "accepted").length}/${app.documents.length} ready`,
            meta: "Open",
            href: "/applicant/documents",
          },
          {
            primary: "Offers",
            secondary: app.offers[0] ? `${app.offers[0].title} · ${app.offers[0].status}` : "No offer yet",
            meta: app.offers[0]?.status ?? "—",
            href: "/applicant/offers",
          },
        ],
      },
      {
        title: "Recent timeline",
        rows: app.timeline.slice(0, 5).map((e) => ({
          primary: e.title,
          secondary: e.detail ?? undefined,
          meta: new Date(e.occurredAt).toLocaleDateString(),
          href: "/applicant/timeline",
        })),
      },
    ];
    base.actions = [
      ...(app.status === "draft"
        ? [{ label: "Submit application", action: "submit_application", variant: "primary" as const }]
        : []),
      { label: "Continue application", href: "/applicant/application" },
      { label: "Ask Heritage", href: "/applicant/ask", variant: "ai" },
    ];
    return base;
  }

  if (normalized.includes("/application") || normalized.includes("/ap-02") || normalized.includes("/ap-06") || normalized.includes("/ap-03") || normalized.includes("/ap-11")) {
    base.title = "Application";
    base.active = "Application";
    base.breadcrumb = ["Applicant", "Application"];
    const done = completenessOf(app);
    const step = (s: keyof typeof done.sections) => (done.sections[s].done ? "Done" : `${done.sections[s].missing.length} to complete`);
    const reqRows: PortalRow[] = [
      { primary: "Program", secondary: app.programName || "Not chosen yet", meta: app.intakeTerm || "—" },
      { primary: "Status", secondary: app.status.replace(/_/g, " "), meta: `${done.pct}% complete` },
      { primary: "Personal details", secondary: "Name, contact and residency", meta: step("personal") },
      { primary: "Academic history", secondary: "Highest education completed", meta: step("academic") },
      { primary: "Program choice", secondary: "Program, intake and study load", meta: step("program") },
      {
        primary: "Documents",
        secondary: done.documentsMissing.length ? `Missing: ${done.documentsMissing.join(", ")}` : "All required documents uploaded",
        meta: done.documentsMissing.length ? "Todo" : "Done",
        href: "/applicant/documents",
      },
    ];
    base.sections = [{ title: "Wizard steps", rows: reqRows }];
    base.actions = [
      ...(app.status === "draft"
        ? [
            { label: "Save progress", action: "save_progress", variant: "secondary" as const },
            { label: "Submit application", action: "submit_application", variant: "primary" as const },
          ]
        : [{ label: "View status", href: "/applicant/f/ap-06-application-status" }]),
      { label: "Upload documents", href: "/applicant/documents", variant: "secondary" },
      { label: "Ask Heritage", href: "/applicant/ask", variant: "ai" },
    ];
    return base;
  }

  if (normalized.includes("/documents") || normalized.includes("/ap-04")) {
    base.title = "Documents";
    base.active = "Documents";
    base.breadcrumb = ["Applicant", "Documents"];
    base.metrics = [
      { label: "Required", value: String(app.documents.length) },
      { label: "Uploaded", value: String(app.documents.filter((d) => d.status !== "missing").length) },
      { label: "Accepted", value: String(app.documents.filter((d) => d.status === "accepted").length) },
    ];
    base.sections = [
      {
        title: "Document packet",
        rows: app.documents.map((d) => ({
          primary: d.label,
          secondary: d.fileName ?? "Not uploaded",
          meta: d.status.replace(/_/g, " "),
        })),
      },
    ];
    const missing = app.documents.find((d) => d.status === "missing");
    base.actions = [
      ...(missing
        ? [{ label: `Upload ${missing.label}`, action: "upload_document", payload: { documentId: missing.id }, variant: "primary" as const }]
        : [{ label: "All documents uploaded", href: "/applicant/application", variant: "secondary" as const }]),
      { label: "Ask Heritage", href: "/applicant/ask", variant: "ai" },
    ];
    return base;
  }

  if (normalized.includes("/offers") || normalized.includes("/ap-07") || normalized.includes("/ap-08") || normalized.includes("/ap-09") || normalized.includes("/ap-10")) {
    base.title = "Offers";
    base.active = "Offers";
    base.breadcrumb = ["Applicant", "Offers"];
    base.sections = [
      {
        title: "Offer package",
        rows: app.offers.length
          ? app.offers.map((o) => ({
              primary: o.title,
              secondary: o.conditions ?? "Standard conditions",
              meta: `${o.status}${o.expiresOn ? ` · expires ${o.expiresOn}` : ""}`,
            }))
          : [{ primary: "No offer yet", secondary: "Admissions will notify you when a decision is ready" }],
      },
    ];
    const pending = app.offers.find((o) => o.status === "pending");
    base.actions = [
      ...(pending
        ? [
            { label: "Accept offer", action: "accept_offer", payload: { offerId: pending.id }, variant: "primary" as const },
            { label: "Decline offer", action: "decline_offer", payload: { offerId: pending.id }, variant: "secondary" as const },
          ]
        : []),
      { label: "Contract", href: "/applicant/f/ap-08-contract", variant: "secondary" },
      { label: "Payment", href: "/applicant/f/ap-10-payment", variant: "secondary" },
      { label: "Ask Heritage", href: "/applicant/ask", variant: "ai" },
    ];
    return base;
  }

  if (normalized.includes("/timeline")) {
    base.title = "Timeline";
    base.active = "Home";
    base.breadcrumb = ["Applicant", "Timeline"];
    base.sections = [
      {
        title: "Application timeline",
        rows: app.timeline.map((e) => ({
          primary: e.title,
          secondary: e.detail ?? undefined,
          meta: new Date(e.occurredAt).toLocaleString(),
        })),
      },
    ];
    base.actions = [
      { label: "Application", href: "/applicant/application" },
      { label: "Ask Heritage", href: "/applicant/ask", variant: "ai" },
    ];
    return base;
  }

  if (normalized.includes("/messages")) {
    base.title = "Messages";
    base.active = "Messages";
    base.breadcrumb = ["Applicant", "Messages"];
    const threads = await prisma.messageThread.findMany({
      where: {
        institutionId: user.institutionId,
        participantAccountIdsJson: { contains: user.accountId },
      },
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
    base.sections = [
      {
        title: "Admissions messages",
        rows: threads.length
          ? threads.map((t) => ({
              primary: t.subject,
              secondary: t.messages[0]?.body ?? "No messages yet",
              meta: t.messages[0] ? new Date(t.messages[0].createdAt).toLocaleString() : "",
            }))
          : [{ primary: "Welcome from Admissions", secondary: "Ask Heritage or reply after interview scheduling.", meta: "Info" }],
      },
    ];
    base.actions = [
      { label: "Ask Heritage", href: "/applicant/ask", variant: "ai" },
      { label: "Timeline", href: "/applicant/timeline", variant: "secondary" },
    ];
    return base;
  }

  if (normalized.includes("/notifications")) {
    base.title = "Notifications";
    base.active = "Home";
    base.breadcrumb = ["Applicant", "Notifications"];
    const notes = await prisma.notification.findMany({
      where: { institutionId: user.institutionId, recipientAccountId: user.accountId },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    base.sections = [
      {
        title: "Inbox",
        rows: notes.length
          ? notes.map((n) => ({
              primary: n.title,
              secondary: n.body,
              meta: `${n.readAt ? "Read" : "Unread"} · ${n.createdAt.toLocaleString()}`,
            }))
          : [{ primary: "No notifications yet", secondary: "Status and offer alerts will appear here." }],
      },
    ];
    base.actions = [
      { label: "Application", href: "/applicant/application", variant: "secondary" },
      { label: "Ask Heritage", href: "/applicant/ask", variant: "ai" },
    ];
    return base;
  }

  if (normalized.includes("/interview") || normalized.includes("/ap-05")) {
    const interviews = await listApplicationInterviews(user.institutionId, app.id);
    const current = interviews.find((row) => row.status === "Scheduled") ?? interviews[0];
    const meetingUrl = current?.status === "Scheduled" ? safeInterviewMeetingUrl(current.location) : null;
    base.title = "Interview";
    base.active = "Application";
    base.breadcrumb = ["Applicant", "Interview"];
    base.sections = [
      {
        title: "Interview workspace",
        rows: current
          ? [{
              primary: current.status === "Scheduled" ? "Interview scheduled" : `Interview ${current.status.toLowerCase()}`,
              secondary: `${current.scheduledAt.replace("T", " ")} · ${current.mode || "Mode to be confirmed"}`,
              meta: meetingUrl ? "Meeting link ready" : current.location || current.status,
            }]
          : [{
              primary: "Interview not yet scheduled",
              secondary: "Admissions will confirm time after document review",
              meta: app.status.replace(/_/g, " "),
            }],
      },
    ];
    base.actions = [
      ...(meetingUrl ? [{ label: "Join Interview", href: meetingUrl, variant: "primary" as const }] : []),
      { label: "Ask Heritage", href: "/applicant/ask", variant: "ai" },
    ];
    return base;
  }

  // Figma/other applicant screens — domain summary
  base.title = titleFromPath(normalized);
  base.breadcrumb = ["Applicant", base.title];
  base.sections = [
    {
      title: `${base.title} · live`,
      rows: [
        {
          primary: app.programName,
          secondary: `${app.status.replace(/_/g, " ")} · ${app.progressPct}%`,
          meta: app.intakeTerm,
          href: "/applicant",
        },
      ],
    },
  ];
  base.actions = [
    { label: "Home", href: "/applicant" },
    { label: "Ask Heritage", href: "/applicant/ask", variant: "ai" },
  ];
  return base;
}

function titleFromPath(path: string): string {
  const leaf = path.split("/").filter(Boolean).pop() ?? "Home";
  return leaf.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function runApplicantAction(
  user: SessionClaims,
  action: string,
  payload?: Record<string, unknown>,
) {
  requireApplicant(user);
  const app = await applicationFor(user);
  if (!app) throw Object.assign(new Error("Application not found"), { status: 404, code: "NOT_FOUND" });

  if (action === "save_progress") {
    const next = completenessOf(app).pct;
    await prisma.admissionsApplication.update({
      where: { id: app.id },
      data: { progressPct: next },
    });
    await addTimeline(app.id, user.institutionId, "Progress saved", `Application now ${next}% complete`);
    await writeAuditAndOutbox(prisma, {
      institutionId: user.institutionId,
      actorId: user.accountId,
      eventName: "ApplicantApplication.progressSaved",
      purpose: "applicant_mutation",
      before: { applicationId: app.id, progressPct: app.progressPct },
      after: { applicationId: app.id, progressPct: next },
      source: "applicant.save_progress",
      correlationId: randomUUID(),
      outboxPayload: { applicationId: app.id, progressPct: next },
    });
    return { ok: true, progressPct: next };
  }

  if (action === "submit_application") {
    if (app.status !== "draft") throw httpError("This application has already been submitted", "CONFLICT", 409);
    const done = completenessOf(app);
    if (done.missing.length) {
      throw Object.assign(httpError(`Complete these before submitting: ${done.missing.join("; ")}`, "APPLICATION_INCOMPLETE", 400), {
        missing: done.missing,
      });
    }
    const claimed = await prisma.admissionsApplication.updateMany({
      where: { id: app.id, status: "draft", rowVersion: app.rowVersion },
      data: { status: "submitted", progressPct: ADMISSIONS_STAGE_PROGRESS.submitted, submittedAt: new Date(), rowVersion: { increment: 1 } },
    });
    if (claimed.count !== 1) throw httpError("The application changed while submitting. Reload and try again.", "CONFLICT", 409);
    await addTimeline(app.id, user.institutionId, "Application submitted", "Packet sent to admissions review");
    await prisma.notification.create({
      data: {
        institutionId: user.institutionId,
        recipientAccountId: user.accountId,
        channel: "in_app",
        title: "Application submitted",
        body: `Your ${app.programName} application is under review.`,
        templateKey: "admissions.submitted",
      },
    });
    await writeAuditAndOutbox(prisma, {
      institutionId: user.institutionId,
      actorId: user.accountId,
      eventName: "ApplicantApplication.submitted",
      purpose: "applicant_mutation",
      before: { applicationId: app.id, status: app.status },
      after: { applicationId: app.id, status: "submitted", progressPct: ADMISSIONS_STAGE_PROGRESS.submitted },
      source: "applicant.submit_application",
      correlationId: randomUUID(),
      outboxPayload: { applicationId: app.id, status: "submitted" },
    });
    return { ok: true, status: "submitted" };
  }

  if (action === "upload_document") {
    if (app.status !== "draft") {
      throw httpError("Documents can only be uploaded while the application is a draft", "APPLICATION_LOCKED", 409);
    }
    const documentId = String(payload?.documentId ?? "");
    const filename = typeof payload?.filename === "string" ? payload.filename : "";
    const mimeType = typeof payload?.mimeType === "string" ? payload.mimeType : "";
    const sizeBytes = typeof payload?.sizeBytes === "number" ? payload.sizeBytes : Number(payload?.sizeBytes);
    const contentBase64 = typeof payload?.contentBase64 === "string" ? payload.contentBase64 : "";
    if (filename && (sizeBytes === 0 || (Number.isFinite(sizeBytes) && !contentBase64))) {
      throw httpError("The selected file is empty (0 bytes). Choose a file that has content.", "VALIDATION_ERROR", 400);
    }
    if (!documentId || !filename || !mimeType || !Number.isFinite(sizeBytes) || !contentBase64) {
      throw httpError(
        "Upload requires documentId, filename, mimeType, sizeBytes, and contentBase64",
        "BAD_REQUEST",
        400,
      );
    }

    const doc = app.documents.find((d) => d.id === documentId);
    if (!doc) throw httpError("Document not found", "NOT_FOUND", 404);

    const content = decodeAndValidateApplicantFile({
      filename,
      mimeType,
      sizeBytes,
      contentBase64,
    });

    const safeName = path.basename(filename);
    const relativePath = path.join(
      user.institutionId,
      "applicant",
      app.id,
      `${doc.id}-${safeName}`,
    );
    const storageRoot = submissionStorageRoot();
    const storedPath = path.resolve(storageRoot, relativePath);
    if (!storedPath.startsWith(`${storageRoot}${path.sep}`)) {
      throw httpError("Invalid storage path", "VALIDATION_ERROR", 400);
    }
    await mkdir(path.dirname(storedPath), { recursive: true });
    await writeFile(storedPath, content);

    await prisma.applicationDocument.update({
      where: { id: doc.id },
      data: { status: "uploaded", fileName: safeName },
    });
    await addTimeline(app.id, user.institutionId, "Document uploaded", doc.label);
    await writeAuditAndOutbox(prisma, {
      institutionId: user.institutionId,
      actorId: user.accountId,
      eventName: "ApplicantDocument.uploaded",
      purpose: "applicant_document",
      before: { documentId: doc.id, status: doc.status, fileName: doc.fileName },
      after: { documentId: doc.id, status: "uploaded", fileName: safeName, storedPath: relativePath },
      source: "applicant.upload_document",
      correlationId: randomUUID(),
      outboxPayload: { applicationId: app.id, documentId: doc.id },
    });
    if (app.status === "draft") {
      const docs = app.documents.map((d) => (d.id === doc.id ? { ...d, status: "uploaded" } : d));
      await prisma.admissionsApplication.update({
        where: { id: app.id },
        data: { progressPct: applicationCompleteness(formValuesOf(app), docs).pct },
      });
    }
    return { ok: true, documentId: doc.id, status: "uploaded", fileName: safeName };
  }

  if (action === "ready_interview") {
    throw httpError("Only Admissions staff can move an application to interview", "FORBIDDEN", 403);
  }

  if (action === "accept_offer" || action === "decline_offer") {
    const offerId = String(payload?.offerId ?? app.offers[0]?.id ?? "");
    const offer = app.offers.find((o) => o.id === offerId);
    if (!offer) throw Object.assign(new Error("Offer not found"), { status: 404, code: "NOT_FOUND" });
    const status = action === "accept_offer" ? "accepted" : "declined";
    await prisma.applicationOffer.update({ where: { id: offer.id }, data: { status } });
    await prisma.admissionsApplication.update({
      where: { id: app.id },
      data: { status, progressPct: status === "accepted" ? 100 : app.progressPct },
    });
    await addTimeline(
      app.id,
      user.institutionId,
      status === "accepted" ? "Offer accepted" : "Offer declined",
      offer.title,
    );
    await writeAuditAndOutbox(prisma, {
      institutionId: user.institutionId,
      actorId: user.accountId,
      eventName: status === "accepted" ? "ApplicantOffer.accepted" : "ApplicantOffer.declined",
      purpose: "applicant_mutation",
      before: { applicationId: app.id, offerId: offer.id, status: offer.status },
      after: { applicationId: app.id, offerId: offer.id, status },
      source: `applicant.${action}`,
      correlationId: randomUUID(),
      outboxPayload: { applicationId: app.id, offerId: offer.id, status },
    });
    return { ok: true, offerId: offer.id, status };
  }

  throw Object.assign(new Error(`Unknown action: ${action}`), { status: 400, code: "BAD_REQUEST" });
}
