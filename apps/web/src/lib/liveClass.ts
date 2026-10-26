import { api, loadSession } from "./api";

export type LiveProvider = "bigbluebutton" | "jitsi";

export type LiveRoomStatus = {
  provider: LiveProvider;
  sectionId: string;
  meetingName: string;
  courseCode: string;
  sectionCode: string;
  role: "moderator" | "viewer";
  canJoin?: boolean;
  running: boolean | null;
  participantCount: number | null;
  totalEnrolled: number;
  currentlyAttending: number;
  recording: boolean | null;
  startedAt: string | null;
};

export type LiveJoinResult =
  | { status: "ready"; provider: LiveProvider; role: "moderator" | "viewer"; meetingName: string; url: string }
  | { status: "waiting"; provider: LiveProvider; role: "moderator" | "viewer"; meetingName: string };

export type LiveRecording = {
  recordId: string;
  name: string;
  published: boolean;
  startTime: string | null;
  endTime: string | null;
  participants: number;
  playbackUrl: string | null;
  lengthMinutes: number | null;
};

export function liveClassRef(url: string | null | undefined): { sectionId: string; provider?: LiveProvider } | null {
  const raw = url?.trim();
  if (!raw?.startsWith("/live/")) return null;
  const parsed = new URL(raw, "http://campusone.local");
  const m = parsed.pathname.match(/^\/live\/([0-9a-zA-Z-]+)$/);
  if (!m) return null;
  const provider = parsed.searchParams.get("provider");
  return {
    sectionId: m[1],
    ...(provider === "jitsi" || provider === "bigbluebutton" ? { provider } : {}),
  };
}

/** Section id from an in-app launcher link, or null for external meeting links. */
export function liveSectionId(url: string | null | undefined) {
  return liveClassRef(url)?.sectionId ?? null;
}

/** In-app launcher link that remembers the opening page (new tabs are opened with noreferrer). */
export function liveLauncherHref(sectionId: string, provider?: LiveProvider) {
  const params = new URLSearchParams();
  if (provider) params.set("provider", provider);
  if (typeof window === "undefined") {
    const query = params.toString();
    return `/live/${sectionId}${query ? `?${query}` : ""}`;
  }
  const from = `${window.location.pathname}${window.location.search}`;
  params.set("from", from);
  return `/live/${sectionId}?${params.toString()}`;
}

export function openClassLink(url: string | null | undefined) {
  if (!url) return false;
  const room = liveClassRef(url);
  if (room) {
    window.open(liveLauncherHref(room.sectionId, room.provider), "_blank", "noopener,noreferrer");
    return true;
  }
  if (url.startsWith("https://") || url.startsWith("http://")) {
    window.open(url, "_blank", "noopener,noreferrer");
    return true;
  }
  return false;
}

function token() {
  return loadSession()?.accessToken;
}

function providerQuery(provider?: LiveProvider) {
  return provider ? `?provider=${provider}` : "";
}

export function fetchLiveStatus(sectionId: string, provider?: LiveProvider) {
  return api<LiveRoomStatus>(`/live/sections/${sectionId}${providerQuery(provider)}`, {}, token());
}

export function joinLiveClass(sectionId: string, provider?: LiveProvider) {
  return api<LiveJoinResult>(`/live/sections/${sectionId}/join${providerQuery(provider)}`, { method: "POST", body: "{}" }, token());
}

export function touchLivePresence(sectionId: string, provider?: LiveProvider) {
  return api<{ ok: true }>(`/live/sections/${sectionId}/presence${providerQuery(provider)}`, { method: "POST", body: "{}" }, token());
}

export function endLiveClass(sectionId: string, provider?: LiveProvider) {
  return api<{ ended: boolean }>(`/live/sections/${sectionId}/end${providerQuery(provider)}`, { method: "POST", body: "{}" }, token());
}

export function fetchLiveRecordings(sectionId: string, provider?: LiveProvider) {
  return api<{ provider: LiveProvider; recordings: LiveRecording[] }>(`/live/sections/${sectionId}/recordings${providerQuery(provider)}`, {}, token());
}
