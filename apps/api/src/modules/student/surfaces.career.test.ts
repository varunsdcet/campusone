import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  student: { findFirst: vi.fn() },
  careerOpportunity: { findMany: vi.fn() },
}));

vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("../me/studentAlignment.js", () => ({
  assertNoActiveStudentHold: vi.fn(),
  currentStudentId: vi.fn().mockResolvedValue("student-1"),
}));

import { listStudentCareer } from "./surfaces.service.js";

const user = {
  accountId: "account-student",
  institutionId: "institution-1",
  personId: "person-student",
  email: "student@example.edu",
  roles: ["student"],
} as const;

describe("student career surface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.student.findFirst.mockResolvedValue({
      id: "student-1",
      institutionId: "institution-1",
      personId: "person-student",
      programName: "Computer Science",
    });
  });

  it("queries only open opportunities and removes the legacy Inbox fallback", async () => {
    db.careerOpportunity.findMany.mockResolvedValue([
      {
        id: "opportunity-legacy",
        title: "Junior Analyst",
        employerName: "Example Employer",
        skillsJson: '["SQL"]',
        programCodesJson: '["CS-DIP"]',
        status: "open",
        href: "/student/messages",
        updatedAt: new Date("2026-10-19T00:00:00.000Z"),
      },
      {
        id: "opportunity-external",
        title: "Support Associate",
        employerName: "Campus Technology",
        skillsJson: "[]",
        programCodesJson: "[]",
        status: "open",
        href: "https://jobs.example.edu/apply/42",
        updatedAt: new Date("2026-10-18T00:00:00.000Z"),
      },
    ]);

    const result = await listStudentCareer(user as never);

    expect(db.careerOpportunity.findMany).toHaveBeenCalledWith({
      where: { institutionId: "institution-1", status: "open" },
      orderBy: { updatedAt: "desc" },
      take: 40,
    });
    expect(result.opportunities).toEqual([
      expect.objectContaining({ id: "opportunity-legacy", status: "open", href: null }),
      expect.objectContaining({
        id: "opportunity-external",
        status: "open",
        href: "https://jobs.example.edu/apply/42",
      }),
    ]);
  });
});
