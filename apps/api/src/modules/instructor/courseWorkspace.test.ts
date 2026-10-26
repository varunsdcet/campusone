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
  sub: "00000000-0000-4000-8000-000000000071",
  accountId: "00000000-0000-4000-8000-000000000072",
  personId: "00000000-0000-4000-8000-000000000073",
  institutionId: "00000000-0000-4000-8000-000000000074",
  roles: ["instructor"],
  sessionId: "00000000-0000-4000-8000-000000000075",
};

const sectionId = "80000000-0000-4000-8000-00000000000a";
const PATH = `/instructor/sections/${sectionId}`;
const studentId = "90000000-0000-4000-8000-000000000001";

const section = {
  id: sectionId,
  code: "QA101-01",
  instructorPersonId: user.personId,
  courseId: "course-1",
  course: { code: "QA101", title: "QA Course", credits: 3 },
  term: { code: "2026F" },
  assignments: [],
  enrolments: [
    {
      id: "enr-1",
      status: "enrolled",
      studentId,
      student: { studentNumber: "S1", programName: "", standing: "good", person: { givenName: "Ada", familyName: "Lovelace", email: "a@l.test" } },
    },
  ],
};

function overlay(): Record<string, unknown> {
  const raw = [...store.screens.entries()].find(([key]) => key.includes(sectionId))?.[1];
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

function act(action: string, fields: Record<string, string>) {
  return runInstructorAction(user, { path: PATH, action, rowKey: JSON.stringify(fields) }) as Promise<{
    message?: string;
    result?: Record<string, unknown>;
  }>;
}

beforeEach(() => {
  store.models.clear();
  store.screens.clear();
  fn("person", "findFirstOrThrow").mockResolvedValue({ id: user.personId, givenName: "Elena", familyName: "Vance", email: "e@v.test" });
  fn("section", "findMany").mockImplementation(async ({ where }: { where: { id?: { in?: string[] } } }) =>
    where?.id?.in && !where.id.in.includes(sectionId) ? [] : [section],
  );
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
  fn("assignment", "create").mockImplementation(async ({ data }: { data: { id: string } }) => ({ id: data.id }));
});

function topicActivities() {
  return Object.values((overlay().topicActivities as Record<string, Array<Record<string, unknown>>>) || {}).flat();
}

describe("course workspace activities keep what the instructor entered", () => {
  it("saves canonical access restrictions with an activity", async () => {
    const restrictions = JSON.stringify({ match: "all", rules: [{ type: "student", studentIds: [studentId] }] });
    await act("Add Activity", {
      TopicId: "topic-1",
      ActivityType: "URL",
      Name: "Private style guide",
      "External URL": "https://example.org/private",
      "Access restrictions": restrictions,
    });
    expect(topicActivities()[0]).toMatchObject({ settings: { "Access restrictions": restrictions } });
  });

  it("keeps an uploaded PDF attached to an assignment activity", async () => {
    fn("heritageRecord", "findFirst").mockResolvedValue({
      id: "file-1",
      dataJson: JSON.stringify({ name: "assignment-brief.pdf", mime: "application/pdf", size: 2048 }),
    });
    await act("Add Activity", {
      TopicId: "topic-1",
      ActivityType: "ASSIGNMENT",
      Name: "Final report",
      FileId: "file-1",
      "File submissions": "yes",
    });
    expect(topicActivities()[0]).toMatchObject({
      type: "ASSIGNMENT",
      fileId: "file-1",
      fileName: "assignment-brief.pdf",
      fileSize: 2048,
      assignmentId: expect.any(String),
    });
  });

  it("saves and removes section access restrictions", async () => {
    const restrictions = JSON.stringify({ match: "all", rules: [{ type: "student", studentIds: [studentId] }] });
    await act("Save section", { TopicId: "topic-1", Title: "Week 1", Summary: "", AccessRestrictions: restrictions });
    expect(overlay().topicRestrictions).toEqual({ "topic-1": restrictions });
    await act("Save section", { TopicId: "topic-1", Title: "Week 1", Summary: "", AccessRestrictions: "" });
    expect(overlay().topicRestrictions).toEqual({});
  });

  it("updates access restrictions from the rich page editor", async () => {
    await act("Add Activity", { TopicId: "topic-1", ActivityType: "PAGE", Name: "Week 1", "Page content": "<p>Read</p>" });
    const page = topicActivities()[0]!;
    const restrictions = JSON.stringify({ match: "all", rules: [{ type: "student", studentIds: [studentId] }] });
    await act("Save page", {
      Id: String(page.id),
      Name: "Week 1",
      Body: "<p>Read this</p>",
      Hidden: "no",
      AccessRestrictions: restrictions,
    });
    expect(topicActivities()[0]).toMatchObject({ settings: { "Access restrictions": restrictions } });
  });

  it("saves a URL activity's external link", async () => {
    await act("Add Activity", { TopicId: "topic-1", ActivityType: "URL", Name: "Style guide", "External URL": "https://example.org/style" });
    expect(topicActivities()[0]).toMatchObject({ type: "URL", name: "Style guide", url: "https://example.org/style" });
  });

  it("refuses a javascript: link", async () => {
    await expect(act("Add Activity", { TopicId: "topic-1", ActivityType: "URL", Name: "Bad", "External URL": "javascript:alert(1)" })).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/https:\/\/ or http:\/\//),
    });
    expect(topicActivities()).toHaveLength(0);
  });

  it("saves page content and hides a page marked hidden", async () => {
    await act("Add Activity", {
      TopicId: "topic-1",
      ActivityType: "PAGE",
      Name: "Week 1",
      "Page content": "<p>Read chapter one</p>",
      Availability: "Hide on course page",
    });
    const [page] = topicActivities();
    expect(page).toMatchObject({ type: "PAGE", body: expect.stringContaining("Read chapter one") });
    expect(page).not.toHaveProperty("hidden");
    expect(overlay().hiddenActivityIds).toEqual([page!.id]);
  });

  it("creates a real assignment students can submit to", async () => {
    await act("Add Activity", {
      TopicId: "topic-1",
      ActivityType: "ASSIGNMENT",
      Name: "Essay 1",
      "Activity instructions": "Write 500 words",
      "Due date": "2099-10-10T23:59:00.000Z",
      "Accepted file types": ".pdf",
      "Maximum grade": "50",
    });
    expect(fn("assignment", "create")).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sectionId,
        title: "Essay 1",
        instructions: "Write 500 words",
        acceptedTypes: ".pdf",
        maxScore: 50,
        hidden: false,
      }),
    });
    const [activity] = topicActivities();
    expect(activity).toMatchObject({ type: "ASSIGNMENT", assignmentId: expect.any(String), assignment: expect.objectContaining({ maxScore: 50 }) });
  });

  it("reloads and updates assignment settings on edit", async () => {
    await act("Add Activity", { TopicId: "topic-1", ActivityType: "ASSIGNMENT", Name: "Essay 1", "Maximum grade": "50" });
    const [created] = topicActivities();
    fn("assignment", "updateMany").mockResolvedValue({ count: 1 });
    await act("Save activity settings", {
      Id: String(created!.id),
      Name: "Essay 1 (revised)",
      "Maximum grade": "80",
      Availability: "Hide on course page",
    });
    expect(fn("assignment", "updateMany")).toHaveBeenCalledWith({
      where: { id: created!.assignmentId, institutionId: user.institutionId, sectionId },
      data: expect.objectContaining({ title: "Essay 1 (revised)", maxScore: 80, hidden: true }),
    });
    expect(topicActivities()[0]).toMatchObject({ name: "Essay 1 (revised)", settings: expect.objectContaining({ "Maximum grade": "80" }) });
    expect(overlay().hiddenActivityIds).toEqual([created!.id]);
  });
});

describe("workspace Grades tab", () => {
  it("is built from the live gradebook instead of template columns", async () => {
    const assignmentId = "a0000000-0000-4000-8000-000000000001";
    type Query = { where?: { sectionId?: string; assignment?: { sectionId?: string } }; select?: Record<string, unknown> };
    const forBoard = (q: Query) => q?.where?.sectionId === sectionId || q?.where?.assignment?.sectionId === sectionId;
    fn("assignment", "findMany").mockImplementation(async (q: Query) =>
      forBoard(q) && q.select?.weightPercent ? [{ id: assignmentId, title: "Essay 1", weightPercent: 20, maxScore: 50 }] : [],
    );
    fn("enrolment", "findMany").mockImplementation(async (q: Query) =>
      forBoard(q) && q.select?.studentId
        ? [{ studentId, student: { studentNumber: "S1", person: { givenName: "Ada", familyName: "Lovelace" } } }]
        : [],
    );
    fn("gradeItem", "findMany").mockImplementation(async (q: Query) =>
      forBoard(q) ? [{ assignmentId, studentId, score: 40, maxScore: 50, status: "draft" }] : [],
    );
    fn("submission", "findMany").mockImplementation(async (q: Query) =>
      forBoard(q) ? [{ assignmentId, studentId, status: "submitted" }] : [],
    );

    const screen = (await buildInstructorScreen(PATH, user)) as {
      payload?: {
        courseDetail?: {
          lms?: {
            gradeBoard?: Record<string, unknown>;
            gradeEmpty?: string;
            reporting?: {
              logs: Array<{ source: string; participant: string }>;
              participation: Array<{ studentId: string; submissions: number }>;
            };
          };
        };
      };
    };
    const lms = screen.payload?.courseDetail?.lms;
    expect(lms?.gradeBoard).toMatchObject({
      assignments: [{ id: assignmentId, title: "Essay 1", weightPercent: 20, maxScore: 50, submitted: 1 }],
      rows: [{ name: "Ada Lovelace", cells: [{ assignmentId, mark: "40/50", status: "draft" }], total: "80%" }],
      gradebookHref: `/instructor/gradebook?sectionId=${sectionId}`,
    });
    expect(lms?.gradeEmpty).toBeUndefined();
    expect(lms?.reporting?.participation).toContainEqual(expect.objectContaining({ studentId, submissions: 1 }));
    expect(lms?.reporting?.logs).toContainEqual(expect.objectContaining({ source: "Assignment", participant: "Ada Lovelace" }));
  });
});
