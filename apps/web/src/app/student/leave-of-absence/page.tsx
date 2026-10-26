"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentSisShell } from "@/components/StudentSisShell";
import { api, loadSession } from "@/lib/api";

type Loa = {
  id: string;
  reason: string;
  startsOn: string;
  endsOn: string;
  status: string;
  decisionNote: string | null;
  createdAt: string;
};

export default function LeaveOfAbsencePage() {
  const router = useRouter();
  const [requests, setRequests] = useState<Loa[]>([]);
  const [reason, setReason] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("Student");

  async function refresh() {
    const session = loadSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setName(`${session.givenName} ${session.familyName}`.trim() || "Student");
    const data = await api<{ requests: Loa[] }>("/student/leave-of-absence", {}, session.accessToken);
    setRequests(data.requests);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const session = loadSession();
    if (!session) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const data = await api<{ requests: Loa[] }>(
        "/student/leave-of-absence",
        { method: "POST", body: JSON.stringify({ reason, startsOn, endsOn }) },
        session.accessToken,
      );
      setRequests(data.requests);
      setNotice("Leave request submitted for registrar review.");
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    const session = loadSession();
    if (!session) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const data = await api<{ requests: Loa[] }>(`/student/leave-of-absence/${id}/cancel`, { method: "POST", body: "{}" }, session.accessToken);
      setRequests(data.requests); setNotice("Leave request cancelled.");
    } catch (err) { setError(err instanceof Error ? err.message : "Cancellation failed"); }
    finally { setBusy(false); }
  }

  return (
    <StudentSisShell
      title="Leave of Absence"
      subtitle="Submit a leave request for registrar review"
      activeHref="/student/leave-of-absence"
      userName={name}
    >
      <div className="mh-teacher-stack">
        {error ? <p style={{ color: "var(--mh-danger)" }}>{error}</p> : null}
        {notice ? <p className="mh-teacher-muted">{notice}</p> : null}

        <section className="mh-teacher-card">
          <h2>New request</h2>
          <form className="mh-teacher-form" onSubmit={onSubmit}>
            <div className="mh-teacher-fields">
              <label style={{ gridColumn: "1 / -1" }}>
                <span>Reason</span>
                <textarea
                  className="mh-teacher-field"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  minLength={10}
                  required
                  rows={4}
                  placeholder="Describe why you need a leave of absence…"
                />
              </label>
              <label>
                <span>Start date</span>
                <input className="mh-teacher-field" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} required />
              </label>
              <label>
                <span>End date</span>
                <input className="mh-teacher-field" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} required />
              </label>
            </div>
            <div className="mh-teacher-actions">
              <button type="submit" className="mh-teacher-btn mh-teacher-btn--primary" disabled={busy}>
                {busy ? "Submitting…" : "Submit for review"}
              </button>
            </div>
          </form>
        </section>

        <section className="mh-teacher-card">
          <h2>Your requests</h2>
          <div className="mh-teacher-list">
            {requests.map((r) => (
              <div key={r.id} className="mh-teacher-list__item">
                <div>
                  <strong>
                    {r.startsOn} → {r.endsOn}
                  </strong>
                  <span>
                    {r.reason}
                    {r.decisionNote ? ` · ${r.decisionNote}` : ""}
                  </span>
                </div>
                <span className={`mh-teacher-badge ${r.status === "approved" ? "is-active" : r.status === "rejected" ? "is-warning" : "is-info"}`}>
                  {r.status}
                </span>
                {r.status === "pending" ? <button type="button" className="mh-teacher-btn" disabled={busy} onClick={() => void cancel(r.id)}>Cancel</button> : null}
              </div>
            ))}
            {!requests.length ? <p className="mh-teacher-muted">No leave requests yet.</p> : null}
          </div>
        </section>
      </div>
    </StudentSisShell>
  );
}
