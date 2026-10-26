import { prisma } from "@myheritage/db";

export const ADMISSIONS_INTERVIEW_SCREEN = "OPS:AD_INTERVIEW";

export type AdmissionsInterview = {
  id: string;
  applicationId: string;
  interviewerId: string;
  scheduledAt: string;
  mode: string;
  location: string;
  status: string;
  score: number | null;
  recommendation: string;
  notes: string;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

export function safeInterviewMeetingUrl(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function parseRecord(row: { id: string; dataJson: string }): AdmissionsInterview | null {
  try {
    const data = JSON.parse(row.dataJson) as Record<string, unknown>;
    const applicationId = text(data.applicationId);
    const interviewerId = text(data.interviewerId);
    const scheduledAt = text(data.scheduledAt);
    if (!applicationId || !interviewerId || !scheduledAt) return null;
    const numericScore = Number(data.score);
    return {
      id: row.id,
      applicationId,
      interviewerId,
      scheduledAt,
      mode: text(data.mode),
      location: text(data.location),
      status: text(data.status),
      score: Number.isFinite(numericScore) && numericScore > 0 ? numericScore : null,
      recommendation: text(data.recommendation),
      notes: text(data.notes),
    };
  } catch {
    return null;
  }
}

export async function listAdmissionsInterviews(institutionId: string): Promise<AdmissionsInterview[]> {
  const rows = await prisma.heritageRecord.findMany({
    where: { institutionId, screenId: ADMISSIONS_INTERVIEW_SCREEN, deletedAt: null, singletonKey: null },
    select: { id: true, dataJson: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(parseRecord).filter((row): row is AdmissionsInterview => Boolean(row));
}

export async function listApplicationInterviews(institutionId: string, applicationId: string): Promise<AdmissionsInterview[]> {
  return (await listAdmissionsInterviews(institutionId))
    .filter((row) => row.applicationId === applicationId)
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
}

export async function listInterviewerInterviews(institutionId: string, interviewerPersonId: string): Promise<AdmissionsInterview[]> {
  return (await listAdmissionsInterviews(institutionId))
    .filter((row) => row.interviewerId === interviewerPersonId)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}
