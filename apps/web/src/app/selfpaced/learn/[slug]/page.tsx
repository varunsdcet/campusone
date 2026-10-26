"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CurriculumOutline } from "@/components/selfpaced/CurriculumOutline";
import { LearnerShell } from "@/components/selfpaced/LearnerShell";
import { SelfpacedCertificate } from "@/components/selfpaced/SelfpacedCertificate";
import {
  ensureCertificate,
  isCourseComplete,
  isEnrolled,
  loadProgress,
  loadSelfpacedUser,
  pruneProgressToCurriculum,
  formatUnlockLabel,
  type EnrollmentRecord,
} from "@/lib/selfpacedAuth";
import {
  allAssessmentsPassed,
  chapterUnlockDate,
  isActivitySequentiallyOpen,
  isChapterOpen,
  openChapterCount,
  todaysPlan,
} from "@/lib/selfpacedEngine";
import { flattenActivities, getCurriculum } from "@/lib/selfpacedCurriculum";
import { getSelfpacedProgram } from "@/lib/selfpacedPrograms";

export default function SelfpacedLearnCoursePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const program = getSelfpacedProgram(params.slug);
  const chapters = program ? getCurriculum(program.slug) : [];
  const [ready, setReady] = useState(false);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [openChapters, setOpenChapters] = useState(1);
  const [hasCert, setHasCert] = useState(false);
  const [enrollment, setEnrollment] = useState<EnrollmentRecord | null>(null);
  const [learnerName, setLearnerName] = useState("Learner");
  const [waitMsg, setWaitMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!program) return;
    const user = loadSelfpacedUser();
    if (!user) {
      router.replace(`/selfpaced/dashboard?auth=login&next=/selfpaced/learn/${program.slug}`);
      return;
    }
    if (!isEnrolled(program.slug)) {
      router.replace(`/selfpaced/checkout?slug=${encodeURIComponent(program.slug)}`);
      return;
    }
    setLearnerName(user.name || "Learner");
    const items = flattenActivities(program.slug);
    pruneProgressToCurriculum(
      program.slug,
      items.map((row) => row.activity.id),
    );
    setCompletedIds(loadProgress(program.slug).completedActivityIds);
    const open = openChapterCount(program.slug);
    setOpenChapters(open);
    if (isCourseComplete(program.slug, items.length) && allAssessmentsPassed(program.slug)) {
      const issued = ensureCertificate(program.slug, items.length);
      setHasCert(Boolean(issued));
      setEnrollment(issued);
    }
    const plan = todaysPlan(program.slug);
    if (!plan.activities.length && open < chapters.length) {
      const nextIdx = open;
      const reasonDate = chapterUnlockDate(program.slug, nextIdx);
      if (!isChapterOpen(program.slug, nextIdx) && open > 0) {
        setWaitMsg(
          reasonDate
            ? `Next chapter unlocks ${formatUnlockLabel(reasonDate)} — or pass Chapter ${open} if the date has arrived.`
            : "Complete today’s open work, then wait for the next unlock date.",
        );
      }
    }
    setReady(true);
  }, [program, router, chapters.length]);

  if (!program) {
    return (
      <LearnerShell>
        <div className="sp-detail sp-detail--empty">
          <h1>Course not found</h1>
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
          <p>Loading course…</p>
        </div>
      </LearnerShell>
    );
  }

  const items = flattenActivities(program.slug);
  const done = completedIds.length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const next = items.find(
    (row) =>
      !completedIds.includes(row.activity.id) &&
      isChapterOpen(program.slug, chapters.findIndex((c) => c.id === row.chapter.id)) &&
      isActivitySequentiallyOpen(program.slug, row.chapter, row.activity.id),
  );
  const complete = done >= items.length && items.length > 0 && allAssessmentsPassed(program.slug);

  return (
    <LearnerShell>
      <div className="sp-learn">
        {complete && hasCert && enrollment ? (
          <section className="sp-complete">
            <div className="sp-complete__tabs" role="tablist" aria-label="Course completion">
              <Link href={`/selfpaced/learn/${program.slug}`} role="tab" aria-selected className="is-active">
                Course
              </Link>
              <Link href={`/selfpaced/certificate/${program.slug}`} role="tab" aria-selected={false}>
                Certificate
              </Link>
            </div>
            <div className="sp-complete__grid">
              <div>
                <p className="sp-kicker">COURSE COMPLETE</p>
                <h1>You finished {program.title}</h1>
                <p className="sp-lede">
                  Every chapter assessment and the final exam are passed. Your certificate stays pinned in the sidebar —
                  open it anytime.
                </p>
                <div className="sp-hero__cta">
                  <Link href={`/selfpaced/certificate/${program.slug}`} className="sp-btn sp-btn--primary">
                    Open full certificate
                  </Link>
                  <Link href="/selfpaced/dashboard" className="sp-btn sp-btn--ghost">
                    Dashboard
                  </Link>
                </div>
              </div>
              <Link href={`/selfpaced/certificate/${program.slug}`} className="sp-complete__cert">
                <SelfpacedCertificate
                  compact
                  learnerName={learnerName}
                  programTitle={program.title}
                  hours={program.hours}
                  chapters={chapters.length}
                  issuedAt={enrollment.certificateIssuedAt || new Date().toISOString()}
                  certificateId={enrollment.certificateId || "Pending"}
                />
              </Link>
            </div>
          </section>
        ) : null}

        <div className="sp-learn__banner">
          <img src={program.image} alt="" />
          <div>
            <p className="sp-kicker sp-kicker--on-dark">{program.subject}</p>
            <h1>{program.title}</h1>
            <p className="sp-learn__flow">
              Chapter path: <strong>Reading → Reading → Lecture → Practice quiz → Matching → Chapter assessment</strong>
              . Next chapter opens only after you pass and the unlock date arrives.
            </p>
            <p>
              {done} / {items.length} activities · {pct}% · {openChapters}/{chapters.length} chapters open
            </p>
            <div className="sp-dash__bar sp-dash__bar--light">
              <div style={{ width: `${pct}%` }} />
            </div>
            {complete && hasCert ? (
              <Link href={`/selfpaced/certificate/${program.slug}`} className="sp-btn sp-btn--light">
                View premium certificate
              </Link>
            ) : next ? (
              <Link
                href={`/selfpaced/learn/${program.slug}/${next.chapter.id}/${next.activity.id}`}
                className="sp-btn sp-btn--light"
              >
                Continue · {next.activity.title}
              </Link>
            ) : (
              <p className="sp-learn__wait">{waitMsg || "Today’s open work is done."}</p>
            )}
          </div>
        </div>
        <CurriculumOutline
          chapters={chapters}
          slug={program.slug}
          interactive
          completedIds={completedIds}
          unlockedChapterCount={openChapters}
          showPacing
        />
      </div>
    </LearnerShell>
  );
}
