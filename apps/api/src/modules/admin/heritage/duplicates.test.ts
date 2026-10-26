import { describe, expect, it, vi } from "vitest";

vi.mock("@myheritage/db", () => ({ prisma: {} }));

import { sessionNameTaken } from "./courses.catalog.js";
import { uniqueClash } from "./programs.js";

const scheduleDef = { unique: [{ key: "abbreviation", label: "Schedule Abbreviation", scope: "all" as const, within: "program" }] };
const existing = [{ id: "r-1", contextKey: "", data: { program: "PN", abbreviation: "PN-W27" } }];

describe("master schedule abbreviation", () => {
  it("is unique per program, case-insensitively", () => {
    expect(uniqueClash(scheduleDef, existing, { program: "PN", abbreviation: "pn-w27" }, "")).toBe('Schedule Abbreviation "pn-w27" is already in use here');
  });

  it("may repeat under a different program", () => {
    expect(uniqueClash(scheduleDef, existing, { program: "HCA", abbreviation: "PN-W27" }, "")).toBeNull();
  });

  it("does not clash with the record being edited", () => {
    expect(uniqueClash(scheduleDef, existing, { program: "PN", abbreviation: "PN-W27" }, "", "r-1")).toBeNull();
  });
});

describe("session name", () => {
  const siblings = [{ data: { name: "Winter 2027 Day" } }, { data: { name: "Evening" } }];

  it("matches trimmed and case-insensitively", () => {
    expect(sessionNameTaken("  winter 2027 day ", siblings)).toBe(true);
  });

  it("allows new and blank names", () => {
    expect(sessionNameTaken("Weekend", siblings)).toBe(false);
    expect(sessionNameTaken("", siblings)).toBe(false);
  });
});
