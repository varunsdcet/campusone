export type XttsWord = { word: string; start: number; end: number };
export type XttsSpeech = { audio: Buffer; words: XttsWord[]; duration: number };

/** XTTS_URL may list several servers, comma-separated; each request goes to the one with the fewest in flight. */
export function xttsLicenseAccepted() {
  return /^(?:1|true|yes)$/i.test(process.env.XTTS_LICENSE_ACCEPTED || "");
}

export function xttsConfig() {
  if (!xttsLicenseAccepted()) return null;
  const urls = (process.env.XTTS_URL || "")
    .split(",")
    .map((u) => u.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return urls.length ? { urls } : null;
}

const inFlight = new Map<string, number>();

function leastBusy(urls: string[]) {
  return urls.reduce((best, u) => ((inFlight.get(u) ?? 0) < (inFlight.get(best) ?? 0) ? u : best), urls[0]);
}

/**
 * XTTS-v2 returns no word timestamps, so words are spread over the clip in proportion to their length, with extra
 * weight after punctuation where the voice pauses. Close enough for the avatar's lip-sync.
 */
export function estimateWordTimes(text: string, duration: number): XttsWord[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  const weights = tokens.map((t) => t.length + 1 + (/[.!?…]["'”’)\]]*$/.test(t) ? 6 : /[,;:]$/.test(t) ? 3 : 0));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let at = 0;
  return tokens.map((word, i) => {
    const span = (weights[i] / total) * duration;
    const speaking = (span * (word.length + 1)) / weights[i];
    const start = at;
    at += span;
    return { word, start, end: start + speaking };
  });
}

/** Voice-cloned speech from the XTTS-v2 server (apps/xtts): WAV audio plus estimated word timings in seconds. */
export async function xttsSpeech(text: string, voice: string, urls: string[], speed = 1): Promise<XttsSpeech> {
  const url = leastBusy(urls);
  inFlight.set(url, (inFlight.get(url) ?? 0) + 1);
  try {
    // CPU synthesis runs several times slower than real time and requests queue behind each other on a server.
    const res = await fetch(`${url}/tts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, voice, speed: Math.min(2, Math.max(0.5, speed)) }),
      signal: AbortSignal.timeout(15 * 60_000),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(json.error || `XTTS HTTP ${res.status}`);
    }
    const audio = Buffer.from(await res.arrayBuffer());
    const duration = Number(res.headers.get("x-duration")) || Math.max(1.2, text.length * 0.055);
    return { audio, words: estimateWordTimes(text, duration), duration };
  } finally {
    inFlight.set(url, (inFlight.get(url) ?? 1) - 1);
  }
}
