import { isJitsiMeetUrl } from "./jitsiMeet.js";

export type LiveClassProvider = "jitsi" | "bigbluebutton";

/** In-app launcher; the web route resolves it to a BigBlueButton (or Jitsi fallback) join URL per user. */
export function liveClassUrl(sectionId: string, provider?: LiveClassProvider | null) {
  return `/live/${sectionId}${provider ? `?provider=${provider}` : ""}`;
}

export function isLiveClassUrl(url: string | null | undefined) {
  return Boolean(
    url && /^\/live\/[0-9a-zA-Z-]+(?:\?provider=(?:jitsi|bigbluebutton))?$/.test(url.trim()),
  );
}

/** Teacher-supplied external meeting link (Zoom, Teams, …), or null for platform rooms. */
export function externalJoinUrl(url: string | null | undefined) {
  const raw = url?.trim();
  if (!raw || !raw.startsWith("https://") || isJitsiMeetUrl(raw)) return null;
  return raw;
}

/** What clients should open for a section's online class. Legacy Jitsi links now route through the launcher. */
export function classJoinUrl(
  sectionId: string,
  stored?: string | null,
  provider?: LiveClassProvider | null,
) {
  return externalJoinUrl(stored) || liveClassUrl(sectionId, provider);
}

/** Same as `classJoinUrl`, but keeps sessions without any join link (in-person) link-free. */
export function sessionJoinUrl(sectionId: string, stored: string | null | undefined) {
  return stored?.trim() ? classJoinUrl(sectionId, stored) : null;
}

export function webPublicUrl(path = "") {
  const base = (process.env.WEB_PUBLIC_URL || "https://myvccbc.com").replace(/\/+$/, "");
  return `${base}${path}`;
}

/** Absolute link for notification text, where relative in-app paths are not clickable. */
export function notificationJoinUrl(url: string | null | undefined) {
  if (!url) return null;
  return isLiveClassUrl(url) ? webPublicUrl(url) : url;
}
