"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, loadSession, saveSession, type Session } from "@/lib/api";

type PauseCase = { id: string; title: string; detail: string; missCount: number };

export default function StudentComplianceExplainPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [cases, setCases] = useState<PauseCase[]>([]);
  const [caseId, setCaseId] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login?next=/student/compliance/explain");
      return;
    }
    setSession(s);
    api<{ paused: boolean; cases: PauseCase[] }>("/compliance/pause-status", {}, s.accessToken)
      .then((res) => {
        setCases(res.cases);
        if (res.cases[0]) setCaseId(res.cases[0].id);
        if (!res.paused && !res.cases.length) {
          router.replace("/student");
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session || !caseId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ restored?: boolean }>(
        "/compliance/explain",
        { method: "POST", body: JSON.stringify({ caseId, explanation: text }) },
        session.accessToken,
      );
      if (res.restored) {
        saveSession({ ...session, accountStatus: "active", pauseGate: false });
        setStatus("Explanation received. Access restored.");
        window.setTimeout(() => router.replace("/student"), 1200);
      } else {
        setStatus("Explanation submitted for review.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mh-hcc-page" style={{ maxWidth: 640, margin: "48px auto", padding: 24 }}>
      <h1>Access paused</h1>
      <p>
        College policy: after 3 consecutive missed class days, login is paused until you submit an explanation.
      </p>
      {cases.map((c) => (
        <div key={c.id} style={{ marginBottom: 16, padding: 12, border: "1px solid #e5e7eb" }}>
          <strong>{c.title}</strong>
          <p>{c.detail}</p>
        </div>
      ))}
      {error ? <p className="mh-teacher-warn">{error}</p> : null}
      {status ? <p className="mh-teacher-gradebook-status">{status}</p> : null}
      <form onSubmit={onSubmit}>
        {cases.length > 1 ? (
          <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
            <span>Case</span>
            <select className="mh-teacher-field" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label style={{ display: "grid", gap: 6 }}>
          <span>Your explanation</span>
          <textarea
            className="mh-teacher-field mh-teacher-field--tall"
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            minLength={10}
            placeholder="Explain the absences (illness, travel, etc.)"
          />
        </label>
        <button type="submit" className="mh-teacher-btn" style={{ marginTop: 12 }} disabled={busy || !caseId}>
          {busy ? "Submitting…" : "Submit explanation"}
        </button>
      </form>
    </div>
  );
}
