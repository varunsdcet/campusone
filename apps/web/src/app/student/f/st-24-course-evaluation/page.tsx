"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@myheritage/ui";
import { StudentFrame } from "@/components/StudentSisShell";
import { api, loadSession, type Session } from "@/lib/api";

type Evaluation = {
  id: string;
  courseCode: string;
  courseTitle: string;
  sectionId: string | null;
  status: "pending" | "submitted";
  dueAt: string | null;
  submittedAt: string | null;
  overallRating: number | null;
  responses: {
    teachingQuality?: number;
    courseMaterials?: number;
    workload?: number;
    comments?: string;
  } | null;
};

function RatingRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mh-student-eval__rating">
      <span>{label}</span>
      <div className="mh-student-eval__stars" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            className={`mh-student-eval__star${value >= n ? " is-on" : ""}`}
            aria-pressed={value === n}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function CourseEvaluationInner() {
  const router = useRouter();
  const params = useSearchParams();
  const evaluationId = params.get("evaluationId");
  const [session, setSession] = useState<Session | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [overallRating, setOverallRating] = useState(0);
  const [teachingQuality, setTeachingQuality] = useState(0);
  const [courseMaterials, setCourseMaterials] = useState(0);
  const [workload, setWorkload] = useState(0);
  const [comments, setComments] = useState("");

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
  }, [router]);

  useEffect(() => {
    if (!session || !evaluationId) {
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api<{ evaluation: Evaluation }>(
          `/student/evaluations/${evaluationId}`,
          {},
          session.accessToken,
        );
        const ev = res.evaluation;
        setEvaluation(ev);
        setOverallRating(ev.overallRating ?? 0);
        setTeachingQuality(ev.responses?.teachingQuality ?? 0);
        setCourseMaterials(ev.responses?.courseMaterials ?? 0);
        setWorkload(ev.responses?.workload ?? 0);
        setComments(ev.responses?.comments ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load evaluation");
      } finally {
        setLoading(false);
      }
    })();
  }, [session, evaluationId]);

  async function submit() {
    if (!session || !evaluationId) return;
    if (!overallRating || !teachingQuality || !courseMaterials || !workload) {
      setError("Please rate all categories before submitting.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ evaluation: Evaluation }>(
        `/student/evaluations/${evaluationId}/submit`,
        {
          method: "POST",
          body: JSON.stringify({
            overallRating,
            teachingQuality,
            courseMaterials,
            workload,
            comments: comments.trim() || undefined,
          }),
        },
        session.accessToken,
      );
      setEvaluation(res.evaluation);
      setNotice("Evaluation submitted. Thank you for your feedback.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  const submitted = evaluation?.status === "submitted";

  return (
    <StudentFrame
      role="student"
      title="Course evaluation"
      subtitle="Share feedback for a completed course block"
      breadcrumb={["Student", "Home", "Course evaluation"]}
      activeHref="/student"
    >
      {error ? <div className="mh-student-mail__banner is-danger">{error}</div> : null}
      {notice ? <div className="mh-student-mail__banner is-success">{notice}</div> : null}

      {!evaluationId ? (
        <div className="mh-teacher-card">
          <EmptyState
            title="No evaluation selected"
            body="Open a pending evaluation from your student home feed."
          />
          <button type="button" className="mh-teacher-btn mh-teacher-btn--primary" onClick={() => router.push("/student")}>
            Back to dashboard
          </button>
        </div>
      ) : loading ? (
        <div className="mh-teacher-card">
          <EmptyState title="Loading" body="Fetching your evaluation form." />
        </div>
      ) : !evaluation ? (
        <div className="mh-teacher-card">
          <EmptyState title="Evaluation unavailable" body="This evaluation was not found for your account." />
          <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => router.push("/student")}>
            Back to dashboard
          </button>
        </div>
      ) : (
        <div className="mh-student-eval">
          <section className="mh-teacher-card mh-student-eval__hero">
            <span className="mh-student-course-card__code">{evaluation.courseCode}</span>
            <h2>{evaluation.courseTitle}</h2>
            <p className="mh-teacher-muted">
              {submitted
                ? `Submitted ${evaluation.submittedAt ? new Date(evaluation.submittedAt).toLocaleString() : ""}`
                : evaluation.dueAt
                  ? `Due ${new Date(evaluation.dueAt).toLocaleString()}`
                  : "Pending your feedback"}
            </p>
            <span className={`mh-teacher-pill${submitted ? " is-success" : " is-warning"}`}>
              {evaluation.status}
            </span>
          </section>

          <section className="mh-teacher-card">
            <h2>{submitted ? "Your responses" : "Rate this course"}</h2>
            <p className="mh-teacher-muted">
              Ratings are confidential and used to improve teaching and materials.
            </p>
            <div className="mh-student-eval__form">
              <RatingRow label="Overall" value={overallRating} onChange={setOverallRating} disabled={submitted} />
              <RatingRow label="Teaching quality" value={teachingQuality} onChange={setTeachingQuality} disabled={submitted} />
              <RatingRow label="Course materials" value={courseMaterials} onChange={setCourseMaterials} disabled={submitted} />
              <RatingRow label="Workload balance" value={workload} onChange={setWorkload} disabled={submitted} />
              <label className="mh-teacher-fields">
                <span>Comments (optional)</span>
                <textarea
                  className="mh-teacher-field mh-teacher-field--tall"
                  rows={5}
                  value={comments}
                  disabled={submitted}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="What worked well? What could improve?"
                />
              </label>
            </div>
            <div className="mh-student-eval__actions">
              {!submitted ? (
                <button
                  type="button"
                  className="mh-teacher-btn mh-teacher-btn--primary"
                  disabled={busy}
                  onClick={() => void submit()}
                >
                  {busy ? "Submitting…" : "Submit evaluation"}
                </button>
              ) : null}
              <button
                type="button"
                className="mh-teacher-btn mh-teacher-btn--secondary"
                onClick={() => router.push("/student")}
              >
                Back to dashboard
              </button>
            </div>
          </section>
        </div>
      )}
    </StudentFrame>
  );
}

export default function CourseEvaluationPage() {
  return (
    <Suspense
      fallback={
        <div className="mh-teacher-card" style={{ margin: 24 }}>
          <EmptyState title="Loading" body="Opening course evaluation…" />
        </div>
      }
    >
      <CourseEvaluationInner />
    </Suspense>
  );
}
