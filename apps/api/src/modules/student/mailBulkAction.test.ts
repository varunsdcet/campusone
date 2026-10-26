import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionClaims } from "@myheritage/contracts";

const db = vi.hoisted(() => ({
  mailThreadPlacement: {
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  mailFolder: {
    findMany: vi.fn(),
    createMany: vi.fn(),
  },
}));

vi.mock("@myheritage/db", () => ({ prisma: db }));

import { bulkMailAction } from "./wave3.service.js";

const user = {
  sub: "00000000-0000-4000-8000-000000000001",
  accountId: "00000000-0000-4000-8000-000000000002",
  personId: "00000000-0000-4000-8000-000000000003",
  institutionId: "00000000-0000-4000-8000-000000000004",
  roles: ["student"],
  sessionId: "00000000-0000-4000-8000-000000000005",
} satisfies SessionClaims;

const placements = [{ id: "placement-1" }, { id: "placement-2" }];
const folders = [
  { id: "inbox", kind: "inbox" },
  { id: "junk", kind: "junk" },
  { id: "deleted", kind: "deleted" },
];

beforeEach(() => {
  vi.clearAllMocks();
  db.mailThreadPlacement.findMany.mockResolvedValue(placements);
  db.mailThreadPlacement.update.mockResolvedValue({});
  db.mailThreadPlacement.delete.mockResolvedValue({});
  db.mailFolder.findMany.mockResolvedValue(folders);
});

describe("bulkMailAction", () => {
  it("moves selected messages to Junk", async () => {
    await expect(bulkMailAction(user, { threadIds: ["thread-1", "thread-2"], action: "move_junk" })).resolves.toEqual({ ok: true, count: 2 });
    expect(db.mailThreadPlacement.update).toHaveBeenCalledTimes(2);
    expect(db.mailThreadPlacement.update).toHaveBeenCalledWith({ where: { id: "placement-1" }, data: { folderId: "junk" } });
  });

  it("permanently removes only this account's mailbox placements", async () => {
    await expect(bulkMailAction(user, { threadIds: ["thread-1", "thread-2"], action: "purge" })).resolves.toEqual({ ok: true, count: 2 });
    expect(db.mailThreadPlacement.delete).toHaveBeenCalledTimes(2);
    expect(db.mailThreadPlacement.update).not.toHaveBeenCalled();
  });
});
