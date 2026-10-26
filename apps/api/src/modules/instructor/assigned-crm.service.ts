import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";

const LEAD_SCREEN = "OPS:CRM_LEAD";
const PROGRAM_SCREEN = "PM:PROGRAM";
const CAMPAIGN_SCREEN = "OPS:CRM_CAMPAIGN";
const EVENT_SCREEN = "OPS:CRM_EVENT";

const STAGE_TRANSITIONS: Record<string, readonly string[]> = {
  New: ["Contacted", "Qualified", "Lost"],
  Contacted: ["Qualified", "Lost"],
  Qualified: ["Applied", "Lost"],
  Applied: [],
  Admitted: [],
  Enrolled: [],
  Lost: ["Contacted"],
};

type Data = Record<string, unknown>;

function dataOf(value: string): Data {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Data : {};
  } catch {
    return {};
  }
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function displayName(data: Data, fallback: string) {
  return text(data.name) || text(data.title) || fallback;
}

function invalidTransition(from: string, to: string) {
  return Object.assign(new Error(`Lead cannot change from "${from}" to "${to}"`), {
    code: "INVALID_TRANSITION",
    status: 409,
  });
}

export function assertLeadStageTransition(from: string, to: string) {
  if (!(STAGE_TRANSITIONS[from] ?? []).includes(to)) throw invalidTransition(from, to);
}

async function labels(institutionId: string, screenId: string) {
  const rows = await prisma.heritageRecord.findMany({
    where: { institutionId, screenId, deletedAt: null },
    select: { id: true, dataJson: true },
  });
  return new Map(rows.map((row) => [row.id, displayName(dataOf(row.dataJson), "(removed)")]));
}

export async function listAssignedCrmLeads(user: SessionClaims) {
  const rows = await prisma.heritageRecord.findMany({
    where: { institutionId: user.institutionId, screenId: LEAD_SCREEN, deletedAt: null },
    select: { id: true, dataJson: true, createdAt: true, updatedAt: true },
    orderBy: [{ updatedAt: "desc" }],
  });
  const assigned = rows
    .map((row) => ({ ...row, data: dataOf(row.dataJson) }))
    .filter((row) => text(row.data.counsellorId) === user.personId);
  const [programs, campaigns, events] = await Promise.all([
    labels(user.institutionId, PROGRAM_SCREEN),
    labels(user.institutionId, CAMPAIGN_SCREEN),
    labels(user.institutionId, EVENT_SCREEN),
  ]);

  return assigned.map((row) => {
    const programId = text(row.data.programId);
    const campaignId = text(row.data.campaignId);
    const eventId = text(row.data.eventId);
    return {
      id: row.id,
      name: [text(row.data.firstName), text(row.data.lastName)].filter(Boolean).join(" ") || "Prospective student",
      email: text(row.data.email),
      phone: text(row.data.phone),
      programId,
      programName: programs.get(programId) || "Programme not selected",
      source: text(row.data.source) || "—",
      campaignName: campaigns.get(campaignId) || "",
      eventName: events.get(eventId) || "",
      stage: text(row.data.stage) || "New",
      nextFollowUp: text(row.data.nextFollowUp) || null,
      notes: text(row.data.notes),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export async function updateAssignedCrmLead(
  user: SessionClaims,
  id: string,
  input: { stage?: string; nextFollowUp?: string | null; notes?: string },
) {
  const row = await prisma.heritageRecord.findFirst({
    where: { id, institutionId: user.institutionId, screenId: LEAD_SCREEN, deletedAt: null },
    select: { id: true, dataJson: true },
  });
  if (!row) throw Object.assign(new Error("Assigned CRM lead not found"), { code: "NOT_FOUND", status: 404 });
  const current = dataOf(row.dataJson);
  if (text(current.counsellorId) !== user.personId) {
    throw Object.assign(new Error("Assigned CRM lead not found"), { code: "NOT_FOUND", status: 404 });
  }

  const next = { ...current };
  if (input.stage !== undefined && input.stage !== text(current.stage)) {
    assertLeadStageTransition(text(current.stage) || "New", input.stage);
    next.stage = input.stage;
  }
  if (input.nextFollowUp !== undefined) next.nextFollowUp = input.nextFollowUp || null;
  if (input.notes !== undefined) next.notes = input.notes.trim();

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.heritageRecord.update({
      where: { id: row.id },
      data: { dataJson: JSON.stringify(next), updatedById: user.accountId, rowVersion: { increment: 1 } },
      select: { id: true, updatedAt: true },
    });
    await tx.heritageAuditEntry.create({
      data: {
        institutionId: user.institutionId,
        screenId: LEAD_SCREEN,
        recordId: row.id,
        action: "counsellor update",
        actorId: user.accountId,
        beforeJson: JSON.stringify(current),
        afterJson: JSON.stringify(next),
        note: "Assigned counsellor updated lead progress",
      },
    });
    return saved;
  });
  return { id: updated.id, stage: text(next.stage) || "New", nextFollowUp: text(next.nextFollowUp) || null, updatedAt: updated.updatedAt.toISOString() };
}
