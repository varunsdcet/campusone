"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { GradebookResponse } from "@myheritage/contracts";
import { SuperFrame } from "@/components/superadmin/shared";
import { api, loadSession } from "@/lib/api";
import { CourseCell, ErrorNotice, errMsg, mc, type Offering } from "./common";

/** Placeholder id the gradebook API returns for a cell that has no saved grade yet. */
const NO_ITEM = "00000000-0000-4000-8000-000000000000";
const GRADES = "/admin/my-courses/grades";

type Submission = Offering & { status: string; gradingType: string; outstanding: number };
type Cell = GradebookResponse["rows"][number]["cells"][number];

const token = () => loadSession()?.accessToken;
const cellKey = (studentId: string, assignmentId: string) => `${studentId}:${assignmentId}`;
const cellLabel = (c: Cell) => (c.status === "published" ? "Approved" : c.status === "pending_publish" ? "Pending" : c.score == null ? "Missing" : "Not submitted");
const publishKey = (sectionId: string, ids: string[]) => `grade-publish:${sectionId}:${[...ids].sort().join(",")}`;

export function GradeSubmit() {
  const sp = useSearchParams();
  const sectionId = sp?.get("section") ?? "";
  const [offering, setOffering] = useState<Submission | null>(null);
  const [book, setBook] = useState<GradebookResponse | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!sectionId) {
      setError("Choose a course from Grades Submission.");
      return;
    }
    const [o, b] = await Promise.all([
      mc<Submission>(`/grades/${encodeURIComponent(sectionId)}`),
      api<GradebookResponse>(`/gradebooks/${encodeURIComponent(sectionId)}`, {}, token()),
    ]);
    setOffering(o);
    setBook(b);
    const next: Record<string, string> = {};
    for (const row of b.rows) for (const c of row.cells) next[cellKey(row.studentId, c.assignmentId)] = c.score == null ? "" : String(c.score);
    setScores(next);
  }, [sectionId]);

  useEffect(() => {
    setError(null);
    load().catch((e) => setError(errMsg(e, "Could not load the grades for this course")));
  }, [load]);

  const changed = useMemo(() => {
    if (!book) return [];
    const out: Array<{ studentId: string; cell: Cell; score: number | null; raw: string }> = [];
    for (const row of book.rows)
      for (const cell of row.cells) {
        if (cell.status === "published") continue;
        const raw = (scores[cellKey(row.studentId, cell.assignmentId)] ?? "").trim();
        const before = cell.score == null ? "" : String(cell.score);
        if (raw !== before) out.push({ studentId: row.studentId, cell, score: raw === "" ? null : Number(raw), raw });
      }
    return out;
  }, [book, scores]);

  const counts = useMemo(() => {
    const c = { missing: 0, toSubmit: 0, pending: 0, approved: 0 };
    for (const row of book?.rows ?? [])
      for (const cell of row.cells) {
        if (cell.status === "published") c.approved += 1;
        else if (cell.status === "pending_publish") c.pending += 1;
        else if (cell.score == null) c.missing += 1;
        else c.toSubmit += 1;
      }
    return c;
  }, [book]);

  function invalid() {
    for (const ch of changed) {
      if (ch.score == null) return "A saved grade cannot be cleared; enter a score instead.";
      if (!Number.isFinite(ch.score) || ch.score < 0 || ch.score > ch.cell.maxScore) return `Scores must be between 0 and ${ch.cell.maxScore}.`;
    }
    return null;
  }

  async function saveChanged() {
    for (const ch of changed) {
      if (ch.cell.gradeItemId === NO_ITEM) {
        await api("/grade-items", { method: "POST", body: JSON.stringify({ assignmentId: ch.cell.assignmentId, studentId: ch.studentId, score: ch.score }) }, token());
      } else {
        await api(`/grade-items/${ch.cell.gradeItemId}`, { method: "PATCH", body: JSON.stringify({ score: ch.score, rowVersion: ch.cell.rowVersion }) }, token());
      }
    }
    return changed.length;
  }

  async function run(submit: boolean) {
    const problem = invalid();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await saveChanged();
      if (!submit) {
        await load();
        setNotice(saved ? `${saved} grade${saved === 1 ? "" : "s"} saved.` : "There are no changes to save.");
        return;
      }
      const fresh = await api<GradebookResponse>(`/gradebooks/${encodeURIComponent(sectionId)}`, {}, token());
      const ids = fresh.rows.flatMap((r) => r.cells).filter((c) => c.status === "draft" && c.score != null && c.gradeItemId !== NO_ITEM).map((c) => c.gradeItemId);
      if (!ids.length) {
        await load();
        setError("Enter at least one grade before submitting.");
        return;
      }
      await api(
        `/gradebooks/${encodeURIComponent(sectionId)}/publish`,
        { method: "POST", body: JSON.stringify({ gradeItemIds: ids }), headers: { "idempotency-key": publishKey(sectionId, ids) } },
        token(),
      );
      await load();
      setNotice(`${ids.length} grade${ids.length === 1 ? "" : "s"} submitted for approval.`);
    } catch (e) {
      await load().catch(() => undefined);
      setError(errMsg(e, submit ? "Could not submit grades" : "Could not save grades"));
    } finally {
      setBusy(false);
    }
  }

  const title = offering ? `${offering.code} (${offering.offering})` : "Submit Grades";

  return (
    <SuperFrame
      title="SUBMIT GRADES"
      breadcrumbs={["Home", "Grades Submission", title]}
      breadcrumbHrefs={["/admin", GRADES]}
      activeHref={GRADES}
    >
      <div className="ur">
        <ErrorNotice error={error} onClose={() => setError(null)} />
        {notice ? (
          <div className="mh-sa__notice" role="status">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
              ×
            </button>
          </div>
        ) : null}
        {offering ? (
          <section className="mh-sa__card">
            <div className="mh-sa__table-wrap">
              <table className="mh-sa__table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Status</th>
                    <th>Grading Type</th>
                    <th>Course Dates</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <CourseCell o={offering} />
                    </td>
                    <td className={offering.status === "Submission Required" ? "mc-status-required" : undefined}>{offering.status}</td>
                    <td className="mc-grading-type">{offering.gradingType}</td>
                    <td className="ur-nowrap">{offering.dates}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
        <section className="mh-sa__card mc-save-bar">
          {!book ? (
            <p className="mh-sa__empty-cell">{error ? "—" : "Loading…"}</p>
          ) : !book.rows.length ? (
            <p className="mh-sa__empty-cell">No students are enrolled in this course offering.</p>
          ) : (
            <>
              <div className="mh-sa__table-wrap">
                <table className="mh-sa__table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      {book.assignments.map((a) => (
                        <th key={a.id}>
                          {a.title}
                          <div className="mh-sa__sub">
                            Out of {a.maxScore} · {a.weightPercent}%
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {book.rows.map((row) => (
                      <tr key={row.studentId}>
                        <td>
                          <div className="ur-name">{row.name}</div>
                          <div className="mh-sa__sub">{row.studentNumber}</div>
                        </td>
                        {row.cells.map((cell) => {
                          const key = cellKey(row.studentId, cell.assignmentId);
                          return (
                            <td key={key}>
                              {cell.status === "published" ? (
                                <strong>
                                  {cell.score} / {cell.maxScore}
                                </strong>
                              ) : (
                                <span className="mc-score">
                                  <input
                                    className="mh-sa__input mc-score__input"
                                    type="number"
                                    min={0}
                                    max={cell.maxScore}
                                    step="0.5"
                                    value={scores[key] ?? ""}
                                    disabled={busy}
                                    aria-label={`Score for ${row.name}`}
                                    onChange={(e) => setScores((s) => ({ ...s, [key]: e.target.value }))}
                                  />
                                  <span>/ {cell.maxScore}</span>
                                </span>
                              )}
                              <div className={`mh-sa__sub${cell.status === "draft" && cell.score == null ? " mc-status-required" : ""}`}>{cellLabel(cell)}</div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mc-counters">
                <span>Missing: {counts.missing}</span>
                <span>Not Submitted: {counts.toSubmit}</span>
                <span>Pending: {counts.pending}</span>
                <span>Approved: {counts.approved}</span>
              </div>
              <div className="mh-sa__actions">
                <Link className="mh-sa__btn" href={GRADES}>
                  Back to Grades Submission
                </Link>
                <span>
                  <button type="button" className="mh-sa__btn" disabled={busy || !changed.length} onClick={() => void run(false)}>
                    Save Grades
                  </button>{" "}
                  <button
                    type="button"
                    className="mh-sa__btn mh-sa__btn--primary"
                    disabled={busy || (!changed.length && counts.toSubmit === 0)}
                    onClick={() => void run(true)}
                  >
                    {busy ? "Working…" : "Submit Grades"}
                  </button>
                </span>
              </div>
            </>
          )}
        </section>
      </div>
    </SuperFrame>
  );
}
