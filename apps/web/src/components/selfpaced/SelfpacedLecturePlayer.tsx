"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LectureSlide, LectureStoryboard } from "@/lib/selfpacedCurriculum";

type Props = {
  storyboard: LectureStoryboard;
  /** Fraction of slides fully played in order (skip-forward does not count). */
  onWatchPct?: (pct: number) => void;
};

/** Embedded female talking-head lecture for self-paced chapters. */
export function SelfpacedLecturePlayer({ storyboard, onWatchPct }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [avatarReady, setAvatarReady] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [status, setStatus] = useState("Loading instructor…");
  const [playedCount, setPlayedCount] = useState(0);
  const playedRef = useRef<Set<number>>(new Set());
  const playingRef = useRef(false);
  const speakWaitRef = useRef<{ id: number; resolve: () => void } | null>(null);
  const speakIdRef = useRef(0);
  const maxSequentialRef = useRef(0);

  const slides = storyboard.slides;
  const slide: LectureSlide | undefined = slides[slideIndex];
  const mins = Math.max(1, Math.round((storyboard.estimated_duration_sec || 420) / 60));

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.data?.type === "th-ready") {
        setAvatarReady(true);
        setStatus("Instructor ready — press Play");
      }
      if (ev.data?.type === "th-error") {
        setStatus(`Avatar error: ${ev.data.message || "failed"}`);
        setAvatarReady(false);
      }
      if (ev.data?.type === "th-speak-done") {
        const wait = speakWaitRef.current;
        if (wait && wait.id === ev.data.id) {
          speakWaitRef.current = null;
          wait.resolve();
        }
      }
    };
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener("message", onMsg);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("message", onMsg);
      document.removeEventListener("fullscreenchange", onFs);
      iframeRef.current?.contentWindow?.postMessage({ type: "th-stop" }, "*");
    };
  }, []);

  const speakSlide = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      const id = ++speakIdRef.current;
      speakWaitRef.current = { id, resolve };
      const win = iframeRef.current?.contentWindow;
      win?.postMessage({ type: "th-resume" }, "*");
      win?.postMessage({ type: "th-speak-text", text, id }, "*");
      window.setTimeout(() => {
        if (speakWaitRef.current?.id === id) {
          speakWaitRef.current = null;
          resolve();
        }
      }, Math.min(90000, Math.max(8000, text.length * 80)));
    });
  }, []);

  const stop = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    setStatus("Paused");
    iframeRef.current?.contentWindow?.postMessage({ type: "th-stop" }, "*");
    const wait = speakWaitRef.current;
    if (wait) {
      speakWaitRef.current = null;
      wait.resolve();
    }
  }, []);

  const playFrom = useCallback(
    async (startAt: number) => {
      // Only credit slides reached by sequential play, not skip-forward.
      const start = Math.min(startAt, maxSequentialRef.current);
      iframeRef.current?.contentWindow?.postMessage({ type: "th-resume" }, "*");
      playingRef.current = true;
      setPlaying(true);
      for (let i = start; i < slides.length; i++) {
        if (!playingRef.current) return;
        setSlideIndex(i);
        setStatus(`Playing slide ${i + 1} / ${slides.length}`);
        await speakSlide(slides[i].narration);
        if (!playingRef.current) return;
        playedRef.current.add(i);
        maxSequentialRef.current = Math.max(maxSequentialRef.current, i + 1);
        const pct = (playedRef.current.size / slides.length) * 100;
        setPlayedCount(playedRef.current.size);
        onWatchPct?.(pct);
        await new Promise((r) => window.setTimeout(r, 350));
      }
      playingRef.current = false;
      setPlaying(false);
      setStatus("Lecture finished");
      iframeRef.current?.contentWindow?.postMessage({ type: "th-idle" }, "*");
    },
    [slides, speakSlide, onWatchPct],
  );

  const toggleFullscreen = async () => {
    const el = rootRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) await el.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      setFullscreen((v) => !v);
    }
  };

  return (
    <div
      ref={rootRef}
      className={`sp-lecture${fullscreen ? " is-fullscreen" : ""}`}
    >
      <div className="sp-lecture__meta">
        <p className="sp-lecture__kicker">
          Instructor lecture · Female avatar · {mins} min · {slides.length} slides
        </p>
        <h2>{storyboard.title}</h2>
        <p className="sp-lecture__status">{status}</p>
      </div>

      <div className="sp-lecture__stage">
        <div className="sp-lecture__slide" key={slide?.number}>
          {slide ? (
            <>
              <p className="sp-lecture__slide-num">
                Slide {slide.number} / {slides.length}
              </p>
              <h3>{slide.heading}</h3>
              <ul>
                {slide.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <p className="sp-lecture__narration">{slide.narration}</p>
            </>
          ) : null}
        </div>
        <div className="sp-lecture__avatar-wrap">
          <iframe
            ref={iframeRef}
            title="Female instructor avatar"
            className="sp-lecture__avatar"
            src="/ai-draft/talkinghead-host.html?gender=female"
            allow="autoplay; fullscreen"
          />
          <p className="sp-lecture__avatar-label">CampusOne instructor</p>
        </div>
      </div>

      <div className="sp-lecture__controls">
        <button
          type="button"
          className="sp-btn"
          disabled={slideIndex === 0 || playing}
          onClick={() => {
            stop();
            setSlideIndex((i) => Math.max(0, i - 1));
          }}
        >
          Prev
        </button>
        {playing ? (
          <button type="button" className="sp-btn sp-btn--primary" onClick={stop}>
            Pause
          </button>
        ) : (
          <button
            type="button"
            className="sp-btn sp-btn--primary"
            disabled={!avatarReady}
            onClick={() => void playFrom(slideIndex)}
          >
            {slideIndex > 0 && slideIndex < slides.length ? "Resume" : "Play lecture"}
          </button>
        )}
        <button
          type="button"
          className="sp-btn"
          disabled={slideIndex >= slides.length - 1 || playing}
          onClick={() => {
            stop();
            // Preview only — does not count toward watch %
            setSlideIndex((i) => Math.min(slides.length - 1, i + 1));
            setStatus("Preview only — use Play to credit slides");
          }}
        >
          Next
        </button>
        <button type="button" className="sp-btn" onClick={() => void toggleFullscreen()}>
          {fullscreen ? "Exit full screen" : "Full screen"}
        </button>
        <span className="sp-lecture__watch">
          Credited {playedCount}/{slides.length} slides
        </span>
      </div>
    </div>
  );
}
