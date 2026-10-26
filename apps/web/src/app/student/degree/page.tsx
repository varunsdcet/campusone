"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { DegreePlanAnalysis, DegreeProgressResponse, WhatIfScenarioResponse } from "@myheritage/contracts";
import { Banner, Button, StatusPill } from "@myheritage/ui";
import { api, loadSession } from "@/lib/api";
import { StudentSisShell } from "@/components/StudentSisShell";

type TransferCredit = { id: string; externalCode: string; externalTitle: string; credits: number; equivalentCourse: { code: string; title: string } | null; status: string };

function StudentDegreeBody() {
  const router = useRouter();
  const search = useSearchParams();
  const [progress, setProgress] = useState<DegreePlanAnalysis | null>(null);
  const [whatIf, setWhatIf] = useState<WhatIfScenarioResponse | null>(null);
  const [dropCode, setDropCode] = useState("");
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userName, setUserName] = useState("Student");
  const [transferCredits, setTransferCredits] = useState<TransferCredit[]>([]);

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    if (!session.roles.includes("student")) {
      router.replace("/");
      return;
    }
    setUserName(`${session.givenName} ${session.familyName}`.trim() || "Student");
    api<{ items: TransferCredit[] }>("/student/transfer-credits", {}, session.accessToken)
      .then((data) => setTransferCredits(data.items))
      .catch(() => setTransferCredits([]));
    api<DegreeProgressResponse>("/student/degree-progress", {}, session.accessToken)
      .then(async (data) => {
        setLoading(false);
        if ("programAssigned" in data) {
          setEmptyMessage(data.message);
          return;
        }
        setProgress(data);
        const sample = data.remainingRequirements[0]?.code ?? data.satisfiedRequirements[0]?.code ?? "";
        setDropCode(sample);
        if (search.get("whatIf") === "1" && sample) {
          const scenario = await api<WhatIfScenarioResponse>(
            "/student/degree-scenarios",
            { method: "POST", body: JSON.stringify({ dropCourseCodes: [sample], save: false }) },
            session.accessToken,
          );
          setWhatIf(scenario);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unable to load degree progress");
        setLoading(false);
      });
  }, [router, search]);

  async function runWhatIf(event: FormEvent) {
    event.preventDefault();
    const session = loadSession();
    if (!session) return;
    setSaving(true);
    setError(null);
    try {
      const result = await api<WhatIfScenarioResponse>(
        "/student/degree-scenarios",
        {
          method: "POST",
          body: JSON.stringify({
            dropCourseCodes: dropCode.trim() ? [dropCode.trim().toUpperCase()] : [],
            save: false,
          }),
        },
        session.accessToken,
      );
      setWhatIf(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "What-if failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveScenario() {
    const session = loadSession();
    if (!session) return;
    setSaving(true);
    try {
      const result = await api<WhatIfScenarioResponse>(
        "/student/degree-scenarios",
        {
          method: "POST",
          body: JSON.stringify({
            dropCourseCodes: dropCode.trim() ? [dropCode.trim().toUpperCase()] : [],
            save: true,
            label: `Saved drop ${dropCode || "plan"}`,
          }),
        },
        session.accessToken,
      );
      setWhatIf(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const view = whatIf?.projected ?? progress;

  return (
    <StudentSisShell
      title="Degree progress"
      subtitle="Catalog requirements, prerequisites, and what-if plans"
      activeHref="/student/degree"
      userName={userName}
    >
      <div className="mh-student-stack">
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {loading ? (
          <p>Loading live degree progress…</p>
        ) : !view ? (
          error ? null : (
            <section className="mh-sis-dash__card">
              <h2>{emptyMessage ?? "No degree progress available"}</h2>
              <p style={{ color: "var(--mh-text-muted)", marginTop: 0 }}>
                Your degree requirements will appear here once you are enrolled in a program.
              </p>
              <Button variant="secondary" onClick={() => router.push("/student/advising")}>
                Book advisor
              </Button>
            </section>
          )
        ) : (
          <>
            <section className="mh-sis-dash__welcome">
              <div className="mh-sis-dash__welcome-text">
                <h1>{view.programName}</h1>
                <p>
                  Version {view.programVersionLabel} · {view.completedCredits} / {view.requiredCredits} credits
                  satisfied · projected {view.projectedCompletionTerm ?? "not determined"}
                </p>
              </div>
              <div className="mh-sis-dash__banner-actions">
                <Button
                  variant="ai"
                  onClick={() =>
                    router.push("/student/ask?q=" + encodeURIComponent("Can I graduate next summer?"))
                  }
                >
                  Ask about my degree
                </Button>
                <Button variant="secondary" onClick={() => router.push("/student/advising")}>
                  Book advisor
                </Button>
              </div>
            </section>

            <div className="mh-sis-dash__kpis">
              <div className="mh-sis-dash__kpi">
                <div className="mh-sis-dash__kpi-label">Remaining credits</div>
                <div className="mh-sis-dash__kpi-value">{view.remainingCredits}</div>
              </div>
              <div className="mh-sis-dash__kpi">
                <div className="mh-sis-dash__kpi-label">Open requirements</div>
                <div className="mh-sis-dash__kpi-value">{view.remainingRequirements.length}</div>
              </div>
              <div className="mh-sis-dash__kpi">
                <div className="mh-sis-dash__kpi-label">Prereq conflicts</div>
                <div className="mh-sis-dash__kpi-value">{view.prerequisiteConflicts.length}</div>
              </div>
            </div>

            <section className="mh-sis-dash__card" style={{ marginTop: 20 }}>
              <h2>Transfer credits</h2>
              <p style={{ color: "var(--mh-text-muted)", marginTop: 0 }}>Accepted credits satisfy the mapped degree requirement; pending credits remain under Registrar review.</p>
              {transferCredits.length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {transferCredits.map((credit) => (
                    <div key={credit.id} style={{ borderTop: "1px solid var(--mh-border)", paddingTop: 10, display: "flex", justifyContent: "space-between", gap: 16 }}>
                      <div><strong>{credit.externalCode} · {credit.externalTitle}</strong><div style={{ color: "var(--mh-text-muted)", marginTop: 3 }}>{credit.equivalentCourse ? `Equivalent: ${credit.equivalentCourse.code} · ${credit.equivalentCourse.title}` : "No internal equivalent selected"} · {credit.credits} credits</div></div>
                      <StatusPill tone={credit.status === "accepted" ? "success" : credit.status === "rejected" ? "danger" : "warning"}>{credit.status}</StatusPill>
                    </div>
                  ))}
                </div>
              ) : <p>No transfer credit evaluations on file.</p>}
            </section>

            <section className="mh-sis-dash__card" style={{ marginTop: 20 }}>
              <h2>What-if planner</h2>
              <p style={{ color: "var(--mh-text-muted)", marginTop: 0 }}>
                Scenarios do not change your official enrolment until saved as a draft plan and reviewed.
              </p>
              <form onSubmit={runWhatIf} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Drop course code</span>
                  <input value={dropCode} onChange={(e) => setDropCode(e.target.value)} placeholder="Course code" />
                </label>
                <Button type="submit" disabled={saving}>
                  {saving ? "Running…" : "Run scenario"}
                </Button>
                <Button type="button" variant="secondary" disabled={saving || !whatIf} onClick={saveScenario}>
                  Save draft scenario
                </Button>
              </form>
              {whatIf ? (
                <div style={{ marginTop: 16 }}>
                  {whatIf.scenarioId ? (
                    <StatusPill tone="success">Draft saved · {whatIf.scenarioId.slice(0, 8)}</StatusPill>
                  ) : null}
                  <ul>
                    {whatIf.impactSummary.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            {view.prerequisiteGraph.length ? (
            <section className="mh-sis-dash__card" style={{ marginTop: 20 }}>
              <h2>Prerequisite chain</h2>
              <pre
                aria-label="Prerequisite dependency graph"
                style={{
                  margin: 0,
                  padding: 16,
                  overflowX: "auto",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 13,
                  lineHeight: 1.5,
                  background: "var(--mh-surface-muted, #f6f5f8)",
                  borderRadius: 8,
                }}
              >
                {view.prerequisiteGraph
                  .map((edge) => `${edge.requiresCourseCode}\n  └─▶ ${edge.courseCode}`)
                  .join("\n\n")}
              </pre>
            </section>
            ) : null}

            <section className="mh-sis-dash__card" style={{ marginTop: 20 }}>
              <h2>Open requirements</h2>
              <div style={{ display: "grid", gap: 10 }}>
                {view.remainingRequirements.map((req) => {
                  const failed = req.status === "missing" && view.failedCourseCodes.includes(req.code.toUpperCase());
                  return (
                    <div key={req.id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <strong>
                          {req.code} · {req.title}
                        </strong>
                        <div style={{ color: "var(--mh-text-muted)", fontSize: 13 }}>
                          {req.credits} credits
                          {failed ? " · failed, retake required" : ""}
                          {req.blockedByCourseCodes.length
                            ? ` · blocked by ${req.blockedByCourseCodes.join(", ")}`
                            : ""}
                        </div>
                      </div>
                      <StatusPill
                        tone={req.status === "blocked" || failed ? "danger" : req.status === "in_progress" ? "warning" : "neutral"}
                      >
                        {failed ? "failed" : req.status.replace("_", " ")}
                      </StatusPill>
                    </div>
                  );
                })}
                {!view.remainingRequirements.length ? (
                  <p>All catalog requirements in this version are satisfied.</p>
                ) : null}
              </div>
            </section>

            <section className="mh-sis-dash__card" style={{ marginTop: 20 }}>
              <h2>Claims</h2>
              <ul>
                {view.claims.map((claim) => (
                  <li key={claim.kind + claim.text}>
                    <strong>{claim.kind.toUpperCase()}:</strong> {claim.text}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </StudentSisShell>
  );
}

export default function StudentDegreePage() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Loading degree progress…</p>}>
      <StudentDegreeBody />
    </Suspense>
  );
}
