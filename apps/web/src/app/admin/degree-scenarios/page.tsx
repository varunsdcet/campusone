"use client";

import { useEffect, useState } from "react";
import { AdminSisShell } from "@/components/AdminSisShell";
import { api, loadSession } from "@/lib/api";

type Scenario = { id: string; label: string; status: string; reviewNote: string | null; createdAt: string; studentName: string; studentNumber: string; assumptions: unknown; result: unknown };

export default function DegreeScenarioReviewPage() {
  const [items, setItems] = useState<Scenario[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const refresh = async () => {
    const session = loadSession();
    if (!session) return;
    setItems((await api<{ items: Scenario[] }>("/admin/degree-scenarios", {}, session.accessToken)).items);
  };
  useEffect(() => { void refresh().catch((e) => setError(e instanceof Error ? e.message : "Could not load scenarios")); }, []);
  async function review(id: string, status: "approved" | "rejected") {
    const session = loadSession(); if (!session) return;
    const note = window.prompt(status === "approved" ? "Approval note" : "Rejection reason");
    if (!note?.trim()) return;
    setBusy(id); setError("");
    try { await api(`/admin/degree-scenarios/${id}/review`, { method: "PATCH", body: JSON.stringify({ status, note }) }, session.accessToken); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Review failed"); }
    finally { setBusy(""); }
  }
  return <AdminSisShell activeHref="/admin/degree-scenarios" breadcrumbs={["Home", "Registrar", "Degree Scenario Review"]}>
    <div className="mh-hcc-page"><h1>Degree scenario review</h1><p>Review student-saved what-if plans before they are treated as advising guidance.</p>{error ? <p style={{ color: "var(--mh-danger)" }}>{error}</p> : null}
      <table className="mh-hcc-table"><thead><tr><th>Student</th><th>Scenario</th><th>Status</th><th>Created</th><th>Action</th></tr></thead><tbody>
        {items.map((item) => <tr key={item.id}><td>{item.studentName}<br /><small>{item.studentNumber}</small></td><td><strong>{item.label}</strong>{item.reviewNote ? <div>{item.reviewNote}</div> : null}<details><summary>Inputs and projection</summary><pre>{JSON.stringify({ assumptions: item.assumptions, result: item.result }, null, 2)}</pre></details></td><td>{item.status}</td><td>{item.createdAt.slice(0, 10)}</td><td>{item.status === "draft" ? <div style={{ display: "flex", gap: 8 }}><button disabled={busy === item.id} onClick={() => void review(item.id, "approved")}>Approve</button><button disabled={busy === item.id} onClick={() => void review(item.id, "rejected")}>Reject</button></div> : "Reviewed"}</td></tr>)}
        {!items.length ? <tr><td colSpan={5}>No saved scenarios.</td></tr> : null}
      </tbody></table>
    </div>
  </AdminSisShell>;
}
