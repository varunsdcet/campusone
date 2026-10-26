"use client";

import { useState } from "react";
import type { SelfpacedActivity } from "@/lib/selfpacedCurriculum";
import { bumpCoachMessage, type CoachMode } from "@/lib/selfpacedEngine";
import { loadSelfpacedUser } from "@/lib/selfpacedAuth";

/** Lightweight grounded coach for self-paced (course content only). */
export function SelfpacedCoachPanel({
  slug,
  chapterId,
  activity,
  mode,
  chapterTitle,
}: {
  slug: string;
  chapterId: string;
  activity: SelfpacedActivity;
  mode: CoachMode;
  chapterTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [log, setLog] = useState<Array<{ role: "user" | "coach"; text: string }>>([]);
  const firstName = (loadSelfpacedUser()?.name || "Learner").split(" ")[0];

  const ask = (question: string) => {
    if (mode === "off") {
      setLog((l) => [...l, { role: "coach", text: "Coach is disabled for graded work (coach_disabled)." }]);
      return;
    }
    if (!bumpCoachMessage(slug)) {
      setLog((l) => [...l, { role: "coach", text: "Daily coach message cap reached. Try again tomorrow." }]);
      return;
    }
    const q = question.trim();
    if (!q) return;
    setLog((l) => [...l, { role: "user", text: q }]);
    setInput("");
    const reply = groundedReply(q, activity, chapterTitle, mode, firstName);
    setLog((l) => [...l, { role: "coach", text: reply }]);
  };

  if (mode === "off") return null;

  return (
    <div className="sp-coach">
      <button type="button" className="sp-coach__ask" onClick={() => setOpen((v) => !v)}>
        {open ? "Close coach" : mode === "ask_instructor" ? "Ask the instructor" : "Ask coach"}
      </button>
      {open ? (
        <div className="sp-coach__panel">
          <p className="sp-coach__mode">
            Mode: {mode === "ask_instructor" ? "Ask the instructor" : "On"} · Grounded in this chapter only
          </p>
          <div className="sp-coach__quick">
            <button type="button" onClick={() => ask("Explain this more simply")}>
              Explain simply
            </button>
            <button type="button" onClick={() => ask("Give a Canadian workplace example")}>
              Workplace example
            </button>
            <button type="button" onClick={() => ask("Quiz me on this section")}>
              Quiz me
            </button>
          </div>
          <div className="sp-coach__log" aria-live="polite">
            {log.map((m, i) => (
              <p key={`${m.role}-${i}`} className={m.role === "user" ? "is-user" : "is-coach"}>
                <strong>{m.role === "user" ? firstName : "Coach"}:</strong> {m.text}
              </p>
            ))}
          </div>
          <form
            className="sp-coach__form"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about this activity…"
              aria-label="Ask coach"
            />
            <button type="submit" className="sp-btn sp-btn--primary">
              Send
            </button>
          </form>
          <button
            type="button"
            className="sp-linkish"
            onClick={() =>
              setLog((l) => [
                ...l,
                {
                  role: "coach",
                  text: "Support ticket created with this conversation (target: 1 business day). An instructor will follow up.",
                },
              ])
            }
          >
            Ask a human
          </button>
          <span className="sp-coach__cite">
            Context: {slug} / {chapterId} / {activity.id}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function groundedReply(
  question: string,
  activity: SelfpacedActivity,
  chapterTitle: string,
  mode: CoachMode,
  firstName: string,
): string {
  const hay = `${activity.title} ${activity.html || ""} ${(activity.storyboard?.slides || [])
    .map((s) => `${s.heading} ${s.narration}`)
    .join(" ")}`.toLowerCase();
  const q = question.toLowerCase();
  const tokens = q.split(/\W+/).filter((t) => t.length > 3);
  const hits = tokens.filter((t) => hay.includes(t)).length;
  if (hits < 1 && !q.includes("explain") && !q.includes("example") && !q.includes("quiz")) {
    return `I cannot find that in the ${chapterTitle} course materials. Try rephrasing, or use Ask a human.`;
  }
  if (q.includes("quiz")) {
    return `${firstName}, check-question: What is the first step before applying this chapter’s process? (Clarify the request, then document.) Source: ${activity.title}.`;
  }
  if (q.includes("example") || q.includes("workplace")) {
    return `Canadian workplace example for “${chapterTitle}”: clarify the request, apply the chapter process, record the outcome, and confirm the next owner. Source: ${activity.title}. Follow your site procedure and supervisor for regulated steps.`;
  }
  if (mode === "hints") {
    return `Hint: revisit the reading section on core concepts in “${activity.title}”. I will not give the answer during hints mode.`;
  }
  if (activity.type === "lecture" && activity.storyboard?.slides?.length) {
    const slide = activity.storyboard.slides[0];
    return `${slide.narration.slice(0, 220)}… (Slide ${slide.number}: ${slide.heading})`;
  }
  return `Based on “${activity.title}”: follow a clear process, keep privacy-safe records, and confirm handoffs. Source: ${chapterTitle} · ${activity.title}.`;
}
