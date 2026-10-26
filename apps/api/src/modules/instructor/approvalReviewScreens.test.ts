import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@myheritage/db", () => ({ prisma: {} }));

import { buildCourseApprovalReview, buildGradeCorrectionReview } from "./approvalReviewScreens.js";

const institutionId = "00000000-0000-4000-8000-000000000004";
const sectionA = { id: "sec-a", code: "QAI1010A-01", courseCode: "QAI1010A", courseTitle: "QA_I_1010 Course A" };
const ctx = { user: { institutionId, accountId: "acct-instructor" }, sections: [sectionA] };

const db = {
  approvalRequest: { findMany: vi.fn() },
  gradeItem: { findMany: vi.fn() },
  account: { findMany: vi.fn() },
};

const request = {
  id: "req-1",
  type: "grade_publish",
  status: "rejected",
  subjectRef: "sec-a",
  createdAt: new Date("2026-10-05T17:00:00Z"),
  proposedDiffJson: JSON.stringify({ gradeItemIds: ["gi-1"] }),
  decisionsJson: JSON.stringify([{ actorId: "acct-reg", decision: "reject", comment: "Quiz 2 is out of 20", decidedAt: "2026-10-06T10:00:00Z" }]),
};

beforeEach(() => {
  vi.clearAllMocks();
  db.approvalRequest.findMany.mockResolvedValue([]);
  db.gradeItem.findMany.mockResolvedValue([]);
  db.account.findMany.mockResolvedValue([]);
});

describe("buildGradeCorrectionReview", () => {
  it("does not query approvals when the instructor teaches no sections", async () => {
    const screen = await buildGradeCorrectionReview({ ...ctx, sections: [] }, db as never);
    expect(db.approvalRequest.findMany).not.toHaveBeenCalled();
    expect(screen.syllabusDiff.current).toEqual([]);
    expect(screen.syllabusDiff).toHaveProperty("emptyMessage", expect.stringMatching(/./));
  });

  it("only reads grade approvals for the instructor's own sections", async () => {
    await buildGradeCorrectionReview(ctx, db as never);
    expect(db.approvalRequest.findMany.mock.calls[0]![0].where).toMatchObject({
      institutionId,
      subjectRef: { in: ["sec-a", "section:sec-a"] },
      type: { in: ["grade_publish", "grade.publish", "grade.correct"] },
    });
  });

  it("matches gradebook requests that reference the section as section:<id>", async () => {
    db.approvalRequest.findMany.mockResolvedValue([{ ...request, type: "grade.publish", status: "pending", subjectRef: "section:sec-a", decisionsJson: "[]" }]);
    const screen = await buildGradeCorrectionReview(ctx, db as never);
    expect(screen.subtitle).toBe("QAI1010A QAI1010A-01 · submitted 2026-10-05 · 1 pending");
    expect(screen.syllabusDiff.badge).toBe("Pending Review");
    expect(screen.syllabusDiff.current[0]).toEqual({ label: "Course", value: "QAI1010A QAI1010A-01 · QA_I_1010 Course A" });
  });

  it("shows the latest request's grades and the reviewer's comment", async () => {
    db.approvalRequest.findMany.mockResolvedValue([request]);
    db.gradeItem.findMany.mockResolvedValue([
      {
        id: "gi-1",
        score: 18,
        maxScore: 20,
        letter: "A",
        status: "draft",
        assignment: { title: "Quiz 2" },
        student: { studentNumber: "ST-1001", person: { givenName: "QA_I_1010", familyName: "Student1" } },
      },
    ]);
    db.account.findMany.mockResolvedValue([{ id: "acct-reg", email: "reg@heritage.test", person: { givenName: "Rita", familyName: "Registrar" } }]);
    const screen = await buildGradeCorrectionReview(ctx, db as never);
    expect(screen.title).toBe("Grade Correction Review");
    expect(screen.syllabusDiff.badge).toBe("Returned");
    expect(screen.syllabusDiff.proposed).toEqual([{ label: "QA_I_1010 Student1 · ST-1001", value: "Quiz 2: 18/20 (A)" }]);
    expect(screen.syllabusDiff.comments).toEqual([
      { author: "Rita Registrar", role: "Returned", when: "2026-10-06", body: "Quiz 2 is out of 20" },
    ]);
  });
});

describe("buildCourseApprovalReview", () => {
  it("reads only requests the instructor submitted and shows an empty state", async () => {
    const screen = await buildCourseApprovalReview(ctx, db as never);
    expect(db.approvalRequest.findMany.mock.calls[0]![0].where).toEqual({ institutionId, requestedBy: "acct-instructor" });
    expect(screen.title).toBe("Course Approval Review");
    expect(screen.syllabusDiff.proposed).toEqual([]);
  });

  it("lists every submitted request", async () => {
    db.approvalRequest.findMany.mockResolvedValue([request, { ...request, id: "req-0", status: "approved", subjectRef: "section:sec-a", decisionsJson: "[]" }]);
    const screen = await buildCourseApprovalReview(ctx, db as never);
    expect(screen.subtitle).toBe("2 requests · 0 pending");
    expect(screen.syllabusDiff.proposed.map((p) => p.value)).toEqual([
      "QAI1010A QAI1010A-01 · Returned",
      "QAI1010A QAI1010A-01 · Approved",
    ]);
  });
});
