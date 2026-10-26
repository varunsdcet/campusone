"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { splitScript } from "@/lib/monicaScript";
import { loadSession } from "@/lib/api";

type Narration = { audio: string; mime?: string; duration: number; words: string[]; wtimes: number[]; wdurations: number[] };

export type LectureTeacher = {
  /** Shown as the page heading and used to namespace the saved script. */
  name: string;
  slug: string;
  narrateUrl: string;
  gender: "female" | "male";
  voiceLabel: string;
  /**
   * For slow voices: prepare every part in order, this many at a time, as soon as the lecture opens, instead of only
   * a couple ahead of the one being read.
   */
  prepareAll?: number;
  /**
   * Read the lecture as one continuous stream: short, even chunks (so synthesis stays ahead of playback), no pauses
   * between chunks and no "part N of M" wording.
   */
  continuous?: boolean;
};

const CONTINUOUS_CHUNKS = { firstChars: 120, maxChars: 220, smallParts: 3 };

export const MONICA: LectureTeacher = {
  name: "Monica",
  slug: "monica",
  narrateUrl: "/api/monica/narrate",
  gender: "female",
  voiceLabel: "the HeyGen voice",
};

const PREFETCH = 2;
/** Roughly 150 spoken words a minute. */
const CHARS_PER_SEC = 14;
const AVATAR_TIMEOUT_MS = 25_000;

type AvatarWindow = Window & { thUnlockAudio?: () => string; thAudioState?: () => string };

let silentUrl = "";

/** A tiny silent WAV, played inside the Play click so later voice clips may start without a fresh gesture. */
function silentWavUrl() {
  if (silentUrl) return silentUrl;
  const samples = 800;
  const view = new DataView(new ArrayBuffer(44 + samples));
  const tag = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  tag(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  tag(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  tag(36, "data");
  view.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) view.setUint8(44 + i, 128);
  silentUrl = URL.createObjectURL(new Blob([view.buffer], { type: "audio/wav" }));
  return silentUrl;
}

function clock(totalSec: number) {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export function MonicaLecture({ teacher = MONICA }: { teacher?: LectureTeacher }) {
  const STORAGE_KEY = `${teacher.slug}-lecture-script`;
  const TITLE_KEY = `${teacher.slug}-lecture-title`;
  const pronoun = teacher.gender === "male" ? "he" : "she";
  const [script, setScript] = useState("");
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"edit" | "lecture">("edit");
  const [speed, setSpeed] = useState(1);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [avatarReady, setAvatarReady] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [status, setStatus] = useState("Loading teacher…");
  const [error, setError] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [durations, setDurations] = useState<Record<number, number>>({});

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const partRefs = useRef<Array<HTMLElement | null>>([]);
  const cacheRef = useRef(new Map<number, Promise<Narration>>());
  const playingRef = useRef(false);
  const runRef = useRef(0);
  const speakIdRef = useRef(0);
  const waitRef = useRef<{ id: number; resolve: () => void } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioOnly = !avatarReady && avatarFailed;

  useEffect(() => {
    setScript(localStorage.getItem(STORAGE_KEY) || "");
    setTitle(localStorage.getItem(TITLE_KEY) || "");
  }, []);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, script);
  }, [script]);
  useEffect(() => {
    localStorage.setItem(TITLE_KEY, title);
  }, [title]);

  const parts = useMemo(
    () => splitScript(script, teacher.continuous ? CONTINUOUS_CHUNKS : undefined),
    [script, teacher.continuous],
  );
  /** Part indexes grouped by the script paragraph they belong to, for the continuous reading view. */
  const paragraphs = useMemo(
    () =>
      parts.reduce<number[][]>((acc, p, i) => {
        if (i > 0 && parts[i - 1].paragraph === p.paragraph) acc[acc.length - 1].push(i);
        else acc.push([i]);
        return acc;
      }, []),
    [parts],
  );
  const words = useMemo(() => (script.trim() ? script.trim().split(/\s+/).length : 0), [script]);
  const estimate = (i: number) => durations[i] ?? parts[i].text.length / CHARS_PER_SEC / speed;
  const totalSec = parts.reduce((sum, _p, i) => sum + estimate(i), 0);
  const elapsedSec = finished ? totalSec : parts.slice(0, index).reduce((sum, _p, i) => sum + estimate(i), 0);

  const resetVoice = useCallback(() => {
    cacheRef.current.clear();
    setDurations({});
  }, []);

  const post = (msg: Record<string, unknown>) => iframeRef.current?.contentWindow?.postMessage(msg, "*");

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.data?.type === "th-ready") {
        setAvatarReady(true);
        setAvatarFailed(false);
        setStatus((s) => (s.startsWith("Loading") || s.startsWith("Teacher could not") ? "Ready — press Play" : s));
      }
      if (ev.data?.type === "th-error") {
        setAvatarFailed(true);
        setStatus(`Teacher could not load (${ev.data.message || "unknown error"}) — Play reads the script with voice only`);
      }
      const wait = waitRef.current;
      if (wait && ev.data?.type === "th-speak-done" && wait.id === ev.data.id) {
        waitRef.current = null;
        wait.resolve();
      }
    };
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener("message", onMsg);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("message", onMsg);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);

  useEffect(() => {
    if (avatarReady) return;
    post({ type: "th-ping" });
    const timer = window.setInterval(() => post({ type: "th-ping" }), 1000);
    const giveUp = window.setTimeout(() => {
      setAvatarFailed(true);
      setStatus("Teacher could not load in this browser — Play reads the script with voice only");
    }, AVATAR_TIMEOUT_MS);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(giveUp);
    };
  }, [avatarReady]);

  /** Must run synchronously inside the click handler — browsers only allow sound to start from a user gesture. */
  const unlockAudio = () => {
    (iframeRef.current?.contentWindow as AvatarWindow | null)?.thUnlockAudio?.();
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    if (a.paused) {
      a.src = silentWavUrl();
      void a.play().catch(() => {});
    }
  };

  useEffect(() => {
    if (mode === "lecture") partRefs.current[index]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [index, mode]);

  const narration = useCallback(
    (i: number) => {
      const cache = cacheRef.current;
      let pending = cache.get(i);
      if (!pending) {
        const accessToken = loadSession()?.accessToken;
        if (!accessToken) return Promise.reject(new Error("Sign in with an instructor account to use narration."));
        pending = fetch(teacher.narrateUrl, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ text: parts[i].text, speed }),
        }).then(async (res) => {
          const json = await res.json().catch(() => ({}));
          if (!res.ok || !json.audio) throw new Error(json.error || `Voice request failed (${res.status})`);
          setDurations((d) => ({ ...d, [i]: json.duration }));
          return json as Narration;
        });
        pending.catch(() => cache.delete(i));
        cache.set(i, pending);
      }
      return pending;
    },
    [parts, speed, teacher.narrateUrl],
  );

  useEffect(() => {
    if (mode !== "lecture" || !teacher.prepareAll) return;
    let cancelled = false;
    let next = 0;
    const worker = async () => {
      while (!cancelled && next < parts.length) await narration(next++).catch(() => {});
    };
    for (let k = 0; k < teacher.prepareAll; k++) void worker();
    return () => {
      cancelled = true;
    };
  }, [mode, narration, parts.length, teacher.prepareAll]);

  const prepared = Object.keys(durations).length;

  const stop = useCallback((label = "Paused") => {
    playingRef.current = false;
    runRef.current += 1;
    setPlaying(false);
    setStatus(label);
    post({ type: "th-stop" });
    audioRef.current?.pause();
    const wait = waitRef.current;
    waitRef.current = null;
    wait?.resolve();
  }, []);

  const playFrom = useCallback(
    async (start: number) => {
      if (!parts.length) return;
      const run = ++runRef.current;
      playingRef.current = true;
      setPlaying(true);
      setFinished(false);
      setError("");
      post({ type: "th-resume" });
      for (let i = start; i < parts.length; i++) {
        if (run !== runRef.current) return;
        setIndex(i);
        for (let k = 1; k <= PREFETCH && i + k < parts.length; k++) void narration(i + k).catch(() => {});
        let n: Narration;
        try {
          if (!durations[i]) setStatus(teacher.continuous ? "Preparing…" : `Preparing part ${i + 1} of ${parts.length}…`);
          n = await narration(i);
        } catch (err) {
          if (run !== runRef.current) return;
          setError(err instanceof Error ? err.message : "Voice request failed");
          stop("Stopped — press Play to retry this part");
          return;
        }
        if (run !== runRef.current) return;
        setStatus(
          `${teacher.continuous ? "Reading" : `Reading part ${i + 1} of ${parts.length}`}${audioOnly ? " (voice only)" : ""}`,
        );
        const id = ++speakIdRef.current;
        await new Promise<void>((resolve) => {
          waitRef.current = { id, resolve };
          const done = () => {
            if (waitRef.current?.id === id) {
              waitRef.current = null;
              resolve();
            }
          };
          if (audioOnly) {
            const a = audioRef.current ?? (audioRef.current = new Audio());
            a.onended = done;
            a.onerror = done;
            a.src = `data:${n.mime || "audio/mpeg"};base64,${n.audio}`;
            a.play().catch((err) => {
              if (run !== runRef.current) return;
              setError(`The browser blocked the sound (${err instanceof Error ? err.message : "autoplay"}) — press Play again`);
              stop("Stopped");
            });
          } else {
            post({ type: "th-speak-audio", id, audio: n.audio, words: n.words, wtimes: n.wtimes, wdurations: n.wdurations });
            window.setTimeout(() => {
              const state = (iframeRef.current?.contentWindow as AvatarWindow | null)?.thAudioState?.();
              if (state === "suspended" && waitRef.current?.id === id) {
                setError("The browser is blocking the teacher's sound — click once on the teacher, then press Play");
              }
            }, 2000);
          }
          window.setTimeout(() => {
            if (waitRef.current?.id === id) {
              waitRef.current = null;
              resolve();
            }
          }, (n.duration + 15) * 1000);
        });
        if (run !== runRef.current) return;
        const paragraphEnd = parts[i + 1]?.paragraph !== parts[i].paragraph;
        const gap = teacher.continuous ? (paragraphEnd ? 250 : 0) : paragraphEnd ? 700 : 200;
        if (gap) await new Promise((r) => window.setTimeout(r, gap));
      }
      if (run !== runRef.current) return;
      playingRef.current = false;
      setPlaying(false);
      setIndex(parts.length - 1);
      setFinished(true);
      setStatus("Lecture finished");
      post({ type: "th-idle" });
    },
    [audioOnly, durations, narration, parts, stop, teacher.continuous],
  );

  const jump = (i: number) => {
    const next = Math.max(0, Math.min(parts.length - 1, i));
    const wasPlaying = playingRef.current;
    if (wasPlaying) stop();
    setFinished(false);
    setIndex(next);
    if (wasPlaying) void playFrom(next);
  };

  const startLecture = () => {
    if (!parts.length) return;
    setMode("lecture");
    setFinished(false);
    setIndex(0);
    setError("");
    setStatus(
      avatarReady ? "Ready — press Play" : avatarFailed ? "Teacher could not load — Play reads the script with voice only" : "Loading teacher…",
    );
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await stageRef.current?.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      setFullscreen((v) => !v);
    }
  };

  return (
    <main className="mh-monica">
      <header className="mh-monica__head">
        <div>
          <p className="mh-monica__kicker">CampusOne · Lecture reader</p>
          <h1>{mode === "lecture" && title.trim() ? title : teacher.name}</h1>
        </div>
        {mode === "lecture" ? (
          <button
            type="button"
            className="mh-monica__btn"
            onClick={() => {
              stop("Ready — press Play");
              setMode("edit");
            }}
          >
            Edit script
          </button>
        ) : null}
      </header>

      <div className={`mh-monica__layout${mode === "edit" ? " is-edit" : ""}`}>
        <section
          ref={stageRef}
          className={`mh-monica__stage${fullscreen ? " is-fullscreen" : ""}`}
          aria-label="Teacher avatar"
        >
          <div className="mh-monica__avatar">
            <iframe
              ref={iframeRef}
              title="Teacher avatar"
              src={`/ai-draft/talkinghead-host.html?gender=${teacher.gender}`}
              allow="autoplay; fullscreen"
            />
          </div>
          {fullscreen && parts[index] ? <p className="mh-monica__caption">{parts[index].text}</p> : null}
          {mode === "edit" ? (
            <p className="mh-monica__status" role="status">
              {avatarReady ? "Teacher is ready. Paste your script and press Start lecture." : status}
            </p>
          ) : (
            <>
              <div className="mh-monica__progress" aria-hidden>
                <span style={{ width: `${totalSec ? Math.min(100, (elapsedSec / totalSec) * 100) : 0}%` }} />
              </div>
              <p className="mh-monica__status" role="status">
                {status} · {clock(elapsedSec)} / ~{clock(totalSec)}
                {teacher.prepareAll && !teacher.continuous && prepared < parts.length
                  ? ` · ${prepared} of ${parts.length} parts ready`
                  : ""}
              </p>
              {error ? (
                <p className="mh-monica__error" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="mh-monica__controls">
                <button type="button" className="mh-monica__btn" disabled={index === 0} onClick={() => jump(index - 1)}>
                  ◀ Back
                </button>
                {playing ? (
                  <button type="button" className="mh-monica__btn mh-monica__btn--primary" onClick={() => stop()}>
                    Pause
                  </button>
                ) : (
                  <button
                    type="button"
                    className="mh-monica__btn mh-monica__btn--primary"
                    disabled={(!avatarReady && !avatarFailed) || !parts.length}
                    onClick={() => {
                      unlockAudio();
                      void playFrom(finished ? 0 : index);
                    }}
                  >
                    {finished ? "Play again" : index > 0 ? "Resume" : "Play lecture"}
                  </button>
                )}
                <button
                  type="button"
                  className="mh-monica__btn"
                  disabled={index >= parts.length - 1}
                  onClick={() => jump(index + 1)}
                >
                  Skip ▶
                </button>
                <label className="mh-monica__speed">
                  Pace
                  <select
                    value={speed}
                    disabled={playing}
                    onChange={(e) => {
                      setSpeed(Number(e.target.value));
                      resetVoice();
                    }}
                  >
                    <option value={0.9}>Slower</option>
                    <option value={1}>Normal</option>
                    <option value={1.1}>Faster</option>
                  </select>
                </label>
                <button type="button" className="mh-monica__btn" onClick={() => void toggleFullscreen()}>
                  {fullscreen ? "Exit full screen" : "Full screen"}
                </button>
              </div>
            </>
          )}
        </section>

        {mode === "edit" ? (
          <section className="mh-monica__editor">
            <label className="mh-monica__field">
              Lecture title
              <input value={title} placeholder="e.g. Introduction to Microeconomics" onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="mh-monica__field">
              Script
              <textarea
                value={script}
                placeholder="Paste the full lecture script here. Leave a blank line between paragraphs — the teacher pauses briefly at each one."
                onChange={(e) => {
                  setScript(e.target.value);
                  resetVoice();
                }}
              />
            </label>
            <div className="mh-monica__editor-foot">
              <span>
                {words.toLocaleString()} words · about {clock(parts.reduce((s, p) => s + p.text.length / CHARS_PER_SEC, 0))} spoken
                {teacher.continuous ? "" : ` · ${parts.length} parts`}
              </span>
              <button
                type="button"
                className="mh-monica__btn mh-monica__btn--primary"
                disabled={!parts.length}
                onClick={startLecture}
              >
                Start lecture
              </button>
            </div>
            <p className="mh-monica__help">
              The script is saved in this browser automatically. The teacher reads it in {teacher.voiceLabel},{" "}
              {teacher.continuous ? "preparing what comes next" : "a few parts ahead are prepared"} while {pronoun} speaks, and
              you can pause, go back or skip at any time.
            </p>
          </section>
        ) : (
          <section className="mh-monica__script" aria-label="Lecture script">
            {teacher.continuous
              ? paragraphs.map((idxs) => (
                  <p key={idxs[0]} className="mh-monica__flow">
                    {idxs.map((i) => (
                      <span
                        key={i}
                        ref={(el) => {
                          partRefs.current[i] = el;
                        }}
                        className={`mh-monica__chunk${i === index ? " is-current" : ""}${i < index ? " is-done" : ""}`}
                        onClick={() => jump(i)}
                      >
                        {parts[i].text}{" "}
                      </span>
                    ))}
                  </p>
                ))
              : parts.map((p, i) => (
              <p
                key={i}
                ref={(el) => {
                  partRefs.current[i] = el;
                }}
                className={`mh-monica__part${i === index ? " is-current" : ""}${i < index ? " is-done" : ""}${
                  parts[i - 1] && parts[i - 1].paragraph !== p.paragraph ? " is-paragraph" : ""
                }`}
                onClick={() => jump(i)}
              >
                {p.text}
              </p>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
