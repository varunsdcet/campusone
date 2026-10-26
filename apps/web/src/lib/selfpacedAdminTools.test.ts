import { describe, expect, it } from "vitest";
import { adminRowsCsv, applicationsCsv, filterAdminRows, filterApplications, type SelfpacedApplication } from "./selfpacedAdminTools";

const rows: SelfpacedApplication[] = [
  { id: "app-1", _name: "Maya Singh", email: "maya@example.com", programName: "Pharmacy Assistant", intakeTerm: "Fall 2026", status: "under_review", progressPct: 80, _docs: "2/3 accepted" },
  { id: "app-2", _name: "Ethan Clark", email: "ethan@example.com", programName: "Office Administration", intakeTerm: "Winter 2027", status: "submitted", progressPct: 60, _docs: "1/2 accepted" },
];

describe("self-paced application tools", () => {
  it("combines search and exact dropdown filters", () => {
    expect(filterApplications(rows, { query: "maya", status: "under_review", program: "Pharmacy Assistant" })).toEqual([rows[0]]);
    expect(filterApplications(rows, { query: "maya", status: "submitted" })).toEqual([]);
  });

  it("exports the filtered application columns as escaped CSV", () => {
    const csv = applicationsCsv([{ ...rows[0], _name: 'Singh, "Maya"' }]);
    expect(csv).toContain('"Application ID","Applicant","Email"');
    expect(csv).toContain('"Singh, ""Maya"""');
    expect(csv).toContain('"under_review"');
  });
});

describe("self-paced admin table tools", () => {
  const columns = ["Student", "Enrolment", "Progress", "Access", "Last activity"];
  const enrolments = [
    ["HCC-24018 · Maya Singh", "Pharmacy Assistant · 2026-FA-A", "64%", "Active", "Today, 10:42"],
    ["HCC-23902 · Liam Martin", "Office Administration · 2026-FA", "18%", "Blocked", "Yesterday"],
  ];

  it("combines free-text search with an exact column filter", () => {
    expect(filterAdminRows(enrolments, { query: "maya", column: 3, value: "Active" })).toEqual([enrolments[0]]);
    expect(filterAdminRows(enrolments, { query: "maya", column: 3, value: "Blocked" })).toEqual([]);
  });

  it("exports exactly the supplied filtered rows", () => {
    const csv = adminRowsCsv(columns, [enrolments[0]]);
    expect(csv).toContain('"Student","Enrolment","Progress","Access","Last activity"');
    expect(csv).toContain('"HCC-24018 · Maya Singh"');
    expect(csv).not.toContain("Liam Martin");
  });
});
