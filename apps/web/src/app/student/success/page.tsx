"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { StudentRiskAnalysis } from "@myheritage/contracts";
import { Banner, Button, StatusPill } from "@myheritage/ui";
import { api, loadSession } from "@/lib/api";
import { StudentSisShell } from "@/components/StudentSisShell";
import "@/components/student-success/studentSuccess.css";

type StudentSuccessTask = { id: string; title: string; status: string; dueAt: string | null; completedAt: string | null };
type StudentSuccessCase = {
  id: string;
  level: string;
  status: string;
  summary: string;
  ownerName: string;
  tasks: StudentSuccessTask[];
  updatedAt: string;
};

function pretty(value: string) {
  return value.replaceAll("_", " ");
}

export default function StudentSuccessPage() {
  const router = useRouter();
  const [risk, setRisk] = useState<StudentRiskAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [caseError, setCaseError] = useState<string | null>(null);
  const [cases, setCases] = useState<StudentSuccessCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [userName, setUserName] = useState("Student");

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
    api<{ items: StudentSuccessCase[] }>("/student/success/cases", {}, session.accessToken)
      .then((payload) => setCases(payload.items))
      .catch((err) => setCaseError(err instanceof Error ? err.message : "Unable to load your support cases"))
      .finally(() => setCasesLoading(false));
    api<{ answer: string; riskAnalysis?: StudentRiskAnalysis }>(
      "/ai/ask",
      {
        method: "POST",
        headers: { "Idempotency-Key": `success-${session.accountId}-${Date.now()}` },
        body: JSON.stringify({
          question: "Am I at risk academically?",
          contextPath: "/student/success",
          capability: "student_success",
        }),
      },
      session.accessToken,
    )
      .then((payload) => {
        if (payload.riskAnalysis) setRisk(payload.riskAnalysis);
        else setError(payload.answer);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load success signals"));
  }, [router]);

  return (
    <StudentSisShell
      title="Student success"
      subtitle="Explainable academic signals — not speculative labels"
      activeHref="/student/success"
      userName={userName}
    >
      <div className="mh-student-stack">
        {caseError ? <Banner tone="danger">{caseError}</Banner> : null}
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <section className="mh-sis-dash__card">
          <div className="mh-success-card__top">
            <div>
              <h2>My support cases</h2>
              <p style={{ color: "var(--mh-text-muted)", marginTop: 6 }}>Action plans assigned by your Student Success team.</p>
            </div>
            <Button variant="secondary" onClick={() => router.push("/student/advising")}>Appointments</Button>
          </div>
          {casesLoading ? <p>Loading support plan…</p> : null}
          {!casesLoading && cases.length === 0 ? <p>No active support cases have been assigned to you.</p> : null}
          {cases.length ? (
            <div className="mh-success-list" style={{ marginTop: 18 }}>
              {cases.map((item) => (
                <article className="mh-success-card" key={item.id}>
                  <div className="mh-success-card__top">
                    <h3>{item.summary}</h3>
                    <div className="mh-success-card__top">
                      <span className="mh-success-chip is-risk">{pretty(item.level)}</span>
                      <span className="mh-success-chip">{pretty(item.status)}</span>
                    </div>
                  </div>
                  <div className="mh-success-card__person">Case owner: {item.ownerName}</div>
                  {item.tasks.length ? (
                    <ul className="mh-success-tasks">
                      {item.tasks.map((task) => (
                        <li key={task.id}>
                          <span>{task.title}</span>
                          <span className="mh-success-chip">{pretty(task.status)}{task.dueAt ? ` · due ${new Date(task.dueAt).toLocaleDateString()}` : ""}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mh-success-card__body">No action-plan tasks yet.</p>}
                </article>
              ))}
            </div>
          ) : null}
        </section>
        {!risk && !error ? <p>Loading success signals…</p> : null}
        {risk ? (
          <>
            <section className="mh-sis-dash__welcome">
              <div className="mh-sis-dash__welcome-text">
                <h1>Academic attention level</h1>
                <p>{risk.explanation}</p>
              </div>
              <StatusPill tone={risk.level === "elevated" ? "danger" : risk.level === "watch" ? "warning" : "success"}>
                {risk.level}
              </StatusPill>
            </section>
            <section className="mh-sis-dash__card">
              <h2>Contributing signals</h2>
              {risk.signals.length ? (
                <ul>
                  {risk.signals.map((signal) => (
                    <li key={signal.id}>
                      <strong>{signal.label}</strong>
                      <div style={{ color: "var(--mh-text-muted)" }}>{signal.detail}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No elevated signals from current assignment and grade records.</p>
              )}
            </section>
            <section className="mh-sis-dash__card" style={{ marginTop: 20 }}>
              <h2>Recommended actions</h2>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {risk.recommendedActions.map((action) => (
                  <Button key={action.href} variant="secondary" onClick={() => router.push(action.href)}>
                    {action.label}
                  </Button>
                ))}
                <Button
                  variant="ai"
                  onClick={() =>
                    router.push("/student/ask?q=" + encodeURIComponent("Explain this risk alert"))
                  }
                >
                  Explain this alert
                </Button>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </StudentSisShell>
  );
}
