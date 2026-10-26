import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { adminCareerOpportunityHref, studentCareerOpportunityHref } from "../../../lib/careerOpportunityLink.js";
import { assertPermission } from "../superAdmin.service.js";
import { audit } from "./service.js";
import { ENTITIES, MODULES, SLUGS, type Data, type EntityKey, type ModuleKey, type OpsEntity, type OpsRef } from "./ops.spec.js";
import { AFTER, DASH, EXT_DECORATE, EXT_PREPARE, EXT_REFS, EXT_RULES, EXT_TABLES, RUN, type RuleCtx } from "./ops.ext.js";
import { addDays, bump, dayOf, httpError, n, parse, personName, records, s, stampOf, strList, take, toDay, today, toStamp, type Adapter, type Ctx, type Opt, type Row } from "./ops.util.js";

export { ENTITIES, MODULES, SLUGS, type EntityKey, type ModuleKey };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Fills the "$today" / "$now" placeholders used by defaults and action presets. */
const token = (v: unknown) => (v === "$today" ? today() : v === "$now" ? new Date().toISOString().slice(0, 16) : v);

export function entityOf(key: string): EntityKey {
  if (!(key in ENTITIES)) throw httpError(404, "Unknown screen", "NOT_FOUND");
  return key as EntityKey;
}
export function moduleOf(key: string): ModuleKey {
  if (!(key in MODULES)) throw httpError(404, "Unknown module", "NOT_FOUND");
  return key as ModuleKey;
}
const can = (user: SessionClaims, entity: EntityKey, mode: "view" | "edit") => assertPermission(user, MODULES[ENTITIES[entity].module].permission, mode);

/* ------------------------------------------------------------------ */
/* HeritageRecord storage                                               */
/* ------------------------------------------------------------------ */

const fieldData = (e: OpsEntity, d: Data) => Object.fromEntries(e.fields.filter((f) => !f.readOnly).map((f) => [f.key, d[f.key] ?? null]));

/* ------------------------------------------------------------------ */
/* Reference lists                                                      */
/* ------------------------------------------------------------------ */

const STAFF_RE = /instructor|admin|registrar|advisor|staff|faculty|counsel/i;
const recordTitle = (d: Data) => s(d.name) || s(d.title) || s(d.item);

async function loadRef(inst: string, ref: OpsRef): Promise<Opt[]> {
  const ext = EXT_REFS[ref];
  if (ext) return ext(inst);
  switch (ref) {
    case "students": {
      const rows = await prisma.student.findMany({ where: { institutionId: inst }, include: { person: true }, orderBy: { studentNumber: "asc" }, take: 5000 });
      return rows.map((r) => ({ id: r.id, label: `${personName(r.person)} (${r.studentNumber})` })).sort((a, b) => a.label.localeCompare(b.label));
    }
    case "staff": {
      const rows = await prisma.account.findMany({ where: { institutionId: inst }, include: { person: true }, take: 3000 });
      const seen = new Map<string, string>();
      for (const a of rows) if (STAFF_RE.test(a.rolesJson) && !seen.has(a.personId)) seen.set(a.personId, personName(a.person));
      return [...seen].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
    }
    case "courses": {
      const rows = await prisma.course.findMany({ where: { institutionId: inst }, orderBy: { code: "asc" } });
      return rows.map((r) => ({ id: r.id, label: `${r.code} · ${r.title}` }));
    }
    case "sections": {
      const rows = await prisma.section.findMany({ where: { institutionId: inst }, include: { course: true }, take: 3000 });
      return rows.map((r) => ({ id: r.id, label: `${r.course.code} · ${r.code}` })).sort((a, b) => a.label.localeCompare(b.label));
    }
    case "classSessions": {
      const rows = await prisma.classSession.findMany({ where: { institutionId: inst }, include: { section: { include: { course: true } } }, orderBy: { startsAt: "desc" }, take: 3000 });
      return rows.map((r) => ({ id: r.id, label: `${r.section.course.code} · ${r.title} (${dayOf(r.startsAt)})` }));
    }
    case "classrooms": {
      const [rooms, campuses] = await Promise.all([records(inst, "LOC:CLASSROOM"), records(inst, "LOC:CAMPUS")]);
      const campus = new Map(campuses.map((c) => [c.id, s(c.name)]));
      return rooms
        .filter((r) => s(r.active) !== "Inactive")
        .map((r) => ({ id: r.id, label: [s(r.name), campus.get(s(r.campus))].filter(Boolean).join(" — ") }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    }
    case "programs": {
      const rows = await records(inst, "PM:PROGRAM");
      return rows.map((r) => ({ id: r.id, label: s(r.name) })).sort((a, b) => a.label.localeCompare(b.label));
    }
    case "employers": {
      const rows = await prisma.employerOrg.findMany({ where: { institutionId: inst }, orderBy: { name: "asc" } });
      return rows.map((r) => ({ id: r.id, label: r.name }));
    }
    case "sites": {
      const rows = await records(inst, ENTITIES.sites.screen);
      return rows
        .filter((r) => s(r.status) === "Active")
        .map((r) => ({ id: r.id, label: `${s(r.name)}${s(r.city) ? ` · ${s(r.city)}` : ""}` }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }
    case "opportunities": {
      const rows = await prisma.careerOpportunity.findMany({ where: { institutionId: inst, status: "open" }, orderBy: { title: "asc" } });
      return rows.map((r) => ({ id: r.id, label: `${r.title} · ${r.employerName}` }));
    }
    case "placements": {
      const rows = await prisma.placement.findMany({ where: { institutionId: inst }, include: { employerOrg: true }, orderBy: { createdAt: "desc" } });
      return rows.map((r) => ({ id: r.id, label: `${r.studentName} @ ${r.employerOrg.name}` }));
    }
    case "cases": {
      const rows = await prisma.successCase.findMany({ where: { institutionId: inst }, include: { student: { include: { person: true } } }, orderBy: { createdAt: "desc" } });
      return rows.map((r) => ({ id: r.id, label: `${personName(r.student.person)} · ${r.level} (${r.status})` }));
    }
    case "equipment": {
      const rows = await records(inst, ENTITIES.equipment.screen);
      return rows.map((r) => ({ id: r.id, label: `${s(r.name)} (${s(r.assetTag)})` })).sort((a, b) => a.label.localeCompare(b.label));
    }
    case "safetyRules":
    case "environments":
    case "campaigns":
    case "events": {
      const rows = await records(inst, ENTITIES[ref].screen);
      return rows.map((r) => ({ id: r.id, label: recordTitle(r) })).sort((a, b) => a.label.localeCompare(b.label));
    }
    default:
      return [];
  }
}

class Refs {
  private cache = new Map<OpsRef, Promise<Opt[]>>();
  constructor(private inst: string) {}
  get(ref: OpsRef) {
    let p = this.cache.get(ref);
    if (!p) this.cache.set(ref, (p = loadRef(this.inst, ref)));
    return p;
  }
  async labels(ref: OpsRef) {
    return new Map((await this.get(ref)).map((o) => [o.id, o.label]));
  }
}

/* ------------------------------------------------------------------ */
/* Dedicated-table adapters                                             */
/* ------------------------------------------------------------------ */

async function studentInfo(inst: string, studentId: string) {
  const st = await prisma.student.findFirst({ where: { id: studentId, institutionId: inst }, include: { person: true } });
  if (!st) throw httpError(400, "Student no longer exists");
  return { studentName: personName(st.person), programName: st.programName };
}
async function placementStudent(inst: string, placementId: string) {
  const p = await prisma.placement.findFirst({ where: { id: placementId, institutionId: inst } });
  if (!p) throw httpError(400, "Placement no longer exists");
  return p.studentName;
}

const BASE_TABLES: Partial<Record<EntityKey, Adapter>> = {
  employers: {
    async list(inst) {
      const rows = await prisma.employerOrg.findMany({ where: { institutionId: inst }, include: { _count: { select: { placements: true, agreements: true } } }, orderBy: { name: "asc" } });
      return rows.map((r) => ({ id: r.id, name: r.name, siteName: r.siteName, contactEmail: r.contactEmail ?? "", accountId: r.accountId ?? "", _placements: r._count.placements, _agreements: r._count.agreements, updatedAt: r.updatedAt.toISOString() }));
    },
    async create(inst, d) {
      const accountId = s(d.accountId) || null;
      if (accountId) {
        const account = await prisma.account.findFirst({ where: { id: accountId, institutionId: inst }, select: { rolesJson: true } });
        if (!account || !/employer/i.test(account.rolesJson)) throw httpError(400, "Employer Portal Account must have the employer role");
        if (await prisma.employerOrg.findFirst({ where: { institutionId: inst, accountId } })) throw httpError(409, "That employer portal account is already linked to another employer");
      }
      const r = await prisma.employerOrg.create({ data: { institutionId: inst, accountId, name: s(d.name), siteName: s(d.siteName), contactEmail: s(d.contactEmail) || null } });
      return r.id;
    },
    async update(inst, id, d) {
      const accountId = s(d.accountId) || null;
      if (accountId) {
        const account = await prisma.account.findFirst({ where: { id: accountId, institutionId: inst }, select: { rolesJson: true } });
        if (!account || !/employer/i.test(account.rolesJson)) throw httpError(400, "Employer Portal Account must have the employer role");
        if (await prisma.employerOrg.findFirst({ where: { institutionId: inst, accountId, id: { not: id } } })) throw httpError(409, "That employer portal account is already linked to another employer");
      }
      await prisma.employerOrg.update({ where: { id }, data: { accountId, name: s(d.name), siteName: s(d.siteName), contactEmail: s(d.contactEmail) || null, ...bump } });
    },
    async remove(inst, id) {
      const employer = await prisma.employerOrg.findFirst({
        where: { id, institutionId: inst },
        include: { _count: { select: { placements: true, agreements: true } } },
      });
      if (!employer) throw httpError(404, "Employer not found");
      if (employer._count.placements || employer._count.agreements) {
        throw httpError(
          409,
          `Cannot delete ${employer.name}: it has ${employer._count.placements} placement(s) and ${employer._count.agreements} agreement(s). Archive or reassign those records first.`,
        );
      }
      await prisma.employerOrg.delete({ where: { id: employer.id } });
    },
  },
  opportunities: {
    async list(inst) {
      const rows = await prisma.careerOpportunity.findMany({ where: { institutionId: inst }, orderBy: { createdAt: "desc" } });
      return rows.map((r) => ({ id: r.id, title: r.title, employerName: r.employerName, skills: strList(r.skillsJson), programCodes: strList(r.programCodesJson), href: adminCareerOpportunityHref(r.href), status: r.status, updatedAt: r.updatedAt.toISOString() }));
    },
    async create(inst, d) {
      const r = await prisma.careerOpportunity.create({ data: { institutionId: inst, title: s(d.title), employerName: s(d.employerName), skillsJson: JSON.stringify(d.skills ?? []), programCodesJson: JSON.stringify(d.programCodes ?? []), href: s(d.href), status: s(d.status) } });
      return r.id;
    },
    async update(_inst, id, d) {
      await prisma.careerOpportunity.update({ where: { id }, data: { title: s(d.title), employerName: s(d.employerName), skillsJson: JSON.stringify(d.skills ?? []), programCodesJson: JSON.stringify(d.programCodes ?? []), href: s(d.href), status: s(d.status), ...bump } });
    },
    async remove(_inst, id) {
      await prisma.careerOpportunity.delete({ where: { id } });
    },
  },
  placements: {
    async list(inst) {
      const rows = await prisma.placement.findMany({ where: { institutionId: inst }, include: { hours: { select: { hours: true, status: true } } }, orderBy: { createdAt: "desc" } });
      return rows.map((r) => ({
        id: r.id,
        studentId: r.studentId ?? "",
        employerOrgId: r.employerOrgId,
        siteId: r.siteId ?? "",
        supervisorPersonId: r.supervisorPersonId ?? "",
        opportunityId: r.opportunityId ?? "",
        status: r.status,
        startsOn: r.startsOn ?? "",
        endsOn: r.endsOn ?? "",
        programName: r.programName,
        _student: r.studentName,
        _hours: r.hours.filter((h) => h.status === "approved").reduce((t, h) => t + h.hours, 0),
        updatedAt: r.updatedAt.toISOString(),
      }));
    },
    async create(inst, d) {
      const info = await studentInfo(inst, s(d.studentId));
      const r = await prisma.placement.create({ data: { institutionId: inst, studentId: s(d.studentId), employerOrgId: s(d.employerOrgId), siteId: s(d.siteId) || null, supervisorPersonId: s(d.supervisorPersonId) || null, opportunityId: s(d.opportunityId) || null, status: s(d.status), startsOn: s(d.startsOn) || null, endsOn: s(d.endsOn) || null, ...info } });
      const student = await prisma.student.findUnique({ where: { id: s(d.studentId) }, include: { person: { include: { accounts: { where: { status: "active" }, select: { id: true } } } } } });
      const supervisor = await prisma.account.findFirst({ where: { institutionId: inst, personId: s(d.supervisorPersonId), status: "active" }, select: { id: true } });
      const recipients = [...new Set([...(student?.person.accounts.map((a) => a.id) ?? []), supervisor?.id].filter((id): id is string => Boolean(id)))];
      if (recipients.length) await prisma.notification.createMany({ data: recipients.map((recipientAccountId) => ({ institutionId: inst, recipientAccountId, channel: "in_app", title: "Practicum placement assigned", body: `${info.studentName} · ${info.programName}`, templateKey: "practicum.placement.assigned", dedupeKey: `practicum-placement:${r.id}:${recipientAccountId}` })), skipDuplicates: true });
      return r.id;
    },
    async update(inst, id, d) {
      const info = await studentInfo(inst, s(d.studentId));
      await prisma.placement.update({ where: { id }, data: { studentId: s(d.studentId), employerOrgId: s(d.employerOrgId), siteId: s(d.siteId) || null, supervisorPersonId: s(d.supervisorPersonId) || null, opportunityId: s(d.opportunityId) || null, status: s(d.status), startsOn: s(d.startsOn) || null, endsOn: s(d.endsOn) || null, ...info, ...bump } });
    },
    async remove(_inst, id) {
      await prisma.placement.delete({ where: { id } });
    },
  },
  agreements: {
    async list(inst) {
      const rows = await prisma.affiliationAgreement.findMany({ where: { institutionId: inst }, orderBy: { createdAt: "desc" } });
      return rows.map((r) => ({ id: r.id, employerOrgId: r.employerOrgId, title: r.title, status: r.status, renewsOn: r.renewsOn ?? "", updatedAt: r.updatedAt.toISOString() }));
    },
    async create(inst, d) {
      const r = await prisma.affiliationAgreement.create({ data: { institutionId: inst, employerOrgId: s(d.employerOrgId), title: s(d.title), status: s(d.status), renewsOn: s(d.renewsOn) || null } });
      return r.id;
    },
    async update(_inst, id, d) {
      await prisma.affiliationAgreement.update({ where: { id }, data: { employerOrgId: s(d.employerOrgId), title: s(d.title), status: s(d.status), renewsOn: s(d.renewsOn) || null, ...bump } });
    },
    async remove(_inst, id) {
      await prisma.affiliationAgreement.delete({ where: { id } });
    },
  },
  logs: {
    async list(inst) {
      const rows = await prisma.hoursEntry.findMany({ where: { institutionId: inst }, orderBy: { createdAt: "desc" } });
      return rows.map((r) => ({ id: r.id, placementId: r.placementId, weekLabel: r.weekLabel, hours: r.hours, status: r.status, updatedAt: r.updatedAt.toISOString() }));
    },
    async create(inst, d) {
      const r = await prisma.hoursEntry.create({ data: { institutionId: inst, placementId: s(d.placementId), weekLabel: s(d.weekLabel), hours: Number(d.hours), status: s(d.status) } });
      return r.id;
    },
    async update(_inst, id, d) {
      await prisma.hoursEntry.update({ where: { id }, data: { placementId: s(d.placementId), weekLabel: s(d.weekLabel), hours: Number(d.hours), status: s(d.status), ...bump } });
    },
    async remove(_inst, id) {
      await prisma.hoursEntry.delete({ where: { id } });
    },
  },
  evaluations: {
    async list(inst) {
      const rows = await prisma.placementEvaluation.findMany({ where: { institutionId: inst }, orderBy: { createdAt: "desc" } });
      return rows.map((r) => ({ id: r.id, placementId: r.placementId, status: r.status, score: r.score, notes: r.notes ?? "", updatedAt: r.updatedAt.toISOString() }));
    },
    async create(inst, d) {
      const studentName = await placementStudent(inst, s(d.placementId));
      const r = await prisma.placementEvaluation.create({ data: { institutionId: inst, placementId: s(d.placementId), studentName, status: s(d.status), score: n(d.score), notes: s(d.notes) || null } });
      return r.id;
    },
    async update(inst, id, d) {
      const studentName = await placementStudent(inst, s(d.placementId));
      await prisma.placementEvaluation.update({ where: { id }, data: { placementId: s(d.placementId), studentName, status: s(d.status), score: n(d.score), notes: s(d.notes) || null, ...bump } });
    },
    async remove(_inst, id) {
      await prisma.placementEvaluation.delete({ where: { id } });
    },
  },
  cases: {
    async list(inst) {
      const rows = await prisma.successCase.findMany({ where: { institutionId: inst }, include: { tasks: { select: { status: true } } }, orderBy: { createdAt: "desc" } });
      return rows.map((r) => ({
        id: r.id,
        studentId: r.studentId,
        level: r.level,
        summary: r.summary,
        signals: strList(r.signalsJson),
        ownerPersonId: r.ownerPersonId ?? "",
        status: r.status,
        _tasks: r.tasks.filter((t) => t.status === "pending" || t.status === "in_progress").length,
        updatedAt: r.updatedAt.toISOString(),
      }));
    },
    async create(inst, d) {
      const r = await prisma.successCase.create({ data: { institutionId: inst, studentId: s(d.studentId), level: s(d.level), summary: s(d.summary), signalsJson: JSON.stringify(d.signals ?? []), ownerPersonId: s(d.ownerPersonId) || null, status: s(d.status) } });
      return r.id;
    },
    async update(_inst, id, d) {
      await prisma.successCase.update({ where: { id }, data: { studentId: s(d.studentId), level: s(d.level), summary: s(d.summary), signalsJson: JSON.stringify(d.signals ?? []), ownerPersonId: s(d.ownerPersonId) || null, status: s(d.status), ...bump } });
    },
    async remove(_inst, id) {
      await prisma.successCase.delete({ where: { id } });
    },
  },
  tasks: {
    async list(inst) {
      const rows = await prisma.interventionTask.findMany({ where: { institutionId: inst }, orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }] });
      return rows.map((r) => ({ id: r.id, caseId: r.caseId, title: r.title, dueAt: dayOf(r.dueAt), status: r.status, completedAt: stampOf(r.completedAt), updatedAt: r.updatedAt.toISOString() }));
    },
    async create(inst, d) {
      const r = await prisma.interventionTask.create({ data: { institutionId: inst, caseId: s(d.caseId), title: s(d.title), dueAt: toDay(d.dueAt), status: s(d.status), completedAt: d.status === "done" ? new Date() : null } });
      return r.id;
    },
    async update(_inst, id, d) {
      const prev = await prisma.interventionTask.findUnique({ where: { id }, select: { completedAt: true } });
      const completedAt = d.status === "done" ? (prev?.completedAt ?? new Date()) : null;
      await prisma.interventionTask.update({ where: { id }, data: { caseId: s(d.caseId), title: s(d.title), dueAt: toDay(d.dueAt), status: s(d.status), completedAt, ...bump } });
    },
    async remove(_inst, id) {
      await prisma.interventionTask.delete({ where: { id } });
    },
  },
  appointments: {
    async list(inst) {
      const rows = await prisma.advisingAppointment.findMany({ where: { institutionId: inst }, orderBy: { startsAt: "desc" } });
      return rows.map((r) => ({ id: r.id, studentId: r.studentId, advisorPersonId: r.advisorPersonId ?? "", topic: r.topic, startsAt: stampOf(r.startsAt), status: r.status, notes: r.notes ?? "", updatedAt: r.updatedAt.toISOString() }));
    },
    async create(inst, d) {
      const r = await prisma.advisingAppointment.create({ data: { institutionId: inst, studentId: s(d.studentId), advisorPersonId: s(d.advisorPersonId) || null, topic: s(d.topic), startsAt: toStamp(d.startsAt)!, status: s(d.status), notes: s(d.notes) || null } });
      return r.id;
    },
    async update(_inst, id, d) {
      await prisma.advisingAppointment.update({ where: { id }, data: { studentId: s(d.studentId), advisorPersonId: s(d.advisorPersonId) || null, topic: s(d.topic), startsAt: toStamp(d.startsAt)!, status: s(d.status), notes: s(d.notes) || null, ...bump } });
    },
    async remove(_inst, id) {
      await prisma.advisingAppointment.delete({ where: { id } });
    },
  },
  transferCredits: {
    async list(inst) {
      const rows = await prisma.transferCredit.findMany({ where: { institutionId: inst }, orderBy: { createdAt: "desc" } });
      return rows.map((r) => ({ id: r.id, studentId: r.studentId, externalCode: r.externalCode, externalTitle: r.externalTitle, credits: r.credits, courseId: r.courseId ?? "", status: r.status, updatedAt: r.updatedAt.toISOString() }));
    },
    async create(inst, d) {
      const r = await prisma.transferCredit.create({ data: { institutionId: inst, studentId: s(d.studentId), externalCode: s(d.externalCode), externalTitle: s(d.externalTitle), credits: Number(d.credits), courseId: s(d.courseId) || null, status: s(d.status) } });
      return r.id;
    },
    async update(_inst, id, d) {
      await prisma.transferCredit.update({ where: { id }, data: { studentId: s(d.studentId), externalCode: s(d.externalCode), externalTitle: s(d.externalTitle), credits: Number(d.credits), courseId: s(d.courseId) || null, status: s(d.status), ...bump } });
    },
    async remove(_inst, id) {
      await prisma.transferCredit.delete({ where: { id } });
    },
  },
  standing: {
    async list(inst) {
      const rows = await prisma.student.findMany({ where: { institutionId: inst }, include: { person: true }, orderBy: { studentNumber: "asc" } });
      return rows.map((r) => ({ id: r.id, studentNumber: r.studentNumber, name: personName(r.person), programName: r.programName, standing: r.standing, reason: "", updatedAt: r.updatedAt.toISOString() }));
    },
    async update(inst, id, d) {
      const student = await prisma.student.findFirst({
        where: { id, institutionId: inst },
        include: { person: { include: { accounts: { where: { status: "active" }, select: { id: true } } } } },
      });
      if (!student) throw httpError(404, "Student not found", "NOT_FOUND");
      const next = s(d.standing);
      await prisma.$transaction(async (tx) => {
        await tx.student.update({ where: { id: student.id }, data: { standing: next, ...bump } });
        if (student.standing !== next) {
          for (const account of student.person.accounts) {
            await tx.notification.create({
              data: {
                institutionId: inst,
                recipientAccountId: account.id,
                channel: "in_app",
                title: "Academic standing updated",
                body: `Your academic standing changed from ${student.standing} to ${next}. ${s(d.reason)}`.trim(),
                templateKey: "standing.updated",
              },
            });
          }
        }
      });
    },
  },
  notebook: {
    async list(inst) {
      const rows = await prisma.labNotebookEntry.findMany({ where: { institutionId: inst }, orderBy: { updatedAt: "desc" } });
      return rows.map((r) => ({ id: r.id, studentId: r.studentId, classSessionId: r.classSessionId, title: r.title, body: r.body, version: r.version, locked: Boolean(r.lockedAt), updatedAt: r.updatedAt.toISOString() }));
    },
    async update(_inst, id, d) {
      await prisma.labNotebookEntry.update({ where: { id }, data: { lockedAt: d.locked ? new Date() : null, ...bump } });
    },
  },
};

const TABLES: Partial<Record<EntityKey, Adapter>> = { ...BASE_TABLES, ...EXT_TABLES };

/* ------------------------------------------------------------------ */
/* Validation                                                           */
/* ------------------------------------------------------------------ */

async function clean(e: OpsEntity, input: Data, base: Data, refs: Refs, creating: boolean): Promise<Data> {
  const out: Data = { ...base };
  const skip = (f: OpsEntity["fields"][number]) => f.readOnly || (f.createOnly && !creating) || (f.editOnly && creating);
  for (const f of e.fields) {
    if (f.editOnly && creating && !(f.key in out) && f.dflt !== undefined) out[f.key] = token(f.dflt);
    if (skip(f)) continue;
    if (f.key in input) out[f.key] = token(input[f.key]);
    else if (!(f.key in base) && f.dflt !== undefined) out[f.key] = token(f.dflt);
  }
  const errors: string[] = [];
  const err = (f: OpsEntity["fields"][number], msg: string) => errors.push(`${f.label} ${msg}`);
  for (const f of e.fields) {
    if (skip(f)) continue;
    const raw = out[f.key];
    switch (f.kind) {
      case "number": {
        if (raw === "" || raw === null || raw === undefined) {
          if (f.required) err(f, "is required");
          out[f.key] = null;
          break;
        }
        const v = Number(raw);
        if (!Number.isFinite(v)) err(f, "must be a number");
        else if (f.integer && !Number.isInteger(v)) err(f, "must be a whole number");
        else if (f.min !== undefined && v < f.min) err(f, `must be at least ${f.min}`);
        else if (f.max !== undefined && v > f.max) err(f, `must be at most ${f.max}`);
        out[f.key] = Number.isFinite(v) ? v : null;
        break;
      }
      case "bool":
        out[f.key] = raw === true || raw === "true";
        break;
      case "list": {
        const items = (Array.isArray(raw) ? raw.map(s) : s(raw).split(",")).map((x) => x.trim()).filter(Boolean);
        const vals = [...new Set(items)].slice(0, 50);
        if (vals.some((x) => x.length > 80)) err(f, "has an item that is too long");
        if (f.required && !vals.length) err(f, "is required");
        out[f.key] = vals;
        break;
      }
      case "ref": {
        const v = s(raw).trim();
        out[f.key] = v;
        if (!v) {
          if (f.required) err(f, "is required");
        } else if (v !== s(base[f.key]) && !(await refs.get(f.ref!)).some((o) => (f.byLabel ? o.label : o.id) === v)) err(f, ": the selected item no longer exists");
        break;
      }
      default: {
        const v = s(raw).trim();
        out[f.key] = v;
        if (v.length > (f.kind === "textarea" ? (f.long ? 100_000 : 4000) : 200)) err(f, "is too long");
        if (!v) {
          if (f.required) err(f, "is required");
        } else if (f.kind === "date" && (!DATE_RE.test(v) || Number.isNaN(Date.parse(v)))) err(f, "must be a valid date");
        else if (f.kind === "datetime" && (!DATETIME_RE.test(v) || Number.isNaN(Date.parse(v)))) err(f, "must be a valid date and time");
        else if (f.kind === "time" && !TIME_RE.test(v)) err(f, "must be a valid time (HH:MM)");
        else if (f.kind === "email" && !EMAIL_RE.test(v)) err(f, "must be a valid e-mail address");
        else if (
          f.kind === "url" &&
          !f.allowedInternalPaths?.includes(v) &&
          !(f.httpsOnly ? /^https:\/\/\S+$/i : /^https?:\/\/\S+$/i).test(v)
        ) err(f, f.httpsOnly ? "must start with https://" : "must start with http:// or https://");
        else if (f.kind === "select" && f.options && !f.options.includes(v) && v !== s(base[f.key])) err(f, `: "${v}" is not a valid choice`);
      }
    }
  }
  if (errors.length) throw httpError(400, errors.join("; "));
  return out;
}

const after = (a: unknown, b: unknown) => !s(a) || !s(b) || s(b) >= s(a);

const BASE_RULES: Partial<Record<EntityKey, (d: Data, ctx: RuleCtx) => Promise<string[]>>> = {
  async opportunities(d) {
    const href = s(d.href);
    return href && !studentCareerOpportunityHref(href) ? ["Application URL must be a valid https:// URL or the approved practicum page"] : [];
  },
  async placements(d, { inst }) {
    const errors: string[] = [];
    if (!after(d.startsOn, d.endsOn)) errors.push("End Date must be on or after the Start Date");
    const site = (await records(inst, ENTITIES.sites.screen)).find((row) => row.id === s(d.siteId));
    if (!site || s(site.status) !== "Active") errors.push("Select an active practicum site");
    else if (s(site.employerId) !== s(d.employerOrgId)) errors.push("The selected site does not belong to the selected employer");
    if (s(d.status) === "active") {
      const agreement = await prisma.affiliationAgreement.findFirst({ where: { institutionId: inst, employerOrgId: s(d.employerOrgId), status: "active" } });
      if (!agreement) errors.push("An active affiliation agreement is required before this placement can be activated");
    }
    return errors;
  },
  async campaigns(d) {
    return after(d.startDate, d.endDate) ? [] : ["End Date must be on or after the Start Date"];
  },
  async eligibility(d) {
    return after(d.clearedOn, d.expiresOn) ? [] : ["Expires On must be on or after Cleared On"];
  },
  async events(d) {
    return s(d.startTime) && s(d.endTime) && s(d.endTime) <= s(d.startTime) ? ["End Time must be after the Start Time"] : [];
  },
  async equipment(d, { inst, id }) {
    const tag = s(d.assetTag).toLowerCase();
    const dup = (await records(inst, ENTITIES.equipment.screen)).find((r) => r.id !== id && s(r.assetTag).toLowerCase() === tag);
    return dup ? [`Asset Tag "${s(d.assetTag)}" is already used by ${s(dup.name)}`] : [];
  },
  async labSessions(d, { inst, id }) {
    if (s(d.endTime) <= s(d.startTime)) return ["End Time must be after the Start Time"];
    if (d.status === "Cancelled") return [];
    const others = (await records(inst, ENTITIES.labSessions.screen)).filter(
      (r) => r.id !== id && r.status !== "Cancelled" && r.date === d.date && s(r.startTime) < s(d.endTime) && s(d.startTime) < s(r.endTime),
    );
    const out: string[] = [];
    const room = others.find((r) => r.roomId === d.roomId);
    if (room) out.push(`The lab room is already booked for "${s(room.title)}" (${s(room.startTime)}–${s(room.endTime)})`);
    const eq = s(d.equipmentId) ? others.find((r) => r.equipmentId === d.equipmentId) : undefined;
    if (eq) out.push(`The equipment is already booked for "${s(eq.title)}" (${s(eq.startTime)}–${s(eq.endTime)})`);
    return out;
  },
};
const RULES = { ...BASE_RULES, ...EXT_RULES };

/* ------------------------------------------------------------------ */
/* Computed columns for HeritageRecord entities                         */
/* ------------------------------------------------------------------ */

const BASE_DECORATE: Partial<Record<EntityKey, (rows: Row[], inst: string) => Promise<void>>> = {
  async inventory(rows) {
    for (const r of rows) {
      const low = n(r.reorderLevel) !== null && (n(r.quantity) ?? 0) <= n(r.reorderLevel)!;
      const expired = s(r.expiresOn) && s(r.expiresOn) < today();
      r._stock = expired ? "Expired" : low ? "Low" : "OK";
    }
  },
  async labSessions(rows) {
    for (const r of rows) r._time = `${s(r.startTime)}–${s(r.endTime)}`;
  },
  async environments(rows) {
    for (const r of rows) r._size = `${s(r.cpu) || "—"} vCPU · ${s(r.memoryGb) || "—"} GB`;
  },
  async leads(rows) {
    for (const r of rows) r._name = `${s(r.firstName)} ${s(r.lastName)}`.trim();
  },
  async campaigns(rows, inst) {
    const leads = await records(inst, ENTITIES.leads.screen);
    for (const r of rows) {
      const mine = leads.filter((l) => l.campaignId === r.id);
      r._leads = `${mine.length} / ${s(r.goalLeads) || "—"}`;
      r._converted = mine.filter((l) => CONVERTED.includes(s(l.stage))).length;
    }
  },
  async events(rows, inst) {
    const leads = await records(inst, ENTITIES.leads.screen);
    for (const r of rows) r._registrations = `${leads.filter((l) => l.eventId === r.id).length} / ${s(r.capacity) || "—"}`;
  },
};
const CONVERTED = ["Applied", "Admitted", "Enrolled"];
const DECORATE = { ...BASE_DECORATE, ...EXT_DECORATE };

/* ------------------------------------------------------------------ */
/* Public API                                                           */
/* ------------------------------------------------------------------ */

async function rowsOf(inst: string, entity: EntityKey, user?: SessionClaims): Promise<Row[]> {
  const e = ENTITIES[entity];
  const rows = e.store === "table" ? await TABLES[entity]!.list(inst, user) : await records(inst, e.screen);
  await DECORATE[entity]?.(rows, inst);
  return rows;
}

function ctxOf(user: SessionClaims, refs = new Refs(user.institutionId)): Ctx {
  const inst = user.institutionId;
  return { user, inst, labels: (ref) => refs.labels(ref), rows: (entity) => rowsOf(inst, entity, user) };
}

async function withRefLabels(inst: string, entity: EntityKey, rows: Row[], refs = new Refs(inst)) {
  const refFields = ENTITIES[entity].fields.filter((f) => f.kind === "ref");
  const maps = await Promise.all(refFields.map(async (f) => [f, f.byLabel ? null : await refs.labels(f.ref!)] as const));
  const label = (r: Row, k: string, m: Map<string, string> | null) => {
    const v = s(r[k]);
    if (!v || !m) return v;
    return m.get(v) ?? (k === "studentId" && r._student ? s(r._student) : "(removed)");
  };
  return rows.map((r) => ({ ...r, _ref: Object.fromEntries(maps.map(([f, m]) => [f.key, label(r, f.key, m)])) }));
}

export function opsMeta() {
  return {
    modules: Object.fromEntries(
      Object.entries(MODULES).map(([mk, m]) => [
        mk,
        {
          label: m.label,
          dashboard: m.dashboard,
          links: m.links ?? [],
          entities: m.entities.map((ek) => ({ key: ek, slug: SLUGS[ek], ...ENTITIES[ek], create: ENTITIES[ek].create !== false, edit: ENTITIES[ek].edit !== false, remove: ENTITIES[ek].remove !== false })),
        },
      ]),
    ),
  };
}

export async function entityRefs(user: SessionClaims, entity: EntityKey) {
  await can(user, entity, "view");
  const refs = new Refs(user.institutionId);
  const keys = [...new Set(ENTITIES[entity].fields.filter((f) => f.kind === "ref").map((f) => f.ref!))];
  return Object.fromEntries(await Promise.all(keys.map(async (k) => [k, await refs.get(k)] as const)));
}

export async function listOps(user: SessionClaims, entity: EntityKey, q = "") {
  await can(user, entity, "view");
  const rows = await withRefLabels(user.institutionId, entity, await rowsOf(user.institutionId, entity, user));
  const needle = q.trim().toLowerCase();
  const items = needle ? rows.filter((r) => JSON.stringify([r, r._ref]).toLowerCase().includes(needle)) : rows;
  return { items, total: items.length };
}

async function findRow(user: SessionClaims, entity: EntityKey, id: string) {
  const row = (await rowsOf(user.institutionId, entity, user)).find((r) => r.id === id);
  if (!row) throw httpError(404, `${ENTITIES[entity].label} not found`, "NOT_FOUND");
  return row;
}

export async function getOps(user: SessionClaims, entity: EntityKey, id: string) {
  await can(user, entity, "view");
  const [row] = await withRefLabels(user.institutionId, entity, [await findRow(user, entity, id)]);
  return row;
}

async function validate(inst: string, entity: EntityKey, input: Data, before: Row | null) {
  const refs = new Refs(inst);
  const data = await clean(ENTITIES[entity], input, before ?? {}, refs, !before);
  EXT_PREPARE[entity]?.(data);
  const errors = (await RULES[entity]?.(data, { inst, id: before?.id ?? null, before })) ?? [];
  if (errors.length) throw httpError(400, errors.join("; "));
  return data;
}

export async function createOps(user: SessionClaims, entity: EntityKey, body: Data) {
  await can(user, entity, "edit");
  const e = ENTITIES[entity];
  if (e.create === false) throw httpError(405, `${e.plural} cannot be created here`, "NOT_ALLOWED");
  const inst = user.institutionId;
  const data = await validate(inst, entity, body, null);
  let id: string;
  let message = `${e.label} created`;
  if (e.store === "table") {
    const made = await TABLES[entity]!.create!(inst, data, user);
    if (typeof made === "string") id = made;
    else ({ id, message } = made);
  } else {
    const rec = await prisma.heritageRecord.create({ data: { institutionId: inst, screenId: e.screen, dataJson: JSON.stringify(fieldData(e, data)), createdById: user.accountId, updatedById: user.accountId } });
    id = rec.id;
  }
  await audit(user, e.screen, "", "create", { recordId: id, after: fieldData(e, data) });
  await AFTER[entity]?.(ctxOf(user), { id, data, before: null });
  return { ok: true, id, message };
}

/**
 * Instructor-facing submission path for institutional programme changes.
 * The requester is always derived from the signed-in account; it is never
 * trusted from form input. Programme Management keeps a Heritage record id
 * while instructor screens read the mirrored Prisma programme id, so accept
 * either and normalise it before using the shared Ops validation contract.
 */
export async function submitProgramChangeRequest(user: SessionClaims, body: Data) {
  if (!user.roles.some((role) => ["instructor", "teacher", "faculty", "admin", "registrar"].includes(role))) {
    throw httpError(403, "Only teaching or academic staff can submit a programme change request", "FORBIDDEN");
  }

  const inst = user.institutionId;
  const programmeRows = await records(inst, "PM:PROGRAM");
  const suppliedProgramId = s(body.programId).trim();
  const programme = programmeRows.find(
    (row) => row.id === suppliedProgramId || s(row._prismaId) === suppliedProgramId,
  );
  if (!programme) throw httpError(400, "Select a programme from Program Management", "VALIDATION_ERROR");

  const input: Data = {
    programId: programme.id,
    type: body.type,
    title: body.title,
    rationale: body.rationale,
    effectiveTerm: body.effectiveTerm,
    requestedBy: user.personId,
    status: "Submitted",
    decisionNote: "",
  };
  const entity = "changeRequests" as const;
  const e = ENTITIES[entity];
  const data = await validate(inst, entity, input, null);
  const rec = await prisma.heritageRecord.create({
    data: {
      institutionId: inst,
      screenId: e.screen,
      dataJson: JSON.stringify(fieldData(e, data)),
      createdById: user.accountId,
      updatedById: user.accountId,
    },
  });
  await audit(user, e.screen, "", "submit", {
    recordId: rec.id,
    after: fieldData(e, data),
    note: "Submitted from the instructor programme change request screen",
  });

  const reviewers = await prisma.account.findMany({
    where: { institutionId: inst, status: "active", NOT: { id: user.accountId } },
    select: { id: true, rolesJson: true },
  });
  const reviewerIds = reviewers
    .filter((account) => /admin|registrar/i.test(account.rolesJson))
    .map((account) => account.id);
  if (reviewerIds.length) {
    await prisma.notification.createMany({
      data: reviewerIds.map((recipientAccountId) => ({
        institutionId: inst,
        recipientAccountId,
        channel: "in_app",
        title: "Program change request submitted",
        body: `${s(data.title)} is ready for academic review.`,
        templateKey: "program.change.submitted",
        dedupeKey: `program-change:${rec.id}:submitted:${recipientAccountId}`,
      })),
      skipDuplicates: true,
    });
  }

  return { ok: true, id: rec.id, message: "Program change request submitted for academic review" };
}

/**
 * Requester-scoped programme change history for the instructor portal.
 * This deliberately derives ownership from the signed-in person's id so one
 * instructor can never enumerate another instructor's requests.
 */
export async function listOwnProgramChangeRequests(user: SessionClaims) {
  if (!user.roles.some((role) => ["instructor", "teacher", "faculty", "admin", "registrar"].includes(role))) {
    throw httpError(403, "Only teaching or academic staff can view programme change requests", "FORBIDDEN");
  }

  const entity = ENTITIES.changeRequests;
  const [requests, programmes] = await Promise.all([
    records(user.institutionId, entity.screen),
    records(user.institutionId, "PM:PROGRAM"),
  ]);
  const owned = requests.filter((request) => s(request.requestedBy) === user.personId);
  const programmeLabels = new Map<string, string>();
  for (const programme of programmes) {
    const label = s(programme.name) || s(programme.title) || s(programme.code) || "Programme";
    programmeLabels.set(programme.id, label);
    if (s(programme._prismaId)) programmeLabels.set(s(programme._prismaId), label);
  }

  const ids = owned.map((request) => request.id);
  const auditRows = ids.length
    ? await prisma.heritageAuditEntry.findMany({
        where: {
          institutionId: user.institutionId,
          screenId: entity.screen,
          recordId: { in: ids },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const historyByRequest = new Map<string, Array<{ at: string; action: string; status: string; actor: string; note: string }>>();
  for (const entry of auditRows) {
    if (!entry.recordId) continue;
    const after = parse(entry.afterJson);
    const status = s(after.status);
    const decisionNote = s(after.decisionNote);
    const history = historyByRequest.get(entry.recordId) ?? [];
    history.push({
      at: entry.createdAt.toISOString(),
      action: entry.action,
      status,
      actor: entry.actorName || "Academic staff",
      note: entry.note || decisionNote,
    });
    historyByRequest.set(entry.recordId, history);
  }

  return owned.map((request) => ({
    id: request.id,
    title: s(request.title) || "Programme change request",
    programme: programmeLabels.get(s(request.programId)) || "Programme",
    type: s(request.type),
    rationale: s(request.rationale),
    effectiveTerm: s(request.effectiveTerm),
    status: s(request.status) || "Submitted",
    decisionNote: s(request.decisionNote),
    submittedAt: s(request._createdAt) || request.updatedAt,
    updatedAt: request.updatedAt,
    history: historyByRequest.get(request.id) ?? [],
  }));
}

async function applyUpdate(user: SessionClaims, entity: EntityKey, id: string, input: Data, action: string, note?: string) {
  const e = ENTITIES[entity];
  const inst = user.institutionId;
  const before = await findRow(user, entity, id);
  const data = await validate(inst, entity, input, before);
  if (e.store === "table") await TABLES[entity]!.update(inst, id, data, user);
  else await prisma.heritageRecord.update({ where: { id }, data: { dataJson: JSON.stringify(fieldData(e, data)), updatedById: user.accountId, rowVersion: { increment: 1 } } });
  await audit(user, e.screen, "", action, { recordId: id, before: fieldData(e, before), after: fieldData(e, data), note: note ?? null });
  await AFTER[entity]?.(ctxOf(user), { id, data, before });
}

export async function updateOps(user: SessionClaims, entity: EntityKey, id: string, body: Data) {
  await can(user, entity, "edit");
  const e = ENTITIES[entity];
  if (e.edit === false) throw httpError(405, `${e.plural} cannot be edited here`, "NOT_ALLOWED");
  const current = await findRow(user, entity, id);
  const conflict = actionFieldEditConflict(e, current, body);
  if (conflict) throw httpError(409, conflict, "CONFLICT");
  await applyUpdate(user, entity, id, body, "update", entity === "standing" ? s(body.reason) : undefined);
  return { ok: true, id, message: `${e.label} saved` };
}

/** Keeps workflow fields action-only unless the entity explicitly supports a staff edit-form override. */
export function actionFieldEditConflict(e: OpsEntity, current: Data, body: Data) {
  for (const [k, v] of Object.entries(body)) {
    const steps = (e.actions ?? []).filter((a) => a.set && k in a.set);
    if (!steps.length || e.directActionEdits?.includes(k) || s(v) === s(current[k])) continue;
    const reachable = steps.some(
      (a) => s(token(a.set![k])) === s(v) && Object.entries(a.when ?? {}).every(([wk, vals]) => vals.includes(current[wk] as string | boolean)),
    );
    if (!reachable) {
      const label = e.fields.find((f) => f.key === k)?.label ?? k;
      return `${label} cannot change from "${s(current[k])}" to "${s(v)}" — use the ${e.label.toLowerCase()}'s actions instead`;
    }
  }
  return null;
}

export async function actionOps(user: SessionClaims, entity: EntityKey, id: string, actionKey: string) {
  await can(user, entity, "edit");
  const e = ENTITIES[entity];
  const action = e.actions?.find((a) => a.key === actionKey);
  if (!action) throw httpError(404, "Unknown action", "NOT_FOUND");
  const row = await findRow(user, entity, id);
  const allowed = Object.entries(action.when ?? {}).every(([k, vals]) => vals.includes(row[k] as string | boolean));
  if (!allowed) throw httpError(409, `"${action.label}" is not available for this ${e.label.toLowerCase()} any more`, "CONFLICT");
  if (action.run) {
    const routine = RUN[entity]?.[action.key];
    if (!routine) throw httpError(404, "Unknown action", "NOT_FOUND");
    const message = await routine(ctxOf(user), row);
    await audit(user, e.screen, "", `action:${action.key}`, { recordId: id, note: message });
    return { ok: true, id, message };
  }
  const set = Object.fromEntries(Object.entries(action.set ?? {}).map(([k, v]) => [k, token(v)]));
  await applyUpdate(user, entity, id, set, `action:${action.key}`);
  return { ok: true, id, message: `${e.label}: ${action.label} done` };
}

export async function deleteOps(user: SessionClaims, entity: EntityKey, id: string) {
  await can(user, entity, "edit");
  const e = ENTITIES[entity];
  if (e.remove === false) throw httpError(405, `${e.plural} cannot be deleted here`, "NOT_ALLOWED");
  const inst = user.institutionId;
  const before = await findRow(user, entity, id);
  if (e.store === "table") await TABLES[entity]!.remove!(inst, id);
  else await prisma.heritageRecord.update({ where: { id }, data: { deletedAt: new Date(), status: "deleted", updatedById: user.accountId } });
  if (entity === "labSessions") {
    const { removeSyncedLabSession } = await import("../../labs/lab-flow.service.js");
    await removeSyncedLabSession(inst, id, user.accountId);
  }
  await audit(user, e.screen, "", "delete", { recordId: id, before: fieldData(e, before) });
  return { ok: true, id, message: `${e.label} deleted` };
}

/* ------------------------------------------------------------------ */
/* Dashboards                                                           */
/* ------------------------------------------------------------------ */

type Kpi = { label: string; value: string | number; hint?: string; tone?: "danger" | "warn" | "ok"; slug?: string };
type Panel = { title: string; slug?: string; kind: "table"; columns: string[]; rows: string[][]; empty: string } | { title: string; slug?: string; kind: "bars"; bars: Array<{ label: string; value: number; note?: string }> };

const AT_RISK = /warning|alert|probation|suspend/i;

export async function opsDashboard(user: SessionClaims, module: ModuleKey) {
  await assertPermission(user, MODULES[module].permission, "view");
  const inst = user.institutionId;
  const refs = new Refs(inst);
  const ext = DASH[module];
  if (ext) return { module, label: MODULES[module].label, ...(await ext(ctxOf(user, refs))) };
  const t = today();
  const kpis: Kpi[] = [];
  const panels: Panel[] = [];

  if (module === "practicum") {
    const [employers, placements, logs, evals, agreements, incidents] = await Promise.all(
      (["employers", "placements", "logs", "evaluations", "agreements", "practicumIncidents"] as EntityKey[]).map((k) => rowsOf(inst, k)),
    );
    const plLabel = await refs.labels("placements");
    const emLabel = await refs.labels("employers");
    const pendingLogs = logs.filter((l) => l.status === "pending");
    const renewals = agreements.filter((a) => a.status === "active" && s(a.renewsOn) && s(a.renewsOn) <= addDays(60));
    const openInc = incidents.filter((i) => i.status === "Open" || i.status === "Investigating");
    kpis.push(
      { label: "Employers", value: employers.length, slug: "employers" },
      { label: "Active placements", value: placements.filter((p) => p.status === "active").length, hint: `${placements.length} total`, slug: "placements" },
      { label: "Hours awaiting approval", value: pendingLogs.length, tone: pendingLogs.length ? "warn" : "ok", slug: "logs" },
      { label: "Evaluations due", value: evals.filter((e) => e.status === "due").length, slug: "evaluations" },
      { label: "Agreements renewing ≤ 60 days", value: renewals.length, tone: renewals.length ? "warn" : "ok", slug: "agreements" },
      { label: "Open incidents", value: openInc.length, tone: openInc.length ? "danger" : "ok", slug: "incidents" },
    );
    panels.push(
      { title: "Hours awaiting approval", slug: "logs", kind: "table", columns: ["Placement", "Week", "Hours"], rows: take(pendingLogs).map((l) => [plLabel.get(s(l.placementId)) ?? "—", s(l.weekLabel), s(l.hours)]), empty: "No hours waiting." },
      { title: "Upcoming agreement renewals", slug: "agreements", kind: "table", columns: ["Agreement", "Employer", "Renews"], rows: take(renewals.sort((a, b) => s(a.renewsOn).localeCompare(s(b.renewsOn)))).map((a) => [s(a.title), emLabel.get(s(a.employerOrgId)) ?? "—", s(a.renewsOn)]), empty: "No renewals in the next 60 days." },
      { title: "Placements by status", slug: "placements", kind: "bars", bars: ["pending", "active", "completed", "withdrawn"].map((st) => ({ label: st, value: placements.filter((p) => p.status === st).length })) },
    );
  }

  if (module === "success") {
    const [cases, tasks, appts, students] = await Promise.all([
      rowsOf(inst, "cases"),
      rowsOf(inst, "tasks"),
      rowsOf(inst, "appointments"),
      prisma.student.findMany({ where: { institutionId: inst }, include: { person: true } }),
    ]);
    const stLabel = await refs.labels("students");
    const caseLabel = await refs.labels("cases");
    const open = cases.filter((c) => !["resolved", "closed"].includes(s(c.status)));
    const overdue = tasks.filter((x) => ["pending", "in_progress"].includes(s(x.status)) && s(x.dueAt) && s(x.dueAt) < t);
    const now = new Date().toISOString().slice(0, 16);
    const week = `${addDays(7)}T23:59`;
    const upcoming = appts.filter((a) => ["requested", "confirmed"].includes(s(a.status)) && s(a.startsAt) >= now && s(a.startsAt) <= week).sort((a, b) => s(a.startsAt).localeCompare(s(b.startsAt)));
    const withCase = new Set(open.map((c) => s(c.studentId)));
    const uncovered = students.filter((st) => AT_RISK.test(st.standing) && !withCase.has(st.id));
    kpis.push(
      { label: "Open cases", value: open.length, slug: "cases" },
      { label: "Critical / alert cases", value: open.filter((c) => ["critical", "alert"].includes(s(c.level))).length, tone: "danger", slug: "cases" },
      { label: "Overdue tasks", value: overdue.length, tone: overdue.length ? "warn" : "ok", slug: "action-plan" },
      { label: "Appointments next 7 days", value: upcoming.length, slug: "appointments" },
      { label: "At-risk students without a case", value: uncovered.length, tone: uncovered.length ? "danger" : "ok", hint: "Warning, alert, probation or suspended standing", slug: "cases" },
    );
    panels.push(
      { title: "Upcoming appointments", slug: "appointments", kind: "table", columns: ["When", "Student", "Topic"], rows: take(upcoming).map((a) => [s(a.startsAt).replace("T", " "), stLabel.get(s(a.studentId)) ?? "—", s(a.topic)]), empty: "No appointments in the next 7 days." },
      { title: "Overdue action-plan tasks", slug: "action-plan", kind: "table", columns: ["Task", "Case", "Due"], rows: take(overdue).map((x) => [s(x.title), caseLabel.get(s(x.caseId)) ?? "—", s(x.dueAt)]), empty: "Nothing overdue." },
      { title: "At-risk students without a case", slug: "cases", kind: "table", columns: ["Student", "Program", "Standing"], rows: take(uncovered, 8).map((st) => [`${personName(st.person)} (${st.studentNumber})`, st.programName, st.standing]), empty: "Every at-risk student has an open case." },
      { title: "Open cases by level", slug: "cases", kind: "bars", bars: ["watch", "warning", "alert", "critical"].map((l) => ({ label: l, value: open.filter((c) => c.level === l).length })) },
    );
  }

  if (module === "labs") {
    const [equipment, inventory, sessions, incidents, eligibility] = await Promise.all((["equipment", "inventory", "labSessions", "labIncidents", "eligibility"] as EntityKey[]).map((k) => rowsOf(inst, k)));
    const room = await refs.labels("classrooms");
    const serviceDue = equipment.filter((x) => x.status !== "Retired" && s(x.nextService) && s(x.nextService) <= addDays(30));
    const low = inventory.filter((x) => x._stock !== "OK");
    const upcoming = sessions.filter((x) => x.status === "Scheduled" && s(x.date) >= t && s(x.date) <= addDays(7)).sort((a, b) => `${s(a.date)}${s(a.startTime)}`.localeCompare(`${s(b.date)}${s(b.startTime)}`));
    const openInc = incidents.filter((i) => i.status === "Open" || i.status === "Investigating");
    const expiring = eligibility.filter((x) => x.status === "Cleared" && s(x.expiresOn) && s(x.expiresOn) <= addDays(30));
    kpis.push(
      { label: "Equipment", value: equipment.filter((x) => x.status !== "Retired").length, hint: `${equipment.filter((x) => x.status === "Maintenance").length} in maintenance`, slug: "equipment" },
      { label: "Service due ≤ 30 days", value: serviceDue.length, tone: serviceDue.length ? "warn" : "ok", slug: "equipment" },
      { label: "Low / expired stock", value: low.length, tone: low.length ? "warn" : "ok", slug: "inventory" },
      { label: "Sessions next 7 days", value: upcoming.length, hint: `${sessions.filter((x) => x.date === t && x.status !== "Cancelled").length} today`, slug: "sessions" },
      { label: "Open incidents", value: openInc.length, tone: openInc.length ? "danger" : "ok", slug: "incidents" },
      { label: "Clearances expiring ≤ 30 days", value: expiring.length, slug: "eligibility" },
    );
    panels.push(
      { title: "Upcoming lab sessions", slug: "sessions", kind: "table", columns: ["Date", "Time", "Session", "Room"], rows: take(upcoming).map((x) => [s(x.date), s(x._time), s(x.title), room.get(s(x.roomId)) ?? "—"]), empty: "No sessions in the next 7 days." },
      { title: "Stock needing attention", slug: "inventory", kind: "table", columns: ["Item", "On hand", "Reorder at", "Stock"], rows: take(low).map((x) => [s(x.item), `${s(x.quantity)} ${s(x.unit)}`.trim(), s(x.reorderLevel) || "—", s(x._stock)]), empty: "All stock levels are fine." },
      { title: "Open incidents", slug: "incidents", kind: "table", columns: ["When", "Category", "Severity"], rows: take(openInc).map((x) => [s(x.occurredAt).replace("T", " "), s(x.category), s(x.severity)]), empty: "No open incidents." },
      { title: "Equipment by status", slug: "equipment", kind: "bars", bars: ["Available", "In Use", "Maintenance", "Retired"].map((st) => ({ label: st, value: equipment.filter((x) => x.status === st).length })) },
    );
  }

  if (module === "crm") {
    const [leads, campaigns, events, applications] = await Promise.all([rowsOf(inst, "leads"), rowsOf(inst, "campaigns"), rowsOf(inst, "events"), prisma.admissionsApplication.count({ where: { institutionId: inst } })]);
    const staff = await refs.labels("staff");
    const stages = ENTITIES.leads.fields.find((f) => f.key === "stage")!.options!;
    const funnel = stages.filter((st) => st !== "Lost");
    const reached = (st: string) => leads.filter((l) => s(l.stage) !== "Lost" && funnel.indexOf(s(l.stage)) >= funnel.indexOf(st)).length;
    const due = leads.filter((l) => !["Enrolled", "Lost"].includes(s(l.stage)) && s(l.nextFollowUp) && s(l.nextFollowUp) <= t).sort((a, b) => s(a.nextFollowUp).localeCompare(s(b.nextFollowUp)));
    const upcoming = events.filter((e) => ["Planned", "Open", "Full"].includes(s(e.status)) && s(e.date) >= t).sort((a, b) => s(a.date).localeCompare(s(b.date)));
    const total = leads.length;
    kpis.push(
      { label: "Leads", value: total, hint: `${leads.filter((l) => l.stage === "New").length} new`, slug: "queue" },
      { label: "Follow-ups due", value: due.length, tone: due.length ? "warn" : "ok", slug: "queue" },
      { label: "Lead → Applied", value: total ? `${Math.round((reached("Applied") / total) * 100)}%` : "—", hint: `${reached("Applied")} applied or further` },
      { label: "Active campaigns", value: campaigns.filter((c) => c.status === "Active").length, slug: "campaigns" },
      { label: "Upcoming events", value: upcoming.length, slug: "events" },
      { label: "Applications in Admissions", value: applications, hint: "Admissions module" },
    );
    panels.push(
      { title: "Funnel", slug: "queue", kind: "bars", bars: funnel.map((st) => ({ label: st, value: reached(st), note: total ? `${Math.round((reached(st) / total) * 100)}%` : "" })) },
      { title: "Leads by source", slug: "queue", kind: "bars", bars: ENTITIES.leads.fields.find((f) => f.key === "source")!.options!.map((src) => ({ label: src, value: leads.filter((l) => l.source === src).length })) },
      { title: "Follow-ups due", slug: "queue", kind: "table", columns: ["Lead", "Stage", "Counsellor", "Due"], rows: take(due, 8).map((l) => [`${s(l.firstName)} ${s(l.lastName)}`, s(l.stage), staff.get(s(l.counsellorId)) ?? "Unassigned", s(l.nextFollowUp)]), empty: "No follow-ups due." },
      { title: "Upcoming events", slug: "events", kind: "table", columns: ["Date", "Event", "Registrations"], rows: take(upcoming).map((e) => [s(e.date), s(e.name), s(e._registrations)]), empty: "No upcoming events." },
    );
  }

  return { module, label: MODULES[module].label, kpis, panels };
}
