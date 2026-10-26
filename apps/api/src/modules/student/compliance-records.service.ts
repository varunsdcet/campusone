import type { SessionClaims } from "@myheritage/contracts";
import { prisma } from "@myheritage/db";
import { personStudentIds } from "../me/studentAlignment.js";

type Json = Record<string, unknown>;

function dataOf(value: string): Json {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Json : {};
  } catch {
    return {};
  }
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

const STUDENT_COMPLIANCE_SCREENS = ["OPS:CP_HOLD", "OPS:CP_PRIVACY", "OPS:CP_DISPOSAL"] as const;

/**
 * Student-safe projection of Compliance records. Internal staff ids, policy ids,
 * custodian notes and disposal notes deliberately never leave this boundary.
 */
export async function listStudentComplianceRecords(user: SessionClaims) {
  const profiles = await personStudentIds(user.institutionId, user.personId);
  const studentIds = profiles.map((profile) => profile.id);
  if (!studentIds.length) {
    return {
      summary: { activeLegalHolds: 0, openPrivacyRequests: 0, pendingDisposals: 0 },
      legalHolds: [],
      privacyRequests: [],
      disposals: [],
    };
  }

  const rows = await prisma.heritageRecord.findMany({
    where: {
      institutionId: user.institutionId,
      screenId: { in: [...STUDENT_COMPLIANCE_SCREENS] },
      deletedAt: null,
      singletonKey: null,
    },
    select: { id: true, screenId: true, dataJson: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  const mine = rows.flatMap((row) => {
    const data = dataOf(row.dataJson);
    return studentIds.includes(text(data.studentId)) ? [{ row, data }] : [];
  });

  const legalHolds = mine.flatMap(({ row, data }) => row.screenId === "OPS:CP_HOLD" ? [{
    id: row.id,
    matter: text(data.matter) || "Records hold",
    scope: text(data.scope) || "Student records",
    placedOn: text(data.placedOn) || null,
    releasedOn: text(data.releasedOn) || null,
    status: text(data.status) || "Active",
    reason: text(data.reason) || null,
    updatedAt: row.updatedAt.toISOString(),
  }] : []);

  const privacyRequests = mine.flatMap(({ row, data }) => row.screenId === "OPS:CP_PRIVACY" ? [{
    id: row.id,
    type: text(data.type) || "Privacy request",
    receivedOn: text(data.receivedOn) || null,
    dueOn: text(data.dueOn) || null,
    status: text(data.status) || "Received",
    closedOn: text(data.closedOn) || null,
    response: text(data.response) || null,
    updatedAt: row.updatedAt.toISOString(),
  }] : []);

  const disposals = mine.flatMap(({ row, data }) => row.screenId === "OPS:CP_DISPOSAL" ? [{
    id: row.id,
    records: text(data.records) || "Student records",
    eligibleOn: text(data.eligibleOn) || null,
    status: text(data.status) || "Proposed",
    disposedOn: text(data.disposedOn) || null,
    updatedAt: row.updatedAt.toISOString(),
  }] : []);

  return {
    summary: {
      activeLegalHolds: legalHolds.filter((item) => item.status === "Active").length,
      openPrivacyRequests: privacyRequests.filter((item) => !["Fulfilled", "Refused"].includes(item.status)).length,
      pendingDisposals: disposals.filter((item) => ["Proposed", "Approved"].includes(item.status)).length,
    },
    legalHolds,
    privacyRequests,
    disposals,
  };
}
