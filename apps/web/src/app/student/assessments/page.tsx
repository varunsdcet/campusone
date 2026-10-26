"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { StudentAssessmentsResponse } from "@myheritage/contracts";
import { Banner, Button, EmptyState, StatusPill } from "@myheritage/ui";
import { StudentFrame } from "@/components/StudentSisShell";
import { ApiError, api, loadSession, type Session } from "@/lib/api";

type Assessment = StudentAssessmentsResponse["assessments"][number];
type AttemptQuestion = { id: string; prompt: string; options: string[] };
type ActiveAttempt = { attemptId: string; expiresAt: string; questions: AttemptQuestion[] };
type LoadState = "loading" | "ready" | "offline" | "forbidden" | "error";

function formatDate(value: string | null | undefined) {
  if (!value) return "No date set";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusTone(state: Assessment["state"]): "neutral" | "success" | "warning" | "danger" {
  if (state === "submitted") return "success";
  if (state === "in_progress") return "warning";
  if (state === "closed") return "danger";
  if (state === "open") return "success";
  return "neutral";
}

export default function StudentAssessmentsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading assessments…</div>}>
      <StudentAssessmentsInner />
    </Suspense>
  );
}

function StudentAssessmentsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlId = searchParams.get("id");

  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<StudentAssessmentsResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(urlId);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeAttempt, setActiveAttempt] = useState<ActiveAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  useEffect(() => {
    setSelectedId(urlId);
  }, [urlId]);

  const refresh = useCallback(async (active: Session, opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoadState("loading");
      setError(null);
    }
    try {
      setData(await api<StudentAssessmentsResponse>("/student/assessments", {}, active.accessToken));
      setLoadState("ready");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }
      if (caught instanceof ApiError && caught.status === 403) {
        setLoadState("forbidden");
        return;
      }
      if ((typeof navigator !== "undefined" && !navigator.onLine) || caught instanceof TypeError) {
        setLoadState("offline");
        return;
      }
      setError(caught instanceof Error ? caught.message : "Could not load assessments.");
      setLoadState("error");
    }
  }, [router]);

  useEffect(() => {
    const active = loadSession();
    if (!active) {
      router.replace("/login");
      return;
    }
    if (!active.roles.includes("student")) {
      setLoadState("forbidden");
      return;
    }
    setSession(active);
    void refresh(active);
  }, [refresh, router]);

  const assessments = data?.assessments ?? [];
  const selected = useMemo(
    () => assessments.find((row) => row.id === selectedId) ?? null,
    [assessments, selectedId],
  );

  function openAssessment(id: string) {
    setNotice(null);
    setActionError(null);
    setActiveAttempt(null);
    setAnswers({});
    setSelectedId(id);
    router.replace(`/student/assessments?id=${encodeURIComponent(id)}`, { scroll: false });
  }

  function backToList() {
    setNotice(null);
    setActionError(null);
    setSelectedId(null);
    router.replace("/student/assessments", { scroll: false });
  }

  async function startAttempt(assessment: Assessment) {
    if (!session) return;
    setBusy(true);
    setNotice(null);
    setActionError(null);
    try {
      const result = await api<ActiveAttempt>(
        `/student/assessments/${assessment.id}/start`,
        { method: "POST", body: "{}" },
        session.accessToken,
      );
      setActiveAttempt(result);
      setAnswers({});
      await refresh(session, { silent: true });
      setNotice(`Attempt started. Submit before ${formatDate(result.expiresAt)}.`);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not start attempt");
    } finally {
      setBusy(false);
    }
  }

  async function submitAttempt(assessment: Assessment) {
    const attemptId = activeAttempt?.attemptId ?? assessment.openAttemptId;
    if (!session || !attemptId || !activeAttempt) return;
    setBusy(true);
    setNotice(null);
    setActionError(null);
    try {
      const result = await api<{ attemptId: string; status: string; submittedAt: string; score: number; maxScore: number }>(
        `/student/assessments/attempts/${attemptId}/submit`,
        { method: "POST", body: JSON.stringify({ answers }) },
        session.accessToken,
      );
      await refresh(session, { silent: true });
      setActiveAttempt(null);
      setAnswers({});
      setNotice(`Assessment submitted at ${formatDate(result.submittedAt)}. Score: ${result.score}/${result.maxScore}.`);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not submit attempt");
    } finally {
      setBusy(false);
    }
  }

  if (!session && loadState === "loading") return null;

  return (
    <StudentFrame
      role="student"
      title="Assessments"
      subtitle="Timed quizzes and exams for your enrolled courses"
      breadcrumb={["Student", "Assessments"]}
      activeHref="/student/assessments"
    >
      {actionError ? <Banner tone="danger">{actionError}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      {loadState !== "ready" && !data ? (
        <section className="mh-teacher-card">
          <EmptyState
            title={
              loadState === "loading"
                ? "Loading"
                : loadState === "offline"
                  ? "You're offline"
                  : loadState === "forbidden"
                    ? "Permission denied"
                    : "Something went wrong"
            }
            body={
              loadState === "loading"
                ? "Fetching your latest assessments."
                : loadState === "offline"
                  ? "Reconnect and try again."
                  : loadState === "forbidden"
                    ? "This page is available only to the signed-in student."
                    : (error ?? "The page could not be loaded.")
            }
          />
          {loadState === "offline" || loadState === "error" ? (
            <Button type="button" onClick={() => session && void refresh(session)}>
              Try again
            </Button>
          ) : null}
        </section>
      ) : selected ? (
        <AssessmentDetail
          assessment={selected}
          attemptOpen={Boolean(data?.assessmentAttemptOpen)}
          busy={busy}
          activeAttempt={activeAttempt}
          answers={answers}
          onAnswer={(questionId, option) => setAnswers((current) => ({ ...current, [questionId]: option }))}
          onBack={backToList}
          onStart={() => void startAttempt(selected)}
          onSubmit={() => void submitAttempt(selected)}
        />
      ) : (
        <AssessmentList assessments={assessments} onOpen={openAssessment} />
      )}
    </StudentFrame>
  );
}

function AssessmentList({
  assessments,
  onOpen,
}: {
  assessments: Assessment[];
  onOpen: (id: string) => void;
}) {
  if (!assessments.length) {
    return (
      <section className="mh-teacher-card">
        <EmptyState title="No published assessments" body="When your instructor publishes a quiz or exam, it will appear here." />
      </section>
    );
  }

  return (
    <section className="mh-teacher-card">
      <div className="mh-teacher-card__head">
        <h2>Assigned</h2>
        <StatusPill tone="neutral">{assessments.length}</StatusPill>
      </div>
      <div className="mh-teacher-list">
        {assessments.map((row) => (
          <button
            key={row.id}
            type="button"
            className="mh-teacher-list__item mh-teacher-list__item--btn mh-student-assess-row"
            onClick={() => onOpen(row.id)}
          >
            <div>
              <strong>{row.title}</strong>
              <span>
                {row.courseCode} · {row.durationMinutes} min · closes {formatDate(row.closesAt)}
              </span>
            </div>
            <div className="mh-student-assess-row__meta">
              <StatusPill tone={statusTone(row.state)}>{row.state.replace("_", " ")}</StatusPill>
              <span className="mh-student-assess-row__open">Open →</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function AssessmentDetail({
  assessment,
  attemptOpen,
  busy,
  activeAttempt,
  answers,
  onAnswer,
  onBack,
  onStart,
  onSubmit,
}: {
  assessment: Assessment;
  attemptOpen: boolean;
  busy: boolean;
  activeAttempt: ActiveAttempt | null;
  answers: Record<string, number>;
  onAnswer: (questionId: string, option: number) => void;
  onBack: () => void;
  onStart: () => void;
  onSubmit: () => void;
}) {
  const canStart = assessment.state === "open" && !assessment.openAttemptId;
  const canSubmit = Boolean(assessment.openAttemptId);
  const isSubmitted = assessment.state === "submitted";
  const isClosed = assessment.state === "closed" || assessment.state === "upcoming";
  const hasPriorSubmit = assessment.attemptCount > 0 && !canSubmit;

  return (
    <div className="mh-student-assign">
      <div className="mh-student-assign__toolbar">
        <button type="button" className="mh-teacher-link" onClick={onBack}>
          ← All assessments
        </button>
      </div>

      <div className="mh-teacher-dash__kpis">
        <div className="mh-teacher-dash__kpi">
          <div className="mh-teacher-dash__kpi-label">Status</div>
          <div className="mh-teacher-dash__kpi-value" style={{ fontSize: 22, textTransform: "capitalize" }}>
            {assessment.state.replace("_", " ")}
          </div>
          <div className="mh-teacher-dash__kpi-hint">{assessment.courseCode}</div>
        </div>
        <div className="mh-teacher-dash__kpi">
          <div className="mh-teacher-dash__kpi-label">Duration</div>
          <div className="mh-teacher-dash__kpi-value">{assessment.durationMinutes}</div>
          <div className="mh-teacher-dash__kpi-hint">Minutes</div>
        </div>
        <div className="mh-teacher-dash__kpi">
          <div className="mh-teacher-dash__kpi-label">Attempts</div>
          <div className="mh-teacher-dash__kpi-value">
            {assessment.attemptCount}/{assessment.maxAttempts}
          </div>
          <div className="mh-teacher-dash__kpi-hint">Used / allowed</div>
        </div>
        <div className="mh-teacher-dash__kpi">
          <div className="mh-teacher-dash__kpi-label">Closes</div>
          <div className="mh-teacher-dash__kpi-value" style={{ fontSize: 18 }}>
            {formatDate(assessment.closesAt)}
          </div>
          <div className="mh-teacher-dash__kpi-hint">Opens {formatDate(assessment.opensAt)}</div>
        </div>
      </div>

      <div className="mh-teacher-detail__grid">
        <section className="mh-teacher-card">
          <div className="mh-teacher-card__head">
            <h2>Assessment</h2>
            <StatusPill tone={statusTone(assessment.state)}>{assessment.state.replace("_", " ")}</StatusPill>
          </div>
          <div className="mh-teacher-section">
            <div className="mh-teacher-section__label">OVERVIEW</div>
            <div className="mh-teacher-fields">
              <label>
                <span>Course</span>
                <div className="mh-teacher-field">{assessment.courseCode}</div>
              </label>
              <label>
                <span>Title</span>
                <div className="mh-teacher-field">{assessment.title}</div>
              </label>
              <label>
                <span>Window</span>
                <div className="mh-teacher-field">
                  {formatDate(assessment.opensAt)} → {formatDate(assessment.closesAt)}
                </div>
              </label>
              <label>
                <span>Rules</span>
                <div className="mh-teacher-field">
                  {assessment.durationMinutes} minute timed attempt · max {assessment.maxAttempts} attempt
                  {assessment.maxAttempts === 1 ? "" : "s"}
                </div>
              </label>
            </div>
          </div>
          {isSubmitted ? (
            <div
              className="mh-teacher-banner"
              style={{ background: "#e8f5ee", borderColor: "rgba(1,127,63,0.22)", color: "#2563EB" }}
            >
              This assessment has been submitted. Your instructor will publish results when grading is complete.
            </div>
          ) : null}
          {hasPriorSubmit && canStart ? (
            <div
              className="mh-teacher-banner"
              style={{ background: "#e8f5ee", borderColor: "rgba(1,127,63,0.22)", color: "#2563EB" }}
            >
              Previous attempt submitted. You still have {assessment.maxAttempts - assessment.attemptCount} attempt
              {assessment.maxAttempts - assessment.attemptCount === 1 ? "" : "s"} remaining.
            </div>
          ) : null}
          {attemptOpen && canSubmit ? (
            <div
              className="mh-teacher-banner"
              style={{ background: "#fff8e6", borderColor: "rgba(180,130,20,0.28)", color: "#8a6a10" }}
            >
              Attempt in progress — AI Study Coach is paused until you submit.
            </div>
          ) : null}
        </section>

        <section className="mh-teacher-card mh-student-assign__submit">
          <div className="mh-teacher-card__head">
            <h2>Your attempt</h2>
            <StatusPill tone={statusTone(assessment.state)}>{assessment.state.replace("_", " ")}</StatusPill>
          </div>

          {canStart ? (
            <>
              <p className="mh-teacher-muted" style={{ marginTop: 0 }}>
                Starting begins a timed attempt. Submit before the timer expires.
              </p>
              <div className="mh-teacher-actions">
                <button
                  type="button"
                  className="mh-teacher-btn mh-teacher-btn--primary"
                  disabled={busy}
                  onClick={onStart}
                >
                  {busy ? "Starting…" : "Start attempt"}
                </button>
              </div>
            </>
          ) : null}

          {canSubmit ? (
            <>
              <p className="mh-teacher-muted" style={{ marginTop: 0 }}>
                Your attempt is open. Submit when you are finished. This cannot be undone.
              </p>
              {!activeAttempt ? (
                <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" disabled={busy} onClick={onStart}>
                  {busy ? "Loading…" : "Resume attempt"}
                </button>
              ) : (
                <div className="mh-teacher-stack">
                  <p className="mh-teacher-muted">Submit before {formatDate(activeAttempt.expiresAt)}.</p>
                  {activeAttempt.questions.map((question, questionIndex) => (
                    <fieldset key={question.id} className="mh-teacher-section">
                      <legend><strong>{questionIndex + 1}. {question.prompt}</strong></legend>
                      {question.options.map((option, optionIndex) => (
                        <label key={`${question.id}-${optionIndex}`} style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <input
                            type="radio"
                            name={`answer-${question.id}`}
                            checked={answers[question.id] === optionIndex}
                            onChange={() => onAnswer(question.id, optionIndex)}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </fieldset>
                  ))}
                </div>
              )}
              <div className="mh-teacher-actions">
                <button
                  type="button"
                  className="mh-teacher-btn mh-teacher-btn--primary"
                  disabled={busy || !activeAttempt || activeAttempt.questions.some((question) => answers[question.id] === undefined)}
                  onClick={onSubmit}
                >
                  {busy ? "Submitting…" : "Submit attempt"}
                </button>
              </div>
            </>
          ) : null}

          {isSubmitted ? (
            <p className="mh-teacher-muted" style={{ margin: 0 }}>
              Submission locked. Contact your instructor if a resubmission window is needed.
            </p>
          ) : null}

          {isClosed && !isSubmitted && !canStart && !canSubmit ? (
            <p className="mh-teacher-muted" style={{ margin: 0 }}>
              {assessment.state === "upcoming"
                ? `This assessment opens ${formatDate(assessment.opensAt)}.`
                : "The assessment window is closed and no submission was recorded."}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
