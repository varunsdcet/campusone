"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  activityTypeLabel,
  type MatchingPair,
  type QuizQuestion,
  type SelfpacedActivity,
} from "@/lib/selfpacedCurriculum";
import {
  ensureCertificate,
  loadProgress,
  markActivityComplete,
} from "@/lib/selfpacedAuth";
import {
  ACTIVITY_TIMER_SECONDS,
  activityTimerReady,
  canStartAttempt,
  coachModeFor,
  drawAssessmentQuestions,
  formatTimer,
  lectureCompleteReady,
  markRemediationDone,
  PASS_MARK,
  readingCompleteReady,
  recordAssessmentAttempt,
  setActivityMeta,
} from "@/lib/selfpacedEngine";
import { SelfpacedLecturePlayer } from "@/components/selfpaced/SelfpacedLecturePlayer";
import { SelfpacedCoachWidget } from "@/components/selfpaced/SelfpacedCoachWidget";

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function LessonPlayer({
  slug,
  chapterId,
  chapterTitle,
  activity,
  backHref,
  nextHref,
  totalActivities = 0,
}: {
  slug: string;
  chapterId: string;
  chapterTitle: string;
  activity: SelfpacedActivity;
  backHref: string;
  nextHref?: string;
  totalActivities?: number;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [matchSubmitted, setMatchSubmitted] = useState(false);
  const [done, setDone] = useState(false);
  const [courseDone, setCourseDone] = useState(false);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [dwell, setDwell] = useState(0);
  const [scrolledEnd, setScrolledEnd] = useState(false);
  const [coachChecks, setCoachChecks] = useState(0);
  const [watchPct, setWatchPct] = useState(0);
  const [showChecks, setShowChecks] = useState(false);
  const [assessQs, setAssessQs] = useState<QuizQuestion[]>([]);
  const [assessStarted, setAssessStarted] = useState(false);
  const [assessResult, setAssessResult] = useState<{ score: number; passed: boolean } | null>(null);
  const proseRef = useRef<HTMLElement>(null);
  const mode = coachModeFor(activity);

  useEffect(() => {
    const progress = loadProgress(slug);
    if (progress.completedActivityIds.includes(activity.id)) setDone(true);
    const meta = progress.activityMeta?.[activity.id];
    if (meta?.dwellSeconds) setDwell(meta.dwellSeconds);
    if (meta?.scrolledEnd) setScrolledEnd(true);
    if (meta?.coachChecksCorrect) setCoachChecks(meta.coachChecksCorrect);
    if (meta?.watchPct) setWatchPct(meta.watchPct);
  }, [slug, activity.id]);

  // Universal 2-minute countdown on every activity (persists across refreshes).
  useEffect(() => {
    if (done) return;
    const tick = window.setInterval(() => {
      setDwell((s) => {
        if (s >= ACTIVITY_TIMER_SECONDS) return s;
        const next = s + 1;
        if (next % 5 === 0 || next >= ACTIVITY_TIMER_SECONDS) {
          setActivityMeta(slug, activity.id, { dwellSeconds: next });
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [activity.id, slug, done]);

  const rightOptions = useMemo(() => shuffle((activity.pairs || []).map((p) => p.right)), [activity.pairs]);

  const timerRemaining = Math.max(0, ACTIVITY_TIMER_SECONDS - dwell);
  const timerReady = timerRemaining === 0;

  const requireTimer = (): boolean => {
    const gate = activityTimerReady({ dwellSeconds: dwell });
    if (!gate.ok) {
      setBlockers(gate.missing);
      return false;
    }
    return true;
  };

  const finish = () => {
    setActivityMeta(slug, activity.id, { dwellSeconds: Math.max(dwell, ACTIVITY_TIMER_SECONDS), scrolledEnd: true });
    markActivityComplete(slug, activity.id);
    if (totalActivities > 0) {
      const issued = ensureCertificate(slug, totalActivities);
      setCourseDone(Boolean(issued));
    }
    setDone(true);
    setBlockers([]);
  };

  const complete = () => {
    if (!requireTimer()) return;
    finish();
  };

  const quizScore = useMemo(() => {
    if (!activity.questions?.length) return 0;
    let correct = 0;
    for (const q of activity.questions) {
      if (answers[q.id] === q.correct) correct += 1;
    }
    return Math.round((correct / activity.questions.length) * 100);
  }, [activity.questions, answers]);

  const matchScore = useMemo(() => {
    const pairs = activity.pairs || [];
    if (!pairs.length) return 0;
    let correct = 0;
    for (const p of pairs) {
      if (matches[p.id] === p.right) correct += 1;
    }
    return Math.round((correct / pairs.length) * 100);
  }, [activity.pairs, matches]);

  const missedPairs = useMemo(() => {
    if (!matchSubmitted) return activity.pairs || [];
    return (activity.pairs || []).filter((p) => matches[p.id] !== p.right);
  }, [activity.pairs, matches, matchSubmitted]);

  const tryCompleteReading = () => {
    const gate = readingCompleteReady(activity, { dwellSeconds: dwell, scrolledEnd: true });
    if (!gate.ok) {
      setBlockers(gate.missing);
      return;
    }
    finish();
  };

  const tryCompleteLecture = () => {
    const gate = lectureCompleteReady({ dwellSeconds: dwell, watchPct });
    if (!gate.ok) {
      setBlockers(gate.missing);
      return;
    }
    finish();
  };

  const startAssessment = () => {
    const gate = canStartAttempt(slug, chapterId, Boolean(activity.isFinal));
    if (!gate.ok) {
      setBlockers([gate.reason || "Cannot start", gate.nextAt ? `Next attempt: ${new Date(gate.nextAt).toLocaleString()}` : ""].filter(Boolean));
      return;
    }
    const bank = activity.questionBank || activity.questions || [];
    const drawn = drawAssessmentQuestions(bank, activity.questionCount || 16, `${slug}:${chapterId}:${Date.now()}`);
    setAssessQs(drawn);
    setAnswers({});
    setAssessStarted(true);
    setAssessResult(null);
    setBlockers([]);
  };

  const submitAssessment = () => {
    let correct = 0;
    for (const q of assessQs) {
      if (answers[q.id] === q.correct) correct += 1;
    }
    const score = assessQs.length ? Math.round((correct / assessQs.length) * 100) : 0;
    const state = recordAssessmentAttempt(
      slug,
      chapterId,
      score,
      assessQs.map((q) => q.id),
      Boolean(activity.isFinal),
    );
    setAssessResult({ score, passed: state.passed && score >= PASS_MARK });
    setQuizSubmitted(true);
    if (score >= PASS_MARK) {
      setActivityMeta(slug, activity.id, { bestScore: score });
      if (requireTimer()) finish();
      else setBlockers([`Passed — wait ${formatTimer(timerRemaining)} to mark complete`]);
    }
  };

  return (
    <div className={`sp-lesson${mode === "off" ? " sp-lesson--coach-off" : ""}`}>
      <div className="sp-lesson__top">
        <Link href={backHref} className="sp-linkish">
          ← Back to course
        </Link>
        <span className={`sp-type sp-type--${activity.type}`}>{activityTypeLabel(activity.type)}</span>
      </div>
      <p className="sp-kicker">{chapterTitle}</p>
      <h1>{activity.title}</h1>
      <p className="sp-lesson__mins">
        {activity.minutes} minutes
        {activity.type === "assessment" ? ` · Pass mark ${activity.passMark || PASS_MARK}% · Coach off` : null}
      </p>

      {!done ? (
        <div className={`sp-lesson__timer${timerReady ? " is-ready" : ""}`} role="status" aria-live="polite">
          {timerReady ? (
            <span>Timer done — you can mark this activity complete</span>
          ) : (
            <span>
              Complete unlocks in <strong>{formatTimer(timerRemaining)}</strong>
            </span>
          )}
        </div>
      ) : null}

      {blockers.length > 0 ? (
        <div className="sp-lesson__blockers" role="alert">
          <strong>Not complete yet</strong>
          <ul>
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {activity.type === "reading" && activity.html ? (
        <div className="sp-lesson__split">
          <div className="sp-lesson__split-main">
            <article
              ref={proseRef}
              className="sp-lesson__prose sp-lesson__prose--scroll"
              dangerouslySetInnerHTML={{ __html: activity.html }}
            />
            <p className="sp-lesson__meta">
              {timerReady ? "Timer done — mark the reading complete when finished" : `Complete unlocks in ${formatTimer(timerRemaining)}`}
            </p>
            {!done ? (
              <button
                type="button"
                className="sp-btn sp-btn--primary"
                disabled={!timerReady}
                onClick={tryCompleteReading}
              >
                {timerReady ? "Mark reading complete" : `Wait ${formatTimer(timerRemaining)}`}
              </button>
            ) : (
              <p className="sp-lesson__score">Reading complete.</p>
            )}
          </div>
          <aside className="sp-lesson__split-coach" aria-label="Ask coach">
            <SelfpacedCoachWidget
              slug={slug}
              chapterId={chapterId}
              activity={activity}
              mode={mode}
              chapterTitle={chapterTitle}
              embedded
            />
          </aside>
        </div>
      ) : null}

      {activity.type === "quiz" && activity.questions ? (
        <div className="sp-lesson__quiz">
          <div className="sp-quiz-banner">
            <div>
              <p className="sp-kicker">Practice quiz</p>
              <h2>{activity.questions.length} questions · ungraded</h2>
              <p>Unlimited retries. Use this to prepare for the graded chapter assessment.</p>
            </div>
            <span className="sp-quiz-banner__count">
              {Object.keys(answers).length}/{activity.questions.length} answered
            </span>
          </div>
          {activity.questions.map((q, idx) => (
            <QuizItem
              key={q.id}
              q={q}
              idx={idx}
              total={activity.questions!.length}
              answers={answers}
              setAnswers={setAnswers}
              submitted={quizSubmitted}
              showCoachExplain={quizSubmitted && answers[q.id] !== q.correct}
              readingHref={backHref}
            />
          ))}
          {!quizSubmitted && !done ? (
            <button
              type="button"
              className="sp-btn sp-btn--primary"
              disabled={!timerReady || Object.keys(answers).length < activity.questions.length}
              onClick={() => {
                if (!requireTimer()) return;
                setQuizSubmitted(true);
                setActivityMeta(slug, activity.id, { bestScore: quizScore });
                finish();
              }}
            >
              {!timerReady ? `Wait ${formatTimer(timerRemaining)}` : Object.keys(answers).length < activity.questions.length ? "Answer every question" : "Submit practice quiz"}
            </button>
          ) : done ? (
            <p className="sp-lesson__score">
              Quiz complete{quizSubmitted ? ` · practice score ${quizScore}%` : ""}.
            </p>
          ) : (
            <>
              <p className="sp-lesson__score">Score: {quizScore}% (ungraded — unlimited retries)</p>
              <button
                type="button"
                className="sp-btn sp-btn--ghost"
                onClick={() => {
                  setQuizSubmitted(false);
                  setAnswers({});
                }}
              >
                Retry practice
              </button>
            </>
          )}
        </div>
      ) : null}

      {activity.type === "matching" && activity.pairs ? (
        <MatchingBoard
          pairs={matchSubmitted && matchScore < 80 ? missedPairs : activity.pairs}
          rightOptions={
            matchSubmitted && matchScore < 80
              ? shuffle(missedPairs.map((p) => p.right))
              : rightOptions
          }
          matches={matches}
          setMatches={setMatches}
          submitted={matchSubmitted && matchScore >= 80}
          onSubmit={() => {
            if (!requireTimer()) return;
            const pairs = activity.pairs || [];
            if (Object.keys(matches).length < pairs.length) {
              setBlockers(["Match every item before submitting the activity"]);
              return;
            }
            let correct = 0;
            for (const p of pairs) {
              if (matches[p.id] === p.right) correct += 1;
            }
            const score = pairs.length ? Math.round((correct / pairs.length) * 100) : 0;
            setMatchSubmitted(true);
            setActivityMeta(slug, activity.id, { bestScore: score });
            finish();
          }}
          score={matchScore}
          timerReady={timerReady}
          timerLabel={timerReady ? undefined : `Wait ${formatTimer(timerRemaining)}`}
        />
      ) : null}

      {activity.type === "evaluation" && activity.evaluationRows ? (
        <div className="sp-eval">
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th>Weight</th>
              </tr>
            </thead>
            <tbody>
              {activity.evaluationRows.map((row) => (
                <tr key={row.component}>
                  <td>{row.component}</td>
                  <td>{row.weight}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!done ? (
            <button
              type="button"
              className="sp-btn sp-btn--primary"
              disabled={!timerReady}
              onClick={complete}
            >
              {timerReady ? "Mark evaluation reviewed" : `Wait ${formatTimer(timerRemaining)}`}
            </button>
          ) : (
            <p className="sp-lesson__score">Evaluation criteria reviewed.</p>
          )}
        </div>
      ) : null}

      {activity.type === "lecture" && activity.storyboard ? (
        <div className="sp-lesson__lecture">
          <p className="sp-lede">
            Watch the lecture. A 2-minute timer runs on this page — when it ends you can mark the lecture complete.
          </p>
          <SelfpacedLecturePlayer
            storyboard={activity.storyboard}
            onWatchPct={(pct) => {
              setWatchPct(pct);
              setActivityMeta(slug, activity.id, { watchPct: pct });
            }}
          />
          <div className="sp-lesson__ask-instructor">
            <h3>Ask the instructor</h3>
            <SelfpacedCoachWidget
              slug={slug}
              chapterId={chapterId}
              activity={activity}
              mode="ask_instructor"
              chapterTitle={chapterTitle}
              embedded
            />
          </div>
          {!done ? (
            <button
              type="button"
              className="sp-btn sp-btn--primary"
            disabled={!timerReady || watchPct < 90}
              onClick={tryCompleteLecture}
            >
              {!timerReady ? `Wait ${formatTimer(timerRemaining)}` : watchPct < 90 ? `Watch lecture · ${Math.round(watchPct)}% credited` : "Mark lecture complete"}
            </button>
          ) : (
            <p className="sp-lesson__score">Lecture marked complete.</p>
          )}
        </div>
      ) : null}

      {activity.type === "assessment" ? (
        <div className="sp-lesson__quiz">
          {!assessStarted ? (
            <>
              <div className="sp-quiz-banner sp-quiz-banner--graded">
                <div>
                  <p className="sp-kicker">{activity.isFinal ? "Final exam" : "Chapter assessment"}</p>
                  <h2>
                    {activity.questionCount || 16} questions · pass {activity.passMark || PASS_MARK}%
                  </h2>
                  <p>Coach is off during the attempt. Answer carefully — this score gates the next unlock.</p>
                </div>
              </div>
              <button type="button" className="sp-btn sp-btn--primary" onClick={startAssessment}>
                Start attempt
              </button>
            </>
          ) : (
            <>
              <div className="sp-quiz-banner sp-quiz-banner--graded">
                <div>
                  <p className="sp-kicker">In progress</p>
                  <h2>
                    {Object.keys(answers).length}/{assessQs.length} answered
                  </h2>
                </div>
              </div>
              {assessQs.map((q, idx) => (
                <QuizItem
                  key={q.id}
                  q={q}
                  idx={idx}
                  total={assessQs.length}
                  answers={answers}
                  setAnswers={setAnswers}
                  submitted={Boolean(assessResult)}
                  showCoachExplain={false}
                />
              ))}
              {!assessResult ? (
                <button
                  type="button"
                  className="sp-btn sp-btn--primary"
                  disabled={Object.keys(answers).length < assessQs.length}
                  onClick={submitAssessment}
                >
                  Submit assessment
                </button>
              ) : (
                <div className="sp-assess-result">
                  <p className="sp-lesson__score">
                    Score: {assessResult.score}% — {assessResult.passed ? "Passed" : "Not passed"}
                  </p>
                  {assessResult.passed && !done ? (
                    <button
                      type="button"
                      className="sp-btn sp-btn--primary"
                      disabled={!timerReady}
                      onClick={complete}
                    >
                      {timerReady ? "Mark assessment complete" : `Wait ${formatTimer(timerRemaining)}`}
                    </button>
                  ) : null}
                  {!assessResult.passed ? (
                    <button
                      type="button"
                      className="sp-btn sp-btn--ghost"
                      onClick={() => {
                        markRemediationDone(slug, chapterId);
                        setBlockers(["Remediation marked. Retake opens after the cooldown."]);
                      }}
                    >
                      Start coach remediation plan
                    </button>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      ) : null}

      {activity.type !== "reading" && activity.type !== "lecture" && mode === "off" ? (
        <p className="sp-coach-off">Coach is off for graded work.</p>
      ) : null}

      {showChecks ? (
        <CoachChecksModal
          chapterTitle={chapterTitle}
          onDone={(correct) => {
            setCoachChecks(correct);
            setActivityMeta(slug, activity.id, { coachChecksCorrect: correct });
            if (correct >= 2) {
              setShowChecks(false);
              const gate = readingCompleteReady(activity, {
                dwellSeconds: dwell,
                scrolledEnd,
                coachChecksCorrect: correct,
              });
              if (gate.ok) {
                complete();
              } else {
                setBlockers(gate.missing);
              }
            }
          }}
          onClose={() => setShowChecks(false)}
        />
      ) : null}

      <div className="sp-lesson__nav">
        {done ? (
          courseDone ? (
            <Link href={`/selfpaced/certificate/${slug}`} className="sp-btn sp-btn--primary">
              View premium certificate →
            </Link>
          ) : nextHref ? (
            <Link href={nextHref} className="sp-btn sp-btn--primary">
              Next activity →
            </Link>
          ) : (
            <Link href={backHref} className="sp-btn sp-btn--primary">
              Back to outline
            </Link>
          )
        ) : null}
      </div>
    </div>
  );
}

function QuizItem({
  q,
  idx,
  answers,
  setAnswers,
  submitted,
  showCoachExplain,
  readingHref,
  total,
}: {
  q: QuizQuestion;
  idx: number;
  answers: Record<string, number>;
  setAnswers: (fn: (prev: Record<string, number>) => Record<string, number>) => void;
  submitted: boolean;
  showCoachExplain: boolean;
  readingHref?: string;
  total?: number;
}) {
  const wrong = submitted && answers[q.id] !== q.correct;
  const picked = answers[q.id];
  return (
    <article className={`sp-q${submitted ? (wrong ? " is-wrong" : " is-right") : ""}`}>
      <header className="sp-q__head">
        <span className="sp-q__num">
          {idx + 1}
          {total ? ` / ${total}` : ""}
        </span>
        {submitted ? (
          <span className={answers[q.id] === q.correct ? "is-ok" : "is-bad"}>
            {answers[q.id] === q.correct ? "Correct" : "Review"}
          </span>
        ) : (
          <span className="sp-q__hint">Select one answer</span>
        )}
      </header>
      <h3>{q.prompt}</h3>
      <ul className="sp-q__options">
        {q.options.map((opt, oi) => {
          const selected = picked === oi;
          const showKey = submitted && oi === q.correct;
          const showMiss = submitted && selected && oi !== q.correct;
          return (
            <li key={`${q.id}-${oi}`}>
              <label
                className={[
                  selected ? "is-selected" : "",
                  showKey ? "is-key" : "",
                  showMiss ? "is-miss" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <input
                  type="radio"
                  name={q.id}
                  disabled={submitted}
                  checked={selected}
                  onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                />
                <span className="sp-q__letter" aria-hidden>
                  {String.fromCharCode(65 + oi)}
                </span>
                <span className="sp-q__text">{opt}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {showCoachExplain && wrong ? (
        <p className="sp-coach-inline">
          Coach: Re-read the chapter process, then try again. The correct option follows the documented workplace
          standard{readingHref ? " — open the course outline to revisit the reading" : ""}.
        </p>
      ) : null}
    </article>
  );
}

function CoachChecksModal({
  chapterTitle,
  onDone,
  onClose,
}: {
  chapterTitle: string;
  onDone: (correct: number) => void;
  onClose: () => void;
}) {
  const checks = [
    {
      id: "c1",
      prompt: `What should you do first when applying ideas from “${chapterTitle}”?`,
      options: ["Guess the outcome", "Clarify the request and follow the process", "Skip documentation"],
      correct: 1,
    },
    {
      id: "c2",
      prompt: "Why keep a short record of what you did?",
      options: ["It is optional fluff", "It protects clients, staff, and the organization", "Only managers care"],
      correct: 1,
    },
    {
      id: "c3",
      prompt: "If a step is safety-critical, you should:",
      options: ["Improvise", "Follow course text plus site procedure and your supervisor", "Ask social media"],
      correct: 1,
    },
  ];
  const [ans, setAns] = useState<Record<string, number>>({});
  const [result, setResult] = useState<number | null>(null);
  const allAnswered = checks.every((c) => typeof ans[c.id] === "number");

  return (
    <div className="sp-modal" role="dialog" aria-modal="true" aria-label="Comprehension checks">
      <button type="button" className="sp-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="sp-modal__card">
        <h2>Coach check · get 2 of 3 correct</h2>
        <p className="sp-lede">Answer all three, then submit. You can retry if you need another try.</p>
        {checks.map((c, i) => (
          <article key={c.id} className="sp-q">
            <h3>Check {i + 1}</h3>
            <p>{c.prompt}</p>
            <ul>
              {c.options.map((opt, oi) => (
                <li key={opt}>
                  <label className={ans[c.id] === oi ? "is-selected" : ""}>
                    <input
                      type="radio"
                      name={c.id}
                      checked={ans[c.id] === oi}
                      onChange={() => {
                        setResult(null);
                        setAns((p) => ({ ...p, [c.id]: oi }));
                      }}
                    />
                    <span>{opt}</span>
                  </label>
                </li>
              ))}
            </ul>
          </article>
        ))}
        {result !== null ? (
          <p className={result >= 2 ? "sp-lesson__score" : "sp-error"}>
            {result >= 2
              ? `Passed with ${result}/3 — continuing…`
              : `You got ${result}/3. Need at least 2 correct — adjust answers and submit again.`}
          </p>
        ) : null}
        <div className="sp-hero__cta">
          <button
            type="button"
            className="sp-btn sp-btn--primary"
            disabled={!allAnswered}
            onClick={() => {
              let n = 0;
              for (const c of checks) if (ans[c.id] === c.correct) n += 1;
              setResult(n);
              onDone(n);
            }}
          >
            Submit checks
          </button>
          <button type="button" className="sp-btn sp-btn--ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function MatchingBoard({
  pairs,
  rightOptions,
  matches,
  setMatches,
  submitted,
  onSubmit,
  score,
  timerReady = true,
  timerLabel,
}: {
  pairs: MatchingPair[];
  rightOptions: string[];
  matches: Record<string, string>;
  setMatches: (v: Record<string, string>) => void;
  submitted: boolean;
  onSubmit: () => void;
  score: number;
  timerReady?: boolean;
  timerLabel?: string;
}) {
  return (
    <div className="sp-match">
      <p className="sp-lede">Match each term on the left with the correct definition. Pass mark 80%.</p>
      <ul>
        {pairs.map((p) => (
          <li key={p.id}>
            <span className="sp-match__left">{p.left}</span>
            <select
              disabled={submitted}
              value={matches[p.id] || ""}
              onChange={(e) => setMatches({ ...matches, [p.id]: e.target.value })}
              aria-label={`Match for ${p.left}`}
            >
              <option value="">Select…</option>
              {rightOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {submitted ? (
              <span className={matches[p.id] === p.right ? "is-ok" : "is-bad"}>
                {matches[p.id] === p.right ? "✓" : "✗"}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {!submitted ? (
        <button
          type="button"
          className="sp-btn sp-btn--primary"
          disabled={!timerReady}
          onClick={onSubmit}
        >
          {timerReady ? "Mark matching complete" : timerLabel || "Wait for timer"}
        </button>
      ) : (
        <p className="sp-lesson__score">Score: {score}%</p>
      )}
    </div>
  );
}
