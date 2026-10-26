import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({
  person: { create: vi.fn() },
  account: { create: vi.fn() },
  admissionsApplication: { create: vi.fn() },
}));

const db = vi.hoisted(() => ({
  institution: { findFirst: vi.fn() },
  account: { findFirst: vi.fn() },
  person: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

const events = vi.hoisted(() => ({ writeAuditAndOutbox: vi.fn() }));

vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("@myheritage/events", () => events);
vi.mock("@myheritage/auth", () => ({ hashPassword: vi.fn(async () => "hashed") }));

import { registerApplicant } from "./apply.js";
import { REQUIRED_APPLICANT_DOCUMENTS } from "../applicant/applicationForm.js";

const body = { givenName: "Ada", familyName: "Lovelace", email: "Ada@Example.com ", password: "correct-horse" };

beforeEach(() => {
  vi.clearAllMocks();
  db.institution.findFirst.mockResolvedValue({ institutionId: "inst-1" });
  db.account.findFirst.mockResolvedValue(null);
  db.person.findFirst.mockResolvedValue(null);
  db.$transaction.mockImplementation(async (work: (client: typeof tx) => Promise<unknown>) => work(tx));
  tx.person.create.mockResolvedValue({ id: "p-1" });
  tx.account.create.mockResolvedValue({ id: "a-1" });
  tx.admissionsApplication.create.mockResolvedValue({ id: "app-1" });
});

describe("registerApplicant", () => {
  it("creates an applicant-only account with a draft application", async () => {
    await expect(registerApplicant(body)).resolves.toMatchObject({ ok: true, accountId: "a-1", applicationId: "app-1", email: "ada@example.com" });
    const account = tx.account.create.mock.calls[0]?.[0]?.data;
    expect(JSON.parse(account.rolesJson)).toEqual(["applicant"]);
    expect(account.passwordHash).toBe("hashed");
    const app = tx.admissionsApplication.create.mock.calls[0]?.[0]?.data;
    expect(app.status).toBe("draft");
    expect(app.documents.create.map((d: { label: string }) => d.label)).toEqual(REQUIRED_APPLICANT_DOCUMENTS);
    expect(events.writeAuditAndOutbox).toHaveBeenCalledOnce();
  });

  it("ignores any role the caller tries to supply", async () => {
    await registerApplicant({ ...body, roles: ["admin"], rolesJson: '["admin"]' });
    expect(JSON.parse(tx.account.create.mock.calls[0]?.[0]?.data.rolesJson)).toEqual(["applicant"]);
  });

  it("refuses an existing e-mail with a generic message", async () => {
    db.account.findFirst.mockResolvedValue({ id: "existing" });
    const err = await registerApplicant(body).catch((e: Error) => e);
    expect(err).toMatchObject({ status: 409, code: "APPLY_REFUSED" });
    expect((err as Error).message).not.toMatch(/exist|taken|registered/i);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("maps a concurrent unique violation to the same generic refusal", async () => {
    db.$transaction.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    await expect(registerApplicant(body)).rejects.toMatchObject({ status: 409, code: "APPLY_REFUSED" });
  });

  it.each([
    [{ ...body, password: "short" }, "Password must be at least 8 characters."],
    [{ ...body, email: "nope" }, "Enter a valid email address."],
    [{ ...body, givenName: " " }, "Enter your first and last name."],
  ])("returns a readable 400 for %#", async (input, message) => {
    await expect(registerApplicant(input)).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR", message });
  });
});
