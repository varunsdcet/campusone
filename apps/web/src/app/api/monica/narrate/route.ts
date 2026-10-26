import { NextRequest, NextResponse } from "next/server";
import { heygenConfig, heygenSpeech, rateLimited } from "@/lib/heygenSpeech";
import { requireWebApiSession } from "@/lib/serverRouteAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHARS = 3000;

export async function POST(req: NextRequest) {
  const session = await requireWebApiSession(req, ["instructor", "admin", "registrar"]);
  if (session instanceof NextResponse) return session;
  const heygen = heygenConfig();
  if (!heygen) {
    return NextResponse.json({ error: "Narration voice is not configured on the server." }, { status: 503 });
  }
  if (rateLimited(req, "monica", 40)) {
    return NextResponse.json({ error: "Too many narration requests. Wait a minute and press Play again." }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { text?: unknown; speed?: unknown };
  const text = typeof body.text === "string" ? body.text.replace(/\s+/g, " ").trim() : "";
  if (!text) return NextResponse.json({ error: "Nothing to read." }, { status: 400 });
  if (text.length > MAX_CHARS) return NextResponse.json({ error: `Each part must be under ${MAX_CHARS} characters.` }, { status: 413 });
  const speed = typeof body.speed === "number" && Number.isFinite(body.speed) ? body.speed : 1;

  try {
    const { audio, words, duration } = await heygenSpeech(text, heygen.voiceId, heygen.apiKey, speed);
    return NextResponse.json({
      audio: audio.toString("base64"),
      duration,
      words: words.map((w) => w.word),
      wtimes: words.map((w) => Math.round(w.start * 1000)),
      wdurations: words.map((w) => Math.max(40, Math.round((w.end - w.start) * 1000))),
    });
  } catch (err) {
    console.error("monica narrate", err);
    return NextResponse.json({ error: "The voice service did not respond. Press Play to retry this part." }, { status: 502 });
  }
}
