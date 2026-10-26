import { describe, expect, it, vi } from "vitest";

vi.mock("@myheritage/db", () => ({ prisma: {} }));

import { MOBILE_SCREENS, mobileScreenFor, todoRows } from "./mobileScreens.js";

describe("mobile screens", () => {
  it("gives every mobile screen a readable title instead of its code", () => {
    for (const [code, screen] of Object.entries(MOBILE_SCREENS)) {
      expect(screen.title).not.toMatch(/mb|\d/i);
      expect(mobileScreenFor(`/m/f/${code}`)).toBe(screen);
    }
    expect(mobileScreenFor("/m/f/mb-99-unknown")).toBeNull();
    expect(mobileScreenFor("/student/f/mb-03-student-todo")).toBeNull();
  });

  it("lists unsubmitted work and flags overdue and due-soon items", () => {
    const now = new Date("2026-10-07T12:00:00Z");
    const section = { id: "sec-1", course: { code: "PN101" } };
    const rows = todoRows(
      [
        { id: "a1", title: "Lab report", dueAt: new Date("2026-10-06T12:00:00Z"), section },
        { id: "a2", title: "Quiz", dueAt: new Date("2026-10-08T12:00:00Z"), section },
        { id: "a3", title: "Essay", dueAt: new Date("2026-10-20T12:00:00Z"), section },
        { id: "a4", title: "Submitted", dueAt: new Date("2026-10-09T12:00:00Z"), section },
      ],
      new Set(["a4"]),
      now,
    );
    expect(rows.map((r) => [r.primary, r.meta])).toEqual([
      ["PN101 · Lab report", "Overdue"],
      ["PN101 · Quiz", "Due soon"],
      ["PN101 · Essay", "Open"],
    ]);
  });
});
