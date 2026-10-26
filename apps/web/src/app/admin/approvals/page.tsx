"use client";

import "@/components/heritage/heritage.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApprovalRequest } from "@myheritage/contracts";
import { SaCard, SaModal, SaNotice, SuperFrame } from "@/components/superadmin/shared";
import { ApiError, api, loadSession } from "@/lib/api";

type ProfileMeta = {
  studentNumber?: string;
  studentName?: string;
  currentValues?: Record<string, string | null | undefined>;
  subjectLabel?: string | null;
  requestedByName?: string | null;
  requestedByMe?: boolean;
  decidedByMe?: boolean;
  gradeRows?: Array<{
    studentName: string;
    studentNumber: string;
    assignment: string;
    score: number | null;
    maxScore: number;
    letter: string | null;
    feedback: string | null;
  }>;
};

const GRADE_ID_KEYS = new Set(["gradeItemIds", "studentIds"]);

function labelOf(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/[_.]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function valueText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.map(valueText).join(", ") : "None";
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${labelOf(k)}: ${valueText(v)}`)
      .join("; ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

type Filter = "all" | "pending" | "approved";

const PROFILE_FIELDS: Record<string, string> = {
  givenName: "Given name",
  familyName: "Family name",
  middleName: "Middle name",
  preferredName: "Preferred name",
  primaryEmail: "Primary email",
  personalEmail: "Personal email",
  phone: "Phone",
  dateOfBirth: "Date of birth",
  emergencyContactName: "Emergency contact",
  emergencyContactPhone: "Emergency contact phone",
};

const TYPE_LABELS: Record<string, string> = {
  student_profile_change: "Personal details change",
  grade_publish: "Grade publication",
  "grade.publish": "Grade publication",
  leave_of_absence: "Leave of absence",
  course_session_new: "New course session",
  course_session_change: "Course schedule change",
  "service_request.course_withdrawal": "Course withdrawal",
  "service_request.academic_appeal": "Academic appeal",
};

const token = () => loadSession()?.accessToken;
const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError || e instanceof Error ? e.message : fallback);

function typeLabel(type: string) {
  return TYPE_LABELS[type] ?? type.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function diffOf(item: ApprovalRequest) {
  return (item.proposedDiff ?? {}) as Record<string, unknown>;
}

function metaOf(item: ApprovalRequest): ProfileMeta {
  return (diffOf(item)._meta as ProfileMeta | undefined) ?? {};
}

function actionLabel(item: ApprovalRequest) {
  if (item.status === "approved") return "Apply";
  if (item.status !== "pending") return "View";
  if (metaOf(item).requestedByMe) return "Awaiting another approver";
  if (metaOf(item).decidedByMe) return "Decision recorded";
  return "Review & approve";
}

function subjectOf(item: ApprovalRequest) {
  const meta = metaOf(item);
  const topic = diffOf(item).subject;
  if (meta.studentName) {
    const who = `${meta.studentName}${meta.studentNumber ? ` · ${meta.studentNumber}` : ""}`;
    return typeof topic === "string" && topic ? `${who} — ${topic}` : who;
  }
  const gradeItems = diffOf(item).gradeItemIds;
  const count = Array.isArray(gradeItems) ? `${gradeItems.length} grade item${gradeItems.length === 1 ? "" : "s"}` : "";
  if (meta.subjectLabel) return count ? `${meta.subjectLabel} · ${count}` : meta.subjectLabel;
  return count || item.subjectRef;
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatusPill({ status }: { status: string }) {
  const tone = status === "pending" ? " mh-sa__pill--warn" : status === "approved" || status === "applied" ? " mh-sa__pill--ok" : "";
  const label = status === "approved" ? "Approved · awaiting apply" : status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`mh-sa__pill${tone}`}>{label}</span>;
}

function RequestDetail({ item }: { item: ApprovalRequest }) {
  const diff = diffOf(item);
  const meta = metaOf(item);
  const current = meta.currentValues ?? {};
  const profileRows = Object.keys(PROFILE_FIELDS).filter((key) => diff[key] !== undefined);
  const gradeRows = meta.gradeRows ?? [];
  const other = Object.entries(diff).filter(
    ([k, v]) =>
      !k.startsWith("_") &&
      !(k in PROFILE_FIELDS) &&
      k !== "reason" &&
      !(gradeRows.length && GRADE_ID_KEYS.has(k)) &&
      v !== null &&
      v !== undefined &&
      v !== "",
  );

  return (
    <div className="mh-sa__stack">
      <dl className="mh-sa__dl">
        <dt>Request</dt>
        <dd>{typeLabel(item.type)}</dd>
        <dt>Subject</dt>
        <dd>{subjectOf(item)}</dd>
        <dt>Requested by</dt>
        <dd>{meta.requestedByName || "—"}</dd>
        <dt>Submitted</dt>
        <dd>{when(item.createdAt)}</dd>
        <dt>Status</dt>
        <dd>
          <StatusPill status={item.status} />
        </dd>
        <dt>Approvals needed</dt>
        <dd>
          {item.decisions.filter((d) => d.decision === "approve").length} of {item.requiredCount} · {item.requiredApproverRoles.join(" or ")}
        </dd>
        {typeof diff.reason === "string" && diff.reason ? (
          <>
            <dt>Reason</dt>
            <dd>{diff.reason}</dd>
          </>
        ) : null}
      </dl>

      {profileRows.length ? (
        <div className="mh-sa__table-wrap">
          <table className="mh-sa__table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Current</th>
                <th>Proposed</th>
              </tr>
            </thead>
            <tbody>
              {profileRows.map((key) => (
                <tr key={key}>
                  <td>{PROFILE_FIELDS[key]}</td>
                  <td className="mh-sa__muted">{current[key] || "—"}</td>
                  <td>
                    <strong>{String(diff[key]) || "—"}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {gradeRows.length ? (
        <div className="mh-sa__table-wrap">
          <table className="mh-sa__table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Assessment</th>
                <th>Score</th>
                <th>Letter</th>
                <th>Feedback</th>
              </tr>
            </thead>
            <tbody>
              {gradeRows.map((g, i) => (
                <tr key={`${g.studentNumber}-${g.assignment}-${i}`}>
                  <td>
                    {g.studentName}
                    <div className="mh-sa__muted">{g.studentNumber}</div>
                  </td>
                  <td>{g.assignment}</td>
                  <td>
                    <strong>{g.score == null ? "—" : `${g.score} / ${g.maxScore}`}</strong>
                  </td>
                  <td>{g.letter || "—"}</td>
                  <td className="mh-sa__muted">{g.feedback || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {other.length ? (
        <>
          <h3 className="hx-subhead">Proposed change</h3>
          <dl className="mh-sa__dl">
            {other.map(([k, v]) => (
              <div key={k} className="hx-dl__row">
                <dt>{labelOf(k)}</dt>
                <dd>{valueText(v)}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : null}

      <div>
        <h3 className="hx-subhead">Decision history</h3>
        {item.decisions.length ? (
          <ul className="hx-audit">
            {item.decisions.map((d) => (
              <li key={`${d.actorId}-${d.decidedAt}`}>
                <strong>{d.decision === "approve" ? "Approved" : "Rejected"}</strong> · {when(d.decidedAt)}
                {d.comment ? <div className="mh-sa__muted">{d.comment}</div> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mh-sa__muted">No decisions recorded yet.</p>
        )}
      </div>
    </div>
  );
}

export default function AdminApprovalsPage() {
  const [items, setItems] = useState<ApprovalRequest[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<ApprovalRequest | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ items: ApprovalRequest[] }>("/approvals", {}, token());
      setItems(data.items);
      return data.items;
    } catch (e) {
      setNotice({ tone: "error", text: errMsg(e, "Failed to load approvals") });
      setItems((cur) => cur ?? []);
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const counts = useMemo(() => {
    const list = items ?? [];
    return {
      all: list.length,
      pending: list.filter((i) => i.status === "pending").length,
      approved: list.filter((i) => i.status === "approved").length,
    };
  }, [items]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items ?? []).filter(
      (i) => (filter === "all" || i.status === filter) && (!needle || `${typeLabel(i.type)} ${subjectOf(i)} ${metaOf(i).requestedByName ?? ""} ${i.status}`.toLowerCase().includes(needle)),
    );
  }, [items, filter, q]);

  function openItem(item: ApprovalRequest) {
    setOpen(item);
    setNote("");
    setNotice(null);
  }

  async function act(item: ApprovalRequest, kind: "approve" | "reject" | "apply") {
    if (kind === "reject" && !note.trim()) {
      setNotice({ tone: "error", text: "Add a note explaining why the request is rejected." });
      return;
    }
    setBusy(kind);
    try {
      if (kind === "apply") {
        await api(`/approvals/${item.id}/apply`, { method: "POST", body: "{}" }, token());
      } else {
        await api(
          `/approvals/${item.id}/decide`,
          { method: "POST", body: JSON.stringify({ decision: kind, comment: note.trim() || (kind === "approve" ? "Approved in inbox" : undefined) }) },
          token(),
        );
      }
      setNotice({
        tone: "success",
        text: kind === "apply" ? `${typeLabel(item.type)} applied to the record.` : `${typeLabel(item.type)} ${kind === "approve" ? "approved" : "rejected"}.`,
      });
      const next = await refresh();
      const updated = next?.find((i) => i.id === item.id) ?? null;
      setOpen(updated);
      setNote("");
    } catch (e) {
      setNotice({ tone: "error", text: errMsg(e, kind === "apply" ? "Apply failed" : "Decision failed") });
    } finally {
      setBusy(null);
    }
  }

  const tabs: Array<{ id: Filter; label: string }> = [
    { id: "all", label: `All (${counts.all})` },
    { id: "pending", label: `Pending (${counts.pending})` },
    { id: "approved", label: `Awaiting apply (${counts.approved})` },
  ];

  return (
    <SuperFrame
      title="Approvals"
      breadcrumbs={["Home", "Approvals"]}
      breadcrumbHrefs={["/admin", null]}
      activeHref="/admin/approvals"
      actions={
        <button type="button" className="mh-sa__btn" onClick={() => void refresh()}>
          Refresh
        </button>
      }
    >
      <p className="mh-sa__muted">Review requests that need administrative sign-off: personal details changes, grade publication, leave of absence and service requests.</p>
      <SaNotice tone="success">
        Grade publication uses maker-checker approval. The person who submitted marks cannot approve their own request. Sign in as a different Admin or Registrar, open the pending request, then choose <strong>Approve</strong>. Final grade approval publishes the marks to the student portal automatically.
      </SaNotice>

      {notice && !open ? (
        <SaNotice tone={notice.tone} onClose={() => setNotice(null)}>
          {notice.text}
        </SaNotice>
      ) : null}

      <div className="hx-kpis">
        <div className="hx-kpi">
          <span>Pending review</span>
          <strong>{counts.pending}</strong>
        </div>
        <div className="hx-kpi">
          <span>Approved · awaiting apply</span>
          <strong>{counts.approved}</strong>
        </div>
        <div className="hx-kpi">
          <span>Open requests</span>
          <strong>{counts.all}</strong>
        </div>
      </div>

      <SaCard
        title="Approval inbox"
        actions={tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`mh-sa__btn mh-sa__btn--sm${filter === t.id ? " mh-sa__btn--primary" : ""}`}
            aria-pressed={filter === t.id}
            onClick={() => setFilter(t.id)}
          >
            {t.label}
          </button>
        ))}
      >
        <div className="hx-listbar">
          <input className="mh-sa__input hx-quick" placeholder="Search by request, student or status…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search approvals" />
          <span className="mh-sa__muted">
            {rows.length} result{rows.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="mh-sa__table-wrap">
          <table className="mh-sa__table">
            <thead>
              <tr>
                <th>Request</th>
                <th>Subject</th>
                <th>Requested by</th>
                <th>Submitted</th>
                <th>Approvals</th>
                <th>Status</th>
                <th className="mh-sa__col-action">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items === null ? (
                <tr>
                  <td colSpan={7} className="mh-sa__empty-cell">
                    Loading approvals…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="mh-sa__empty-cell">
                    {counts.all ? "No requests match this filter." : "No approval requests in the queue."}
                  </td>
                </tr>
              ) : (
                rows.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <button type="button" className="mh-sa__link" onClick={() => openItem(item)}>
                        {typeLabel(item.type)}
                      </button>
                    </td>
                    <td>{subjectOf(item)}</td>
                    <td>{metaOf(item).requestedByName || "—"}</td>
                    <td>{when(item.createdAt)}</td>
                    <td>
                      {item.decisions.filter((d) => d.decision === "approve").length} / {item.requiredCount}
                    </td>
                    <td>
                      <StatusPill status={item.status} />
                    </td>
                    <td className="hx-row-actions">
                      <button
                        type="button"
                        className={`mh-sa__btn mh-sa__btn--sm${item.status === "pending" && !metaOf(item).requestedByMe && !metaOf(item).decidedByMe ? " mh-sa__btn--primary" : ""}`}
                        onClick={() => openItem(item)}
                      >
                        {actionLabel(item)}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SaCard>

      {open ? (
        <SaModal
          title={typeLabel(open.type)}
          onClose={() => setOpen(null)}
          wide
          footer={
            <>
              <button type="button" className="mh-sa__btn" onClick={() => setOpen(null)}>
                Close
              </button>
              {open.status === "pending" && !metaOf(open).requestedByMe && !metaOf(open).decidedByMe ? (
                <>
                  <button type="button" className="mh-sa__btn mh-sa__btn--danger" disabled={Boolean(busy)} onClick={() => void act(open, "reject")}>
                    {busy === "reject" ? "Rejecting…" : "Reject"}
                  </button>
                  <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={Boolean(busy)} onClick={() => void act(open, "approve")}>
                    {busy === "approve" ? "Approving…" : "Approve"}
                  </button>
                </>
              ) : null}
              {open.status === "pending" && metaOf(open).requestedByMe ? (
                <button type="button" className="mh-sa__btn" disabled title="A different Admin or Registrar must approve this request">
                  Approve — another approver required
                </button>
              ) : null}
              {open.status === "approved" ? (
                <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={Boolean(busy)} onClick={() => void act(open, "apply")}>
                  {busy === "apply" ? "Applying…" : "Apply to record"}
                </button>
              ) : null}
            </>
          }
        >
          {notice ? (
            <SaNotice tone={notice.tone} onClose={() => setNotice(null)}>
              {notice.text}
            </SaNotice>
          ) : null}
          <RequestDetail item={open} />
          {open.status === "pending" && metaOf(open).requestedByMe ? (
            <p className="mh-sa__muted">You submitted this request, so another approver must decide it.</p>
          ) : open.status === "pending" && metaOf(open).decidedByMe ? (
            <p className="mh-sa__muted">You have already recorded your decision. Waiting for the remaining approvers.</p>
          ) : open.status === "pending" ? (
            <label className="mh-sa__field mh-sa__field--wide">
              <span className="mh-sa__label">Decision note (required to reject)</span>
              <textarea className="mh-sa__input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for the requester…" />
            </label>
          ) : null}
        </SaModal>
      ) : null}
    </SuperFrame>
  );
}
