import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  admissionsApplication: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  applicationTimelineEvent: { create: vi.fn() },
  notification: { create: vi.fn() },
}));

vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("@myheritage/events", () => ({ writeAuditAndOutbox: vi.fn() }));

import type { SessionClaims } from "@myheritage/contracts";
import {
  APPLICATION_FIELDS,
  applicationCompleteness,
  cleanApplicationForm,
  isGovernmentIdDocument,
  parseFormJson,
  REQUIRED_APPLICANT_DOCUMENTS,
} from "./applicationForm.js";
import { runApplicantAction } from "./applicant.service.js";

const now = new Date("2026-10-07T12:00:00Z");
const opts = { programs: ["Practical Nursing"], intakes: ["Winter 2027"] };

const complete = {
  givenName: "Ada",
  email: "ada@example.com",
  familyName: "Lovelace",
  dateOfBirth: "2000-05-01",
  gender: "Female",
  phone: "+1 604 555 0101",
  addressLine1: "1 Main St",
  city: "Vancouver",
  country: "Canada",
  residency: "Permanent resident",
  highestEducation: "Secondary school",
  institutionName: "Heritage Secondary",
  graduationYear: "2018",
  languageDocumentAcknowledgement: "Confirmed",
  programCategory: "Health",
  programName: "Practical Nursing",
  intakeTerm: "Winter 2027",
  campus: "Surrey",
  applicationAcknowledgement: "Confirmed",
};
const uploaded = ["Grade 10 Certificate / Transcript", "Grade 12 Certificate / Transcript", "Post-Secondary Education Document", "Language Proficiency Test Report"].map((label, index) => ({ label, status: index % 2 ? "accepted" : "uploaded" }));

describe("cleanApplicationForm", () => {
  it("accepts a partial save with blanks", () => {
    const out = cleanApplicationForm({ givenName: " Ada ", familyName: "" }, opts, {}, now);
    expect(out.errors).toEqual({});
    expect(out.values).toEqual({ givenName: "Ada", familyName: "" });
  });

  it("rejects malformed dates, years, phones and options not offered", () => {
    const out = cleanApplicationForm(
      { dateOfBirth: "2020-01-01", graduationYear: "3020", phone: "call me", programName: "Astronaut", campus: "Moon" },
      opts,
      {},
      now,
    );
    expect(Object.keys(out.errors).sort()).toEqual(["campus", "dateOfBirth", "graduationYear", "phone", "programName"]);
  });

  it("keeps a previously saved option that is no longer offered", () => {
    const out = cleanApplicationForm({ programName: "Retired Program" }, opts, { programName: "Retired Program" }, now);
    expect(out.errors).toEqual({});
  });
});

describe("applicationCompleteness", () => {
  it("is 100% only with every required field and document", () => {
    expect(applicationCompleteness(complete, uploaded)).toMatchObject({ pct: 100, missing: [] });
  });

  it("lists missing fields by section and missing or rejected documents", () => {
    const { givenName: _g, graduationYear: _y, ...partial } = complete;
    const out = applicationCompleteness(partial, uploaded.map((doc) => doc.label === "Language Proficiency Test Report" ? { ...doc, status: "rejected" } : doc));
    expect(out.missing).toEqual(["Personal details: First name", "Academic history: Year completed", "Document: Language Proficiency Test Report"]);
    expect(out.sections.program.done).toBe(true);
    expect(out.pct).toBeLessThan(100);
  });

  it("treats an application with no document checklist as missing the required documents", () => {
    expect(applicationCompleteness(complete, []).documentsMissing).toEqual(uploaded.map((doc) => doc.label));
  });

  it("never requires a passport or other government ID, even on an older checklist", () => {
    const older = [...uploaded, { label: "Passport", status: "missing" }];
    expect(applicationCompleteness(complete, older)).toMatchObject({ pct: 100, missing: [] });
    expect(REQUIRED_APPLICANT_DOCUMENTS.some(isGovernmentIdDocument)).toBe(false);
  });
});

describe("government ID fields", () => {
  it("does not offer or read back a SIN", () => {
    expect(APPLICATION_FIELDS.map((f) => f.key)).not.toContain("sin");
    expect(parseFormJson(JSON.stringify({ givenName: "Ada", sin: "000 000 000" }))).toEqual({ givenName: "Ada" });
    expect(cleanApplicationForm({ sin: "000 000 000" }, opts, {}, now).values).toEqual({});
  });
});

describe("submit_application", () => {
  const user = { accountId: "acc-1", institutionId: "inst-1", personId: "p-1", roles: ["applicant"] } as unknown as SessionClaims;
  const app = (overrides: Record<string, unknown> = {}) => ({
    id: "app-1",
    status: "draft",
    rowVersion: 2,
    progressPct: 40,
    programName: "Practical Nursing",
    intakeTerm: "Winter 2027",
    formJson: JSON.stringify(complete),
    documents: uploaded.map((d, i) => ({ id: `d-${i}`, fileName: null, ...d })),
    offers: [],
    timeline: [],
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    db.admissionsApplication.updateMany.mockResolvedValue({ count: 1 });
  });

  it("returns 400 APPLICATION_INCOMPLETE listing what is missing", async () => {
    db.admissionsApplication.findFirst.mockResolvedValue(
      app({ formJson: JSON.stringify({ givenName: "Ada" }), documents: [{ id: "d-0", label: "Grade 12 Certificate / Transcript", status: "missing", fileName: null }] }),
    );
    const err = await runApplicantAction(user, "submit_application").catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 400, code: "APPLICATION_INCOMPLETE" });
    expect((err as { missing: string[] }).missing).toContain("Document: Grade 12 Certificate / Transcript");
    expect((err as Error).message).toMatch(/^Complete these before submitting: Personal details: Last name/);
    expect(db.admissionsApplication.updateMany).not.toHaveBeenCalled();
  });

  it("submits a complete draft with a row-version guard", async () => {
    db.admissionsApplication.findFirst.mockResolvedValue(app());
    await expect(runApplicantAction(user, "submit_application")).resolves.toEqual({ ok: true, status: "submitted" });
    expect(db.admissionsApplication.updateMany.mock.calls[0]?.[0]?.where).toEqual({ id: "app-1", status: "draft", rowVersion: 2 });
  });

  it("refuses to submit twice", async () => {
    db.admissionsApplication.findFirst.mockResolvedValue(app({ status: "submitted" }));
    await expect(runApplicantAction(user, "submit_application")).rejects.toMatchObject({ status: 409 });
  });
});
