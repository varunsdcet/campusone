"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CourseReviewShell } from "@/components/CourseReviewShell";
import { api, loadSession, type Session } from "@/lib/api";
import { fetchSubmissionFile } from "@/lib/submissionFiles";

type SectionItem = { sectionId: string; code: string; title: string; termCode?: string };

type SubmissionFile = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  createdAt: string;
};

type SubmissionsResponse = {
  section: { id: string; code: string; title: string };
  assignments: Array<{ id: string; title: string; dueAt: string | null; maxScore: number; hidden: boolean }>;
  assignmentId: string | null;
  rows: Array<{
    studentId: string;
    name: string;
    studentNumber: string;
    submission: null | {
      id: string;
      status: string;
      submittedAt: string | null;
      textBody: string | null;
      reviewHistory: Array<{ action?: string; reason?: string; extensionUntil?: string; penaltyPercent?: number; actedAt?: string }>;
      files: SubmissionFile[];
    };
    grade: null | { score: number | null; maxScore: number; status: string; feedback: string | null };
  }>;
};

function formatWhen(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function InstructorSubmissionsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading submissions…</div>}>
      <InstructorSubmissionsInner />
    </Suspense>
  );
}

function InstructorSubmissionsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [data, setData] = useState<SubmissionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const sectionId = (searchParams.get("sectionId") || "").trim();
  const assignmentId = (searchParams.get("assignmentId") || "").trim();

  const navigate = useCallback(
    (nextSection: string, nextAssignment?: string) => {
      const params = new URLSearchParams({ sectionId: nextSection });
      if (nextAssignment) params.set("assignmentId", nextAssignment);
      router.replace(`/instructor/submissions?${params.toString()}`);
    },
    [router],
  );

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
    api<{ items: SectionItem[] }>("/courses/me", {}, s.accessToken)
      .then((res) => {
        const items = [...(res.items ?? [])].sort((a, b) => a.code.localeCompare(b.code));
        setSections(items);
        if (!sectionId && items[0]) navigate(items[0].sectionId);
        if (!sectionId && !items[0]) {
          setError("No course sections are assigned to you.");
          setLoading(false);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load your sections"));
  }, [router, sectionId, navigate]);

  useEffect(() => {
    if (!session || !sectionId) return;
    setLoading(true);
    setError(null);
    const qs = assignmentId ? `?assignmentId=${encodeURIComponent(assignmentId)}` : "";
    api<SubmissionsResponse>(`/instructor/sections/${encodeURIComponent(sectionId)}/submissions${qs}`, {}, session.accessToken)
      .then(setData)
      .catch((err) => {
        setData(null);
        setError(err instanceof Error ? err.message : "Could not load submissions");
      })
      .finally(() => setLoading(false));
  }, [session, sectionId, assignmentId]);

  async function openFile(fileId: string, mode: "open" | "download") {
    setError(null);
    try {
      await fetchSubmissionFile(`/instructor/submission-files/${encodeURIComponent(fileId)}`, mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the file");
    }
  }

  async function submissionAction(submissionId: string, action: "return" | "unsubmit" | "grant_extension" | "apply_penalty") {
    if (!session) return;
    const reason = window.prompt(action === "return" ? "Reason for returning this submission" : "Reason for this change");
    if (!reason?.trim()) return;
    const body: Record<string, unknown> = { action, reason: reason.trim() };
    if (action === "grant_extension") {
      const until = window.prompt("Extension deadline (YYYY-MM-DD HH:mm)");
      if (!until) return;
      const date = new Date(until);
      if (Number.isNaN(date.getTime())) return setError("Enter a valid extension date and time.");
      body.extensionUntil = date.toISOString();
    }
    if (action === "apply_penalty") {
      const penalty = Number(window.prompt("Penalty percentage (0–100)", "10"));
      if (!Number.isFinite(penalty) || penalty < 0 || penalty > 100) return setError("Enter a penalty from 0 to 100.");
      body.penaltyPercent = penalty;
    }
    setError(null);
    try {
      await api(`/instructor/submissions/${encodeURIComponent(submissionId)}/action`, { method: "POST", body: JSON.stringify(body) }, session.accessToken);
      const qs = assignmentId ? `?assignmentId=${encodeURIComponent(assignmentId)}` : "";
      setData(await api<SubmissionsResponse>(`/instructor/sections/${encodeURIComponent(sectionId)}/submissions${qs}`, {}, session.accessToken));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission action failed");
    }
  }

  if (!session) return null;
  const assignment = data?.assignments.find((a) => a.id === data.assignmentId) ?? null;
  const submittedCount = data?.rows.filter((r) => r.submission?.status === "submitted").length ?? 0;
  const sectionOptions =
    data && !sections.some((s) => s.sectionId === data.section.id)
      ? [{ sectionId: data.section.id, code: data.section.code, title: data.section.title }, ...sections]
      : sections;

  return (
    <CourseReviewShell
      session={session}
      title="Submissions"
      subtitle={data ? `${data.section.code} · ${data.section.title}` : "Student work by assignment"}
    >
      <div className="mh-teacher-stack">
        <div className="mh-teacher-page-head">
          <div>
            <h2>{assignment?.title ?? "Submissions"}</h2>
            <p>
              {assignment
                ? `Due ${formatWhen(assignment.dueAt)} · ${submittedCount} of ${data?.rows.length ?? 0} submitted`
                : "Choose a course section and assignment to review student work."}
            </p>
          </div>
          <div className="mh-teacher-actions">
            {sectionId ? (
              <button
                type="button"
                className="mh-teacher-btn"
                onClick={() => router.push(`/instructor/gradebook?sectionId=${encodeURIComponent(sectionId)}`)}
              >
                Grade in gradebook
              </button>
            ) : null}
          </div>
        </div>

        <div className="mh-teacher-fields" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: 6, minWidth: 260 }}>
            <span>Course section</span>
            <select value={sectionId} onChange={(e) => navigate(e.target.value)}>
              {sectionOptions.map((s) => (
                <option key={s.sectionId} value={s.sectionId}>
                  {s.code} · {s.title}
                  {s.termCode ? ` (${s.termCode})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6, minWidth: 260 }}>
            <span>Assignment</span>
            <select
              value={data?.assignmentId ?? ""}
              disabled={!data?.assignments.length}
              onChange={(e) => navigate(sectionId, e.target.value)}
            >
              {data?.assignments.length ? null : <option value="">No assignments</option>}
              {data?.assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                  {a.hidden ? " (hidden from students)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? <p className="mh-teacher-warn">{error}</p> : null}

        {loading && !data ? (
          <p className="mh-teacher-muted">Loading submissions…</p>
        ) : !data ? null : !data.assignments.length ? (
          <section className="mh-teacher-card">
            <p className="mh-teacher-muted">This section has no assignments yet.</p>
          </section>
        ) : data.rows.length === 0 ? (
          <section className="mh-teacher-card">
            <p className="mh-teacher-muted">No students are enrolled in this section.</p>
          </section>
        ) : (
          <section className="mh-teacher-card">
            <div className="mh-teacher-list">
              {data.rows.map((row) => {
                const sub = row.submission;
                const status = sub?.status === "submitted" ? "Submitted" : sub ? "Draft (not submitted)" : "No submission";
                return (
                  <div key={row.studentId} className="mh-teacher-list__item" style={{ alignItems: "flex-start" }}>
                    <div style={{ display: "grid", gap: 6, flex: 1 }}>
                      <strong>
                        {row.name} <span className="mh-teacher-muted">· {row.studentNumber}</span>
                      </strong>
                      <span>
                        {status}
                        {sub?.submittedAt ? ` · ${formatWhen(sub.submittedAt)}` : ""}
                        {row.grade?.score != null
                          ? ` · Mark ${row.grade.score}/${row.grade.maxScore} (${row.grade.status.replace("_", " ")})`
                          : ""}
                      </span>
                      {sub?.files.map((file) => (
                        <div key={file.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <span>
                            {file.filename} · {formatSize(file.sizeBytes)} · version {file.version}
                          </span>
                          <button
                            type="button"
                            className="mh-teacher-btn mh-teacher-btn--secondary"
                            onClick={() => void openFile(file.id, "open")}
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            className="mh-teacher-btn mh-teacher-btn--secondary"
                            onClick={() => void openFile(file.id, "download")}
                          >
                            Download
                          </button>
                        </div>
                      ))}
                      {sub?.textBody ? (
                        <details>
                          <summary>Online text</summary>
                          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{sub.textBody}</p>
                        </details>
                      ) : null}
                      {sub?.reviewHistory?.length ? (
                        <details>
                          <summary>Review actions ({sub.reviewHistory.length})</summary>
                          <ul>{sub.reviewHistory.map((item, index) => <li key={`${item.actedAt || "review"}-${index}`}>{String(item.action || "action").replaceAll("_", " ")}{item.penaltyPercent != null ? ` · ${item.penaltyPercent}%` : ""}{item.extensionUntil ? ` · until ${formatWhen(item.extensionUntil)}` : ""} · {item.reason || "No reason"}</li>)}</ul>
                        </details>
                      ) : null}
                      {row.grade?.feedback ? (
                        <details>
                          <summary>Your feedback</summary>
                          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{row.grade.feedback}</p>
                        </details>
                      ) : null}
                      {sub ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => void submissionAction(sub.id, "return")}>Return</button>
                          <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => void submissionAction(sub.id, "grant_extension")}>Grant extension</button>
                          <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => void submissionAction(sub.id, "apply_penalty")}>Apply penalty</button>
                          <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => void submissionAction(sub.id, "unsubmit")}>Unsubmit</button>
                        </div>
                      ) : null}
                    </div>
                    <span
                      className={`mh-teacher-badge ${
                        sub?.status === "submitted" ? "is-success" : sub ? "is-warning" : "is-muted"
                      }`}
                    >
                      {sub?.status === "submitted" ? "submitted" : sub ? "draft" : "missing"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </CourseReviewShell>
  );
}
