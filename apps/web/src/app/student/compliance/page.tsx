"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentSisShell } from "@/components/StudentSisShell";
import { api, loadSession } from "@/lib/api";
import "./compliance.css";

type ComplianceData = {
  summary: { activeLegalHolds: number; openPrivacyRequests: number; pendingDisposals: number };
  legalHolds: Array<{ id: string; matter: string; scope: string; placedOn: string | null; releasedOn: string | null; status: string; reason: string | null }>;
  privacyRequests: Array<{ id: string; type: string; receivedOn: string | null; dueOn: string | null; status: string; closedOn: string | null; response: string | null }>;
  disposals: Array<{ id: string; records: string; eligibleOn: string | null; status: string; disposedOn: string | null }>;
};

function date(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function tone(status: string) {
  if (["Active", "Refused", "Disposed"].includes(status)) return "danger";
  if (["Fulfilled", "Released", "Rejected"].includes(status)) return "done";
  return "pending";
}

export default function StudentCompliancePage() {
  const router = useRouter();
  const [name, setName] = useState("Student");
  const [data, setData] = useState<ComplianceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      router.replace("/login?next=/student/compliance");
      return;
    }
    setName(`${session.givenName} ${session.familyName}`.trim() || "Student");
    api<ComplianceData>("/student/compliance", {}, session.accessToken)
      .then(setData)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load privacy and record status"));
  }, [router]);

  return (
    <StudentSisShell title="" activeHref="/student/compliance" userName={name}>
      <main className="mh-compliance-page">
        <header className="mh-compliance-hero">
          <div>
            <p className="mh-compliance-kicker">MY RECORDS</p>
            <h1>Privacy &amp; Record Status</h1>
            <p>Track legal holds, privacy requests and approved record-retention activity linked to your student profile.</p>
          </div>
          <button type="button" onClick={() => router.push("/student/documents")}>Open My Documents</button>
        </header>

        {error ? <div className="mh-compliance-error">{error}</div> : null}
        {!data && !error ? <div className="mh-compliance-empty">Loading your record status…</div> : null}

        {data ? <>
          <section className="mh-compliance-metrics" aria-label="Compliance summary">
            <article><span>Active legal holds</span><strong>{data.summary.activeLegalHolds}</strong></article>
            <article><span>Open privacy requests</span><strong>{data.summary.openPrivacyRequests}</strong></article>
            <article><span>Pending disposal reviews</span><strong>{data.summary.pendingDisposals}</strong></article>
          </section>

          <section className="mh-compliance-section">
            <div className="mh-compliance-section__head"><div><span>01</span><h2>Legal holds</h2></div><p>A hold preserves the listed records and blocks disposal while active.</p></div>
            {!data.legalHolds.length ? <div className="mh-compliance-empty">No legal holds are linked to your profile.</div> : <div className="mh-compliance-grid">
              {data.legalHolds.map((item) => <article className="mh-compliance-card" key={item.id}>
                <div className="mh-compliance-card__top"><h3>{item.matter}</h3><span data-tone={tone(item.status)}>{item.status}</span></div>
                <p>{item.scope}</p>
                {item.reason ? <p className="mh-compliance-note">{item.reason}</p> : null}
                <dl><div><dt>Placed</dt><dd>{date(item.placedOn)}</dd></div><div><dt>Released</dt><dd>{date(item.releasedOn)}</dd></div></dl>
              </article>)}
            </div>}
          </section>

          <section className="mh-compliance-section">
            <div className="mh-compliance-section__head"><div><span>02</span><h2>Privacy requests</h2></div><p>Requests created for you update here as staff review and close them.</p></div>
            {!data.privacyRequests.length ? <div className="mh-compliance-empty">No privacy requests are linked to your profile.</div> : <div className="mh-compliance-grid">
              {data.privacyRequests.map((item) => <article className="mh-compliance-card" key={item.id}>
                <div className="mh-compliance-card__top"><h3>{item.type}</h3><span data-tone={tone(item.status)}>{item.status}</span></div>
                {item.response ? <p className="mh-compliance-note"><strong>Response:</strong> {item.response}</p> : <p>Campus staff have not added a response yet.</p>}
                <dl><div><dt>Received</dt><dd>{date(item.receivedOn)}</dd></div><div><dt>Due</dt><dd>{date(item.dueOn)}</dd></div><div><dt>Closed</dt><dd>{date(item.closedOn)}</dd></div></dl>
              </article>)}
            </div>}
          </section>

          <section className="mh-compliance-section">
            <div className="mh-compliance-section__head"><div><span>03</span><h2>Record disposal history</h2></div><p>A proposal never deletes your record by itself; staff approval and legal-hold checks are required.</p></div>
            {!data.disposals.length ? <div className="mh-compliance-empty">No disposal reviews are linked to your profile.</div> : <div className="mh-compliance-grid">
              {data.disposals.map((item) => <article className="mh-compliance-card" key={item.id}>
                <div className="mh-compliance-card__top"><h3>{item.records}</h3><span data-tone={tone(item.status)}>{item.status}</span></div>
                <dl><div><dt>Eligible on</dt><dd>{date(item.eligibleOn)}</dd></div><div><dt>Disposed on</dt><dd>{date(item.disposedOn)}</dd></div></dl>
              </article>)}
            </div>}
          </section>
        </> : null}
      </main>
    </StudentSisShell>
  );
}
