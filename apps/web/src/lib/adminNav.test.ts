import { describe, expect, it } from "vitest";
import { ADMIN_SIDEBAR, adminChildActive } from "./adminNav";

const items = ADMIN_SIDEBAR.flatMap((entry) => entry.type === "item" ? [entry.item] : []);
const children = items.flatMap((item) => item.children ?? []);

describe("admin navigation integrity", () => {
  it("uses live count keys instead of hard-coded numeric badges", () => {
    const counts = [...items.map((item) => item.count), ...children.map((child) => child.count)].filter(Boolean);
    expect(counts.length).toBeGreaterThan(0);
    expect(counts.every((count) => !/^\d+$/.test(count!))).toBe(true);
  });

  it("does not expose mutation entry points to view-only users", () => {
    expect(children.find((child) => child.label === "Create Student Profile")?.gate).toEqual({ modules: ["studentRecords"], edit: true });
    expect(children.find((child) => child.label === "Create New User")?.gate).toEqual({ modules: ["userManagement"], edit: true });
  });

  it("gates the mail module and distinguishes query-filtered siblings", () => {
    expect(items.find((item) => item.label === "My E-mail / Messages")?.gate).toEqual({ modules: ["emailMessaging"] });
    const students = items.find((item) => item.label === "Students")?.children ?? [];
    const active = students.find((child) => child.label === "Active Student")!;
    const graduated = students.find((child) => child.label === "Graduated")!;
    expect(adminChildActive("/admin/student-management/browse", active, students, "f.status=Active+Student")).toBe(true);
    expect(adminChildActive("/admin/student-management/browse", graduated, students, "f.status=Active+Student")).toBe(false);
  });
});
