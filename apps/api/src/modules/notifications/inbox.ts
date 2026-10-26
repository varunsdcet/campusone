import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";

/** Marks the caller's own unread notifications as read; `ids` narrows it to specific rows, otherwise every unread one is marked. */
export async function markNotificationsRead(user: Pick<SessionClaims, "institutionId" | "accountId">, ids?: string[]) {
  const scoped = ids?.map((id) => id.trim()).filter(Boolean);
  if (ids && !scoped?.length) return { count: 0 };
  const { count } = await prisma.notification.updateMany({
    where: {
      institutionId: user.institutionId,
      recipientAccountId: user.accountId,
      readAt: null,
      ...(scoped ? { id: { in: scoped } } : {}),
    },
    data: { readAt: new Date(), rowVersion: { increment: 1 } },
  });
  return { count };
}

export function notificationPagination(shown: number, total: number) {
  if (!shown) return "No notifications yet";
  const all = Math.max(total, shown);
  return `Showing 1–${shown} of ${all} notification${all === 1 ? "" : "s"}`;
}
