"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AiDraftSlide, AiDraftStoryboard } from "@/lib/aiDraftSamples";

type Gender = "female" | "male";

type Props = {
  storyboard: AiDraftStoryboard;
  /** Popup mode when set; omitted = embedded in the page (slides beside the avatar). */
  onClose?: () => void;
};

export function AiDraftVideoPlayer({ storyboard, onClose }: Props) {
  const inline = !onClose;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [avatarReady, setAvatarReady] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [gender, setGender] = useState<Gender>("female");
  const [status, setStatus] = useState("Loading avatar…");
  const playingRef = useRef(false);
  const speakWaitRef = useRef<{ id: number; resolve: () => void } | null>(null);
  const speakIdRef = useRef(0);
  const genderRef = useRef<Gender>("female");

  const slides = storyboard.slides;
  const slide: AiDraftSlide | undefined = slides[slideIndex];
  const mins = Math.max(1, Math.round((storyboard.estimated_duration_sec || 360) / 60));

  useEffect(() => {
    genderRef.current = gender;
  }, [gender]);

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.data?.type === "th-ready") {
        setAvatarReady(true);
        setStatus("Avatar ready — press Play");
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

  useEffect(() => {
    if (avatarReady) return;
    const ping = () => iframeRef.current?.contentWindow?.postMessage({ type: "th-ping" }, "*");
    ping();
    const timer = window.setInterval(ping, 1000);
    return () => window.clearInterval(timer);
  }, [avatarReady, gender]);

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
      (iframeRef.current?.contentWindow as (Window & { thUnlockAudio?: () => string }) | null)?.thUnlockAudio?.();
      iframeRef.current?.contentWindow?.postMessage({ type: "th-resume" }, "*");
      playingRef.current = true;
      setPlaying(true);
      for (let i = startAt; i < slides.length; i++) {
        if (!playingRef.current) return;
        setSlideIndex(i);
        setStatus(`Playing slide ${i + 1} / ${slides.length}`);
        await speakSlide(slides[i].narration);
        if (!playingRef.current) return;
        await new Promise((r) => window.setTimeout(r, 350));
      }
      playingRef.current = false;
      setPlaying(false);
      setStatus("Finished");
      iframeRef.current?.contentWindow?.postMessage({ type: "th-idle" }, "*");
    },
    [slides, speakSlide],
  );

  // Do not autoplay — browsers block audio without a user gesture.
  // User hits Play after avatar is ready.

  const switchGender = (next: Gender) => {
    if (next === gender) return;
    stop();
    setAvatarReady(false);
    setGender(next);
    setStatus(`Loading ${next} avatar…`);
    // iframe remounts via key=gender → boot with correct GLB + voice
  };

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

  const player = (
      <div
        ref={rootRef}
        className={`mh-ai-draft-video${inline ? " mh-ai-draft-video--inline" : ""}${fullscreen ? " is-fullscreen" : ""}`}
        aria-label={inline ? "AI video lesson" : undefined}
      >
        <header className="mh-ai-draft-video__head">
          <div>
            <p className="mh-ai-draft-video__kicker">
              AI video · {mins} min · {slides.length} slides · {gender === "male" ? "Male" : "Female"}
            </p>
            <h2>{storyboard.title}</h2>
            <p className="mh-ai-draft-video__status">{status}</p>
          </div>
          <div className="mh-ai-draft-video__head-actions">
            <div className="mh-ai-draft-video__gender" role="group" aria-label="Avatar gender">
              <button
                type="button"
                className={`mh-ai-draft-video__gender-btn${gender === "female" ? " is-active" : ""}`}
                disabled={playing}
                onClick={() => switchGender("female")}
              >
                Female
              </button>
              <button
                type="button"
                className={`mh-ai-draft-video__gender-btn${gender === "male" ? " is-active" : ""}`}
                disabled={playing}
                onClick={() => switchGender("male")}
              >
                Male
              </button>
            </div>
            <button type="button" className="mh-teacher-btn" onClick={() => void toggleFullscreen()}>
              {fullscreen ? "Exit full screen" : "Full screen"}
            </button>
            {onClose ? (
              <button
                type="button"
                className="mh-ai-draft-modal__x"
                onClick={() => {
                  stop();
                  onClose();
                }}
                aria-label="Close"
              >
                ×
              </button>
            ) : null}
          </div>
        </header>

        <div className="mh-ai-draft-video__stage">
          <div className="mh-ai-draft-video__slide" key={slide?.number}>
            {slide ? (
              <>
                <p className="mh-ai-draft-video__slide-num">
                  Slide {slide.number} / {slides.length}
                </p>
                <h3>{slide.heading}</h3>
                <ul>
                  {slide.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <p className="mh-ai-draft-video__narration">{slide.narration}</p>
              </>
            ) : null}
          </div>
          <div className="mh-ai-draft-video__avatar-wrap">
            <iframe
              key={gender}
              ref={iframeRef}
              title={`${gender} TalkingHead avatar`}
              className="mh-ai-draft-video__avatar"
              src={`/ai-draft/talkinghead-host.html?gender=${gender}`}
              allow="autoplay; fullscreen"
            />
            <p className="mh-ai-draft-video__avatar-label">
              {gender === "male" ? "Male avatar" : "Female avatar"}
            </p>
          </div>
        </div>

        <div className="mh-ai-draft-video__controls">
          <button
            type="button"
            className="mh-teacher-btn"
            disabled={slideIndex === 0 || playing}
            onClick={() => {
              stop();
              setSlideIndex((i) => Math.max(0, i - 1));
            }}
          >
            Prev
          </button>
          {playing ? (
            <button type="button" className="mh-teacher-btn mh-teacher-btn--primary" onClick={stop}>
              Pause
            </button>
          ) : (
            <button
              type="button"
              className="mh-teacher-btn mh-teacher-btn--primary"
              disabled={!avatarReady}
              onClick={() => void playFrom(slideIndex)}
            >
              {slideIndex > 0 && slideIndex < slides.length ? "Resume" : "Play slideshow"}
            </button>
          )}
          <button
            type="button"
            className="mh-teacher-btn"
            disabled={slideIndex >= slides.length - 1 || playing}
            onClick={() => {
              stop();
              setSlideIndex((i) => Math.min(slides.length - 1, i + 1));
            }}
          >
            Next
          </button>
          <button type="button" className="mh-teacher-btn" onClick={() => void toggleFullscreen()}>
            Full screen
          </button>
        </div>
      </div>
  );

  if (inline) return player;
  return (
    <div className="mh-ai-draft-overlay" role="dialog" aria-modal="true" aria-label="AI lesson video">
      {player}
    </div>
  );
}
