import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionClaims } from "@myheritage/contracts";

const db = vi.hoisted(() => ({
  recordFindFirst: vi.fn(), recordUpdate: vi.fn(), recordCreate: vi.fn(),
  sectionFindFirst: vi.fn(), classFindFirst: vi.fn(), classCreate: vi.fn(), classUpdate: vi.fn(),
}));

vi.mock("@myheritage/db", () => ({ prisma: {
  heritageRecord: { findFirst: db.recordFindFirst, update: db.recordUpdate, create: db.recordCreate },
  section: { findFirst: db.sectionFindFirst },
  classSession: { findFirst: db.classFindFirst, create: db.classCreate, update: db.classUpdate },
} }));

import { updateAssignedLabStatus } from "./lab-flow.service.js";

const user: SessionClaims = { institutionId: "inst-1", personId: "teacher-1", accountId: "account-1", roles: ["instructor"], sessionId: "session-1", sub: "account-1" };

describe("assigned lab workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.sectionFindFirst.mockResolvedValue({ id: "section-1", course: { code: "BIO101" } });
    db.classFindFirst.mockResolvedValue(null);
    db.classCreate.mockResolvedValue({ id: "class-session-1" });
    db.recordCreate.mockResolvedValue({ id: "link-1" });
  });

  it("lets only the assigned instructor start a scheduled lab and creates its canonical class session", async () => {
    db.recordFindFirst
      .mockResolvedValueOnce({ id: "11111111-1111-4111-8111-111111111111", dataJson: JSON.stringify({ title: "Biology practical", sectionId: "section-1", roomId: "", date: "2026-10-20", startTime: "09:00", endTime: "10:30", instructorId: "teacher-1", status: "Scheduled" }) })
      .mockResolvedValueOnce(null);
    db.recordUpdate.mockResolvedValue({});

    await expect(updateAssignedLabStatus(user, "11111111-1111-4111-8111-111111111111", "In Progress")).resolves.toMatchObject({ status: "In Progress" });
    expect(db.recordUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ dataJson: expect.stringContaining('"status":"In Progress"') }) }));
    expect(db.classCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sectionId: "section-1", sessionKind: "lab" }) }));
  });

  it("rejects a different instructor", async () => {
    db.recordFindFirst.mockResolvedValueOnce({ id: "11111111-1111-4111-8111-111111111111", dataJson: JSON.stringify({ instructorId: "teacher-2", status: "Scheduled" }) });
    await expect(updateAssignedLabStatus(user, "11111111-1111-4111-8111-111111111111", "In Progress")).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    expect(db.recordUpdate).not.toHaveBeenCalled();
  });
});
