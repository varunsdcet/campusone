import { describe, expect, it } from "vitest";
import {
  LMS_ACCESS_RESTRICTIONS_KEY,
  lmsFileIsReferenced,
  parseLmsAccessRestrictions,
  serializeLmsAccessRestrictions,
  studentCanAccessLmsActivity,
  studentCanAccessLmsFile,
  studentCanAccessLinkedAssignment,
  studentCanAccessLms,
} from "./lmsAccessRestrictions.js";

const studentA = "90000000-0000-4000-8000-000000000001";
const studentB = "90000000-0000-4000-8000-000000000002";

describe("LMS access restrictions", () => {
  it("canonicalizes valid date and student rules", () => {
    const value = serializeLmsAccessRestrictions({
      match: "all",
      rules: [
        { type: "date", operator: "from", value: "2026-10-07T10:00:00+05:30" },
        { type: "student", studentIds: [studentA, studentA] },
      ],
    });
    expect(parseLmsAccessRestrictions(value)).toEqual({
      match: "all",
      rules: [
        { type: "date", operator: "from", value: "2026-10-07T04:30:00.000Z" },
        { type: "student", studentIds: [studentA] },
      ],
    });
  });

  it("enforces all/any, date, student and group rules", () => {
    const all = JSON.stringify({
      match: "all",
      rules: [
        { type: "date", operator: "from", value: "2026-10-01T00:00:00.000Z" },
        { type: "student", studentIds: [studentA] },
        { type: "group", groupIds: ["group-a"] },
      ],
    });
    expect(studentCanAccessLms(all, { studentId: studentA, groupIds: ["group-a"], now: new Date("2026-10-07T00:00:00Z") })).toBe(true);
    expect(studentCanAccessLms(all, { studentId: studentB, groupIds: ["group-a"], now: new Date("2026-10-07T00:00:00Z") })).toBe(false);

    const any = JSON.stringify({ match: "any", rules: [{ type: "student", studentIds: [studentA] }, { type: "group", groupIds: ["group-b"] }] });
    expect(studentCanAccessLms(any, { studentId: studentB, groupIds: ["group-b"] })).toBe(true);
  });

  it("fails closed for malformed stored rules", () => {
    expect(studentCanAccessLms("not-json", { studentId: studentA })).toBe(false);
    expect(() => parseLmsAccessRestrictions(JSON.stringify({ match: "all", rules: [{ type: "student", studentIds: [] }] }))).toThrow(/Select at least one/);
  });

  it("enforces topic and activity rules for linked assignments", () => {
    const allowA = JSON.stringify({ match: "all", rules: [{ type: "student", studentIds: [studentA] }] });
    const overlay = {
      topicRestrictions: { "topic-1": allowA },
      topicActivities: {
        "topic-1": [
          { id: "act-1", assignmentId: "assignment-1", settings: { [LMS_ACCESS_RESTRICTIONS_KEY]: allowA } },
        ],
      },
    };
    expect(studentCanAccessLinkedAssignment(overlay, "assignment-1", studentA)).toBe(true);
    expect(studentCanAccessLinkedAssignment(overlay, "assignment-1", studentB)).toBe(false);
    expect(studentCanAccessLinkedAssignment(overlay, "unlinked", studentB)).toBe(true);
  });

  it("blocks direct quiz and file access when the activity or topic excludes the student", () => {
    const allowA = JSON.stringify({ match: "all", rules: [{ type: "student", studentIds: [studentA] }] });
    const overlay = {
      topicRestrictions: { "topic-1": allowA },
      topicActivities: {
        "topic-1": [
          { id: "quiz-1", type: "QUIZ", settings: {} },
          { id: "file-activity-1", type: "FILE", fileId: "file-1", settings: {} },
        ],
      },
    };
    expect(studentCanAccessLmsActivity(overlay, "quiz-1", studentA)).toBe(true);
    expect(studentCanAccessLmsActivity(overlay, "quiz-1", studentB)).toBe(false);
    expect(studentCanAccessLmsFile(overlay, "file-1", studentA)).toBe(true);
    expect(studentCanAccessLmsFile(overlay, "file-1", studentB)).toBe(false);
    expect(studentCanAccessLmsFile(overlay, "unknown-file", studentA)).toBe(false);
    expect(lmsFileIsReferenced(overlay, "file-1")).toBe(true);
    expect(lmsFileIsReferenced({ ...overlay, hiddenActivityIds: ["file-activity-1"] }, "file-1")).toBe(false);
  });

  it("applies activity edits, group membership and hidden state to direct access", () => {
    const groupOnly = JSON.stringify({ match: "all", rules: [{ type: "group", groupIds: ["group-a"] }] });
    const overlay = {
      groupMembers: { "group-a": [{ id: studentA }] },
      topicActivities: { "topic-1": [{ id: "quiz-1", type: "QUIZ", settings: {} }] },
      activityEdits: { "quiz-1": { settings: { [LMS_ACCESS_RESTRICTIONS_KEY]: groupOnly } } },
    };
    expect(studentCanAccessLmsActivity(overlay, "quiz-1", studentA)).toBe(true);
    expect(studentCanAccessLmsActivity(overlay, "quiz-1", studentB)).toBe(false);
    expect(studentCanAccessLmsActivity({ ...overlay, hiddenActivityIds: ["quiz-1"] }, "quiz-1", studentA)).toBe(false);
  });
});
