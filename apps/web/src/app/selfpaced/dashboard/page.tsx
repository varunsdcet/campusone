"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LearnerShell } from "@/components/selfpaced/LearnerShell";
import {
  ensureCertificate,
  isCourseComplete,
  loadAllProgress,
  loadEnrollments,
  loadProgress,
  loadSelfpacedUser,
  saveProgress,
  syncSelfpacedEnrollments,
} from "@/lib/selfpacedAuth";
import { flattenActivities, getCurriculum } from "@/lib/selfpacedCurriculum";
import { getSelfpacedProgram } from "@/lib/selfpacedPrograms";
import { openChapterCount, todaysPlan, type StudyPlan } from "@/lib/selfpacedEngine";
import { useSelfpacedCatalogue } from "@/lib/useSelfpacedCatalogue";

export default function SelfpacedDashboardPage() {
  const { programs: publishedPrograms, loading: catalogueLoading } = useSelfpacedCatalogue();
  const [enrollments, setEnrollments] = useState<string[]>([]);
  const [tick, setTick] = useState(0);
  const [name, setName] = useState("Learner");
  const [onboard, setOnboard] = useState(false);
  const [goal, setGoal] = useState("Pass the final exam and earn my certificate");
  const [hours, setHours] = useState(5);
  const [finish, setFinish] = useState("");

  useEffect(() => {
    setEnrollments(loadEnrollments());
    setName(loadSelfpacedUser()?.name || "Learner");
    void syncSelfpacedEnrollments().then((records) => setEnrollments(records.map((item) => item.slug))).catch(() => undefined);
  }, [tick]);

  const progressMap = useMemo(() => loadAllProgress(), [tick]);

  const publishedSlugs = useMemo(() => new Set(publishedPrograms.map((program) => program.slug)), [publishedPrograms]);
  const enrolledPrograms = (catalogueLoading ? [] : enrollments.filter((slug) => publishedSlugs.has(slug)))
    .map((slug) => getSelfpacedProgram(slug))
    .filter(Boolean) as NonNullable<ReturnType<typeof getSelfpacedProgram>>[];

  const primary = enrolledPrograms[0];
  const primaryChapters = primary ? getCurriculum(primary.slug) : [];
  const primaryItems = primary ? flattenActivities(primary.slug) : [];
  const primaryDone = primary ? progressMap[primary.slug]?.completedActivityIds.length || 0 : 0;
  const primaryPct = primaryItems.length ? Math.round((primaryDone / primaryItems.length) * 100) : 0;
  const openCount = primary ? openChapterCount(primary.slug) : 0;
  const plan = primary ? todaysPlan(primary.slug) : null;
  const resume = plan?.activities[0];
  const primaryComplete = primary ? isCourseComplete(primary.slug, primaryItems.length) : false;
  const studyPlan = primary ? loadProgress(primary.slug).studyPlan : undefined;

  useEffect(() => {
    if (primary && primaryComplete) ensureCertificate(primary.slug, primaryItems.length);
  }, [primary, primaryComplete, primaryItems.length]);

  useEffect(() => {
    if (primary && !loadProgress(primary.slug).studyPlan?.onboardedAt) {
      setOnboard(true);
      const d = new Date();
      d.setDate(d.getDate() + Math.max(14, primaryChapters.length));
      setFinish(d.toISOString().slice(0, 10));
    }
  }, [primary, primaryChapters.length, tick]);

  const saveStudyPlan = () => {
    if (!primary) return;
    const current = loadProgress(primary.slug);
    const next: StudyPlan = {
      goal,
      weeklyHours: hours,
      targetFinish: finish,
      onboardedAt: new Date().toISOString(),
    };
    saveProgress(primary.slug, { ...current, studyPlan: next });
    setOnboard(false);
    setTick((t) => t + 1);
  };

  const first = name.split(" ")[0];

  return (
    <LearnerShell requirePurchase={false}>
      <div className="sp-home">
        <header className="sp-home__welcome">
          <div>
            <p className="sp-home__eyebrow">Learner dashboard</p>
            <h1>Good to see you, {first}</h1>
            <p className="sp-home__sub">
              {primary
                ? primaryComplete
                  ? "Your certificate is ready — keep reviewing anytime."
                  : "One focused chapter a day. Pass the assessment to unlock the next."
                : "Browse the catalog, enroll, and your learning path will appear here."}
            </p>
          </div>
          {primary ? (
            <div className="sp-home__ring" aria-label={`${primaryPct}% complete`}>
              <svg viewBox="0 0 84 84" width="84" height="84">
                <circle cx="42" cy="42" r="36" className="sp-home__ring-bg" />
                <circle
                  cx="42"
                  cy="42"
                  r="36"
                  className="sp-home__ring-fg"
                  style={{ strokeDasharray: `${(primaryPct / 100) * 226} 226` }}
                />
              </svg>
              <span>
                <strong>{primaryPct}%</strong>
                <em>complete</em>
              </span>
            </div>
          ) : null}
        </header>

        {primary && plan && !primaryComplete ? (
          <section className="sp-home__today">
            <div>
              <p className="sp-home__eyebrow">Today</p>
              <h2>
                {plan.activities.length
                  ? `${plan.activities.length} open ${plan.activities.length === 1 ? "activity" : "activities"} · ~${plan.minutes} min`
                  : "You are caught up for today"}
              </h2>
              <p>
                {plan.weakTopic ? `Revise: ${plan.weakTopic}` : "Stay on your daily unlock pace."}
                {studyPlan ? ` · Target ${studyPlan.targetFinish}` : ""}
              </p>
            </div>
            {plan.activities[0] ? (
              <Link
                href={`/selfpaced/learn/${primary.slug}/${plan.activities[0].chapterId}/${plan.activities[0].activity.id}`}
                className="sp-btn sp-btn--primary"
              >
                Start · {plan.activities[0].activity.title}
              </Link>
            ) : (
              <Link href={`/selfpaced/learn/${primary.slug}`} className="sp-btn sp-btn--ghost">
                Course outline
              </Link>
            )}
          </section>
        ) : null}

        {primary ? (
          <section className="sp-home__continue">
            <div className="sp-home__continue-media">
              <img src={primary.image} alt="" />
            </div>
            <div className="sp-home__continue-body">
              <p className="sp-home__eyebrow">{primaryComplete ? "Completed" : "Continue learning"}</p>
              <h2>{primary.title}</h2>
              <p>
                {primaryComplete
                  ? "All chapter assessments and the final exam are passed."
                  : resume
                    ? `Next: ${resume.activity.title}`
                    : "Everything currently unlocked is done. Come back when the next chapter date opens."}
              </p>
              <div className="sp-home__meta">
                <span>
                  {openCount}/{primaryChapters.length} chapters open
                </span>
                <span>
                  {primaryDone}/{primaryItems.length} activities
                </span>
                <span>{primary.hours} hrs</span>
              </div>
              <div className="sp-home__track" aria-hidden>
                <div style={{ width: `${primaryPct}%` }} />
              </div>
              <div className="sp-home__cta">
                {primaryComplete ? (
                  <>
                    <Link href={`/selfpaced/certificate/${primary.slug}`} className="sp-btn sp-btn--primary">
                      View certificate
                    </Link>
                    <Link href={`/selfpaced/learn/${primary.slug}`} className="sp-btn sp-btn--ghost">
                      Review course
                    </Link>
                  </>
                ) : resume ? (
                  <>
                    <Link
                      href={`/selfpaced/learn/${primary.slug}/${resume.chapterId}/${resume.activity.id}`}
                      className="sp-btn sp-btn--primary"
                    >
                      Resume learning
                    </Link>
                    <Link href={`/selfpaced/learn/${primary.slug}`} className="sp-btn sp-btn--ghost">
                      Full outline
                    </Link>
                  </>
                ) : (
                  <Link href={`/selfpaced/learn/${primary.slug}`} className="sp-btn sp-btn--primary">
                    Course outline
                  </Link>
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className="sp-home__empty">
            <h2>No programs yet</h2>
            <p>Choose a Canadian workplace program and enroll to unlock your first chapter.</p>
            <Link href="/selfpaced#catalog" className="sp-btn sp-btn--primary">
              Browse programs
            </Link>
          </section>
        )}

        <section className="sp-home__courses">
          <div className="sp-home__courses-head">
            <div>
              <p className="sp-home__eyebrow">Library</p>
              <h2>Your courses</h2>
            </div>
            <div className="sp-home__courses-actions">
              <button type="button" className="sp-linkish" onClick={() => setTick((t) => t + 1)}>
                Refresh
              </button>
              <Link href="/selfpaced#catalog" className="sp-btn sp-btn--ghost sp-btn--sm">
                Add program
              </Link>
            </div>
          </div>

          {enrolledPrograms.length === 0 ? (
            <p className="sp-home__hint">Purchased courses will appear here and in the left sidebar.</p>
          ) : (
            <ul className="sp-home__list">
              {enrolledPrograms.map((p) => {
                const items = flattenActivities(p.slug);
                const done = progressMap[p.slug]?.completedActivityIds.length || 0;
                const pct = items.length ? Math.round((done / items.length) * 100) : 0;
                const finished = isCourseComplete(p.slug, items.length);
                const open = openChapterCount(p.slug);
                const chapters = getCurriculum(p.slug).length;
                const href = finished ? `/selfpaced/certificate/${p.slug}` : `/selfpaced/learn/${p.slug}`;
                return (
                  <li key={p.slug}>
                    <Link href={href} className="sp-home__row">
                      <img src={p.image} alt="" />
                      <div className="sp-home__row-body">
                        <div className="sp-home__row-top">
                          <h3>{p.title}</h3>
                          <span className={`sp-home__badge${finished ? " is-done" : ""}`}>
                            {finished ? "Certificate ready" : `${open}/${chapters} open`}
                          </span>
                        </div>
                        <p>
                          {p.subject} · {p.level} · {chapters} chapters
                        </p>
                        <div className="sp-home__row-progress">
                          <div className="sp-home__track sp-home__track--slim" aria-hidden>
                            <div style={{ width: `${pct}%` }} />
                          </div>
                          <em>{pct}%</em>
                        </div>
                      </div>
                      <span className="sp-home__row-cta">{finished ? "Certificate" : "Open"}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {onboard && primary ? (
        <div className="sp-modal" role="dialog" aria-modal="true" aria-label="Study plan onboarding">
          <button
            type="button"
            className="sp-modal__backdrop"
            aria-label="Skip for now"
            onClick={() => {
              saveStudyPlan();
            }}
          />
          <div className="sp-modal__card">
            <h2>Welcome — set your study plan</h2>
            <p className="sp-lede">Three questions so the coach can pace you against the daily unlock.</p>
            <label>
              Goal
              <input value={goal} onChange={(e) => setGoal(e.target.value)} />
            </label>
            <label>
              Weekly hours
              <input
                type="number"
                min={1}
                max={40}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value) || 5)}
              />
            </label>
            <label>
              Target finish date
              <input type="date" value={finish} onChange={(e) => setFinish(e.target.value)} />
            </label>
            <div className="sp-hero__cta">
              <button type="button" className="sp-btn sp-btn--primary" onClick={saveStudyPlan}>
                Save plan
              </button>
              <button type="button" className="sp-btn sp-btn--ghost" onClick={saveStudyPlan}>
                Skip for now
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </LearnerShell>
  );
}
