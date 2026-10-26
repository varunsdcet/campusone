import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionClaims } from "@myheritage/contracts";

const db = vi.hoisted(() => ({ recordFindMany: vi.fn(), applicationFindMany: vi.fn(), personFindMany: vi.fn(), placementFindMany: vi.fn(), studentFindMany: vi.fn() }));
const assigned = vi.hoisted(() => ({ cases: vi.fn(), appointments: vi.fn(), leads: vi.fn(), interviews: vi.fn() }));

vi.mock("@myheritage/db", () => ({ prisma: {
  heritageRecord: { findMany: db.recordFindMany }, admissionsApplication: { findMany: db.applicationFindMany }, person: { findMany: db.personFindMany }, placement: { findMany: db.placementFindMany }, student: { findMany: db.studentFindMany },
} }));
vi.mock("../student-success/assigned-success.service.js", () => ({ listAssignedSuccessCases: assigned.cases, listAssignedAppointments: assigned.appointments }));
vi.mock("./assigned-crm.service.js", () => ({ listAssignedCrmLeads: assigned.leads }));
vi.mock("../admissions/interviewAccess.js", () => ({ listInterviewerInterviews: assigned.interviews, safeInterviewMeetingUrl: (value: string) => value.startsWith("https://") ? value : null }));
vi.mock("../labs/lab-flow.service.js", () => ({ syncExistingLabSessions: vi.fn() }));

import { listAssignedWork } from "./assigned-work.service.js";

const user: SessionClaims = { institutionId: "institution-1", personId: "teacher-1", accountId: "account-1", roles: ["instructor"], sessionId: "session-1", sub: "account-1" };

describe("cross-module assigned work", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assigned.cases.mockResolvedValue([]);
    assigned.appointments.mockResolvedValue([]);
    assigned.leads.mockResolvedValue([]);
    assigned.interviews.mockResolvedValue([]);
    db.applicationFindMany.mockResolvedValue([]);
    db.personFindMany.mockResolvedValue([]);
    db.placementFindMany.mockResolvedValue([]);
    db.studentFindMany.mockResolvedValue([]);
  });

  it("uses tenant scoping and returns only records assigned to the authenticated person", async () => {
    db.recordFindMany.mockResolvedValue([
      { id: "lab-1", screenId: "OPS:LB_SESSION", dataJson: JSON.stringify({ title: "Chemistry Lab", instructorId: "teacher-1", status: "Scheduled", date: "2026-10-20" }), updatedAt: new Date("2026-10-16T10:00:00Z") },
      { id: "lab-2", screenId: "OPS:LB_SESSION", dataJson: JSON.stringify({ title: "Other Lab", instructorId: "teacher-2", status: "Scheduled", date: "2026-10-20" }), updatedAt: new Date("2026-10-16T10:00:00Z") },
      { id: "ticket-1", screenId: "OPS:WS_TICKET", dataJson: JSON.stringify({ subject: "Reset access", assigneeId: "teacher-1", status: "Open" }), updatedAt: new Date("2026-10-16T11:00:00Z") },
    ]);

    const result = await listAssignedWork(user);

    expect(db.recordFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ institutionId: "institution-1", deletedAt: null }) }));
    expect(result.map((item) => item.id)).toEqual(["ticket-1", "lab-1"]);
    expect(result.find((item) => item.id === "lab-1")).toMatchObject({
      category: "Labs",
      title: "Chemistry Lab",
      availableActions: [
        { key: "In Progress", label: "Start Lab" },
        { key: "Completed", label: "Complete" },
        { key: "Cancelled", label: "Cancel" },
      ],
    });
  });

  it("shows assigned practicum work with real hour and evaluation actions", async () => {
    db.recordFindMany.mockResolvedValue([]);
    db.placementFindMany.mockResolvedValue([{ id: "placement-1", studentName: "Priya Sandhu", programName: "Nursing", status: "active", startsOn: "2026-10-20", endsOn: "2026-12-20", updatedAt: new Date("2026-10-17T08:00:00Z"), employerOrg: { name: "Heritage Clinic", siteName: "Main Site" }, hours: [{ id: "hours-1", hours: 8 }], evaluations: [{ id: "eval-1" }] }]);

    const result = await listAssignedWork(user);

    expect(db.placementFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ institutionId: user.institutionId, supervisorPersonId: user.personId }) }));
    expect(result[0]).toMatchObject({
      id: "placement-1",
      category: "Practicum",
      availableActions: [
        { key: "approve_hours:hours-1", label: "Approve 8h" },
        { key: "reject_hours:hours-1", label: "Reject 8h" },
        { key: "submit_evaluation:eval-1", label: "Submit Evaluation" },
      ],
    });
  });

  it("shows compliance assignments with student and programme labels instead of raw ids", async () => {
    db.recordFindMany.mockResolvedValue([
      { id: "hold-1", screenId: "OPS:CP_HOLD", dataJson: JSON.stringify({ matter: "Records preservation", studentId: "student-1", custodianId: "teacher-1", scope: "Academic record", status: "Active", placedOn: "2026-10-19" }), updatedAt: new Date("2026-10-19T08:00:00Z") },
      { id: "evidence-1", screenId: "OPS:CP_EVIDENCE", dataJson: JSON.stringify({ title: "Faculty matrix", programId: "program-1", ownerId: "teacher-1", standard: "PTIB 4.2", status: "Needed" }), updatedAt: new Date("2026-10-19T09:00:00Z") },
      { id: "program-1", screenId: "PM:PROGRAM", dataJson: JSON.stringify({ name: "Nursing Diploma" }), updatedAt: new Date("2026-10-19T07:00:00Z") },
    ]);
    db.studentFindMany.mockResolvedValue([{ id: "student-1", person: { givenName: "Priya", familyName: "Sandhu" } }]);

    const result = await listAssignedWork(user);

    expect(result.find((item) => item.id === "hold-1")).toMatchObject({
      category: "Compliance",
      subtitle: "Priya Sandhu · Academic record",
    });
    expect(result.find((item) => item.id === "evidence-1")).toMatchObject({
      category: "Compliance",
      subtitle: "Nursing Diploma · PTIB 4.2",
    });
    expect(JSON.stringify(result)).not.toContain("teacher-1");
    expect(JSON.stringify(result)).not.toContain("student-1");
  });
});
