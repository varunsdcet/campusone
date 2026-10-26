import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ notification: { updateMany: vi.fn() } }));
vi.mock("@myheritage/db", () => ({ prisma: db }));

import { markNotificationsRead, notificationPagination } from "./inbox.js";

const user = { institutionId: "00000000-0000-4000-8000-000000000004", accountId: "acct-instructor" };

beforeEach(() => {
  vi.clearAllMocks();
  db.notification.updateMany.mockResolvedValue({ count: 3 });
});

describe("markNotificationsRead", () => {
  it("persists read state for every unread notification of the caller only", async () => {
    await expect(markNotificationsRead(user)).resolves.toEqual({ count: 3 });
    const call = db.notification.updateMany.mock.calls[0]![0];
    expect(call.where).toEqual({ institutionId: user.institutionId, recipientAccountId: "acct-instructor", readAt: null });
    expect(call.data.readAt).toBeInstanceOf(Date);
  });

  it("narrows to the given ids, still scoped to the caller", async () => {
    await markNotificationsRead(user, [" n-1 ", "n-2"]);
    expect(db.notification.updateMany.mock.calls[0]![0].where).toMatchObject({
      recipientAccountId: "acct-instructor",
      id: { in: ["n-1", "n-2"] },
    });
  });

  it("does nothing for an explicit empty id list", async () => {
    await expect(markNotificationsRead(user, ["", " "])).resolves.toEqual({ count: 0 });
    expect(db.notification.updateMany).not.toHaveBeenCalled();
  });
});

describe("notificationPagination", () => {
  it("reports the real total rather than the page size", () => {
    expect(notificationPagination(20, 57)).toBe("Showing 1–20 of 57 notifications");
    expect(notificationPagination(1, 1)).toBe("Showing 1–1 of 1 notification");
    expect(notificationPagination(0, 0)).toBe("No notifications yet");
  });
});
