"use client";

import Link from "next/link";
import { useState } from "react";
import {
  activityTypeLabel,
  type SelfpacedActivity,
  type SelfpacedChapter,
} from "@/lib/selfpacedCurriculum";
import { CHAPTERS_PER_DAY, formatUnlockLabel } from "@/lib/selfpacedAuth";
import { chapterLockReason, chapterUnlockDate, isActivitySequentiallyOpen } from "@/lib/selfpacedEngine";

function typeClass(type: SelfpacedActivity["type"]) {
  return `sp-type sp-type--${type}`;
}

export function CurriculumOutline({
  chapters,
  slug,
  interactive = false,
  completedIds = [],
  unlockedChapterCount,
  nextUnlockDate = null,
  showPacing = false,
}: {
  chapters: SelfpacedChapter[];
  slug: string;
  interactive?: boolean;
  completedIds?: string[];
  /** When set (learner mode), use pass+date gate via engine. */
  unlockedChapterCount?: number;
  nextUnlockDate?: Date | null;
  showPacing?: boolean;
}) {
  const [open, setOpen] = useState<string | "ALL">("ALL");
  const pacingOn = typeof unlockedChapterCount === "number";
  const unlocked = pacingOn ? unlockedChapterCount : chapters.length;

  if (!chapters.length) {
    return <p className="sp-empty">Curriculum coming soon.</p>;
  }

  return (
    <div className="sp-curr">
      <div className="sp-curr__head">
        <div>
          <p className="sp-kicker">CURRICULUM</p>
          <h2>Full course outline</h2>
          <p className="sp-curr__meta">
            {chapters.length} chapters ·{" "}
            {chapters.reduce((n, c) => n + c.activities.length, 0)} learning items · Reading → lecture →
            practice → matching → graded assessment
          </p>
          {showPacing || pacingOn ? (
            <p className="sp-curr__pace">
              One focused chapter a day · Pass the chapter assessment to open the next
              {pacingOn ? (
                <>
                  {" "}
                  · {unlocked} of {chapters.length} open
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <button type="button" className="sp-linkish" onClick={() => setOpen(open === "ALL" ? "" : "ALL")}>
          {open === "ALL" ? "Collapse all" : "Expand all"}
        </button>
      </div>

      <div className="sp-curr__list">
        {chapters.map((ch, idx) => {
          const expanded = open === "ALL" || open === ch.id;
          const reason = pacingOn ? chapterLockReason(slug, idx) : { kind: "open" as const };
          const locked = pacingOn && reason.kind !== "open";
          const unlockAt = chapterUnlockDate(slug, idx);
          let lockLabel = "";
          if (locked && reason.kind === "date" && unlockAt) {
            lockLabel = `Opens ${formatUnlockLabel(unlockAt)}`;
          } else if (locked && reason.kind === "pass") {
            lockLabel = `Pass Chapter ${idx} to open`;
          } else if (locked && nextUnlockDate) {
            lockLabel = `Opens ${formatUnlockLabel(nextUnlockDate)}`;
          }

          return (
            <article
              key={ch.id}
              className={`sp-curr__item${expanded ? " is-open" : ""}${locked ? " is-locked" : ""}`}
            >
              <button
                type="button"
                className="sp-curr__toggle"
                onClick={() => setOpen(expanded && open !== "ALL" ? "" : ch.id)}
                aria-expanded={expanded}
              >
                <span className="sp-curr__idx">
                  Chapter {idx + 1}
                  {locked ? " · Locked" : ""}
                </span>
                <span className="sp-curr__title">{ch.title}</span>
                <span className="sp-curr__hours">
                  {locked
                    ? lockLabel || "Opens later"
                    : `${ch.hours.toFixed(1)} hrs · ${ch.activities.length} items`}
                </span>
                <span className="sp-curr__chev" aria-hidden>
                  ▾
                </span>
              </button>
              {expanded ? (
                <div className="sp-curr__body">
                  <p>{ch.summary}</p>
                  {locked ? (
                    <p className="sp-curr__lock-note">
                      {reason.kind === "pass"
                        ? `Pass Chapter ${idx} assessment first. Then this chapter opens on its unlock date (${unlockAt ? formatUnlockLabel(unlockAt) : "scheduled day"}).`
                        : `Unlocks on ${unlockAt ? formatUnlockLabel(unlockAt) : "a later study day"} (enrolment + ${idx} day${idx === 1 ? "" : "s"}). ${CHAPTERS_PER_DAY} chapter per day.`}
                    </p>
                  ) : (
                    <ul>
                      {ch.activities.map((act, ai) => {
                        const done = completedIds.includes(act.id);
                        const seqOpen =
                          !interactive || isActivitySequentiallyOpen(slug, ch, act.id) || done;
                        const row = (
                          <>
                            <span className={typeClass(act.type)}>{activityTypeLabel(act.type)}</span>
                            <span className="sp-curr__act-title">{act.title}</span>
                            <span className="sp-curr__mins">{act.minutes} min</span>
                            {done ? <span className="sp-curr__done">Done</span> : null}
                            {!seqOpen ? <span className="sp-curr__locked-act">Locked</span> : null}
                          </>
                        );
                        return (
                          <li key={act.id}>
                            {interactive && seqOpen ? (
                              <Link href={`/selfpaced/learn/${slug}/${ch.id}/${act.id}`}>{row}</Link>
                            ) : (
                              <div>{row}</div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
