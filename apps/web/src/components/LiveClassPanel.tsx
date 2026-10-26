"use client";

import { useCallback, useEffect, useState } from "react";
import {
  endLiveClass,
  fetchLiveRecordings,
  fetchLiveStatus,
  liveLauncherHref,
  type LiveRecording,
  type LiveProvider,
  type LiveRoomStatus,
} from "@/lib/liveClass";
import "./liveClass.css";

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LiveClassPanel({ sectionId, provider, note }: { sectionId: string; provider?: LiveProvider; note?: string }) {
  const [status, setStatus] = useState<LiveRoomStatus | null>(null);
  const [recordings, setRecordings] = useState<LiveRecording[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    try {
      const next = await fetchLiveStatus(sectionId, provider);
      setStatus(next);
      setError("");
      if (next.provider === "bigbluebutton") {
        const recs = await fetchLiveRecordings(sectionId, provider).catch(() => null);
        if (recs) setRecordings(recs.recordings);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the live class.");
    }
  }, [provider, sectionId]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  function join() {
    window.open(liveLauncherHref(sectionId, provider), "_blank", "noopener,noreferrer");
    window.setTimeout(() => void refresh(), 8_000);
  }

  async function end() {
    if (!window.confirm("End this class for everyone? Students will be removed from the room.")) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await endLiveClass(sectionId, provider);
      setMessage(res.ended ? "Class ended for everyone." : "The class was not running.");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not end the class.");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="mh-live" data-provider="error">
        <p className="mh-live__error">{error}</p>
        <button type="button" className="mh-hcc-btn" onClick={() => void refresh()}>
          Try again
        </button>
      </div>
    );
  }
  if (!status) return <div className="mh-live mh-live--loading">Loading live class…</div>;

  const bbb = status.provider === "bigbluebutton";
  const moderator = status.role === "moderator";
  const running = Boolean(status.running);
  const canJoin = status.canJoin !== false;
  const stateLabel = !canJoin
    ? "Course completed"
    : !bbb
    ? "Room ready"
    : running
      ? `Live now · ${status.currentlyAttending} attending`
      : moderator
        ? "Not started"
        : "Waiting for your instructor";

  return (
    <div className="mh-live" data-provider={status.provider}>
      <div className="mh-live__head">
        <div>
          <p className="mh-live__brand">{bbb ? "BigBlueButton" : "Jitsi Meet"} · Online Class</p>
          <h3>{status.meetingName}</h3>
        </div>
        <span className={`mh-live__state${running ? " is-live" : ""}`}>{stateLabel}</span>
      </div>

      <p className="mh-live__note">
        {note ||
          (!canJoin
            ? "You have completed this course, so the live class is closed. Published recordings stay available below."
            : moderator
            ? bbb
              ? "You join as moderator: share your screen, use the whiteboard, run polls, manage students and start or stop the recording."
              : "Teacher and students meet in the same room."
            : running || !bbb
              ? "Your class is open. Join to see your instructor's screen, chat and raise your hand."
              : "The room opens as soon as your instructor starts the class. You can click Join and wait there.")}
      </p>

      <div className="mh-live__counts" aria-label="Live class student counts">
        <div>
          <strong>{status.totalEnrolled}</strong>
          <span>Total enrolled students</span>
        </div>
        <div>
          <strong>{status.currentlyAttending}</strong>
          <span>Currently attending students</span>
        </div>
      </div>

      <div className="mh-live__actions">
        {canJoin ? (
          <button type="button" className="mh-hcc-btn" onClick={join}>
            {moderator ? (running ? "Join class" : "Start class") : "Join class"}
          </button>
        ) : null}
        {moderator && bbb && running ? (
          <button type="button" className="mh-live__danger" onClick={() => void end()} disabled={busy}>
            {busy ? "Ending…" : "End class for everyone"}
          </button>
        ) : null}
        <button type="button" className="mh-live__ghost" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>
      {message ? <p className="mh-live__message">{message}</p> : null}

      {bbb ? (
        <div className="mh-live__recordings">
          <h4>Recordings</h4>
          {recordings.length === 0 ? (
            <p className="mh-live__muted">
              {moderator
                ? "No recordings yet. Press the record button inside the room; recordings appear here a few minutes after the class ends."
                : "No recordings have been published for this class yet."}
            </p>
          ) : (
            <ul>
              {recordings.map((r) => (
                <li key={r.recordId}>
                  <div>
                    <strong>{r.name}</strong>
                    <span>
                      {formatWhen(r.startTime)}
                      {r.lengthMinutes ? ` · ${r.lengthMinutes} min` : ""}
                      {moderator && !r.published ? " · unpublished" : ""}
                    </span>
                  </div>
                  {r.playbackUrl ? (
                    <a href={r.playbackUrl} target="_blank" rel="noreferrer">
                      Watch
                    </a>
                  ) : (
                    <span className="mh-live__muted">Processing…</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : moderator ? (
        <p className="mh-live__muted">
          BigBlueButton is not connected yet, so classes use Jitsi Meet. Set BBB_URL and BBB_SECRET on the API to switch.
        </p>
      ) : null}
    </div>
  );
}
