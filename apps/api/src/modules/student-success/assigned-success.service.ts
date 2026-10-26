import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";

const CASE_TRANSITIONS: Record<string, readonly string[]> = {
  open: ["in_progress", "monitoring", "resolved"],
  in_progress: ["monitoring", "resolved"],
  monitoring: ["in_progress", "resolved"],
  resolved: ["closed", "open"],
  closed: ["open"],
};

const APPOINTMENT_TRANSITIONS: Record<string, readonly string[]> = {
  requested: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled", "no_show"],
  completed: [],
  cancelled: [],
  no_show: [],
};

function transitionError(kind: string, from: string, to: string) {
  return Object.assign(new Error(`${kind} cannot change from "${from}" to "${to}"`), {
    code: "INVALID_TRANSITION",
    status: 409,
  });
}

export function assertCaseTransition(from: string, to: string) {
  if (!(CASE_TRANSITIONS[from] ?? []).includes(to)) throw transitionError("Case", from, to);
}

export function assertAppointmentTransition(from: string, to: string) {
  if (!(APPOINTMENT_TRANSITIONS[from] ?? []).includes(to)) throw transitionError("Appointment", from, to);
}

function personName(person: { givenName: string; familyName: string } | null | undefined) {
  return person ? `${person.givenName} ${person.familyName}`.trim() : "Student";
}

async function staffNames(institutionId: string, ids: Array<string | null>) {
  const personIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!personIds.length) return new Map<string, string>();
  const people = await prisma.person.findMany({
    where: { institutionId, id: { in: personIds } },
    select: { id: true, givenName: true, familyName: true },
  });
  return new Map(people.map((person) => [person.id, personName(person)]));
}

export async function listAssignedSuccessCases(user: SessionClaims) {
  const rows = await prisma.successCase.findMany({
    where: { institutionId: user.institutionId, ownerPersonId: user.personId },
    include: {
      student: { select: { studentNumber: true, person: { select: { givenName: true, familyName: true } } } },
      tasks: { orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }] },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    studentId: row.studentId,
    studentName: personName(row.student.person),
    studentNumber: row.student.studentNumber,
    level: row.level,
    status: row.status,
    summary: row.summary,
    signals: (() => {
      try {
        const parsed = JSON.parse(row.signalsJson);
        return Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        return [];
      }
    })(),
    tasks: row.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      dueAt: task.dueAt?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
    })),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function updateAssignedCaseStatus(user: SessionClaims, id: string, status: string) {
  const current = await prisma.successCase.findFirst({
    where: { id, institutionId: user.institutionId, ownerPersonId: user.personId },
    select: { id: true, status: true },
  });
  if (!current) throw Object.assign(new Error("Assigned success case not found"), { code: "NOT_FOUND", status: 404 });
  assertCaseTransition(current.status, status);
  const updated = await prisma.successCase.update({ where: { id: current.id }, data: { status } });
  return { id: updated.id, status: updated.status, updatedAt: updated.updatedAt.toISOString() };
}

export async function listAssignedAppointments(user: SessionClaims) {
  const rows = await prisma.advisingAppointment.findMany({
    where: { institutionId: user.institutionId, advisorPersonId: user.personId },
    include: { student: { select: { studentNumber: true, person: { select: { givenName: true, familyName: true } } } } },
    orderBy: { startsAt: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    studentId: row.studentId,
    studentName: personName(row.student.person),
    studentNumber: row.student.studentNumber,
    topic: row.topic,
    startsAt: row.startsAt.toISOString(),
    status: row.status,
    notes: row.notes,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function updateAssignedAppointmentStatus(user: SessionClaims, id: string, status: string) {
  const current = await prisma.advisingAppointment.findFirst({
    where: { id, institutionId: user.institutionId, advisorPersonId: user.personId },
    select: { id: true, status: true },
  });
  if (!current) throw Object.assign(new Error("Assigned appointment not found"), { code: "NOT_FOUND", status: 404 });
  assertAppointmentTransition(current.status, status);
  const updated = await prisma.advisingAppointment.update({ where: { id: current.id }, data: { status } });
  return { id: updated.id, status: updated.status, updatedAt: updated.updatedAt.toISOString() };
}

export async function listStudentSuccessCases(user: SessionClaims, studentId: string) {
  const rows = await prisma.successCase.findMany({
    where: { institutionId: user.institutionId, studentId },
    include: { tasks: { orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }] } },
    orderBy: { updatedAt: "desc" },
  });
  const owners = await staffNames(user.institutionId, rows.map((row) => row.ownerPersonId));
  return rows.map((row) => ({
    id: row.id,
    level: row.level,
    status: row.status,
    summary: row.summary,
    ownerName: row.ownerPersonId ? owners.get(row.ownerPersonId) ?? "Student Success team" : "Student Success team",
    tasks: row.tasks
      .filter((task) => task.status !== "cancelled")
      .map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        dueAt: task.dueAt?.toISOString() ?? null,
        completedAt: task.completedAt?.toISOString() ?? null,
      })),
    updatedAt: row.updatedAt.toISOString(),
  }));
}
