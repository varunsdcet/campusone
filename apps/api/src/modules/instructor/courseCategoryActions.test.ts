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

import { runInstructorAction } from "./instructor.service.js";
import { buildRepositoryCatalog } from "./courseContentScreens.js";

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

const PATH = "/instructor/f/t58-course-categories";

beforeEach(() => {
  store.models.clear();
  fn("person", "findFirstOrThrow").mockResolvedValue({ id: user.personId, givenName: "Elena", familyName: "Vance", email: "e@v.test" });
});

function run(action: string, fields: Record<string, string>) {
  return runInstructorAction(user, { path: PATH, action, rowKey: JSON.stringify(fields) }) as Promise<{ message?: string }>;
}

function appendedCategoryNames(): string[] {
  return fn("sisScreenState", "upsert").mock.calls.flatMap(([args]) => {
    const payload = JSON.parse((args as { create: { payloadJson: string } }).create.payloadJson) as {
      extraRows?: Array<{ cells: string[] }>;
    };
    return (payload.extraRows ?? []).map((r) => r.cells[0]!);
  });
}

describe("course category actions", () => {
  it("creates a category from the Quick-Create action", async () => {
    const out = await run("Quick-Create Category", { "Category Name": "Nursing", Code: "NURS" });
    expect(out.message).toBe("Category created · Nursing");
    expect(appendedCategoryNames()).toEqual(["Nursing"]);
  });

  it.each(["Delete Category", "Edit category", "Remove Category"])("does not create a category for %s", async (action) => {
    await expect(run(action, { "Category Name": "Accounting" })).rejects.toMatchObject({
      status: 422,
      code: "ACTION_NOT_SUPPORTED",
    });
    expect(appendedCategoryNames()).not.toContain("Accounting");
  });
});

describe("course repository catalog", () => {
  it("gives every row a unique id", () => {
    const ids = buildRepositoryCatalog().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
