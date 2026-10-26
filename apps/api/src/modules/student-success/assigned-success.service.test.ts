import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionClaims } from "@myheritage/contracts";

const db = vi.hoisted(() => ({
  caseFindMany: vi.fn(),
  appointmentFindMany: vi.fn(),
  personFindMany: vi.fn(),
}));

vi.mock("@myheritage/db", () => ({
  prisma: {
    successCase: { findMany: db.caseFindMany },
    advisingAppointment: { findMany: db.appointmentFindMany },
    person: { findMany: db.personFindMany },
  },
}));

import {
  assertAppointmentTransition,
  assertCaseTransition,
  listAssignedAppointments,
  listAssignedSuccessCases,
  listStudentSuccessCases,
} from "./assigned-success.service.js";

const user: SessionClaims = {
  institutionId: "institution-1",
  personId: "teacher-1",
  accountId: "account-1",
  roles: ["instructor"],
  sessionId: "session-1",
  sub: "account-1",
};

describe("assigned student success workflow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows the supported case lifecycle", () => {
    expect(() => assertCaseTransition("open", "in_progress")).not.toThrow();
    expect(() => assertCaseTransition("in_progress", "monitoring")).not.toThrow();
    expect(() => assertCaseTransition("monitoring", "resolved")).not.toThrow();
    expect(() => assertCaseTransition("resolved", "closed")).not.toThrow();
    expect(() => assertCaseTransition("closed", "open")).not.toThrow();
  });

  it("rejects invalid case jumps", () => {
    expect(() => assertCaseTransition("open", "closed")).toThrow(/cannot change/);
    expect(() => assertCaseTransition("closed", "resolved")).toThrow(/cannot change/);
  });

  it("allows only valid appointment outcomes", () => {
    expect(() => assertAppointmentTransition("requested", "confirmed")).not.toThrow();
    expect(() => assertAppointmentTransition("confirmed", "completed")).not.toThrow();
    expect(() => assertAppointmentTransition("confirmed", "no_show")).not.toThrow();
    expect(() => assertAppointmentTransition("completed", "confirmed")).toThrow(/cannot change/);
  });

  it("filters teacher cases and appointments by both institution and assigned person", async () => {
    db.caseFindMany.mockResolvedValue([]);
    db.appointmentFindMany.mockResolvedValue([]);

    await listAssignedSuccessCases(user);
    await listAssignedAppointments(user);

    expect(db.caseFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { institutionId: "institution-1", ownerPersonId: "teacher-1" },
    }));
    expect(db.appointmentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { institutionId: "institution-1", advisorPersonId: "teacher-1" },
    }));
  });

  it("filters the student view by the authenticated student's record", async () => {
    db.caseFindMany.mockResolvedValue([]);
    db.personFindMany.mockResolvedValue([]);

    await listStudentSuccessCases(user, "student-1");

    expect(db.caseFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { institutionId: "institution-1", studentId: "student-1" },
    }));
  });
});
