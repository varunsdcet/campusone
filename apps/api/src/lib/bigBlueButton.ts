import { createHash, createHmac } from "node:crypto";

/** BigBlueButton server API client — https://docs.bigbluebutton.org/development/api */

type ChecksumAlgorithm = "sha1" | "sha256" | "sha384" | "sha512";

export type BbbConfig = {
  /** Server base, e.g. `https://bbb.example.edu/bigbluebutton/`. */
  url: string;
  secret: string;
  algorithm: ChecksumAlgorithm;
};

export type BbbRecording = {
  recordId: string;
  name: string;
  published: boolean;
  startTime: string | null;
  endTime: string | null;
  participants: number;
  playbackUrl: string | null;
  lengthMinutes: number | null;
};

/**
 * Blindside Networks' public BigBlueButton test install (documented test credentials). Development only:
 * meetings there are public and recordings are purged, so production must set its own BBB_URL/BBB_SECRET.
 */
const DEV_TEST_SERVER = {
  url: "https://test-install.blindsidenetworks.com/bigbluebutton/",
  secret: "8cd8ef52e8e101574e400365b55e11a6",
};

export function bbbConfig(): BbbConfig | null {
  let rawUrl = process.env.BBB_URL?.trim();
  let secret = process.env.BBB_SECRET?.trim();
  if (rawUrl?.toLowerCase() === "off") return null;
  if (!rawUrl && !secret && process.env.NODE_ENV !== "production") {
    rawUrl = DEV_TEST_SERVER.url;
    secret = DEV_TEST_SERVER.secret;
  }
  if (!rawUrl || !secret) return null;
  let url = rawUrl.replace(/\/+$/, "");
  url = url.replace(/\/api$/, "");
  if (!/\/bigbluebutton$/.test(url)) url = `${url}/bigbluebutton`;
  const algo = (process.env.BBB_CHECKSUM_ALGORITHM || "sha1").toLowerCase();
  const algorithm: ChecksumAlgorithm = ["sha256", "sha384", "sha512"].includes(algo)
    ? (algo as ChecksumAlgorithm)
    : "sha1";
  return { url: `${url}/`, secret, algorithm };
}

function encode(params: Record<string, string | number | boolean | undefined>) {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

function signedUrl(cfg: BbbConfig, call: string, params: Record<string, string | number | boolean | undefined>) {
  const query = encode(params);
  const checksum = createHash(cfg.algorithm).update(`${call}${query}${cfg.secret}`).digest("hex");
  return `${cfg.url}api/${call}?${query ? `${query}&` : ""}checksum=${checksum}`;
}

function tag(xml: string, name: string) {
  const m = xml.match(new RegExp(`<${name}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`));
  return m ? m[1].trim() : null;
}

function blocks(xml: string, name: string) {
  return [...xml.matchAll(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "g"))].map((m) => m[1]);
}

function decodeEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

async function call(cfg: BbbConfig, name: string, params: Record<string, string | number | boolean | undefined>) {
  let res: Response;
  try {
    res = await fetch(signedUrl(cfg, name, params), { signal: AbortSignal.timeout(15_000) });
  } catch (err) {
    throw Object.assign(new Error(`BigBlueButton server unreachable (${(err as Error).message})`), {
      status: 502,
      code: "BBB_UNREACHABLE",
    });
  }
  const xml = await res.text();
  if (tag(xml, "returncode") !== "SUCCESS") {
    const key = tag(xml, "messageKey") || `http_${res.status}`;
    throw Object.assign(new Error(`BigBlueButton ${name} failed: ${tag(xml, "message") || key}`), {
      status: 502,
      code: key === "checksumError" ? "BBB_CHECKSUM" : "BBB_ERROR",
      bbbMessageKey: key,
    });
  }
  return xml;
}

/** Stable per-meeting passwords so restarts and multiple API replicas agree. */
export function meetingPasswords(cfg: BbbConfig, meetingId: string) {
  const derive = (role: string) => createHmac("sha256", cfg.secret).update(`${meetingId}:${role}`).digest("hex").slice(0, 20);
  return { moderatorPW: derive("moderator"), attendeePW: derive("attendee") };
}

export async function createMeeting(
  cfg: BbbConfig,
  input: { meetingId: string; name: string; welcome?: string; logoutUrl?: string; context?: string },
) {
  const pw = meetingPasswords(cfg, input.meetingId);
  const xml = await call(cfg, "create", {
    name: input.name,
    meetingID: input.meetingId,
    attendeePW: pw.attendeePW,
    moderatorPW: pw.moderatorPW,
    welcome: input.welcome,
    logoutURL: input.logoutUrl,
    record: true,
    autoStartRecording: false,
    allowStartStopRecording: true,
    meetingExpireIfNoUserJoinedInMinutes: 15,
    "meta_bbb-origin": "Heritage",
    "meta_bbb-context": input.context,
  });
  return { createTime: tag(xml, "createTime"), duplicate: tag(xml, "messageKey") === "duplicateWarning" };
}

export function joinMeetingUrl(
  cfg: BbbConfig,
  input: { meetingId: string; fullName: string; role: "MODERATOR" | "VIEWER"; userId: string },
) {
  const pw = meetingPasswords(cfg, input.meetingId);
  return signedUrl(cfg, "join", {
    fullName: input.fullName,
    meetingID: input.meetingId,
    role: input.role,
    password: input.role === "MODERATOR" ? pw.moderatorPW : pw.attendeePW,
    userID: input.userId,
    redirect: true,
  });
}

export async function meetingInfo(cfg: BbbConfig, meetingId: string) {
  try {
    const xml = await call(cfg, "getMeetingInfo", { meetingID: meetingId });
    return {
      running: tag(xml, "running") === "true",
      participantCount: Number(tag(xml, "participantCount") || 0),
      moderatorCount: Number(tag(xml, "moderatorCount") || 0),
      recording: tag(xml, "recording") === "true",
      startTime: Number(tag(xml, "startTime") || 0) || null,
    };
  } catch (err) {
    if ((err as { bbbMessageKey?: string }).bbbMessageKey === "notFound") {
      return { running: false, participantCount: 0, moderatorCount: 0, recording: false, startTime: null };
    }
    throw err;
  }
}

export async function endMeeting(cfg: BbbConfig, meetingId: string) {
  try {
    await call(cfg, "end", { meetingID: meetingId, password: meetingPasswords(cfg, meetingId).moderatorPW });
    return true;
  } catch (err) {
    if ((err as { bbbMessageKey?: string }).bbbMessageKey === "notFound") return false;
    throw err;
  }
}

export async function listRecordings(cfg: BbbConfig, meetingId: string): Promise<BbbRecording[]> {
  const xml = await call(cfg, "getRecordings", { meetingID: meetingId });
  return blocks(xml, "recording").map((rec) => {
    const start = Number(tag(rec, "startTime") || 0);
    const end = Number(tag(rec, "endTime") || 0);
    const playback = blocks(rec, "format").map((f) => ({ type: tag(f, "type"), url: tag(f, "url"), length: tag(f, "length") }));
    const best = playback.find((p) => p.type === "presentation") || playback[0];
    return {
      recordId: tag(rec, "recordID") || "",
      name: decodeEntities(tag(rec, "name") || "Recording"),
      published: tag(rec, "published") === "true",
      startTime: start ? new Date(start).toISOString() : null,
      endTime: end ? new Date(end).toISOString() : null,
      participants: Number(tag(rec, "participants") || 0),
      playbackUrl: best?.url ? decodeEntities(best.url) : null,
      lengthMinutes: best?.length ? Number(best.length) : null,
    };
  });
}
