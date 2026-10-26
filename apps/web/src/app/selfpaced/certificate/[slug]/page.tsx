"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LearnerShell } from "@/components/selfpaced/LearnerShell";
import { SelfpacedCertificate } from "@/components/selfpaced/SelfpacedCertificate";
import {
  isCourseComplete,
  isEnrolled,
  loadProgress,
  loadSelfpacedUser,
  requestCertificate,
  type EnrollmentRecord,
} from "@/lib/selfpacedAuth";
import { allAssessmentsPassed } from "@/lib/selfpacedEngine";
import { flattenActivities, getCurriculum } from "@/lib/selfpacedCurriculum";
import { getSelfpacedProgram } from "@/lib/selfpacedPrograms";

export default function SelfpacedCertificatePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const program = getSelfpacedProgram(params.slug);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("Learner");
  const [enrollment, setEnrollment] = useState<EnrollmentRecord | null>(null);
  const [finished, setFinished] = useState(false);
  const [pct, setPct] = useState(0);
  const [issue, setIssue] = useState<{ signIn: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!program) return;
    let cancelled = false;
    const user = loadSelfpacedUser();
    if (!user) {
      router.replace(`/selfpaced/dashboard?auth=login&next=/selfpaced/certificate/${program.slug}`);
      return;
    }
    if (!isEnrolled(program.slug)) {
      router.replace(`/selfpaced/programs/${program.slug}`);
      return;
    }
    const total = flattenActivities(program.slug).length;
    const done = loadProgress(program.slug).completedActivityIds.length;
    setPct(total ? Math.round((done / total) * 100) : 0);
    const complete = isCourseComplete(program.slug, total) && allAssessmentsPassed(program.slug);
    setFinished(complete);
    setName(user.name || "Learner");
    setEnrollment(null);
    setIssue(null);
    if (!complete) {
      setReady(true);
      return;
    }
    void requestCertificate(program.slug, total).then((out) => {
      if (cancelled) return;
      if (out.ok) setEnrollment(out.record);
      else setIssue({ signIn: out.reason === "sign_in", message: out.message });
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [program, router]);

  if (!program) {
    return (
      <LearnerShell>
        <div className="sp-detail sp-detail--empty">
          <h1>Program not found</h1>
          <Link href="/selfpaced/dashboard" className="sp-btn sp-btn--primary">
            Dashboard
          </Link>
        </div>
      </LearnerShell>
    );
  }

  if (!ready) {
    return (
      <LearnerShell>
        <div className="sp-learn">
          <p>Preparing certificate…</p>
        </div>
      </LearnerShell>
    );
  }

  const chapters = getCurriculum(program.slug).length;
  const unlocked = finished && Boolean(enrollment?.certificateId);

  return (
    <LearnerShell>
      <div className="sp-cert-page">
        <div className="sp-complete__tabs no-print" role="tablist" aria-label="Course completion">
          <Link href={`/selfpaced/learn/${program.slug}`} role="tab" aria-selected={false}>
            Course
          </Link>
          <Link href={`/selfpaced/certificate/${program.slug}`} role="tab" aria-selected className="is-active">
            Certificate
          </Link>
        </div>

        <div className="sp-cert-page__intro no-print">
          {unlocked ? (
            <>
              <p className="sp-kicker">CONGRATULATIONS</p>
              <h1>Your premium certificate</h1>
              <p className="sp-lede">
                Print this certificate or save it as a PDF. Share the public verification link with employers.
              </p>
              <div className="sp-hero__cta">
                <Link
                  href={`/verify/${encodeURIComponent(enrollment!.certificateId!)}`}
                  className="sp-btn sp-btn--ghost"
                >
                  Public verify page
                </Link>
                <Link href={`/selfpaced/learn/${program.slug}`} className="sp-linkish">
                  ← Back to course
                </Link>
              </div>
            </>
          ) : finished && issue ? (
            <>
              <p className="sp-kicker">COURSE COMPLETE</p>
              <h1>One more step to issue your certificate</h1>
              <p className="sp-lede" role="status">
                {issue.message}
              </p>
              <div className="sp-hero__cta">
                {issue.signIn ? (
                  <Link href={`/login?next=${encodeURIComponent(`/selfpaced/certificate/${program.slug}`)}`} className="sp-btn sp-btn--primary">
                    Sign in to issue certificate
                  </Link>
                ) : (
                  <button type="button" className="sp-btn sp-btn--primary" onClick={() => window.location.reload()}>
                    Try again
                  </button>
                )}
                <Link href={`/selfpaced/learn/${program.slug}`} className="sp-linkish">
                  ← Back to course
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="sp-kicker">YOUR CERTIFICATE</p>
              <h1>Preview — {pct}% complete</h1>
              <p className="sp-lede">
                This is how your full certificate will look. Finish every activity and pass assessments to unlock print
                and verification.
              </p>
              <div className="sp-hero__cta">
                <Link href={`/selfpaced/learn/${program.slug}`} className="sp-btn sp-btn--primary">
                  Continue course
                </Link>
              </div>
            </>
          )}
        </div>

        <SelfpacedCertificate
          locked={!unlocked}
          learnerName={name}
          programTitle={program.title}
          hours={program.hours}
          chapters={chapters}
          issuedAt={enrollment?.certificateIssuedAt || new Date().toISOString()}
          certificateId={enrollment?.certificateId || "PENDING"}
        />
      </div>
    </LearnerShell>
  );
}
