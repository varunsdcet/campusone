import { Router } from "express";
import { prisma } from "@myheritage/db";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { MarkStudentNotificationReadResponse } from "@myheritage/contracts";
import { writeAuditAndOutbox } from "@myheritage/events";
import { markNotificationsRead } from "./inbox.js";

export const notificationsRouter: Router = Router();

notificationsRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const rows = await prisma.notification.findMany({
      where: { institutionId: user.institutionId, recipientAccountId: user.accountId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const items = rows.map((n) => ({
      id: n.id,
      channel: n.channel,
      title: n.title,
      body: n.body,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
      templateKey: n.templateKey,
    }));
    res.json({
      items,
      unreadCount: items.filter((i) => i.readAt == null).length,
    });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post("/me/read-all", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const { count } = await markNotificationsRead(user);
    res.json({ changed: count });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.patch("/me/:notificationId/read", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const row = await prisma.notification.findFirst({
      where: {
        id: req.params.notificationId,
        institutionId: user.institutionId,
        recipientAccountId: user.accountId,
      },
    });
    if (!row) {
      throw Object.assign(new Error("Notification not found"), { code: "NOT_FOUND", status: 404 });
    }

    let changed = false;
    let notification = row;
    if (!row.readAt) {
      const readAt = new Date();
      notification = await prisma.$transaction(async (tx) => {
        const result = await tx.notification.updateMany({
          where: {
            id: row.id,
            institutionId: user.institutionId,
            recipientAccountId: user.accountId,
            readAt: null,
          },
          data: { readAt, rowVersion: { increment: 1 } },
        });
        changed = result.count === 1;
        if (changed) {
          await writeAuditAndOutbox(tx, {
            institutionId: user.institutionId,
            actorId: user.accountId,
            eventName: "Notification.read",
            purpose: "notification_state",
            before: { readAt: null },
            after: { notificationId: row.id, readAt: readAt.toISOString() },
            source: "notifications.me",
            correlationId: (req as AuthedRequest).correlationId,
          });
        }
        return tx.notification.findUniqueOrThrow({ where: { id: row.id } });
      });
    }

    res.json(
      MarkStudentNotificationReadResponse.parse({
        changed,
        notification: {
          id: notification.id,
          title: notification.title,
          body: notification.body,
          channel: notification.channel,
          createdAt: notification.createdAt.toISOString(),
          readAt: notification.readAt?.toISOString() ?? null,
        },
      }),
    );
  } catch (error) {
    next(error);
  }
});
