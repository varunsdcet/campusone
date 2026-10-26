import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";

const FLAG_SCREEN = "STU:FLAG";

export const FLAG_TYPES = ["ACADEMIC RISK", "ATTENDANCE CONCERN", "BEHAVIOUR CONCERN", "FINANCIAL HOLD", "SUCCESS NOTE"];
export const FLAG_PRIORITIES = ["High", "Medium", "Low"];

type Db = Pick<typeof prisma, "heritageRecord" | "student">;
type FlagUser = Pick<SessionClaims, "institutionId" | "accountId" | "roles">;

function fail(message: string, status = 400, code = "VALIDATION_ERROR") {
  return Object.assign(new Error(message), { status, code });
}

const text = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

/** Create Flag must name a student, a flag type and a note; nothing is defaulted. */
export function validateFlagFields(fields: Record<string, unknown> | null) {
  const f = fields ?? {};
  const student = text(f["Student Name"] ?? f.Student ?? f.studentName);
  const flagType = text(f["Flag Type"] ?? f.flagType).toUpperCase();
  const note = text(f.Description ?? f.Note ?? f.description);
  const priority = text(f.Priority ?? f.priority) || "Medium";
  const missing = [!student && "student", !flagType && "flag type", !note && "note"].filter(Boolean);
  if (missing.length) throw fail(`Enter the ${missing.join(", ")} for this flag`);
  if (note.length > 2000) throw fail("The note must be 2000 characters or fewer");
  if (!FLAG_PRIORITIES.some((p) => p.toLowerCase() === priority.toLowerCase())) throw fail("Choose a priority of High, Medium or Low");
  return { student, flagType, note, priority: priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase() };
}

function parseData(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const seesAll = (user: FlagUser) => user.roles.includes("admin") || user.roles.includes("registrar");

export async function listInstructorFlags(user: FlagUser, db: Db = prisma) {
  const recs = await db.heritageRecord.findMany({
    where: {
      institutionId: user.institutionId,
      screenId: FLAG_SCREEN,
      deletedAt: null,
      ...(seesAll(user) ? {} : { createdById: user.accountId }),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const ids = [...new Set(recs.map((r) => r.contextKey).filter(Boolean))];
  const students = ids.length
    ? await db.student.findMany({
        where: { institutionId: user.institutionId, id: { in: ids } },
        select: { id: true, studentNumber: true, person: { select: { givenName: true, familyName: true } } },
      })
    : [];
  const byId = new Map(students.map((st) => [st.id, st]));
  return recs.map((r) => {
    const d = parseData(r.dataJson);
    const st = byId.get(r.contextKey);
    const name = st ? `${st.person.givenName} ${st.person.familyName}`.trim() : "Unknown student";
    const message = text(d.message).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const flagName = text(d.name) || "Student flag";
    const date = text(d.date) || r.createdAt.toISOString();
    return {
      id: r.id,
      studentId: r.contextKey,
      student: st ? `${name} · ${st.studentNumber}` : name,
      description: message ? `${flagName} — ${message}` : flagName,
      status: text(d.status) || "Active",
      resolved: text(d.resolved) || "No",
      appliesHold: text(d.applyHold) || "No",
      priority: text(d.priority),
      date: date.slice(0, 10),
      canEdit: r.createdById === user.accountId || seesAll(user),
      href: r.contextKey ? `/instructor/f/t22-student-detail-full-page?studentId=${encodeURIComponent(r.contextKey)}` : "",
    };
  });
}

export async function updateInstructorFlag(user: FlagUser, id: string, op: "dismiss" | "delete", db: Db = prisma) {
  const flagId = id.trim();
  if (!flagId) throw fail("Choose a flag");
  const rec = await db.heritageRecord.findFirst({
    where: { id: flagId, institutionId: user.institutionId, screenId: FLAG_SCREEN, deletedAt: null },
  });
  if (!rec) throw fail("Flag not found", 404, "NOT_FOUND");
  if (rec.createdById !== user.accountId && !seesAll(user)) {
    throw fail("You can only change flags you created", 403, "FORBIDDEN");
  }
  if (op === "delete") {
    await db.heritageRecord.update({
      where: { id: rec.id },
      data: { deletedAt: new Date(), status: "deleted", updatedById: user.accountId, rowVersion: { increment: 1 } },
    });
    return { id: rec.id, deleted: true };
  }
  const data = { ...parseData(rec.dataJson), status: "Dismissed", resolved: "Yes", resolvedAt: new Date().toISOString() };
  await db.heritageRecord.update({
    where: { id: rec.id },
    data: { dataJson: JSON.stringify(data), updatedById: user.accountId, rowVersion: { increment: 1 } },
  });
  return { id: rec.id, dismissed: true };
}
