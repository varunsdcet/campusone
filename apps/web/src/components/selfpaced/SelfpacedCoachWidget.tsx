"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import type { SelfpacedActivity } from "@/lib/selfpacedCurriculum";
import { bumpCoachMessage, openChapterCount, type CoachMode } from "@/lib/selfpacedEngine";
import { loadEnrollments, loadSelfpacedUser } from "@/lib/selfpacedAuth";
import { getSelfpacedProgram } from "@/lib/selfpacedPrograms";
import { loadSession } from "@/lib/api";

type Msg = { role: "user" | "coach"; text: string };

type Props = {
  slug?: string;
  chapterId?: string;
  activity?: SelfpacedActivity | null;
  mode?: CoachMode;
  chapterTitle?: string;
  /** Compact panel under lesson (no FAB). */
  embedded?: boolean;
  defaultOpen?: boolean;
};

/** Floating Ask Coach chatbot — answers from purchased + unlocked chapters only. */
export function SelfpacedCoachWidget({
  slug,
  chapterId,
  activity,
  mode = "on",
  chapterTitle,
  embedded = false,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [input, setInput] = useState("");
  const [log, setLog] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const firstName = (loadSelfpacedUser()?.name || "Learner").split(" ")[0];

  const enrolledScope = useMemo(() => {
    const slugs = loadEnrollments();
    return slugs
      .map((s) => ({
        slug: s,
        openChapterCount: openChapterCount(s),
        title: getSelfpacedProgram(s)?.title || s,
      }))
      .filter((e) => e.openChapterCount > 0);
  }, [slug, open, log.length]);

  const libraryLabel = useMemo(() => {
    if (!enrolledScope.length) return "No unlocked purchases yet";
    return enrolledScope.map((e) => `${e.title} · ${e.openChapterCount} ch open`).join(" · ");
  }, [enrolledScope]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("sp-open-coach", onOpen);
    return () => window.removeEventListener("sp-open-coach", onOpen);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [log, busy, open]);

  if (mode === "off") {
    if (!embedded) return null;
    return <p className="sp-coach-off">Coach is off during graded assessments.</p>;
  }

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const capSlug = slug || enrolledScope[0]?.slug;
    if (capSlug && !bumpCoachMessage(capSlug)) {
      setError("Daily coach message limit reached. Try again tomorrow.");
      return;
    }
    setError(null);
    setLog((l) => [...l, { role: "user", text: q }]);
    setInput("");
    setBusy(true);
    try {
      const accessToken = loadSession()?.accessToken;
      if (!accessToken) throw new Error("Sign in to use the course coach.");
      const res = await fetch("/api/selfpaced/coach/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          question: q,
          slug: slug || enrolledScope[0]?.slug,
          chapterId,
          activityId: activity?.id,
          mode,
          firstName,
          enrolled: enrolledScope.map((e) => ({
            slug: e.slug,
            openChapterCount: e.openChapterCount,
          })),
        }),
      });
      const data = (await res.json()) as { answer?: string; error?: string; code?: string };
      if (!res.ok) {
        setLog((l) => [
          ...l,
          {
            role: "coach",
            text: data.error || (data.code === "coach_disabled" ? "Coach is disabled." : "Could not answer."),
          },
        ]);
        return;
      }
      setLog((l) => [...l, { role: "coach", text: data.answer || "No answer returned." }]);
    } catch (err) {
      setLog((l) => [
        ...l,
        { role: "coach", text: err instanceof Error ? err.message : "Network error talking to coach." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const panel = (
    <div className={`sp-coach-widget__panel${embedded ? " is-embedded" : ""}`}>
      <header className="sp-coach-widget__head">
        <div>
          <strong>{mode === "ask_instructor" ? "Ask the instructor" : "Ask coach"}</strong>
          <span>
            {chapterTitle || activity?.title
              ? `About: ${activity?.title || chapterTitle}`
              : "Your unlocked course content"}
          </span>
          <span className="sp-coach-widget__lib">{libraryLabel}</span>
        </div>
        <button type="button" className="sp-coach-widget__x" onClick={() => setOpen(false)} aria-label="Hide coach">
          Hide
        </button>
      </header>
      <div className="sp-coach-widget__quick">
        <button type="button" disabled={busy} onClick={() => void ask("Explain this more simply")}>
          Explain simply
        </button>
        <button type="button" disabled={busy} onClick={() => void ask("Give a Canadian workplace example")}>
          Workplace example
        </button>
        <button type="button" disabled={busy} onClick={() => void ask("Quiz me on this section")}>
          Quiz me
        </button>
      </div>
      <div className="sp-coach-widget__log" ref={listRef} aria-live="polite">
        {log.length === 0 ? (
          <p className="sp-coach-widget__empty">
            Ask about your purchased programmes — answers use only chapters that are unlocked for you today
            {enrolledScope.length ? ` (${libraryLabel}).` : "."}
          </p>
        ) : (
          log.map((m, i) =>
            m.role === "user" ? (
              <p key={`u-${i}`} className="is-user">
                <strong>{firstName}:</strong> {m.text}
              </p>
            ) : (
              <div key={`c-${i}`} className="is-coach sp-coach-md">
                <strong className="sp-coach-md__who">Coach</strong>
                <MarkdownMessage text={m.text} className="sp-coach-md__body" />
              </div>
            ),
          )
        )}
        {busy ? <p className="sp-coach-widget__typing">Coach is thinking…</p> : null}
      </div>
      {error ? <p className="sp-error">{error}</p> : null}
      <form
        className="sp-coach-widget__form"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your unlocked chapters…"
          aria-label="Ask coach"
          disabled={busy}
        />
        <button type="submit" className="sp-btn sp-btn--primary" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );

  if (embedded) {
    if (!open) {
      return (
        <div className="sp-coach-widget sp-coach-widget--embedded sp-coach-widget--collapsed">
          <button type="button" className="sp-btn sp-btn--ghost sp-btn--sm" onClick={() => setOpen(true)}>
            {mode === "ask_instructor" ? "Ask the instructor" : "Ask coach"}
          </button>
        </div>
      );
    }
    return <div className="sp-coach-widget sp-coach-widget--embedded">{panel}</div>;
  }

  return (
    <div className="sp-coach-widget">
      {open ? panel : null}
      <button
        type="button"
        className={`sp-coach-fab${open ? " is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Hide Ask coach" : "Ask coach"}
      >
        {open ? "Hide" : "Ask coach"}
      </button>
    </div>
  );
}
