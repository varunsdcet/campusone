import type { SessionClaims } from "@myheritage/contracts";
import {
  AcademicBlockSummary,
  ComposeMailRequest,
  ComposeMailResponse,
  CourseEvaluationView,
  CreateMailFolderRequest,
  FinancialTermSummary,
  MailboxListResponse,
  MailboxSettingsView,
  ReplyMailRequest,
  StudentCalendarsResponse,
  StudentCourseLmsResponse,
  SubmitCourseEvaluationRequest,
  SubmitCourseEvaluationResponse,
  UpdateMailboxSettingsRequest,
} from "@myheritage/contracts";
import { prisma } from "@myheritage/db";
import { writeAuditAndOutbox } from "@myheritage/events";
import { randomUUID } from "node:crypto";
import {
  buildCourseLms,
  gradeSchemeFromLms,
  instructorNameParts,
  mergeCourseLmsOverlay,
  studentQuizQuestionsForActivity,
} from "../instructor/courseLmsScreens.js";
import { LMS_ACCESS_RESTRICTIONS_KEY, studentCanAccessLms } from "../instructor/lmsAccessRestrictions.js";
import { quizFromActivity, studentQuizAttempts, studentQuizQuestions } from "../instructor/lmsQuiz.js";
import { sectionLmsMeta } from "../instructor/sectionLmsMeta.js";
import { liveClassUrl } from "../../lib/liveClass.js";
import { isSafeLink } from "../../lib/safeLink.js";
import { bytesMatchMime, decodeBase64 } from "../../lib/fileSniff.js";
import { requireStudent } from "./surfaces.service.js";

function httpError(message: string, code: string, status: number) {
  return Object.assign(new Error(message), { code, status });
}

const SYSTEM_FOLDER_KINDS = ["inbox", "outbox", "drafts", "junk", "deleted"] as const;
const MAIL_ATTACHMENT_TYPES = /^(image\/(png|jpe?g|gif|webp)|application\/(pdf|zip|x-zip-compressed|msword|vnd\.ms-excel|vnd\.ms-powerpoint|vnd\.openxmlformats-officedocument\.[a-z.]+)|text\/(plain|csv))$/;
const MAIL_ATTACHMENT_MAX = 8 * 1024 * 1024;

function validateMailAttachment(input: { name: string; mime: string; base64: string }) {
  const name = input.name.replace(/[\\/]/g, "_").trim().slice(0, 200);
  const mime = input.mime.toLowerCase().trim();
  const base64 = input.base64.replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
  const sizeBytes = Math.floor((base64.length * 3) / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
  if (!name) throw httpError("Attachment name is required", "VALIDATION_ERROR", 400);
  if (!MAIL_ATTACHMENT_TYPES.test(mime)) throw httpError("Unsupported attachment type", "VALIDATION_ERROR", 400);
  if (!sizeBytes || sizeBytes > MAIL_ATTACHMENT_MAX) throw httpError("Attachments must be non-empty and 8 MB or smaller", "VALIDATION_ERROR", 400);
  if (!bytesMatchMime(decodeBase64(base64), mime)) throw httpError("Attachment contents do not match the declared file type", "VALIDATION_ERROR", 400);
  return { id: randomUUID(), name, mime, sizeBytes, contentBase64: base64 };
}

async function ensureMailFolders(institutionId: string, accountId: string) {
  const existing = await prisma.mailFolder.findMany({
    where: { institutionId, accountId },
    orderBy: { sortOrder: "asc" },
  });
  if (existing.length) return existing;
  const labels: Array<{ kind: (typeof SYSTEM_FOLDER_KINDS)[number]; name: string; sortOrder: number }> = [
    { kind: "inbox", name: "Inbox", sortOrder: 0 },
    { kind: "outbox", name: "Outbox", sortOrder: 1 },
    { kind: "drafts", name: "Drafts", sortOrder: 2 },
    { kind: "junk", name: "Junk", sortOrder: 3 },
    { kind: "deleted", name: "Deleted", sortOrder: 4 },
  ];
  await prisma.mailFolder.createMany({
    data: labels.map((f) => ({
      id: randomUUID(),
      institutionId,
      accountId,
      name: f.name,
      kind: f.kind,
      sortOrder: f.sortOrder,
    })),
  });
  return prisma.mailFolder.findMany({
    where: { institutionId, accountId },
    orderBy: { sortOrder: "asc" },
  });
}

async function ensureMailboxSettings(institutionId: string, accountId: string) {
  const existing = await prisma.mailboxSettings.findUnique({ where: { accountId } });
  if (existing) return existing;
  return prisma.mailboxSettings.create({
    data: {
      id: randomUUID(),
      institutionId,
      accountId,
      forwardingEnabled: false,
      smsForwardingEnabled: false,
      popupNotifications: true,
      notificationSound: false,
      signature: null,
      forwardingAddress: null,
    },
  });
}

function presentEvaluation(row: {
  id: string;
  courseCode: string;
  courseTitle: string;
  sectionId: string | null;
  status: string;
  dueAt: Date | null;
  submittedAt: Date | null;
  overallRating: number | null;
  responsesJson: string | null;
}) {
  let responses: CourseEvaluationView["responses"] = null;
  if (row.responsesJson) {
    try {
      responses = JSON.parse(row.responsesJson) as CourseEvaluationView["responses"];
    } catch {
      responses = null;
    }
  }
  return CourseEvaluationView.parse({
    id: row.id,
    courseCode: row.courseCode,
    courseTitle: row.courseTitle,
    sectionId: row.sectionId,
    status: row.status === "submitted" ? "submitted" : "pending",
    dueAt: row.dueAt?.toISOString() ?? null,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    overallRating: row.overallRating,
    responses,
  });
}

export async function listStudentCalendars(user: SessionClaims) {
  const [academicBlocks, financialTerms] = await Promise.all([
    prisma.academicBlock.findMany({
      where: { institutionId: user.institutionId },
      orderBy: { startsOn: "asc" },
    }),
    prisma.financialTerm.findMany({
      where: { institutionId: user.institutionId },
      orderBy: { startsOn: "asc" },
    }),
  ]);
  return StudentCalendarsResponse.parse({
    academicBlocks: academicBlocks.map((b) =>
      AcademicBlockSummary.parse({
        id: b.id,
        code: b.code,
        name: b.name,
        startsOn: b.startsOn,
        endsOn: b.endsOn,
      }),
    ),
    financialTerms: financialTerms.map((t) =>
      FinancialTermSummary.parse({
        id: t.id,
        code: t.code,
        name: t.name,
        startsOn: t.startsOn,
        endsOn: t.endsOn,
      }),
    ),
  });
}

async function loadInstructorLmsOverlay(institutionId: string, sectionId: string) {
  const candidates = [
    `/instructor/sections/${sectionId}`,
    `/instructor/f/t56-active-courses?view=${sectionId}`,
    `/instructor/f/t56-active-courses?view=${encodeURIComponent(sectionId)}`,
  ];
  for (const path of candidates) {
    const state = await prisma.sisScreenState.findUnique({
      where: { institutionId_path: { institutionId, path } },
    });
    if (state) return JSON.parse(state.payloadJson) as Record<string, unknown>;
  }
  return null;
}

type ChoiceResponse = { selected: string[]; submittedAt: string };

async function studentChoiceResponses(institutionId: string, sectionId: string, studentId: string) {
  const rows = await prisma.sisScreenState.findMany({
    where: {
      institutionId,
      path: { startsWith: `/student/lms-choice/${sectionId}/`, endsWith: `/${studentId}` },
    },
    select: { path: true, payloadJson: true },
  });
  const responses = new Map<string, ChoiceResponse>();
  for (const row of rows) {
    const activityId = row.path.split("/")[4];
    if (!activityId) continue;
    try {
      const value = JSON.parse(row.payloadJson) as ChoiceResponse;
      if (Array.isArray(value.selected) && typeof value.submittedAt === "string") responses.set(activityId, value);
    } catch {
      // Ignore a corrupt legacy response rather than breaking the whole course page.
    }
  }
  return responses;
}

function choiceFromSettings(settings: Record<string, string> | undefined, response?: ChoiceResponse) {
  const options = Array.from({ length: 20 }, (_, index) => settings?.[`Option ${index + 1}`]?.trim() || "").filter(Boolean);
  if (!options.length) return undefined;
  return {
    options,
    multiple: /yes/i.test(settings?.["Allow more than one choice to be selected"] || ""),
    displayMode: /horizontal/i.test(settings?.["Display mode for options"] || "") ? ("horizontal" as const) : ("vertical" as const),
    response: response || null,
  };
}

export async function getStudentCourseLms(user: SessionClaims, sectionId: string) {
  const student = await requireStudent(user, sectionId);
  const enrolment = await prisma.enrolment.findFirst({
    where: {
      institutionId: user.institutionId,
      studentId: student.id,
      sectionId,
      status: { in: ["enrolled", "completed"] },
    },
    include: {
      section: {
        include: {
          course: true,
          academicBlock: true,
          classSessions: { orderBy: { startsAt: "asc" } },
          dayBlocks: { include: { lessons: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } },
          folders: { include: { items: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } },
          syllabusTopics: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  if (!enrolment) throw httpError("Section not in your enrolment", "NOT_FOUND", 404);

  const progressPath = `/student/content-progress/${user.accountId}/${sectionId}`;
  const state = await prisma.sisScreenState.findUnique({
    where: { institutionId_path: { institutionId: user.institutionId, path: progressPath } },
  });
  const completed = new Set<string>(
    state ? ((JSON.parse(state.payloadJson) as { completed?: string[] }).completed ?? []) : [],
  );

  const block = enrolment.section.academicBlock;
  const instructor = await prisma.person.findFirst({
    where: { id: enrolment.section.instructorPersonId, institutionId: user.institutionId },
  });
  const instructorName = instructor
    ? `${instructor.familyName}, ${instructor.givenName}`
    : "TBA";
  const names = instructorNameParts(instructor ? `${instructor.givenName} ${instructor.familyName}` : "Instructor");
  const code = enrolment.section.course.code;
  const title = enrolment.section.course.title;
  const meta = await sectionLmsMeta(user.institutionId, sectionId);
  const location = meta?.location ?? "Location to be announced";
  const joinUrl = liveClassUrl(sectionId);
  const sessionLabel = meta?.session ?? enrolment.section.code;

  const overlay = await loadInstructorLmsOverlay(user.institutionId, sectionId);
  const lms = mergeCourseLmsOverlay(
    buildCourseLms({
      code,
      title,
      session: sessionLabel,
      location,
      instructorFirst: names.first,
      instructorLast: names.last,
      sectionCode: enrolment.section.code,
      joinUrl,
      ended: meta?.ended ?? false,
    }),
    overlay,
  );
  const [quizAttempts, choiceResponses] = await Promise.all([
    studentQuizAttempts(user.institutionId, sectionId, student.id),
    studentChoiceResponses(user.institutionId, sectionId, student.id),
  ]);
  const studentGroupIds = lms.groups.filter((group) => group.members.some((member) => member.id === student.id)).map((group) => group.id);
  const mayAccess = (value: unknown) => studentCanAccessLms(value, { studentId: student.id, groupIds: studentGroupIds });

  const topics = lms.topics.filter((topic) => mayAccess(topic.accessRestrictions)).map((topic) => ({
    id: topic.id,
    title: topic.title,
    summary: topic.summary,
    activities: topic.activities
      .filter((a) => !a.hidden && mayAccess(a.settings?.[LMS_ACCESS_RESTRICTIONS_KEY]))
      .map((a) => {
        const type = a.type.toUpperCase();
        const base = {
          id: a.id,
          type,
          name: a.name,
          body: a.body,
          fileName: a.fileName,
          fileId: a.fileId,
          fileSize: a.fileSize,
          modified: a.modified,
          note: a.note,
          storyboard: a.storyboard,
          hidden: false,
          joinUrl: type === "BIGBLUEBUTTON" ? a.joinUrl || joinUrl : null,
          description: a.description || undefined,
          url: a.url && /^https?:\/\//i.test(a.url) && isSafeLink(a.url) ? a.url : undefined,
          settings: a.settings,
          assignmentId: a.assignmentId,
          assignment: a.assignment
            ? {
                instructions: a.assignment.instructions,
                availableFrom: a.assignment.availableFrom,
                dueAt: a.assignment.dueAt,
                cutoffAt: a.assignment.cutoffAt,
                maxScore: a.assignment.maxScore,
                fileSubmissions: a.assignment.fileSubmissions,
                onlineText: a.assignment.onlineText,
                maxFiles: a.assignment.maxFiles,
                maxFileBytes: a.assignment.maxFileBytes,
                acceptedTypes: a.assignment.acceptedTypes,
              }
            : undefined,
          choice: type === "CHOICE" ? choiceFromSettings(a.settings, choiceResponses.get(a.id)) : undefined,
          gradingMethod: /final\s*exam/i.test(a.name) ? "Highest grade" : a.note?.includes("Grading method") ? a.note : undefined,
        };
        if (type === "QUIZ") {
          const quiz = quizFromActivity(a);
          if (quiz) {
            const attempt = quizAttempts.get(a.id);
            return {
              ...base,
              questions: studentQuizQuestions(quiz),
              quizMinutes: quiz.minutes || null,
              quizAttempt: attempt ? { score: attempt.score, maxScore: attempt.maxScore, submittedAt: attempt.submittedAt } : null,
            };
          }
          return {
            ...base,
            questions: studentQuizQuestionsForActivity(a.name, code),
          };
        }
        return base;
      }),
  }));

  return StudentCourseLmsResponse.parse({
    sectionId,
    courseCode: code,
    courseTitle: title,
    academicBlock: block
      ? {
          id: block.id,
          code: block.code,
          name: block.name,
          startsOn: block.startsOn,
          endsOn: block.endsOn,
        }
      : null,
    dayBlocks: enrolment.section.dayBlocks.map((d) => ({
      id: d.id,
      label: d.label,
      title: d.title,
      sortOrder: d.sortOrder,
      lessons: d.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        body: l.body,
        resourceHref: l.resourceHref,
        sortOrder: l.sortOrder,
        completed: completed.has(`lesson:${l.id}`),
      })),
    })),
    folders: enrolment.section.folders.map((f) => ({
      id: f.id,
      name: f.name,
      sortOrder: f.sortOrder,
      items: f.items.map((i) => ({
        id: i.id,
        title: i.title,
        kind: i.kind,
        href: i.href,
        sizeLabel: i.sizeLabel,
      })),
    })),
    syllabus: enrolment.section.syllabusTopics.map((t) => ({
      id: t.id,
      title: t.title,
      level: t.level,
      sortOrder: t.sortOrder,
    })),
    topics,
    evaluationRows: lms.evaluationRows || [],
    gradeScheme: gradeSchemeFromLms(lms),
    sessionLabel,
    location,
    instructorName,
    joinUrl: lms.joinUrl || joinUrl,
  });
}

export async function submitStudentChoiceResponse(
  user: SessionClaims,
  sectionId: string,
  activityId: string,
  body: unknown,
) {
  const student = await requireStudent(user, sectionId);
  const course = await getStudentCourseLms(user, sectionId);
  const activity = course.topics.flatMap((topic) => topic.activities).find((item) => item.id === activityId && item.type === "CHOICE");
  if (!activity?.choice) throw httpError("This choice is not available", "NOT_FOUND", 404);
  const raw = (body as { selected?: unknown } | null)?.selected;
  if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) {
    throw httpError("Select an available choice", "VALIDATION_ERROR", 400);
  }
  const selected = [...new Set(raw.map((item) => item.trim()).filter(Boolean))];
  if (!selected.length || selected.some((item) => !activity.choice!.options.includes(item))) {
    throw httpError("Select an available choice", "VALIDATION_ERROR", 400);
  }
  if (!activity.choice.multiple && selected.length !== 1) {
    throw httpError("Select one choice", "VALIDATION_ERROR", 400);
  }
  const response: ChoiceResponse = { selected, submittedAt: new Date().toISOString() };
  const path = `/student/lms-choice/${sectionId}/${activityId}/${student.id}`;
  await prisma.sisScreenState.upsert({
    where: { institutionId_path: { institutionId: user.institutionId, path } },
    create: { institutionId: user.institutionId, path, payloadJson: JSON.stringify(response) },
    update: { payloadJson: JSON.stringify(response) },
  });
  return response;
}

export async function getCourseEvaluation(user: SessionClaims, evaluationId: string) {
  const student = await requireStudent(user);
  const row = await prisma.courseEvaluation.findFirst({
    where: { id: evaluationId, institutionId: user.institutionId, studentId: student.id },
  });
  if (!row) throw httpError("Evaluation not found", "NOT_FOUND", 404);
  return presentEvaluation(row);
}

export async function submitCourseEvaluation(
  user: SessionClaims,
  evaluationId: string,
  body: unknown,
  correlationId: string,
) {
  const student = await requireStudent(user);
  const parsed = SubmitCourseEvaluationRequest.safeParse(body);
  if (!parsed.success) {
    throw Object.assign(new Error("Invalid evaluation"), {
      code: "VALIDATION_ERROR",
      status: 400,
      issues: parsed.error.issues,
    });
  }
  const row = await prisma.courseEvaluation.findFirst({
    where: { id: evaluationId, institutionId: user.institutionId, studentId: student.id },
  });
  if (!row) throw httpError("Evaluation not found", "NOT_FOUND", 404);
  if (row.status === "submitted") {
    return SubmitCourseEvaluationResponse.parse({ evaluation: presentEvaluation(row) });
  }

  const responses = {
    teachingQuality: parsed.data.teachingQuality,
    courseMaterials: parsed.data.courseMaterials,
    workload: parsed.data.workload,
    comments: parsed.data.comments ?? "",
  };
  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.courseEvaluation.update({
      where: { id: row.id },
      data: {
        status: "submitted",
        submittedAt: new Date(),
        overallRating: parsed.data.overallRating,
        responsesJson: JSON.stringify(responses),
      },
    });
    await writeAuditAndOutbox(tx, {
      institutionId: user.institutionId,
      actorId: user.accountId,
      eventName: "CourseEvaluation.submitted",
      purpose: "course_evaluation",
      before: row,
      after: next,
      source: "student.evaluations.submit",
      correlationId,
    });
    return next;
  });
  return SubmitCourseEvaluationResponse.parse({ evaluation: presentEvaluation(updated) });
}

export async function listMailbox(user: SessionClaims, folderId?: string | null) {
  const folders = await ensureMailFolders(user.institutionId, user.accountId);
  const selected =
    (folderId ? folders.find((f) => f.id === folderId) : null) ??
    folders.find((f) => f.kind === "inbox") ??
    folders[0] ??
    null;

  const placements = selected
    ? await prisma.mailThreadPlacement.findMany({
        where: { institutionId: user.institutionId, accountId: user.accountId, folderId: selected.id },
        include: {
          thread: { include: { messages: { orderBy: { createdAt: "asc" }, take: 120 } } },
          folder: true,
        },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  const unreadByFolder = await prisma.mailThreadPlacement.groupBy({
    by: ["folderId"],
    where: { institutionId: user.institutionId, accountId: user.accountId, readAt: null },
    _count: { _all: true },
  });
  const unreadMap = new Map(unreadByFolder.map((r) => [r.folderId, r._count._all]));

  const participantIds = new Set<string>();
  for (const p of placements) {
    try {
      const ids = JSON.parse(p.thread.participantAccountIdsJson) as string[];
      ids.forEach((id) => participantIds.add(id));
    } catch {
      /* ignore */
    }
  }
  const people = participantIds.size
    ? await prisma.account.findMany({
        where: { id: { in: [...participantIds] } },
        include: { person: true },
      })
    : [];
  const nameByAccount = new Map(
    people.map((a) => [a.id, `${a.person.givenName} ${a.person.familyName}`.trim() || a.email]),
  );

  return MailboxListResponse.parse({
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      kind: f.kind as MailboxListResponse["folders"][number]["kind"],
      sortOrder: f.sortOrder,
      unreadCount: unreadMap.get(f.id) ?? 0,
    })),
    threads: placements.map((p) => {
      let participantIds: string[] = [];
      try {
        participantIds = JSON.parse(p.thread.participantAccountIdsJson) as string[];
      } catch {
        participantIds = [];
      }
      const participants = participantIds.map((id) => nameByAccount.get(id) ?? id.slice(0, 8));
      const otherId = participantIds.find((id) => id !== user.accountId) ?? null;
      const otherName = otherId ? nameByAccount.get(otherId) ?? "Campus contact" : participants[0] ?? "Conversation";
      const latest = p.thread.messages[p.thread.messages.length - 1];
      return {
        id: p.threadId,
        subject: p.thread.subject,
        preview: latest?.body?.slice(0, 160) ?? "",
        folderId: p.folderId,
        folderKind: p.folder.kind,
        participants,
        participantNames: participants,
        otherName,
        flagged: p.flagged,
        updatedAt: p.updatedAt.toISOString(),
        readAt: p.readAt?.toISOString() ?? null,
        chat: p.thread.messages.map((m) => ({
          id: m.id,
          kind: "message" as const,
          from: m.senderAccountId === user.accountId ? ("me" as const) : ("them" as const),
          text: m.body,
          time: m.createdAt.toISOString(),
        })),
      };
    }),
    selectedFolderId: selected?.id ?? null,
  });
}

export async function createCustomMailFolder(user: SessionClaims, body: unknown) {
  const parsed = CreateMailFolderRequest.safeParse(body);
  if (!parsed.success) {
    throw Object.assign(new Error("Invalid folder name"), {
      code: "VALIDATION_ERROR",
      status: 400,
      issues: parsed.error.issues,
    });
  }
  await ensureMailFolders(user.institutionId, user.accountId);
  const maxSort = await prisma.mailFolder.aggregate({
    where: { accountId: user.accountId },
    _max: { sortOrder: true },
  });
  const folder = await prisma.mailFolder.create({
    data: {
      id: randomUUID(),
      institutionId: user.institutionId,
      accountId: user.accountId,
      name: parsed.data.name,
      kind: "custom",
      sortOrder: (maxSort._max.sortOrder ?? 4) + 1,
    },
  });
  return { id: folder.id, name: folder.name, kind: "custom" as const };
}

export async function composeMail(user: SessionClaims, body: unknown, correlationId: string) {
  const parsed = ComposeMailRequest.safeParse(body);
  if (!parsed.success) {
    throw Object.assign(new Error("Invalid compose payload"), {
      code: "VALIDATION_ERROR",
      status: 400,
      issues: parsed.error.issues,
    });
  }
  const folders = await ensureMailFolders(user.institutionId, user.accountId);
  const attachments = (parsed.data.attachments ?? []).map(validateMailAttachment);
  const asDraft = Boolean(parsed.data.asDraft);
  const senderFolder = folders.find((f) => f.kind === (asDraft ? "drafts" : "outbox"));
  const inboxByAccount = new Map<string, string>();

  const recipientIds = [...new Set(parsed.data.toAccountIds.filter((id) => id !== user.accountId))];
  if (!asDraft && !recipientIds.length) throw httpError("At least one recipient required", "VALIDATION_ERROR", 400);
  const deliverIds = [...new Set([...recipientIds, ...(parsed.data.ccAccountIds ?? []), ...(parsed.data.bccAccountIds ?? [])].filter((id) => id !== user.accountId))];

  const audience = await listAudienceAccounts(user);
  const allowedRecipientIds = new Set(
    [...audience.instructors, ...audience.classmates, ...audience.staff].map((item) => item.accountId),
  );
  const forbidden = deliverIds.find((id) => !allowedRecipientIds.has(id));
  if (forbidden) {
    throw httpError("Recipient is outside your permitted course or staff audience", "FORBIDDEN", 403);
  }

  for (const accountId of deliverIds) {
    const account = await prisma.account.findFirst({
      where: { id: accountId, institutionId: user.institutionId },
    });
    if (!account) throw httpError("Recipient not found", "NOT_FOUND", 404);
    const rf = await ensureMailFolders(user.institutionId, accountId);
    const inbox = rf.find((f) => f.kind === "inbox");
    if (inbox) inboxByAccount.set(accountId, inbox.id);
  }

  if (!senderFolder) throw httpError("Mailbox folders missing", "CONFLICT", 409);

  const threadId = randomUUID();
  const messageId = randomUUID();
  const ccIds = [...new Set((parsed.data.ccAccountIds ?? []).filter((id) => id !== user.accountId))];
  const bccIds = [...new Set((parsed.data.bccAccountIds ?? []).filter((id) => id !== user.accountId))];
  const participants = [...new Set([user.accountId, ...recipientIds, ...ccIds])];
  await prisma.$transaction(async (tx) => {
    await tx.messageThread.create({
      data: {
        id: threadId,
        institutionId: user.institutionId,
        subject: parsed.data.subject,
        participantAccountIdsJson: JSON.stringify(participants),
        messageType: parsed.data.messageType ?? "standard",
        ccAccountIdsJson: JSON.stringify(ccIds),
        bccAccountIdsJson: JSON.stringify(bccIds),
        messages: {
          create: {
            id: messageId,
            institutionId: user.institutionId,
            senderAccountId: user.accountId,
            body: parsed.data.body,
            attachments: attachments.length ? {
              create: attachments.map((file) => ({ ...file, institutionId: user.institutionId })),
            } : undefined,
          },
        },
      },
    });
    await tx.mailThreadPlacement.create({
      data: {
        id: randomUUID(),
        institutionId: user.institutionId,
        accountId: user.accountId,
        threadId,
        folderId: senderFolder.id,
        readAt: new Date(),
      },
    });
    if (!asDraft) {
      for (const [accountId, folderId] of inboxByAccount) {
        await tx.mailThreadPlacement.create({
          data: {
            id: randomUUID(),
            institutionId: user.institutionId,
            accountId,
            threadId,
            folderId,
            readAt: null,
          },
        });
      }
    }
    await writeAuditAndOutbox(tx, {
      institutionId: user.institutionId,
      actorId: user.accountId,
      eventName: asDraft ? "Mail.draftSaved" : "Mail.sent",
      purpose: "messaging",
      before: null,
        after: { threadId, subject: parsed.data.subject, asDraft, attachmentCount: attachments.length },
      source: "student.mail.compose",
      correlationId,
    });
  });

  return ComposeMailResponse.parse({
    threadId,
    folderKind: asDraft ? "drafts" : "outbox",
  });
}

export async function replyMail(user: SessionClaims, threadId: string, body: unknown, correlationId: string) {
  const parsed = ReplyMailRequest.safeParse(body);
  if (!parsed.success) {
    throw Object.assign(new Error("Invalid reply"), {
      code: "VALIDATION_ERROR",
      status: 400,
      issues: parsed.error.issues,
    });
  }

  const placement = await prisma.mailThreadPlacement.findFirst({
    where: { institutionId: user.institutionId, accountId: user.accountId, threadId },
    include: { thread: true },
  });
  if (!placement) throw httpError("Thread not found", "NOT_FOUND", 404);

  let participantIds: string[] = [];
  try {
    participantIds = JSON.parse(placement.thread.participantAccountIdsJson) as string[];
  } catch {
    participantIds = [user.accountId];
  }
  if (!participantIds.includes(user.accountId)) {
    throw httpError("Not a participant", "FORBIDDEN", 403);
  }

  const recipients = participantIds.filter((id) => id !== user.accountId);
  const folders = await ensureMailFolders(user.institutionId, user.accountId);
  const outbox = folders.find((f) => f.kind === "outbox");
  const inboxByAccount = new Map<string, string>();
  for (const accountId of recipients) {
    const rf = await ensureMailFolders(user.institutionId, accountId);
    const inbox = rf.find((f) => f.kind === "inbox");
    if (inbox) inboxByAccount.set(accountId, inbox.id);
  }

  await prisma.$transaction(async (tx) => {
    await tx.message.create({
      data: {
        id: randomUUID(),
        institutionId: user.institutionId,
        threadId,
        senderAccountId: user.accountId,
        body: parsed.data.body,
      },
    });
    await tx.messageThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date(), rowVersion: { increment: 1 } },
    });
    // One placement per account per thread (@@unique([accountId, threadId])): move it, never add a second.
    await tx.mailThreadPlacement.updateMany({
      where: { threadId, accountId: user.accountId },
      data: { updatedAt: new Date(), readAt: new Date() },
    });
    if (outbox) {
      const mine = await tx.mailThreadPlacement.findFirst({ where: { threadId, accountId: user.accountId } });
      if (!mine) {
        await tx.mailThreadPlacement.create({
          data: {
            id: randomUUID(),
            institutionId: user.institutionId,
            accountId: user.accountId,
            threadId,
            folderId: outbox.id,
            readAt: new Date(),
          },
        });
      }
    }
    for (const [accountId, folderId] of inboxByAccount) {
      const existing = await tx.mailThreadPlacement.findFirst({
        where: { threadId, accountId },
      });
      if (existing) {
        await tx.mailThreadPlacement.update({
          where: { id: existing.id },
          data: { folderId, updatedAt: new Date(), readAt: null },
        });
      } else {
        await tx.mailThreadPlacement.create({
          data: {
            id: randomUUID(),
            institutionId: user.institutionId,
            accountId,
            threadId,
            folderId,
            readAt: null,
          },
        });
      }
    }
    await writeAuditAndOutbox(tx, {
      institutionId: user.institutionId,
      actorId: user.accountId,
      eventName: "Mail.replied",
      purpose: "messaging",
      before: null,
      after: { threadId },
      source: "student.mail.reply",
      correlationId,
    });
  });

  return { threadId, ok: true as const };
}

export async function getMailboxSettings(user: SessionClaims) {
  const row = await ensureMailboxSettings(user.institutionId, user.accountId);
  const account = await prisma.account.findFirst({ where: { id: user.accountId } });
  return MailboxSettingsView.parse({
    emailAddress: account?.email,
    forwardingEnabled: row.forwardingEnabled,
    forwardingAddress: row.forwardingAddress,
    smsForwardingEnabled: row.smsForwardingEnabled,
    signature: row.signature,
    popupNotifications: row.popupNotifications,
    notificationSound: row.notificationSound,
    autoResponderEnabled: row.autoResponderEnabled,
    autoResponderBody: row.autoResponderBody,
  });
}

export async function updateMailboxSettings(user: SessionClaims, body: unknown) {
  const parsed = UpdateMailboxSettingsRequest.safeParse(body);
  if (!parsed.success) {
    throw Object.assign(new Error("Invalid settings"), {
      code: "VALIDATION_ERROR",
      status: 400,
      issues: parsed.error.issues,
    });
  }

  let policy = await prisma.institutionMailPolicy.findUnique({
    where: { institutionId: user.institutionId },
  });
  if (!policy) {
    policy = await prisma.institutionMailPolicy.create({ data: { institutionId: user.institutionId } });
  }
  if (parsed.data.forwardingEnabled && !policy.allowStudentForwarding) {
    throw Object.assign(new Error("Institution policy disables e-mail forwarding"), {
      code: "FORBIDDEN",
      status: 403,
    });
  }
  if (parsed.data.smsForwardingEnabled && !policy.allowSmsForwarding) {
    throw Object.assign(new Error("Institution policy disables SMS forwarding"), {
      code: "FORBIDDEN",
      status: 403,
    });
  }
  if (
    parsed.data.forwardingAddress &&
    parsed.data.forwardingAddress.length > policy.maxForwardAddressLength
  ) {
    throw Object.assign(new Error("Forwarding address exceeds policy length"), {
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }

  await ensureMailboxSettings(user.institutionId, user.accountId);
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.mailboxSettings.update({
      where: { accountId: user.accountId },
      data: {
      ...(parsed.data.forwardingEnabled !== undefined
        ? { forwardingEnabled: parsed.data.forwardingEnabled }
        : {}),
      ...(parsed.data.forwardingAddress !== undefined
        ? { forwardingAddress: parsed.data.forwardingAddress }
        : {}),
      ...(parsed.data.smsForwardingEnabled !== undefined
        ? { smsForwardingEnabled: parsed.data.smsForwardingEnabled }
        : {}),
      ...(parsed.data.signature !== undefined ? { signature: parsed.data.signature } : {}),
      ...(parsed.data.popupNotifications !== undefined
        ? { popupNotifications: parsed.data.popupNotifications }
        : {}),
      ...(parsed.data.notificationSound !== undefined
        ? { notificationSound: parsed.data.notificationSound }
        : {}),
      ...(parsed.data.autoResponderEnabled !== undefined
        ? { autoResponderEnabled: parsed.data.autoResponderEnabled }
        : {}),
      ...(parsed.data.autoResponderBody !== undefined
        ? { autoResponderBody: parsed.data.autoResponderBody }
        : {}),
      },
    });

    if (
      policy.requireRegistrarAudit &&
      (parsed.data.forwardingEnabled !== undefined ||
        parsed.data.forwardingAddress !== undefined ||
        parsed.data.smsForwardingEnabled !== undefined)
    ) {
      await writeAuditAndOutbox(tx, {
        institutionId: user.institutionId,
        actorId: user.accountId,
        eventName: "MailboxSettings.forwardingChanged",
        purpose: "mail_policy_audit",
        before: null,
        after: {
          forwardingEnabled: updated.forwardingEnabled,
          forwardingAddress: updated.forwardingAddress,
          smsForwardingEnabled: updated.smsForwardingEnabled,
        },
        source: "student.mail.settings",
        correlationId: randomUUID(),
      });
    }
    return updated;
  });

  return MailboxSettingsView.parse({
    emailAddress: (await prisma.account.findFirst({ where: { id: user.accountId } }))?.email,
    forwardingEnabled: row.forwardingEnabled,
    forwardingAddress: row.forwardingAddress,
    smsForwardingEnabled: row.smsForwardingEnabled,
    signature: row.signature,
    popupNotifications: row.popupNotifications,
    notificationSound: row.notificationSound,
    autoResponderEnabled: row.autoResponderEnabled,
    autoResponderBody: row.autoResponderBody,
  });
}

export async function listAudienceAccounts(user: SessionClaims) {
  const instructors = new Map<string, { accountId: string; name: string; group: string }>();
  const classmates = new Map<string, { accountId: string; name: string; group: string }>();

  if (user.roles.includes("student")) {
    const student = await requireStudent(user);
    const enrolments = await prisma.enrolment.findMany({
      where: { institutionId: user.institutionId, studentId: student.id, status: "enrolled" },
      include: {
        section: {
          include: {
            enrolments: {
              where: { status: "enrolled" },
              include: { student: { include: { person: { include: { accounts: true } } } } },
            },
          },
        },
      },
    });
    for (const e of enrolments) {
      const instructorAccount = await prisma.account.findFirst({
        where: { institutionId: user.institutionId, personId: e.section.instructorPersonId },
        include: { person: true },
      });
      if (instructorAccount) {
        instructors.set(instructorAccount.id, {
          accountId: instructorAccount.id,
          name: `${instructorAccount.person.givenName} ${instructorAccount.person.familyName}`.trim(),
          group: "instructors",
        });
      }
      for (const peer of e.section.enrolments) {
        if (peer.studentId === student.id) continue;
        const account = peer.student.person.accounts[0];
        if (!account) continue;
        classmates.set(account.id, {
          accountId: account.id,
          name: `${peer.student.person.givenName} ${peer.student.person.familyName}`.trim(),
          group: "classmates",
        });
      }
    }
  } else if (user.roles.includes("instructor")) {
    const sections = await prisma.section.findMany({
      where: { institutionId: user.institutionId, instructorPersonId: user.personId },
      include: {
        enrolments: {
          where: { status: "enrolled" },
          include: { student: { include: { person: { include: { accounts: true } } } } },
          take: 200,
        },
      },
    });
    for (const sec of sections) {
      for (const e of sec.enrolments) {
        const account = e.student.person.accounts[0];
        if (!account) continue;
        classmates.set(account.id, {
          accountId: account.id,
          name: `${e.student.person.givenName} ${e.student.person.familyName}`.trim(),
          group: "students",
        });
      }
    }
  }

  const accounts = await prisma.account.findMany({
    where: { institutionId: user.institutionId, status: "active", id: { not: user.accountId } },
    select: { id: true, rolesJson: true, person: { select: { givenName: true, familyName: true } } },
  });
  const staff = new Map<string, { accountId: string; name: string; group: string }>();
  const isStaffUser = !user.roles.includes("student") && !user.roles.includes("instructor");
  for (const a of accounts) {
    const r = parseRoles(a.rolesJson);
    const name = `${a.person.givenName} ${a.person.familyName}`.trim();
    // Students must be able to contact Student Services / Academic Advising.
    // The audience is already institution-scoped, and composeMail validates
    // every recipient against this same list before delivering a message.
    if (r.includes("admin") || r.includes("registrar")) staff.set(a.id, { accountId: a.id, name, group: "staff" });
    else if (r.includes("instructor") && !user.roles.includes("student")) instructors.set(a.id, { accountId: a.id, name, group: "instructors" });
    else if (r.includes("student") && isStaffUser) classmates.set(a.id, { accountId: a.id, name, group: "students" });
  }

  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  return {
    instructors: [...instructors.values()].sort(byName),
    classmates: [...classmates.values()].sort(byName),
    staff: [...staff.values()].sort(byName),
  };
}

function parseRoles(json: string) {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as string[]) : [];
  } catch {
    return [];
  }
}

/** "To" is relative to the thread's original sender, not the viewer, so recipients see themselves listed. */
export function threadRecipients(participantIds: string[], senderId: string | undefined, ccIds: string[] = [], bccIds: string[] = []) {
  const copied = new Set([...ccIds, ...bccIds]);
  const to = participantIds.filter((id) => id !== senderId && !copied.has(id));
  return to.length ? to : senderId ? [senderId] : [];
}

export const visibleBccRecipients = (bccIds: string[], originalSenderId: string | undefined, viewerAccountId: string) =>
  originalSenderId === viewerAccountId ? bccIds : [];

export async function getMailThread(user: SessionClaims, threadId: string) {
  const placement = await prisma.mailThreadPlacement.findFirst({
    where: { institutionId: user.institutionId, accountId: user.accountId, threadId },
    include: {
      thread: {
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 200,
            include: { attachments: { orderBy: { createdAt: "asc" } } },
          },
        },
      },
      folder: true,
    },
  });
  if (!placement) throw httpError("Thread not found", "NOT_FOUND", 404);
  await prisma.mailThreadPlacement.update({
    where: { id: placement.id },
    data: { readAt: new Date() },
  });

  let participantIds: string[] = [];
  try {
    participantIds = JSON.parse(placement.thread.participantAccountIdsJson) as string[];
  } catch {
    participantIds = [];
  }
  let ccIds: string[] = [];
  let bccIds: string[] = [];
  try {
    ccIds = JSON.parse(placement.thread.ccAccountIdsJson || "[]") as string[];
    bccIds = JSON.parse(placement.thread.bccAccountIdsJson || "[]") as string[];
  } catch {
    /* ignore */
  }
  const originalSenderId = placement.thread.messages[0]?.senderAccountId;
  const visibleBccIds = visibleBccRecipients(bccIds, originalSenderId, user.accountId);
  const people = await prisma.account.findMany({
    where: { id: { in: [...new Set([...participantIds, ...ccIds, ...visibleBccIds])] } },
    include: { person: true },
  });
  const nameOf = (id: string) => {
    const a = people.find((p) => p.id === id);
    return a ? `${a.person.givenName} ${a.person.familyName}`.trim() || a.email : id.slice(0, 8);
  };
  const emailOf = (id: string) => people.find((p) => p.id === id)?.email ?? "";

  return {
    id: placement.threadId,
    subject: placement.thread.subject,
    messageType: placement.thread.messageType,
    folderKind: placement.folder.kind,
    flagged: placement.flagged,
    from: (() => {
      const first = placement.thread.messages[0];
      return first
        ? { accountId: first.senderAccountId, name: nameOf(first.senderAccountId), email: emailOf(first.senderAccountId) }
        : null;
    })(),
    to: threadRecipients(participantIds, placement.thread.messages[0]?.senderAccountId, ccIds, bccIds).map((id) => ({ accountId: id, name: nameOf(id), email: emailOf(id) })),
    cc: ccIds.map((id) => ({ accountId: id, name: nameOf(id), email: emailOf(id) })),
    bcc: visibleBccIds.map((id) => ({ accountId: id, name: nameOf(id), email: emailOf(id) })),
    messages: placement.thread.messages.map((m) => ({
      id: m.id,
      from: m.senderAccountId === user.accountId ? "me" : "them",
      senderAccountId: m.senderAccountId,
      senderName: nameOf(m.senderAccountId),
      senderEmail: emailOf(m.senderAccountId),
      text: m.body,
      time: m.createdAt.toISOString(),
      attachments: m.attachments.map((file) => ({ id: file.id, name: file.name, mime: file.mime, sizeBytes: file.sizeBytes })),
    })),
  };
}

export async function getMailAttachment(user: SessionClaims, threadId: string, attachmentId: string) {
  const placement = await prisma.mailThreadPlacement.findFirst({
    where: { institutionId: user.institutionId, accountId: user.accountId, threadId },
    select: { id: true },
  });
  if (!placement) throw httpError("Thread not found", "NOT_FOUND", 404);
  const attachment = await prisma.messageAttachment.findFirst({
    where: { id: attachmentId, institutionId: user.institutionId, message: { threadId } },
  });
  if (!attachment) throw httpError("Attachment not found", "NOT_FOUND", 404);
  return { id: attachment.id, name: attachment.name, mime: attachment.mime, sizeBytes: attachment.sizeBytes, base64: attachment.contentBase64 };
}

export async function searchMail(user: SessionClaims, query: {
  start?: string;
  end?: string;
  title?: string;
  name?: string;
  content?: string;
}) {
  const folders = await ensureMailFolders(user.institutionId, user.accountId);
  const placements = await prisma.mailThreadPlacement.findMany({
    where: { institutionId: user.institutionId, accountId: user.accountId },
    include: {
      thread: { include: { messages: { orderBy: { createdAt: "desc" }, take: 5 } } },
      folder: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const titleQ = (query.title || "").trim().toLowerCase();
  const nameQ = (query.name || "").trim().toLowerCase();
  const contentQ = (query.content || "").trim().toLowerCase();
  const start = query.start ? new Date(query.start) : null;
  const end = query.end ? new Date(query.end) : null;

  const peopleCache = new Map<string, string>();
  async function resolveNames(ids: string[]) {
    const missing = ids.filter((id) => !peopleCache.has(id));
    if (missing.length) {
      const rows = await prisma.account.findMany({
        where: { id: { in: missing } },
        include: { person: true },
      });
      for (const a of rows) {
        peopleCache.set(a.id, `${a.person.givenName} ${a.person.familyName} ${a.email}`.toLowerCase());
      }
    }
  }

  const results = [];
  for (const p of placements) {
    if (start && p.updatedAt < start) continue;
    if (end && p.updatedAt > end) continue;
    if (titleQ && !p.thread.subject.toLowerCase().includes(titleQ)) continue;
    let participantIds: string[] = [];
    try {
      participantIds = JSON.parse(p.thread.participantAccountIdsJson) as string[];
    } catch {
      participantIds = [];
    }
    await resolveNames(participantIds);
    const namesBlob = participantIds.map((id) => peopleCache.get(id) || "").join(" ");
    if (nameQ && !namesBlob.includes(nameQ)) continue;
    const bodyBlob = p.thread.messages.map((m) => m.body).join("\n").toLowerCase();
    if (contentQ && !bodyBlob.includes(contentQ)) continue;
    results.push({
      id: p.threadId,
      subject: p.thread.subject,
      preview: p.thread.messages[0]?.body?.slice(0, 160) ?? "",
      folderKind: p.folder.kind,
      folderName: folders.find((f) => f.id === p.folderId)?.name ?? p.folder.name,
      updatedAt: p.updatedAt.toISOString(),
      readAt: p.readAt?.toISOString() ?? null,
    });
  }
  return { items: results };
}

export async function bulkMailAction(
  user: SessionClaims,
  body: { threadIds: string[]; action: string },
) {
  const { threadIds, action } = body;
  const placements = await prisma.mailThreadPlacement.findMany({
    where: {
      institutionId: user.institutionId,
      accountId: user.accountId,
      threadId: { in: threadIds },
    },
  });
  const folders = await ensureMailFolders(user.institutionId, user.accountId);
  const deleted = folders.find((f) => f.kind === "deleted");
  const junk = folders.find((f) => f.kind === "junk");
  const inbox = folders.find((f) => f.kind === "inbox");

  for (const p of placements) {
    if (action === "purge") {
      await prisma.mailThreadPlacement.delete({ where: { id: p.id } });
    } else if (action === "mark_read") {
      await prisma.mailThreadPlacement.update({ where: { id: p.id }, data: { readAt: new Date() } });
    } else if (action === "mark_unread") {
      await prisma.mailThreadPlacement.update({ where: { id: p.id }, data: { readAt: null } });
    } else if (action === "flag") {
      await prisma.mailThreadPlacement.update({ where: { id: p.id }, data: { flagged: true } });
    } else if (action === "unflag") {
      await prisma.mailThreadPlacement.update({ where: { id: p.id }, data: { flagged: false } });
    } else if ((action === "delete" || action === "delete_drafts") && deleted) {
      await prisma.mailThreadPlacement.update({ where: { id: p.id }, data: { folderId: deleted.id } });
    } else if (action === "mark_not_junk" && inbox) {
      await prisma.mailThreadPlacement.update({ where: { id: p.id }, data: { folderId: inbox.id } });
    } else if (action === "restore" && inbox) {
      await prisma.mailThreadPlacement.update({ where: { id: p.id }, data: { folderId: inbox.id } });
    } else if (action === "move_junk" && junk) {
      await prisma.mailThreadPlacement.update({ where: { id: p.id }, data: { folderId: junk.id } });
    }
  }
  return { ok: true, count: placements.length };
}

export async function listDistributionLists(user: SessionClaims) {
  const rows = await prisma.mailDistributionList.findMany({
    where: { institutionId: user.institutionId, accountId: user.accountId },
    orderBy: { name: "asc" },
  });
  return {
    items: rows.map((r) => {
      let members: string[] = [];
      try {
        members = JSON.parse(r.memberAccountIdsJson) as string[];
      } catch {
        members = [];
      }
      return { id: r.id, name: r.name, recipientCount: members.length, memberAccountIds: members };
    }),
  };
}

export async function createDistributionList(user: SessionClaims, body: { name: string; memberAccountIds?: string[] }) {
  const name = body.name.trim();
  if (!name) throw httpError("List name required", "VALIDATION_ERROR", 400);
  const row = await prisma.mailDistributionList.create({
    data: {
      institutionId: user.institutionId,
      accountId: user.accountId,
      name,
      memberAccountIdsJson: JSON.stringify(body.memberAccountIds ?? []),
    },
  });
  return { id: row.id, name: row.name, recipientCount: (body.memberAccountIds ?? []).length };
}
