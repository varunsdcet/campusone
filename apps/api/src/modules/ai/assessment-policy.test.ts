import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ assessmentAttempt: { findFirst: vi.fn() } }));
vi.mock("@myheritage/db", () => ({ prisma: db }));

import { hasOpenAssessmentAttempt } from "./assessment-policy.js";

describe("AI assessment lock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("enables the lock from a live server-side attempt", async () => {
    db.assessmentAttempt.findFirst.mockResolvedValue({ id: "attempt-1" });
    await expect(hasOpenAssessmentAttempt("institution-1", "student-1")).resolves.toBe(true);
    expect(db.assessmentAttempt.findFirst).toHaveBeenCalledWith({
      where: {
        institutionId: "institution-1",
        studentId: "student-1",
        status: "open",
        expiresAt: { gt: expect.any(Date) },
      },
      select: { id: true },
    });
  });

  it("leaves tutoring available when there is no live attempt", async () => {
    db.assessmentAttempt.findFirst.mockResolvedValue(null);
    await expect(hasOpenAssessmentAttempt("institution-1", "student-1")).resolves.toBe(false);
  });
});
