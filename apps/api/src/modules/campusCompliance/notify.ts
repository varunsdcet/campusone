import { createHash, randomUUID } from "crypto";
import { prisma } from "@myheritage/db";

export async function notifyAccount(input: {
  institutionId: string;
  accountId: string;
  title: string;
  body: string;
  templateKey: string;
}) {
  if (!input.accountId) return;
  const dedupeKey = createHash("sha256").update(`${input.templateKey}\0${input.title}\0${input.body}`).digest("hex");
  const duplicate = await prisma.notification.findFirst({
    where: {
      institutionId: input.institutionId,
      recipientAccountId: input.accountId,
      templateKey: input.templateKey,
      title: input.title,
      body: input.body,
    },
    select: { id: true },
  });
  if (duplicate) return;
  try {
    await prisma.notification.create({
      data: {
        id: randomUUID(),
        institutionId: input.institutionId,
        recipientAccountId: input.accountId,
        channel: "in_app",
        title: input.title,
        body: input.body,
        templateKey: input.templateKey,
        dedupeKey,
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error;
  }
}

export async function notifyAccounts(input: {
  institutionId: string;
  accountIds: string[];
  title: string;
  body: string;
  templateKey: string;
}) {
  const unique = [...new Set(input.accountIds.filter(Boolean))];
  for (const accountId of unique) {
    await notifyAccount({ ...input, accountId });
  }
}

export async function accountIdsForStudents(institutionId: string, studentIds: string[]) {
  if (!studentIds.length) return [] as string[];
  const students = await prisma.student.findMany({
    where: { institutionId, id: { in: studentIds } },
    include: { person: { include: { accounts: true } } },
  });
  return students
    .map((s) => s.person.accounts.find((a) => a.status === "active" || a.status === "paused")?.id)
    .filter((id): id is string => Boolean(id));
}

export async function accountIdForPerson(institutionId: string, personId: string) {
  const account = await prisma.account.findFirst({
    where: { institutionId, personId },
    orderBy: { createdAt: "asc" },
  });
  return account?.id ?? null;
}

export async function adminAccountIds(institutionId: string) {
  const accounts = await prisma.account.findMany({
    where: { institutionId, status: "active" },
    select: { id: true, rolesJson: true },
  });
  return accounts
    .filter((a) => {
      try {
        const roles = JSON.parse(a.rolesJson) as string[];
        return roles.includes("admin") || roles.includes("registrar");
      } catch {
        return false;
      }
    })
    .map((a) => a.id);
}
