import { prisma } from "@myheritage/db";

type Payload = Record<string, unknown> & {
  notifyAccountId?: string;
  recipientAccountId?: string;
  accountId?: string;
  studentId?: string;
  studentIds?: string[];
  title?: string;
  body?: string;
};

export function configuredEventName(eventName: string) {
  if (/ApplicantApplication\.submitted/.test(eventName)) return "Application Submitted";
  if (/Student.*status/i.test(eventName)) return "Student Status Changes";
  if (/ApprovalRequest\.requested|Request\.submitted/.test(eventName)) return "Request Submitted";
  if (/ApprovalRequest\.(approved|applied)|Request\.approved/.test(eventName)) return "Request Approved";
  if (/ApprovalRequest\.(rejected|declined)|Request\.(rejected|declined)/.test(eventName)) return "Request Declined";
  if (/Flag|Hold/.test(eventName)) return "Flag / Hold Applied";
  if (/Account\.(created|registered)/.test(eventName)) return "Account Created";
  if (/Account\.passwordReset/.test(eventName)) return "Password Reset";
  if (/Enrolment\.(created|waitlist_promoted)|CourseRegistration/.test(eventName)) return "Course Registration";
  return null;
}

function json(raw: string) {
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
}

function render(template: string, payload: Payload) {
  return template.replace(/\{([^}]+)\}/g, (_match, key: string) => {
    const direct = payload[key];
    if (direct != null && typeof direct !== "object") return String(direct);
    const tail = key.split(".").pop() || key;
    const nested = payload[tail];
    return nested != null && typeof nested !== "object" ? String(nested) : "";
  });
}

async function runConfiguredTemplates(event: { institutionId: string; eventName: string }, payload: Payload) {
  const configuredEvent = configuredEventName(event.eventName);
  if (!configuredEvent) return;
  const templates = await prisma.heritageRecord.findMany({
    where: { institutionId: event.institutionId, screenId: "SYS:NOTIFICATION_TEMPLATE", deletedAt: null, singletonKey: null },
    select: { id: true, dataJson: true },
  });
  const matching = templates.map((row) => ({ id: row.id, data: json(row.dataJson) })).filter(({ data }) => data.event === configuredEvent && data.status !== "Inactive");
  if (!matching.length) return;
  const accountIds = new Set<string>();
  for (const key of [payload.notifyAccountId, payload.recipientAccountId, payload.accountId]) if (typeof key === "string") accountIds.add(key);
  const studentIds = [...new Set([...(Array.isArray(payload.studentIds) ? payload.studentIds : []), ...(typeof payload.studentId === "string" ? [payload.studentId] : [])])];
  if (studentIds.length) {
    const students = await prisma.student.findMany({
      where: { institutionId: event.institutionId, id: { in: studentIds } },
      include: { person: { include: { accounts: { where: { status: "active" } } } } },
    });
    for (const student of students) for (const account of student.person.accounts) accountIds.add(account.id);
  }
  for (const recipientAccountId of accountIds) {
    for (const template of matching) {
      const channel = String(template.data.channel || "In-App");
      await prisma.notification.create({
        data: {
          institutionId: event.institutionId,
          recipientAccountId,
          channel: channel === "SMS" ? "sms" : channel.startsWith("E-mail") ? "email" : "in_app",
          title: render(String(template.data.subject || template.data.name || configuredEvent), payload).slice(0, 255),
          body: render(String(channel === "SMS" ? template.data.sms || "" : template.data.body || ""), payload).slice(0, 4000),
          templateKey: `sysconfig:${template.id}`,
        },
      });
    }
  }
}

async function relayOnce() {
  const now = new Date();
  await prisma.eventOutbox.updateMany({
    where: { status: "processing", updatedAt: { lt: new Date(now.getTime() - 5 * 60_000) }, attempts: { lt: 8 } },
    data: { status: "pending", availableAt: now },
  });
  await prisma.eventOutbox.updateMany({
    where: { status: { in: ["pending", "processing"] }, attempts: { gte: 8 } },
    data: { status: "failed" },
  });
  const batch = await prisma.eventOutbox.findMany({
    where: { status: "pending", attempts: { lt: 8 }, availableAt: { lte: now } },
    take: 20,
    orderBy: { createdAt: "asc" },
  });

  for (const event of batch) {
    const claimed = await prisma.eventOutbox.updateMany({
      where: { id: event.id, status: "pending", attempts: event.attempts },
      data: { status: "processing", attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) continue;
    try {
      const payload = JSON.parse(event.payloadJson) as Payload;

      await runConfiguredTemplates(event, payload);

      if (event.eventName === "GradeItem.published") {
        const students = await prisma.student.findMany({
          where: {
            institutionId: event.institutionId,
            id: { in: payload.studentIds ?? [] },
          },
          include: { person: { include: { accounts: true } } },
        });
        for (const student of students) {
          const account = student.person.accounts[0];
          if (!account) continue;
          await prisma.notification.create({
            data: {
              institutionId: event.institutionId,
              recipientAccountId: account.id,
              channel: "in_app",
              title: "Grade published",
              body: "A new grade is available in MyHeritage.",
              templateKey: "grade.published",
            },
          });
        }
      }

      if (event.eventName === "Message.sent" && payload.notifyAccountId) {
        await prisma.notification.create({
          data: {
            institutionId: event.institutionId,
            recipientAccountId: payload.notifyAccountId,
            channel: "in_app",
            title: payload.title ?? "New message",
            body: payload.body ?? "",
            templateKey: "message.received",
          },
        });
      }

      if (event.eventName === "Compliance.sweep") {
        // Payload-only marker; API process owns the real sweep. Ack the event.
      }

      await prisma.eventOutbox.update({
        where: { id: event.id },
        data: { status: "delivered" },
      });
    } catch (err) {
      console.error("outbox failed", event.id, err);
      await prisma.eventOutbox.update({
        where: { id: event.id },
        data: {
          status: event.attempts + 1 >= 8 ? "failed" : "pending",
          availableAt: new Date(Date.now() + Math.min(15 * 60_000, 15_000 * 2 ** event.attempts)),
        },
      });
    }
  }
  return batch.length;
}

async function main() {
  console.log("MyHeritage workers: outbox relay started");
  for (;;) {
    const n = await relayOnce();
    if (n === 0) await new Promise((r) => setTimeout(r, 1500));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
