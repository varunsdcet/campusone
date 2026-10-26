import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiRequestContext } from "@myheritage/contracts";

const db = vi.hoisted(() => ({
  student: { findFirst: vi.fn() },
  enrolment: { findFirst: vi.fn() },
}));
const faculty = vi.hoisted(() => ({ sectionIds: vi.fn() }));
const success = vi.hoisted(() => ({ signals: vi.fn() }));

vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("../instructor/sectionFaculty.js", () => ({ facultySectionIds: faculty.sectionIds }));
vi.mock("./success.service.js", () => ({ getStudentSuccessSignals: success.signals }));
vi.mock("../admin/superAdmin.service.js", () => ({ assertPermission: vi.fn() }));

import { executeAiTool } from "./tool-executor.js";

const instructorCtx: AiRequestContext = {
  accountId: "00000000-0000-4000-8000-000000000001",
  personId: "00000000-0000-4000-8000-000000000002",
  institutionId: "00000000-0000-4000-8000-000000000003",
  sessionId: "00000000-0000-4000-8000-000000000004",
  roles: ["instructor"],
  capability: "intervention_assistant",
  assessmentAttemptOpen: false,
};
const studentId = "00000000-0000-4000-8000-000000000005";

describe("AI student-scope authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.student.findFirst.mockResolvedValue({ id: studentId, personId: "person-student" });
    faculty.sectionIds.mockResolvedValue(new Set(["section-owned"]));
    success.signals.mockResolvedValue({ level: "watch", signals: [] });
  });

  it("rejects an instructor targeting a student outside assigned sections", async () => {
    db.enrolment.findFirst.mockResolvedValue(null);

    await expect(
      executeAiTool("get_student_success_signals", instructorCtx, { studentId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    expect(success.signals).not.toHaveBeenCalled();
  });

  it("allows an instructor targeting a student in an assigned section", async () => {
    db.enrolment.findFirst.mockResolvedValue({ id: "enrolment-1" });

    await executeAiTool("get_student_success_signals", instructorCtx, { studentId });

    expect(db.enrolment.findFirst).toHaveBeenCalledWith({
      where: {
        institutionId: instructorCtx.institutionId,
        studentId,
        sectionId: { in: ["section-owned"] },
        status: { not: "withdrawn" },
      },
      select: { id: true },
    });
    expect(success.signals).toHaveBeenCalledWith({
      institutionId: instructorCtx.institutionId,
      studentId,
    });
  });
});
