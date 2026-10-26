import { randomBytes } from "node:crypto";
import { decideApproval, hashPassword } from "@myheritage/auth";
import type { RoleName } from "@myheritage/contracts";
import { prisma } from "@myheritage/db";
import { ADMISSIONS_LEAD_STATUSES, ADMISSIONS_STAGE_PROGRESS, ADMISSIONS_STAGE_TEXT } from "@myheritage/contracts";
import { forgetSessionRevocation } from "../../../middleware/auth.js";
import { SAFE_LINK_MESSAGE, isSafeLink } from "../../../lib/safeLink.js";
import { OPEN_SERVICE_REQUEST_STATUSES, applyApprovedRequest, settleRejectedApproval } from "../../approvals/approvals.service.js";
import type { Data, EntityKey, ModuleKey, OpsRef } from "./ops.spec.js";
import { APP_ADMITTED, APP_EARLY, MORE_ENTITIES } from "./ops.spec.more.js";
import { isGovernmentIdDocument } from "../../applicant/applicationForm.js";
import { syncLabSession } from "../../labs/lab-flow.service.js";

const GOVERNMENT_ID_DOC_MESSAGE = "The college does not collect passports, SIN cards or other government ID";
import { addDays, age, bump, httpError, n, parse, pct, personName, records, s, stampOf, take, today, type Adapter, type Change, type Ctx, type Opt, type Row } from "./ops.util.js";

type Kpi = { label: string; value: string | number; hint?: string; tone?: "danger" | "warn" | "ok"; slug?: string };
type Panel = { title: string; slug?: string; kind: "table"; columns: string[]; rows: string[][]; empty: string } | { title: string; slug?: string; kind: "bars"; bars: Array<{ label: string; value: number; note?: string }> };
export type RuleCtx = { inst: string; id: string | null; before: Row | null };

const STAFF_RE = /instructor|admin|registrar|advisor|staff|faculty|counsel/i;
const pretty = (v: unknown) => s(v).replace(/_/g, " ");
const rolesOf = (json: string) => {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(s) : [];
  } catch {
    return [];
  }
};
const changed = (c: Change, key: string) => s(c.data[key]) !== s(c.before?.[key]);
const lines = (xs: string[]) => xs.filter(Boolean).join("\n");
const diffLabel = (key: string) => key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_.]/g, " ").replace(/^./, (c) => c.toUpperCase());
function approvalDiffText(diff: Data) {
  const rows = Object.entries(diff).flatMap(([key, value]) => {
    if (key.startsWith("_") || value === null || value === undefined || value === "") return [];
    if ((key === "gradeItemIds" || key === "studentIds") && Array.isArray(value)) {
      const label = key === "gradeItemIds" ? "Grade items" : "Students";
      return [`${label}: ${value.length} record${value.length === 1 ? "" : "s"}`];
    }
    if (Array.isArray(value)) return [`${diffLabel(key)}: ${value.map((item) => (typeof item === "object" ? "record" : s(item))).join(", ") || "None"}`];
    if (typeof value === "object") {
      const nested = Object.entries(value as Data).map(([child, item]) => `${diffLabel(child)}: ${s(item)}`).join("; ");
      return [`${diffLabel(key)}: ${nested || "None"}`];
    }
    return [`${diffLabel(key)}: ${typeof value === "boolean" ? (value ? "Yes" : "No") : s(value)}`];
  });
  return lines(rows) || "No proposed field changes";
}
const downloadLink = (d: Data) => {
  const url = s(d.downloadUrl).trim();
  if (url && !isSafeLink(url)) throw httpError(400, SAFE_LINK_MESSAGE, "VALIDATION_ERROR");
  return url || null;
};

/* ------------------------------------------------------------------ */
/* Shared helpers                                                       */
/* ------------------------------------------------------------------ */

async function notify(inst: string, accountId: string | null | undefined, title: string, body: string) {
  if (!accountId) return;
  await prisma.notification.create({ data: { institutionId: inst, recipientAccountId: accountId, channel: "in_app", title, body } });
}
async function accountOfPerson(inst: string, personId: string | null | undefined) {
  if (!personId) return null;
  return (await prisma.account.findFirst({ where: { institutionId: inst, personId }, select: { id: true }, orderBy: { createdAt: "asc" } }))?.id ?? null;
}
async function accountOfStudent(inst: string, studentId: string) {
  const st = await prisma.student.findFirst({ where: { id: studentId, institutionId: inst }, select: { personId: true } });
  return accountOfPerson(inst, st?.personId);
}
async function accountMap(inst: string) {
  const rows = await prisma.account.findMany({ where: { institutionId: inst }, select: { id: true, email: true } });
  return new Map(rows.map((a) => [a.id, a.email]));
}
async function studentMap(inst: string) {
  const rows = await prisma.student.findMany({ where: { institutionId: inst }, include: { person: true } });
  return new Map(rows.map((r) => [r.id, `${personName(r.person)} (${r.studentNumber})`]));
}
async function activeHold(inst: string, studentId: string) {
  return (await records(inst, MORE_ENTITIES.legalHolds.screen)).find((h) => h.status === "Active" && h.studentId === studentId) ?? null;
}

/* ------------------------------------------------------------------ */
/* Reference lists                                                      */
/* ------------------------------------------------------------------ */

export const EXT_REFS: Partial<Record<OpsRef, (inst: string) => Promise<Opt[]>>> = {
  async applications(inst) {
    const apps = await prisma.admissionsApplication.findMany({ where: { institutionId: inst }, orderBy: { createdAt: "desc" } });
    const people = new Map((await prisma.person.findMany({ where: { id: { in: [...new Set(apps.map((a) => a.personId))] } } })).map((p) => [p.id, personName(p)]));
    return apps.map((a) => ({ id: a.id, label: `${people.get(a.personId) || "Applicant"} · ${a.programName} (${a.intakeTerm})` }));
  },
  async accounts(inst) {
    const rows = await prisma.account.findMany({ where: { institutionId: inst, status: { not: "deleted" } }, include: { person: true }, take: 5000 });
    return rows.map((a) => ({ id: a.id, label: `${personName(a.person) || a.email} (${a.email})` })).sort((a, b) => a.label.localeCompare(b.label));
  },
  async terms(inst) {
    const rows = await prisma.term.findMany({ where: { institutionId: inst }, orderBy: { startsOn: "desc" } });
    return rows.map((t) => ({ id: t.id, label: t.name }));
  },
  async forms(inst) {
    const rows = await records(inst, "SYS:FORM");
    return rows.map((r) => ({ id: r.id, label: s(r.name) })).sort((a, b) => a.label.localeCompare(b.label));
  },
  async retentionPolicies(inst) {
    const rows = await records(inst, MORE_ENTITIES.retention.screen);
    return rows.map((r) => ({ id: r.id, label: `${s(r.recordType)} · ${s(r.years)} years (${s(r.status)})` }));
  },
};

/* ------------------------------------------------------------------ */
/* Admissions helpers                                                   */
/* ------------------------------------------------------------------ */

const LEADS: readonly string[] = ADMISSIONS_LEAD_STATUSES;
const STAGE_TEXT = ADMISSIONS_STAGE_TEXT;
const PROGRESS = ADMISSIONS_STAGE_PROGRESS;

async function timeline(inst: string, applicationId: string, title: string, detail?: string) {
  await prisma.applicationTimelineEvent.create({ data: { institutionId: inst, applicationId, title, detail: detail ?? null } });
}

/** Moves an application to a new stage with timeline entry and applicant notification. */
async function setStage(inst: string, applicationId: string, status: string, title: string, detail?: string) {
  const app = await prisma.admissionsApplication.findFirst({ where: { id: applicationId, institutionId: inst } });
  if (!app || app.status === status) return;
  await prisma.admissionsApplication.update({
    where: { id: app.id },
    data: { status, progressPct: Math.max(app.progressPct, PROGRESS[status] ?? 0), submittedAt: app.submittedAt ?? (LEADS.includes(status) ? null : new Date()), ...bump },
  });
  await timeline(inst, app.id, title, detail);
  if (STAGE_TEXT[status]) await notify(inst, app.accountId, "Application update", STAGE_TEXT[status]!);
}

async function nextStudentNumber(inst: string, offset = 0) {
  const year = new Date().getFullYear();
  let k = (await prisma.student.count({ where: { institutionId: inst, studentNumber: { startsWith: `ST-${year}-` } } })) + 1 + offset;
  while (await prisma.student.findFirst({ where: { institutionId: inst, studentNumber: `ST-${year}-${String(k).padStart(3, "0")}` } })) k++;
  return `ST-${year}-${String(k).padStart(3, "0")}`;
}

async function intakeFor(inst: string, programName: string, intakeTerm: string) {
  return (await records(inst, MORE_ENTITIES.intakes.screen)).find((r) => r.programName === programName && r.intakeTerm === intakeTerm) ?? null;
}

/* ------------------------------------------------------------------ */
/* Rule evaluation                                                      */
/* ------------------------------------------------------------------ */

type Fact = { id: string; label: string; values: Record<string, string | number> };

async function studentFacts(inst: string): Promise<Fact[]> {
  const [students, enrolments, cases, credits, placements] = await Promise.all([
    prisma.student.findMany({ where: { institutionId: inst }, include: { person: true } }),
    prisma.enrolment.groupBy({ by: ["studentId"], where: { institutionId: inst, status: "enrolled" }, _count: { _all: true } }),
    prisma.successCase.groupBy({ by: ["studentId"], where: { institutionId: inst, status: { notIn: ["resolved", "closed"] } }, _count: { _all: true } }),
    prisma.transferCredit.groupBy({ by: ["studentId"], where: { institutionId: inst, status: "accepted" }, _sum: { credits: true } }),
    prisma.placement.findMany({ where: { institutionId: inst, studentId: { not: null } }, select: { studentId: true, hours: { where: { status: "approved" }, select: { hours: true } } } }),
  ]);
  const enr = new Map(enrolments.map((e) => [e.studentId, e._count._all]));
  const cs = new Map(cases.map((e) => [e.studentId, e._count._all]));
  const tc = new Map(credits.map((e) => [e.studentId, e._sum.credits ?? 0]));
  const hrs = new Map<string, number>();
  for (const p of placements) hrs.set(p.studentId!, (hrs.get(p.studentId!) ?? 0) + p.hours.reduce((t, h) => t + h.hours, 0));
  return students.map((st) => ({
    id: st.id,
    label: `${personName(st.person)} (${st.studentNumber})`,
    values: {
      "Academic standing": st.standing,
      Program: st.programName,
      "Active enrolments": enr.get(st.id) ?? 0,
      "Open success cases": cs.get(st.id) ?? 0,
      "Approved transfer credits": tc.get(st.id) ?? 0,
      "Placement hours (approved)": hrs.get(st.id) ?? 0,
    },
  }));
}

const NUMERIC_FACTS = ["Active enrolments", "Open success cases", "Approved transfer credits", "Placement hours (approved)"];

function matches(rule: Data, fact: Fact) {
  const actual = fact.values[s(rule.fact)];
  const want = s(rule.value).trim();
  if (NUMERIC_FACTS.includes(s(rule.fact))) {
    const a = Number(actual);
    const b = Number(want);
    switch (rule.operator) {
      case "equals":
        return a === b;
      case "does not equal":
        return a !== b;
      case "is greater than":
        return a > b;
      case "is less than":
        return a < b;
      default:
        return String(a).includes(want);
    }
  }
  const a = s(actual).toLowerCase();
  const b = want.toLowerCase();
  switch (rule.operator) {
    case "equals":
      return a === b;
    case "does not equal":
      return a !== b;
    case "contains":
      return a.includes(b);
    case "is greater than":
      return a > b;
    case "is less than":
      return a < b;
    default:
      return false;
  }
}

/* ------------------------------------------------------------------ */
/* Dedicated-table adapters                                             */
/* ------------------------------------------------------------------ */

export const EXT_TABLES: Partial<Record<EntityKey, Adapter>> = {
  applications: {
    async list(inst) {
      const apps = await prisma.admissionsApplication.findMany({ where: { institutionId: inst }, include: { documents: { select: { status: true } } }, orderBy: { createdAt: "desc" } });
      const people = new Map((await prisma.person.findMany({ where: { id: { in: [...new Set(apps.map((a) => a.personId))] } } })).map((p) => [p.id, p]));
      const students = await prisma.student.findMany({ where: { institutionId: inst, personId: { in: [...people.keys()] } }, select: { personId: true, programName: true, studentNumber: true } });
      return apps.map((a) => {
        const p = people.get(a.personId);
        const st = students.find((x) => x.personId === a.personId && (x.programName === a.programName || a.status === "enrolled"));
        return {
          id: a.id,
          givenName: p?.givenName ?? "",
          familyName: p?.familyName ?? "",
          email: p?.email ?? "",
          phone: p?.phone ?? "",
          programName: a.programName,
          intakeTerm: a.intakeTerm,
          status: a.status,
          progressPct: a.progressPct,
          notes: a.notes ?? "",
          submittedAt: stampOf(a.submittedAt),
          accountId: a.accountId,
          _name: personName(p),
          _docs: `${a.documents.filter((d) => d.status === "accepted").length}/${a.documents.length} accepted`,
          _converted: Boolean(st),
          _student: st ? `${st.studentNumber} · ${st.programName}` : "",
          updatedAt: a.updatedAt.toISOString(),
        };
      });
    },
    async create(inst, d) {
      const email = s(d.email).trim().toLowerCase();
      let account = await prisma.account.findFirst({ where: { institutionId: inst, email }, include: { person: true } });
      let person = account?.person ?? (await prisma.person.findFirst({ where: { institutionId: inst, email } }));
      if (!person) person = await prisma.person.create({ data: { institutionId: inst, givenName: s(d.givenName), familyName: s(d.familyName), email, phone: s(d.phone) || null } });
      if (!account) {
        account = await prisma.account.create({
          data: { institutionId: inst, personId: person.id, email, passwordHash: await hashPassword(randomBytes(24).toString("base64url")), rolesJson: JSON.stringify(["applicant"]) },
          include: { person: true },
        });
      } else if (!rolesOf(account.rolesJson).includes("applicant")) {
        await prisma.account.update({ where: { id: account.id }, data: { rolesJson: JSON.stringify([...rolesOf(account.rolesJson), "applicant"]), ...bump } });
      }
      const dup = await prisma.admissionsApplication.findFirst({
        where: { institutionId: inst, personId: person.id, programName: s(d.programName), intakeTerm: s(d.intakeTerm), status: { notIn: ["declined", "withdrawn", "refused_visa"] } },
      });
      if (dup) throw httpError(409, `${personName(person)} already has an open application for ${s(d.programName)} (${s(d.intakeTerm)})`, "CONFLICT");
      const status = s(d.status);
      const app = await prisma.admissionsApplication.create({
        data: {
          institutionId: inst,
          accountId: account.id,
          personId: person.id,
          programName: s(d.programName),
          intakeTerm: s(d.intakeTerm),
          status,
          progressPct: n(d.progressPct) ?? 50,
          notes: s(d.notes) || null,
          submittedAt: LEADS.includes(status) ? null : new Date(),
          documents: { create: ["Official transcript"].map((label) => ({ institutionId: inst, label, status: "missing" })) },
          timeline: { create: [{ institutionId: inst, title: "Application created by Admissions", detail: `${s(d.programName)} · ${s(d.intakeTerm)}` }] },
        },
      });
      return app.id;
    },
    async update(inst, id, d) {
      const app = await prisma.admissionsApplication.findFirst({ where: { id, institutionId: inst } });
      if (!app) throw httpError(404, "Application not found", "NOT_FOUND");
      const person = await prisma.person.findUnique({ where: { id: app.personId } });
      const email = s(d.email).trim().toLowerCase();
      if (person && email !== person.email) {
        const clash = (await prisma.person.findFirst({ where: { institutionId: inst, email, id: { not: person.id } } })) || (await prisma.account.findFirst({ where: { institutionId: inst, email, personId: { not: person.id } } }));
        if (clash) throw httpError(409, `E-mail ${email} already belongs to someone else`, "CONFLICT");
        await prisma.account.updateMany({ where: { institutionId: inst, personId: person.id, email: person.email }, data: { email } });
      }
      if (person) await prisma.person.update({ where: { id: person.id }, data: { givenName: s(d.givenName), familyName: s(d.familyName), email, phone: s(d.phone) || null, ...bump } });
      const status = s(d.status);
      const progressPct = status !== app.status ? Math.max(n(d.progressPct) ?? app.progressPct, PROGRESS[status] ?? 0) : (n(d.progressPct) ?? app.progressPct);
      await prisma.admissionsApplication.update({
        where: { id },
        data: { programName: s(d.programName), intakeTerm: s(d.intakeTerm), status, progressPct, notes: s(d.notes) || null, submittedAt: app.submittedAt ?? (LEADS.includes(status) ? null : new Date()), ...bump },
      });
    },
    async remove(_inst, id) {
      await prisma.admissionsApplication.delete({ where: { id } });
    },
  },
  appDocuments: {
    async list(inst) {
      const rows = await prisma.applicationDocument.findMany({ where: { institutionId: inst }, orderBy: [{ updatedAt: "desc" }] });
      return rows
        .filter((r) => !isGovernmentIdDocument(r.label))
        .map((r) => ({ id: r.id, applicationId: r.applicationId, label: r.label, status: r.status, fileName: r.fileName ?? "", updatedAt: r.updatedAt.toISOString() }));
    },
    async create(inst, d) {
      if (isGovernmentIdDocument(s(d.label))) throw httpError(400, GOVERNMENT_ID_DOC_MESSAGE, "VALIDATION_ERROR");
      return (await prisma.applicationDocument.create({ data: { institutionId: inst, applicationId: s(d.applicationId), label: s(d.label), status: s(d.status) } })).id;
    },
    async update(_inst, id, d) {
      if (isGovernmentIdDocument(s(d.label))) throw httpError(400, GOVERNMENT_ID_DOC_MESSAGE, "VALIDATION_ERROR");
      await prisma.applicationDocument.update({ where: { id }, data: { applicationId: s(d.applicationId), label: s(d.label), status: s(d.status), ...bump } });
    },
    async remove(_inst, id) {
      await prisma.applicationDocument.delete({ where: { id } });
    },
  },
  offers: {
    async list(inst) {
      const rows = await prisma.applicationOffer.findMany({ where: { institutionId: inst }, orderBy: { createdAt: "desc" } });
      return rows.map((r) => ({ id: r.id, applicationId: r.applicationId, title: r.title, conditions: r.conditions ?? "", expiresOn: r.expiresOn ?? "", status: r.status, updatedAt: r.updatedAt.toISOString() }));
    },
    async create(inst, d) {
      return (await prisma.applicationOffer.create({ data: { institutionId: inst, applicationId: s(d.applicationId), title: s(d.title), conditions: s(d.conditions) || null, expiresOn: s(d.expiresOn) || null, status: s(d.status) } })).id;
    },
    async update(_inst, id, d) {
      await prisma.applicationOffer.update({ where: { id }, data: { applicationId: s(d.applicationId), title: s(d.title), conditions: s(d.conditions) || null, expiresOn: s(d.expiresOn) || null, status: s(d.status), ...bump } });
    },
    async remove(_inst, id) {
      await prisma.applicationOffer.delete({ where: { id } });
    },
  },
  complianceCases: {
    async list(inst) {
      const [rows, students, accounts] = await Promise.all([prisma.complianceCase.findMany({ where: { institutionId: inst }, orderBy: { createdAt: "desc" } }), studentMap(inst), accountMap(inst)]);
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        caseKind: pretty(r.caseKind),
        _subject: `${pretty(r.subjectType)}: ${students.get(r.subjectRef) ?? accounts.get(r.subjectRef) ?? r.subjectRef}`,
        missCount: r.missCount,
        detail: r.detail,
        severity: r.severity,
        status: r.status,
        explanation: r.explanation ?? "",
        resolvedAt: stampOf(r.resolvedAt),
        updatedAt: r.updatedAt.toISOString(),
      }));
    },
    async update(inst, id, d, user) {
      const prev = await prisma.complianceCase.findFirst({ where: { id, institutionId: inst } });
      if (!prev) throw httpError(404, "Compliance case not found", "NOT_FOUND");
      const open = s(d.status) === "open";
      const nextStatus = s(d.status);
      await prisma.$transaction(async (tx) => {
        await tx.complianceCase.update({
          where: { id },
          data: { severity: s(d.severity), status: nextStatus, explanation: s(d.explanation) || null, resolvedAt: open || nextStatus === "explained" ? null : (prev.resolvedAt ?? new Date()), resolvedById: open || nextStatus === "explained" ? null : (prev.resolvedById ?? user.accountId), ...bump },
        });
        if (prev.subjectType === "student" && prev.caseKind === "student_miss_pause" && (nextStatus === "resolved" || nextStatus === "dismissed")) {
          const remaining = await tx.complianceCase.count({
            where: { institutionId: inst, subjectType: "student", subjectRef: prev.subjectRef, caseKind: "student_miss_pause", status: { in: ["open", "explained"] }, id: { not: id } },
          });
          if (remaining === 0) {
            const student = await tx.student.findFirst({ where: { id: prev.subjectRef, institutionId: inst }, select: { personId: true } });
            if (student) {
              await tx.account.updateMany({ where: { institutionId: inst, personId: student.personId, status: "paused" }, data: { status: "active" } });
              await tx.student.update({ where: { id: prev.subjectRef }, data: { standing: "warning", rowVersion: { increment: 1 } } });
            }
          }
        }
      });
    },
  },
  recordVault: {
    async list(inst) {
      const rows = await prisma.studentDocument.findMany({ where: { institutionId: inst }, orderBy: { createdAt: "desc" } });
      return rows.map((r) => ({ id: r.id, studentId: r.studentId, recordName: r.recordName, docLabel: r.docLabel ?? "", recordDate: r.recordDate ?? "", downloadUrl: r.downloadUrl ?? "", status: r.status, note: r.note ?? "", updatedAt: r.updatedAt.toISOString() }));
    },
    async create(inst, d) {
      return (await prisma.studentDocument.create({ data: { institutionId: inst, studentId: s(d.studentId), recordName: s(d.recordName), docLabel: s(d.docLabel) || null, recordDate: s(d.recordDate) || null, downloadUrl: downloadLink(d), status: s(d.status), note: s(d.note) || null } })).id;
    },
    async update(_inst, id, d) {
      await prisma.studentDocument.update({ where: { id }, data: { studentId: s(d.studentId), recordName: s(d.recordName), docLabel: s(d.docLabel) || null, recordDate: s(d.recordDate) || null, downloadUrl: downloadLink(d), status: s(d.status), note: s(d.note) || null, ...bump } });
    },
    async remove(_inst, id) {
      await prisma.studentDocument.delete({ where: { id } });
    },
  },
  approvals: {
    async list(inst) {
      const [rows, accounts, students] = await Promise.all([prisma.approvalRequest.findMany({ where: { institutionId: inst }, orderBy: { createdAt: "desc" }, take: 500 }), accountMap(inst), studentMap(inst)]);
      return rows.map((r) => {
        const inbox = !r.type.startsWith("course_session_");
        const decisions = (() => {
          try {
            return JSON.parse(r.decisionsJson) as Array<{ actorId: string; decision: string; comment?: string; decidedAt: string }>;
          } catch {
            return [];
          }
        })();
        const diff = parse(r.proposedDiffJson);
        return {
          id: r.id,
          type: r.type,
          status: r.status,
          createdAt: stampOf(r.createdAt),
          _subject: students.get(r.subjectRef) ?? (s(diff.studentName) || s(diff.title) || r.subjectRef),
          _requester: accounts.get(r.requestedBy) ?? r.requestedBy,
          _age: r.status === "pending" ? age(r.createdAt) : "—",
          _decisions: lines(decisions.map((x) => `${x.decidedAt.slice(0, 16).replace("T", " ")} · ${accounts.get(x.actorId) ?? x.actorId} · ${x.decision}${x.comment ? ` — ${x.comment}` : ""}`)) || "No decisions yet",
          _diff: approvalDiffText(diff).slice(0, 3000),
          _where: inbox ? "Workflows / Approvals inbox" : "My Courses → Pending Course Schedules",
          _inbox: inbox,
          updatedAt: r.updatedAt.toISOString(),
        };
      });
    },
    async update() {
      throw httpError(405, "Approval requests are decided with Approve / Reject", "NOT_ALLOWED");
    },
  },
  aiInteractions: {
    async list(inst) {
      const rows = await prisma.aiInteraction.findMany({ where: { institutionId: inst }, include: { account: { select: { email: true } } }, orderBy: { createdAt: "desc" }, take: 500 });
      return rows.map((r) => {
        const sources = (() => {
          try {
            const v = JSON.parse(r.sourcesJson);
            return Array.isArray(v) ? (v as Data[]) : [];
          } catch {
            return [];
          }
        })();
        return {
          id: r.id,
          createdAt: stampOf(r.createdAt),
          _user: r.account.email,
          role: r.role,
          capability: r.capability,
          provider: r.provider,
          question: r.question,
          answer: r.answer,
          _question: r.question.length > 70 ? `${r.question.slice(0, 70)}…` : r.question,
          _sources: lines(sources.map((x) => [s(x.title) || s(x.slug), s(x.uri)].filter(Boolean).join(" — "))) || "No sources cited",
          _cited: sources.length ? "Yes" : "No",
          estimatedTokens: r.estimatedTokens,
          latencyMs: r.latencyMs,
          resultStatus: r.resultStatus,
          updatedAt: r.updatedAt.toISOString(),
        };
      });
    },
    async update() {
      throw httpError(405, "Interactions are read-only", "NOT_ALLOWED");
    },
  },
  knowledge: {
    async list(inst) {
      const [docs, used] = await Promise.all([
        prisma.knowledgeDocument.findMany({ where: { institutionId: inst }, orderBy: { title: "asc" } }),
        prisma.aiInteraction.findMany({ where: { institutionId: inst }, select: { sourcesJson: true }, orderBy: { createdAt: "desc" }, take: 3000 }),
      ]);
      return docs.map((d) => ({
        id: d.id,
        title: d.title,
        slug: d.slug,
        docType: d.docType,
        uri: d.uri,
        versionLabel: d.versionLabel,
        status: d.status,
        body: d.body,
        _size: `${(d.body.length / 1000).toFixed(1)}k chars`,
        _cited: used.filter((u) => u.sourcesJson.includes(`"${d.slug}"`) || u.sourcesJson.includes(d.id)).length,
        updatedAt: d.updatedAt.toISOString(),
      }));
    },
    async create(inst, d) {
      return (await prisma.knowledgeDocument.create({ data: { institutionId: inst, title: s(d.title), slug: s(d.slug), docType: s(d.docType), uri: s(d.uri), versionLabel: s(d.versionLabel), status: s(d.status), body: s(d.body) } })).id;
    },
    async update(_inst, id, d) {
      await prisma.knowledgeDocument.update({ where: { id }, data: { title: s(d.title), slug: s(d.slug), docType: s(d.docType), uri: s(d.uri), versionLabel: s(d.versionLabel), status: s(d.status), body: s(d.body), ...bump } });
    },
    async remove(_inst, id) {
      await prisma.knowledgeDocument.delete({ where: { id } });
    },
  },
  sessions: {
    async list(inst) {
      const rows = await prisma.session.findMany({ where: { institutionId: inst }, include: { account: { select: { email: true } } }, orderBy: { createdAt: "desc" }, take: 500 });
      const now = Date.now();
      return rows.map((r) => ({
        id: r.id,
        _account: r.account.email,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        _browser: /edg\//i.test(r.userAgent) ? "Edge" : /chrome/i.test(r.userAgent) ? "Chrome" : /firefox/i.test(r.userAgent) ? "Firefox" : /safari/i.test(r.userAgent) ? "Safari" : r.userAgent.split(/[\s/]/)[0] || "Unknown",
        deviceFingerprint: r.deviceFingerprint,
        geoLocation: r.geoLocation ?? "",
        createdAt: stampOf(r.createdAt),
        expiresAt: stampOf(r.expiresAt),
        _state: r.expiresAt.getTime() > now ? "Active" : "Expired",
        updatedAt: r.updatedAt.toISOString(),
      }));
    },
    async update() {
      throw httpError(405, "Sessions can only be revoked", "NOT_ALLOWED");
    },
  },
  auditLog: {
    async list(inst) {
      const [rows, accounts] = await Promise.all([prisma.auditEvent.findMany({ where: { institutionId: inst }, orderBy: { createdAt: "desc" }, take: 500 }), accountMap(inst)]);
      return rows.map((r) => ({ id: r.id, createdAt: stampOf(r.createdAt), eventName: r.eventName, _actor: accounts.get(r.actorId) ?? r.actorId, purpose: r.purpose, source: r.source, correlationId: r.correlationId, beforeJson: r.beforeJson ?? "", afterJson: r.afterJson ?? "", updatedAt: r.updatedAt.toISOString() }));
    },
    async update() {
      throw httpError(405, "The audit log is read-only", "NOT_ALLOWED");
    },
  },
  outbox: {
    async list(inst) {
      const rows = await prisma.eventOutbox.findMany({ where: { institutionId: inst }, orderBy: { createdAt: "desc" }, take: 500 });
      return rows.map((r) => ({ id: r.id, eventName: r.eventName, status: r.status, attempts: r.attempts, availableAt: stampOf(r.availableAt), createdAt: stampOf(r.createdAt), payloadJson: r.payloadJson, updatedAt: r.updatedAt.toISOString() }));
    },
    async update() {
      throw httpError(405, "Queued events can only be retried or discarded", "NOT_ALLOWED");
    },
  },
  notifications: {
    async list(inst, user) {
      const rows = await prisma.notification.findMany({ where: { institutionId: inst }, orderBy: { createdAt: "desc" }, take: 1000 });
      return rows.map((r) => ({
        id: r.id,
        audience: "One account",
        recipientAccountId: r.recipientAccountId,
        channel: r.channel,
        title: r.title,
        body: r.body,
        createdAt: stampOf(r.createdAt),
        _state: r.readAt ? "Read" : "Unread",
        _mine: user && r.recipientAccountId === user.accountId ? "Yes" : "No",
        updatedAt: r.updatedAt.toISOString(),
      }));
    },
    async create(inst, d) {
      const audience = s(d.audience);
      let ids: string[];
      if (audience === "One account") ids = [s(d.recipientAccountId)];
      else {
        const accounts = await prisma.account.findMany({ where: { institutionId: inst, status: "active" }, select: { id: true, rolesJson: true } });
        ids = accounts.filter((a) => (audience === "All students" ? rolesOf(a.rolesJson).includes("student") : audience === "All staff" ? STAFF_RE.test(a.rolesJson) : true)).map((a) => a.id);
      }
      if (!ids.length) throw httpError(400, `Nobody matches “${audience}”`);
      const base = { institutionId: inst, channel: s(d.channel), title: s(d.title), body: s(d.body) };
      const first = await prisma.notification.create({ data: { ...base, recipientAccountId: ids[0]! } });
      if (ids.length > 1) await prisma.notification.createMany({ data: ids.slice(1).map((recipientAccountId) => ({ ...base, recipientAccountId })) });
      return { id: first.id, message: ids.length > 1 ? `Notification sent to ${ids.length} accounts` : "Notification sent" };
    },
    async update() {
      throw httpError(405, "Sent notifications cannot be edited", "NOT_ALLOWED");
    },
    async remove(_inst, id) {
      await prisma.notification.delete({ where: { id } });
    },
  },
};

/* ------------------------------------------------------------------ */
/* Validation rules                                                     */
/* ------------------------------------------------------------------ */

const order = (a: unknown, b: unknown) => !s(a) || !s(b) || s(b) >= s(a);

async function uniqueAmong(inst: string, screen: string, id: string | null, same: (r: Row) => boolean) {
  return (await records(inst, screen)).find((r) => r.id !== id && same(r)) ?? null;
}

export const EXT_PREPARE: Partial<Record<EntityKey, (d: Data) => void>> = {
  privacyRequests(d) {
    if (!s(d.dueOn) && s(d.receivedOn)) d.dueOn = addDays(30, s(d.receivedOn));
  },
  knowledge(d) {
    d.slug = s(d.slug).trim().toLowerCase();
  },
};

export const EXT_RULES: Partial<Record<EntityKey, (d: Data, c: RuleCtx) => Promise<string[]>>> = {
  async applications(d, { inst, id, before }) {
    if (!APP_ADMITTED.includes(s(d.status)) || APP_ADMITTED.includes(s(before?.status))) return [];
    const intake = await intakeFor(inst, s(d.programName), s(d.intakeTerm));
    if (!intake) return [];
    if (intake.status !== "Open") return [`The ${s(d.programName)} intake for ${s(d.intakeTerm)} is ${s(intake.status).toLowerCase()}; admissions are not being offered`];
    const admitted = await prisma.admissionsApplication.count({ where: { institutionId: inst, programName: s(d.programName), intakeTerm: s(d.intakeTerm), status: { in: APP_ADMITTED }, ...(id ? { id: { not: id } } : {}) } });
    return admitted >= (n(intake.capacity) ?? 0) ? [`The ${s(d.programName)} intake for ${s(d.intakeTerm)} is full (${admitted} of ${s(intake.capacity)} seats admitted)`] : [];
  },
  async interviews(d) {
    return d.status === "Completed" && (n(d.score) === null || !s(d.recommendation)) ? ["A completed interview needs a Score and a Recommendation — edit the interview to add them"] : [];
  },
  async offers(d, { before }) {
    return d.status === "pending" && before?.status !== "pending" && s(d.expiresOn) && s(d.expiresOn) < today() ? ["Respond By is in the past; choose a later date before issuing"] : [];
  },
  async intakes(d, { inst, id }) {
    const dup = await uniqueAmong(inst, MORE_ENTITIES.intakes.screen, id, (r) => r.programName === d.programName && r.intakeTerm === d.intakeTerm);
    return dup ? [`An intake for ${s(d.programName)} in ${s(d.intakeTerm)} already exists`] : [];
  },
  async changeRequests(d) {
    return d.status === "Rejected" && !s(d.decisionNote) ? ["Rejecting a change request needs a Decision Note — edit the request to add one"] : [];
  },
  async retention(d, { inst, id }) {
    if (d.status !== "Active") return [];
    const dup = await uniqueAmong(inst, MORE_ENTITIES.retention.screen, id, (r) => r.status === "Active" && r.recordType === d.recordType);
    return dup ? [`There is already an active retention policy for “${s(d.recordType)}”`] : [];
  },
  async legalHolds(d) {
    return order(d.placedOn, d.releasedOn) ? [] : ["Released On must be on or after Placed On"];
  },
  async privacyRequests(d, { inst }) {
    const out: string[] = [];
    if (!order(d.receivedOn, d.dueOn)) out.push("Due must be on or after Received");
    if (d.status === "Refused" && !s(d.response)) out.push("Refusing a request needs a written Response — edit the request to add one");
    if (d.status === "Fulfilled" && d.type === "Deletion") {
      const hold = await activeHold(inst, s(d.studentId));
      if (hold) out.push(`This student is under the legal hold “${s(hold.matter)}”; deletion cannot be fulfilled`);
    }
    return out;
  },
  async evidence(d) {
    return ["In Review", "Accepted"].includes(s(d.status)) && !s(d.url) ? ["Add a Document Link before submitting this evidence"] : [];
  },
  async disposals(d, { inst }) {
    if (!["Approved", "Disposed"].includes(s(d.status))) return [];
    const out: string[] = [];
    const hold = await activeHold(inst, s(d.studentId));
    if (hold) out.push(`This student is under the legal hold “${s(hold.matter)}”`);
    if (s(d.eligibleOn) > today()) out.push(`These records are not eligible for disposal until ${s(d.eligibleOn)}`);
    return out;
  },
  async submissions(d, { inst }) {
    const form = (await records(inst, "SYS:FORM")).find((r) => r.id === d.formId);
    const fields = Array.isArray(form?.fields) ? (form!.fields as Data[]) : [];
    const answers = s(d.answers).toLowerCase();
    const missing = fields.filter((x) => s(x.required) === "Yes" && !answers.includes(`${s(x.label).toLowerCase()}:`)).map((x) => s(x.label));
    return missing.length ? [`Answers are missing required form fields: ${missing.join(", ")} (write them as “Field: answer”)`] : [];
  },
  async ruleSets(d) {
    const out: string[] = [];
    if (NUMERIC_FACTS.includes(s(d.fact)) && !Number.isFinite(Number(s(d.value).trim()))) out.push(`Value must be a number for “${s(d.fact)}”`);
    if (!NUMERIC_FACTS.includes(s(d.fact)) && ["is greater than", "is less than"].includes(s(d.operator))) out.push(`“${s(d.operator)}” only works with counts and hours`);
    if (d.outcome === "Open success case" && !s(d.caseLevel)) out.push("Choose the Case Level for cases this rule opens");
    return out;
  },
  async workflowDefs(d, { inst, id }) {
    if (d.status !== "Active") return [];
    const dup = await uniqueAmong(inst, MORE_ENTITIES.workflowDefs.screen, id, (r) => r.status === "Active" && r.requestType === d.requestType);
    return dup ? [`“${s(dup.name)}” is already the active workflow for ${s(d.requestType)}`] : [];
  },
  async knowledge(d, { inst, id }) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(s(d.slug))) return ["Key may only contain lowercase letters, numbers and dashes"];
    const dup = await prisma.knowledgeDocument.findFirst({ where: { institutionId: inst, slug: s(d.slug), ...(id ? { id: { not: id } } : {}) } });
    return dup ? [`Key “${s(d.slug)}” is already used by “${dup.title}”`] : [];
  },
  async notifications(d) {
    return d.audience === "One account" && !s(d.recipientAccountId) ? ["Choose the Recipient"] : [];
  },
  async helpdesk(d) {
    return ["Resolved", "Closed"].includes(s(d.status)) && !s(d.resolution) ? ["Add a Resolution before resolving the ticket — edit the ticket to add one"] : [];
  },
};

/* ------------------------------------------------------------------ */
/* Computed columns                                                     */
/* ------------------------------------------------------------------ */

export const EXT_DECORATE: Partial<Record<EntityKey, (rows: Row[], inst: string) => Promise<void>>> = {
  async intakes(rows, inst) {
    const apps = await prisma.admissionsApplication.findMany({ where: { institutionId: inst }, select: { programName: true, intakeTerm: true, status: true } });
    for (const r of rows) {
      const mine = apps.filter((a) => a.programName === r.programName && a.intakeTerm === r.intakeTerm);
      const admitted = mine.filter((a) => APP_ADMITTED.includes(a.status)).length;
      r._applied = mine.filter((a) => !LEADS.includes(a.status) && a.status !== "withdrawn").length;
      r._admitted = admitted;
      r._remaining = Math.max(0, (n(r.capacity) ?? 0) - admitted);
    }
  },
  async retention(rows, inst) {
    const disposals = await records(inst, MORE_ENTITIES.disposals.screen);
    for (const r of rows) r._disposals = disposals.filter((x) => x.policyId === r.id).length;
  },
  async privacyRequests(rows) {
    const t = today();
    for (const r of rows) {
      if (!["Received", "In Progress"].includes(s(r.status)) || !s(r.dueOn)) r._due = "—";
      else if (s(r.dueOn) < t) r._due = "Overdue";
      else r._due = `${Math.round((Date.parse(s(r.dueOn)) - Date.parse(t)) / 86_400_000)} days left`;
    }
  },
  async disposals(rows, inst) {
    const holds = (await records(inst, MORE_ENTITIES.legalHolds.screen)).filter((h) => h.status === "Active");
    for (const r of rows) r._hold = holds.some((h) => h.studentId === r.studentId) ? "Active hold" : "None";
  },
  async ruleSets(rows, inst) {
    const [facts, runs] = await Promise.all([
      studentFacts(inst),
      prisma.heritageAuditEntry.findMany({ where: { institutionId: inst, screenId: MORE_ENTITIES.ruleSets.screen, action: "action:run" }, orderBy: { createdAt: "desc" }, take: 500 }),
    ]);
    for (const r of rows) {
      const hit = facts.filter((x) => matches(r, x));
      r._condition = `${s(r.fact)} ${s(r.operator)} ${s(r.value)}`;
      r._matches = hit.length;
      r._sample = lines(hit.slice(0, 10).map((x) => `${x.label} — ${s(r.fact)}: ${x.values[s(r.fact)]}`)) || "No students match right now";
      const last = runs.find((x) => x.recordId === r.id);
      r._lastRun = last ? `${stampOf(last.createdAt).replace("T", " ")} by ${last.actorName}${last.note ? ` — ${last.note}` : ""}` : "Never";
    }
  },
  async workflowDefs(rows, inst) {
    const reqs = await prisma.approvalRequest.findMany({ where: { institutionId: inst }, select: { type: true, status: true, createdAt: true, decisionsJson: true } });
    const now = Date.now();
    for (const r of rows) {
      const mine = reqs.filter((x) => x.type === r.requestType);
      const sla = (n(r.slaHours) ?? 48) * 3_600_000;
      const decided = mine
        .map((x) => {
          try {
            const first = (JSON.parse(x.decisionsJson) as Array<{ decidedAt: string }>)[0];
            return first ? Date.parse(first.decidedAt) - x.createdAt.getTime() : null;
          } catch {
            return null;
          }
        })
        .filter((x): x is number => x !== null && x >= 0);
      r._pending = mine.filter((x) => x.status === "pending").length;
      r._breaches = mine.filter((x) => x.status === "pending" && now - x.createdAt.getTime() > sla).length;
      r._avg = decided.length ? `${(decided.reduce((t, x) => t + x, 0) / decided.length / 3_600_000).toFixed(1)} h` : "—";
    }
  },
  async helpdesk(rows) {
    for (const r of rows) r._age = ["Resolved", "Closed"].includes(s(r.status)) ? "—" : age(s(r._createdAt));
  },
};

/* ------------------------------------------------------------------ */
/* Side effects after a save                                            */
/* ------------------------------------------------------------------ */

export const AFTER: Partial<Record<EntityKey, (ctx: Ctx, c: Change) => Promise<void>>> = {
  async placements(ctx, c) {
    if (!c.before || (!changed(c, "status") && !changed(c, "supervisorPersonId") && !changed(c, "siteId"))) return;
    const [studentAccountId, supervisorAccountId] = await Promise.all([
      accountOfStudent(ctx.inst, s(c.data.studentId)),
      accountOfPerson(ctx.inst, s(c.data.supervisorPersonId)),
    ]);
    const body = `${s(c.data.programName)} placement is now ${s(c.data.status)}.`;
    if (studentAccountId) await notify(ctx.inst, studentAccountId, "Practicum placement updated", body);
    if (supervisorAccountId) await notify(ctx.inst, supervisorAccountId, "Practicum assignment updated", body);
  },
  async logs(ctx, c) {
    if (!c.before || !changed(c, "status")) return;
    const placement = await prisma.placement.findFirst({ where: { id: s(c.data.placementId), institutionId: ctx.inst } });
    if (!placement?.studentId) return;
    const accountId = await accountOfStudent(ctx.inst, placement.studentId);
    if (accountId) await notify(ctx.inst, accountId, `Practicum hours ${s(c.data.status)}`, `${s(c.data.weekLabel)} · ${s(c.data.hours)} hours`);
  },
  async evaluations(ctx, c) {
    if (!c.before || !changed(c, "status")) return;
    const placement = await prisma.placement.findFirst({ where: { id: s(c.data.placementId), institutionId: ctx.inst } });
    if (!placement?.studentId) return;
    const accountId = await accountOfStudent(ctx.inst, placement.studentId);
    if (accountId) await notify(ctx.inst, accountId, "Practicum evaluation updated", `Evaluation is ${s(c.data.status)}${c.data.score ? ` · ${s(c.data.score)}/5` : ""}.`);
  },
  async practicumIncidents(ctx, c) {
    if (c.before && !changed(c, "status") && !changed(c, "actionTaken")) return;
    const placement = await prisma.placement.findFirst({ where: { id: s(c.data.placementId), institutionId: ctx.inst } });
    if (!placement?.studentId) return;
    const accountId = await accountOfStudent(ctx.inst, placement.studentId);
    if (accountId) await notify(ctx.inst, accountId, "Practicum incident update", `${s(c.data.category)} · ${s(c.data.severity)} · ${s(c.data.status)}`);
  },
  async eligibility(ctx, c) {
    if (c.before && !changed(c, "status") && !changed(c, "expiresOn")) return;
    const accountId = await accountOfStudent(ctx.inst, s(c.data.studentId));
    if (!accountId) return;
    const expiry = s(c.data.expiresOn) ? ` Expires ${s(c.data.expiresOn)}.` : "";
    await notify(ctx.inst, accountId, "Lab eligibility updated", `Your lab eligibility is ${s(c.data.status)}.${expiry}`);
  },
  async labSessions(ctx, c) {
    const session = await syncLabSession(ctx.inst, c.id, c.data, ctx.user.accountId);
    if (!session) return;
    if (!c.before) {
      const enrolments = await prisma.enrolment.findMany({
        where: { institutionId: ctx.inst, sectionId: s(c.data.sectionId), status: "enrolled" },
        include: { student: { include: { person: { include: { accounts: { where: { status: "active" }, select: { id: true } } } } } } },
      });
      const recipients = [...new Set(enrolments.flatMap((row) => row.student.person.accounts.map((account) => account.id)))];
      if (recipients.length) await prisma.notification.createMany({
        data: recipients.map((recipientAccountId) => ({
          institutionId: ctx.inst,
          recipientAccountId,
          channel: "in_app",
          title: "Lab session scheduled",
          body: `${s(c.data.title)} is scheduled for ${s(c.data.date)} at ${s(c.data.startTime)}.`,
          templateKey: "lab.session.scheduled",
          dedupeKey: `lab-session:${c.id}:scheduled:${recipientAccountId}`,
        })),
        skipDuplicates: true,
      });
    }
  },
  async changeRequests(ctx, c) {
    if (!c.before || !changed(c, "status")) return;
    const requesterAccountId = await accountOfPerson(ctx.inst, s(c.data.requestedBy));
    if (!requesterAccountId) return;
    const status = s(c.data.status);
    const note = s(c.data.decisionNote);
    await notify(
      ctx.inst,
      requesterAccountId,
      `Program change request ${status.toLowerCase()}`,
      `“${s(c.data.title)}” is now ${status}.${note ? ` Decision note: ${note}` : ""}`,
    );
  },
  async legalHolds(ctx, c) {
    if (c.before && !["status", "scope", "reason", "custodianId"].some((key) => changed(c, key))) return;
    const [studentAccountId, custodianAccountId] = await Promise.all([
      accountOfStudent(ctx.inst, s(c.data.studentId)),
      accountOfPerson(ctx.inst, s(c.data.custodianId)),
    ]);
    const status = s(c.data.status) || "Active";
    await notify(
      ctx.inst,
      studentAccountId,
      c.before ? "Legal hold updated" : "Legal hold placed",
      `“${s(c.data.matter)}” is ${status.toLowerCase()} and covers ${s(c.data.scope) || "your student records"}.`,
    );
    await notify(
      ctx.inst,
      custodianAccountId,
      c.before ? "Legal hold assignment updated" : "Legal hold assigned",
      `“${s(c.data.matter)}” is ${status.toLowerCase()}. Open My Assigned Work → Compliance Assignments.`,
    );
  },
  async privacyRequests(ctx, c) {
    if (c.before && !["status", "dueOn", "response", "handlerId"].some((key) => changed(c, key))) return;
    const [studentAccountId, handlerAccountId] = await Promise.all([
      accountOfStudent(ctx.inst, s(c.data.studentId)),
      accountOfPerson(ctx.inst, s(c.data.handlerId)),
    ]);
    const status = s(c.data.status) || "Received";
    await notify(
      ctx.inst,
      studentAccountId,
      `Privacy request ${status.toLowerCase()}`,
      `Your ${s(c.data.type).toLowerCase()} request is ${status.toLowerCase()}${s(c.data.dueOn) ? ` · due ${s(c.data.dueOn)}` : ""}.`,
    );
    await notify(
      ctx.inst,
      handlerAccountId,
      c.before ? "Privacy request assignment updated" : "Privacy request assigned",
      `${s(c.data.type)} request · ${status}. Open My Assigned Work → Compliance Assignments.`,
    );
  },
  async evidence(ctx, c) {
    if (c.before && !["status", "dueOn", "url", "ownerId"].some((key) => changed(c, key))) return;
    const ownerAccountId = await accountOfPerson(ctx.inst, s(c.data.ownerId));
    await notify(
      ctx.inst,
      ownerAccountId,
      c.before ? "Accreditation evidence updated" : "Accreditation evidence assigned",
      `“${s(c.data.title)}” · ${s(c.data.status) || "Needed"}${s(c.data.dueOn) ? ` · due ${s(c.data.dueOn)}` : ""}. Open My Assigned Work → Compliance Assignments.`,
    );
  },
  async recordVault(ctx, c) {
    if (c.before && !["status", "recordName", "downloadUrl", "studentId"].some((key) => changed(c, key))) return;
    const studentAccountId = await accountOfStudent(ctx.inst, s(c.data.studentId));
    await notify(
      ctx.inst,
      studentAccountId,
      c.before ? "Student record updated" : "Student record added",
      `“${s(c.data.recordName)}” is ${s(c.data.status) || "available"}. Open My Records → My Documents.`,
    );
  },
  async disposals(ctx, c) {
    if (c.before && !["status", "eligibleOn", "records", "studentId"].some((key) => changed(c, key))) return;
    const studentAccountId = await accountOfStudent(ctx.inst, s(c.data.studentId));
    await notify(
      ctx.inst,
      studentAccountId,
      c.before ? "Record disposal review updated" : "Record disposal review created",
      `${s(c.data.records)} · ${s(c.data.status) || "Proposed"}. Open My Records → Privacy & Record Status.`,
    );
  },
  async applications(ctx, c) {
    if (!c.before || !changed(c, "status")) return;
    await timeline(ctx.inst, c.id, `Stage changed to ${pretty(c.data.status)}`, `Updated by Admissions`);
    const text = STAGE_TEXT[s(c.data.status)];
    if (text) await notify(ctx.inst, s(c.before.accountId), "Application update", text);
  },
  async appDocuments(ctx, c) {
    if (c.before && !changed(c, "status")) return;
    const app = await prisma.admissionsApplication.findFirst({ where: { id: s(c.data.applicationId), institutionId: ctx.inst } });
    if (!app) return;
    const st = s(c.data.status);
    const title = !c.before ? `Document requested: ${s(c.data.label)}` : `${s(c.data.label)} ${st === "missing" ? "requested again" : st}`;
    await timeline(ctx.inst, app.id, title);
    if (!c.before || st === "rejected" || st === "missing") await notify(ctx.inst, app.accountId, "Document needed", `Please upload: ${s(c.data.label)}.`);
  },
  async interviews(ctx, c) {
    const appId = s(c.data.applicationId);
    const when = s(c.data.scheduledAt).replace("T", " ");
    if ((!c.before || changed(c, "status")) && c.data.status === "Scheduled") {
      const app = await prisma.admissionsApplication.findFirst({ where: { id: appId, institutionId: ctx.inst } });
      if (app && APP_EARLY.includes(app.status)) await setStage(ctx.inst, app.id, "interview", "Interview scheduled", `${when} · ${s(c.data.mode)}`);
      else if (app) {
        await timeline(ctx.inst, app.id, "Interview scheduled", `${when} · ${s(c.data.mode)}`);
        await notify(ctx.inst, app.accountId, "Interview scheduled", `Your admissions interview is on ${when} (${s(c.data.mode)}).`);
      }
      return;
    }
    if (c.before && changed(c, "status")) await timeline(ctx.inst, appId, `Interview ${s(c.data.status).toLowerCase()}`, c.data.status === "Completed" ? `Score ${s(c.data.score)}/5 · Recommendation: ${s(c.data.recommendation)}` : when);
  },
  async offers(ctx, c) {
    if (c.before && !changed(c, "status")) return;
    const appId = s(c.data.applicationId);
    const title = s(c.data.title);
    switch (c.data.status) {
      case "pending":
        await setStage(ctx.inst, appId, /CLOA/.test(title) ? "cloa" : "offered", `${title} issued`, s(c.data.expiresOn) ? `Respond by ${s(c.data.expiresOn)}` : undefined);
        break;
      case "accepted":
        await setStage(ctx.inst, appId, "accepted", `${title} accepted`, "Recorded by Admissions");
        break;
      case "declined":
        await setStage(ctx.inst, appId, "declined", `${title} declined`, "Recorded by Admissions");
        break;
      case "withdrawn":
        if (c.before?.status === "pending") await setStage(ctx.inst, appId, "approved_application", `${title} withdrawn`);
        break;
    }
  },
  async submissions(ctx, c) {
    if (!c.before || !changed(c, "status") || !["Approved", "Rejected"].includes(s(c.data.status))) return;
    const forms = await ctx.labels("forms");
    await notify(ctx.inst, await accountOfStudent(ctx.inst, s(c.data.studentId)), `Form ${s(c.data.status).toLowerCase()}`, `Your “${forms.get(s(c.data.formId)) ?? "form"}” submission was ${s(c.data.status).toLowerCase()}.${s(c.data.reviewNote) ? ` Note: ${s(c.data.reviewNote)}` : ""}`);
  },
  async helpdesk(ctx, c) {
    if (c.data.status !== "Resolved" || c.before?.status === "Resolved") return;
    await notify(ctx.inst, s(c.data.requesterId), "Help desk ticket resolved", `“${s(c.data.subject)}”: ${s(c.data.resolution)}`);
  },
};

/* ------------------------------------------------------------------ */
/* Server-side actions                                                  */
/* ------------------------------------------------------------------ */

export const RUN: Partial<Record<EntityKey, Record<string, (ctx: Ctx, row: Row) => Promise<string>>>> = {
  applications: {
    async convert(ctx, row) {
      const app = await prisma.admissionsApplication.findFirst({ where: { id: row.id, institutionId: ctx.inst } });
      if (!app) throw httpError(404, "Application not found", "NOT_FOUND");
      if (!APP_ADMITTED.includes(app.status)) throw httpError(409, "Only an accepted application or issued acceptance letter can be converted", "CONFLICT");
      const existing = await prisma.student.findFirst({ where: { institutionId: ctx.inst, personId: app.personId, programName: app.programName } });
      if (existing) throw httpError(409, `Already a student: ${existing.studentNumber}`, "CONFLICT");
      const [program, term, heritagePrograms] = await Promise.all([
        prisma.program.findFirst({
          where: { institutionId: ctx.inst, name: app.programName },
          include: { versions: { where: { status: "active" }, include: { requirements: { orderBy: { sortOrder: "asc" } } }, orderBy: { effectiveOn: "desc" }, take: 1 } },
        }),
        prisma.term.findFirst({ where: { institutionId: ctx.inst, name: app.intakeTerm } }),
        records(ctx.inst, "PM:PROGRAM"),
      ]);
      const version = program?.versions[0] ?? null;
      const requirements = version?.requirements ?? [];
      if (!program || !version) throw httpError(409, `Configure an active programme version for ${app.programName} before conversion`, "CONFLICT");
      if (!term) throw httpError(409, `Configure the intake term ${app.intakeTerm} before conversion`, "CONFLICT");
      if (!requirements.length) throw httpError(409, `Add degree requirements to ${version.label} before conversion`, "CONFLICT");
      const sections = term && requirements.length
        ? await prisma.section.findMany({ where: { institutionId: ctx.inst, termId: term.id, courseId: { in: requirements.map((r) => r.courseId).filter((id): id is string => Boolean(id)) } } })
        : [];
      const sectionByCourse = new Map<string, (typeof sections)[number]>();
      for (const section of sections) if (!sectionByCourse.has(section.courseId)) sectionByCourse.set(section.courseId, section);
      const heritageProgram = heritagePrograms.find((candidate) => s(candidate.name) === app.programName);
      const feeRows = heritageProgram
        ? await prisma.heritageRecord.findMany({ where: { institutionId: ctx.inst, screenId: "PM:FEE", contextKey: heritageProgram.id, deletedAt: null } })
        : [];
      let residency = "";
      try { residency = s(JSON.parse(app.formJson || "{}").residency).toLowerCase(); } catch { residency = ""; }
      const international = /international|study permit|visa/.test(residency);
      const fees = feeRows.map((fee) => parse(fee.dataJson)).map((fee) => ({ label: s(fee.ledgerType) || "Program fee", amount: n(international ? fee.international : fee.domestic) ?? 0 })).filter((fee) => fee.amount > 0);
      if (!sectionByCourse.size) throw httpError(409, `No ${app.intakeTerm} sections match the programme requirements`, "CONFLICT");
      if (!fees.length) throw httpError(409, `Configure a ${international ? "international" : "domestic"} programme fee before conversion`, "CONFLICT");
      const account = await prisma.account.findUnique({ where: { id: app.accountId } });
      let studentNumber = "";
      for (let attempt = 0; attempt < 5; attempt += 1) {
        studentNumber = await nextStudentNumber(ctx.inst, attempt);
        try {
          await prisma.$transaction(async (tx) => {
            const claimed = await tx.admissionsApplication.updateMany({
              where: { id: app.id, institutionId: ctx.inst, status: { in: [...APP_ADMITTED] } },
              data: { status: "converting", ...bump },
            });
            if (claimed.count !== 1) throw httpError(409, "Application is already being converted or its status changed", "CONFLICT");
            const student = await tx.student.create({ data: { institutionId: ctx.inst, personId: app.personId, studentNumber, programName: app.programName, programVersionId: version?.id ?? null, standing: "good" } });
            if (account && !rolesOf(account.rolesJson).includes("student")) await tx.account.update({ where: { id: account.id }, data: { rolesJson: JSON.stringify([...rolesOf(account.rolesJson), "student"]), ...bump } });
            await tx.programPlan.create({
              data: {
                institutionId: ctx.inst,
                studentId: student.id,
                status: "active",
                items: { create: requirements.map((requirement) => ({ institutionId: ctx.inst, courseId: requirement.courseId, courseCode: requirement.courseCode, title: requirement.title, credits: requirement.credits, sortOrder: requirement.sortOrder, category: "main", status: "not_started", sectionId: requirement.courseId ? sectionByCourse.get(requirement.courseId)?.id ?? null : null })) },
              },
            });
            for (const section of sectionByCourse.values()) await tx.enrolment.create({ data: { institutionId: ctx.inst, sectionId: section.id, studentId: student.id, status: "enrolled" } });
            for (const fee of fees) await tx.financeLedgerEntry.create({ data: { institutionId: ctx.inst, studentId: student.id, label: fee.label, amountCad: fee.amount, kind: "charge", status: "open", source: "admissions_conversion", note: `${app.programName} · ${app.intakeTerm}` } });
            await tx.admissionsApplication.update({ where: { id: app.id }, data: { status: "enrolled", progressPct: 100, submittedAt: app.submittedAt ?? new Date(), ...bump } });
            await tx.applicationTimelineEvent.create({ data: { institutionId: ctx.inst, applicationId: app.id, title: `Converted to student ${studentNumber}`, detail: `${app.programName} · ${app.intakeTerm}` } });
            await tx.notification.create({ data: { institutionId: ctx.inst, recipientAccountId: app.accountId, channel: "in_app", title: "Application update", body: STAGE_TEXT.enrolled } });
          });
          break;
        } catch (error) {
          const collision = typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
          if (!collision || attempt === 4) throw error;
        }
      }
      return `Student ${studentNumber} created for ${s(row._name)}`;
    },
  },
  ruleSets: {
    async run(ctx, row) {
      const hit = (await studentFacts(ctx.inst)).filter((x) => matches(row, x));
      if (row.outcome !== "Open success case") return `${hit.length} student${hit.length === 1 ? "" : "s"} match “${s(row.name)}”`;
      const open = new Set((await prisma.successCase.findMany({ where: { institutionId: ctx.inst, status: { notIn: ["resolved", "closed"] } }, select: { studentId: true } })).map((c) => c.studentId));
      const fresh = hit.filter((x) => !open.has(x.id));
      for (const x of fresh) {
        await prisma.successCase.create({ data: { institutionId: ctx.inst, studentId: x.id, level: s(row.caseLevel) || "warning", summary: `Opened by rule “${s(row.name)}”: ${s(row._condition)}`, signalsJson: JSON.stringify([`Rule: ${s(row.name)}`]), status: "open" } });
      }
      return `${fresh.length} success case${fresh.length === 1 ? "" : "s"} opened; ${hit.length - fresh.length} matching student${hit.length - fresh.length === 1 ? " already has" : "s already have"} an open case`;
    },
  },
  approvals: {
    async approve(ctx, row) {
      const updated = await decideApproval({ approvalId: row.id, institutionId: ctx.inst, actorId: ctx.user.accountId, actorRoles: ctx.user.roles as RoleName[], decision: "approve", comment: "Approved from Workflows" });
      if (updated.status !== "approved") return `Approval recorded (${updated.status}); more approvals are required`;
      await applyApprovedRequest(ctx.inst, row.id, ctx.user.accountId);
      return "Approved and applied";
    },
    async reject(ctx, row) {
      await decideApproval({ approvalId: row.id, institutionId: ctx.inst, actorId: ctx.user.accountId, actorRoles: ctx.user.roles as RoleName[], decision: "reject", comment: "Rejected from Workflows" });
      await settleRejectedApproval(ctx.inst, row.id, "Rejected from Workflows");
      return "Request rejected";
    },
    async apply(ctx, row) {
      await applyApprovedRequest(ctx.inst, row.id, ctx.user.accountId);
      return "Change applied";
    },
  },
  sessions: {
    async revoke(ctx, row) {
      if (row.id === ctx.user.sessionId) throw httpError(409, "This is your current session — use Log Out instead", "CONFLICT");
      await prisma.session.update({ where: { id: row.id }, data: { expiresAt: new Date(Date.now() - 1000), ...bump } });
      forgetSessionRevocation(row.id);
      return `Session for ${s(row._account)} revoked`;
    },
  },
  outbox: {
    async requeue(ctx, row) {
      await prisma.eventOutbox.updateMany({ where: { id: row.id, institutionId: ctx.inst }, data: { status: "pending", attempts: 0, availableAt: new Date(), ...bump } });
      return `${s(row.eventName)} queued for immediate delivery`;
    },
    async discard(ctx, row) {
      await prisma.eventOutbox.updateMany({ where: { id: row.id, institutionId: ctx.inst }, data: { status: "discarded", ...bump } });
      return `${s(row.eventName)} discarded`;
    },
  },
  notifications: {
    async read(ctx, row) {
      await prisma.notification.updateMany({ where: { id: row.id, institutionId: ctx.inst }, data: { readAt: new Date(), ...bump } });
      return "Marked as read";
    },
    async unread(ctx, row) {
      await prisma.notification.updateMany({ where: { id: row.id, institutionId: ctx.inst }, data: { readAt: null, ...bump } });
      return "Marked as unread";
    },
  },
};

/* ------------------------------------------------------------------ */
/* Dashboards                                                           */
/* ------------------------------------------------------------------ */

const bars = (labels: string[], count: (l: string) => number) => labels.map((label) => ({ label, value: count(label) }));
const groupBars = (values: string[], top = 8) => {
  const m = new Map<string, number>();
  for (const v of values) m.set(v || "—", (m.get(v || "—") ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]).slice(0, top).map(([label, value]) => ({ label, value }));
};

export const DASH: Partial<Record<ModuleKey, (ctx: Ctx) => Promise<{ kpis: Kpi[]; panels: Panel[] }>>> = {
  async admissions(ctx) {
    const [apps, docs, interviews, offers, intakes] = await Promise.all((["applications", "appDocuments", "interviews", "offers", "intakes"] as EntityKey[]).map((k) => ctx.rows(k)));
    const appLabel = await ctx.labels("applications");
    const staff = await ctx.labels("staff");
    const now = new Date().toISOString().slice(0, 16);
    const week = `${addDays(7)}T23:59`;
    const upcoming = interviews.filter((x) => x.status === "Scheduled" && s(x.scheduledAt) >= now && s(x.scheduledAt) <= week).sort((a, b) => s(a.scheduledAt).localeCompare(s(b.scheduledAt)));
    const waiting = offers.filter((o) => o.status === "pending");
    const expiring = waiting.filter((o) => s(o.expiresOn) && s(o.expiresOn) <= addDays(14)).sort((a, b) => s(a.expiresOn).localeCompare(s(b.expiresOn)));
    const toConvert = apps.filter((a) => ["accepted", "cloa"].includes(s(a.status)) && !a._converted);
    const toReview = docs.filter((d) => d.status === "uploaded");
    return {
      kpis: [
        { label: "Applications", value: apps.length, hint: `${apps.filter((a) => LEADS.includes(s(a.status))).length} leads / drafts`, slug: "applications" },
        { label: "In review", value: apps.filter((a) => ["submitted", "under_review"].includes(s(a.status))).length, slug: "applications" },
        { label: "Documents to review", value: toReview.length, tone: toReview.length ? "warn" : "ok", slug: "documents" },
        { label: "Interviews next 7 days", value: upcoming.length, slug: "interviews" },
        { label: "Offers awaiting reply", value: waiting.length, hint: `${expiring.length} due ≤ 14 days`, tone: expiring.length ? "warn" : undefined, slug: "offers" },
        { label: "Accepted, not yet students", value: toConvert.length, tone: toConvert.length ? "warn" : "ok", hint: "Use “Convert to Student”", slug: "applications" },
      ],
      panels: [
        { title: "Pipeline", slug: "applications", kind: "bars", bars: bars(["submitted", "under_review", "interview", "waitlisted", "approved_application", "offered", "cloa", "accepted", "enrolled", "declined"], (st) => apps.filter((a) => a.status === st).length) },
        { title: "Upcoming interviews", slug: "interviews", kind: "table", columns: ["When", "Applicant", "Interviewer"], rows: take(upcoming).map((x) => [s(x.scheduledAt).replace("T", " "), appLabel.get(s(x.applicationId)) ?? "—", staff.get(s(x.interviewerId)) ?? "—"]), empty: "No interviews in the next 7 days." },
        { title: "Intake capacity", slug: "intakes", kind: "table", columns: ["Program", "Intake", "Admitted / Seats", "Status"], rows: take(intakes, 8).map((x) => [s(x.programName), s(x.intakeTerm), `${s(x._admitted)} / ${s(x.capacity)}`, s(x.status)]), empty: "No intakes configured yet." },
        { title: "Offers due for a reply", slug: "offers", kind: "table", columns: ["Applicant", "Letter", "Respond By"], rows: take(expiring).map((o) => [appLabel.get(s(o.applicationId)) ?? "—", s(o.title), s(o.expiresOn)]), empty: "No offers due in the next 14 days." },
      ],
    };
  },
  async compliance(ctx) {
    const [cases, holds, privacy, evidence, disposals, students] = await Promise.all([
      ctx.rows("complianceCases"),
      ctx.rows("legalHolds"),
      ctx.rows("privacyRequests"),
      ctx.rows("evidence"),
      ctx.rows("disposals"),
      prisma.student.findMany({ where: { institutionId: ctx.inst }, include: { person: true } }),
    ]);
    const st = await ctx.labels("students");
    const gaps = students.map((x) => ({
      label: `${personName(x.person)} (${x.studentNumber})`,
      missing: [!x.person.phone && "phone", !x.person.dateOfBirth && "date of birth", !x.person.emergencyContactName && "emergency contact"].filter(Boolean) as string[],
    }));
    const complete = gaps.filter((g) => !g.missing.length).length;
    const overdue = privacy.filter((p) => p._due === "Overdue");
    const openPrivacy = privacy.filter((p) => ["Received", "In Progress"].includes(s(p.status))).sort((a, b) => s(a.dueOn).localeCompare(s(b.dueOn)));
    return {
      kpis: [
        { label: "Open compliance cases", value: cases.filter((c) => c.status === "open").length, tone: cases.some((c) => c.status === "open" && c.severity === "critical") ? "danger" : undefined, slug: "cases" },
        { label: "Active legal holds", value: holds.filter((h) => h.status === "Active").length, slug: "legal-holds" },
        { label: "Privacy requests overdue", value: overdue.length, tone: overdue.length ? "danger" : "ok", hint: `${openPrivacy.length} open`, slug: "privacy-requests" },
        { label: "Evidence outstanding", value: evidence.filter((e) => e.status !== "Accepted").length, slug: "evidence" },
        { label: "Disposals awaiting approval", value: disposals.filter((d) => d.status === "Proposed").length, slug: "disposal-review" },
        { label: "Complete student profiles", value: pct(complete, students.length), hint: `${complete} of ${students.length}` },
      ],
      panels: [
        { title: "Record completeness", kind: "bars", bars: bars(["phone", "date of birth", "emergency contact"], (k) => gaps.filter((g) => g.missing.includes(k)).length).map((b) => ({ ...b, label: `Missing ${b.label}` })) },
        { title: "Students with incomplete profiles", kind: "table", columns: ["Student", "Missing"], rows: take(gaps.filter((g) => g.missing.length), 8).map((g) => [g.label, g.missing.join(", ")]), empty: "Every student profile is complete." },
        { title: "Privacy requests by due date", slug: "privacy-requests", kind: "table", columns: ["Requester", "Request", "Due", "Deadline"], rows: take(openPrivacy).map((p) => [st.get(s(p.studentId)) ?? "—", s(p.type), s(p.dueOn), s(p._due)]), empty: "No open privacy requests." },
        { title: "Evidence by status", slug: "evidence", kind: "bars", bars: bars(["Needed", "In Review", "Accepted"], (k) => evidence.filter((e) => e.status === k).length) },
      ],
    };
  },
  async workflows(ctx) {
    const [reqs, defs] = await Promise.all([ctx.rows("approvals"), ctx.rows("workflowDefs")]);
    const raw = await prisma.approvalRequest.findMany({ where: { institutionId: ctx.inst, status: "pending" }, select: { id: true, type: true, createdAt: true } });
    const slaOf = (type: string) => (n(defs.find((d) => d.status === "Active" && d.requestType === type)?.slaHours) ?? 48) * 3_600_000;
    const breaches = raw.filter((r) => Date.now() - r.createdAt.getTime() > slaOf(r.type));
    const pending = reqs.filter((r) => r.status === "pending").sort((a, b) => s(a.createdAt).localeCompare(s(b.createdAt)));
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const decided = await prisma.approvalRequest.count({ where: { institutionId: ctx.inst, status: { in: ["approved", "applied", "rejected"] }, updatedAt: { gte: weekAgo } } });
    return {
      kpis: [
        { label: "Pending requests", value: pending.length, slug: "requests" },
        { label: "Over SLA", value: breaches.length, tone: breaches.length ? "danger" : "ok", hint: "Per workflow SLA (48 h default)", slug: "requests" },
        { label: "Approved, not applied", value: reqs.filter((r) => r.status === "approved").length, slug: "requests" },
        { label: "Decided in 7 days", value: decided },
        { label: "Active workflows", value: defs.filter((d) => d.status === "Active").length, slug: "definitions" },
      ],
      panels: [
        { title: "Pending by type", slug: "requests", kind: "bars", bars: groupBars(pending.map((r) => s(r.type))) },
        { title: "Oldest pending requests", slug: "requests", kind: "table", columns: ["Requested", "Type", "Subject", "Age"], rows: take(pending, 8).map((r) => [s(r.createdAt).replace("T", " "), s(r.type), s(r._subject), s(r._age)]), empty: "Nothing is waiting for a decision." },
        { title: "All requests by status", slug: "requests", kind: "bars", bars: groupBars(reqs.map((r) => s(r.status))) },
      ],
    };
  },
  async ai(ctx) {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [rows, docs] = await Promise.all([prisma.aiInteraction.findMany({ where: { institutionId: ctx.inst, createdAt: { gte: since } }, orderBy: { createdAt: "desc" } }), prisma.knowledgeDocument.findMany({ where: { institutionId: ctx.inst }, select: { status: true } })]);
    const uncited = rows.filter((r) => {
      try {
        const v = JSON.parse(r.sourcesJson);
        return !Array.isArray(v) || !v.length;
      } catch {
        return true;
      }
    });
    const tokens = rows.reduce((t, r) => t + r.estimatedTokens, 0);
    const failed = rows.filter((r) => r.resultStatus !== "completed");
    return {
      kpis: [
        { label: "Questions (30 days)", value: rows.length, slug: "interactions" },
        { label: "Tokens (30 days)", value: tokens.toLocaleString("en-CA"), hint: rows.length ? `${Math.round(tokens / rows.length)} per question` : undefined },
        { label: "Average latency", value: rows.length ? `${Math.round(rows.reduce((t, r) => t + r.latencyMs, 0) / rows.length)} ms` : "—" },
        { label: "Answers without citations", value: pct(uncited.length, rows.length), tone: uncited.length ? "warn" : "ok", hint: `${uncited.length} answers`, slug: "interactions" },
        { label: "Failed / refused", value: failed.length, tone: failed.length ? "warn" : "ok", slug: "interactions" },
        { label: "Published knowledge sources", value: docs.filter((d) => d.status === "published").length, slug: "knowledge" },
      ],
      panels: [
        { title: "Questions by capability", slug: "interactions", kind: "bars", bars: groupBars(rows.map((r) => r.capability)) },
        { title: "Questions by portal", slug: "interactions", kind: "bars", bars: groupBars(rows.map((r) => r.role)) },
        { title: "Recent answers without citations", slug: "interactions", kind: "table", columns: ["When", "Question"], rows: take(uncited).map((r) => [stampOf(r.createdAt).replace("T", " "), r.question.slice(0, 80)]), empty: "Every recent answer cited a source." },
      ],
    };
  },
  async platform(ctx) {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 86_400_000);
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const [active, logins, users, outbox, recent] = await Promise.all([
      prisma.session.count({ where: { institutionId: ctx.inst, expiresAt: { gt: now } } }),
      prisma.auditEvent.findMany({ where: { institutionId: ctx.inst, eventName: "Account.login", createdAt: { gte: weekAgo } }, select: { createdAt: true, actorId: true } }),
      prisma.session.groupBy({ by: ["accountId"], where: { institutionId: ctx.inst, createdAt: { gte: weekAgo } } }),
      prisma.eventOutbox.groupBy({ by: ["status"], where: { institutionId: ctx.inst }, _count: { _all: true } }),
      prisma.session.findMany({ where: { institutionId: ctx.inst }, include: { account: { select: { email: true } } }, orderBy: { createdAt: "desc" }, take: 6 }),
    ]);
    const queue = (st: string) => outbox.find((o) => o.status === st)?._count._all ?? 0;
    const days = Array.from({ length: 7 }, (_, i) => addDays(i - 6));
    return {
      kpis: [
        { label: "Active sessions", value: active, slug: "sessions" },
        { label: "Sign-ins (24 h)", value: logins.filter((l) => l.createdAt >= dayAgo).length, slug: "audit-log" },
        { label: "Users signed in (7 days)", value: users.length },
        { label: "Events waiting", value: queue("pending"), tone: queue("pending") > 50 ? "warn" : undefined, slug: "event-queue" },
        { label: "Events failed", value: queue("failed") + queue("dead"), tone: queue("failed") + queue("dead") ? "danger" : "ok", slug: "event-queue" },
      ],
      panels: [
        { title: "Sign-ins per day", slug: "audit-log", kind: "bars", bars: days.map((d) => ({ label: d, value: logins.filter((l) => l.createdAt.toISOString().slice(0, 10) === d).length })) },
        { title: "Event queue", slug: "event-queue", kind: "bars", bars: outbox.map((o) => ({ label: o.status, value: o._count._all })) },
        { title: "Recent sign-ins", slug: "sessions", kind: "table", columns: ["When", "Account", "IP"], rows: recent.map((r) => [stampOf(r.createdAt).replace("T", " "), r.account.email, r.ipAddress]), empty: "No sign-ins yet." },
      ],
    };
  },
  async workspace(ctx) {
    const [students, enrolments, apps, tickets, unread, approvals] = await Promise.all([
      prisma.student.findMany({ where: { institutionId: ctx.inst }, select: { programName: true, standing: true } }),
      prisma.enrolment.groupBy({ by: ["status"], where: { institutionId: ctx.inst }, _count: { _all: true } }),
      prisma.admissionsApplication.findMany({ where: { institutionId: ctx.inst }, select: { status: true } }),
      ctx.rows("helpdesk"),
      prisma.notification.count({ where: { institutionId: ctx.inst, recipientAccountId: ctx.user.accountId, readAt: null } }),
      prisma.approvalRequest.count({ where: { institutionId: ctx.inst, status: "pending" } }),
    ]);
    const enrolled = enrolments.find((e) => e.status === "enrolled")?._count._all ?? 0;
    const openTickets = tickets.filter((t) => !["Resolved", "Closed"].includes(s(t.status)));
    return {
      kpis: [
        { label: "Students", value: students.length },
        { label: "Active enrolments", value: enrolled },
        { label: "Applications", value: apps.length },
        { label: "Pending approvals", value: approvals, tone: approvals ? "warn" : "ok" },
        { label: "Open help desk tickets", value: openTickets.length, hint: `${openTickets.filter((t) => ["High", "Urgent"].includes(s(t.priority))).length} high / urgent`, slug: "help-desk" },
        { label: "My unread notifications", value: unread, slug: "notifications" },
      ],
      panels: [
        { title: "Students by program", kind: "bars", bars: groupBars(students.map((x) => x.programName)) },
        { title: "Students by standing", kind: "bars", bars: groupBars(students.map((x) => x.standing)) },
        { title: "Enrolments by status", kind: "bars", bars: enrolments.map((e) => ({ label: e.status, value: e._count._all })) },
        { title: "Applications by stage", kind: "bars", bars: groupBars(apps.map((a) => a.status), 10) },
      ],
    };
  },
  async registrar(ctx) {
    const [students, enrolled, credits, loas, requests] = await Promise.all([
      prisma.student.findMany({ where: { institutionId: ctx.inst }, select: { standing: true } }),
      prisma.enrolment.count({ where: { institutionId: ctx.inst, status: "enrolled" } }),
      ctx.rows("transferCredits"),
      prisma.leaveOfAbsenceRequest.findMany({ where: { institutionId: ctx.inst, status: "pending" }, include: { student: { include: { person: true } } }, orderBy: { createdAt: "asc" } }),
      prisma.serviceRequest.count({ where: { institutionId: ctx.inst, status: { in: OPEN_SERVICE_REQUEST_STATUSES } } }),
    ]);
    const st = await ctx.labels("students");
    const pendingCredits = credits.filter((c) => c.status === "pending");
    const atRisk = students.filter((x) => /warning|alert|probation|suspend/i.test(x.standing)).length;
    return {
      kpis: [
        { label: "Students", value: students.length, slug: "academic-standing" },
        { label: "Active enrolments", value: enrolled },
        { label: "Transfer credits to assess", value: pendingCredits.length, tone: pendingCredits.length ? "warn" : "ok", slug: "transfer-credits" },
        { label: "Leave requests pending", value: loas.length, tone: loas.length ? "warn" : "ok" },
        { label: "Open service requests", value: requests },
        { label: "Warning / probation", value: atRisk, tone: atRisk ? "danger" : "ok", slug: "academic-standing" },
      ],
      panels: [
        { title: "Students by standing", slug: "academic-standing", kind: "bars", bars: groupBars(students.map((x) => x.standing), 10) },
        { title: "Transfer credits to assess", slug: "transfer-credits", kind: "table", columns: ["Student", "External Course", "Credits"], rows: take(pendingCredits).map((c) => [st.get(s(c.studentId)) ?? "—", `${s(c.externalCode)} ${s(c.externalTitle)}`, s(c.credits)]), empty: "No transfer credits waiting." },
        { title: "Pending leave of absence", kind: "table", columns: ["Student", "From", "To"], rows: take(loas).map((l) => [personName(l.student.person), l.startsOn, l.endsOn]), empty: "No leave requests waiting." },
      ],
    };
  },
};
