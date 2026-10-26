import { describe, expect, it, vi } from "vitest";

vi.mock("@myheritage/db", () => ({ prisma: {} }));

import { isCourseStaffAccount } from "./courses.js";
import { sessionInstructorAccountIds } from "./courses.catalog.js";
import { SESSION_FIELDS } from "./courses.spec.js";

describe("Course session teachers", () => {
  it("exposes an explicit multiple-faculty control on the section form", () => {
    expect(SESSION_FIELDS.find((field) => field.key === "instructors")).toMatchObject({
      label: "Faculty Members (Multiple Select)",
      kind: "people",
      dflt: [],
    });
  });

  it("includes faculty and teacher accounts in the New Session people picker", () => {
    expect(isCourseStaffAccount('["faculty"]')).toBe(true);
    expect(isCourseStaffAccount('["teacher"]')).toBe(true);
    expect(isCourseStaffAccount('["instructor"]')).toBe(true);
    expect(isCourseStaffAccount('["admin"]')).toBe(true);
    expect(isCourseStaffAccount('["student"]')).toBe(false);
  });

  it("prefills the Section primary teacher when legacy settings have no instructors", () => {
    const lk = {
      users: [{ id: "account-1", label: "Teacher One" }],
      accountOfPerson: new Map([["person-1", "account-1"]]),
    };
    expect(sessionInstructorAccountIds(undefined, "person-1", lk)).toEqual(["account-1"]);
    expect(sessionInstructorAccountIds([], "person-1", lk)).toEqual(["account-1"]);
  });

  it("normalises legacy person ids and preserves saved account ids", () => {
    const lk = {
      users: [
        { id: "account-1", label: "Teacher One" },
        { id: "account-2", label: "Teacher Two" },
      ],
      accountOfPerson: new Map([["person-1", "account-1"]]),
    };
    expect(sessionInstructorAccountIds(["person-1", "account-2"], "", lk)).toEqual(["account-1", "account-2"]);
  });
});
