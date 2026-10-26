import type { NextRequest } from "next/server";

export type HeygenWord = { word: string; start: number; end: number };
export type HeygenSpeech = { audio: Buffer; words: HeygenWord[]; duration: number };

export function heygenConfig(male = false) {
  const apiKey = (process.env.HEYGEN_API_KEY || "").trim();
  const voiceId = ((male ? process.env.HEYGEN_MALE_VOICE_ID : process.env.HEYGEN_VOICE_ID) || "").trim();
  return apiKey && voiceId ? { apiKey, voiceId } : null;
}

/** HeyGen text-to-speech: MP3 audio plus word timestamps in seconds (start/end markers stripped). */
export async function heygenSpeech(text: string, voiceId: string, apiKey: string, speed = 1): Promise<HeygenSpeech> {
  const res = await fetch("https://api.heygen.com/v3/voices/speech", {
    method: "POST",
    headers: { "x-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({ text, voice_id: voiceId, speed: Math.min(2, Math.max(0.5, speed)), language: "en" }),
    signal: AbortSignal.timeout(60_000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: { audio_url?: string; duration?: number; word_timestamps?: HeygenWord[] | null };
    error?: { message?: string };
  };
  if (!res.ok || !json.data?.audio_url) throw new Error(json.error?.message || `HeyGen TTS HTTP ${res.status}`);

  const audioRes = await fetch(json.data.audio_url, { signal: AbortSignal.timeout(60_000) });
  if (!audioRes.ok) throw new Error(`HeyGen audio download HTTP ${audioRes.status}`);
  const audio = Buffer.from(await audioRes.arrayBuffer());

  const words = (json.data.word_timestamps || []).filter((w) => !/^<.*>$/.test(w.word));
  const duration = json.data.duration || words.at(-1)?.end || Math.max(1.2, text.length * 0.055);
  return { audio, words, duration };
}

const BUCKETS = new Map<string, Map<string, { windowStart: number; count: number }>>();

/** Per-client, per-minute cap for routes that spend HeyGen credits without a session. */
export function rateLimited(req: NextRequest, bucket: string, maxPerMinute: number) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  let rate = BUCKETS.get(bucket);
  if (!rate) BUCKETS.set(bucket, (rate = new Map()));
  const now = Date.now();
  const entry = rate.get(ip);
  if (!entry || now - entry.windowStart > 60_000) {
    if (rate.size > 5000) rate.clear();
    rate.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > maxPerMinute;
}
