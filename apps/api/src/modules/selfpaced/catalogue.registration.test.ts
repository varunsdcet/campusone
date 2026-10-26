import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({
  person: { create: vi.fn() },
  account: { create: vi.fn() },
  student: { create: vi.fn() },
}));

const db = vi.hoisted(() => ({
  institution: { findFirst: vi.fn() },
  account: { findFirst: vi.fn() },
  person: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("@myheritage/auth", () => ({
  hashPassword: vi.fn(async () => "hashed-password"),
  validateInstitutionPassword: vi.fn(async () => undefined),
}));
vi.mock("@myheritage/events", () => ({ writeAuditAndOutbox: vi.fn() }));

import { registerSelfpacedLearner } from "./catalogue.service.js";

beforeEach(() => {
  vi.clearAllMocks();
  db.institution.findFirst.mockResolvedValue({ institutionId: "inst-1" });
  db.account.findFirst.mockResolvedValue(null);
  db.person.findFirst.mockResolvedValue(null);
  db.$transaction.mockImplementation(async (work: (client: typeof tx) => Promise<unknown>) => work(tx));
  tx.person.create.mockResolvedValue({ id: "person-1" });
  tx.account.create.mockResolvedValue({ id: "account-1" });
  tx.student.create.mockResolvedValue({ id: "student-1" });
});

describe("self-paced learner registration", () => {
  it("creates a student login without creating an admission application", async () => {
    const result = await registerSelfpacedLearner({ name: "Alex Morgan", email: "ALEX@example.com", password: "secure-pass-123" });

    expect(result).toEqual({ accepted: true, email: "alex@example.com" });
    expect(tx.person.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ institutionId: "inst-1", givenName: "Alex", familyName: "Morgan", email: "alex@example.com" }),
    });
    expect(tx.account.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ rolesJson: JSON.stringify(["student"]), status: "active", passwordHash: "hashed-password" }),
    });
    expect(tx.student.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ programName: "Self-paced eLearning", standing: "good" }),
    });
  });

  it("returns the same public response without replacing an existing Heritage account", async () => {
    db.account.findFirst.mockResolvedValue({ id: "existing-account" });
    await expect(registerSelfpacedLearner({ name: "Alex Morgan", email: "alex@example.com", password: "secure-pass-123" })).resolves.toEqual({ accepted: true, email: "alex@example.com" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
