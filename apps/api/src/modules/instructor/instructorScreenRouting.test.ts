import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionClaims } from "@myheritage/contracts";

type Fn = ReturnType<typeof vi.fn>;

const store = vi.hoisted(() => ({
  models: new Map<string, Map<string, Fn>>(),
  screens: new Map<string, string>(),
  defaults: { findMany: [], findFirst: null, findUnique: null, count: 0, groupBy: [], aggregate: {} } as Record<string, unknown>,
}));

const prisma = vi.hoisted(() => {
  const modelProxy = (name: string) =>
    new Proxy(
      {},
      {
        get(_t, method: string) {
          let fns = store.models.get(name);
          if (!fns) store.models.set(name, (fns = new Map()));
          let fn = fns.get(method);
          if (!fn) {
            fn = vi.fn(async (args?: { data?: Record<string, unknown> }) =>
              method in store.defaults ? store.defaults[method] : { id: `${name}-id`, count: 1, ...(args?.data ?? {}) },
            );
            fns.set(method, fn);
          }
          return fn;
        },
      },
    );
  return new Proxy({} as Record<string, unknown>, {
    get(_t, key: string) {
      if (key === "$transaction") {
        return async (work: unknown) =>
          typeof work === "function" ? (work as (tx: unknown) => unknown)(prisma) : Promise.all(work as unknown[]);
      }
      if (key === "then") return undefined;
      return modelProxy(key);
    },
  });
});

vi.mock("@myheritage/db", () => ({ prisma }));

import { buildInstructorScreen, runInstructorAction } from "./instructor.service.js";

function fn(model: string, method: string): Fn {
  return (prisma as unknown as Record<string, Record<string, Fn>>)[model]![method]!;
}

const user: SessionClaims = {
  sub: "00000000-0000-4000-8000-000000000081",
  accountId: "00000000-0000-4000-8000-000000000082",
  personId: "00000000-0000-4000-8000-000000000083",
  institutionId: "00000000-0000-4000-8000-000000000084",
  roles: ["instructor"],
  sessionId: "00000000-0000-4000-8000-000000000085",
};

const sectionId = "80000000-0000-4000-8000-00000000001a";
const otherSectionId = "80000000-0000-4000-8000-00000000001b";
const studentId = "90000000-0000-4000-8000-000000000011";

const section = {
  id: sectionId,
  code: "QA201-01",
  instructorPersonId: user.personId,
  courseId: "course-2",
  course: { code: "QA201", title: "QA Routing", credits: 3 },
  term: { code: "2026F" },
  assignments: [],
  enrolments: [
    {
      id: "enr-1",
      status: "enrolled",
      studentId,
      student: { studentNumber: "S11", programName: "", standing: "good", person: { givenName: "Grace", familyName: "Hopper", email: "g@h.test" } },
    },
  ],
};

beforeEach(() => {
  store.models.clear();
  store.screens.clear();
  fn("person", "findFirstOrThrow").mockResolvedValue({ id: user.personId, givenName: "Elena", familyName: "Vance", email: "e@v.test" });
  fn("section", "findMany").mockImplementation(async ({ where }: { where: { id?: { in?: string[] } } }) => {
    const ids = where?.id?.in;
    if (!ids) return [section];
    return [
      ...(ids.includes(sectionId) ? [section] : []),
      ...(ids.includes(otherSectionId) ? [{ id: otherSectionId, instructorPersonId: "someone-else" }] : []),
    ];
  });
  fn("sisScreenState", "findUnique").mockImplementation(async ({ where }: { where: { institutionId_path: { path: string } } }) => {
    const payloadJson = store.screens.get(where.institutionId_path.path);
    return payloadJson ? { payloadJson } : null;
  });
  fn("sisScreenState", "upsert").mockImplementation(
    async ({ where, create }: { where: { institutionId_path: { path: string } }; create: { payloadJson: string } }) => {
      store.screens.set(where.institutionId_path.path, create.payloadJson);
      return {};
    },
  );
});

describe("grade correction workflow route", () => {
  it("renders the grade correction review instead of the generic gradebook", async () => {
    const screen = (await buildInstructorScreen("/instructor/f/t20-grade-correction-workflow", user)) as {
      payload: { title?: string; gradebook?: unknown };
    };
    expect(screen.payload.title).toBe("Grade Correction Review");
    expect(screen.payload.gradebook).toBeUndefined();
    expect(fn("approvalRequest", "findMany")).toHaveBeenCalled();
  });
});

describe("assigned admissions interviews", () => {
  it("shows only interviews assigned to the signed-in instructor", async () => {
    fn("heritageRecord", "findMany").mockResolvedValue([
      {
        id: "interview-mine",
        dataJson: JSON.stringify({ applicationId: "application-1", interviewerId: user.personId, scheduledAt: "2026-10-20T10:30", mode: "Video", location: "https://meet.example.edu/admission-1", status: "Scheduled" }),
      },
      {
        id: "interview-other",
        dataJson: JSON.stringify({ applicationId: "application-2", interviewerId: "another-person", scheduledAt: "2026-10-20T11:30", mode: "Video", location: "https://meet.example.edu/admission-2", status: "Scheduled" }),
      },
    ]);
    fn("admissionsApplication", "findMany").mockResolvedValue([{ id: "application-1", personId: "applicant-person", programName: "Nursing" }]);
    fn("person", "findMany").mockResolvedValue([{ id: "applicant-person", givenName: "Priya", familyName: "Sandhu" }]);

    const screen = (await buildInstructorScreen("/instructor/interviews", user)) as unknown as {
      payload: { rows: Array<{ cells: string[]; href?: string }> };
    };

    expect(screen.payload.rows).toHaveLength(1);
    expect(screen.payload.rows[0]?.cells).toContain("Priya Sandhu");
    expect(screen.payload.rows[0]?.href).toBe("https://meet.example.edu/admission-1");
  });
});

describe("course studio", () => {
  const workspaceKey = `/instructor/sections/${sectionId}`;

  it("reads the LMS overlay of the section workspace it displays", async () => {
    store.screens.set(workspaceKey, JSON.stringify({ topicTitles: { "topic-1": "Week 1 from workspace" } }));
    const screen = await buildInstructorScreen("/instructor/studio", user);
    expect(screen.path).toBe("/instructor/studio");
    const readKeys = fn("sisScreenState", "findUnique").mock.calls.map((c) => c[0].where.institutionId_path.path);
    expect(readKeys).toContain(workspaceKey);
    expect(readKeys).not.toContain("/instructor/studio");
  });

  it("stores studio edits under the workspace key students read", async () => {
    await runInstructorAction(user, {
      path: `/instructor/studio?sectionId=${sectionId}`,
      action: "Add Activity",
      rowKey: JSON.stringify({ TopicId: "topic-1", ActivityType: "URL", Name: "Style guide", "External URL": "https://example.org/style" }),
    });
    const saved = JSON.parse(store.screens.get(workspaceKey) ?? "{}") as { topicActivities?: Record<string, unknown[]> };
    expect(Object.values(saved.topicActivities ?? {}).flat()).toEqual([expect.objectContaining({ name: "Style guide" })]);
    expect([...store.screens.keys()].some((k) => k.startsWith("/instructor/studio"))).toBe(false);
  });

  it("still refuses a section the instructor does not teach", async () => {
    await expect(buildInstructorScreen(`/instructor/studio?sectionId=${otherSectionId}`, user)).rejects.toMatchObject({ status: 403 });
  });
});

describe("attendance Save Draft after submission", () => {
  const path = "/instructor/attendance?date=2026-10-06";
  const roster = (note: string) =>
    JSON.stringify({ date: "2026-10-06", roster: [{ studentId, studentNumber: "S11", status: "Present", note, sectionId }] });

  it("updates the submitted record instead of silently keeping a hidden draft", async () => {
    fn("attendanceRecord", "findMany").mockResolvedValue([{ studentId, sectionId, status: "present", note: "", recordedAt: new Date() }]);
    const out = (await runInstructorAction(user, { path, action: "Save Draft", rowKey: roster("Left early for appointment") })) as {
      ok: boolean;
      message: string;
    };
    expect(out.ok).toBe(true);
    expect(out.message).toMatch(/already submitted · updated 1 submitted record/);
    expect(fn("attendanceRecord", "create")).toHaveBeenCalledWith({
      data: expect.objectContaining({ studentId, sectionId, meetingLabel: "2026-10-06", status: "present", note: "Left early for appointment" }),
    });
  });

  it("keeps a plain draft when nothing was submitted for the day", async () => {
    const out = (await runInstructorAction(user, {
      path: `/instructor/attendance?sectionId=${sectionId}&date=2026-10-06`,
      action: "Save Draft",
      rowKey: roster("draft note"),
    })) as { message: string };
    expect(out.message).toBe("Attendance draft saved · 1 student(s) marked");
    expect(fn("attendanceRecord", "create")).not.toHaveBeenCalled();
    const draft = JSON.parse(store.screens.get(path) ?? "{}") as { attendance?: { finalized: boolean; roster: Array<{ note?: string }> } };
    expect(draft.attendance).toMatchObject({ finalized: false, roster: [expect.objectContaining({ note: "draft note" })] });
  });
});
