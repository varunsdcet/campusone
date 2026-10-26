import { Router } from "express";
import { AskAboutGradeResponse, SendMessageRequest } from "@myheritage/contracts";
import { prisma } from "@myheritage/db";
import { writeAuditAndOutbox } from "@myheritage/events";
import { requireAuth, requireRoles, type AuthedRequest } from "../../middleware/auth.js";
import { assertPermission } from "../admin/superAdmin.service.js";

export const messagesRouter: Router = Router();

messagesRouter.post("/ask-grade", requireAuth, requireRoles("student"), async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    await assertPermission(user, "emailMessaging", "edit");
    const body = SendMessageRequest.parse(req.body);
    if (!body.relatedGradeItemId) {
      throw Object.assign(new Error("relatedGradeItemId required"), { code: "VALIDATION", status: 400 });
    }
    const grade = await prisma.gradeItem.findFirst({
      where: {
        id: body.relatedGradeItemId,
        institutionId: user.institutionId,
        status: "published",
      },
      include: { assignment: { include: { section: true } }, student: true },
    });
    if (!grade || grade.student.personId !== user.personId) {
      throw Object.assign(new Error("Published grade not found"), { code: "NOT_FOUND", status: 404 });
    }

    const instructorPersonId = grade.assignment.section.instructorPersonId;
    const instructorAccount = await prisma.account.findFirst({
      where: { institutionId: user.institutionId, personId: instructorPersonId },
    });
    if (!instructorAccount) {
      throw Object.assign(new Error("Instructor account not found"), { code: "NOT_FOUND", status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const thread = await tx.messageThread.create({
        data: {
          institutionId: user.institutionId,
          subject: body.subject ?? "Ask about this grade",
          participantAccountIdsJson: JSON.stringify([user.accountId, instructorAccount.id]),
        },
      });
      const message = await tx.message.create({
        data: {
          institutionId: user.institutionId,
          threadId: thread.id,
          senderAccountId: user.accountId,
          body: body.body,
          relatedGradeItemId: body.relatedGradeItemId,
        },
      });
      await writeAuditAndOutbox(tx, {
        institutionId: user.institutionId,
        actorId: user.accountId,
        eventName: "Message.sent",
        purpose: "student_ask_grade",
        before: null,
        after: { threadId: thread.id, messageId: message.id },
        source: "messages.ask-grade",
        correlationId: (req as AuthedRequest).correlationId,
        outboxPayload: {
          notifyAccountId: instructorAccount.id,
          title: "Question about a grade",
          body: body.body,
        },
      });
      return { thread, message };
    });

    res.status(201).json(
      AskAboutGradeResponse.parse({
        threadId: result.thread.id,
        message: {
          id: result.message.id,
          institutionId: result.message.institutionId,
          createdAt: result.message.createdAt.toISOString(),
          updatedAt: result.message.updatedAt.toISOString(),
          rowVersion: result.message.rowVersion,
          threadId: result.message.threadId,
          senderAccountId: result.message.senderAccountId,
          body: result.message.body,
          relatedGradeItemId: result.message.relatedGradeItemId ?? undefined,
        },
      }),
    );
  } catch (err) {
    next(err);
  }
});
