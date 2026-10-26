import { describe, expect, it } from "vitest";
import { bodyOf, defaultsFromEntries, initialValues } from "./formValues";
import { buildStatusTree } from "./statusTree";

const fields = [
  { key: "parent", label: "Parent Status", kind: "ref", ref: "studentStatuses" },
  { key: "name", label: "Status Name", kind: "text", required: true },
  { key: "description", label: "Status Description", kind: "text" },
];

describe("student status form values", () => {
  it("hydrates the saved parent and description when editing", () => {
    expect(initialValues(fields, { id: "child", parent: "parent-1", name: "CLOA", description: "Conditional letter issued" })).toEqual({
      parent: "parent-1",
      name: "CLOA",
      description: "Conditional letter issued",
    });
  });

  it("keeps the selected parent and description in the submit body", () => {
    expect(bodyOf({ parent: "parent-1", name: "CLOA", description: "Conditional letter issued" })).toMatchObject({
      parent: "parent-1",
      description: "Conditional letter issued",
    });
  });

  it("prefills the parent from an Add Sub-Status link", () => {
    const defaults = defaultsFromEntries(new URLSearchParams("d.parent=parent-1&ignored=value").entries());
    expect(initialValues(fields, defaults)).toMatchObject({ parent: "parent-1" });
  });
});

describe("student status search", () => {
  const rows = [
    { id: "parent-1", name: "New Inquiry", description: "Lead status", parent: "" },
    { id: "child-1", name: "QA Tuition Test 02", description: "Tuition follow-up", parent: "parent-1" },
    { id: "orphan", name: "Imported Status", description: "Missing old parent", parent: "deleted-parent" },
  ];

  it("keeps a matching sub-status visible beneath its parent", () => {
    expect(buildStatusTree(rows, "QA Tuition")).toEqual([{ row: rows[0], children: [rows[1]] }]);
  });

  it("does not hide an orphaned status record", () => {
    expect(buildStatusTree(rows, "Imported")).toEqual([{ row: rows[2], children: [] }]);
  });
});
