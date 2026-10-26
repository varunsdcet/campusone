import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { writeAuditAndOutbox } from "@myheritage/events";
import { randomUUID } from "node:crypto";
import type { PortalView } from "../portal/portal.service.js";

function requireEmployer(user: SessionClaims) {
  if (!user.roles.includes("employer")) {
    throw Object.assign(new Error("Forbidden"), { code: "FORBIDDEN", status: 403 });
  }
}

async function orgFor(user: SessionClaims) {
  return prisma.employerOrg.findFirst({
    where: { institutionId: user.institutionId, accountId: user.accountId },
    include: {
      placements: {
        include: {
          hours: { orderBy: { createdAt: "desc" } },
          evaluations: { orderBy: { createdAt: "desc" } },
          student: { include: { person: { include: { accounts: { where: { status: "active" }, select: { id: true } } } } } },
        },
        orderBy: { studentName: "asc" },
      },
      agreements: { orderBy: { title: "asc" } },
    },
  });
}

export async function buildEmployerView(user: SessionClaims, path: string): Promise<PortalView> {
  requireEmployer(user);
  const org = await orgFor(user);
  const normalized = path.replace(/\/$/, "") || path;
  const pendingHours = org?.placements.flatMap((p) => p.hours).filter((h) => h.status === "pending") ?? [];
  const dueEvals = org?.placements.flatMap((p) => p.evaluations).filter((e) => e.status === "due") ?? [];

  const base: PortalView = {
    path: normalized,
    title: "Employer",
    subtitle: org ? `${org.name} · ${org.siteName}` : "Employer portal",
    role: "employer",
    active: "Home",
    breadcrumb: ["Employer", "Home"],
    metrics: [
      { label: "Placements", value: String(org?.placements.length ?? 0) },
      { label: "Hours pending", value: String(pendingHours.length) },
      { label: "Evals due", value: String(dueEvals.length) },
    ],
    sections: [],
    actions: [
      { label: "Ask Heritage", href: "/employer/ask", variant: "ai" },
      { label: "Search", href: "/employer/search", variant: "secondary" },
    ],
    live: true,
  };

  if (!org) {
    base.sections = [{ title: "Employer", rows: [{ primary: "No employer org linked", secondary: "Contact practicum office" }] }];
    return base;
  }

  if (normalized === "/employer" || normalized.endsWith("/employer")) {
    base.title = "Employer home";
    base.active = "Home";
    base.sections = [
      {
        title: "Active placements",
        rows: org.placements.map((p) => ({
          primary: p.studentName,
          secondary: `${p.programName} · ${p.status}`,
          meta: [p.startsOn, p.endsOn].filter(Boolean).join(" → ") || "Dates TBA",
          href: "/employer/placements",
        })),
      },
      {
        title: "Needs attention",
        rows: [
          ...pendingHours.slice(0, 3).map((h) => ({
            primary: `Hours · ${h.weekLabel}`,
            secondary: `${h.hours}h awaiting sign-off`,
            meta: h.status,
            href: "/employer/hours",
          })),
          ...dueEvals.slice(0, 3).map((e) => ({
            primary: `Evaluation · ${e.studentName}`,
            secondary: "Clinical appraisal due",
            meta: e.status,
            href: "/employer/evaluations",
          })),
        ],
      },
    ];
    base.actions = [
      { label: "Review hours", href: "/employer/hours" },
      { label: "Ask Heritage", href: "/employer/ask", variant: "ai" },
    ];
    return base;
  }

  if (normalized.includes("/placements")) {
    base.title = "Placements";
    base.active = "Placements";
    base.breadcrumb = ["Employer", "Placements"];
    base.sections = [
      {
        title: "Students at this site",
        rows: org.placements.map((p) => ({
          primary: p.studentName,
          secondary: p.programName,
          meta: p.status,
        })),
      },
    ];
    base.actions = [
      { label: "Hours log", href: "/employer/hours" },
      { label: "Evaluations", href: "/employer/evaluations", variant: "secondary" },
      { label: "Ask Heritage", href: "/employer/ask", variant: "ai" },
    ];
    return base;
  }

  if (normalized.includes("/hours")) {
    base.title = "Hours";
    base.active = "Hours";
    base.breadcrumb = ["Employer", "Hours"];
    const rows = org.placements.flatMap((p) =>
      p.hours.map((h) => ({
        primary: `${p.studentName} · ${h.weekLabel}`,
        secondary: `${h.hours} hours`,
        meta: h.status,
      })),
    );
    base.sections = [{ title: "Hours log", rows }];
    const pending = pendingHours[0];
    base.actions = [
      ...(pending
        ? [{ label: `Approve ${pending.weekLabel}`, action: "approve_hours", payload: { hoursId: pending.id }, variant: "primary" as const }]
        : [{ label: "All hours approved", href: "/employer/placements", variant: "secondary" as const }]),
      { label: "Ask Heritage", href: "/employer/ask", variant: "ai" },
    ];
    return base;
  }

  if (normalized.includes("/notifications")) {
    base.title = "Notifications";
    base.active = "Home";
    base.breadcrumb = ["Employer", "Notifications"];
    const notes = await prisma.notification.findMany({
      where: { institutionId: user.institutionId, recipientAccountId: user.accountId },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    base.sections = [
      {
        title: "Inbox",
        rows: notes.length
          ? notes.map((n) => ({
              primary: n.title,
              secondary: n.body,
              meta: `${n.readAt ? "Read" : "Unread"} · ${n.createdAt.toLocaleString()}`,
            }))
          : [{ primary: "No notifications yet", secondary: "Hours and evaluation alerts will appear here." }],
      },
    ];
    base.actions = [
      { label: "Hours", href: "/employer/hours", variant: "secondary" },
      { label: "Ask Heritage", href: "/employer/ask", variant: "ai" },
    ];
    return base;
  }

  if (normalized.includes("/evaluations")) {
    base.title = "Evaluations";
    base.active = "Evaluations";
    base.breadcrumb = ["Employer", "Evaluations"];
    const rows = org.placements.flatMap((p) =>
      p.evaluations.map((e) => ({
        primary: e.studentName,
        secondary: e.notes ?? p.programName,
        meta: e.score != null ? `${e.status} · ${e.score}/5` : e.status,
      })),
    );
    base.sections = [{ title: "Clinical appraisals", rows }];
    const due = dueEvals[0];
    base.actions = [
      ...(due
        ? [{ label: `Submit eval · ${due.studentName}`, action: "submit_evaluation", payload: { evaluationId: due.id }, variant: "primary" as const }]
        : [{ label: "No evaluations due", href: "/employer", variant: "secondary" as const }]),
      { label: "Ask Heritage", href: "/employer/ask", variant: "ai" },
    ];
    return base;
  }

  if (normalized.includes("/agreements")) {
    base.title = "Agreements";
    base.active = "Agreements";
    base.breadcrumb = ["Employer", "Agreements"];
    base.sections = [
      {
        title: "Affiliation agreements",
        rows: org.agreements.map((a) => ({
          primary: a.title,
          secondary: a.renewsOn ? `Renews ${a.renewsOn}` : "Open-ended",
          meta: a.status,
        })),
      },
    ];
    base.actions = [
      { label: "Profile", href: "/employer/profile", variant: "secondary" },
      { label: "Ask Heritage", href: "/employer/ask", variant: "ai" },
    ];
    return base;
  }

  if (normalized.includes("/profile") || normalized.includes("/messages")) {
    base.title = normalized.includes("/messages") ? "Messages" : "Profile";
    base.active = normalized.includes("/messages") ? "Messages" : "Profile";
    base.breadcrumb = ["Employer", base.title];
    const person = await prisma.person.findUnique({ where: { id: user.personId } });
    base.sections = [
      {
        title: "Employer profile",
        rows: [
          {
            primary: org.name,
            secondary: org.siteName,
            meta: org.contactEmail ?? person?.email,
          },
          {
            primary: `${person?.givenName ?? ""} ${person?.familyName ?? ""}`.trim() || "Contact",
            secondary: person?.email,
            meta: "Site supervisor",
          },
        ],
      },
    ];
    base.actions = [
      { label: "Placements", href: "/employer/placements" },
      { label: "Ask Heritage", href: "/employer/ask", variant: "ai" },
    ];
    return base;
  }

  base.title = titleFromPath(normalized);
  base.breadcrumb = ["Employer", base.title];
  base.sections = [
    {
      title: `${base.title} · live`,
      rows: org.placements.map((p) => ({
        primary: p.studentName,
        secondary: p.programName,
        meta: p.status,
        href: "/employer/placements",
      })),
    },
  ];
  return base;
}

function titleFromPath(path: string): string {
  const leaf = path.split("/").filter(Boolean).pop() ?? "Home";
  return leaf.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function runEmployerAction(
  user: SessionClaims,
  action: string,
  payload?: Record<string, unknown>,
) {
  requireEmployer(user);
  const org = await orgFor(user);
  if (!org) throw Object.assign(new Error("Employer org not found"), { status: 404, code: "NOT_FOUND" });

  if (action === "approve_hours") {
    const hoursId = String(payload?.hoursId ?? "");
    if (!hoursId) {
      throw Object.assign(new Error("Choose a pending practicum hours entry"), { status: 400, code: "HOURS_ID_REQUIRED" });
    }
    const entry = org.placements
      .flatMap((p) => p.hours)
      .find((h) => h.id === hoursId && h.status === "pending");

    if (!entry) {
      throw Object.assign(new Error("No pending practicum hours entry was found"), { status: 404, code: "HOURS_NOT_FOUND" });
    }

    await prisma.hoursEntry.update({ where: { id: entry.id }, data: { status: "approved" } });
    const placement = org.placements.find((p) => p.id === entry.placementId);
    const recipients = placement?.student?.person.accounts.map((account) => account.id) ?? [];
    if (recipients.length) await prisma.notification.createMany({ data: recipients.map((recipientAccountId) => ({ institutionId: user.institutionId, recipientAccountId, channel: "in_app", title: "Practicum hours approved", body: `${entry.weekLabel} · ${entry.hours}h signed off.`, templateKey: "practicum.hours.approved", dedupeKey: `practicum-hours:${entry.id}:approved:${recipientAccountId}` })), skipDuplicates: true });
    await writeAuditAndOutbox(prisma, {
      institutionId: user.institutionId,
      actorId: user.accountId,
      eventName: "EmployerHours.approved",
      purpose: "employer_mutation",
      before: { hoursId: entry.id, status: entry.status },
      after: { hoursId: entry.id, status: "approved", weekLabel: entry.weekLabel, hours: entry.hours },
      source: "employer.approve_hours",
      correlationId: randomUUID(),
      outboxPayload: { hoursId: entry.id, status: "approved" },
    });
    return { ok: true, hoursId: entry.id, status: "approved" };
  }

  if (action === "submit_evaluation") {
    const evaluationId = String(payload?.evaluationId ?? "");
    let evaluation =
      org.placements.flatMap((p) => p.evaluations).find((e) => e.id === evaluationId) ??
      org.placements.flatMap((p) => p.evaluations).find((e) => e.status === "due");

    if (!evaluation) {
      const placement = org.placements[0];
      if (!placement) {
        return { ok: true, status: "already_clear", message: "No placements for evaluation" };
      }
      evaluation = await prisma.placementEvaluation.create({
        data: {
          institutionId: user.institutionId,
          placementId: placement.id,
          studentName: placement.studentName,
          status: "due",
        },
      });
    }

    const score = Number(payload?.score);
    const notes = String(payload?.notes ?? "").trim();
    if (!Number.isInteger(score) || score < 1 || score > 5) throw Object.assign(new Error("Enter an evaluation score from 1 to 5"), { status: 400, code: "VALIDATION_ERROR" });
    if (notes.length < 3 || notes.length > 4000) throw Object.assign(new Error("Enter evaluation notes"), { status: 400, code: "VALIDATION_ERROR" });
    await prisma.placementEvaluation.update({
      where: { id: evaluation.id },
      data: { status: "submitted", score, notes },
    });
    await writeAuditAndOutbox(prisma, {
      institutionId: user.institutionId,
      actorId: user.accountId,
      eventName: "EmployerEvaluation.submitted",
      purpose: "employer_mutation",
      before: { evaluationId: evaluation.id, status: evaluation.status },
      after: { evaluationId: evaluation.id, status: "submitted", score },
      source: "employer.submit_evaluation",
      correlationId: randomUUID(),
      outboxPayload: { evaluationId: evaluation.id, status: "submitted", score },
    });
    const placement = org.placements.find((p) => p.id === evaluation!.placementId);
    const recipients = placement?.student?.person.accounts.map((account) => account.id) ?? [];
    if (recipients.length) await prisma.notification.createMany({ data: recipients.map((recipientAccountId) => ({ institutionId: user.institutionId, recipientAccountId, channel: "in_app", title: "Practicum evaluation submitted", body: `${evaluation!.studentName} · ${score}/5`, templateKey: "practicum.evaluation.submitted", dedupeKey: `practicum-evaluation:${evaluation!.id}:submitted:${recipientAccountId}` })), skipDuplicates: true });
    return { ok: true, evaluationId: evaluation.id, status: "submitted", score };
  }

  throw Object.assign(new Error(`Unknown action: ${action}`), { status: 400, code: "BAD_REQUEST" });
}
