import { prisma } from "@myheritage/db";
import { GRADE_APPROVAL_TYPES } from "../../lib/gradeApprovals.js";

type ReviewCtx = {
  user: { institutionId: string; accountId: string };
  sections: Array<{ id: string; code: string; courseCode: string; courseTitle: string }>;
};

type Decision = { actorId?: string; decision?: string; comment?: string; note?: string; reason?: string; decidedAt?: string; at?: string };

type Db = Pick<typeof prisma, "approvalRequest" | "gradeItem" | "account">;

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending Review",
  approved: "Approved",
  applied: "Approved",
  rejected: "Returned",
  declined: "Returned",
  cancelled: "Cancelled",
};

const TYPE_LABEL: Record<string, string> = {
  grade_publish: "Grade publication",
  "grade.publish": "Grade publication",
};

function statusLabel(status: string) {
  return STATUS_LABEL[status] || status.charAt(0).toUpperCase() + status.slice(1);
}

function typeLabel(type: string) {
  return TYPE_LABEL[type] || type.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function shortDate(d: Date | string) {
  return new Date(d).toISOString().slice(0, 10);
}

async function decisionComments(db: Db, institutionId: string, decisionsJson: string) {
  const decisions = parseJson<Decision[]>(decisionsJson, []);
  if (!Array.isArray(decisions) || !decisions.length) return [];
  const ids = [...new Set(decisions.map((d) => d.actorId).filter((id): id is string => Boolean(id)))];
  const accounts = ids.length
    ? await db.account.findMany({
        where: { institutionId, id: { in: ids } },
        select: { id: true, email: true, person: { select: { givenName: true, familyName: true } } },
      })
    : [];
  const names = new Map(
    accounts.map((a) => [a.id, `${a.person?.givenName ?? ""} ${a.person?.familyName ?? ""}`.trim() || a.email]),
  );
  return decisions.map((d) => {
    const verdict = (d.decision || "").toLowerCase();
    return {
      author: (d.actorId && names.get(d.actorId)) || "Reviewer",
      role: verdict.startsWith("approve") ? "Approved" : verdict ? "Returned" : "Reviewer",
      when: d.decidedAt || d.at ? shortDate(d.decidedAt || d.at || "") : "",
      body: (d.comment || d.note || d.reason || "").trim() || (verdict.startsWith("approve") ? "Approved." : "Returned without a comment."),
    };
  });
}

/** Gradebook requests reference `section:<id>`; older / seeded rows use the bare section id. */
function sectionIdOf(subjectRef: string | null) {
  return subjectRef?.startsWith("section:") ? subjectRef.slice("section:".length) : subjectRef;
}

function emptyReview(title: string, subtitle: string, emptyMessage: string) {
  return {
    title,
    subtitle,
    primaryAction: "",
    syllabusDiff: {
      badge: "Nothing to review",
      currentTitle: "",
      proposedTitle: "",
      current: [],
      proposed: [],
      comments: [],
      emptyMessage,
    },
  };
}

export async function buildGradeCorrectionReview(ctx: ReviewCtx, db: Db = prisma) {
  const sectionIds = ctx.sections.map((s) => s.id);
  const title = "Grade Correction Review";
  if (!sectionIds.length) {
    return emptyReview(title, "No course sections are assigned to you", "Grade changes for your course sections appear here once you teach a section.");
  }
  const requests = await db.approvalRequest.findMany({
    where: { institutionId: ctx.user.institutionId, type: { in: GRADE_APPROVAL_TYPES }, subjectRef: { in: [...sectionIds, ...sectionIds.map((id) => `section:${id}`)] } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  if (!requests.length) {
    return emptyReview(
      title,
      "No grade changes have been submitted for your sections",
      "When you submit grades or a grade change for approval, the request and the registrar's decision appear here.",
    );
  }
  const latest = requests[0]!;
  const sec = ctx.sections.find((s) => s.id === sectionIdOf(latest.subjectRef));
  const ids = parseJson<{ gradeItemIds?: unknown }>(latest.proposedDiffJson, {}).gradeItemIds;
  const gradeItemIds = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  const items = gradeItemIds.length
    ? await db.gradeItem.findMany({
        where: { institutionId: ctx.user.institutionId, id: { in: gradeItemIds } },
        select: {
          id: true,
          score: true,
          maxScore: true,
          letter: true,
          status: true,
          assignment: { select: { title: true } },
          student: { select: { studentNumber: true, person: { select: { givenName: true, familyName: true } } } },
        },
        take: 50,
      })
    : [];
  const pending = requests.filter((r) => r.status === "pending").length;
  const proposed = items.map((g) => {
    const name = `${g.student.person.givenName} ${g.student.person.familyName}`.trim();
    const mark = g.score == null ? "No mark" : `${g.score}/${g.maxScore}${g.letter ? ` (${g.letter})` : ""}`;
    return { label: `${name} · ${g.student.studentNumber}`, value: `${g.assignment.title}: ${mark}` };
  });
  return {
    title,
    subtitle: `${sec ? `${sec.courseCode} ${sec.code}` : "Course section"} · submitted ${shortDate(latest.createdAt)}${pending ? ` · ${pending} pending` : ""}`,
    primaryAction: "",
    syllabusDiff: {
      badge: statusLabel(latest.status),
      currentTitle: "Request",
      proposedTitle: `Grades in this request (${gradeItemIds.length})`,
      current: [
        { label: "Course", value: sec ? `${sec.courseCode} ${sec.code} · ${sec.courseTitle}` : "Course section" },
        { label: "Submitted", value: shortDate(latest.createdAt) },
        { label: "Status", value: statusLabel(latest.status) },
        {
          label: "Other requests",
          value:
            requests.length > 1
              ? requests
                  .slice(1, 6)
                  .map((r) => `${shortDate(r.createdAt)} · ${statusLabel(r.status)}`)
                  .join("; ")
              : "None",
        },
      ],
      proposed: proposed.length ? proposed : [{ label: "Grades", value: "The grades in this request are no longer available." }],
      comments: await decisionComments(db, ctx.user.institutionId, latest.decisionsJson),
    },
  };
}

export async function buildCourseApprovalReview(ctx: ReviewCtx, db: Db = prisma) {
  const title = "Course Approval Review";
  const requests = await db.approvalRequest.findMany({
    where: { institutionId: ctx.user.institutionId, requestedBy: ctx.user.accountId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  if (!requests.length) {
    return emptyReview(
      title,
      "You have no requests awaiting approval",
      "Course changes and grades you submit for approval appear here with the reviewer's decision.",
    );
  }
  const latest = requests[0]!;
  const sec = ctx.sections.find((s) => s.id === sectionIdOf(latest.subjectRef));
  const pending = requests.filter((r) => r.status === "pending").length;
  return {
    title,
    subtitle: `${requests.length} request${requests.length === 1 ? "" : "s"} · ${pending} pending`,
    primaryAction: "",
    syllabusDiff: {
      badge: statusLabel(latest.status),
      currentTitle: "Latest request",
      proposedTitle: "All requests",
      current: [
        { label: "Type", value: typeLabel(latest.type) },
        { label: "Course", value: sec ? `${sec.courseCode} ${sec.code} · ${sec.courseTitle}` : "—" },
        { label: "Submitted", value: shortDate(latest.createdAt) },
        { label: "Status", value: statusLabel(latest.status) },
      ],
      proposed: requests.map((r) => {
        const s = ctx.sections.find((x) => x.id === sectionIdOf(r.subjectRef));
        return {
          label: `${shortDate(r.createdAt)} · ${typeLabel(r.type)}`,
          value: `${s ? `${s.courseCode} ${s.code} · ` : ""}${statusLabel(r.status)}`,
        };
      }),
      comments: await decisionComments(db, ctx.user.institutionId, latest.decisionsJson),
    },
  };
}
