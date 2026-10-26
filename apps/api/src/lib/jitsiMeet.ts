import { createHmac } from "node:crypto";

/** Shared Jitsi Meet room URLs — same room for instructor + enrolled students. */

function roomSecret() {
  return process.env.JITSI_ROOM_SECRET || process.env.JWT_SECRET || "dev-jwt-secret-change-me";
}

/** meet.jit.si rooms are public to anyone who knows the name, so the name carries a server-keyed token per section. */
export function jitsiRoomToken(sectionId: string) {
  return createHmac("sha256", roomSecret()).update(`jitsi-room:${sectionId}`).digest("hex").slice(0, 24);
}

export function jitsiMeetRoomSlug(courseCode: string, sectionCode: string, sectionId: string) {
  const raw = `heritage-${courseCode}-${sectionCode}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${raw || "heritage-class"}-${jitsiRoomToken(sectionId)}`;
}

export function jitsiMeetUrl(courseCode: string, sectionCode: string, sectionId: string) {
  return `https://meet.jit.si/${jitsiMeetRoomSlug(courseCode, sectionCode, sectionId)}`;
}

export function isJitsiMeetUrl(url: string | null | undefined) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "meet.jit.si" || host.endsWith(".jit.si");
  } catch {
    return false;
  }
}
