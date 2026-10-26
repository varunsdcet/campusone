import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionClaims } from "@myheritage/contracts";

type Fn = ReturnType<typeof vi.fn>;

const store = vi.hoisted(() => {
  const models = new Map<string, Map<string, Fn>>();
  const defaults: Record<string, unknown> = {
    findMany: [],
    findFirst: null,
    findUnique: null,
    count: 0,
    groupBy: [],
    aggregate: {},
  };
  return { models, defaults };
});

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
              method in store.defaults ? store.defaults[method] : { id: `${name}-id`, ...(args?.data ?? {}) },
            );
            fns.set(method, fn);
          }
          return fn;
        },
      },
    );
  const root: Record<string, unknown> = {};
  return new Proxy(root, {
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
  sub: "00000000-0000-4000-8000-000000000061",
  accountId: "00000000-0000-4000-8000-000000000062",
  personId: "00000000-0000-4000-8000-000000000063",
  institutionId: "00000000-0000-4000-8000-000000000064",
  roles: ["instructor"],
  sessionId: "00000000-0000-4000-8000-000000000065",
};

const sectionA = "70000000-0000-4000-8000-00000000000a";
const sectionB = "70000000-0000-4000-8000-00000000000b";

function sectionRow(id: string, code: string) {
  return {
    id,
    code,
    instructorPersonId: user.personId,
    courseId: `course-${code}`,
    course: { code, title: `${code} title`, credits: 3 },
    term: { code: "2026F" },
    assignments: [],
    enrolments: [
      {
        id: `enr-${code}`,
        status: "enrolled",
        studentId: `stu-${code}`,
        student: { studentNumber: "S1", programName: "", standing: "good", person: { givenName: "A", familyName: "B", email: "a@b.c" } },
      },
    ],
  };
}

const PATH = "/instructor/f/t19-create-edit-assessment";

beforeEach(() => {
  store.models.clear();
  fn("person", "findFirstOrThrow").mockResolvedValue({ id: user.personId, givenName: "Elena", familyName: "Vance", email: "e@v.test" });
  const rows = [sectionRow(sectionA, "QA101"), sectionRow(sectionB, "QA102")];
  fn("section", "findMany").mockImplementation(async ({ where }: { where: { id?: { in?: string[] } } }) =>
    where?.id?.in ? rows.filter((r) => where.id!.in!.includes(r.id)) : rows,
  );
});

function publish(payload: Record<string, unknown>) {
  return runInstructorAction(user, { path: PATH, action: "Publish Assessment", rowKey: JSON.stringify(payload) });
}

describe("assessment builder", () => {
  it("publishes to the chosen section and does not create an empty timed quiz", async () => {
    const out = (await publish({ sectionId: sectionB, title: "Project 1", type: "Project", weight: "25%" })) as {
      result?: Record<string, unknown>;
    };
    expect(fn("assignment", "create")).toHaveBeenCalledWith({
      data: expect.objectContaining({ sectionId: sectionB, title: "Project 1", weightPercent: 25 }),
    });
    expect(fn("assessment", "create")).not.toHaveBeenCalled();
    expect(out.result).toMatchObject({ sectionId: sectionB });
    expect(out.result).toHaveProperty("assessmentId", null);
  });

  it("publishes timed quiz questions with the answer key", async () => {
    const questions = [{ id: "q1", prompt: "Two plus two?", options: ["3", "4"], correct: 1 }];
    const out = (await publish({ sectionId: sectionA, title: "Quiz 1", type: "Quiz", durationMinutes: 25, questions })) as {
      result?: Record<string, unknown>;
    };
    expect(fn("assessment", "create")).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sectionId: sectionA,
        title: "Quiz 1",
        durationMinutes: 25,
        questionsJson: JSON.stringify(questions),
      }),
    });
    expect(out.result?.assessmentId).toEqual(expect.any(String));
  });

  it("refuses a second assessment with the same title in the same section", async () => {
    fn("assignment", "findFirst").mockResolvedValue({ id: "existing" });
    await expect(publish({ sectionId: sectionB, title: "Midterm" })).rejects.toMatchObject({
      status: 409,
      code: "DUPLICATE",
      message: expect.stringMatching(/already has an assessment named "Midterm"/),
    });
    expect(fn("assignment", "findFirst")).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ sectionId: sectionB, title: { equals: "Midterm", mode: "insensitive" } }) }),
    );
    expect(fn("assignment", "create")).not.toHaveBeenCalled();
    expect(fn("rubric", "create")).not.toHaveBeenCalled();
  });

  it("refuses a section the instructor does not teach", async () => {
    await expect(publish({ sectionId: "70000000-0000-4000-8000-0000000000ff", title: "X" })).rejects.toMatchObject({
      status: 403,
      message: expect.stringMatching(/do not teach this course section/i),
    });
    expect(fn("assignment", "create")).not.toHaveBeenCalled();
  });

  it("offers every taught section in the builder", async () => {
    const screen = (await buildInstructorScreen(`${PATH}?sectionId=${sectionB}`, user)) as {
      payload?: { assessmentBuilder?: { sectionId?: string; sections?: Array<{ id: string }> } };
    };
    const builder = screen.payload?.assessmentBuilder;
    expect(builder?.sectionId).toBe(sectionB);
    expect(builder?.sections?.map((s) => s.id)).toEqual([sectionA, sectionB]);
  });
});
