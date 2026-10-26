"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TeacherSisShell } from "@/components/TeacherSisShell";
import { api, loadSession, type Session } from "@/lib/api";

type InboxCase = {
  id: string;
  caseKind: string;
  severity: string;
  title: string;
  detail: string;
  missCount: number;
  explanation?: string | null;
  createdAt: string;
};

type Inbox = {
  title: string;
  locked: boolean;
  lockMessage: string | null;
  counts: { open: number; critical: number; warning: number };
  cases: InboxCase[];
  policy: { missWarnDays: number; missPauseDays: number };
};

export default function ComplianceInboxPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [explainId, setExplainId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [mobile, setMobile] = useState<{
    totals: { joins: number; mobile: number; desktop: number };
    rows: Array<{ id: string; joinedAt: string; clientKind: string; course: string; studentName: string }>;
  } | null>(null);

  async function refresh(s: Session) {
    const data = await api<Inbox>("/compliance/inbox", {}, s.accessToken);
    setInbox(data);
    try {
      const report = await api<typeof mobile>("/compliance/mobile-joins?days=7", {}, s.accessToken);
      setMobile(report);
    } catch {
      setMobile(null);
    }
  }

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
    void refresh(s).catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [router]);

  async function runSweep() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await api("/compliance/sweep", { method: "POST", body: "{}" }, session.accessToken);
      await refresh(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sweep failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitExplain(e: FormEvent) {
    e.preventDefault();
    if (!session || !explainId) return;
    setBusy(true);
    try {
      await api(
        "/compliance/explain",
        { method: "POST", body: JSON.stringify({ caseId: explainId, explanation: text }) },
        session.accessToken,
      );
      setExplainId(null);
      setText("");
      await refresh(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save explanation");
    } finally {
      setBusy(false);
    }
  }

  if (!session) return null;
  const userName = `${session.givenName} ${session.familyName}`.trim();

  return (
    <TeacherSisShell title="Accountability" subtitle="Attendance, grades & miss policy" activeHref="/instructor/compliance" userName={userName}>
      <div className="mh-teacher-stack">
        <div className="mh-teacher-page-head">
          <div>
            <h2>Accountability inbox</h2>
            <p>
              Policy: warning at {inbox?.policy.missWarnDays ?? 2} consecutive misses · login pause at{" "}
              {inbox?.policy.missPauseDays ?? 3}. Teacher attendance / grade SLAs lock until explained.
            </p>
          </div>
          {session.roles?.some((r) => r === "admin" || r === "registrar") ? (
            <button type="button" className="mh-teacher-btn" disabled={busy} onClick={() => void runSweep()}>
              {busy ? "Running…" : "Run policy sweep"}
            </button>
          ) : null}
        </div>

        {inbox?.locked ? <p className="mh-teacher-warn">{inbox.lockMessage}</p> : null}
        {error ? <p className="mh-teacher-warn">{error}</p> : null}

        {inbox ? (
          <div className="mh-teacher-gradebook-stats">
            <span>
              <strong>{inbox.counts.open}</strong> open
            </span>
            <span>
              <strong>{inbox.counts.critical}</strong> critical
            </span>
            <span>
              <strong>{inbox.counts.warning}</strong> warning
            </span>
          </div>
        ) : null}

        <section className="mh-teacher-card">
          <h3>Open cases</h3>
          {!inbox?.cases.length ? (
            <p className="mh-teacher-muted">No open compliance cases.</p>
          ) : (
            <div className="mh-teacher-list">
              {inbox.cases.map((c) => (
                <div key={c.id} className="mh-teacher-list__item" style={{ alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <strong>
                      [{c.severity}] {c.title}
                    </strong>
                    <span>{c.detail}</span>
                    <span className="mh-teacher-muted">
                      {c.caseKind} · {new Date(c.createdAt).toLocaleString()}
                      {c.missCount ? ` · ${c.missCount} miss day(s)` : ""}
                    </span>
                  </div>
                  <button type="button" className="mh-teacher-link" onClick={() => setExplainId(c.id)}>
                    Explain / clear
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {explainId ? (
          <section className="mh-teacher-card">
            <h3>Explanation</h3>
            <form onSubmit={submitExplain}>
              <textarea
                className="mh-teacher-field mh-teacher-field--tall"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Why was this missed / delayed?"
                required
                minLength={10}
              />
              <div className="mh-teacher-actions" style={{ marginTop: 12 }}>
                <button type="submit" className="mh-teacher-btn" disabled={busy}>
                  Submit explanation
                </button>
                <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => setExplainId(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {mobile ? (
          <section className="mh-teacher-card">
            <h3>Mobile join report (7 days)</h3>
            <p className="mh-teacher-muted">Report only — mobile joins are never blocked.</p>
            <div className="mh-teacher-gradebook-stats">
              <span>
                <strong>{mobile.totals.joins}</strong> joins
              </span>
              <span>
                <strong>{mobile.totals.mobile}</strong> mobile
              </span>
              <span>
                <strong>{mobile.totals.desktop}</strong> desktop
              </span>
            </div>
            <div className="mh-teacher-list" style={{ marginTop: 12 }}>
              {mobile.rows.slice(0, 20).map((r) => (
                <div key={r.id} className="mh-teacher-list__item">
                  <div>
                    <strong>
                      {r.studentName} · {r.course}
                    </strong>
                    <span>
                      {r.clientKind} · {new Date(r.joinedAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </TeacherSisShell>
  );
}
