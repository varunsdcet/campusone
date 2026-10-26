import { Router } from "express";
import { z } from "zod";
import {
  ComposeMailRequest,
  CreateMailFolderRequest,
  MailBulkActionRequest,
  MailSearchRequest,
  ReplyMailRequest,
  UpdateMailboxSettingsRequest,
} from "@myheritage/contracts";
import { requireAuth, requireRoles, type AuthedRequest } from "../../middleware/auth.js";
import { assertPermission } from "../admin/superAdmin.service.js";
import {
  bulkMailAction,
  composeMail,
  createCustomMailFolder,
  createDistributionList,
  getMailThread,
  getMailAttachment,
  getMailboxSettings,
  listAudienceAccounts,
  listDistributionLists,
  listMailbox,
  replyMail,
  searchMail,
  updateMailboxSettings,
} from "../student/wave3.service.js";

/** Shared HCC My E-mail / Messages API for student + instructor (screens 223–230). */
export const mailRouter: Router = Router();

mailRouter.use(requireAuth, requireRoles("student", "instructor", "admin", "registrar"));
mailRouter.use(async (req, _res, next) => {
  try {
    await assertPermission((req as AuthedRequest).user, "emailMessaging", req.method === "GET" ? "view" : "edit");
    next();
  } catch (error) {
    next(error);
  }
});

mailRouter.get("/", async (req, res, next) => {
  try {
    const folderId = typeof req.query.folderId === "string" ? req.query.folderId : null;
    const folderKind = typeof req.query.folderKind === "string" ? req.query.folderKind : null;
    const user = (req as AuthedRequest).user;
    let data = await listMailbox(user, folderId);
    if (folderKind && !folderId) {
      const folder = data.folders.find((f) => f.kind === folderKind);
      if (folder) data = await listMailbox(user, folder.id);
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

mailRouter.get("/threads/:threadId", async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthedRequest;
    res.json(await getMailThread(user, String(req.params.threadId)));
  } catch (err) {
    next(err);
  }
});

mailRouter.get("/threads/:threadId/attachments/:attachmentId", async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthedRequest;
    res.json(await getMailAttachment(user, String(req.params.threadId), String(req.params.attachmentId)));
  } catch (err) {
    next(err);
  }
});

mailRouter.post("/folders", async (req, res, next) => {
  try {
    CreateMailFolderRequest.parse(req.body);
    res.status(201).json(await createCustomMailFolder((req as AuthedRequest).user, req.body));
  } catch (err) {
    next(err);
  }
});

mailRouter.post("/compose", async (req, res, next) => {
  try {
    ComposeMailRequest.parse(req.body);
    const user = (req as AuthedRequest).user;
    res.status(201).json(await composeMail(user, req.body, (req as AuthedRequest).correlationId));
  } catch (err) {
    next(err);
  }
});

mailRouter.post("/threads/:threadId/reply", async (req, res, next) => {
  try {
    ReplyMailRequest.parse(req.body);
    const { user, correlationId } = req as unknown as AuthedRequest;
    res.json(await replyMail(user, String(req.params.threadId), req.body, correlationId));
  } catch (err) {
    next(err);
  }
});

mailRouter.get("/settings", async (req, res, next) => {
  try {
    res.json({ settings: await getMailboxSettings((req as AuthedRequest).user) });
  } catch (err) {
    next(err);
  }
});

mailRouter.patch("/settings", async (req, res, next) => {
  try {
    UpdateMailboxSettingsRequest.parse(req.body);
    res.json({ settings: await updateMailboxSettings((req as AuthedRequest).user, req.body) });
  } catch (err) {
    next(err);
  }
});

mailRouter.get("/audience", async (req, res, next) => {
  try {
    res.json(await listAudienceAccounts((req as AuthedRequest).user));
  } catch (err) {
    next(err);
  }
});

mailRouter.post("/search", async (req, res, next) => {
  try {
    const body = MailSearchRequest.parse(req.body);
    res.json(await searchMail((req as AuthedRequest).user, body));
  } catch (err) {
    next(err);
  }
});

mailRouter.post("/bulk", async (req, res, next) => {
  try {
    const body = MailBulkActionRequest.parse(req.body);
    res.json(await bulkMailAction((req as AuthedRequest).user, body));
  } catch (err) {
    next(err);
  }
});

mailRouter.get("/lists", async (req, res, next) => {
  try {
    res.json(await listDistributionLists((req as AuthedRequest).user));
  } catch (err) {
    next(err);
  }
});

mailRouter.post("/lists", async (req, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().trim().min(1).max(120),
        memberAccountIds: z.array(z.string().uuid()).optional(),
      })
      .parse(req.body);
    res.status(201).json(await createDistributionList((req as AuthedRequest).user, body));
  } catch (err) {
    next(err);
  }
});
