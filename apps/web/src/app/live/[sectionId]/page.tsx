"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { loadSession } from "@/lib/api";
import { joinLiveClass, touchLivePresence, type LiveProvider } from "@/lib/liveClass";
import { LiveClassPanel } from "@/components/LiveClassPanel";
import "@/components/liveClass.css";

const RETRY_MS = 10_000;
const HEARTBEAT_MS = 30_000;

function portalHome(roles: string[]) {
  if (roles.includes("admin") || roles.includes("registrar")) return "/admin";
  if (roles.includes("instructor")) return "/instructor/sections";
  return "/student/courses";
}

function LiveLauncher() {
  const router = useRouter();
  const { sectionId } = useParams<{ sectionId: string }>();
  const searchParams = useSearchParams();
  const left = searchParams.get("left") === "1";
  const from = searchParams.get("from") || "";
  const providerParam = searchParams.get("provider");
  const provider: LiveProvider | undefined =
    providerParam === "jitsi" || providerParam === "bigbluebutton" ? providerParam : undefined;
  const [state, setState] = useState<"joining" | "waiting" | "room" | "error" | "left">(left ? "left" : "joining");
  const [roomUrl, setRoomUrl] = useState("");
  const [title, setTitle] = useState("");
  const [roomRole, setRoomRole] = useState<"moderator" | "viewer" | null>(null);
  const [error, setError] = useState("");
  const [home, setHome] = useState("/");
  const timer = useRef<number | null>(null);

  const attempt = useCallback(async () => {
    try {
      const res = await joinLiveClass(sectionId, provider);
      setTitle(res.meetingName);
      setRoomRole(res.role);
      if (res.status === "ready") {
        if (res.provider === "jitsi") {
          setRoomUrl(res.url);
          setState("room");
          return;
        }
        window.location.replace(res.url);
        return;
      }
      setState("waiting");
      timer.current = window.setTimeout(() => void attempt(), RETRY_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the class.");
      setState("error");
    }
  }, [provider, sectionId]);

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      const params = new URLSearchParams();
      if (provider) params.set("provider", provider);
      if (left) params.set("left", "1");
      const query = params.toString();
      router.replace(`/login?next=${encodeURIComponent(`/live/${sectionId}${query ? `?${query}` : ""}`)}`);
      return;
    }
    // BigBlueButton's logout redirect drops the referrer, so remember the in-app page that opened the class.
    const returnKey = `mh.live.return.${sectionId}`;
    const inApp = (p: string) => p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/live/");
    try {
      const ref = document.referrer ? new URL(document.referrer) : null;
      if (from && inApp(from)) {
        sessionStorage.setItem(returnKey, from);
      } else if (ref && ref.origin === window.location.origin && inApp(ref.pathname)) {
        sessionStorage.setItem(returnKey, `${ref.pathname}${ref.search}`);
      }
    } catch {
      // Ignore malformed referrers.
    }
    setHome(sessionStorage.getItem(returnKey) || portalHome(session.roles ?? []));
    if (!left) void attempt();
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [attempt, from, left, router, sectionId]);

  useEffect(() => {
    if (state !== "room" || roomRole !== "viewer") return;
    const ping = () => void touchLivePresence(sectionId, "jitsi").catch(() => undefined);
    ping();
    const heartbeat = window.setInterval(ping, HEARTBEAT_MS);
    return () => window.clearInterval(heartbeat);
  }, [roomRole, sectionId, state]);

  if (state === "room" && roomUrl) {
    return (
      <main className="mh-live-room">
        <iframe
          src={roomUrl}
          title={title || "Live class"}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          referrerPolicy="no-referrer"
        />
        <a className="mh-live-room__leave" href={`${home || "/"}`}>Leave class</a>
      </main>
    );
  }

  return (
    <main className="mh-live-launch">
      <div className="mh-live-launch__card">
        {state === "joining" ? (
          <div className="mh-live-launch__status">
            <div className="mh-live-launch__spinner" aria-hidden />
            <h1>Opening your class…</h1>
            <p>Connecting you to the live classroom.</p>
          </div>
        ) : null}
        {state === "waiting" ? (
          <div className="mh-live-launch__status" role="status">
            <div className="mh-live-launch__spinner" aria-hidden />
            <h1>{title || "Your class"} hasn&apos;t started yet</h1>
            <p>Keep this tab open — you&apos;ll be taken into the room as soon as your instructor starts the class.</p>
          </div>
        ) : null}
        {state === "error" ? (
          <div className="mh-live-launch__status" role="alert">
            <h1>Could not open the class</h1>
            <p>{error}</p>
          </div>
        ) : null}
        {state === "left" ? (
          <>
            <div className="mh-live-launch__status">
              <h1>You left the class</h1>
              <p>Rejoin below, or head back to your courses.</p>
            </div>
            <LiveClassPanel sectionId={sectionId} provider={provider} />
          </>
        ) : null}
        <a className="mh-live-launch__back" href={home}>
          ← Back to CampusOne
        </a>
      </div>
    </main>
  );
}

export default function LivePage() {
  return (
    <Suspense fallback={null}>
      <LiveLauncher />
    </Suspense>
  );
}
