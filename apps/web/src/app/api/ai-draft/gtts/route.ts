import { mkdtemp, readFile, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { spawn } from "child_process";
import { NextRequest, NextResponse } from "next/server";
import { heygenConfig, heygenSpeech, rateLimited } from "@/lib/heygenSpeech";
import { requireWebApiSession } from "@/lib/serverRouteAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GttsBody = {
  input?: { ssml?: string; text?: string };
  voice?: { languageCode?: string; name?: string };
  audioConfig?: { audioEncoding?: string; speakingRate?: number; pitch?: number; volumeGainDb?: number };
  enableTimePointing?: number[] | string[];
};

function extractMarks(ssml: string): { words: string[]; plain: string } {
  const cleaned = ssml
    .replace(/<\/?speak>/gi, "")
    .replace(/<break[^/]*\/>/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
  const parts = cleaned.split(/<mark\s+name=['"]?\d+['"]?\s*\/>/i);
  const words = parts.map((p) => p.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
  return { words, plain: words.join(" ").trim() };
}

type TtsResult = { audioContent: string; timepoints: { markName: string; timeSeconds: number }[] };

/** Text between TalkingHead's `<mark name='i'/>` tags, indexed by mark number (empty entries kept so indices line up). */
function markParts(ssml: string): string[] {
  const body = ssml.replace(/<\/?speak>/gi, "").replace(/<break[^>]*\/>/gi, " ");
  return body.split(/<mark\s+name=['"]?\d+['"]?\s*\/>/i).map((p) =>
    p
      .replace(/<[^>]+>/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

const HEYGEN_CACHE = new Map<string, TtsResult>();
const HEYGEN_CACHE_MAX = 300;

async function heygenSynthesize(parts: string[], voiceId: string, apiKey: string, speed: number): Promise<TtsResult> {
  const text = parts.filter(Boolean).join(" ");
  const cacheKey = `${voiceId}|${speed}|${text}`;
  const cached = HEYGEN_CACHE.get(cacheKey);
  if (cached) return cached;

  const { audio, words, duration } = await heygenSpeech(text, voiceId, apiKey, speed);
  const starts: number[] = [];
  let j = 0;
  let last = 0;
  for (const part of parts) {
    const tokens = part ? part.split(" ").length : 0;
    if (tokens && j < words.length) last = words[j].start;
    starts.push(last);
    j += tokens;
  }
  const aligned = words.length > 0 && Math.abs(j - words.length) <= Math.max(2, Math.round(words.length * 0.1));
  const timepoints = aligned
    ? starts.slice(1).map((t, i) => ({ markName: String(i + 1), timeSeconds: Number(t.toFixed(3)) }))
    : fabricateTimepoints(parts.map((p) => p || " "), duration);

  const result = { audioContent: audio.toString("base64"), timepoints };
  if (HEYGEN_CACHE.size >= HEYGEN_CACHE_MAX) HEYGEN_CACHE.delete(HEYGEN_CACHE.keys().next().value as string);
  HEYGEN_CACHE.set(cacheKey, result);
  return result;
}

function isMaleVoice(name?: string, pitch?: number): boolean {
  if (pitch !== undefined && pitch < -0.5) return true;
  const n = (name || "").toLowerCase();
  if (!n) return false;
  // Google Cloud-style male voice names (Neural2-D/J/A, Wavenet-A/B/D, etc.)
  return /(neural2-[adj]|wavenet-[abd]|standard-[abd]|journey-d|news-[dn]|studio-m|male)/i.test(n);
}

function chunkText(text: string, max = 160): string[] {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    let cut = rest.lastIndexOf(" ", max);
    if (cut < 40) cut = max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

function fabricateTimepoints(words: string[], totalSec: number) {
  const weights = words.map((w) => Math.max(1, w.length));
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  let t = 0;
  const timepoints: { markName: string; timeSeconds: number }[] = [];
  for (let i = 1; i < words.length; i++) {
    t += (weights[i - 1] / sum) * totalSec;
    timepoints.push({ markName: String(i), timeSeconds: Number(t.toFixed(3)) });
  }
  return timepoints;
}

/** Same free Google Translate TTS used for female — no API key. */
async function googleTranslateMp3(text: string, lang: string): Promise<Buffer> {
  const tl = (lang || "en-US").split("-")[0] || "en";
  const chunks = chunkText(text, 160);
  const buffers: Buffer[] = [];
  for (const q of chunks) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "*/*",
        Referer: "https://translate.google.com/",
      },
    });
    if (!res.ok) throw new Error(`Google TTS HTTP ${res.status}`);
    buffers.push(Buffer.from(await res.arrayBuffer()));
  }
  return Buffer.concat(buffers);
}

/**
 * Free Google Translate TTS has no gender switch (only one EN voice).
 * For male we deepen the same Google audio with a pitch shift — still Google TTS, no Cloud key.
 */
async function deepenForMale(mp3: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "gtts-"));
  const input = join(dir, "in.mp3");
  const output = join(dir, "out.mp3");
  try {
    await writeFile(input, mp3);
    await new Promise<void>((resolve, reject) => {
      const ff = spawn(
        "ffmpeg",
        [
          "-y",
          "-i",
          input,
          "-filter:a",
          "asetrate=24000*0.84,aresample=24000,atempo=1.05",
          "-c:a",
          "libmp3lame",
          "-q:a",
          "4",
          output,
        ],
        { stdio: ["ignore", "ignore", "pipe"] },
      );
      let err = "";
      ff.stderr.on("data", (d) => {
        err += d.toString();
      });
      ff.on("error", (e) => reject(e));
      ff.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(err.slice(-400) || `ffmpeg exit ${code}`));
      });
    });
    return await readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function googleCloudSynthesize(body: GttsBody, apiKey: string, male: boolean) {
  const encoding =
    body.audioConfig?.audioEncoding === "OGG_OPUS" || body.audioConfig?.audioEncoding === "OGG-OPUS"
      ? "OGG_OPUS"
      : "MP3";
  const payload = {
    input: body.input,
    voice: {
      languageCode: body.voice?.languageCode || "en-US",
      name: body.voice?.name || (male ? "en-US-Neural2-D" : "en-US-Neural2-F"),
    },
    audioConfig: {
      audioEncoding: encoding,
      speakingRate: body.audioConfig?.speakingRate ?? 1,
      pitch: body.audioConfig?.pitch ?? (male ? -2 : 0),
      volumeGainDb: body.audioConfig?.volumeGainDb ?? 0,
    },
    enableTimePointing: body.enableTimePointing ?? ["SSML_MARK"],
  };
  const res = await fetch(`https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Google Cloud TTS ${res.status}`);
  return data as { audioContent: string; timepoints?: { markName: string; timeSeconds: number }[] };
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireWebApiSession(req, ["instructor", "admin", "registrar"]);
    if (session instanceof NextResponse) return session;
    const body = (await req.json()) as GttsBody;
    const ssml = body.input?.ssml || "";
    const text = body.input?.text || "";
    const { words, plain } = ssml ? extractMarks(ssml) : { words: text.split(/\s+/).filter(Boolean), plain: text };
    if (!plain) {
      return NextResponse.json({ error: "Empty TTS input" }, { status: 400 });
    }

    if (plain.length > 5000) {
      return NextResponse.json({ error: "TTS input too long" }, { status: 413 });
    }

    const male = isMaleVoice(body.voice?.name, body.audioConfig?.pitch);

    const heygen = heygenConfig(male);
    if (heygen) {
      if (rateLimited(req, "ai-draft", 60)) {
        return NextResponse.json({ error: "Too many narration requests. Try again in a minute." }, { status: 429 });
      }
      try {
        const parts = ssml ? markParts(ssml) : [plain];
        const speed = Math.min(2, Math.max(0.5, body.audioConfig?.speakingRate || 1));
        const data = await heygenSynthesize(parts, heygen.voiceId, heygen.apiKey, speed);
        return NextResponse.json({ ...data, source: "heygen", gender: male ? "male" : "female" });
      } catch (err) {
        console.warn("HeyGen TTS failed, falling back to Google TTS:", err);
      }
    }

    const apiKey = (process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_API_KEY || "").trim();

    // Optional: real Google Cloud Neural2-D / Neural2-F when a key is present
    if (apiKey) {
      try {
        const data = await googleCloudSynthesize(body, apiKey, male);
        return NextResponse.json({ ...data, source: "google-cloud", gender: male ? "male" : "female" });
      } catch (err) {
        console.warn("Google Cloud TTS failed, using free Google Translate TTS:", err);
      }
    }

    // Free Google Translate TTS (same path that already works for female — no key)
    let mp3 = await googleTranslateMp3(plain, body.voice?.languageCode || "en-US");
    let source = "google-translate-tts";
    if (male) {
      try {
        mp3 = await deepenForMale(mp3);
        source = "google-translate-tts-male";
      } catch (err) {
        console.warn("Male pitch shift failed, returning original Google TTS:", err);
      }
    }

    const totalSec = Math.max(1.2, plain.length * (male ? 0.06 : 0.055));
    const timepoints = fabricateTimepoints(words.length ? words : plain.split(/\s+/), totalSec);
    return NextResponse.json({
      audioContent: mp3.toString("base64"),
      timepoints,
      source,
      gender: male ? "male" : "female",
    });
  } catch (err) {
    console.error("ai-draft gtts", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "TTS failed" }, { status: 500 });
  }
}
